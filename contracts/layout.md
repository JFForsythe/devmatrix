# Declarative layout contract — draft

**Status: DRAFT — non-normative until the P2 freeze.** This first
layout shape is intentionally small enough for the DK-01 to validate,
store, bind, and render with bounded response storage. The shared fetch
buffer is allocated once; the HTTP client still uses transient allocations.
JSON Pointer bindings follow the public [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901)
specification. The P2 freeze will replace this prose with JSON Schema.

## Version 1 shape

One layout is a JSON object no larger than 2 KB:

```json
{
  "v": 1,
  "source": {
    "url": "https://example.net/status.json",
    "interval_s": 60,
    "stale_after_s": 300
  },
  "rows": [
    {"y": 5, "color": [255, 178, 36], "text": "WORKSHOP"},
    {"y": 11, "color": [40, 210, 230], "bind": "/sensors/0/value", "prefix": "TEMP ", "suffix": " C", "max": 16}
  ]
}
```

`v` is exactly `1`. `source` is either `null` for a completely offline
literal layout, or an HTTP/HTTPS JSON source object in which `url` (at
most 192 bytes), `interval_s` (1–86,400 seconds), and
`stale_after_s` (1–604,800 seconds) are all required. The device
normally accepts a complete response of at most 65,536 bytes. If PSRAM
allocation fails, it falls back to 8,192 bytes of internal heap; inspect
`GET /api/v1/apps/diag` for the actual limit and `no-buffer` failure.
The client follows at most two same-scheme redirects without constraining
the destination host, and currently reads the raw HTTP body without decoding
chunked transfer framing. Use a direct JSON endpoint with Content-Length
until these defects are fixed. HTTPS certificate and timing limitations are
owned by [SECURITY.md](../docs/SECURITY.md).

The last good frame remains when a refresh fails or no new row can render.
After `stale_after_s`, that frame is dimmed and gains a hollow dot in its
top-right corner.

`rows` contains at most five entries. `y` is one of the TomThumb 3×5
font baselines `5`, `11`, `17`, `23`, or `29`; `color` is three integer
RGB channels from 0 through 255. Each row has exactly one of:

- `text`: a literal string up to 64 bytes, clipped to the panel's
  16-character row width; or
- `bind`: an RFC 6901 JSON Pointer up to 64 bytes. A non-empty pointer
  starts with `/`; the empty string addresses the entire source document.
  The resolved value must be a string or number
  (at most 64 bytes of resolved text; array indices up to 4096);
  a pointer resolving to a boolean, `null`, object, or array renders
  nothing for that row. Optional `prefix` and `suffix` are each at
  most 16 bytes, and optional `max` is 1–16 (default 16). `max`
  truncates the fully composed row — prefix, value, and suffix
  together — not the bound value alone, so a `max` shorter than the
  prefix hides the value entirely. (Whether `max` should clip the
  value instead is a P2 freeze decision.)

Pointer traversal supports mixed object and array paths such as
`/sensors/0/value`, decodes RFC 6901's `~0` and `~1` escapes, and stops
at eight path segments. A new layout with no renderable data falls back to
the native clock.
If a later refresh cannot render any rows, its previous frame remains and
ages; if some rows resolve, the newly renderable subset replaces the frame.
This can hide missing bindings when literal rows still succeed, so inspect
both the panel and the source shape.

String limits are byte-oriented, not Unicode character counts. The current
TomThumb path targets compact ASCII text; `\u` escapes outside printable
ASCII become `?`, and arbitrary Unicode/emoji rendering is not supported.

## Draft LAN routes

Authenticated `GET /api/v1/apps/custom` returns the stored layout object.
Authenticated `POST /api/v1/apps/custom` validates and replaces it; a
malformed layout is rejected without replacing the current layout. A later
NVS write failure can still leave the validated new layout active in RAM;
failed persistence is not an atomic rollback today. App
enablement and scene interval are configured through the draft
`GET/POST /api/v1/apps` surface.
