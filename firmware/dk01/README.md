# DK-01 firmware

The firmware that makes the DK-01 plug-and-play: power it up, join its
setup hotspot, pick your Wi-Fi on a friendly page, and the box hands you
its Console and API token. From then on it updates over the air — USB is
a one-time event.

**No secrets live in this code, ever.** Wi-Fi and MQTT credentials plus
the LAN token are created at runtime and stored only in the device's NVS
flash. Factory reset wipes them.

This README is the developer reference (build, flash, API routes). The
owner-facing walkthrough — setup, Console, apps, updates, recovery — is
[docs/MANUAL.md](../../docs/MANUAL.md).

## What you get out of the box

- **Setup hotspot** — first boot opens `DEVMATRIX-XXXX`; a captive
  portal scans your networks and joins live (no blind reboot-and-pray).
  The phone that ran setup signs into the Console automatically.
- **Claim-code pairing** — any other browser taps **Pair**, the panel
  shows a 6-digit code (white row, then blue), and typing it earns the
  LAN token. Reading the panel *is* the credential: nothing to write
  down, and losing a browser never means factory reset. Codes expire in
  5 minutes and die after 5 wrong tries; asking again re-shows the
  active code without extending its life.
- **Local Console** — the device serves its own control page at
  `http://dmx-xxxx.local/`: status tiles, text push, a 64×32 paint
  canvas, brightness, identify, timezone, token rotation, and OTA
  upload, plus optional MQTT broker settings. No cloud, no account, no
  internet required.
- **Clock** — SNTP native clock with seconds bar, shown whenever
  nothing else is.
- **`/api/v1`** — Bearer-token HTTP API for everything the Console
  does. The Console's **Dev console** view writes the curl commands for
  you.
- **MQTT + Home Assistant** — optional outbound esp-mqtt connection to
  the owner's broker, contract envelopes and replay expiry, retained
  availability/display/health state, and zero-YAML light, text, and
  notify discovery. Raw frames never use MQTT.
- **OTA** — upload a `.bin` from the Console. Dual app slots; the
  TinyUF2 factory partition survives every update for USB recovery.

## Build it

```sh
arduino-cli core install esp32:esp32          # pinned family: 3.3.x
arduino-cli lib install "Adafruit Protomatter" # 1.7.1
arduino-cli lib install "ArduinoJson@7.4.3"
arduino-cli lib install "Crypto@0.4.0"         # Rhys Weatherley — Ed25519 device identity
arduino-cli compile --fqbn esp32:esp32:adafruit_matrixportal_esp32s3 \
  --output-dir out firmware/dk01
```

Console changes happen in `portal/console/`; edit `portal/console/src/`
and run `npm run build` from `portal/console/` before compiling firmware.

`out/dk01.ino.bin` is what the Console's **Deploy → OTA upload** card
wants.

## First (and last) cable flash

```sh
arduino-cli upload --fqbn esp32:esp32:adafruit_matrixportal_esp32s3 \
  -p /dev/cu.usbmodem* firmware/dk01
```

macOS re-enumerates the port constantly — glob it, never hardcode it,
and never hold a serial monitor open while uploading (the port is
exclusive-open).

## USB recovery (make a UF2)

The TinyUF2 factory partition mounts the board as a USB drive on a
double-press of reset ([docs/MANUAL.md](../../docs/MANUAL.md) ch. 10).
The drive wants a `.uf2`, not the `.bin` the build produces — convert
with `uf2conv.py` from Microsoft's public
[uf2 repository](https://github.com/microsoft/uf2), using the ESP32-S3
UF2 family id (offset 0 is the app-slot base TinyUF2 expects):

```sh
python3 uf2conv.py out/dk01.ino.bin -c -f 0xc47e5767 -b 0x00 \
  -o out/dk01.uf2
```

Then double-press reset, wait for the board's UF2 drive (its volume
name ends in `BOOT`), and drag `dk01.uf2` on. TinyUF2 writes it to an
app slot and reboots. Bench-drill evidence for this path is queued in
[hardware/procedures/bench-week.md](../../hardware/procedures/bench-week.md) —
run it once and file the evidence before any sold unit.

