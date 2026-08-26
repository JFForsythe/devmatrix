# Devmatrix — Dev Kit by FlightTrackerLED

[![Repository checks](https://github.com/JFForsythe/devmatrix/actions/workflows/ci.yml/badge.svg)](https://github.com/JFForsythe/devmatrix/actions/workflows/ci.yml)

A hackable 64×32 LED matrix appliance for people who want a beautiful
object they fully control: open firmware, documented APIs, and a
control portal (the **Console**) served by the device itself. No app,
no account, no cloud — everything works on your LAN with my servers
unreachable, by invariant ([docs/MODES.md](docs/MODES.md)).

Point a browser at the box and it hands you the rest: live status, a
paint canvas, apps, over-the-air updates, and copy-paste `curl`
commands with your own token already filled in.

Not the closed FlightTrackerLED appliance — an independent, clean-room
canvas platform whose bundled apps include a small local-only flight
display fed by your own receiver. No closed-product code, logic, or
schemas, ever. See the IP line in [docs/VISION.md](docs/VISION.md).

## What it does today

Current firmware: **v0.12.5**. Every claim below is labeled **Today**
in the docs (the current firmware does it) — never a promise about
the future; bench evidence lives in [hardware/](hardware/README.md).

- **Five-minute setup, no app.** The panel walks you through it: join
  its hotspot, pick your Wi-Fi on a live-scanning page, open the
  address the panel shows you. Done.
- **Your first app in 30 seconds.** Type words on the Console's
  Messages card, press **PUT IT ON THE PANEL** — saved, enabled,
  showing.
- **A real HTTP API.** Bearer-token `/api/v1` for text, full frames
  (~15 fps on your LAN), brightness, apps, settings — and the
  Console's **Dev console** view writes the `curl` commands for you.
- **MQTT + Home Assistant.** Point the device at *your* broker and
  Home Assistant discovers light, text, and notify entities with zero
  YAML. I never run the broker — it's yours.
- **1,000+ community apps.** The owner-hosted Pixlet bridge renders
  the open Tidbyt-ecosystem catalog on your always-on machine and
  pushes the frames — with **Easy Mode**, a local browser page for
  searching, previewing, and building the rotation.
- **Planes from your own antenna.** A live flights list, or an
  animated radar with altitude-colored aircraft and comet trails —
  fed only by an ADS-B receiver on your LAN, never a feed of mine.
- **Updates you can't be afraid of.** OTA writes to the inactive app
  slot while the old version stays in the other; the TinyUF2 factory
  partition survives every update for drag-and-drop USB recovery; and
  a token-free USB factory reset returns any board to out-of-box.

## What you need

- An [Adafruit MatrixPortal S3](https://www.adafruit.com/product/5778)
  and a 64×32 HUB75 RGB matrix panel — the DK-01 hardware
  ([docs/VISION.md](docs/VISION.md)).
- A 5 V USB-C supply with real headroom (weak supplies brown out at
  full white — the firmware caps brightness for exactly that reason).
- A phone or laptop, and a 2.4 GHz Wi-Fi network.

## Quick start

The full walkthrough with every detail is
[docs/MANUAL.md](docs/MANUAL.md) — this is the short version.

**1 · Build and flash — one cable, one time** (updates go over the
air after this). Install
[arduino-cli](https://arduino.github.io/arduino-cli/), then, from the
repository root:

```sh
arduino-cli core install esp32:esp32            # pinned family: 3.3.x
arduino-cli lib install "Adafruit Protomatter"  # 1.7.1
arduino-cli lib install "ArduinoJson@7.4.3"
arduino-cli lib install "Crypto@0.4.0"
arduino-cli compile --fqbn esp32:esp32:adafruit_matrixportal_esp32s3 \
  --output-dir out firmware/dk01
arduino-cli upload --fqbn esp32:esp32:adafruit_matrixportal_esp32s3 \
  -p /dev/cu.usbmodem* firmware/dk01
```

Exact pins and flashing tips: [firmware/dk01/README.md](firmware/dk01/README.md).
Re-flashing a used board? [docs/MANUAL.md](docs/MANUAL.md) ch. 10
returns it to out-of-box first.

**2 · First boot.** The panel announces `JOIN ME → DEVMATRIX-XXXX`.
Join that Wi-Fi network from your phone; a captive portal opens, scans
your networks live, and joins the one you pick — no blind
reboot-and-hope ([docs/MANUAL.md](docs/MANUAL.md) ch. 3).

**3 · Open the Console.** The panel then walks you to the last step:
open `http://dmx-xxxx.local/` (the exact address is on the panel). The
phone that ran setup is already signed in; every other browser taps
**Pair** and types the 6-digit code the panel shows
([docs/MANUAL.md](docs/MANUAL.md) ch. 4).

**4 · First app, 30 seconds.** Console → **Apps** → **Messages** →
type words → **PUT IT ON THE PANEL**.

**5 · First script.** Copy `$TOKEN` from the Console's **Dev console**
view, then:

```sh
curl -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
     -d '{"text":"SHIP IT","duration_s":30}' \
     http://dmx-xxxx.local/api/v1/display/text
```

Full route list: [firmware/dk01/README.md](firmware/dk01/README.md).
Ready-made host apps and installers: [examples/](examples/README.md).

## Everyday things, and where they're explained

Every one of these is a step-by-step chapter in
[docs/MANUAL.md](docs/MANUAL.md):

| I want to… | Manual |
|---|---|
| Set it up from scratch, pair more browsers | ch. 3–4 |
| Know what every Console page does | ch. 5 |
| Push text and frames from my own code | ch. 6 |
| Show planes from my own ADS-B receiver | ch. 8 |
| Run 1,000+ community Pixlet apps | ch. 8 |
| Update the firmware over the air | ch. 9 |
| Factory-reset, recover, or **re-flash back to default** — including with no token and no working Console | ch. 10 |
| Connect MQTT and Home Assistant, and prove it from a terminal | ch. 11 |
| Fix something weird (plus hard-won bench tips) | ch. 10 & 13 |

The never-brick ladder is real engineering, not marketing: dual OTA
slots, a TinyUF2 factory partition that survives every update, a
token-free USB factory reset, and a serial flasher that lives in the
chip's ROM. Physical access is the recovery tool, by design
([docs/SECURITY.md](docs/SECURITY.md)).

## Try the Console without hardware

Hosted URL: **https://devmatrix-console.vercel.app**. Until the
coordinated cutover ([docs/OPERATIONS.md](docs/OPERATIONS.md) owns the
recipe and current state) it serves the mock design reference; the
switch makes this URL serve the real, one-codebase Console. Locally:

```
make portal        # serves the mock at http://localhost:8787
```

The production Console source and committed artifacts live under
`portal/console/` (ADR-0027); deployment handoff is documented in
[portal/console/README.md](portal/console/README.md#vercel-handoff).

## How I ship it

Devmatrix is a one-person product, built in the open and shipped along
a single gate ladder — governance, hardware bring-up, contract freeze,
then the launch gates. [ROADMAP.md](ROADMAP.md) owns where each gate
stands, and the docs mark every capability **Today** (current firmware
does it, evidence filed) or **Ahead · gate X** (specified, lands at its
gate) — if you catch a claim the firmware doesn't keep, that's a bug.
Interface contracts in [contracts/](contracts/README.md) stay **DRAFT**
until the P2 freeze.

**Local Mode is the complete product, free forever — and this is your
own device.** The harness for remote reach is included: point the box
at any MQTT broker you can reach, or put the LAN behind your own VPN,
and you're running your own cloud today. The support is written down
and built in: the manual, the Console's Guide view, and diagnostics
that explain themselves. I add real support capacity, and a paid
managed Cloud Mode (remote control, fleet view, alerts), only if
demand requires it — the box never depends on either
([docs/MODES.md](docs/MODES.md)).

## The documentation

| You want to… | Read |
|---|---|
| **Use the box** — setup, Console, apps, updates, recovery | [docs/MANUAL.md](docs/MANUAL.md) |
| Understand the product & brand | [docs/VISION.md](docs/VISION.md) |
| Feel the buyer's journey (canonical example) | [docs/USER-STORY.md](docs/USER-STORY.md) |
| The Console spec — pages, features, modes | [docs/PORTAL.md](docs/PORTAL.md) |
| Local vs Cloud — what's free, what's paid, what dies | [docs/MODES.md](docs/MODES.md) |
| Threat model, keys, security ceremonies | [docs/SECURITY.md](docs/SECURITY.md) |
| Firmware architecture and flash map | [docs/FIRMWARE.md](docs/FIRMWARE.md) |
| Full DK-01 production execution blueprint | [docs/PRODUCTION-PLAN.md](docs/PRODUCTION-PLAN.md) |
| Ops — hosting, deploys, secrets | [docs/OPERATIONS.md](docs/OPERATIONS.md) |
| Draft API contracts (MQTT first) | [contracts/README.md](contracts/README.md) |
| Hardware gate evidence, procedures, manufacturing files | [hardware/README.md](hardware/README.md) |
| Why I decided X | [docs/adr/](docs/adr/) |
| What happens next, and in what order | [ROADMAP.md](ROADMAP.md) |
| Canonical names, IDs, formats | [docs/GLOSSARY.md](docs/GLOSSARY.md) |

## Licensing

First-party code — scripts, the Console prototype, and future
firmware/console/simulator — is GPL-3.0-or-later (root [LICENSE](LICENSE));
documentation is CC BY 4.0. `contracts/` and SDKs adopt Apache-2.0 with their
first code or schema artifact; hardware files adopt CERN-OHL-S-2.0. Code
samples inside docs carry their stated software license. Full scheme:
[docs/adr/ADR-0010-license-scheme.md](docs/adr/ADR-0010-license-scheme.md).

## Rules of this repo

See [CLAUDE.md](CLAUDE.md) for product boundaries and [AGENTS.md](AGENTS.md)
for the tool-neutral definition of done. The short version: one owner file
per topic, every decision lands as an ADR, `make check` is the shared gate,
the clean-room boundary is absolute, and the Console is one codebase built
to two targets (ADR-0027) — the prototype stays a single-file design
reference until `portal/console/` reaches parity. Commit, push, deploy, go live,
publish, and ship are release verbs: an affirmative request using any one runs
the complete validated commit-to-production chain defined in `AGENTS.md`.
