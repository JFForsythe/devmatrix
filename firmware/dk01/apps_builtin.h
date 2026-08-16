// SPDX-License-Identifier: GPL-3.0-or-later
#pragma once

#include <Preferences.h>
#include <esp_system.h>
#include "apps_engine.h"

enum DmxAppIndex : uint8_t {
  DMX_APP_MESSAGES = 0,
  DMX_APP_FLIGHTS_LIST = 1,
  DMX_APP_CUSTOM = 2,
  DMX_APP_COUNT = 3,
};

static const char* const DMX_APP_IDS[DMX_APP_COUNT] = {
  "messages", "flights_list", "custom"
};
static const char* const DMX_APP_ENABLE_KEYS[DMX_APP_COUNT] = {
  "app_msg_en", "app_fl_en", "app_cu_en"
};
static const char* const DMX_APP_DURATION_KEYS[DMX_APP_COUNT] = {
  "app_msg_d", "app_fl_d", "app_cu_d"
};

static DmxAppSchedulerSlot dmxAppSlots[DMX_APP_COUNT] = {
  {true, 30000, 0}, {false, 1000, 0}, {false, 60000, 0}
};
static uint16_t dmxAppDurationS[DMX_APP_COUNT] = {10, 10, 10};
// Fetch/render diagnostics per app. Messages never fetches; its entry says so.
static DmxFetchDiag dmxAppDiag[DMX_APP_COUNT];

struct DmxMessagesState {
  char phrases[8][65];
  uint8_t count;
  uint16_t rotationS;
  int8_t current;
  DmxAppFrame frame;
};

struct DmxFlightsState {
  DmxAppFrame frame;
};

struct DmxCustomRowSpec {
  uint8_t y;
  uint8_t color[3];
  bool bound;
  char text[65];
  char bind[65];
  char prefix[17];
  char suffix[17];
  uint8_t maxChars;
};

struct DmxCustomState {
  char json[2049];
  bool hasSource;
  char url[193];
  uint32_t intervalS;
  uint32_t staleAfterS;
  DmxCustomRowSpec rows[DMX_APP_MAX_ROWS];
  uint8_t rowCount;
  DmxAppFrame frame;
};

static DmxMessagesState dmxMessages;
static DmxFlightsState dmxFlights;
static DmxCustomState dmxCustom;
static DmxCustomState dmxCustomCandidate;
static char dmxCustomLoadBuffer[2049];

static void dmxSetError(char* error, size_t cap, const char* message) {
  if (!error || cap == 0) return;
  snprintf(error, cap, "%s", message);
}

static void dmxCopyRow(DmxAppFrame& frame, uint8_t index, uint8_t y,
                       const uint8_t color[3], const char* text) {
  if (index >= DMX_APP_MAX_ROWS) return;
  frame.rows[index].y = y;
  memcpy(frame.rows[index].color, color, 3);
  snprintf(frame.rows[index].text, sizeof frame.rows[index].text, "%.16s",
           text ? text : "");
}

static void dmxBuildMessageFrame(uint32_t nowMs) {
  dmxClearFrame(dmxMessages.frame);
  if (dmxMessages.current < 0 || dmxMessages.current >= dmxMessages.count)
    return;
  const char* phrase = dmxMessages.phrases[dmxMessages.current];
  const uint8_t colors[][3] = {
    {255, 178, 36}, {40, 210, 230}, {235, 235, 235},
    {80, 230, 110}, {220, 100, 255}
  };
  char line[17];
  uint8_t used = 0, chars = 0;
  for (const char* p = phrase; used < DMX_APP_MAX_ROWS; ++p) {
    char ch = *p;
    if (ch && ch != '\n') line[chars++] = ch;
    if (!ch || ch == '\n' || chars == 16) {
      line[chars] = 0;
      if (chars) {
        dmxCopyRow(dmxMessages.frame, used, DMX_APP_BASELINES[used],
                   colors[used], line);
        ++used;
      }
      chars = 0;
    }
    if (!ch) break;
  }
  dmxMessages.frame.rowCount = used;
  dmxMessages.frame.hasData = used > 0;
  dmxMessages.frame.hasRefresh = true;
  dmxMessages.frame.lastRefreshMs = nowMs;
}

