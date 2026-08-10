// Devmatrix DK-01 firmware — plug in, play, mess around.
//
// What this does, out of the box:
//   1. First boot: opens the DEVMATRIX-XXXX setup hotspot with a captive
//      portal — pick your Wi-Fi, watch it join live, get your LAN token.
//   2. Every boot after: joins your Wi-Fi, serves the Local Console at
//      http://dmx-xxxx.local/ — status, text, paint, brightness, OTA.
//   3. Updates: upload a new .bin from the Console. USB is only ever
//      needed once.
//
// Security posture (v0, pre-P2-freeze):
//   - No credentials are ever compiled in or logged. Wi-Fi creds and the
//     LAN token live only in device NVS, written at runtime (ADR-0023).
//   - The LAN token is revealed exactly twice: on the setup hotspot
//     (physical presence) and on the USB serial console (physical cable).
//   - HTTP only on the LAN; TLS is an open design item (docs/SECURITY.md).
//
// Build: arduino-cli compile --fqbn esp32:esp32:adafruit_matrixportal_esp32s3 .
// See README.md in this directory for the full quickstart.

#include <Adafruit_Protomatter.h>
#include <Fonts/TomThumb.h>  // 3x5 font: 16-char lines for board overlays
#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <DNSServer.h>
#include <ESPmDNS.h>
#include <Preferences.h>
#include <Update.h>
#include <time.h>
#include "esp_ota_ops.h"
#include "esp_system.h"
#include "mbedtls/base64.h"
#include "web_setup.h"
#include "web_console.h"
#include "apps_engine.h"
#include "apps_builtin.h"

#define FW_VERSION "0.7.0"

// A full-bright white frame can out-draw USB-C power and brown-out the
// board (observed on the bench 2026-08-07: brownout reset at high slider
// values). Cap until a powered-supply profile exists (M0 current budget).
#define MAX_BRIGHTNESS 150

// ---------------------------------------------------------------- hardware
// MatrixPortal S3 driving a 64x32 1/16-scan HUB75 panel (hardware/evidence/).
uint8_t rgbPins[]  = {42, 41, 40, 38, 39, 37};
uint8_t addrPins[] = {45, 36, 48, 35};
uint8_t clockPin = 2, latchPin = 47, oePin = 14;
// Bit depth 4 keeps refresh >= 200 Hz with Wi-Fi + HTTP live (P1 evidence).
Adafruit_Protomatter matrix(64, 4, 1, rgbPins, 4, addrPins, clockPin,
                            latchPin, oePin, true);

Preferences prefs;
WebServer server(80);
DNSServer dns;

// ---------------------------------------------------------------- state
String deviceId, apName, mdnsName, apiToken;
bool setupMode = false;

// Scenes: what the panel is showing right now.
#define SCENE_CLOCK 0
#define SCENE_FRAME 1
#define SCENE_MESSAGES 10
#define SCENE_FLIGHTS_LIST 11
#define SCENE_CUSTOM 12
int baseScene = SCENE_CLOCK;
uint16_t frameBuf[64 * 32];        // raw RGB565 from /api/v1/display/frame
String overlayText;
uint32_t overlayUntil = 0;         // text overlay deadline (0 = none)
uint32_t identifyUntil = 0;        // identify-flash deadline (0 = none)
int lastShown = -1;                // last scene id actually drawn
int scheduledScene = SCENE_CLOCK;  // clock + enabled apps, round-robin
uint8_t scheduledSlot = 0;         // 0 clock; 1..3 map to DmxAppIndex + 1
uint32_t scheduledUntil = 0;
int manualAppScene = -1;
uint32_t manualAppUntil = 0;

uint8_t brightness = 110;          // 10..MAX_BRIGHTNESS, NVS-persisted
String tzPosix = "CST6CDT,M3.2.0,M11.1.0";  // NVS-persisted, default US Central

// Flights Overhead companion-app config (NVS-persisted, edited in the
// Console's Flights page; the examples/flights-overhead.mjs script obeys it).
// The receiver URL is owner infrastructure: it lives ONLY in device NVS —
// typed or scanned via the Console, never a default, never in any repo.
String flUrl = "";
uint8_t flInterval = 1;            // seconds between updates, 1..60
uint8_t flRows = 2;                // flights shown, 1..5
String flFormat = "kts";           // "kts" or "alt"
String flView = "list";            // "list" (text board) or "radar" (pixels)

// Claim-code pairing (GLOSSARY: Claim code). A browser without the token
// asks the device to show a short code on the panel; typing it proves
// physical presence and earns the LAN token. Nobody has to save a hex string.
String claimCode;                  // 6 digits while active
uint32_t claimUntil = 0;           // code deadline (0 = none)
uint8_t claimAttempts = 0;

// Setup-portal join state machine.
#define JOIN_IDLE 0
#define JOIN_TRYING 1
#define JOIN_OK 2
#define JOIN_FAIL 3
int joinState = JOIN_IDLE;
bool joinIsBackground = false;     // silent retry of stored creds, not the portal
uint32_t joinStart = 0, nextBgRetry = 0;
String pendSsid, pendPass;

// OTA upload state.
bool otaAuthed = false;
String otaError;
uint32_t otaShownKb = 0;

uint32_t lastRefreshHz = 0;

// ---------------------------------------------------------------- helpers
uint16_t rgb(uint8_t r, uint8_t g, uint8_t b) {
  return matrix.color565((r * brightness) / 255, (g * brightness) / 255,
                         (b * brightness) / 255);
}

// Minimal flat-JSON readers — enough for {"key":"value","n":123} bodies,
// zero dependencies so the sketch stays a two-minute read.
bool jsonGet(const String& body, const char* key, String& out) {
  String pat = String("\"") + key + "\"";
  int k = body.indexOf(pat);
  if (k < 0) return false;
  int c = body.indexOf(':', k + pat.length());
  if (c < 0) return false;
  int q1 = body.indexOf('"', c + 1);
  if (q1 < 0) return false;
  out = "";
  for (int i = q1 + 1; i < (int)body.length(); i++) {
    char ch = body[i];
    if (ch == '\\' && i + 1 < (int)body.length()) {
      char e = body[++i];
      if (e == 'n') out += '\n';        // multi-line panel text
      else if (e == 't') out += ' ';
      else out += e;                    // \" \\ \/ pass through
      continue;
    }
    if (ch == '"') return true;
    out += ch;
  }
  return false;
}

