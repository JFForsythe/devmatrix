# 2026-08-26 — R0 first-ship bench: v0.12.6 flash, USB-recovery drill, factory wipe

**Hardware:** Adafruit MatrixPortal S3 + 64×32 HUB75 panel — production-path
unit, serial `DMX-E28E-A334` (identifiers deliberately recorded; this unit
ships tonight only if every step below passed).
**Firmware:** v0.12.6, built from commit `cfc4da5a` on the bench Mac
(`arduino-cli compile`, FQBN `esp32:esp32:adafruit_matrixportal_esp32s3`,
core esp32 3.3.11; sketch 1,370,139 B / 116,708 B static RAM — see
docs/FIRMWARE.md ledger).
**Method:** owner at the bench with the panel; agent driving flash, LAN
checks, and the NVS wipe over USB/LAN from the same machine.

## What was done and observed

1. **Cable flash of v0.12.6** via
   `arduino-cli upload --input-dir firmware/dk01/out` on
   `/dev/cu.usbmodem14401`: every region hash-verified by esptool,
   including the TinyUF2 image written at `0x410000`
   (206,224 B) and the bootloader/partition table — the full
   back-to-default recipe docs/FIRMWARE.md describes.
2. **Boot + LAN verification:** unit re-joined Wi-Fi from prior bench
   NVS (run mode), serial stat line
   `refresh_hz=199 heap_free=158328 rssi=-43 ip=10.0.0.166`;
   `GET /api/v1/health` returned
   `{"ok":true,"device":"DMX-E28E-A334","fw":"0.12.6","mode":"run"}`.
3. **USB-recovery drill — PASSED (first pass on a production-path
   board).** Owner double-tapped reset; the `MATRXS3BOOT` UF2 drive
   mounted on macOS within the watch window. This closes the
   "USB recovery not passed" flag opened by
   [2026-08-24-mp-qual-01-production-intake](2026-08-24-mp-qual-01-production-intake.md).
   A single reset tap exits the bootloader back into the flashed
   firmware.
4. **Loaded refresh:** 199 Hz with Wi-Fi + HTTP live — matching
   MP-QUAL-01's reading on its unit. Two production-path boards now
   measure 199 Hz against the 200 Hz floor in
   docs/PRODUCTION-PLAN.md §3; the gate number needs an owner
   decision (amend to measured reality or tune the firmware), not
   silence.
5. **Factory wipe (no-traces rule, ADR-0023) — DONE.**
   `python3 -m esptool --port /dev/cu.usbmodem14401 erase-region
   0x9000 0x5000` (esptool v5.2.0): region erased in 0.3 s, hard
   reset. Post-wipe the prior LAN address stopped answering and the
   stat line read `refresh_hz=200 heap_free=160872 rssi=0 ip=0.0.0.0`
   — no Wi-Fi, no token, setup mode. Bench note: the first esptool
   attempt died mid-connect ("Device not configured") — the S3 port
   re-enumerates entering download mode; re-glob the port and retry.
   Refresh nuance for the §3 gate: 200 Hz idle (no Wi-Fi
   association), 199 Hz with Wi-Fi + HTTP live — the deficit is
   Wi-Fi-load-specific, on both boards measured so far.
6. **Out-of-box legibility (v0.12.5's ALL-CAPS card, first time on
   hardware):** owner visual check of `JOIN ME → DEVMATRIX-A334`
   after the wipe — PENDING.

7. **Flow scripted after board 2:**
   [procedures/flash-station.sh](../procedures/flash-station.sh)
   encodes the exact per-unit cycle (stable-port wait, flash with
   retry, MAC→serial derivation, wipe with retry, settled-stat-line
   verification) and was validated end-to-end against board 2 —
   including the 170 Hz boot transient settling to 200 Hz idle, which
   the script now waits out by design. Both boards needed the
   retry-after-first-esptool-touch on at least one step; the script
   retries every esptool call once.

## What this does not prove

- No 24 h soak, interrupted-power OTA, or bench-supply current
  measurement (M0 items still open).
- Signed OTA (ADR-0006) remains unimplemented — OTA is gated by the
  per-device LAN token only.
- One unit's drill does not prove every unit; the wipe + hotspot
  check below is the per-unit line item for tonight's fleet.

## Per-unit ship record (tonight's run)

| Serial | Flashed v0.12.6 | Hash verified | NVS wiped | Hotspot card legible | Boxed |
|---|---|---|---|---|---|
| DMX-E28E-A334 | ✅ | ✅ | ✅ | pending¹ | ✅ boxed 2026-08-26 |
| DMX-E28E-B1D8 | ✅ | ✅ | ✅ | pending | — |
| DMX-E28E-F488 | ✅ | ✅ | ✅ | pending | — |
| DMX-E28B-1A68 | ✅ | ✅ | ✅ | pending | — |
| DMX-E28E-F314 | ✅ | ✅ | ✅ | pending | — |
| DMX-E28E-F7EC | ✅ | ✅ | ✅ | pending | — |
| DMX-E28B-0F6C | ✅ | ✅ | ✅ | pending | — |
| DMX-E28B-0FE4 | ✅ | ✅ | ✅ | pending | — |
| DMX-E28E-A32C | ✅ | ✅ | ✅ | pending | — |

¹ Boxed before the visual check; legibility is a firmware-wide
property (same v0.12.6 ALL-CAPS render, same panel type), so the
owner's verdict on any one unit settles the column for all units
flashed tonight.