static void dmxSelectMessage(uint32_t nowMs) {
  if (!dmxMessages.count) {
    dmxClearFrame(dmxMessages.frame);
    return;
  }
  uint8_t next = esp_random() % dmxMessages.count;
  if (dmxMessages.count > 1 && next == dmxMessages.current)
    next = (next + 1 + (esp_random() % (dmxMessages.count - 1))) %
           dmxMessages.count;
  dmxMessages.current = next;
  dmxBuildMessageFrame(nowMs);
}

static void dmxLoadMessages(Preferences& prefs) {
  memset(&dmxMessages, 0, sizeof dmxMessages);
  dmxMessages.current = -1;
  dmxMessages.rotationS = prefs.getUShort("msg_rot", 30);
  if (dmxMessages.rotationS < 2 || dmxMessages.rotationS > 3600)
    dmxMessages.rotationS = 30;
  uint8_t count = prefs.getUChar("msg_count", 0);
  size_t stored = prefs.getBytesLength("msg_pack");
  if (count > 0 && count <= 8 && stored == sizeof dmxMessages.phrases &&
      prefs.getBytes("msg_pack", dmxMessages.phrases,
                     sizeof dmxMessages.phrases) == stored) {
    dmxMessages.count = count;
    for (uint8_t i = 0; i < count; ++i) dmxMessages.phrases[i][64] = 0;
  } else {
    const char* defaults[] = {
      "MAKE SOMETHING", "SHIP SMALL\nLEARN FAST", "LOCAL FIRST",
      "PIXELS WANT\nA PURPOSE"
    };
    dmxMessages.count = 4;
    for (uint8_t i = 0; i < dmxMessages.count; ++i)
      snprintf(dmxMessages.phrases[i], sizeof dmxMessages.phrases[i], "%s",
               defaults[i]);
  }
  dmxAppSlots[DMX_APP_MESSAGES].refreshIntervalMs =
      (uint32_t)dmxMessages.rotationS * 1000UL;
  dmxSelectMessage(millis());
}

static bool dmxSaveMessages(Preferences& prefs, const char phrases[8][65],
                            uint8_t count, uint16_t rotationS) {
  memcpy(dmxMessages.phrases, phrases, sizeof dmxMessages.phrases);
  dmxMessages.count = count;
  dmxMessages.rotationS = rotationS;
  dmxMessages.current = -1;
  dmxAppSlots[DMX_APP_MESSAGES].refreshIntervalMs =
      (uint32_t)rotationS * 1000UL;
  dmxAppSlots[DMX_APP_MESSAGES].nextRunMs = 0;
  bool ok = prefs.putBytes("msg_pack", dmxMessages.phrases,
                           sizeof dmxMessages.phrases) ==
                sizeof dmxMessages.phrases;
  ok = prefs.putUChar("msg_count", count) == sizeof(uint8_t) && ok;
  ok = prefs.putUShort("msg_rot", rotationS) == sizeof(uint16_t) && ok;
  dmxSelectMessage(millis());
  return ok;
}

static bool dmxTrimCallsign(const DmxJsonSpan& aircraft, char out[9]) {
  DmxJsonSpan flight;
  char raw[24];
  if (!dmxJsonObjectGet(aircraft, "flight", flight) ||
      !dmxJsonCopyString(flight, raw, sizeof raw)) return false;
  char* start = raw;
  while (*start && isspace((unsigned char)*start)) ++start;
  char* end = start + strlen(start);
  while (end > start && isspace((unsigned char)end[-1])) --end;
  *end = 0;
  if (!*start) return false;
  snprintf(out, 9, "%.8s", start);
  return true;
}

static bool dmxFlightAltitude(const DmxJsonSpan& aircraft, long& altitude) {
  DmxJsonSpan value;
  return dmxJsonObjectGet(aircraft, "alt_baro", value) &&
         dmxJsonToLong(value, altitude);
}