long jsonInt(const String& body, const char* key, long dflt) {
  String pat = String("\"") + key + "\"";
  int k = body.indexOf(pat);
  if (k < 0) return dflt;
  int c = body.indexOf(':', k + pat.length());
  if (c < 0) return dflt;
  return body.substring(c + 1).toInt();
}

String jsonEscape(String s) {
  s.replace("\\", "\\\\");
  s.replace("\"", "\\\"");
  return s;
}

String makeToken() {
  char tok[33];
  for (int i = 0; i < 32; i += 8)
    snprintf(tok + i, 9, "%08lx", (unsigned long)esp_random());
  return String(tok);
}

bool authed() {
  return server.header("Authorization") == ("Bearer " + apiToken);
}

void sendJson(int code, const String& body) {
  server.send(code, "application/json", body);
}

void deny() { sendJson(401, "{\"error\":\"unauthorized\"}"); }

// ---------------------------------------------------------------- panel
void panelLines(const char* a, const char* b = "", const char* c = "",
                const char* d = "") {
  matrix.fillScreen(0);
  matrix.setTextWrap(false);
  matrix.setTextSize(1);
  const char* rows[4] = {a, b, c, d};
  const uint16_t cols[4] = {rgb(230, 230, 230), rgb(0, 230, 230),
                            rgb(230, 230, 0), rgb(0, 230, 0)};
  for (int i = 0; i < 4; i++) {
    if (!rows[i][0]) continue;
    matrix.setTextColor(cols[i]);
    matrix.setCursor(1, i * 8);
    matrix.print(rows[i]);
  }
  matrix.show();
}

void drawClock() {
  time_t now = time(nullptr);
  struct tm t;
  localtime_r(&now, &t);
  bool synced = now > 1700000000;
  char hhmm[6] = "--:--";
  if (synced) snprintf(hhmm, sizeof hhmm, "%02d:%02d", t.tm_hour, t.tm_min);
  matrix.fillScreen(0);
  matrix.setTextWrap(false);
  matrix.setTextSize(2);
  matrix.setTextColor(rgb(230, 230, 230));
  matrix.setCursor(3, 5);
  matrix.print(hhmm);
  if (synced && (t.tm_sec & 1)) {  // blink the colon by overdrawing it dim
    matrix.setTextColor(rgb(60, 60, 60));
    matrix.setCursor(3 + 2 * 12, 5);
    matrix.print(":");
  }
  matrix.setTextSize(1);
  matrix.setTextColor(rgb(0, 150, 150));
  matrix.setCursor(1, 23);
  matrix.print(mdnsName);
  if (synced)
    matrix.drawFastHLine(0, 31, 1 + (t.tm_sec * 63) / 59, rgb(0, 90, 140));
  matrix.show();
}

void drawOverlay() {
  matrix.fillScreen(0);
  matrix.setTextColor(rgb(230, 230, 0));
  if (overlayText.indexOf('\n') >= 0) {  // preformatted board: tiny 3x5 font
    matrix.setFont(&TomThumb);           // baseline-addressed, 16 chars/row
    matrix.setTextSize(1);
    matrix.setTextWrap(false);
    matrix.setCursor(0, 5);
    matrix.print(overlayText);
    matrix.setFont(NULL);                // back to the classic font for clock
    matrix.show();
    return;
  }
  if (overlayText.length() <= 5) {
    matrix.setTextSize(2);
    matrix.setCursor(2, 9);
  } else {
    matrix.setTextSize(1);
    matrix.setTextWrap(true);
    matrix.setCursor(1, 4);
  }
  matrix.print(overlayText);
  matrix.setTextWrap(false);
  matrix.show();
}

void drawFrame() {
  for (int y = 0; y < 32; y++)
    for (int x = 0; x < 64; x++) {
      uint16_t v = frameBuf[y * 64 + x];
      uint8_t r = (v >> 11) & 31, g = (v >> 5) & 63, b = v & 31;
      matrix.drawPixel(x, y, rgb((r << 3) | (r >> 2), (g << 2) | (g >> 4),
                                 (b << 3) | (b >> 2)));
    }
  matrix.show();
}

void drawIdentify(bool phase) {
  matrix.fillScreen(0);
  uint16_t c = phase ? rgb(240, 240, 240) : rgb(0, 180, 240);
  matrix.drawRect(0, 0, 64, 32, c);
  matrix.drawRect(1, 1, 62, 30, c);
  matrix.setTextSize(1);
  matrix.setTextColor(rgb(240, 240, 240));
  matrix.setCursor(8, 12);
  matrix.print(deviceId);
  matrix.show();
}

void drawClaim() {
  matrix.fillScreen(0);
  matrix.setTextWrap(false);
  matrix.setTextSize(2);
  matrix.setTextColor(rgb(240, 240, 240));  // top row: white
  matrix.setCursor(14, 0);
  matrix.print(claimCode.substring(0, 3));
  matrix.setTextColor(rgb(0, 180, 240));    // bottom row: blue
  matrix.setCursor(14, 16);
  matrix.print(claimCode.substring(3));
  matrix.show();
}

int appScene(uint8_t app) {
  if (app == DMX_APP_MESSAGES) return SCENE_MESSAGES;
  if (app == DMX_APP_FLIGHTS_LIST) return SCENE_FLIGHTS_LIST;
  return SCENE_CUSTOM;
}

uint8_t sceneApp(int scene) {
  if (scene == SCENE_MESSAGES) return DMX_APP_MESSAGES;
  if (scene == SCENE_FLIGHTS_LIST) return DMX_APP_FLIGHTS_LIST;
  return DMX_APP_CUSTOM;
}

bool appHasData(uint8_t app) {
  DmxAppFrame* frame = dmxAppFrame(app);
  return frame && frame->hasData && frame->rowCount > 0;
}

