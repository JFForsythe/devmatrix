# Declarative layout contract — draft

**Status: DRAFT — non-normative until the P2 freeze.** This first
layout shape is intentionally small enough for the DK-01 to validate,
store, bind, and render without allocating memory on every refresh. JSON
Pointer bindings follow the public [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901)
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
most 192 characters), `interval_s` (1–86,400 seconds), and
`stale_after_s` (1–604,800 seconds) are all required. The device
accepts only a complete response of 64 KB (65,536 bytes) or less —
firmware 0.10.0 raised this from 4 KB after real feeds exceeded it;
older firmware reports `too-big` — follows at most two
redirects, and keeps the last good frame when a later refresh fails.
After `stale_after_s`, that frame is dimmed and gains a hollow dot in its
top-right corner.

`rows` contains at most five entries. `y` is one of the TomThumb 3×5
font baselines `5`, `11`, `17`, `23`, or `29`; `color` is three integer
RGB channels from 0 through 255. Each row has exactly one of:

- `text`: a literal string up to 64 characters, clipped to the panel's
  16-character row width; or
- `bind`: a non-empty RFC 6901 JSON Pointer up to 64 characters,
  starting with `/`. The resolved value must be a string or number
  (at most 64 characters of resolved text; array indices up to 4096);
  a pointer resolving to a boolean, `null`, object, or array renders
  nothing for that row. Optional `prefix` and `suffix` are each at
  most 16 characters, and optional `max` is 1–16 (default 16). `max`
  truncates the fully composed row — prefix, value, and suffix
  together — not the bound value alone, so a `max` shorter than the
  prefix hides the value entirely. (Whether `max` should clip the
  value instead is a P2 freeze decision.)

Pointer traversal supports mixed object and array paths such as
`/sensors/0/value`, decodes RFC 6901's `~0` and `~1` escapes, and stops
at eight path segments. A layout with no renderable data falls back to
the native clock rather than displaying a partial error screen.

## Draft LAN routes

Authenticated `GET /api/v1/apps/custom` returns the stored layout object.
Authenticated `POST /api/v1/apps/custom` validates and replaces it; a
malformed layout is rejected without replacing the current layout. App
enablement and scene interval are configured through the draft
`GET/POST /api/v1/apps` surface.