static bool dmxFlightFresh(const DmxJsonSpan& aircraft) {
  DmxJsonSpan seen;
  double seconds;
  return !dmxJsonObjectGet(aircraft, "seen", seen) ||
         (dmxJsonToDouble(seen, seconds) && seconds < 30.0);
}

static bool dmxObjectCoordinate(const DmxJsonSpan& object, const char* key,
                                double& value) {
  DmxJsonSpan span;
  return dmxJsonObjectGet(object, key, span) && dmxJsonToDouble(span, value);
}

static bool dmxReceiverPosition(const DmxJsonSpan& root, double& lat,
                                double& lon) {
  const char* latKeys[] = {"receiver_lat", "site_lat", "lat"};
  const char* lonKeys[] = {"receiver_lon", "site_lon", "lon"};
  for (uint8_t i = 0; i < 3; ++i)
    if (dmxObjectCoordinate(root, latKeys[i], lat) &&
        dmxObjectCoordinate(root, lonKeys[i], lon)) return true;
  return false;
}

static double dmxMiles(double lat1, double lon1, double lat2, double lon2) {
  const double radians = 0.017453292519943295;
  double dLat = (lat2 - lat1) * radians;
  double dLon = (lon2 - lon1) * radians;
  double a = sin(dLat / 2) * sin(dLat / 2) +
             cos(lat1 * radians) * cos(lat2 * radians) *
             sin(dLon / 2) * sin(dLon / 2);
  return 7917.6 * asin(sqrt(a));
}

static bool dmxBuildFlightLine(const DmxJsonSpan& aircraft,
                               const char* format, char out[17]) {
  char callsign[9];
  long altitude;
  if (!dmxTrimCallsign(aircraft, callsign) ||
      !dmxFlightAltitude(aircraft, altitude) || !dmxFlightFresh(aircraft))
    return false;
  if (!strcmp(format, "alt")) {
    if (altitude >= 10000)
      snprintf(out, 17, "%.7s - %ldk", callsign, lround(altitude / 1000.0));
    else
      snprintf(out, 17, "%.7s - %ldft", callsign, altitude);
  } else {
    DmxJsonSpan speedSpan;
    double speed;
    if (dmxJsonObjectGet(aircraft, "gs", speedSpan) &&
        dmxJsonToDouble(speedSpan, speed))
      snprintf(out, 17, "%.7s - %ldkts", callsign, lround(speed));
    else
      snprintf(out, 17, "%.7s - ?kts", callsign);
  }
  return true;
}

static bool dmxBuildFlightsFrame(const char* format, uint8_t wantedRows,
                                 uint32_t nowMs, uint32_t staleAfterS) {
  DmxJsonSpan root, aircraftArray;
  size_t length = strlen(dmxAppFetchBuffer);
  if (!dmxJsonRoot(dmxAppFetchBuffer, length, root) ||
      !dmxJsonObjectGet(root, "aircraft", aircraftArray) ||
      aircraftArray.type != '[') return false;
  double homeLat = 0, homeLon = 0;
  bool hasHome = dmxReceiverPosition(root, homeLat, homeLon);
  if (wantedRows > DMX_APP_MAX_ROWS) wantedRows = DMX_APP_MAX_ROWS;
  // One pass over the array, keeping the nearest `wantedRows` in a tiny
  // insertion-sorted list: O(count·rows). The previous per-row
  // dmxJsonArrayGet rescan was O(rows·count²) — noticeable render stalls
  // on a real 35 KB busy-airspace aircraft.json in loop().
  double slotDist[DMX_APP_MAX_ROWS];
  char slotLine[DMX_APP_MAX_ROWS][17];
  uint8_t filled = 0;
  const char* cursor = nullptr;
  DmxJsonSpan aircraft;
  size_t scanned = 0;
  while (scanned < 256 && dmxJsonArrayNext(aircraftArray, cursor, aircraft)) {
    ++scanned;
    if (aircraft.type != '{') continue;
    char line[17];
    if (!dmxBuildFlightLine(aircraft, format, line)) continue;
    double distance = (double)scanned;  // feed order when no home position
    if (hasHome) {
      double lat, lon;
      if (!dmxObjectCoordinate(aircraft, "lat", lat) ||
          !dmxObjectCoordinate(aircraft, "lon", lon)) continue;
      distance = dmxMiles(homeLat, homeLon, lat, lon);
    }
    if (filled == wantedRows && distance >= slotDist[filled - 1]) continue;
    uint8_t at = filled < wantedRows ? filled : (uint8_t)(wantedRows - 1);
    while (at > 0 && slotDist[at - 1] > distance) {
      slotDist[at] = slotDist[at - 1];
      memcpy(slotLine[at], slotLine[at - 1], sizeof slotLine[at]);
      --at;
    }
    slotDist[at] = distance;
    snprintf(slotLine[at], sizeof slotLine[at], "%s", line);
    if (filled < wantedRows) ++filled;
  }
  DmxAppFrame next;
  dmxClearFrame(next);
  const uint8_t colors[][3] = {
    {235, 235, 235}, {40, 210, 230}, {255, 178, 36},
    {80, 230, 110}, {220, 100, 255}
  };
  for (uint8_t row = 0; row < filled; ++row) {
    dmxCopyRow(next, row, DMX_APP_BASELINES[row], colors[row], slotLine[row]);
    next.rowCount = row + 1;
  }
  if (!next.rowCount) {
    dmxClearFrame(dmxFlights.frame);
    return false;
  }
  next.hasData = true;
  next.hasRefresh = true;
  next.lastRefreshMs = nowMs;
  next.staleAfterS = staleAfterS;
  dmxFlights.frame = next;
  return true;
}