// The clock is always slot zero. Disabled apps are skipped; an enabled app
// with no usable data deliberately occupies its turn with the clock, which is
// the permanent failure fallback promised by ADR-0026.
int rotationScene(uint32_t nowMs) {
  if (manualAppUntil && (int32_t)(manualAppUntil - nowMs) > 0) {
    uint8_t app = sceneApp(manualAppScene);
    return appHasData(app) ? manualAppScene : SCENE_CLOCK;
  }
  if (manualAppUntil) { manualAppUntil = 0; manualAppScene = -1; }
  if (baseScene == SCENE_FRAME) return SCENE_FRAME;  // host radar stays live
  if (!scheduledUntil) {
    scheduledSlot = 0;
    scheduledScene = SCENE_CLOCK;
    scheduledUntil = nowMs + 10000UL;
    return scheduledScene;
  }
  if ((int32_t)(nowMs - scheduledUntil) < 0) return scheduledScene;
  for (uint8_t tries = 0; tries <= DMX_APP_COUNT; ++tries) {
    scheduledSlot = (scheduledSlot + 1) % (DMX_APP_COUNT + 1);
    if (scheduledSlot == 0) {
      scheduledScene = SCENE_CLOCK;
      scheduledUntil = nowMs + 10000UL;
      return scheduledScene;
    }
    uint8_t app = scheduledSlot - 1;
    if (!dmxAppSlots[app].enabled) continue;
    scheduledScene = appHasData(app) ? appScene(app) : SCENE_CLOCK;
    scheduledUntil = nowMs + (uint32_t)dmxAppDurationS[app] * 1000UL;
    return scheduledScene;
  }
  scheduledScene = SCENE_CLOCK;
  scheduledUntil = nowMs + 10000UL;
  return scheduledScene;
}

// Redraws only when the active scene changes or an animated scene ticks.
void renderTick() {
  static uint32_t lastClock = 0, lastBlink = 0, lastAppDraw = 0;
  static bool blinkPhase = false;
  uint32_t nowMs = millis();
  int scene;
  if (claimUntil && nowMs < claimUntil) scene = 102;
  else if (identifyUntil && nowMs < identifyUntil) scene = 100;
  else if (overlayUntil && nowMs < overlayUntil) scene = 101;
  else scene = rotationScene(nowMs);
  if (claimUntil && nowMs >= claimUntil) { claimUntil = 0; claimCode = ""; }
  if (identifyUntil && nowMs >= identifyUntil) identifyUntil = 0;
  if (overlayUntil && nowMs >= overlayUntil) overlayUntil = 0;

  bool changed = scene != lastShown;
  if (scene == 102) {
    if (changed) drawClaim();
  } else if (scene == 100) {
    if (changed || nowMs - lastBlink >= 500) {
      lastBlink = nowMs;
      blinkPhase = !blinkPhase;
      drawIdentify(blinkPhase);
    }
  } else if (scene == 101) {
    if (changed) drawOverlay();
  } else if (scene == SCENE_FRAME) {
    if (changed) drawFrame();
  } else if (scene == SCENE_MESSAGES || scene == SCENE_FLIGHTS_LIST ||
             scene == SCENE_CUSTOM) {
    if (changed || nowMs - lastAppDraw >= 1000) {
      lastAppDraw = nowMs;
      DmxAppFrame* frame = dmxAppFrame(sceneApp(scene));
      if (frame && frame->hasData) dmxRenderRows(matrix, brightness, *frame, nowMs);
      else drawClock();
    }
  } else {
    if (changed || nowMs - lastClock >= 250) {
      lastClock = nowMs;
      drawClock();
    }
  }
  lastShown = scene;
}

const char* resetReasonStr() {
  switch (esp_reset_reason()) {
    case ESP_RST_POWERON: return "power-on";
    case ESP_RST_SW: return "software";
    case ESP_RST_PANIC: return "crash";
    case ESP_RST_INT_WDT:
    case ESP_RST_TASK_WDT:
    case ESP_RST_WDT: return "watchdog";
    case ESP_RST_BROWNOUT: return "brownout";
    default: return "other";
  }
}

const char* sceneName() {
  uint32_t nowMs = millis();
  if (claimUntil && nowMs < claimUntil) return "pair";
  if (identifyUntil && nowMs < identifyUntil) return "identify";
  if (overlayUntil && nowMs < overlayUntil) return "text";
  if (baseScene == SCENE_FRAME) return "frame";
  if (lastShown == SCENE_MESSAGES) return "messages";
  if (lastShown == SCENE_FLIGHTS_LIST) return "flights_list";
  if (lastShown == SCENE_CUSTOM) return "custom";
  return "clock";
}

// ---------------------------------------------------------------- /api/v1
void handleHealth() {
  sendJson(200, String("{\"ok\":true,\"device\":\"") + deviceId +
                    "\",\"fw\":\"" FW_VERSION "\",\"mode\":\"" +
                    (setupMode ? "setup" : "run") + "\"}");
}

void handleInfo() {
  if (!authed()) { deny(); return; }
  const esp_partition_t* part = esp_ota_get_running_partition();
  char body[460];
  snprintf(body, sizeof body,
           "{\"device\":\"%s\",\"fw\":\"%s\",\"uptime_s\":%lu,"
           "\"heap_free\":%u,\"rssi_dbm\":%d,\"ip\":\"%s\",\"mdns\":\"%s.local\","
           "\"brightness\":%u,\"refresh_hz\":%lu,\"slot\":\"%s\",\"scene\":\"%s\","
           "\"reset_reason\":\"%s\"}",
           deviceId.c_str(), FW_VERSION, millis() / 1000UL,
           (unsigned)heap_caps_get_free_size(MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT),
           WiFi.RSSI(), WiFi.localIP().toString().c_str(), mdnsName.c_str(),
           brightness, (unsigned long)lastRefreshHz,
           part ? part->label : "?", sceneName(), resetReasonStr());
  sendJson(200, body);
}

