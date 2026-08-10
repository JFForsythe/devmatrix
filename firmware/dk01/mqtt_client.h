// SPDX-License-Identifier: GPL-3.0-or-later
#pragma once

#ifdef DMX_MQTT_FIND_IDF_HEADER
#include_next <mqtt_client.h>
#else
#define DMX_MQTT_FIND_IDF_HEADER
#include_next <mqtt_client.h>
#undef DMX_MQTT_FIND_IDF_HEADER

#ifndef DMX_DK01_MQTT_CLIENT_H
#define DMX_DK01_MQTT_CLIENT_H

// DK-01 MQTT client. MQTT payload storage is fixed-size and all display work is
// deferred to loop(); esp-mqtt's task only assembles bounded messages and sets
// flags. Expected non-TLS cost is about 15 KiB of static storage here plus the
// esp-mqtt task/client/outbox allocations (typically 16-24 KiB). A TLS handshake
// needs additional temporary heap and remains a P2 measurement item.

#include <Arduino.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <time.h>

// This sketch-local file intentionally has the same required name as ESP-IDF's
// public header. The sentinel pass above skips duplicate Arduino sketch include
// roots until it reaches the vendored esp-mqtt API selected by ADR-0028.

static const size_t DMX_MQTT_PAYLOAD_CAP = 2048;
static const size_t DMX_MQTT_TOPIC_CAP = 128;
static const size_t DMX_MQTT_OUT_CAP = 2048;
static const uint8_t DMX_MQTT_QUEUE_DEPTH = 4;
static const uint8_t DMX_MQTT_RECENT_IDS = 8;

enum DmxMqttStatus : uint8_t {
  DMX_MQTT_DISABLED,
  DMX_MQTT_CONNECTING,
  DMX_MQTT_CONNECTED,
  DMX_MQTT_ERROR,
};

struct DmxMqttConfig {
  bool enabled;
  bool tls;
  uint16_t port;
  char host[128];
  char username[65];
  char password[129];
};

struct DmxMqttHooks {
  const char* (*sceneName)();
  uint8_t (*deviceBrightness)();
  bool (*showText)(const char* text, uint32_t durationS, char* error,
                   size_t errorCap);
  bool (*setBrightness)(uint8_t value, char* error, size_t errorCap);
  bool (*clearDisplay)(char* error, size_t errorCap);
  bool (*showApp)(const char* app, char* error, size_t errorCap);
};

struct DmxMqttInbound {
  char topic[DMX_MQTT_TOPIC_CAP];
  char payload[DMX_MQTT_PAYLOAD_CAP + 1];
  uint16_t length;
  bool oversized;
  char requestId[37];
};

static DmxMqttConfig dmxMqttConfig = {false, false, 1883, "", "", ""};
static DmxMqttHooks dmxMqttHooks = {};
static esp_mqtt_client_handle_t dmxMqttClient = nullptr;
static volatile DmxMqttStatus dmxMqttStatus = DMX_MQTT_DISABLED;
static volatile bool dmxMqttConnected = false;
static volatile uint8_t dmxMqttDiscoveryMask = 0;
static volatile bool dmxMqttStateBirthPending = false;

static char dmxMqttSerial[18];
static char dmxMqttFirmware[16];
static char dmxMqttRoot[48];
static char dmxMqttAvailabilityTopic[80];
static char dmxMqttDisplayTopic[80];
static char dmxMqttHealthTopic[80];
static char dmxMqttResponsePrefix[80];
static char dmxMqttRequestTopics[4][DMX_MQTT_TOPIC_CAP];
static const char* const dmxMqttVerbs[4] = {
    "display.text", "display.brightness", "display.clear", "app.show"};

static DmxMqttInbound dmxMqttQueue[DMX_MQTT_QUEUE_DEPTH];
static volatile uint8_t dmxMqttQueueHead = 0;
static volatile uint8_t dmxMqttQueueTail = 0;
static volatile uint8_t dmxMqttQueueCount = 0;
static portMUX_TYPE dmxMqttQueueMux = portMUX_INITIALIZER_UNLOCKED;

static char dmxMqttAssemblyTopic[DMX_MQTT_TOPIC_CAP];
static char dmxMqttAssemblyPayload[DMX_MQTT_PAYLOAD_CAP + 1];
static int dmxMqttAssemblyMsgId = -1;
static int dmxMqttAssemblyTotal = 0;
static bool dmxMqttAssemblyOversized = false;

static char dmxMqttOut[DMX_MQTT_OUT_CAP];
static char dmxMqttRecentIds[DMX_MQTT_RECENT_IDS][37];
static uint8_t dmxMqttRecentNext = 0;

static void dmxMqttCopy(char* out, size_t cap, const char* value) {
  if (!cap) return;
  strlcpy(out, value ? value : "", cap);
}

