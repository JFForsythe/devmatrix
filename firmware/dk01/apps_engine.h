// SPDX-License-Identifier: GPL-3.0-or-later
#pragma once

// Small declarative-app primitives for DK-01. All buffers and app frames are
// static: an app refresh must not grow the heap from one scheduler cycle to
// the next. Keep the internal-SRAM watermark above the existing boot floor;
// the shared 4 KiB fetch buffer is the largest new always-live allocation.

#include <Adafruit_Protomatter.h>
#include <Fonts/TomThumb.h>
#include <HTTPClient.h>
#include <WiFiClient.h>
#include <WiFiClientSecure.h>
#include <ctype.h>
#include <math.h>

static const size_t DMX_APP_FETCH_CAP = 4096;
static const uint8_t DMX_APP_MAX_ROWS = 5;
static const uint8_t DMX_APP_MAX_DEPTH = 8;
static const uint8_t DMX_APP_BASELINES[DMX_APP_MAX_ROWS] = {5, 11, 17, 23, 29};

struct DmxAppSchedulerSlot {
  bool enabled;
  uint32_t refreshIntervalMs;
  uint32_t nextRunMs;
};

struct DmxAppRow {
  uint8_t y;
  uint8_t color[3];
  char text[17];
};

struct DmxAppFrame {
  DmxAppRow rows[DMX_APP_MAX_ROWS];
  uint8_t rowCount;
  bool tiny;
  bool hasData;
  bool hasRefresh;
  uint32_t lastRefreshMs;
  uint32_t staleAfterS;
};

struct DmxJsonSpan {
  const char* begin;
  const char* end;
  char type;
};

static char dmxAppFetchBuffer[DMX_APP_FETCH_CAP + 1];

static bool dmxTimeDue(uint32_t nowMs, uint32_t deadlineMs) {
  return deadlineMs == 0 || (int32_t)(nowMs - deadlineMs) >= 0;
}

static const char* dmxJsonWs(const char* p, const char* end) {
  while (p < end && isspace((unsigned char)*p)) ++p;
  return p;
}

static bool dmxJsonScanString(const char* p, const char* end,
                              const char** after) {
  if (p >= end || *p != '"') return false;
  for (++p; p < end; ++p) {
    if ((unsigned char)*p < 0x20) return false;
    if (*p == '"') {
      *after = p + 1;
      return true;
    }
    if (*p != '\\') continue;
    if (++p >= end) return false;
    if (*p == 'u') {
      for (uint8_t i = 0; i < 4; ++i) {
        if (++p >= end || !isxdigit((unsigned char)*p)) return false;
      }
    } else if (!strchr("\"\\/bfnrt", *p)) {
      return false;
    }
  }
  return false;
}