static bool dmxCustomString(const DmxJsonSpan& object, const char* key,
                            char* out, size_t cap, const char* fallback) {
  DmxJsonSpan value;
  if (!dmxJsonObjectGet(object, key, value)) {
    snprintf(out, cap, "%s", fallback);
    return true;
  }
  return dmxJsonCopyString(value, out, cap);
}

static bool dmxParseCustomLayout(const char* json, size_t length,
                                 DmxCustomState& parsed, char* error,
                                 size_t errorCap) {
  memset(&parsed, 0, sizeof parsed);
  if (!json || length == 0 || length > 2048) {
    dmxSetError(error, errorCap, "layout must be 1..2048 bytes");
    return false;
  }
  DmxJsonSpan root, value;
  long number;
  if (!dmxJsonRoot(json, length, root) || root.type != '{') {
    dmxSetError(error, errorCap, "layout must be one JSON object");
    return false;
  }
  if (!dmxJsonObjectGet(root, "v", value) || !dmxJsonToLong(value, number) ||
      number != 1) {
    dmxSetError(error, errorCap, "layout v must equal 1");
    return false;
  }
  DmxJsonSpan source;
  if (!dmxJsonObjectGet(root, "source", source)) {
    dmxSetError(error, errorCap, "layout source is required");
    return false;
  }
  if (source.type == '0') {
    parsed.hasSource = false;
  } else if (source.type == '{') {
    parsed.hasSource = true;
    if (!dmxCustomString(source, "url", parsed.url, sizeof parsed.url, "") ||
        (strncmp(parsed.url, "http://", 7) &&
         strncmp(parsed.url, "https://", 8))) {
      dmxSetError(error, errorCap, "source url must be HTTP or HTTPS");
      return false;
    }
    if (!dmxJsonObjectGet(source, "interval_s", value) ||
        !dmxJsonToLong(value, number) || number < 1 || number > 86400) {
      dmxSetError(error, errorCap, "source interval_s must be 1..86400");
      return false;
    }
    parsed.intervalS = number;
    if (!dmxJsonObjectGet(source, "stale_after_s", value) ||
        !dmxJsonToLong(value, number) || number < 1 || number > 604800) {
      dmxSetError(error, errorCap, "source stale_after_s must be 1..604800");
      return false;
    }
    parsed.staleAfterS = number;
  } else {
    dmxSetError(error, errorCap, "source must be an object or null");
    return false;
  }
  DmxJsonSpan rows;
  if (!dmxJsonObjectGet(root, "rows", rows) || rows.type != '[') {
    dmxSetError(error, errorCap, "layout rows must be an array");
    return false;
  }
  size_t rowCount = dmxJsonArraySize(rows, DMX_APP_MAX_ROWS + 1);
  if (rowCount > DMX_APP_MAX_ROWS) {
    dmxSetError(error, errorCap, "layout supports at most 5 rows");
    return false;
  }
  parsed.rowCount = rowCount;
  for (uint8_t i = 0; i < parsed.rowCount; ++i) {
    DmxJsonSpan row;
    if (!dmxJsonArrayGet(rows, i, row) || row.type != '{') {
      dmxSetError(error, errorCap, "each row must be an object");
      return false;
    }
    if (!dmxJsonObjectGet(row, "y", value) || !dmxJsonToLong(value, number) ||
        !dmxAllowedBaseline(number)) {
      dmxSetError(error, errorCap, "row y must be 5, 11, 17, 23, or 29");
      return false;
    }
    parsed.rows[i].y = number;
    DmxJsonSpan color;
    if (!dmxJsonObjectGet(row, "color", color) || color.type != '[' ||
        dmxJsonArraySize(color, 4) != 3) {
      dmxSetError(error, errorCap, "row color must contain 3 channels");
      return false;
    }
    for (uint8_t channel = 0; channel < 3; ++channel) {
      if (!dmxJsonArrayGet(color, channel, value) ||
          !dmxJsonToLong(value, number) || number < 0 || number > 255) {
        dmxSetError(error, errorCap, "row color channels must be 0..255");
        return false;
      }
      parsed.rows[i].color[channel] = number;
    }
    DmxJsonSpan textSpan, bindSpan;
    bool hasText = dmxJsonObjectGet(row, "text", textSpan);
    bool hasBind = dmxJsonObjectGet(row, "bind", bindSpan);
    if (hasText == hasBind) {
      dmxSetError(error, errorCap, "row needs exactly one of text or bind");
      return false;
    }
    parsed.rows[i].bound = hasBind;
    parsed.rows[i].maxChars = 16;
    if (hasText) {
      if (!dmxJsonCopyString(textSpan, parsed.rows[i].text,
                             sizeof parsed.rows[i].text)) {
        dmxSetError(error, errorCap, "row text must be at most 64 chars");
        return false;
      }
    } else {
      if (!dmxJsonCopyString(bindSpan, parsed.rows[i].bind,
                             sizeof parsed.rows[i].bind) ||
          (parsed.rows[i].bind[0] && parsed.rows[i].bind[0] != '/')) {
        dmxSetError(error, errorCap, "row bind must be an RFC 6901 path <=64 chars");
        return false;
      }
      if (!dmxCustomString(row, "prefix", parsed.rows[i].prefix,
                           sizeof parsed.rows[i].prefix, "") ||
          !dmxCustomString(row, "suffix", parsed.rows[i].suffix,
                           sizeof parsed.rows[i].suffix, "")) {
        dmxSetError(error, errorCap, "row prefix/suffix must be <=16 chars");
        return false;
      }
      if (dmxJsonObjectGet(row, "max", value)) {
        if (!dmxJsonToLong(value, number) || number < 1 || number > 16) {
          dmxSetError(error, errorCap, "row max must be 1..16");
          return false;
        }
        parsed.rows[i].maxChars = number;
      }
    }
  }
  memcpy(parsed.json, json, length);
  parsed.json[length] = 0;
  return true;
}