void handleText() {
  if (!authed()) { deny(); return; }
  String text;
  if (!jsonGet(server.arg("plain"), "text", text)) {
    sendJson(400, "{\"error\":\"missing text\"}");
    return;
  }
  if (text.length() > 120) text = text.substring(0, 120);
  long secs = jsonInt(server.arg("plain"), "duration_s", 10);
  if (secs < 1) secs = 1;
  if (secs > 300) secs = 300;
  overlayText = text;
  overlayUntil = millis() + (uint32_t)secs * 1000;
  lastShown = -1;  // repaint even if an overlay is already showing (live boards)
  sendJson(200, "{\"ok\":true}");
}

void handleAppsGet() {
  if (!authed()) { deny(); return; }
  char body[620];
  snprintf(body, sizeof body,
           "{\"apps\":["
           "{\"id\":\"messages\",\"enabled\":%s,\"interval_s\":%u,\"refresh_s\":%u},"
           "{\"id\":\"flights_list\",\"enabled\":%s,\"interval_s\":%u,\"refresh_s\":%u},"
           "{\"id\":\"custom\",\"enabled\":%s,\"interval_s\":%u,\"refresh_s\":%lu}]}",
           dmxAppSlots[DMX_APP_MESSAGES].enabled ? "true" : "false",
           dmxAppDurationS[DMX_APP_MESSAGES], dmxMessages.rotationS,
           dmxAppSlots[DMX_APP_FLIGHTS_LIST].enabled ? "true" : "false",
           dmxAppDurationS[DMX_APP_FLIGHTS_LIST], flInterval,
           dmxAppSlots[DMX_APP_CUSTOM].enabled ? "true" : "false",
           dmxAppDurationS[DMX_APP_CUSTOM],
           (unsigned long)(dmxCustom.hasSource ? dmxCustom.intervalS : 0));
  sendJson(200, body);
}

void handleAppsPost() {
  if (!authed()) { deny(); return; }
  String body = server.arg("plain");
  DmxJsonSpan root, value;
  char id[24];
  if (!dmxJsonRoot(body.c_str(), body.length(), root) || root.type != '{' ||
      !dmxJsonObjectGet(root, "id", value) ||
      !dmxJsonCopyString(value, id, sizeof id)) {
    sendJson(400, "{\"error\":\"body needs a valid app id\"}");
    return;
  }
  int8_t app = dmxAppIndex(id);
  if (app < 0) {
    sendJson(404, "{\"error\":\"unknown app id\"}");
    return;
  }
  bool enabled = dmxAppSlots[app].enabled;
  long interval = dmxAppDurationS[app];
  bool hasEnabled = dmxJsonObjectGet(root, "enabled", value);
  if (hasEnabled && !dmxJsonToBool(value, enabled)) {
    sendJson(400, "{\"error\":\"enabled must be boolean\"}");
    return;
  }
  bool hasInterval = dmxJsonObjectGet(root, "interval_s", value);
  if (hasInterval && (!dmxJsonToLong(value, interval) || interval < 3 ||
                      interval > 300)) {
    sendJson(400, "{\"error\":\"interval_s must be 3..300\"}");
    return;
  }
  if (!hasEnabled && !hasInterval) {
    sendJson(400, "{\"error\":\"provide enabled or interval_s\"}");
    return;
  }
  if (hasEnabled) dmxSetAppEnabled(prefs, app, enabled);
  if (hasInterval && !dmxSetAppDuration(prefs, app, interval)) {
    sendJson(500, "{\"error\":\"could not store app interval\"}");
    return;
  }
  scheduledUntil = 0;
  lastShown = -1;
  handleAppsGet();
}

String appJsonEscape(const char* text) {
  String escaped;
  escaped.reserve(strlen(text) + 8);
  for (const char* p = text; *p; ++p) {
    if (*p == '\\' || *p == '"') { escaped += '\\'; escaped += *p; }
    else if (*p == '\n') escaped += "\\n";
    else if (*p == '\r') escaped += "\\r";
    else if (*p == '\t') escaped += "\\t";
    else escaped += *p;
  }
  return escaped;
}

void handleMessagesGet() {
  if (!authed()) { deny(); return; }
  String body = "{\"phrases\":[";
  body.reserve(700);
  for (uint8_t i = 0; i < dmxMessages.count; ++i) {
    if (i) body += ',';
    body += '"';
    body += appJsonEscape(dmxMessages.phrases[i]);
    body += '"';
  }
  body += "],\"rotation_s\":";
  body += dmxMessages.rotationS;
  body += '}';
  sendJson(200, body);
}

void handleMessagesPost() {
  if (!authed()) { deny(); return; }
  String body = server.arg("plain");
  DmxJsonSpan root, value;
  if (!dmxJsonRoot(body.c_str(), body.length(), root) || root.type != '{') {
    sendJson(400, "{\"error\":\"body must be a JSON object\"}");
    return;
  }
  char phrases[8][65];
  memcpy(phrases, dmxMessages.phrases, sizeof phrases);
  uint8_t count = dmxMessages.count;
  uint16_t rotation = dmxMessages.rotationS;
  bool changed = false;
  if (dmxJsonObjectGet(root, "phrases", value)) {
    if (value.type != '[' || dmxJsonArraySize(value, 9) > 8) {
      sendJson(400, "{\"error\":\"phrases must contain at most 8 strings\"}");
      return;
    }
    memset(phrases, 0, sizeof phrases);
    count = dmxJsonArraySize(value, 8);
    for (uint8_t i = 0; i < count; ++i) {
      DmxJsonSpan phrase;
      if (!dmxJsonArrayGet(value, i, phrase) ||
          !dmxJsonCopyString(phrase, phrases[i], sizeof phrases[i])) {
        sendJson(400, "{\"error\":\"each phrase must be a string <=64 chars\"}");
        return;
      }
    }
    changed = true;
  }
  if (dmxJsonObjectGet(root, "rotation_s", value)) {
    long next;
    if (!dmxJsonToLong(value, next) || next < 2 || next > 3600) {
      sendJson(400, "{\"error\":\"rotation_s must be 2..3600\"}");
      return;
    }
    rotation = next;
    changed = true;
  }
  if (!changed) {
    sendJson(400, "{\"error\":\"provide phrases or rotation_s\"}");
    return;
  }
  if (!dmxSaveMessages(prefs, phrases, count, rotation)) {
    sendJson(500, "{\"error\":\"could not store phrase pack\"}");
    return;
  }
  lastShown = -1;
  handleMessagesGet();
}