static const char* dmxMqttStatusText() {
  switch (dmxMqttStatus) {
    case DMX_MQTT_CONNECTING: return "connecting";
    case DMX_MQTT_CONNECTED: return "connected";
    case DMX_MQTT_ERROR: return "error";
    default: return "disabled";
  }
}

static void dmxMqttMakeUuid(char out[37]) {
  uint8_t b[16];
  for (uint8_t i = 0; i < sizeof b; i += 4) {
    uint32_t random = esp_random();
    memcpy(b + i, &random, 4);
  }
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  snprintf(out, 37,
           "%02x%02x%02x%02x-%02x%02x-%02x%02x-%02x%02x-"
           "%02x%02x%02x%02x%02x%02x",
           b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7], b[8], b[9],
           b[10], b[11], b[12], b[13], b[14], b[15]);
}

// Best effort is deliberate: before SNTP has set the clock this returns a
// valid epoch-era RFC3339 value and never delays boot or rendering.
static void dmxMqttTimestamp(char out[21]) {
  time_t now = time(nullptr);
  struct tm utc = {};
  gmtime_r(&now, &utc);
  strftime(out, 21, "%Y-%m-%dT%H:%M:%SZ", &utc);
}

static bool dmxMqttValidUuid(const char* id) {
  if (!id || strlen(id) != 36) return false;
  for (uint8_t i = 0; i < 36; ++i) {
    bool dash = i == 8 || i == 13 || i == 18 || i == 23;
    if (dash ? id[i] != '-' : !isxdigit((unsigned char)id[i])) return false;
  }
  return true;
}

// Extract only a canonical UUID from a prefix that may be truncated. This is
// used solely to correlate payload-too-large/queue-full errors; valid envelopes
// are parsed below with ArduinoJson.
static bool dmxMqttExtractUuid(const char* json, size_t length, char out[37]) {
  if (!json || length < 43) return false;
  for (size_t i = 0; i + 4 < length; ++i) {
    if (json[i] != '"' || json[i + 1] != 'i' || json[i + 2] != 'd' ||
        json[i + 3] != '"')
      continue;
    size_t p = i + 4;
    while (p < length && isspace((unsigned char)json[p])) ++p;
    if (p >= length || json[p++] != ':') continue;
    while (p < length && isspace((unsigned char)json[p])) ++p;
    if (p >= length || json[p++] != '"' || p + 36 >= length) continue;
    memcpy(out, json + p, 36);
    out[36] = 0;
    if (json[p + 36] == '"' && dmxMqttValidUuid(out)) return true;
  }
  out[0] = 0;
  return false;
}

static bool dmxMqttSeenId(const char* id) {
  for (uint8_t i = 0; i < DMX_MQTT_RECENT_IDS; ++i)
    if (!strcmp(dmxMqttRecentIds[i], id)) return true;
  dmxMqttCopy(dmxMqttRecentIds[dmxMqttRecentNext], 37, id);
  dmxMqttRecentNext = (dmxMqttRecentNext + 1) % DMX_MQTT_RECENT_IDS;
  return false;
}

static int64_t dmxMqttDaysFromCivil(int year, unsigned month, unsigned day) {
  year -= month <= 2;
  const int era = (year >= 0 ? year : year - 399) / 400;
  const unsigned yoe = (unsigned)(year - era * 400);
  const unsigned doy = (153 * (month + (month > 2 ? -3 : 9)) + 2) / 5 +
                       day - 1;
  const unsigned doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
  return (int64_t)era * 146097 + (int64_t)doe - 719468;
}

static bool dmxMqttLeapYear(int year) {
  return (year % 4 == 0 && year % 100 != 0) || year % 400 == 0;
}

// Accept UTC RFC3339 with an optional fractional second and a mandatory Z.
static bool dmxMqttParseTimestamp(const char* value, int64_t& epoch) {
  if (!value || strlen(value) < 20 || value[4] != '-' || value[7] != '-' ||
      value[10] != 'T' || value[13] != ':' || value[16] != ':')
    return false;
  const uint8_t digits[] = {0, 1, 2, 3, 5, 6, 8, 9, 11, 12, 14, 15, 17, 18};
  for (uint8_t index : digits)
    if (!isdigit((unsigned char)value[index])) return false;
  int year = (value[0] - '0') * 1000 + (value[1] - '0') * 100 +
             (value[2] - '0') * 10 + value[3] - '0';
  unsigned month = (value[5] - '0') * 10 + value[6] - '0';
  unsigned day = (value[8] - '0') * 10 + value[9] - '0';
  unsigned hour = (value[11] - '0') * 10 + value[12] - '0';
  unsigned minute = (value[14] - '0') * 10 + value[15] - '0';
  unsigned second = (value[17] - '0') * 10 + value[18] - '0';
  static const uint8_t daysByMonth[] = {31, 28, 31, 30, 31, 30,
                                         31, 31, 30, 31, 30, 31};
  if (year < 1970 || month < 1 || month > 12 || day < 1 || hour > 23 ||
      minute > 59 || second > 59)
    return false;
  unsigned monthDays = daysByMonth[month - 1];
  if (month == 2 && dmxMqttLeapYear(year)) ++monthDays;
  if (day > monthDays) return false;
  const char* tail = value + 19;
  if (*tail == '.') {
    if (!isdigit((unsigned char)*++tail)) return false;
    while (isdigit((unsigned char)*tail)) ++tail;
  }
  if (*tail != 'Z' || tail[1]) return false;
  epoch = dmxMqttDaysFromCivil(year, month, day) * 86400 + hour * 3600 +
          minute * 60 + second;
  return true;
}