static bool dmxJsonScanValue(const char* p, const char* end, DmxJsonSpan& out,
                             uint8_t depth) {
  p = dmxJsonWs(p, end);
  if (p >= end || depth > 16) return false;
  out.begin = p;
  out.type = *p;
  if (*p == '"') {
    return dmxJsonScanString(p, end, &out.end);
  }
  if (*p == '{') {
    p = dmxJsonWs(p + 1, end);
    if (p < end && *p == '}') { out.end = p + 1; return true; }
    while (p < end) {
      const char* afterKey = nullptr;
      if (!dmxJsonScanString(p, end, &afterKey)) return false;
      p = dmxJsonWs(afterKey, end);
      if (p >= end || *p++ != ':') return false;
      DmxJsonSpan child;
      if (!dmxJsonScanValue(p, end, child, depth + 1)) return false;
      p = dmxJsonWs(child.end, end);
      if (p < end && *p == '}') { out.end = p + 1; return true; }
      if (p >= end || *p++ != ',') return false;
      p = dmxJsonWs(p, end);
    }
    return false;
  }
  if (*p == '[') {
    p = dmxJsonWs(p + 1, end);
    if (p < end && *p == ']') { out.end = p + 1; return true; }
    while (p < end) {
      DmxJsonSpan child;
      if (!dmxJsonScanValue(p, end, child, depth + 1)) return false;
      p = dmxJsonWs(child.end, end);
      if (p < end && *p == ']') { out.end = p + 1; return true; }
      if (p >= end || *p++ != ',') return false;
      p = dmxJsonWs(p, end);
    }
    return false;
  }
  if (*p == '-' || isdigit((unsigned char)*p)) {
    const char* q = p;
    if (*q == '-') ++q;
    if (q >= end) return false;
    if (*q == '0') ++q;
    else {
      if (!isdigit((unsigned char)*q)) return false;
      while (q < end && isdigit((unsigned char)*q)) ++q;
    }
    if (q < end && *q == '.') {
      ++q;
      if (q >= end || !isdigit((unsigned char)*q)) return false;
      while (q < end && isdigit((unsigned char)*q)) ++q;
    }
    if (q < end && (*q == 'e' || *q == 'E')) {
      ++q;
      if (q < end && (*q == '+' || *q == '-')) ++q;
      if (q >= end || !isdigit((unsigned char)*q)) return false;
      while (q < end && isdigit((unsigned char)*q)) ++q;
    }
    out.end = q;
    out.type = 'n';
    return true;
  }
  const char* literal = nullptr;
  size_t length = 0;
  if ((size_t)(end - p) >= 4 && !memcmp(p, "true", 4)) {
    literal = "true"; length = 4; out.type = 'b';
  } else if ((size_t)(end - p) >= 5 && !memcmp(p, "false", 5)) {
    literal = "false"; length = 5; out.type = 'b';
  } else if ((size_t)(end - p) >= 4 && !memcmp(p, "null", 4)) {
    literal = "null"; length = 4; out.type = '0';
  }
  if (!literal) return false;
  out.end = p + length;
  return true;
}

static bool dmxJsonRoot(const char* json, size_t length, DmxJsonSpan& root) {
  if (!json || !dmxJsonScanValue(json, json + length, root, 0)) return false;
  return dmxJsonWs(root.end, json + length) == json + length;
}

static int dmxHex(char ch) {
  if (ch >= '0' && ch <= '9') return ch - '0';
  if (ch >= 'a' && ch <= 'f') return ch - 'a' + 10;
  if (ch >= 'A' && ch <= 'F') return ch - 'A' + 10;
  return -1;
}

static bool dmxJsonCopyString(const DmxJsonSpan& span, char* out,
                              size_t outCap) {
  if (span.type != '"' || outCap == 0) return false;
  size_t used = 0;
  for (const char* p = span.begin + 1; p < span.end - 1; ++p) {
    char ch = *p;
    if (ch == '\\') {
      if (++p >= span.end - 1) return false;
      switch (*p) {
        case 'n': ch = '\n'; break;
        case 'r': ch = '\r'; break;
        case 't': ch = '\t'; break;
        case 'b': ch = '\b'; break;
        case 'f': ch = '\f'; break;
        case 'u': {
          if (p + 4 >= span.end) return false;
          int value = 0;
          for (uint8_t i = 0; i < 4; ++i) {
            int nibble = dmxHex(*++p);
            if (nibble < 0) return false;
            value = (value << 4) | nibble;
          }
          ch = value >= 0x20 && value <= 0x7e ? (char)value : '?';
          break;
        }
        default: ch = *p; break;
      }
    }
    if (used + 1 >= outCap) return false;
    out[used++] = ch;
  }
  out[used] = 0;
  return true;
}

static bool dmxJsonKeyEquals(const DmxJsonSpan& key, const char* wanted) {
  char decoded[65];
  return dmxJsonCopyString(key, decoded, sizeof decoded) && !strcmp(decoded, wanted);
}

static bool dmxJsonObjectGet(const DmxJsonSpan& object, const char* key,
                             DmxJsonSpan& value) {
  if (object.type != '{') return false;
  const char* p = dmxJsonWs(object.begin + 1, object.end - 1);
  while (p < object.end - 1) {
    DmxJsonSpan keySpan;
    keySpan.begin = p;
    keySpan.type = '"';
    if (!dmxJsonScanString(p, object.end, &keySpan.end)) return false;
    p = dmxJsonWs(keySpan.end, object.end);
    if (p >= object.end || *p++ != ':') return false;
    if (!dmxJsonScanValue(p, object.end, value, 0)) return false;
    if (dmxJsonKeyEquals(keySpan, key)) return true;
    p = dmxJsonWs(value.end, object.end);
    if (p < object.end && *p == ',') p = dmxJsonWs(p + 1, object.end);
  }
  return false;
}

