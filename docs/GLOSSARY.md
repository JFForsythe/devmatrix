# Glossary — canonical names and formats

Use these exact terms everywhere (docs, UI, code, commits). Add here
first; then use.

| Term | Meaning |
|---|---|
| **Devmatrix** | The platform/product. Never "DevMatrix" or "dev matrix". |
| **DK-01** | First hardware model: ESP32-S3, 64×32 RGB matrix, 8 MB flash, 2 MB PSRAM. |
| **MatrixPortal** | Adafruit MatrixPortal ESP32-S3 — DK-01's production-intent controller board (ADR-0012). |
| **Protomatter** | Adafruit's open HUB75 matrix driver library — the pinned display driver (ADR-0013). |
| **Console** | The portal (web app). One codebase, two connection modes. |
| **Device workbench** | The Console's compact four-pane developer workspace. Each pane can be profiled as a REST CLI, MQTT CLI, device-log tail, or app-runtime REPL; panes are movable, resizable, removable, restorable, and saved locally. The prototype is mock-only. |
| **Command palette** | The Console's keyboard-first search-and-act surface: pages, settings, devices, apps, actions, documentation, and local log results. |
| **Local Mode** | Console ↔ device directly over LAN. No account, no cloud. Free forever — the complete product (docs/MODES.md). |
| **Cloud Mode** | Paid subscription layer: remote access, multi-site fleet, hosted E2EE snapshots, alerts. Adds reach, never capability (docs/MODES.md). |
| **Sunset covenant** | If Cloud Mode ever ends: 12 months' notice + automatic Eject. A dead cloud costs convenience, never function. |
| **Claiming** | Binding a device to its owner via proof of physical possession; mints the LAN token in the browser — no account involved (docs/MODES.md). A passkey account and explicit subscription confirmation are separate, optional Cloud Mode steps. |
| **Claim code** | Short code shown on the panel at first boot. Format `XXX-XXX`. |
| **Serial** | Device identity, printed + in cert. Format `DMX-####-####` (e.g. `DMX-4E71-0952`). |
| **LAN token** | Per-device bearer credential minted at claim; required on every `/api/v1` call on the LAN. Rotatable/revocable; read-only scoped variants for integrations. |
| **App** | User code running on the device (sandboxed runtime). Bundle: `.dmapp`. UI says "Apps"; the firmware subsystem is the "app runtime". |
| **Preloaded apps** | Starter apps shipped installed on DK-01, removable like any app: Weather, Messages, Flights Overhead; Stocks ships disabled pending an owner key (ADR-0015). |
| **Flights Overhead** | Preloaded app: a small local-only aircraft display fed by an ADS-B receiver on the owner's LAN (open dump1090/readsb JSON). Never a company feed or third-party flight-data service (ADR-0023). |
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