static constexpr bool dmxMqttRequestExpired(int64_t created, uint32_t expiry,
                                            int64_t now) {
  return now > created + (int64_t)expiry;
}

static_assert(dmxMqttRequestExpired(100, 30, 131),
              "MQTT replay guard must reject ts + expiry + 1");

static int dmxMqttEnqueue(const char* topic, const char* payload, size_t length,
                          int qos, bool retain) {
  if (!dmxMqttClient || !dmxMqttConnected) return -1;
  return esp_mqtt_client_enqueue(dmxMqttClient, topic, payload, (int)length,
                                 qos, retain ? 1 : 0, true);
}

static bool dmxMqttPublishResponse(const char* requestId, bool ok,
                                   const char* error) {
  if (!dmxMqttValidUuid(requestId)) return false;
  JsonDocument doc;
  char messageId[37], ts[21], topic[DMX_MQTT_TOPIC_CAP];
  dmxMqttMakeUuid(messageId);
  dmxMqttTimestamp(ts);
  doc["v"] = 1;
  doc["id"] = messageId;
  doc["ts"] = ts;
  JsonObject payload = doc["payload"].to<JsonObject>();
  payload["ok"] = ok;
  if (!ok) payload["error"] = error ? error : "request-failed";
  size_t length = serializeJson(doc, dmxMqttOut, sizeof dmxMqttOut);
  if (!length || length >= sizeof dmxMqttOut) return false;
  snprintf(topic, sizeof topic, "%s%s", dmxMqttResponsePrefix, requestId);
  return dmxMqttEnqueue(topic, dmxMqttOut, length, 1, false) >= 0;
}

// Emergency response used only by the esp-mqtt task if loop() is not draining
// the bounded queue. UUID validation makes both interpolated values topic/JSON
// safe; the normal envelope path above uses ArduinoJson.
static void dmxMqttPublishBusyFromEvent(const char* requestId) {
  if (!dmxMqttValidUuid(requestId) || !dmxMqttClient || !dmxMqttConnected)
    return;
  char messageId[37], ts[21], topic[DMX_MQTT_TOPIC_CAP], body[256];
  dmxMqttMakeUuid(messageId);
  dmxMqttTimestamp(ts);
  snprintf(topic, sizeof topic, "%s%s", dmxMqttResponsePrefix, requestId);
  int length = snprintf(body, sizeof body,
                        "{\"v\":1,\"id\":\"%s\",\"ts\":\"%s\","
                        "\"payload\":{\"ok\":false,"
                        "\"error\":\"device-busy\"}}",
                        messageId, ts);
  if (length > 0 && length < (int)sizeof body)
    esp_mqtt_client_enqueue(dmxMqttClient, topic, body, length, 1, 0, true);
}

static bool dmxMqttQueueAssembly() {
  uint8_t slot;
  portENTER_CRITICAL(&dmxMqttQueueMux);
  if (dmxMqttQueueCount >= DMX_MQTT_QUEUE_DEPTH) {
    portEXIT_CRITICAL(&dmxMqttQueueMux);
    char id[37];
    if (dmxMqttExtractUuid(dmxMqttAssemblyPayload,
                           min((size_t)dmxMqttAssemblyTotal,
                               DMX_MQTT_PAYLOAD_CAP),
                           id))
      dmxMqttPublishBusyFromEvent(id);
    return false;
  }
  slot = dmxMqttQueueTail;
  portEXIT_CRITICAL(&dmxMqttQueueMux);

  DmxMqttInbound& entry = dmxMqttQueue[slot];
  dmxMqttCopy(entry.topic, sizeof entry.topic, dmxMqttAssemblyTopic);
  entry.oversized = dmxMqttAssemblyOversized;
  entry.requestId[0] = 0;
  if (entry.oversized) {
    entry.length = 0;
    dmxMqttExtractUuid(dmxMqttAssemblyPayload, DMX_MQTT_PAYLOAD_CAP,
                       entry.requestId);
    entry.payload[0] = 0;
  } else {
    entry.length = (uint16_t)dmxMqttAssemblyTotal;
    memcpy(entry.payload, dmxMqttAssemblyPayload, entry.length);
    entry.payload[entry.length] = 0;
  }

  portENTER_CRITICAL(&dmxMqttQueueMux);
  dmxMqttQueueTail = (dmxMqttQueueTail + 1) % DMX_MQTT_QUEUE_DEPTH;
  ++dmxMqttQueueCount;
  portEXIT_CRITICAL(&dmxMqttQueueMux);
  return true;
}