static bool dmxJsonArrayGet(const DmxJsonSpan& array, size_t wanted,
                            DmxJsonSpan& value) {
  if (array.type != '[') return false;
  const char* p = dmxJsonWs(array.begin + 1, array.end - 1);
  size_t index = 0;
  while (p < array.end - 1) {
    if (!dmxJsonScanValue(p, array.end, value, 0)) return false;
    if (index++ == wanted) return true;
    p = dmxJsonWs(value.end, array.end);
    if (p < array.end && *p == ',') p = dmxJsonWs(p + 1, array.end);
  }
  return false;
}

static size_t dmxJsonArraySize(const DmxJsonSpan& array, size_t stopAfter) {
  DmxJsonSpan ignored;
  size_t count = 0;
  while (count < stopAfter && dmxJsonArrayGet(array, count, ignored)) ++count;
  return count;
}

static bool dmxJsonToLong(const DmxJsonSpan& span, long& value) {
  if (span.type != 'n' || span.end - span.begin >= 24) return false;
  char text[24];
  size_t n = span.end - span.begin;
  memcpy(text, span.begin, n);
  text[n] = 0;
  char* after = nullptr;
  value = strtol(text, &after, 10);
  return after && *after == 0;
}

static bool dmxJsonToDouble(const DmxJsonSpan& span, double& value) {
  if (span.type != 'n' || span.end - span.begin >= 32) return false;
  char text[32];
  size_t n = span.end - span.begin;
  memcpy(text, span.begin, n);
  text[n] = 0;
  char* after = nullptr;
  value = strtod(text, &after);
  return after && *after == 0 && isfinite(value);
}

static bool dmxJsonToBool(const DmxJsonSpan& span, bool& value) {
  if (span.type != 'b') return false;
  value = *span.begin == 't';
  return true;
}

static bool dmxPointerToken(const char* begin, const char* end, char* out,
                            size_t cap) {
  size_t used = 0;
  for (const char* p = begin; p < end; ++p) {
    char ch = *p;
    if (ch == '~') {
      if (++p >= end || (*p != '0' && *p != '1')) return false;
      ch = *p == '0' ? '~' : '/';
    }
    if (used + 1 >= cap) return false;
    out[used++] = ch;
  }
  out[used] = 0;
  return true;
}

// JSON Pointer resolution follows RFC 6901:
// https://www.rfc-editor.org/rfc/rfc6901 . Object members and array indexes
// may be mixed (for example /a/b/0); traversal is capped at eight segments.
static bool dmxJsonPointerResolve(const char* json, size_t length,
                                  const char* pointer, char* out,
                                  size_t outCap) {
  if (!pointer || strlen(pointer) > 64 || outCap == 0) return false;
  DmxJsonSpan current;
  if (!dmxJsonRoot(json, length, current)) return false;
  const char* p = pointer;
  uint8_t depth = 0;
  while (*p) {
    if (*p++ != '/' || ++depth > DMX_APP_MAX_DEPTH) return false;
    const char* slash = strchr(p, '/');
    const char* tokenEnd = slash ? slash : p + strlen(p);
    char token[65];
    if (!dmxPointerToken(p, tokenEnd, token, sizeof token)) return false;
    DmxJsonSpan child;
    if (current.type == '{') {
      if (!dmxJsonObjectGet(current, token, child)) return false;
    } else if (current.type == '[') {
      if (!token[0] || (token[0] == '0' && token[1])) return false;
      size_t index = 0;
      for (const char* q = token; *q; ++q) {
        if (!isdigit((unsigned char)*q)) return false;
        index = index * 10 + (*q - '0');
        if (index > 4096) return false;
      }
      if (!dmxJsonArrayGet(current, index, child)) return false;
    } else {
      return false;
    }
    current = child;
    p = tokenEnd;
  }
  if (current.type == '"') return dmxJsonCopyString(current, out, outCap);
  if (current.type != 'n') return false;
  size_t n = current.end - current.begin;
  if (n + 1 > outCap) return false;
  memcpy(out, current.begin, n);
  out[n] = 0;
  return true;
}

