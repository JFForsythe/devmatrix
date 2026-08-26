# Firmware plan

> **Status: living tree.** The DK-01 firmware lives at
> [`firmware/dk01/`](../firmware/dk01/README.md) and develops
> continuously from P1 onward (ADR-0024, superseding ADR-0009's
> disposable-spike posture). v0.12.6 is a pre-ship correctness pass:
> the Console's Welcome screen taught the wrong example address
> (`dmx-4e71.local` — built from the serial's *first* group, when the
> mDNS name actually comes from the *last* group: `dmx-0952.local`
> for `DMX-4E71-0952`), and the demo fleet's mock firmware version
> catches up to the shipped release.
> v0.12.5 closes the last gap in the
> on-panel setup walkthrough: after joining Wi-Fi the panel no longer
> drops straight to the clock — it shows a final setup card
> (`WIFI CONNECTED / LAST STEP: OPEN / DMX-XXXX.LOCAL / IN YOUR
> BROWSER`) until the Console first reaches the device (an
> authenticated request or a finished claim pairing), then retires it
> for good via an NVS flag. Factory reset re-arms the card; devices
> that already have MQTT configured (only possible from the Console)
> skip it on upgrade. `/api/v1/info` reports `"scene":"guide"` while
> the card shows. The same pass makes every status card ALL CAPS
> (TomThumb's 3×5 lowercase was barely legible on the panel) and
> replaces the Messages app's default slogans with practical tips —
> the device's own Console address, how to pair another browser, where
> to edit the tips, and the MQTT/Home Assistant pointer.
> v0.12.4 is a Console-only rebuild from
> the first customer-shipment bench night: the Apps-page Pixlet card
> becomes a numbered five-step walkthrough (install once, open Pixlet
> Easy Mode, pair by panel code, add apps, install the service) instead
> of a command dump, and the pairing dialog now recovers from an
> identity-key mismatch inline — FORGET OLD KEY & SHOW A NEW CODE —
> because the modal dialog made the old "forget under Settings" advice
> unreachable, especially on phones; device logic is unchanged from
> v0.12.3. v0.12.3 adds an optional host-frame
> lease: `POST /api/v1/display/frame` takes `lease_ms` (0 or
> 250–30,000; omitted or 0 keeps the persistent behavior), every frame
> renews it, and on expiry the panel returns to its own clock/rotation
> — a host app that dies or loses power can no longer freeze the
> display on its last frame. `display/clear` and the MQTT clear drop
> the lease too, and the bundled bridge and flights hosts now hold
> short renewed leases (sized to outlive their own frame delays, 10–30 s). v0.12.2 moves the four-line status cards to the compact
> TomThumb 3×5 font after the MatrixPortal intake photograph showed
> the classic 6 px font clipping 16-character names like
> `DEVMATRIX-FFFF` on the 64 px panel
> ([intake evidence](../hardware/evidence/2026-08-24-mp-qual-01-production-intake.md)).
> v0.12.1 is a Console-only rebuild: the
> Apps page's Pixlet card now copies the one-command host setup
> (`examples/setup-pixlet.mjs` — sha256-pinned engine download,
> catalog clone, starter config, panel preflight) with the panel's own
> address filled in; device logic is unchanged from v0.12.0.
> v0.12.0 is the hardening pass from the
> 2026-08-16 production-readiness review: the LAN token gains the
> `dmx_lan_` prefix (instantly recognizable to secret scanners; older
> bare-hex tokens stay valid), token and identity-key minting move
> after the Wi-Fi driver starts so `esp_random` is hardware-strong,
> JSON bodies are bounded at 8 KB (413), the open setup window
> auto-closes 90 s after a successful join if Finish is never tapped,
> re-requesting an active claim code no longer extends its life, OTA
> images mark themselves valid on 30 s of stable uptime instead of
> Wi-Fi join (a router outage can no longer roll back a healthy
> image), the flights list builds in one pass (the per-row rescan
> could stall rendering on a real 35 KB feed), brightness NVS writes
> are debounced, a display-driver init failure reports and retries
> instead of hanging silently forever, `/api/v1/info` gains `serial`,
> and the token leaves the periodic serial stat line (boot-time reveal
> only). The Console side adds request/upload timeouts, a CSP, honest
> first-use-pinning wording, and a sterner legacy-firmware warning.
> v0.11.0 removes the receiver scan entirely
> (ADR-0032): the device never initiates a connection to an address the
> owner didn't configure — receiver discovery becomes an owner-side
> finder prompt in the Console. v0.10.0 fixes the app-fetch ceiling that made
> real feeds silently fall back to the clock: the shared fetch buffer moves
> from a 4 KiB internal-SRAM array to a 64 KiB PSRAM allocation (measured
> need: a busy-airspace `aircraft.json` at 35 KB, an NWS observation at
> 5 KB), and every fetch outcome is recorded per app and served by the new
> authenticated `GET /api/v1/apps/diag` — attempts, last HTTP code, bytes,
> and a one-word verdict (`ok`, `too-big`, `bad-json`, `no-url`,
> `no-aircraft`, `bind-miss`, `connect-failed`, `http-<code>`) — so a
> blank app explains itself. The
> `examples/dmx-top.mjs` terminal panel front-ends it.
> v0.9.1–v0.9.2 rebuild the embedded Console
> with the Apps-page onboarding — the on-the-panel-now rotation card, the
> one-button first-app walkthrough leading the Messages card, the
> ADR-0015 NWS weather template leading the Custom-layout card, and the
> Pixlet-bridge card — and harden `authed()` to a constant-time compare;
> device logic is otherwise unchanged from v0.9.0, which implements ADR-0031's application-layer
> device authentication: an Ed25519 identity key minted on first boot
> (NVS, wiped by factory reset), open `GET /api/v1/identity` and
> `POST /api/v1/identity/verify` (signs `"dmx-id-v1:<serial>:" + nonce`),
> the key riding along on claim-finish and setup-join responses so the
> Console pins it at the possession-proof moment, an exact-origin CORS
> allowlist admitting only the hosted Console (never `*`, preflight
> included), and a Host-header allowlist rejecting DNS-rebinding
> requests. v0.8.0 adds the optional esp-mqtt client from
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
> list/radar view — held in device NVS, so the owner's receiver address
> exists only on their own hardware (the v0.8.0-era mDNS receiver scan
> was removed by v0.11.0 / ADR-0032).
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
  net/       WiFi mgr, mDNS responder, SNTP, Improv-WiFi serial + SoftAP fallback
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
internal RAM.

The exact flash map is the pinned board package's **TinyUF2 8MB**
partition scheme — the committed build's `partitions.csv` matches the
core's `tinyuf2-partitions-8MB.csv` byte for byte:

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
path). v0.12.6 measures 1,370,139 B flash (65 % of a slot) and
116,708 B static RAM (the app fetch buffer lives in PSRAM) — a
byte-identical footprint to v0.12.5, the console bundle's 5 B growth
vanishing into section alignment;
v0.12.5 measured 1,370,139 B / 116,708 B;
v0.12.4 measured 1,369,359 B / 116,708 B;
v0.12.3 measured 1,368,959 B / 116,708 B;
v0.12.2 measured 1,367,939 B / 116,708 B
([intake evidence](../hardware/evidence/2026-08-24-mp-qual-01-production-intake.md));
v0.12.1 measured 1,367,919 B / 116,708 B;
v0.12.0 measured 1,367,855 B / 116,708 B;
v0.11.0 measured 1,366,075 B / 116,692 B;
v0.8.0 measured 1,336,915 B / 120,396 B
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