## The API in 30 seconds

```sh
H="Authorization: Bearer $TOKEN"        # token: shown at setup, serial, Console
curl http://dmx-xxxx.local/api/v1/health                    # open, no token
curl -H "$H" http://dmx-xxxx.local/api/v1/info
curl -H "$H" -H 'Content-Type: application/json' \
     -d '{"text":"SHIP IT","duration_s":30}' \
     http://dmx-xxxx.local/api/v1/display/text
```

Routes: `health`, `info`, `display/text`, `display/frame` (4096 bytes
RGB565 little-endian, base64 in `{"b64":…}`), `display/brightness`,
`display/clear`, `identify`, `identity` (open GET — Ed25519 public key
and fingerprint) + `identity/verify` (open POST `{"nonce":…}` — signs
`"dmx-id-v1:<serial>:" + nonce` so a browser can prove this host is the
panel, ADR-0031), `claim/start` + `claim/finish` (pairing —
start is open, finish wants the panel code and returns the token plus
the identity key for pinning), `settings` (GET/POST,
`tz`), `mqtt` (GET/POST; password is write-only), `token/rotate`,
`reboot`, `wifi/reset`, `factory/reset`, `apps` (GET/POST enable + scene
interval), `apps/diag` (GET — per-app fetch verdicts: last HTTP code,
bytes, `ok`/`too-big`/`bad-json`/`no-url`/`no-aircraft`/`bind-miss`/
`connect-failed`/`http-<code>`, plus
the fetch-buffer size; the answer to "why is this app blank?"),
`apps/messages` (GET/POST), `apps/messages/show`,
`apps/custom` (GET/POST — shape in contracts/layout.md),
`apps/custom/show`, `apps/flights` (GET/POST),
`apps/flights_list/show`, and `POST /update` (multipart `.bin`, OTA).
There is deliberately no discovery/scan route: the device never opens a
connection to an address the owner didn't configure (ADR-0032).
Text submitted to `display/text` is capped at 120 characters. JSON
bodies need `Content-Type: application/json` and are refused over
8 KB (413). Tokens minted by firmware 0.12.0+ carry a `dmx_lan_`
prefix; older bare-hex tokens stay valid. Scripts get the token from the
Console's **Dev console** view (**COPY WITH MY TOKEN**) or USB serial.

## Files

| File | What it is |
|---|---|
| `dk01.ino` | The whole firmware — boot, Wi-Fi, scenes, API, OTA |
| `mqtt_client.h` | Static-buffer esp-mqtt client, contract envelopes, replay guard, state, and Home Assistant discovery |
| `apps_engine.h` / `apps_builtin.h` | Declarative-app parser, renderer, scheduler, and built-in app state |
| `web_setup.h` | Captive-portal setup page (embedded, zero assets) |
| `web_console.h` | GENERATED from `portal/console` — do not hand-edit; edit `portal/console/src` and run `npm run build` |

## Honest limits (current tree, pre-P2-freeze)

- Plain HTTP on the LAN is permanent (ADR-0031). Server identity is the
  Ed25519 signed-nonce proof above, not TLS; the CORS allowlist admits
  only the hosted Console origin and the Host allowlist rejects DNS
  rebinding. Expect the browser's "Not secure" chip — same as Home
  Assistant, ESPHome, and OctoPrint.
- Declarative-app fetches to `https://` sources are encrypted but not
  yet certificate-verified — the CA-store contract is P2 work. Prefer
  LAN sources until then.
- MQTT TLS uses esp-mqtt's encrypted transport but is likewise not CA-
  verified before P2. Use a trusted LAN/VPN broker path and do not treat
  the TLS toggle as broker identity proof yet.
- OTA images are length/magic-checked, not yet signature-verified, and
  automatic boot-failure rollback is M0 work — until then the TinyUF2
  USB drag-and-drop is the recovery path.
- The `/api/v1` shapes here are implementation-informed **drafts**;
  contracts/ freezes them at P2.
