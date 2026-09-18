# Firmware architecture

**Today:** the living DK-01 tree is firmware v0.12.6 in
[`firmware/dk01/`](../firmware/dk01/README.md). It is a development firmware
with working Local Console, LAN API, built-in declarative apps, and an
optional MQTT client. Contracts remain drafts. Signed OTA, measured rollback,
and the remaining release gates are not implied by that feature list;
[ROADMAP.md](../ROADMAP.md) owns acceptance.

Use [the owner manual](MANUAL.md) to set up or recover a display. Use the
[firmware README](../firmware/dk01/README.md) to build and flash it, and
[contracts/](../contracts/README.md) to write integrations. This document owns
the architecture and resource budget. [SECURITY.md](SECURITY.md) owns the
trust model and its current limitations.

## Stack

Current CI and the installed review toolchain use arduino-esp32 **3.3.11**,
Adafruit Protomatter **1.7.1**, ArduinoJson **7.4.3**, and Crypto **0.4.0**.
See [.github/workflows/ci.yml](../.github/workflows/ci.yml) for the
executable build setup. The firmware uses Arduino APIs and the core's
vendored esp-mqtt client (ADR-0028); Protomatter drives the MatrixPortal S3.

**Decision-record discrepancy:** [ADR-0013](adr/ADR-0013-arduino-cli-protomatter-toolchain.md)
records 3.3.8 until a P2 re-pin. The current CI uses 3.3.11. Following CI
reproduces the current build, but does not reconcile that accepted decision.
A new ADR must explicitly refine the pin before calling the records aligned;
this documentation review does not silently amend an accepted ADR.

## Current files and responsibilities

| File | Responsibility |
|---|---|
| [`dk01.ino`](../firmware/dk01/dk01.ino) | Hardware setup, settings, Wi-Fi state machine, scene selection, REST, pairing, identity, OTA |
| [`apps_engine.h`](../firmware/dk01/apps_engine.h) | Shared fetch buffer, bounded JSON spans and pointers, row rendering, stale-data indicator |
| [`apps_builtin.h`](../firmware/dk01/apps_builtin.h) | Messages, Flights list, Custom layout, app settings and refresh scheduling |
| [`mqtt_client.h`](../firmware/dk01/mqtt_client.h) | Broker connection, bounded inbound queue, request envelopes, state and Home Assistant discovery |
| [`web_setup.h`](../firmware/dk01/web_setup.h) | Captive-portal Wi-Fi setup page |
| [`web_console.h`](../firmware/dk01/web_console.h) | Generated, gzipped Console bundle compiled into flash; never hand-edited |

The Console has one source tree at `portal/console/` and two build targets
(ADR-0027). The generated device header is committed so firmware forks do not
need Node unless they change the Console. The server sends that byte array
with `Content-Encoding: gzip`; the hosted bundle is a separate generated
artifact. The local rebuild-and-diff gate is `make console-verify`.

## Boot and main loop

1. Derive the serial, hotspot name, and mDNS name from the board identity.
   Initialize Protomatter; a driver failure logs and restarts after 10 seconds.
2. Load runtime settings from the `dk01` NVS namespace and allocate the shared
   fetch buffer. Start Wi-Fi before minting a missing LAN token or identity key.