static bool dmxBuildCustomFrame(const char* sourceJson, size_t sourceLength,
                                uint32_t nowMs) {
  DmxAppFrame next;
  dmxClearFrame(next);
  for (uint8_t i = 0; i < dmxCustom.rowCount; ++i) {
    const DmxCustomRowSpec& spec = dmxCustom.rows[i];
    char line[17] = "";
    if (!spec.bound) {
      snprintf(line, sizeof line, "%.16s", spec.text);
    } else {
      char bound[65];
      if (!sourceJson || !dmxJsonPointerResolve(sourceJson, sourceLength,
                                                spec.bind, bound,
                                                sizeof bound)) continue;
      snprintf(line, sizeof line, "%s%.*s%s", spec.prefix, spec.maxChars,
               bound, spec.suffix);
      line[spec.maxChars] = 0;
    }
    if (!line[0]) continue;
    dmxCopyRow(next, next.rowCount, spec.y, spec.color, line);
    ++next.rowCount;
  }
  if (!next.rowCount) return false;
  next.hasData = true;
  next.hasRefresh = true;
  next.lastRefreshMs = nowMs;
  next.staleAfterS = dmxCustom.hasSource ? dmxCustom.staleAfterS : 0;
  dmxCustom.frame = next;
  return true;
}

static bool dmxInstallCustomLayout(Preferences& prefs, const char* json,
                                   size_t length, bool persist, char* error,
                                   size_t errorCap) {
  if (!dmxParseCustomLayout(json, length, dmxCustomCandidate, error,
                            errorCap)) return false;
  dmxCustom = dmxCustomCandidate;
  dmxAppSlots[DMX_APP_CUSTOM].refreshIntervalMs =
      (dmxCustom.hasSource ? dmxCustom.intervalS : 86400UL) * 1000UL;
  dmxAppSlots[DMX_APP_CUSTOM].nextRunMs = 0;
  if (!dmxCustom.hasSource) dmxBuildCustomFrame(nullptr, 0, millis());
  if (persist && prefs.putBytes("custom_json", dmxCustom.json, length + 1) !=
                     length + 1) {
    dmxSetError(error, errorCap, "could not store layout in NVS");
    return false;
  }
  return true;
}