static void dmxMqttHandleData(esp_mqtt_event_handle_t event) {
  if (event->topic && event->topic_len == 20 &&
      !memcmp(event->topic, "homeassistant/status", 20)) {
    if (event->total_data_len == 6 && event->data_len == 6 &&
        !memcmp(event->data, "online", 6))
      dmxMqttDiscoveryMask = 0x07;
    return;
  }

  if (event->current_data_offset == 0) {
    dmxMqttAssemblyMsgId = event->msg_id;
    dmxMqttAssemblyTotal = event->total_data_len;
    dmxMqttAssemblyOversized = event->total_data_len > DMX_MQTT_PAYLOAD_CAP;
    size_t topicLength = event->topic_len > 0 ? (size_t)event->topic_len : 0;
    if (topicLength >= sizeof dmxMqttAssemblyTopic)
      topicLength = sizeof dmxMqttAssemblyTopic - 1;
    if (topicLength) memcpy(dmxMqttAssemblyTopic, event->topic, topicLength);
    dmxMqttAssemblyTopic[topicLength] = 0;
    dmxMqttAssemblyPayload[0] = 0;
  }
  if (event->msg_id != dmxMqttAssemblyMsgId || event->total_data_len < 0)
    return;
  size_t offset = event->current_data_offset;
  if (offset < DMX_MQTT_PAYLOAD_CAP && event->data_len > 0) {
    size_t copyLength = min((size_t)event->data_len,
                            DMX_MQTT_PAYLOAD_CAP - offset);
    memcpy(dmxMqttAssemblyPayload + offset, event->data, copyLength);
    size_t end = offset + copyLength;
    dmxMqttAssemblyPayload[end] = 0;
  }
  if (event->current_data_offset + event->data_len >= event->total_data_len)
    dmxMqttQueueAssembly();
}

static void dmxMqttEvent(void*, esp_event_base_t, int32_t eventId,
                         void* eventData) {
  esp_mqtt_event_handle_t event = (esp_mqtt_event_handle_t)eventData;
  switch ((esp_mqtt_event_id_t)eventId) {
    case MQTT_EVENT_BEFORE_CONNECT:
      dmxMqttStatus = DMX_MQTT_CONNECTING;
      break;
    case MQTT_EVENT_CONNECTED: {
      dmxMqttConnected = true;
      dmxMqttStatus = DMX_MQTT_CONNECTED;
      esp_mqtt_topic_t subscriptions[5] = {
          {dmxMqttRequestTopics[0], 1}, {dmxMqttRequestTopics[1], 1},
          {dmxMqttRequestTopics[2], 1}, {dmxMqttRequestTopics[3], 1},
          {"homeassistant/status", 1}};
      esp_mqtt_client_subscribe_multiple(event->client, subscriptions, 5);
      esp_mqtt_client_enqueue(event->client, dmxMqttAvailabilityTopic, "online",
                              6, 1, 1, true);
      dmxMqttDiscoveryMask = 0x07;
      dmxMqttStateBirthPending = true;
      break;
    }
    case MQTT_EVENT_DISCONNECTED:
      dmxMqttConnected = false;
      if (dmxMqttStatus != DMX_MQTT_DISABLED &&
          dmxMqttStatus != DMX_MQTT_ERROR)
        dmxMqttStatus = DMX_MQTT_CONNECTING;
      break;
    case MQTT_EVENT_ERROR:
      dmxMqttStatus = DMX_MQTT_ERROR;
      break;
    case MQTT_EVENT_DATA:
      dmxMqttHandleData(event);
      break;
    default:
      break;
  }
}

static void dmxMqttBuildTopics() {
  snprintf(dmxMqttRoot, sizeof dmxMqttRoot, "devmatrix/%s", dmxMqttSerial);
  snprintf(dmxMqttAvailabilityTopic, sizeof dmxMqttAvailabilityTopic,
           "%s/availability", dmxMqttRoot);
  snprintf(dmxMqttDisplayTopic, sizeof dmxMqttDisplayTopic,
           "%s/state/display", dmxMqttRoot);
  snprintf(dmxMqttHealthTopic, sizeof dmxMqttHealthTopic, "%s/state/health",
           dmxMqttRoot);
  snprintf(dmxMqttResponsePrefix, sizeof dmxMqttResponsePrefix,
           "%s/response/", dmxMqttRoot);
  for (uint8_t i = 0; i < 4; ++i)
    snprintf(dmxMqttRequestTopics[i], sizeof dmxMqttRequestTopics[i],
             "%s/request/%s", dmxMqttRoot, dmxMqttVerbs[i]);
}