// Fetches one complete JSON document into the single shared static buffer.
// HTTPS is supported with an encrypted but currently unauthenticated client;
// the pre-P2 transport design still has no CA-store contract (SECURITY.md).
static bool dmxFetchJson(const char* url, size_t& length) {
  length = 0;
  if (!url || (strncmp(url, "http://", 7) && strncmp(url, "https://", 8)))
    return false;
  static WiFiClient plainClient;
  static WiFiClientSecure secureClient;
  HTTPClient http;
  http.setConnectTimeout(700);
  http.setTimeout(1200);
  http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
  http.setRedirectLimit(2);
  bool began;
  if (!strncmp(url, "https://", 8)) {
    secureClient.setInsecure();
    began = http.begin(secureClient, String(url));
  } else {
    began = http.begin(plainClient, String(url));
  }
  if (!began) return false;
  bool ok = false;
  int code = http.GET();
  int announced = http.getSize();
  if (code == HTTP_CODE_OK && announced <= (int)DMX_APP_FETCH_CAP) {
    NetworkClient* stream = http.getStreamPtr();
    uint32_t lastByteMs = millis();
    bool overflow = false;
    while (stream && http.connected() &&
           (announced < 0 || length < (size_t)announced)) {
      int available = stream->available();
      if (available <= 0) {
        if (millis() - lastByteMs > 1200) break;
        delay(2);
        continue;
      }
      while (available-- > 0) {
        int ch = stream->read();
        if (ch < 0) break;
        lastByteMs = millis();
        if (length >= DMX_APP_FETCH_CAP) { overflow = true; break; }
        dmxAppFetchBuffer[length++] = (char)ch;
      }
      if (overflow) break;
    }
    dmxAppFetchBuffer[length] = 0;
    DmxJsonSpan root;
    bool complete = announced < 0 || length == (size_t)announced;
    ok = !overflow && complete && length > 0 &&
         dmxJsonRoot(dmxAppFetchBuffer, length, root);
  }
  http.end();
  if (!ok) { length = 0; dmxAppFetchBuffer[0] = 0; }
  return ok;
}

static bool dmxAllowedBaseline(long y) {
  for (uint8_t i = 0; i < DMX_APP_MAX_ROWS; ++i)
    if (y == DMX_APP_BASELINES[i]) return true;
  return false;
}

static void dmxClearFrame(DmxAppFrame& frame) {
  memset(&frame, 0, sizeof frame);
  frame.tiny = true;
}

static uint16_t dmxRowColor(Adafruit_Protomatter& matrix, uint8_t brightness,
                            const uint8_t color[3], bool dim) {
  uint16_t divisor = dim ? 4 : 1;
  return matrix.color565((color[0] * brightness) / (255 * divisor),
                         (color[1] * brightness) / (255 * divisor),
                         (color[2] * brightness) / (255 * divisor));
}

static bool dmxFrameIsStale(const DmxAppFrame& frame, uint32_t nowMs) {
  return frame.hasRefresh && frame.staleAfterS > 0 &&
         nowMs - frame.lastRefreshMs > frame.staleAfterS * 1000UL;
}

static void dmxRenderRows(Adafruit_Protomatter& matrix, uint8_t brightness,
                          const DmxAppFrame& frame, uint32_t nowMs) {
  bool stale = dmxFrameIsStale(frame, nowMs);
  matrix.fillScreen(0);
  matrix.setTextWrap(false);
  matrix.setTextSize(1);
  if (frame.tiny) matrix.setFont(&TomThumb);
  uint8_t rowLimit = frame.tiny ? DMX_APP_MAX_ROWS : 2;
  for (uint8_t i = 0; i < frame.rowCount && i < rowLimit; ++i) {
    matrix.setTextColor(dmxRowColor(matrix, brightness, frame.rows[i].color,
                                    stale));
    matrix.setCursor(frame.tiny ? 0 : 1,
                     frame.tiny ? frame.rows[i].y : (i == 0 ? 1 : 17));
    matrix.print(frame.rows[i].text);
  }
  if (frame.tiny) matrix.setFont(NULL);
  if (stale) {
    uint8_t dot[3] = {120, 120, 120};
    matrix.drawCircle(61, 2, 2, dmxRowColor(matrix, brightness, dot, false));
  }
  matrix.show();
}