static void dmxLoadCustom(Preferences& prefs) {
  size_t stored = prefs.getBytesLength("custom_json");
  bool loaded = false;
  char error[96];
  if (stored > 1 && stored <= sizeof dmxCustomLoadBuffer &&
      prefs.getBytes("custom_json", dmxCustomLoadBuffer, stored) == stored) {
    dmxCustomLoadBuffer[stored - 1] = 0;
    loaded = dmxInstallCustomLayout(prefs, dmxCustomLoadBuffer,
                                    strlen(dmxCustomLoadBuffer), false,
                                    error, sizeof error);
  }
  if (!loaded) {
    static const char fallback[] =
      "{\"v\":1,\"source\":null,\"rows\":[{\"y\":11,\"color\":[255,178,36],\"text\":\"CUSTOM READY\"}]}";
    dmxInstallCustomLayout(prefs, fallback, strlen(fallback), false, error,
                           sizeof error);
  }
}

static int8_t dmxAppIndex(const char* id) {
  for (uint8_t i = 0; i < DMX_APP_COUNT; ++i)
    if (!strcmp(id, DMX_APP_IDS[i])) return i;
  return -1;
}

static DmxAppFrame* dmxAppFrame(uint8_t app) {
  if (app == DMX_APP_MESSAGES) return &dmxMessages.frame;
  if (app == DMX_APP_FLIGHTS_LIST) return &dmxFlights.frame;
  if (app == DMX_APP_CUSTOM) return &dmxCustom.frame;
  return nullptr;
}

static bool dmxAppRenderable(uint8_t app) {
  DmxAppFrame* frame = dmxAppFrame(app);
  return app < DMX_APP_COUNT && dmxAppSlots[app].enabled && frame &&
         frame->hasData && frame->rowCount > 0;
}

static void dmxSetAppEnabled(Preferences& prefs, uint8_t app, bool enabled) {
  if (app >= DMX_APP_COUNT) return;
  dmxAppSlots[app].enabled = enabled;
  dmxAppSlots[app].nextRunMs = 0;
  prefs.putBool(DMX_APP_ENABLE_KEYS[app], enabled);
}

static bool dmxSetAppDuration(Preferences& prefs, uint8_t app,
                              uint16_t durationS) {
  if (app >= DMX_APP_COUNT || durationS < 3 || durationS > 300) return false;
  dmxAppDurationS[app] = durationS;
  return prefs.putUShort(DMX_APP_DURATION_KEYS[app], durationS) ==
         sizeof(uint16_t);
}