static void dmxMqttResetQueue() {
  portENTER_CRITICAL(&dmxMqttQueueMux);
  dmxMqttQueueHead = dmxMqttQueueTail = dmxMqttQueueCount = 0;
  portEXIT_CRITICAL(&dmxMqttQueueMux);
  dmxMqttAssemblyMsgId = -1;
  memset(dmxMqttRecentIds, 0, sizeof dmxMqttRecentIds);
  dmxMqttRecentNext = 0;
}

static void dmxMqttStop() {
  if (!dmxMqttClient) {
    dmxMqttConnected = false;
    dmxMqttStatus = DMX_MQTT_DISABLED;
    return;
  }
  if (dmxMqttConnected)
    esp_mqtt_client_enqueue(dmxMqttClient, dmxMqttAvailabilityTopic, "offline",
                            7, 1, 1, true);
  esp_mqtt_client_stop(dmxMqttClient);
  esp_mqtt_client_destroy(dmxMqttClient);
  dmxMqttClient = nullptr;
  dmxMqttConnected = false;
  dmxMqttStatus = DMX_MQTT_DISABLED;
  dmxMqttResetQueue();
}

static bool dmxMqttStart() {
  if (!dmxMqttConfig.enabled || !dmxMqttConfig.host[0]) {
    dmxMqttStatus = DMX_MQTT_DISABLED;
    return true;
  }
  dmxMqttBuildTopics();
  esp_mqtt_client_config_t config = {};
  config.broker.address.hostname = dmxMqttConfig.host;
  config.broker.address.port = dmxMqttConfig.port;
  config.broker.address.transport = dmxMqttConfig.tls
                                        ? MQTT_TRANSPORT_OVER_SSL
                                        : MQTT_TRANSPORT_OVER_TCP;
  if (dmxMqttConfig.tls) {
    // Pre-P2 TLS matches apps_engine.h: encrypted transport, no CA identity
    // verification until SECURITY.md defines the owner CA-store contract.
    config.broker.verification.skip_cert_common_name_check = true;
  }
  config.credentials.client_id = dmxMqttSerial;
  config.credentials.username = dmxMqttConfig.username[0]
                                    ? dmxMqttConfig.username
                                    : nullptr;
  config.credentials.authentication.password = dmxMqttConfig.password[0]
                                                   ? dmxMqttConfig.password
                                                   : nullptr;
  config.session.protocol_ver = MQTT_PROTOCOL_V_3_1_1;
  config.session.last_will.topic = dmxMqttAvailabilityTopic;
  config.session.last_will.msg = "offline";
  config.session.last_will.msg_len = 7;
  config.session.last_will.qos = 1;
  config.session.last_will.retain = 1;
  config.network.timeout_ms = 2500;
  config.buffer.size = 2304;
  config.buffer.out_size = 2304;
  config.outbox.limit = 16384;
  dmxMqttClient = esp_mqtt_client_init(&config);
  if (!dmxMqttClient) {
    dmxMqttStatus = DMX_MQTT_ERROR;
    return false;
  }
  esp_mqtt_client_register_event(dmxMqttClient, MQTT_EVENT_ANY,
                                 dmxMqttEvent, nullptr);
  dmxMqttStatus = DMX_MQTT_CONNECTING;
  if (esp_mqtt_client_start(dmxMqttClient) != ESP_OK) {
    esp_mqtt_client_destroy(dmxMqttClient);
    dmxMqttClient = nullptr;
    dmxMqttStatus = DMX_MQTT_ERROR;
    return false;
  }
  return true;
}

static void dmxMqttLoad(Preferences& prefs) {
  memset(&dmxMqttConfig, 0, sizeof dmxMqttConfig);
  dmxMqttConfig.enabled = prefs.getBool("mq_en", false);
  dmxMqttConfig.tls = prefs.getBool("mq_tls", false);
  dmxMqttConfig.port = prefs.getUShort("mq_port", 1883);
  if (!dmxMqttConfig.port) dmxMqttConfig.port = 1883;
  prefs.getString("mq_host", dmxMqttConfig.host, sizeof dmxMqttConfig.host);
  prefs.getString("mq_user", dmxMqttConfig.username,
                  sizeof dmxMqttConfig.username);
  prefs.getString("mq_pass", dmxMqttConfig.password,
                  sizeof dmxMqttConfig.password);
}

static bool dmxMqttSave(Preferences& prefs, bool enabled, const char* host,
                        uint16_t port, const char* username, bool tls,
                        const char* password, bool writePassword) {
  dmxMqttStop();
  dmxMqttConfig.enabled = enabled;
  dmxMqttConfig.tls = tls;
  dmxMqttConfig.port = port ? port : 1883;
  dmxMqttCopy(dmxMqttConfig.host, sizeof dmxMqttConfig.host, host);
  dmxMqttCopy(dmxMqttConfig.username, sizeof dmxMqttConfig.username, username);
  if (writePassword)
    dmxMqttCopy(dmxMqttConfig.password, sizeof dmxMqttConfig.password,
                password);
  prefs.putBool("mq_en", dmxMqttConfig.enabled);
  prefs.putBool("mq_tls", dmxMqttConfig.tls);
  prefs.putUShort("mq_port", dmxMqttConfig.port);
  prefs.putString("mq_host", dmxMqttConfig.host);
  prefs.putString("mq_user", dmxMqttConfig.username);
  if (writePassword) prefs.putString("mq_pass", dmxMqttConfig.password);
  return dmxMqttStart();
}

