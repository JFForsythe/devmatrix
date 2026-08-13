# Firmware plan

> **Status: living tree.** The DK-01 firmware lives at
> [`firmware/dk01/`](../firmware/dk01/README.md) and develops
> continuously from P1 onward (ADR-0024, superseding ADR-0009's
> disposable-spike posture). v0.8.0 adds the optional esp-mqtt client from
> ADR-0028: NVS broker settings and authenticated REST/Console control, a
> real `DMX-####-####` serial-rooted topic tree, retained QoS 1 LWT and
> display/health state, versioned request/response envelopes with expiry
> replay rejection, and retained Home Assistant light, text, and notify
> discovery republished on birth. Its event task only fills bounded static
> buffers; command execution stays in the render loop, and ADR-0029's frame
> layer remains REST-only. The first declarative apps also run
> on the device with no host machine: offline Messages, the local-receiver
> Flights list, and a generic HTTP/HTTPS JSON custom layout with RFC 6901
> bindings, scheduled rotation, and stale-data rendering. The device serves the
> generated one-codebase Console (ADR-0027), gzip-compressed from
> PROGMEM. The plug-and-play loop includes captive-portal Wi-Fi setup
> with live join, claim-code pairing (the panel shows the code — users
> never hold a token), `/api/v1`, and browser OTA onto dual app slots
> with the TinyUF2 factory partition kept for USB recovery. It has a
> brightness ceiling and reset-reason diagnostics after a bench
> brown-out, small-font multi-line panel boards, and Flights Overhead
> companion config — receiver URL, interval, rows, format, and
> list/radar view — held in device NVS with an mDNS receiver scan, so
> the owner's receiver address exists only on their own hardware.
> API and OTA shapes stay DRAFT until the P2 freeze; M0 acceptance
> (signed OTA, verified rollback, soak) still gates sold units. No
> credentials are ever compiled in or committed — runtime NVS only
> (ADR-0023).

## Stack

Arduino CLI with a pinned arduino-esp32 3.3.x core (3.3.8 at approval;
re-pinned to the latest 3.3.x patch at the P2 freeze) and Adafruit
Protomatter 1.7.1 as the display driver — the library Adafruit
documents for the MatrixPortal S3. C++17, structured as clean
components so a pure-IDF port stays possible. ADR-0013 records this
choice and the rejection of the previously specced PlatformIO/Arduino
3.x combination and generic HUB75-DMA library, whose own README
disclaims MatrixPortal S3 with Wi-Fi and warns against Quad-SPI PSRAM
as the DMA buffer — exactly DK-01's configuration.

## Module map

Target shape. Today's tree is deliberately one readable sketch plus two
embedded pages (see [firmware/dk01/README.md](../firmware/dk01/README.md));
modules split out along these lines as they grow.

```
firmware/
  core/      boot, settings store (NVS), logging, safe-mode
  display/   Protomatter glue, framebuffer, compositor, gamma, BDF fonts
  net/       WiFi mgr, mDNS, SNTP, Improv-WiFi serial + SoftAP fallback
  api/       REST /api/v1, WebSocket stream, OpenAPI spec
  mqtt/      client, topic tree per contracts/mqtt.md, HA discovery
  scenes/    built-ins (clock, ambient, info, notification overlay)
  layout/    JSON widget engine + data binding
  apps/      declarative app engine: layout render, bindings, schedule
  ota/       manifest poll, signed update, rollback, channels
  webui/     setup shell + compressed full Local Console static bundle
```

## Hardware budget (DK-01: 8 MB flash, 2 MB PSRAM)

