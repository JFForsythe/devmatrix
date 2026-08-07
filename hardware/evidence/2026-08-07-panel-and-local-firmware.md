# P1 evidence — panel bring-up and local feasibility firmware

**Date:** 2026-08-07 · **Gate:** P1 (continues
[the board-alone run](2026-08-07-board-alone-bringup.md)). Panel now
attached: 64×32 HUB75 driven by the MatrixPortal S3 over its direct
connector, USB-C powered, brightness software-bounded. Both firmwares
are disposable feasibility sketches (ADR-0009), kept outside the
repository; methods recorded here so the runs are repeatable.

## Panel verification (owner-observed)

The plan's bring-up ladder ran end to end: black, corner pixels,
full-frame primaries, border, 8-pixel grid, checkerboard, RGB
gradients, low-brightness white, moving lines. Owner visual check
passed: correct red/green/blue channel order, complete border with no
wrap or offset, straight grid lines with no scan folding. The panel
behaves as a true 1/16-scan 64×32.

## Refresh-rate evidence (Protomatter frame counter)

| Configuration | Refresh |
|---|---|
| Bit depth 5, display only | 168 Hz |
| Bit depth 4, Wi-Fi associated, HTTP server live | 200 Hz |

The 200 Hz production floor is met at bit depth 4 with the radio
active — the exact measurement the P2 freeze needs for the
depth-versus-refresh budget. Wi-Fi association cost ~90 KB of heap
against the board-alone baseline; steady-state free heap ~195 KB with
display + Wi-Fi + HTTP serving.

## Local feasibility firmware (clock + LAN API)

- **Provisioning:** first boot opens the `DEVMATRIX-7A08` open
  hotspot with a credential form at `192.168.4.1`; credentials go to
  device NVS at runtime and are never compiled in or logged
  (ADR-0023). Owner completed setup unassisted from a phone.
- **Clock:** SNTP over the owner's LAN, POSIX timezone, rendered at
  depth 4 with the device's mDNS name (`dmx-7a08`) on the panel.
- **API (HTTP, LAN-only):** `/api/v1/health` open;
  `/api/v1/info` and `/api/v1/display/text` require the NVS-held
  bearer token (surfaced on the owner's serial console). Verified
  live: health 200, authed info 200, wrong token 401, text push
  rendered on the panel and auto-returned to the clock.
- Signal at the bench: −42 to −47 dBm.

## Device-served Local Console v0 (same session, later flash)

The firmware now serves a real control page at `/` — status tiles
(uptime, RSSI, heap, brightness, firmware), text push, brightness
slider (10–255, NVS-persisted, applied live), identify (bordered
device-ID flash), and token rotation — vanilla single-file HTML
embedded in firmware, no external assets, token held in the browser
after one paste. This is the product architecture (the box hosts its
own Console, ADR-0003/PORTAL.md) at feasibility scale; the full
Preact Console with the claim ceremony remains M1 work. Verified
live: page served, authed info, brightness round-trip, identify.
~194 KB heap free while serving.

## Notes for P2/M0

- LAN TLS remains the open P1 design question — this run was HTTP.
- The client must send `Content-Type: application/json`; the ESP32
  WebServer consumes form-encoded bodies before the handler sees them.
- Serial ports re-enumerate across replug/bootloader transitions on
  macOS; tooling must re-discover the port rather than pin one path.

## Still open in P1

Bench-supply current measurement and 24-hour display + Wi-Fi soak,
browser transport spikes, Lua/Berry runtime spike, unassisted-user
tests ([ROADMAP.md](../../ROADMAP.md)).