static void dmxMqttBegin(const char* serial, const char* firmware,
                         const DmxMqttHooks& hooks) {
  dmxMqttCopy(dmxMqttSerial, sizeof dmxMqttSerial, serial);
  dmxMqttCopy(dmxMqttFirmware, sizeof dmxMqttFirmware, firmware);
  dmxMqttHooks = hooks;
  dmxMqttResetQueue();
  dmxMqttStart();
}

static bool dmxMqttPublishDisplayState() {
  if (!dmxMqttHooks.sceneName || !dmxMqttHooks.deviceBrightness) return false;
  JsonDocument doc;
  char id[37], ts[21];
  dmxMqttMakeUuid(id);
  dmxMqttTimestamp(ts);
  doc["v"] = 1;
  doc["id"] = id;
  doc["ts"] = ts;
  JsonObject payload = doc["payload"].to<JsonObject>();
  payload["scene"] = dmxMqttHooks.sceneName();
  uint8_t device = constrain(dmxMqttHooks.deviceBrightness(), 10, 150);
  // Home Assistant speaks 0..255; the panel's USB-safe 10..150 range is
  // linearly mapped in both directions. Thus HA 0 is the safe minimum 10,
  // HA 255 is the device ceiling 150, and retained state uses the HA scale.
  payload["brightness"] = ((uint16_t)(device - 10) * 255 + 70) / 140;
  size_t length = serializeJson(doc, dmxMqttOut, sizeof dmxMqttOut);
  return length && length < sizeof dmxMqttOut &&
         dmxMqttEnqueue(dmxMqttDisplayTopic, dmxMqttOut, length, 1, true) >= 0;
}

static bool dmxMqttPublishHealth(uint32_t uptimeS, uint32_t heapFree,
                                 int rssi, float tempC) {
  JsonDocument doc;
  char id[37], ts[21];
  dmxMqttMakeUuid(id);
  dmxMqttTimestamp(ts);
  doc["v"] = 1;
  doc["id"] = id;
  doc["ts"] = ts;
  JsonObject payload = doc["payload"].to<JsonObject>();
  payload["uptime_s"] = uptimeS;
  payload["heap_free_b"] = heapFree;
  payload["rssi_dbm"] = rssi;
  payload["temp_c"] = tempC;
  size_t length = serializeJson(doc, dmxMqttOut, sizeof dmxMqttOut);
  return length && length < sizeof dmxMqttOut &&
         dmxMqttEnqueue(dmxMqttHealthTopic, dmxMqttOut, length, 1, true) >= 0;
}

static void dmxMqttAddDiscoveryCommon(JsonDocument& doc, const char* name,
                                      const char* suffix) {
  char uniqueId[40];
  snprintf(uniqueId, sizeof uniqueId, "%s_%s", dmxMqttSerial, suffix);
  doc["name"] = name;
  doc["unique_id"] = uniqueId;
  doc["availability_topic"] = dmxMqttAvailabilityTopic;
  doc["payload_available"] = "online";
  doc["payload_not_available"] = "offline";
  doc["qos"] = 1;
  doc["retain"] = false;
  JsonObject device = doc["device"].to<JsonObject>();
  JsonArray identifiers = device["identifiers"].to<JsonArray>();
  identifiers.add(dmxMqttSerial);
  device["name"] = dmxMqttSerial;
  device["manufacturer"] = "Devmatrix";
  device["model"] = "DK-01";
  device["serial_number"] = dmxMqttSerial;
  device["sw_version"] = dmxMqttFirmware;
}

static const char* const DMX_HA_ID_TEMPLATE =
    "{% set n=utcnow().strftime('%Y%m%d%H%M%S%f') %}"
    "{{ n[0:8] }}-{{ n[8:12] }}-4{{ n[12:15] }}-"
    "8{{ n[15:18] }}-{{ n[18:20] }}0000000000";

static bool dmxMqttHaEnvelope(char* out, size_t cap, const char* payload) {
  int length = snprintf(
      out, cap,
      "{\"v\":1,\"id\":\"%s\","
      "\"ts\":\"{{ utcnow().strftime('%%Y-%%m-%%dT%%H:%%M:%%SZ') }}\","
      "\"expiry\":30,\"payload\":%s}",
      DMX_HA_ID_TEMPLATE, payload);
  return length > 0 && (size_t)length < cap;
}