3. With no saved Wi-Fi, open setup mode. With saved Wi-Fi, try joining for
   25 seconds, then fall back to the setup hotspot if unsuccessful. Setup
   retries saved credentials in the background. Its exposure is explained in
   [SECURITY.md](SECURITY.md#discovery-and-local-transport).
4. After a normal Wi-Fi join, start SNTP, the mDNS responder, HTTP, and optional
   MQTT. The setup guide remains on the panel until the first authenticated
   request or successful pairing; the `seen` NVS flag makes this persistent.
5. `loop()` services HTTP, setup joining, app refreshes, rendering, MQTT, and
   periodic diagnostics. The MQTT event task queues bounded messages; device
   mutations run in `loop()`.

**Clock dependency today:** SNTP uses the built-in `pool.ntp.org` and
`time.nist.gov` addresses. There is no owner-configurable LAN time server or
manual time-setting route. After a cold boot without time synchronization,
the native clock shows `--:--`; Messages, static layouts and host-pushed
content can still operate locally. Company-independent operation does not
yet mean an accurate clock without an external time source.

**Timing limit today:** app HTTP fetches are synchronous in the main loop.
The 1.2-second receive timeout measures an idle gap, not the whole request.
A slow source can delay rendering, REST handling, MQTT commands, and frame
lease expiry. Hard request deadlines and cooperative fetch scheduling remain
open defects, recorded in the
[firmware review](reviews/2026-09-08-full-review/firmware-and-contracts.md).

## Display and apps

The normal rotation always includes a ten-second native-clock slot and
skips disabled apps. Pairing and identify temporarily take priority; text
is an overlay. A host frame can persist until clear or request a short lease
that returns to rotation if the host stops refreshing it. Exact precedence,
request ranges, and wire format belong to
[the REST contract](../contracts/rest.md).

- **Messages:** offline phrase pack, enabled by default. Owners can replace
  the setup tips. Message selection cadence and scene duration are separate.
- **Flights list:** fetches the owner's configured receiver URL and renders
  up to five rows. It examines the first 256 aircraft, filters usable entries,
  and prefers proximity when receiver coordinates exist; otherwise it keeps
  feed order. Radar rendering is a host app.
- **Custom layout:** one replaceable layout with up to five rows, literal
  text or HTTP/HTTPS JSON Pointer bindings. It keeps usable previous data on
  refresh failure and marks stale frames. The complete shape is owned by
  [layout.md](../contracts/layout.md).

MQTT currently implements text, brightness, clear, and bundled-app selection.
It does not yet install layouts or supply MQTT binding sources. Frames use
LAN REST today; WebSocket streaming and any Cloud relay remain planned.
[ADR-0029](adr/ADR-0029-layered-display-api.md) defines the intended transport
split without making those future endpoints available now.

The three app tiers remain the accepted direction (ADR-0026): declarative
apps on the device, host apps on the owner's always-on machine, and a deferred
scripted VM. `.dmapp` installation, Registry permissions and quotas are M4
work, not properties of the current custom-layout form.

## Hardware budget (DK-01: 8 MB flash, 2 MB PSRAM)

Dual app slots (2 MB each, `ota_0`/`ota_1`) + a 256 KB TinyUF2 factory
partition for USB recovery + a 3.7 MB `ffat` data partition reserved for
future assets and apps. The app-fetch buffer uses PSRAM when available, with
an internal-heap fallback. The REST frame buffer and decode staging buffer are static arrays;
do not count them as PSRAM allocations. Driver buffers need separate runtime
measurement.

The exact flash map is the pinned board package's **TinyUF2 8MB**
partition scheme, defined by the board package's
`tinyuf2-partitions-8MB.csv`. Build outputs are not tracked source; verify the
generated `partitions.csv` before a recovery erase or a release:

| Offset | Size | Partition |
|---|---|---|
| `0x9000` | 20 KB | `nvs` — every runtime setting and secret: Wi-Fi credentials, LAN token, device identity key, timezone, MQTT settings, app config, setup-guide flag. Blank NVS **is** the out-of-box state — the token-free USB factory reset in [docs/MANUAL.md](MANUAL.md) ch. 10 erases exactly this region |
| `0xe000` | 8 KB | `otadata` — which app slot boots |
| `0x10000` | 2 MB | `ota_0` — app slot |
| `0x210000` | 2 MB | `ota_1` — app slot |
| `0x410000` | 256 KB | `uf2` — TinyUF2 factory partition (double-press-reset USB recovery) |
| `0x450000` | 3,776 KB | `ffat` — reserved data partition |

A cable upload writes more than the app: the board package's upload
recipe also re-writes the TinyUF2 image at `0x410000` and the
bootloader/partition table, so a full-chip erase followed by one
`arduino-cli upload` restores everything, USB recovery included
([docs/MANUAL.md](MANUAL.md) ch. 10 → Back to default walks the owner
path). The previous recorded v0.12.6 build measured 1,370,139 B of flash and
116,708 B of static RAM. Treat recorded footprints as toolchain-specific;
the current review's fresh build result and exact versions are in the
[firmware review](reviews/2026-09-08-full-review/firmware-and-contracts.md#validation).
A CI slot-occupancy and heap-headroom gate is **Ahead · gate P2**. The
Local Console is not a filesystem asset: it is a gzipped PROGMEM bundle
compiled into the app image (ADR-0027).

## Interface status

[contracts/README.md](../contracts/README.md) is the single directory for
public interfaces. Its prose drafts cover today's REST, MQTT, layouts, and
OTA upload. The P2 freeze must produce machine-readable schemas and generated
client drift checks. `/api/v1/stream`, screenshot, metrics, generic scene
management, transport capability descriptors, and manifest OTA are still
planned; no illustrative endpoint here is a working API promise.

## Growth boundaries and release evidence

The current sketch can split into boot/settings, display, networking, API,
MQTT, app scheduling, OTA, and web-bundle modules when that makes changes
safer. A directory diagram is not evidence those modules exist. The next
priority is testable parser, scheduler, and transport boundaries with device
acceptance, rather than a broad rearrangement of working code.

[The current source review](reviews/2026-09-08-full-review/firmware-and-contracts.md)
records concrete correctness and security defects. [ROADMAP.md](../ROADMAP.md)
owns the release gates; [hardware/](../hardware/README.md) owns measured
refresh, power, Wi-Fi, rollback, USB recovery and soak evidence. Compile and
host checks do not replace those measurements. Clean-room constraints remain
as defined by [AGENTS.md](../AGENTS.md) and ADR-0023.