void handleCustomGet() {
  if (!authed()) { deny(); return; }
  sendJson(200, dmxCustom.json);
}

void handleCustomPost() {
  if (!authed()) { deny(); return; }
  String body = server.arg("plain");
  char error[112];
  if (!dmxInstallCustomLayout(prefs, body.c_str(), body.length(), true, error,
                              sizeof error)) {
    sendJson(400, String("{\"error\":\"") + jsonEscape(error) + "\"}");
    return;
  }
  lastShown = -1;
  handleCustomGet();
}

void handleAppShow(uint8_t app) {
  if (!authed()) { deny(); return; }
  manualAppScene = appScene(app);
  manualAppUntil = millis() + (uint32_t)dmxAppDurationS[app] * 1000UL;
  lastShown = -1;
  char body[120];
  snprintf(body, sizeof body,
           "{\"ok\":true,\"id\":\"%s\",\"showing\":\"%s\",\"duration_s\":%u}",
           DMX_APP_IDS[app], appHasData(app) ? DMX_APP_IDS[app] : "clock",
           dmxAppDurationS[app]);
  sendJson(200, body);
}

// Config for the Flights Overhead companion script — the device is the
// source of truth so the Console can edit it and any script host obeys.
void handleFlightsGet() {
  if (!authed()) { deny(); return; }
  sendJson(200, String("{\"url\":\"") + jsonEscape(flUrl) +
                    "\",\"interval_s\":" + flInterval + ",\"rows\":" + flRows +
                    ",\"format\":\"" + flFormat + "\",\"view\":\"" + flView +
                    "\"}");
}

void handleFlightsPost() {
  if (!authed()) { deny(); return; }
  String body = server.arg("plain"), s;
  if (jsonGet(body, "url", s) && s.startsWith("http") && s.length() < 128) {
    flUrl = s;
    prefs.putString("fl_url", flUrl);
  }
  long v = jsonInt(body, "interval_s", -1);
  if (v >= 1 && v <= 60) { flInterval = v; prefs.putUChar("fl_int", flInterval); }
  v = jsonInt(body, "rows", -1);
  if (v >= 1 && v <= 5) { flRows = v; prefs.putUChar("fl_n", flRows); }
  if (jsonGet(body, "format", s) && (s == "kts" || s == "alt")) {
    flFormat = s;
    prefs.putString("fl_fmt", flFormat);
  }
  if (jsonGet(body, "view", s) && (s == "list" || s == "radar")) {
    flView = s;
    prefs.putString("fl_view", flView);
  }
  handleFlightsGet();  // echo the applied config back
}

void handleFrame() {
  if (!authed()) { deny(); return; }
  String b64;
  if (!jsonGet(server.arg("plain"), "b64", b64)) {
    sendJson(400, "{\"error\":\"missing b64 (4096 bytes RGB565 LE)\"}");
    return;
  }
  static uint8_t raw[sizeof frameBuf];
  size_t olen = 0;
  int rc = mbedtls_base64_decode(raw, sizeof raw, &olen,
                                 (const unsigned char*)b64.c_str(), b64.length());
  if (rc != 0 || olen != sizeof frameBuf) {
    sendJson(400, "{\"error\":\"bad b64: need exactly 4096 bytes\"}");
    return;
  }
  memcpy(frameBuf, raw, sizeof frameBuf);
  baseScene = SCENE_FRAME;
  overlayUntil = 0;
  lastShown = -1;  // force redraw even if already showing a frame
  sendJson(200, "{\"ok\":true}");
}

void handleClear() {
  if (!authed()) { deny(); return; }
  baseScene = SCENE_CLOCK;
  overlayUntil = 0;
  manualAppUntil = 0;
  manualAppScene = -1;
  scheduledSlot = 0;
  scheduledScene = SCENE_CLOCK;
  scheduledUntil = millis() + 10000UL;
  lastShown = -1;
  sendJson(200, "{\"ok\":true}");
}

void handleBrightness() {
  if (!authed()) { deny(); return; }
  long v = jsonInt(server.arg("plain"), "value", -1);
  if (v < 10 || v > MAX_BRIGHTNESS) {
    sendJson(400, "{\"error\":\"value must be 10..150 (USB power budget)\"}");
    return;
  }
  brightness = (uint8_t)v;
  prefs.putUChar("bright", brightness);
  lastShown = -1;  // redraw current scene at the new level
  sendJson(200, "{\"ok\":true}");
}

void handleIdentify() {
  if (!authed()) { deny(); return; }
  identifyUntil = millis() + 6000;
  sendJson(200, "{\"ok\":true}");
}

void handleRotate() {
  if (!authed()) { deny(); return; }
  apiToken = makeToken();
  prefs.putString("token", apiToken);
  sendJson(200, String("{\"token\":\"") + apiToken + "\"}");
}

// Unauthenticated by design: anyone on the LAN may ASK to pair, but only
// someone who can read the panel can FINISH. One active code at a time;
// re-requesting extends the same code instead of churning it.
void handleClaimStart() {
  uint32_t nowMs = millis();
  if (!claimCode.length() || nowMs >= claimUntil) {
    char c[7];
    snprintf(c, sizeof c, "%06lu", (unsigned long)(esp_random() % 1000000UL));
    claimCode = c;
    claimAttempts = 0;
    Serial.println("claim: pair code now showing on the panel (5 min)");
  }
  claimUntil = nowMs + 300000UL;
  sendJson(200, "{\"ok\":true,\"expires_s\":300}");
}