static bool dmxMqttPublishDiscovery(uint8_t component) {
  JsonDocument doc;
  char topic[96], commandTemplate[768];
  const char* componentName;
  const char* suffix;
  if (component == 0) {
    componentName = "light";
    suffix = "brightness";
    dmxMqttAddDiscoveryCommon(doc, "Display brightness", suffix);
    doc["schema"] = "template";
    doc["command_topic"] = dmxMqttRequestTopics[1];
    doc["state_topic"] = dmxMqttDisplayTopic;
    doc["state_template"] = "{{ 'on' }}";
    doc["brightness_template"] =
        "{{ value_json.payload.brightness | int }}";
    if (!dmxMqttHaEnvelope(commandTemplate, sizeof commandTemplate,
                           "{\"brightness\":{{ brightness | default(255) }}}"))
      return false;
    doc["command_on_template"] = commandTemplate;
    if (!dmxMqttHaEnvelope(commandTemplate, sizeof commandTemplate,
                           "{\"brightness\":0}"))
      return false;
    doc["command_off_template"] = commandTemplate;
  } else if (component == 1) {
    componentName = "text";
    suffix = "text";
    dmxMqttAddDiscoveryCommon(doc, "Display text", suffix);
    doc["command_topic"] = dmxMqttRequestTopics[0];
    doc["max"] = 120;
    if (!dmxMqttHaEnvelope(commandTemplate, sizeof commandTemplate,
                           "{\"text\":{{ value | to_json }}}"))
      return false;
    doc["command_template"] = commandTemplate;
  } else {
    componentName = "notify";
    suffix = "notify";
    dmxMqttAddDiscoveryCommon(doc, "Display notification", suffix);
    doc["command_topic"] = dmxMqttRequestTopics[0];
    if (!dmxMqttHaEnvelope(commandTemplate, sizeof commandTemplate,
                           "{\"text\":{{ message | to_json }}}"))
      return false;
    doc["command_template"] = commandTemplate;
  }
  snprintf(topic, sizeof topic, "homeassistant/%s/%s/config", componentName,
           dmxMqttSerial);
  size_t length = serializeJson(doc, dmxMqttOut, sizeof dmxMqttOut);
  return length && length < sizeof dmxMqttOut &&
         dmxMqttEnqueue(topic, dmxMqttOut, length, 1, true) >= 0;
}

static void dmxMqttHandleRequest(DmxMqttInbound& request) {
  if (request.oversized) {
    if (request.requestId[0])
      dmxMqttPublishResponse(request.requestId, false, "payload-too-large");
    return;
  }

  JsonDocument doc;
  DeserializationError parse =
      deserializeJson(doc, request.payload, request.length);
  if (parse || !doc.is<JsonObject>()) {
    char id[37];
    if (dmxMqttExtractUuid(request.payload, request.length, id))
      dmxMqttPublishResponse(id, false, "invalid-json");
    return;
  }
  JsonObjectConst envelope = doc.as<JsonObjectConst>();
  const char* id = envelope["id"] | nullptr;
  if (!dmxMqttValidUuid(id)) return;
  if (dmxMqttSeenId(id)) return;  // QoS 1 duplicate: never execute twice.
  if (!envelope["v"].is<int>() || envelope["v"].as<int>() != 1) {
    dmxMqttPublishResponse(id, false, "unsupported-envelope-version");
    return;
  }
  const char* timestamp = envelope["ts"] | nullptr;
  if (!timestamp || !envelope["expiry"].is<uint32_t>()) {
    dmxMqttPublishResponse(id, false, "invalid-envelope");
    return;
  }
  uint32_t expiry = envelope["expiry"].as<uint32_t>();
  int64_t created;
  if (!expiry || !dmxMqttParseTimestamp(timestamp, created)) {
    dmxMqttPublishResponse(id, false, "invalid-envelope");
    return;
  }
  // Replay guard: the error response is queued before any hook is selected, so
  // a stale request demonstrably cannot mutate display/app state.
  if (dmxMqttRequestExpired(created, expiry, (int64_t)time(nullptr))) {
    dmxMqttPublishResponse(id, false, "request-expired");
    return;
  }
  JsonObjectConst payload = envelope["payload"].as<JsonObjectConst>();
  if (payload.isNull()) {
    dmxMqttPublishResponse(id, false, "invalid-payload");
    return;
  }

  char error[80] = "request-failed";
  bool ok = false;
  if (!strcmp(request.topic, dmxMqttRequestTopics[0])) {
    const char* text = payload["text"] | nullptr;
    uint32_t duration = payload["duration_s"] | 10;
    if (!text || strlen(text) > 120 || duration < 1 || duration > 300)
      dmxMqttCopy(error, sizeof error, "invalid-display-text");
    else if (dmxMqttHooks.showText)
      ok = dmxMqttHooks.showText(text, duration, error, sizeof error);
  } else if (!strcmp(request.topic, dmxMqttRequestTopics[1])) {
    if (!payload["brightness"].is<int>()) {
      dmxMqttCopy(error, sizeof error, "invalid-brightness");
    } else {
      int homeAssistant = payload["brightness"].as<int>();
      if (homeAssistant < 0 || homeAssistant > 255)
        dmxMqttCopy(error, sizeof error, "invalid-brightness");
      else if (dmxMqttHooks.setBrightness) {
        uint8_t device = 10 +
            ((uint16_t)homeAssistant * 140 + 127) / 255;
        ok = dmxMqttHooks.setBrightness(device, error, sizeof error);
      }
    }
  } else if (!strcmp(request.topic, dmxMqttRequestTopics[2])) {
    if (dmxMqttHooks.clearDisplay)
      ok = dmxMqttHooks.clearDisplay(error, sizeof error);
  } else if (!strcmp(request.topic, dmxMqttRequestTopics[3])) {
    const char* app = payload["app"] | nullptr;
    if (!app)
      dmxMqttCopy(error, sizeof error, "invalid-app");
    else if (dmxMqttHooks.showApp)
      ok = dmxMqttHooks.showApp(app, error, sizeof error);
  } else {
    dmxMqttCopy(error, sizeof error, "unknown-verb");
  }
  dmxMqttPublishResponse(id, ok, ok ? nullptr : error);
}

