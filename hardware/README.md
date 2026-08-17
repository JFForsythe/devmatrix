# hardware/ — manufacturing files, fixtures, gate evidence

Truth-map owner (CLAUDE.md) for the physical product's artifacts.
Three content classes live here as they come into existence:

- [evidence/](evidence/) — dated, immutable records of on-hardware
  verification runs. Each states exact hardware, firmware
  commit/version, method, observed results, and what it does **not**
  prove. This is the only class with content today.
- [procedures/](procedures/) — run lists and test procedures that
  produce evidence. Currently: [bench-week.md](procedures/bench-week.md),
  the queued P1/M0 hardware-evidence runs.
- Manufacturing files — BOM, panel profiles, enclosure, harness,
  fixtures, per-unit provisioning records. **None exist yet**; they
  arrive with the M0/L0/R0 gates (docs/PRODUCTION-PLAN.md §3).

Evidence index (newest first):

| Date | File | What it proves |
|---|---|---|
| 2026-08-17 | [pixlet-bridge-live-proof](evidence/2026-08-17-pixlet-bridge-live-proof.md) | ADR-0030 end-to-end on hardware: Tronbyt Pixlet v0.53.1 → 150 coalesced frames → authenticated frame API → panel; catalog measured at 1,045 apps |
| 2026-08-16 | [v0120-ota-and-hardening-verification](evidence/2026-08-16-v0120-ota-and-hardening-verification.md) | On-hardware OTA v0.11.0→v0.12.0 (slot swap, config survival); all v0.12.0 hardening behaviors live; Ed25519 firmware↔noble interop closed; token-format rotation; **199 Hz refresh flag opened** |
| 2026-08-13 | [hosted-connect-verification](evidence/2026-08-13-hosted-connect-verification.md) | Hosted welcome/connect + Ed25519 identity flow vs a protocol-exact mock (16 checks); hardware acceptance open |
| 2026-08-12 | [console-parity-verification](evidence/2026-08-12-console-parity-verification.md) | One-codebase Console: deterministic build, self-contained device bundle, all views render |
| 2026-08-12 | [browser-transport-spike](evidence/2026-08-12-browser-transport-spike.md) | Desk research behind ADR-0031's plain-HTTP decision; four experiments left open |
| 2026-08-07 | [integrated-firmware-ota](evidence/2026-08-07-integrated-firmware-ota.md) | v0.2.0→v0.4.0 on hardware: dual-slot OTA swaps, brightness clamp, reset-reason |
| 2026-08-07 | [panel-and-local-firmware](evidence/2026-08-07-panel-and-local-firmware.md) | First pixel and full pattern ladder on the real panel; 200 Hz floor |
| 2026-08-07 | [board-alone-bringup](evidence/2026-08-07-board-alone-bringup.md) | MatrixPortal S3 alone: toolchain, memory watermarks |