void handleClaimFinish() {
  if (!claimCode.length() || millis() >= claimUntil) {
    sendJson(410, "{\"error\":\"no active pair code - tap Pair again\"}");
    return;
  }
  String code;
  jsonGet(server.arg("plain"), "code", code);
  String digits;
  for (unsigned i = 0; i < code.length(); i++)
    if (isDigit(code[i])) digits += code[i];
  if (digits == claimCode) {
    claimUntil = 0;
    claimCode = "";
    overlayText = "paired!";
    overlayUntil = millis() + 3000;
    sendJson(200, String("{\"token\":\"") + apiToken + "\"}");
    return;
  }
  if (++claimAttempts >= 5) {
    claimUntil = 0;
    claimCode = "";
    sendJson(429, "{\"error\":\"too many tries - tap Pair for a fresh code\"}");
    return;
  }
  char body[64];
  snprintf(body, sizeof body,
           "{\"error\":\"wrong code\",\"attempts_left\":%d}", 5 - claimAttempts);
  sendJson(403, body);
}

// True if the URL serves dump1090/readsb-style aircraft.json (checks the
// first 256 bytes only — no need to pull the whole file).
bool probeAircraftJson(const String& url) {
  HTTPClient http;
  http.setConnectTimeout(700);
  http.setTimeout(900);
  if (!http.begin(url)) return false;
  bool ok = false;
  if (http.GET() == 200) {
    WiFiClient* s = http.getStreamPtr();
    char buf[257];
    int n = 0;
    uint32_t t0 = millis();
    while (n < 256 && millis() - t0 < 800) {
      int c = s->read();
      if (c < 0) { delay(5); continue; }
      buf[n++] = (char)c;
    }
    buf[n] = 0;
    ok = strstr(buf, "\"aircraft\"") != nullptr;
  }
  http.end();
  return ok;
}

// The device hunts for the owner's receiver itself (mDNS names the common
// images announce, then the standard web paths), so the URL never has to
// exist anywhere but here.
void handleFlightsScan() {
  if (!authed()) { deny(); return; }
  // Generic receiver-image hostnames only. Third-party flight-data service
  // names are banned by the clean-room gate (ADR-0023) even as hostnames;
  // owners of other images type their URL in instead.
  const char* hosts[] = {"piaware", "ultrafeeder", "adsb", "raspberrypi"};
  const char* paths[] = {":8080/data/aircraft.json",
                         "/skyaware/data/aircraft.json",
                         "/tar1090/data/aircraft.json",
                         ":8080/tar1090/data/aircraft.json"};
  for (auto h : hosts) {
    IPAddress ip = MDNS.queryHost(h, 400);
    if ((uint32_t)ip == 0) continue;
    for (auto p : paths) {
      String url = String("http://") + ip.toString() + p;
      if (probeAircraftJson(url)) {
        sendJson(200, String("{\"found\":\"") + url + "\"}");
        return;
      }
    }
  }
  sendJson(200, "{\"found\":null}");
}

void handleSettingsGet() {
  if (!authed()) { deny(); return; }
  sendJson(200, String("{\"tz\":\"") + jsonEscape(tzPosix) +
                    "\",\"brightness\":" + brightness + "}");
}

void handleSettingsPost() {
  if (!authed()) { deny(); return; }
  String tz;
  if (jsonGet(server.arg("plain"), "tz", tz) && tz.length() && tz.length() < 64) {
    tzPosix = tz;
    prefs.putString("tz", tzPosix);
    configTzTime(tzPosix.c_str(), "pool.ntp.org", "time.nist.gov");
  }
  sendJson(200, "{\"ok\":true}");
}

void handleReboot() {
  if (!authed()) { deny(); return; }
  sendJson(200, "{\"ok\":true,\"rebooting\":true}");
  delay(300);
  ESP.restart();
}

void handleWifiReset() {
  if (!authed()) { deny(); return; }
  prefs.remove("ssid");
  prefs.remove("pass");
  sendJson(200, "{\"ok\":true,\"rebooting\":\"into setup hotspot\"}");
  delay(300);
  ESP.restart();
}

void handleFactoryReset() {
  if (!authed()) { deny(); return; }
  prefs.clear();  // wifi, token, brightness, tz — back to out-of-box
  sendJson(200, "{\"ok\":true,\"rebooting\":\"factory fresh\"}");
  delay(300);
  ESP.restart();
}

// ---------------------------------------------------------------- OTA
void handleOtaUpload() {
  HTTPUpload& up = server.upload();
  if (up.status == UPLOAD_FILE_START) {
    otaAuthed = authed();
    otaError = "";
    otaShownKb = 0;
    if (!otaAuthed) return;
    panelLines("UPDATING", "0 KB", "keep power on");
    if (!Update.begin(UPDATE_SIZE_UNKNOWN)) otaError = Update.errorString();
  } else if (up.status == UPLOAD_FILE_WRITE) {
    if (!otaAuthed || otaError.length()) return;
    if (Update.write(up.buf, up.currentSize) != up.currentSize) {
      otaError = Update.errorString();
      return;
    }
    if (up.totalSize / 1024 >= otaShownKb + 128) {
      otaShownKb = up.totalSize / 1024;
      char kb[16];
      snprintf(kb, sizeof kb, "%lu KB", (unsigned long)otaShownKb);
      panelLines("UPDATING", kb, "keep power on");
    }
  } else if (up.status == UPLOAD_FILE_END) {
    if (!otaAuthed || otaError.length()) return;
    if (!Update.end(true)) otaError = Update.errorString();
  } else if (up.status == UPLOAD_FILE_ABORTED) {
    Update.abort();
    otaError = "upload aborted";
  }
}

void handleOtaFinal() {
  if (!otaAuthed) { deny(); return; }
  if (otaError.length()) {
    sendJson(500, String("{\"error\":\"") + jsonEscape(otaError) + "\"}");
    lastShown = -1;  // repaint the normal scene over "UPDATING"
    return;
  }
  sendJson(200, "{\"ok\":true,\"rebooting\":true}");
  panelLines("UPDATE OK", "rebooting...");
  delay(400);
  ESP.restart();
}

// ---------------------------------------------------------------- setup portal
void handleSetupPage() { server.send_P(200, "text/html", SETUP_HTML); }