static void dmxMqttTick(uint32_t uptimeS, uint32_t heapFree, int rssi,
                        float tempC) {
  if (!dmxMqttConnected) return;

  if (dmxMqttDiscoveryMask) {
    for (uint8_t component = 0; component < 3; ++component) {
      uint8_t bit = 1 << component;
      if (!(dmxMqttDiscoveryMask & bit)) continue;
      if (dmxMqttPublishDiscovery(component)) dmxMqttDiscoveryMask &= ~bit;
      break;  // one bounded discovery publish per loop pass
    }
  }

  uint8_t slot = 0;
  bool hasRequest = false;
  portENTER_CRITICAL(&dmxMqttQueueMux);
  if (dmxMqttQueueCount) {
    slot = dmxMqttQueueHead;
    hasRequest = true;
  }
  portEXIT_CRITICAL(&dmxMqttQueueMux);
  if (hasRequest) {
    dmxMqttHandleRequest(dmxMqttQueue[slot]);
    portENTER_CRITICAL(&dmxMqttQueueMux);
    dmxMqttQueueHead = (dmxMqttQueueHead + 1) % DMX_MQTT_QUEUE_DEPTH;
    --dmxMqttQueueCount;
    portEXIT_CRITICAL(&dmxMqttQueueMux);
  }

  static uint32_t lastDisplayCheck = 0, lastHealthCheck = 0;
  static uint32_t lastHealthPublish = 0, previousHeap = 0;
  static int previousRssi = 0;
  static float previousTemp = 0;
  static uint8_t previousBrightness = 0;
  static char previousScene[32] = "";
  uint32_t nowMs = millis();
  if (dmxMqttStateBirthPending && dmxMqttHooks.sceneName &&
      dmxMqttHooks.deviceBrightness) {
    bool displayPublished = dmxMqttPublishDisplayState();
    bool healthPublished = dmxMqttPublishHealth(uptimeS, heapFree, rssi, tempC);
    if (displayPublished && healthPublished) {
      dmxMqttCopy(previousScene, sizeof previousScene,
                  dmxMqttHooks.sceneName());
      previousBrightness = dmxMqttHooks.deviceBrightness();
      previousHeap = heapFree;
      previousRssi = rssi;
      previousTemp = tempC;
      lastHealthPublish = nowMs;
      dmxMqttStateBirthPending = false;
    }
  }
  if (nowMs - lastDisplayCheck >= 250 && dmxMqttHooks.sceneName &&
      dmxMqttHooks.deviceBrightness) {
    lastDisplayCheck = nowMs;
    const char* scene = dmxMqttHooks.sceneName();
    uint8_t level = dmxMqttHooks.deviceBrightness();
    if (strcmp(previousScene, scene) || previousBrightness != level) {
      if (dmxMqttPublishDisplayState()) {
        dmxMqttCopy(previousScene, sizeof previousScene, scene);
        previousBrightness = level;
      }
    }
  }
  if (nowMs - lastHealthCheck >= 1000) {
    lastHealthCheck = nowMs;
    bool heartbeat = !lastHealthPublish || nowMs - lastHealthPublish >= 60000;
    bool changed = !previousHeap ||
                   abs((int32_t)heapFree - (int32_t)previousHeap) >= 4096 ||
                   abs(rssi - previousRssi) >= 5 ||
                   fabsf(tempC - previousTemp) >= 0.5f;
    if ((heartbeat || changed) &&
        dmxMqttPublishHealth(uptimeS, heapFree, rssi, tempC)) {
      lastHealthPublish = nowMs;
      previousHeap = heapFree;
      previousRssi = rssi;
      previousTemp = tempC;
    }
  }
}

#endif  // DMX_DK01_MQTT_CLIENT_H
#endif  // DMX_MQTT_FIND_IDF_HEADER
