# DK-01 firmware

Build and extend the firmware for the DK-01 64×32 display. It serves the
Local Console, runs the bundled declarative apps, and accepts content from
your own scripts over LAN REST or MQTT.

**Current source: v0.12.7, before the P2 contract freeze.** The features
below exist in source; signed updates, recovery acceptance, and other
release gates remain tracked in [ROADMAP.md](../../ROADMAP.md). A successful
compile does not establish that a board is ready to sell.

**No secrets live in this code, ever.** Wi-Fi and MQTT credentials plus
the LAN token are created at runtime and stored only in the device's NVS
flash. Factory reset wipes them.

This README is the developer reference (build, flash, API routes). The
owner-facing walkthrough — setup, Console, apps, updates, recovery — is
[docs/MANUAL.md](../../docs/MANUAL.md).

## What you get out of the box

- **Setup hotspot** — first boot opens `DEVMATRIX-XXXX`; a captive
  portal scans your networks and joins live (no blind reboot-and-pray).
  The Finish link can carry that browser's token into the Console. Captive
  mini-browsers may require reopening and pairing in a full browser; follow
  [the setup walkthrough](../../docs/MANUAL.md).
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
- **Clock** — native clock with seconds bar. Its present time-source
  dependency and fallback are described in
  [docs/FIRMWARE.md](../../docs/FIRMWARE.md#boot-and-main-loop).
- **`/api/v1`** — Bearer-token HTTP API for everything the Console
  does. The Console's **Dev console** view writes the curl commands for
  you.
- **MQTT + Home Assistant** — optional outbound esp-mqtt connection to
  the owner's broker, contract envelopes and replay expiry, retained
  availability/display/health state, and zero-YAML light, text, and
  notify discovery. Raw frames never use MQTT.
- **OTA** — upload a `.bin` from the Console. Dual app slots; the
  TinyUF2 factory partition survives every update for USB recovery.

## Build it from the repository root

Install [Arduino CLI](https://arduino.github.io/arduino-cli/) first. These
versions match the current repository CI. The original core pin in
ADR-0013 still needs reconciliation; see
[docs/FIRMWARE.md](../../docs/FIRMWARE.md#stack).

```sh
arduino-cli core update-index --additional-urls https://espressif.github.io/arduino-esp32/package_esp32_index.json
arduino-cli core install esp32:esp32@3.3.11 --additional-urls https://espressif.github.io/arduino-esp32/package_esp32_index.json
arduino-cli lib install "Adafruit Protomatter@1.7.1"
arduino-cli lib install "ArduinoJson@7.4.3"
arduino-cli lib install "Crypto@0.4.0"         # Rhys Weatherley — Ed25519 device identity
arduino-cli compile --fqbn esp32:esp32:adafruit_matrixportal_esp32s3 \
  --output-dir out firmware/dk01
```

The generated Console is committed, so an unchanged checkout needs no
Node build. For Console changes, edit `portal/console/src/`, run `npm ci`
and `npm run build` inside `portal/console/`, then run `make console-verify`
from the repository root before compiling firmware. Never edit
`web_console.h` by hand.

`out/dk01.ino.bin` is what the Console's **Deploy → OTA upload** card
wants.

## Cable flash

List connected boards, then use the exact port for the intended board:

```sh
arduino-cli board list
arduino-cli upload --fqbn esp32:esp32:adafruit_matrixportal_esp32s3 \
  --input-dir out --port /dev/cu.usbmodemREPLACE_ME firmware/dk01
```

Replace the example port with the board-list result. macOS may change it
after a reset, so list again when it does. Close any serial monitor before
uploading. A wildcard is ambiguous when several boards are connected.

## USB recovery (make a UF2)

The TinyUF2 factory partition mounts the board as a USB drive on a
double-press of reset ([docs/MANUAL.md](../../docs/MANUAL.md) ch. 10).
The drive wants a `.uf2`, not the `.bin` the build produces — convert
with Microsoft's public
[uf2conv.py](https://github.com/microsoft/uf2/blob/master/utils/uf2conv.py).
Download that script first; it is not included in this checkout. Run the
following from the repository root, replacing `/path/to/uf2conv.py` with
its saved location. This uses the ESP32-S3 UF2 family id (offset 0 is the
app-slot base TinyUF2 expects):

```sh
python3 /path/to/uf2conv.py out/dk01.ino.bin -c -f 0xc47e5767 -b 0x00 \
  -o out/dk01.uf2
```

Then double-press reset, wait for the board's UF2 drive (its volume
name ends in `BOOT`), and drag `dk01.uf2` on. TinyUF2 writes it to an
app slot and reboots. Bench-drill evidence for this path is queued in
[hardware/procedures/bench-week.md](../../hardware/procedures/bench-week.md) —
run it once and file the evidence before any sold unit.

## Wipe a board back to stock

The owner-facing walkthroughs — the token-free USB factory reset (an
`esptool` NVS erase), the complete back-to-default re-flash, and the
bench tips that separate a stranded board from a dead one — are in
[docs/MANUAL.md](../../docs/MANUAL.md) ch. 10. The flash map they rely
on is owned by [docs/FIRMWARE.md](../../docs/FIRMWARE.md) → Hardware
budget.

## The API in 30 seconds

```sh
H="Authorization: Bearer $TOKEN"        # token: shown at setup, serial, Console
curl http://dmx-xxxx.local/api/v1/health                    # open, no token
curl -H "$H" http://dmx-xxxx.local/api/v1/info
curl -H "$H" -H 'Content-Type: application/json' \
     -d '{"text":"SHIP IT","duration_s":30}' \
     http://dmx-xxxx.local/api/v1/display/text
```

The full route table, request examples, ranges, identity and pairing protocol,
and error responses live in [contracts/rest.md](../../contracts/rest.md).
For integrations, start with [examples/README.md](../../examples/README.md);
for your own on-device layout, use
[contracts/layout.md](../../contracts/layout.md). There is no device-side
receiver discovery route (ADR-0032).

Use the Console's **Dev console → COPY WITH MY TOKEN** or the boot-time
USB serial output to obtain your token. It grants full device control;
[docs/SECURITY.md](../../docs/SECURITY.md) owns the trust and transport limits.

## Files

| File | What it is |
|---|---|
| `dk01.ino` | Main sketch — boot, Wi-Fi, scenes, API, OTA |
| `mqtt_client.h` | Static-buffer esp-mqtt client, contract envelopes, replay guard, state, and Home Assistant discovery |
| `apps_engine.h` / `apps_builtin.h` | Declarative-app parser, renderer, scheduler, and built-in app state |
| `web_setup.h` | Captive-portal setup page (embedded, zero assets) |
| `web_console.h` | GENERATED from `portal/console` — do not hand-edit; edit `portal/console/src` and run `npm run build` |

## Before using a development build

Read [the current security posture](../../docs/SECURITY.md#what-exists-today)
for setup-window exposure, plain HTTP and key-pinning limits, outbound TLS,
and unsigned OTA. Dual app slots exist; automatic rollback and USB recovery
still require the hardware acceptance evidence in
[ROADMAP.md](../../ROADMAP.md). USB may be needed again after a bad update.

The API shapes remain drafts until P2. For known defects and the exact scope
of the latest source review, see
[firmware and contracts review](../../docs/reviews/2026-09-08-full-review/firmware-and-contracts.md).