void handleScan() {
  if (server.hasArg("rescan")) {
    WiFi.scanDelete();
    WiFi.scanNetworks(true);
    sendJson(200, "{\"scanning\":true}");
    return;
  }
  int n = WiFi.scanComplete();
  if (n == WIFI_SCAN_FAILED) {
    WiFi.scanNetworks(true);
    sendJson(200, "{\"scanning\":true}");
    return;
  }
  if (n == WIFI_SCAN_RUNNING) {
    sendJson(200, "{\"scanning\":true}");
    return;
  }
  String out = "{\"networks\":[";
  for (int i = 0; i < n && i < 24; i++) {
    if (i) out += ',';
    out += "{\"ssid\":\"" + jsonEscape(WiFi.SSID(i)) +
           "\",\"rssi\":" + WiFi.RSSI(i) + ",\"open\":" +
           (WiFi.encryptionType(i) == WIFI_AUTH_OPEN ? "true" : "false") + "}";
  }
  out += "]}";
  sendJson(200, out);
}

void handleJoin() {
  String body = server.arg("plain");
  String ssid;
  if (!jsonGet(body, "ssid", ssid) || !ssid.length()) {
    sendJson(400, "{\"error\":\"ssid required\"}");
    return;
  }
  pendSsid = ssid;
  pendPass = "";
  jsonGet(body, "pass", pendPass);
  WiFi.scanDelete();
  joinState = JOIN_TRYING;
  joinIsBackground = false;
  joinStart = millis();
  WiFi.begin(pendSsid.c_str(), pendPass.c_str());
  sendJson(200, "{\"ok\":true}");
}

void stepJoinMachine() {
  if (joinState != JOIN_TRYING) return;
  if (WiFi.status() == WL_CONNECTED) {
    joinState = JOIN_OK;
    prefs.putString("ssid", pendSsid);
    prefs.putString("pass", pendPass);
    Serial.println("wifi: joined; credentials saved to NVS (never logged)");
    if (joinIsBackground) { delay(200); ESP.restart(); }
    panelLines("wifi ok!", "finish setup", "on your phone");
  } else if (millis() - joinStart > 25000) {
    joinState = JOIN_FAIL;
    WiFi.disconnect();
    if (joinIsBackground) {
      joinState = JOIN_IDLE;
      nextBgRetry = millis() + 45000;
    }
  }
}

void handleJoinStatus() {
  stepJoinMachine();
  if (joinState == JOIN_OK) {
    // Physical presence on the hotspot is the v0 claim ceremony: the token
    // is revealed here, once, on the setup network only.
    sendJson(200, String("{\"state\":\"joined\",\"ip\":\"") +
                      WiFi.localIP().toString() + "\",\"mdns\":\"" + mdnsName +
                      ".local\",\"token\":\"" + apiToken + "\"}");
  } else if (joinState == JOIN_TRYING) {
    sendJson(200, "{\"state\":\"joining\"}");
  } else if (joinState == JOIN_FAIL) {
    sendJson(200, "{\"state\":\"failed\"}");
  } else {
    sendJson(200, "{\"state\":\"idle\"}");
  }
}

void handleSetupDone() {
  sendJson(200, "{\"ok\":true,\"rebooting\":true}");
  delay(400);
  ESP.restart();
}

void handleCaptive() {
  // Any unknown URL (including OS captive-portal probes) lands on the setup
  // page, which is what makes phones auto-open it.
  server.sendHeader("Location", "http://192.168.4.1/", true);
  server.send(302, "text/plain", "");
}

// ---------------------------------------------------------------- modes
void startSetupMode() {
  setupMode = true;
  WiFi.mode(WIFI_AP_STA);  // AP for the portal, STA so we can scan + test-join
  WiFi.softAP(apName.c_str());
  dns.start(53, "*", IPAddress(192, 168, 4, 1));
  WiFi.scanNetworks(true);
  server.on("/", HTTP_GET, handleSetupPage);
  server.on("/setup/scan", HTTP_GET, handleScan);
  server.on("/setup/join", HTTP_POST, handleJoin);
  server.on("/setup/status", HTTP_GET, handleJoinStatus);
  server.on("/setup/done", HTTP_POST, handleSetupDone);
  server.on("/api/v1/health", HTTP_GET, handleHealth);
  server.onNotFound(handleCaptive);
  server.begin();
  Serial.printf("setup: join \"%s\" then any page opens http://192.168.4.1\n",
                apName.c_str());
  panelLines("SETUP: join", apName.c_str(), "portal opens", "by itself");
  // If we fell back here with stored creds (router was down?), keep retrying
  // in the background so a power blip never strands the device in setup.
  if (prefs.getString("ssid", "").length()) nextBgRetry = millis() + 45000;
}

