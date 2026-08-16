# REST contract — `/api/v1` — draft

**Status: DRAFT — non-normative until the P2 freeze.** This documents
the LAN HTTP surface the firmware implements today
(`firmware/dk01/dk01.ino`), written from the implementation and from
public specifications only — [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110)
(HTTP semantics), [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259)
(JSON), [RFC 4648](https://www.rfc-editor.org/rfc/rfc4648) (base64),
[RFC 8032](https://www.rfc-editor.org/rfc/rfc8032) (Ed25519)
([ADR-0001](../docs/adr/ADR-0001-clean-room.md)). At P2 this prose
becomes OpenAPI, and the ranges below freeze. Until then firmware may
extend it; breaking changes are avoided but not yet promised.

## Transport and conventions

- Base: `http://<device>/api/v1` on the LAN — plain HTTP permanently
  ([ADR-0031](../docs/adr/ADR-0031-browser-to-device-transport.md));
  server identity is the Ed25519 signed-nonce proof below, never TLS.
- Auth: `Authorization: Bearer <LAN token>` on every route except
  those marked **open**. Failure: `401 {"error":"unauthorized"}`.
  The token is a bearer header only — never a cookie. Tokens minted by
  firmware 0.12.0+ are `dmx_lan_` + 32 hex characters; tokens from
  earlier firmware are bare hex and remain valid until rotated.
- Bodies are JSON, require `Content-Type: application/json`, and are
  refused over 8 KB (`413`, firmware 0.12.0+); the multipart `/update`
  path is exempt.
- Errors are `{"error":"<human-readable message>"}` with a meaningful
  status (400 invalid input, 401 unauthorized, 403 wrong claim code,
  404 unknown id, 410 expired claim code, 413 oversized body,
  429 claim lockout, 500 store/OTA failure). A machine-readable
  error-code registry is a P2 freeze item; today the message string is
  the contract.
- Browser cross-origin access: the firmware answers CORS preflight for
  `/api/v1/*` and `/update` with an **exact-origin allowlist**
  (the hosted Console origin only, never `*`) and validates the `Host`
  header against the device's own names (DNS-rebinding defense).
  Non-browser clients are unaffected.
- No pagination, no versioned media types, no ETag today — all P2
  considerations.

## Route summary

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/v1/health` | GET | open | Liveness + mode |
| `/api/v1/info` | GET | Bearer | Device vitals |
| `/api/v1/display/text` | POST | Bearer | Overlay text |
| `/api/v1/display/frame` | POST | Bearer | Full 64×32 frame |
| `/api/v1/display/clear` | POST | Bearer | Back to rotation |
| `/api/v1/display/brightness` | POST | Bearer | 10–150 |
| `/api/v1/identify` | POST | Bearer | 6 s locate flash |
| `/api/v1/identity` | GET | open | Ed25519 pubkey + fingerprint |
| `/api/v1/identity/verify` | POST | open | Sign a nonce |
| `/api/v1/claim/start` | POST | open | Arm the panel pair code |
| `/api/v1/claim/finish` | POST | open (code) | Code → token + identity |
| `/api/v1/token/rotate` | POST | Bearer | Mint a new LAN token |
| `/api/v1/settings` | GET/POST | Bearer | Timezone (+ brightness echo) |
| `/api/v1/mqtt` | GET/POST | Bearer | Broker config |
| `/api/v1/apps` | GET/POST | Bearer | Enable + scene interval |
| `/api/v1/apps/diag` | GET | Bearer | Per-app fetch verdicts |
| `/api/v1/apps/messages` | GET/POST | Bearer | Phrase pack |
| `/api/v1/apps/custom` | GET/POST | Bearer | Declarative layout ([layout.md](layout.md)) |
| `/api/v1/apps/flights` | GET/POST | Bearer | Flights companion config |
| `/api/v1/apps/{id}/show` | POST | Bearer | Show an app now |
| `/api/v1/reboot` | POST | Bearer | Restart |
| `/api/v1/wifi/reset` | POST | Bearer | Drop Wi-Fi creds → setup |
| `/api/v1/factory/reset` | POST | Bearer | Wipe NVS |
| `/update` | POST multipart | Bearer | OTA upload ([ota.md](ota.md)) |

`{id}` ∈ `messages` · `flights_list` · `custom` (the bundled
declarative apps — docs/GLOSSARY.md).

## Routes

### `GET /api/v1/health` — open

`{"ok":true,"device":"DMX-4E71-0952","fw":"0.11.0","mode":"run"}` —
`mode` is `run` or `setup`. Safe for monitoring; carries no secrets.

### `GET /api/v1/info`

```json
{"device":"DMX-4E71-0952","serial":"DMX-4E71-0952","fw":"0.12.0",
 "uptime_s":86432,"heap_free":118432,"rssi_dbm":-52,"ip":"10.0.4.22",
 "mdns":"dmx-0952.local","brightness":120,"refresh_hz":220,
 "slot":"ota_0","scene":"clock","reset_reason":"power-on"}
```

`heap_free` is internal-SRAM free bytes; `slot` is the running OTA
partition label; `reset_reason` includes `brownout` (surfaced in the
Console as a power warning).

### `POST /api/v1/display/text`

Request: `{"text":"SHIP IT","duration_s":30}`. `text` required,
truncated at 120 chars; `\n` switches the panel to the small
multi-line font. `duration_s` optional, clamped 1–300, default 10.
Response `{"ok":true}`.

### `POST /api/v1/display/frame`

Request: `{"b64":"<base64>"}` decoding to **exactly 4,096 bytes** —
one 64×32 RGB565 little-endian frame. Any other length:
`400 {"error":"bad b64: need exactly 4096 bytes"}`. The frame layer is
REST (and, later, the WebSocket stream) only — never MQTT
(ADR-0029).

### `POST /api/v1/display/clear`

Empty body. Returns the panel to the clock/rotation. `{"ok":true}`.

### `POST /api/v1/display/brightness`

Request: `{"value":120}`, integer 10–150 (the USB power-budget cap;
docs/MANUAL.md ch. 1). Out of range: 400. Persisted to NVS.

### `POST /api/v1/identify`

Empty body; flashes the panel for 6 s. `{"ok":true}`.

### Device identity — `GET /api/v1/identity` (open) and `POST /api/v1/identity/verify` (open)

The anti-spoofing protocol (ADR-0031; docs/SECURITY.md → Discovery &
local transport). Both are unauthenticated by design: a browser must
be able to verify the box before it holds any token.

- `GET /api/v1/identity` →
  `{"device":"DMX-4E71-0952","alg":"ed25519","pubkey":"<b64>",
  "fingerprint":"6EDE-F5A0"}`. The fingerprint is the first 4 bytes of
  SHA-256(pubkey), rendered `XXXX-XXXX`.
- `POST /api/v1/identity/verify` with `{"nonce":"<base64, 16–64
  bytes>"}` → the identity fields plus `"sig":"<b64, 64 bytes>"`, an
  Ed25519 signature over the byte string
  `"dmx-id-v1:" + <serial> + ":" + <nonce bytes>` (domain-separated
  and serial-bound). A nonce shorter than 16 bytes or longer than 64:
  400. Freshness lives in the caller's nonce; the caller verifies
  against the key it pinned at pairing and rejects any mismatch.

### Pairing — `POST /api/v1/claim/start` (open) and `POST /api/v1/claim/finish` (open)

Anyone on the LAN may *ask* to pair; only someone who can read the
panel can *finish* (possession proof; docs/SECURITY.md). One active
code at a time.

- `claim/start`: empty body → `{"ok":true,"expires_s":<remaining>}`
  and the panel shows a 6-digit code. Codes live 5 minutes;
  re-requesting while a code is active re-shows it and reports the
  remaining seconds without extending its life (firmware 0.12.0+).
- `claim/finish` with `{"code":"482913"}` (non-digits are stripped, so
  separators are tolerated). Success →
  `{"token":"<LAN token>", ...identity fields...}` — the identity key
  rides along so the client pins it at the possession-proof moment.
  Failures: `410` no active code; `403` wrong code with
  `"attempts_left":N`; after 5 wrong tries the code dies → `429`.

### `POST /api/v1/token/rotate`

Empty body → `{"token":"<new LAN token>"}`. Every other client's
token stops working immediately.

### `GET/POST /api/v1/settings`

GET → `{"tz":"<POSIX TZ string>","brightness":120}`. POST accepts
`{"tz":"CST6CDT,M3.2.0,M11.1.0"}` (1–63 chars; applied to SNTP
immediately). Response `{"ok":true}`.

### `GET/POST /api/v1/mqtt`

GET → `{"enabled":false,"host":"","port":1883,"username":"",
"tls":false,"has_password":false,"status":"disabled"}`. The password
is **write-only**: never echoed, only `has_password`. POST accepts any
subset of `host` (hostname or IP — no slashes or spaces), `port`
(1–65535), `username`, `password` (writes only when present; blank
field leaves the stored value), `tls`, `enabled`; responds with the
GET shape. Topic tree and envelope: [mqtt.md](mqtt.md).

### `GET/POST /api/v1/apps`

GET →
`{"apps":[{"id":"messages","enabled":true,"interval_s":15,"refresh_s":8}, ...]}`
for the three bundled apps (`refresh_s` is the app's own data cadence:
message rotation, flights fetch interval, or layout source interval —
`0` when the custom layout has no source). POST requires `{"id":…}`
plus `enabled` (boolean) and/or `interval_s` (3–300 s, the scene
duration); responds with the GET shape. Unknown id: 404.

### `GET /api/v1/apps/diag`

Why is an app blank? →

```json
{"fetch_cap":65536,"psram":true,"apps":[
  {"id":"flights_list","enabled":true,"result":"ok","http":200,
   "bytes":34812,"attempts":412,"ok":409,"age_s":3,"rows":4,
   "has_data":true}, ...]}
```

`result` ∈ `ok` · `too-big` · `bad-json` · `no-url` · `no-aircraft` ·
`bind-miss` · `connect-failed` · `http-<code>` · `no-buffer` ·
`bad-url` · `begin-failed` · `short-read` (docs/FIRMWARE.md owns the
user-facing subset). `fetch_cap` is the shared fetch-buffer size
([layout.md](layout.md)).

### `GET/POST /api/v1/apps/messages` and `POST .../show`

GET → `{"phrases":["…", …],"rotation_s":8}`. POST accepts `phrases`
(≤8 strings, each ≤64 chars) and/or `rotation_s` (2–3600); responds
with the GET shape. `show` forces the app on screen for its scene
interval → `{"ok":true,"id":"messages","showing":"messages",
"duration_s":15}` (`showing` falls back to `"clock"` when the app has
no data).

### `GET/POST /api/v1/apps/custom` and `POST .../show`

The declarative layout — shape, limits, and validation:
[layout.md](layout.md). GET returns the stored layout JSON verbatim;
POST validates and replaces it (400 with a specific `error` message on
any violation); `show` as above.

### `GET/POST /api/v1/apps/flights` and `POST /api/v1/apps/flights_list/show`

Config for the Flights Overhead companion (the device is the source of
truth; the Console edits it, any host script obeys it). GET →
`{"url":"http://receiver:8080/data/aircraft.json","interval_s":5,
"rows":3,"format":"kts","view":"list"}`. POST accepts any subset:
`url` (http/https, < 128 chars), `interval_s` (1–60), `rows` (1–5),
`format` (`kts`|`alt`), `view` (`list`|`radar`); **invalid fields are
silently ignored** and the applied config is echoed back — tightening
this to a 400 is a P2 decision.

### `POST /api/v1/reboot`, `POST /api/v1/wifi/reset`, `POST /api/v1/factory/reset`

Empty bodies. Reboot restarts; `wifi/reset` removes only Wi-Fi
credentials and reboots into the setup hotspot (token and config
survive); `factory/reset` wipes the whole NVS namespace — Wi-Fi,
token, timezone, MQTT credentials, app config — back to out-of-box.
Each responds `{"ok":true,…}` before restarting.

## Setup-mode surface (open AP at `192.168.4.1`, pre-provisioning only)

While unprovisioned the device serves, unauthenticated: `GET /`
(captive portal page), `GET /setup/scan` (Wi-Fi SSID listing —
`{"networks":[{"ssid":"…","rssi":-52,"open":false}, …]}` or
`{"scanning":true}`; `?rescan` restarts the scan),
`POST /setup/join` (`{"ssid":"…","pass":"…"}` → `{"ok":true}`),
`GET /setup/status` (`{"state":"idle|joining|failed"}` — or, once
joined, `{"state":"joined","ip":…,"mdns":…,"token":…,` identity
fields`}` — the v0 possession ceremony: the token is revealed on the
setup network only, and since firmware 0.12.0 the device auto-reboots
onto the owner's Wi-Fi 90 s after a successful join, closing the
window; see docs/SECURITY.md), `POST /setup/done` (reboot into
station mode), and
`GET /api/v1/health`. Every unknown URL 302-redirects to the portal
(captive-portal probe behavior).

## Not in this contract (P2 freeze work)

The WebSocket stream `/api/v1/stream` (specified in docs/FIRMWARE.md,
**not implemented**), transport capability descriptors (ADR-0029),
scoped/read-only tokens (gate M1), a machine-readable error registry,
rate limits, and the OTA manifest format ([ota.md](ota.md) holds
today's upload behavior and the M0 target).