Dual app slots (2 MB each, `ota_0`/`ota_1`) + a 256 KB TinyUF2 factory
partition for USB recovery + a 3.7 MB `ffat` data partition reserved for
future assets and apps. Framebuffers in PSRAM; DMA descriptors in
internal RAM. v0.8.0 measures 1,336,915 B flash (63 % of a slot) and
120,396 B static RAM
([evidence](../hardware/evidence/2026-08-12-console-parity-verification.md)).
A CI slot-occupancy and heap-headroom gate is **Ahead · gate P2**. The
Local Console is not a filesystem asset: it is a gzipped PROGMEM bundle
compiled into the app image (ADR-0027).

## API surface (DRAFT — freeze at P2)

The contracts are owned by [contracts/README.md](../contracts/README.md)
and [contracts/mqtt.md](../contracts/mqtt.md) (ADR-0019) and stay DRAFT
until the P2 freeze. The sketch below is illustrative:

- REST `/api/v1`: info, settings, metrics, `display/text`,
  `display/frame`, `display/layout`, `notify`, scenes, screenshot.
  Frames are 4,096 bytes (64×32 RGB565 little-endian) on the wire;
  ADR-0029's bandwidth argument used an RGB888 figure and its
  conclusion is unchanged.
- WebSocket `/api/v1/stream`: binary frames in (20+ fps at 64×32),
  events out.
- MQTT: `devmatrix/<serial>/...` command/state/availability
  (contracts/mqtt.md); today's HA MQTT Discovery announces light,
  text, and notify entities with zero YAML. The DRAFT contract's scene
  entity remains a P2 compatibility item because HA scene payloads do not
  provide a command-template hook for fresh envelope timestamps/expiry.
- Auth: every `/api/v1` route requires the LAN token (Bearer) on a
  plain-HTTP LAN origin (ADR-0031 — no certificate is ever on the
  device's critical path); mutating routes validate Host/Origin, and the
  device proves itself by signing a Console-supplied nonce with its
  device key. Ceremony + transport live in SECURITY.md → Discovery &
  local transport.

## App tiers (ADR-0026)

The split is decided; docs/GLOSSARY.md owns the terms and this is the
owner description of what the firmware implements. Other documents
link here.

- **Declarative apps** run on the device: a layout, data bindings, and
  a schedule. The firmware owns the layout renderer, the binding engine
  (HTTPS JSON or MQTT topic, refresh interval, stale indicator), and
  per-app config in NVS. Needs no second machine and no broker. The
  device already fetches and validates external JSON today, so this
  extends a proven path rather than opening a new one.
- **Host apps** run on the owner's own always-on machine and push
  content in over LAN REST or MQTT. The device's job is to accept them
  on an authenticated, documented contract — nothing more. This tier
  includes ecosystem bridges like the Pixlet bridge (ADR-0030), which
  the owner hosts themselves.
- **Scripted apps** — an on-device sandboxed VM, Lua 5.4 or Berry — are
  **deferred**, and the two-week spike is out of P1. If a runtime later
  clears the docs/PRODUCTION-PLAN.md bar (PSRAM-resident VM, per-tick
  instruction budget, sandboxed API, watchdog kill on abuse, and a
  stated per-app quota floor), it is additive, not a re-plan.

Frames ride REST/WebSocket only — never MQTT, with Cloud Mode's paid
relay as the only remote path; the semantic layer — text, layouts,
bindings, scenes, brightness — is available on every transport and is
what a broker-hosted app targets (ADR-0029).

## Risks

- Display driver: Protomatter is pinned (1.7.1) and tracked upstream;
  fixes go upstream, never into a silent fork (ADR-0013).
- Board-level Wi-Fi/EMI: open reports exist against Protomatter on
  MatrixPortal S3, so the library choice does not retire the risk.
  P1's pre-registered measurement (200 Hz refresh floor, 24-hour
  display + Wi-Fi soak with active TLS) is the evidence gate.
- Support load: docs first; the simulator deflects "is it my code?".
- Cannibalization: deliberate and bounded (ADR-0023) — a canvas
  platform with a tiny local-only flight display; the closed products
  keep the turnkey content experience, and no closed-product code,
  logic, or schemas ever cross the boundary.