void startConsole() {
  const char* headers[] = {"Authorization", "Content-Length"};
  server.collectHeaders(headers, 2);
  server.on("/", HTTP_GET, []() {
    server.sendHeader("Content-Encoding", "gzip");
    server.send_P(200, "text/html", (const char*)CONSOLE_HTML_GZ, CONSOLE_HTML_GZ_LEN);
  });
  server.on("/api/v1/health", HTTP_GET, handleHealth);
  server.on("/api/v1/info", HTTP_GET, handleInfo);
  server.on("/api/v1/display/text", HTTP_POST, handleText);
  server.on("/api/v1/display/frame", HTTP_POST, handleFrame);
  server.on("/api/v1/display/clear", HTTP_POST, handleClear);
  server.on("/api/v1/display/brightness", HTTP_POST, handleBrightness);
  server.on("/api/v1/identify", HTTP_POST, handleIdentify);
  server.on("/api/v1/claim/start", HTTP_POST, handleClaimStart);
  server.on("/api/v1/claim/finish", HTTP_POST, handleClaimFinish);
  server.on("/api/v1/token/rotate", HTTP_POST, handleRotate);
  server.on("/api/v1/settings", HTTP_GET, handleSettingsGet);
  server.on("/api/v1/settings", HTTP_POST, handleSettingsPost);
  server.on("/api/v1/apps", HTTP_GET, handleAppsGet);
  server.on("/api/v1/apps", HTTP_POST, handleAppsPost);
  server.on("/api/v1/apps/messages", HTTP_GET, handleMessagesGet);
  server.on("/api/v1/apps/messages", HTTP_POST, handleMessagesPost);
  server.on("/api/v1/apps/messages/show", HTTP_POST,
            []() { handleAppShow(DMX_APP_MESSAGES); });
  server.on("/api/v1/apps/flights_list/show", HTTP_POST,
            []() { handleAppShow(DMX_APP_FLIGHTS_LIST); });
  server.on("/api/v1/apps/custom", HTTP_GET, handleCustomGet);
  server.on("/api/v1/apps/custom", HTTP_POST, handleCustomPost);
  server.on("/api/v1/apps/custom/show", HTTP_POST,
            []() { handleAppShow(DMX_APP_CUSTOM); });
  server.on("/api/v1/apps/flights", HTTP_GET, handleFlightsGet);
  server.on("/api/v1/apps/flights", HTTP_POST, handleFlightsPost);
  server.on("/api/v1/apps/flights/scan", HTTP_POST, handleFlightsScan);
  server.on("/api/v1/reboot", HTTP_POST, handleReboot);
  server.on("/api/v1/wifi/reset", HTTP_POST, handleWifiReset);
  server.on("/api/v1/factory/reset", HTTP_POST, handleFactoryReset);
  server.on("/update", HTTP_POST, handleOtaFinal, handleOtaUpload);
  server.begin();
}

void startStation(const String& ssid, const String& pass) {
  WiFi.mode(WIFI_STA);
  WiFi.setHostname(mdnsName.c_str());
  WiFi.begin(ssid.c_str(), pass.c_str());
  panelLines("joining", ssid.c_str());
  Serial.println("wifi: joining stored network (ssid in NVS, not logged)");
  uint32_t t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 25000) delay(250);
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("wifi: join failed; opening setup hotspot (will retry)");
    startSetupMode();
    return;
  }
  // We booted, joined the network, and can serve — this image is good.
  // If a future OTA image can't get this far, the bootloader's other slot
  // plus this call are what "never brick" means in practice.
  esp_ota_mark_app_valid_cancel_rollback();
  configTzTime(tzPosix.c_str(), "pool.ntp.org", "time.nist.gov");
  MDNS.begin(mdnsName.c_str());
  MDNS.addService("http", "tcp", 80);
  startConsole();
  Serial.printf("wifi: connected ip=%s console=http://%s.local/ rssi=%d\n",
                WiFi.localIP().toString().c_str(), mdnsName.c_str(), WiFi.RSSI());
  Serial.printf("api: token=%s (also shown during setup; rotate in Console)\n",
                apiToken.c_str());
}

// ---------------------------------------------------------------- boot
void setup() {
  Serial.begin(115200);
  delay(1500);
  Serial.println("=== Devmatrix DK-01 fw " FW_VERSION " ===");

  uint64_t mac = ESP.getEfuseMac();
  char suffix[5];
  snprintf(suffix, sizeof suffix, "%02X%02X", (uint8_t)(mac >> 32),
           (uint8_t)(mac >> 40));
  deviceId = String("DMX-") + suffix;
  apName = String("DEVMATRIX-") + suffix;
  mdnsName = String("dmx-") + suffix;
  mdnsName.toLowerCase();

  ProtomatterStatus st = matrix.begin();
  Serial.printf("protomatter.begin=%d\n", (int)st);
  if (st != PROTOMATTER_OK) {
    for (;;) delay(1000);
  }

  Serial.printf("boot: reset_reason=%s\n", resetReasonStr());

  prefs.begin("dk01", false);
  brightness = prefs.getUChar("bright", 110);
  if (brightness > MAX_BRIGHTNESS) brightness = MAX_BRIGHTNESS;
  tzPosix = prefs.getString("tz", tzPosix);
  flUrl = prefs.getString("fl_url", flUrl);
  flInterval = prefs.getUChar("fl_int", flInterval);
  flRows = prefs.getUChar("fl_n", flRows);
  flFormat = prefs.getString("fl_fmt", flFormat);
  flView = prefs.getString("fl_view", flView);
  dmxAppsBegin(prefs, flInterval);
  apiToken = prefs.getString("token", "");
  if (!apiToken.length()) {
    apiToken = makeToken();
    prefs.putString("token", apiToken);
  }

  String ssid = prefs.getString("ssid", "");
  if (!ssid.length()) startSetupMode();
  else startStation(ssid, prefs.getString("pass", ""));
}

void loop() {
  if (setupMode) dns.processNextRequest();
  server.handleClient();
  stepJoinMachine();

  // Background rejoin: stored creds exist but we're stuck in setup mode.
  if (setupMode && joinState == JOIN_IDLE && nextBgRetry &&
      millis() > nextBgRetry) {
    pendSsid = prefs.getString("ssid", "");
    pendPass = prefs.getString("pass", "");
    if (pendSsid.length()) {
      joinState = JOIN_TRYING;
      joinIsBackground = true;
      joinStart = millis();
      WiFi.begin(pendSsid.c_str(), pendPass.c_str());
    }
    nextBgRetry = millis() + 60000;
  }

  if (!setupMode) {
    dmxAppsTick(flUrl.c_str(), flInterval, flRows, flFormat.c_str());
    renderTick();
  }

  static uint32_t lastStat = 0;
  uint32_t nowMs = millis();
  if (nowMs - lastStat >= 10000) {
    lastStat = nowMs;
    // getFrameCount() returns frames since its last call, so /10s = Hz.
    lastRefreshHz = matrix.getFrameCount() / 10;
    Serial.printf("refresh_hz=%lu heap_free=%u rssi=%d ip=%s token=%s\n",
                  (unsigned long)lastRefreshHz,
                  (unsigned)heap_caps_get_free_size(MALLOC_CAP_INTERNAL |
                                                    MALLOC_CAP_8BIT),
                  WiFi.RSSI(), WiFi.localIP().toString().c_str(),
                  apiToken.c_str());
  }
  delay(4);
}
