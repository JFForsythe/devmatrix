# DK-01 firmware

The firmware that makes the DK-01 plug-and-play: power it up, join its
setup hotspot, pick your Wi-Fi on a friendly page, and the box hands you
its Console and API token. From then on it updates over the air — USB is
a one-time event.

**No secrets live in this code, ever.** Wi-Fi credentials and the LAN
token are created at runtime and stored only in the device's NVS flash.
Factory reset wipes them.

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
  5 minutes and die after 5 wrong tries.
- **Local Console** — the device serves its own control page at
  `http://dmx-xxxx.local/`: status tiles, text push, a 64×32 paint
  canvas, brightness, identify, timezone, token rotation, and OTA
  upload. No cloud, no account, no internet required.
- **Clock** — SNTP native clock with seconds bar, shown whenever
  nothing else is.
- **`/api/v1`** — Bearer-token HTTP API for everything the Console
  does. The Console's API card writes the curl commands for you.
- **OTA** — upload a `.bin` from the Console. Dual app slots; the
  TinyUF2 factory partition survives every update for USB recovery.

## Build it

```sh
arduino-cli core install esp32:esp32          # pinned family: 3.3.x
arduino-cli lib install "Adafruit Protomatter" # 1.7.1
arduino-cli compile --fqbn esp32:esp32:adafruit_matrixportal_esp32s3 \
  --output-dir out firmware/dk01
```

Console changes happen in `portal/console/`; edit `portal/console/src/`
and run `npm run build` from `portal/console/` before compiling firmware.

`out/dk01.ino.bin` is what the Console's **Update firmware** card wants.

## First (and last) cable flash

```sh
arduino-cli upload --fqbn esp32:esp32:adafruit_matrixportal_esp32s3 \
  -p /dev/cu.usbmodem* firmware/dk01
```

macOS re-enumerates the port constantly — glob it, never hardcode it,
and never hold a serial monitor open while uploading (the port is
exclusive-open).

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
`display/clear`, `identify`, `claim/start` + `claim/finish` (pairing —
start is open, finish wants the panel code), `settings` (GET/POST,
`tz`), `token/rotate`, `reboot`, `wifi/reset`, `factory/reset`, and
`POST /update` (multipart `.bin`, OTA). JSON bodies need
`Content-Type: application/json`. Scripts get the token from the
Console's API card ("Copy with my token") or USB serial.

## Files

| File | What it is |
|---|---|
| `dk01.ino` | The whole firmware — boot, Wi-Fi, scenes, API, OTA |
| `web_setup.h` | Captive-portal setup page (embedded, zero assets) |
| `web_console.h` | GENERATED from `portal/console` — do not hand-edit; edit `portal/console/src` and run `npm run build` |

## Honest limits (v0, pre-P2-freeze)

- HTTP only on the LAN; TLS design is tracked in docs/SECURITY.md.
- Declarative-app fetches to `https://` sources are encrypted but not
  yet certificate-verified — the CA-store contract is P2 work. Prefer
  LAN sources until then.
- OTA images are length/magic-checked, not yet signature-verified, and
  automatic boot-failure rollback is M0 work — until then the TinyUF2
  USB drag-and-drop is the recovery path.
- The `/api/v1` shapes here are implementation-informed **drafts**;
  contracts/ freezes them at P2.
