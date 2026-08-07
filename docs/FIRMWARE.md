# Firmware plan

> **Status: not started.** Production firmware begins at M0, after the
> P2 contract and security freeze (ADR-0009 gate ladder; ROADMAP.md).
> P1 may produce disposable feasibility firmware only — bring-up
> sketches that gather evidence and are thrown away, never merged as
> product code. Console-first ordering per ADR-0002.

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

```
firmware/
  core/      boot, settings store (NVS), logging, safe-mode
  display/   Protomatter glue, framebuffer, compositor, gamma, BDF fonts
  net/       WiFi mgr, mDNS, SNTP, Improv-WiFi serial + SoftAP fallback
  api/       REST /api/v1, WebSocket stream, OpenAPI spec
  mqtt/      client, topic tree per contracts/mqtt.md, HA discovery
  scenes/    built-ins (clock, ambient, info, notification overlay)
  layout/    JSON widget engine + data binding
  apps/      sandboxed app runtime (spike: Lua 5.4 vs Berry)
  ota/       manifest poll, signed update, rollback, channels
  webui/     setup shell + compressed full Local Console static bundle
```

## Hardware budget (DK-01: 8 MB flash, 2 MB PSRAM)

Dual app slots (~2.5 MB each) + LittleFS (~2.5 MB) for assets and apps.
Framebuffers in PSRAM; DMA descriptors in internal RAM. CI fails if an
app slot passes 85 % or boot heap headroom drops below the floor.
The Local Console bundle is a versioned, cacheable LittleFS asset and
must fit inside that budget alongside owner apps; P1 measures its
compressed size and update behavior rather than assuming it fits.
These numbers were set under the previous stack; P2 re-measures slot
sizing and heap budgets under the Arduino-CLI/Protomatter build
(ADR-0013).

## API surface (DRAFT — freeze at P2)

The contracts are owned by [contracts/README.md](../contracts/README.md)
and [contracts/mqtt.md](../contracts/mqtt.md) (ADR-0019) and stay DRAFT
until the P2 freeze. The sketch below is illustrative:

- REST `/api/v1`: info, settings, metrics, `display/text`,
  `display/frame`, `display/layout`, `notify`, scenes, screenshot.
- WebSocket `/api/v1/stream`: binary frames in (20+ fps at 64×32),
  events out.
- MQTT: `devmatrix/<serial>/...` command/state/availability
  (contracts/mqtt.md); HA MQTT Discovery announces
  light/scene/notify/text entities with zero YAML.
- Auth: every `/api/v1` route requires the LAN token (Bearer) over TLS;
  mutating routes validate Host/Origin. Ceremony + transport live in
  SECURITY.md → Discovery & local transport.

## App runtime spike (gates Tier 2 promises)

Two weeks, Lua 5.4 vs Berry, against real constraints: PSRAM-resident
VM, cooperative scheduler with per-tick instruction budget, sandboxed
API (draw*, timer, bounded http_get, mqtt subscribe, kv store), watchdog
kill on abuse. If neither is robust on 2 MB PSRAM, the on-device
scripting promise is removed before launch and Tier 2 demotes to
layouts plus external JSON/MQTT rendering — for example a companion
container pushing frames — and the docs say so honestly. This is the
owner description of that fallback; other documents link here.

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