static void dmxAppsBegin(Preferences& prefs, uint8_t flightsInterval) {
  dmxFetchBufferInit();
  memset(dmxAppDiag, 0, sizeof dmxAppDiag);
  dmxDiagResult(&dmxAppDiag[DMX_APP_MESSAGES], "offline-app");
  dmxDiagResult(&dmxAppDiag[DMX_APP_FLIGHTS_LIST], "idle");
  dmxDiagResult(&dmxAppDiag[DMX_APP_CUSTOM], "idle");
  for (uint8_t i = 0; i < DMX_APP_COUNT; ++i) {
    bool enabledDefault = i == DMX_APP_MESSAGES;
    dmxAppSlots[i].enabled = prefs.getBool(DMX_APP_ENABLE_KEYS[i],
                                           enabledDefault);
    dmxAppDurationS[i] = prefs.getUShort(DMX_APP_DURATION_KEYS[i], 10);
    if (dmxAppDurationS[i] < 3 || dmxAppDurationS[i] > 300)
      dmxAppDurationS[i] = 10;
    dmxAppSlots[i].nextRunMs = 0;
  }
  dmxClearFrame(dmxFlights.frame);
  dmxLoadMessages(prefs);
  dmxLoadCustom(prefs);
  dmxAppSlots[DMX_APP_FLIGHTS_LIST].refreshIntervalMs =
      (uint32_t)flightsInterval * 1000UL;
}

static void dmxAppsTick(const char* flightsUrl, uint8_t flightsInterval,
                        uint8_t flightsRows, const char* flightsFormat) {
  uint32_t nowMs = millis();
  dmxAppSlots[DMX_APP_MESSAGES].refreshIntervalMs =
      (uint32_t)dmxMessages.rotationS * 1000UL;
  if (dmxAppSlots[DMX_APP_MESSAGES].enabled &&
      dmxTimeDue(nowMs, dmxAppSlots[DMX_APP_MESSAGES].nextRunMs)) {
    dmxSelectMessage(nowMs);
    dmxAppSlots[DMX_APP_MESSAGES].nextRunMs =
        nowMs + dmxAppSlots[DMX_APP_MESSAGES].refreshIntervalMs;
  }

  dmxAppSlots[DMX_APP_FLIGHTS_LIST].refreshIntervalMs =
      (uint32_t)flightsInterval * 1000UL;
  if (dmxAppSlots[DMX_APP_FLIGHTS_LIST].enabled &&
      dmxTimeDue(nowMs, dmxAppSlots[DMX_APP_FLIGHTS_LIST].nextRunMs)) {
    if (!flightsUrl || !flightsUrl[0]) {
      dmxDiagResult(&dmxAppDiag[DMX_APP_FLIGHTS_LIST], "no-url");
      dmxAppSlots[DMX_APP_FLIGHTS_LIST].nextRunMs = nowMs + 5000UL;
    } else {
      size_t length;
      if (dmxFetchJson(flightsUrl, length,
                       &dmxAppDiag[DMX_APP_FLIGHTS_LIST])) {
        uint32_t stale = max(15UL, (uint32_t)flightsInterval * 3UL);
        if (!dmxBuildFlightsFrame(flightsFormat, flightsRows, millis(),
                                  stale))
          dmxDiagResult(&dmxAppDiag[DMX_APP_FLIGHTS_LIST], "no-aircraft");
      }
      dmxAppSlots[DMX_APP_FLIGHTS_LIST].nextRunMs =
          millis() + dmxAppSlots[DMX_APP_FLIGHTS_LIST].refreshIntervalMs;
    }
  }

  if (dmxAppSlots[DMX_APP_CUSTOM].enabled && dmxCustom.hasSource &&
      dmxTimeDue(nowMs, dmxAppSlots[DMX_APP_CUSTOM].nextRunMs)) {
    size_t length;
    if (dmxFetchJson(dmxCustom.url, length, &dmxAppDiag[DMX_APP_CUSTOM])) {
      if (!dmxBuildCustomFrame(dmxAppFetchBuffer, length, millis()))
        dmxDiagResult(&dmxAppDiag[DMX_APP_CUSTOM], "bind-miss");
    }
    dmxAppSlots[DMX_APP_CUSTOM].nextRunMs =
        millis() + dmxAppSlots[DMX_APP_CUSTOM].refreshIntervalMs;
  }
}
