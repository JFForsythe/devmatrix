# Glossary — canonical names and formats

Use these exact terms everywhere (docs, UI, code, commits). Add here
first; then use.

| Term | Meaning |
|---|---|
| **Devmatrix** | The platform/product. Never "DevMatrix" or "dev matrix". |
| **DK-01** | First hardware model: ESP32-S3, 64×32 RGB matrix, 8 MB flash, 2 MB PSRAM. |
| **App slot** | One of the two 2 MB OTA partitions (`ota_0`/`ota_1`) an app image boots from; updates write to the inactive slot. |
| **MatrixPortal** | Adafruit MatrixPortal ESP32-S3 — DK-01's production-intent controller board (ADR-0012). |
| **Protomatter** | Adafruit's open HUB75 matrix driver library — the pinned display driver (ADR-0013). |
| **Console** | The portal (web app). One codebase, two connection modes. |
| **Local Console** | The complete Console bundled into and served by each device over the LAN — the authoritative copy; the hosted copy is a convenience (ADR-0025, ADR-0027). |
| **Dev console** | The Console view for API commands, developer tools, and device debugging. |
| **Device workbench** | The Console's compact four-pane developer workspace. Each pane can be profiled as a REST CLI, MQTT CLI, device-log tail, or layout/binding inspector; panes are movable, resizable, removable, restorable, and saved locally. Specified, not yet built in `portal/console/` — **Ahead · gate M2**. |
| **Command palette** | The Console's keyboard-first search-and-act surface: pages, settings, devices, apps, actions, documentation, and local log results. Specified, not yet built in `portal/console/` — **Ahead · gate M2**. |
| **Local Mode** | Console ↔ device directly over LAN. No account, no cloud. Free forever — the complete product (docs/MODES.md). |
| **Cloud Mode** | Paid subscription layer: remote access, multi-site fleet, hosted E2EE snapshots, alerts. Adds reach, never capability (docs/MODES.md). |
| **Sunset covenant** | If Cloud Mode ever ends: 12 months' notice + automatic Eject. A dead cloud costs convenience, never function. |
| **Claiming** | Binding a device to its owner via proof of physical possession; mints the LAN token in the browser — no account involved (docs/MODES.md). A passkey account and explicit subscription confirmation are separate, optional Cloud Mode steps. |
| **Claim code** | Short code shown on the panel when a browser asks to pair. Reading the panel proves physical presence. Format: six digits, e.g. `482913`, shown as two panel rows of three for browser pairing today; the device ignores any separator the owner types. The **Ahead · gate M1** first-boot claim code is `XXX-XXX`. |
| **Serial** | Device identity, printed + in cert. Format `DMX-####-####` (e.g. `DMX-4E71-0952`). |
| **LAN token** | Per-device bearer credential minted at claim; required on every `/api/v1` call on the LAN. Rotatable/revocable; read-only scoped variants for integrations. |
| **Device identity key** | Ed25519 keypair a device mints on first boot and keeps in NVS (wiped by factory reset). The device signs Console-supplied nonces with it so a browser can prove the host is the panel and not an mDNS spoofer (ADR-0031). The Console pins the public key at pairing. |
| **Key fingerprint** | Short, human-checkable form of the device identity public key: first 4 bytes of its SHA-256, shown as `XXXX-XXXX` (e.g. `6EDE-F5A0`) in the Console's Security view and on USB serial. |
| **App** | Anything an owner installs or runs to put content on the panel. Three tiers, defined below (ADR-0026). UI says "Apps". |
| **Declarative app** | An app the device runs itself: a layout, data bindings, and a schedule, installed from the Console. The device fetches its own data. Needs no second machine and no broker. Bundle: `.dmapp` (ADR-0026). |
| **Host app** | An app running on hardware the owner already operates, pushing content to the device over LAN REST or MQTT. For work the device cannot do — e.g. the Flights Overhead radar view (ADR-0026). |
| **App host** | The owner's always-on machine running host apps: Raspberry Pi, NAS, Home Assistant box, mini PC. Never company hardware (ADR-0016). |
| **Pixlet bridge** | Owner-hosted host app that renders open-source Pixlet community apps (Tronbyt-maintained fork, Apache-2.0) at 64×32 and pushes frames over the LAN API. Each owner runs their own; the company renders nothing (ADR-0030). |
| **Scripted app** | An app running as sandboxed code in an on-device VM. Deferred out of launch; additive if a runtime clears the docs/PRODUCTION-PLAN.md bar (ADR-0026). |
| **Layout** | The declarative description of what the panel shows: regions, text, glyphs, and colours, rendered by the device. |
| **Binding** | The link from a layout field to a data source (HTTPS JSON or an MQTT topic), with refresh interval and a stale indicator. |
| **Bundled apps** | Declarative apps shipped on DK-01. Today: Messages, Flights list, and Custom layout. M4 adds Weather, clock variants, and reviewed Registry apps; Stocks remains disabled until an owner supplies a provider key and accepts its terms (ADR-0015). |
| **Flights Overhead** | Bundled local-only aircraft display fed by an ADS-B receiver on the owner's LAN (open dump1090/readsb JSON). The list view is a declarative app; the 8 fps radar view is a host app and LAN-bound (ADR-0026, ADR-0029). Never a company feed or third-party flight-data service (ADR-0023). |
| **Frame layer** | Display API tier for raw 64×32 pixel frames — REST/WebSocket only, never MQTT; remote reach only via Cloud Mode's relay (ADR-0029). |
| **Semantic layer** | Display API tier for text, layouts, bindings, scenes, and brightness — available on every transport, and therefore remote-safe (ADR-0029). |
| **Registry** | Community index of apps/layouts (PR-based public repo). |
| **Channel** | Firmware release track: `stable` \| `beta` \| `dev`. |
| **Safe mode** | Minimal always-bootable firmware state: display + recovery only. |
| **Native clock** | The built-in C++ clock experience — first-boot default and the permanent safe fallback after app failure. |
| **Scene** | A scheduled display experience. Scene scheduling rotates enabled apps and always returns to the native clock. |
| **Simulator** | Contract-compatible virtual device (including the golden renderer) used for Console development, app CI, and conformance testing (ADR-0019). |
| **Golden renderer** | The simulator's reference 64×32 renderer; its golden frames are what CI compares against. |
| **Mirror** | Live view of the physical panel inside the Console. |
| **Identify** | Action that flashes the panel to locate a specific device. |
| **Snapshot** | End-to-end-encrypted backup of device config + apps. |
| **Guest access** | Scoped, expiring control grant to a non-owner. |
| **Relay** | Outbound-only encrypted tunnel device→cloud for Cloud Mode. No inbound ports. |
| **Root-of-trust enrollment** | Physical-presence ceremony adding the owner's firmware signing key. |
| **Eject** | Guided path to self-host everything and leave our cloud entirely. |
| **Quiet hours** | Scheduled dimming/off window. |
| **Gate ladder** | The single delivery sequence P0 · P1 · P2 · M0 · M1 · M2 · M3 · M4 · L0 · R0 · GA. ROADMAP.md owns the definitions; Cloud gates C0–C3 are a separate paid track (ADR-0007). |
| **EVT / DVT / PVT** | Engineering / design / production validation hardware builds, paired with gates M0, L0, and R0 (ROADMAP.md). |
