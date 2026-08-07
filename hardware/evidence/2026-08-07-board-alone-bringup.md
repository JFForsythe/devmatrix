# P1 evidence — MatrixPortal S3 board-alone bring-up

**Date:** 2026-08-07 · **Gate:** P1 hardware intake, first step ("test
the MatrixPortal alone before connecting the panel",
[docs/PRODUCTION-PLAN.md](../../docs/PRODUCTION-PLAN.md)). Board only —
no panel attached. The measurement sketch is disposable feasibility
firmware (ADR-0009) and is deliberately not in this repository; its
method is recorded below so the run is repeatable.

## Method

- Board: Adafruit MatrixPortal ESP32-S3, USB native CDC, no panel.
- Toolchain: arduino-cli 1.5.1, arduino-esp32 core **3.3.11**
  (3.3.x series per ADR-0013), FQBN
  `esp32:esp32:adafruit_matrixportal_esp32s3`.
- Sketch prints chip identity, flash size, PSRAM/SRAM totals and
  watermarks, performs a 1 MiB PSRAM allocate-and-write test, runs a
  blocking Wi-Fi scan, and then heartbeats every 5 s with the internal
  SRAM watermark. Per the no-traces rule (ADR-0023) it prints no SSID
  names — network count, channels, RSSI, and encryption type only.
- This unit is a development unit and never ships (ADR-0023).

## Results

| Measurement | Value |
|---|---|
| Chip | ESP32-S3 (QFN56), revision v0.2, 2 cores, Wi-Fi + BLE |
| eFuse MAC | `d8:85:ac:93:7a:08` (matches USB descriptor and ROM read) |
| Flash | 8,388,608 bytes (8 MB — matches the DK-01 spec) |
| PSRAM total | 2,097,152 bytes (2 MB — matches the DK-01 spec) |
| PSRAM 1 MiB alloc + write | ok |
| Internal SRAM free, boot | 279,452 bytes (largest block 225,268) |
| Internal SRAM free, Wi-Fi up | 231,504 bytes (largest block 188,404) |
| Wi-Fi scan | 29 networks in 2,990 ms; strongest −37 dBm |
| Idle stability | heartbeat SRAM watermark flat at 231,504 bytes |
| Sketch footprint | 914,539 bytes (43% of the 2 MB app partition) |

## Interpretation

- The board matches the DK-01 hardware claim exactly: 8 MB flash and
  2 MB PSRAM are real and the PSRAM is usable, not just advertised.
- Bringing Wi-Fi up costs ~48 KB of internal SRAM. This is direct
  evidence for the plan's warning that Wi-Fi buffers live in internal
  SRAM a PSRAM-side app quota cannot protect; the P2 budget work must
  track internal SRAM and PSRAM watermarks separately.
- The radio, USB CDC, esptool ROM access, and flash/verify path all
  work on the stock toolchain with no board-specific patches.

## Still open in P1

Panel intake and bench verification (current-limited supply, polarity,
scan measurement), the 200 Hz refresh + 24-hour display/Wi-Fi soak
under Protomatter (needs the panel), the browser transport and
Lua/Berry spikes, and the unassisted-setup user tests
([ROADMAP.md](../../ROADMAP.md)).
