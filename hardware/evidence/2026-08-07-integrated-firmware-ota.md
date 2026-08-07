# Evidence — integrated firmware v0.2.0 flash and first OTA

**Date:** 2026-08-07 · **Follows:**
[panel + local firmware](2026-08-07-panel-and-local-firmware.md) ·
**Firmware:** [`firmware/dk01/`](../../firmware/dk01/README.md) v0.2.0
(ADR-0024 — the living tree replaces disposable spikes)

## What ran

The dev unit (MatrixPortal S3 + 64×32 panel) was flashed once over USB
with the in-repo firmware, then updated **over the air** from its own
`/update` endpoint. Both boots verified live on the LAN.

## USB flash → first boot (slot ota_0)

- `arduino-cli upload` with the tinyuf2 dual-OTA partition scheme
  (ota_0/ota_1 2 MB each + TinyUF2 factory app at 0x410000 for USB
  recovery). Image: 1,107,952 bytes — 52 % of a slot.
- NVS survived the flash: the device rejoined the owner's Wi-Fi and kept
  its LAN token and brightness with no re-provisioning.
- Verified live: `/api/v1/health` → `fw 0.2.0, mode run`; authed
  `/api/v1/info` → **200 Hz refresh** (production floor holds on the
  integrated build), 184 KB free heap, −39 dBm; Console page served
  from the device; wrong token → 401; text push rendered on the panel.

## First OTA (slot ota_0 → ota_1)

- The same binary POSTed to `/update` (Bearer-authed multipart):
  accepted in ~5 s, device rebooted, and `/api/v1/info` reported
  **`slot: ota_1`** with all services healthy 6 s after boot.
- `esp_ota_mark_app_valid_cancel_rollback()` runs after a successful
  boot + Wi-Fi join; verified-rollback and signed images remain M0 gate
  work. Until then, TinyUF2 USB drag-and-drop is the recovery path.

## Second OTA (v0.3.0, slot ota_1 → ota_0) — claim-code pairing

- v0.3.0 (claim-code pairing per GLOSSARY "Claim code": panel shows a
  6-digit code, typing it in the Console earns the LAN token; the
  setup page no longer asks anyone to save a token) was delivered
  **over the air** to the unit while it ran v0.2.0 on ota_1. It booted
  back onto **ota_0** — both slots now exercised by real OTA updates.
- Verified live: `claim/finish` with no active code → 410;
  `claim/start` → 200 and the code rendered on the panel;
  wrong code → 403 with `attempts_left` decrementing. Codes expire
  after 5 minutes; 5 misses invalidate the code.
- Pairing UI verified in-browser against a mocked device (stale token
  → 401 → pair banner → code entry → token stored → Console live).
  The panel-read happy path on real hardware is owner-verifiable at
  the bench.

## Brownout at high brightness (owner-observed) — and the fix (v0.4.0)

- With the brightness ceiling raised to 255 in v0.2/v0.3, interactive
  use at high slider values produced a spontaneous reboot on USB-C
  power — consistent with the ESP32 brownout detector tripping under
  panel load. The earlier spike had implicitly prevented this by
  capping all colors at 110/255; raising the ceiling reintroduced the
  risk.
- v0.4.0 (delivered OTA, third slot swap, ota_0 → ota_1): brightness
  hard-capped at 150 for the USB power budget (API rejects higher,
  stored values clamp at boot — a stored 160 was observed clamping to
  150), and `/api/v1/info` now reports `reset_reason`
  (power-on/software/crash/watchdog/brownout), which the Console
  surfaces as a dashboard alert with a plain-language explanation.
  The M0 bench-supply current measurement will set the real budget;
  150 is the interim bound.

## Not yet re-verified on-device in this build

- The captive-portal setup flow (scan → live join → token reveal) was
  verified in a desktop browser against a mocked device API, not on the
  hotspot — the bench unit kept its stored credentials through the
  flash, so setup mode never ran. First unassisted phone run is open
  P1 work alongside the soak and current measurement.
- macOS quirk for tooling: `ping` resolves `dmx-7a08.local` while curl's
  resolver may time out — scripts should fall back to the IP from the
  serial stat line or mDNS browse rather than trusting `.local` in curl.
