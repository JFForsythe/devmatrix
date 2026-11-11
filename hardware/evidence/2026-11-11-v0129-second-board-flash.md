# 2026-11-11 — v0.12.9 on a second board, no override

**Hardware:** one ESP32-S3 board, serial `DMX-AD83-58EC` (identifier
deliberately recorded, as in the earlier ledgers). esptool reported ESP32-S3
(QFN56) revision v0.2, 2 MB embedded PSRAM, 8 MB flash: the
[bring-up record](2026-08-07-board-alone-bringup.md)'s DK-01 chip identity.
Board and panel revision or lot were not recorded, and whether a panel was
attached was not observed.
**Firmware:** the v0.12.9 image of the
[2026-11-09 record](2026-11-09-v0129-first-board-flash.md), unchanged: source
commit `4157352e4d9bbc4536bd85c8f0dbf585e5b05514`, `dk01.ino.bin` SHA-256
`5fcc0151a7407c2b79c1b876c0db661d49a4abb7df020ee7bbf1c9b5f00d386a`, same
toolchain. It was not rebuilt. The checkout stood one commit later, at
`561d0f3`, which adds only that record; `firmware/` and `portal/` were
checked equal to the build's commit before the run.
**Method:** owner cabling the board; agent driving
[procedures/flash-station.sh](../procedures/flash-station.sh) over USB from
the same machine, one board cabled throughout. The line-timestamped log is
kept beside the build in the ignored `firmware/dk01/out/station-logs/`.
**Criterion, chosen before the run:** the script's `BOARD READY`, as in the
2026-11-09 record.

## What happened

1. **The port came and went once.** A USB serial port appeared and was gone
   four seconds later, some minutes before a board stayed connected. The
   cause was not observed, and which board it was is not known.
2. **The board arrived running firmware that was not this kit's.** It
   enumerated as `239a:8125` "MatrixPortal ESP32_S3". In 14 s of listening it
   printed 26 lines, none of them a kit banner, stat line or hotspot
   announcement; the other lines were counted and never shown.
3. **A read-only look, nothing written.** esptool reached the loader with no
   BOOT-and-RESET requested. The partition table on the board was
   byte-identical to the build's. NVS held 26 entries in ESP-IDF's own three
   namespaces (`phy`, `nvs.net80211`, `misc`) and no saved Wi-Fi network, so
   the station's classifier read `factory`. The serial was in no earlier
   record. Both dumps were deleted afterwards.
4. **One run with no override passed on the first attempt, in 2 min 3 s.**
   The same MAC was required on the port before the script started.

| Step | Duration | Note |
|---|---|---|
| 1 · build, port, MAC, NVS sniff | 11 s | no retries: the board was still in its loader from the read-only look; NVS read `factory` |
| 2 · upload | 29 s | five regions written and hash-verified at `0x0`, `0x8000`, `0xe000`, `0x10000`, `0x410000` |
| 3 · MAC re-check, partition-table read-back | 26 s | two retries; table on the board equals the build's |
| 4 · NVS erase | 13 s | one retry |
| 5 · setup-mode check | 31 s | `refresh_hz` 170 (boot transient), 200, 200; `rssi=0 ip=0.0.0.0`; heap 159,728 |
| 6 · final MAC check | 13 s | one retry; same MAC on the port that produced the stat lines |

The USB identity after the run is the same `239a:8125` the board arrived
with, so it shows nothing here; the banner, hotspot name and stat lines read
in step 5 are what tie the running firmware to this build.

## Per-unit record

| Serial | Arrived | Passing run | Flashed | Hash verified | NVS wiped | Setup mode seen | Hotspot card legible | Boxed |
|---|---|---|---|---|---|---|---|---|
| DMX-AD83-58EC | other firmware, loader reached without BOOT and RESET, NVS `factory` | 2 min 3 s, first attempt | ✅ 0.12.9 | ✅ (5 regions) | ✅ | ✅ 200 Hz | pending | — |

## What this does not prove

- One board. The panel's `SETUP: JOIN DEVMATRIX-58EC` card was not seen by
  the operator of this record; the legibility column stays with the owner.
- Chip identity and a clean flash do not show which board model this is, or
  that its panel wiring is the DK-01's. What firmware the board arrived with
  was not identified, only that it was not this kit's.
- Whether BOOT and RESET were pressed by hand was not observed; none was
  asked for. Why the port dropped once was not observed either.
- v0.12.9 has now booted to setup mode on two units. None of the v0.12.8 and
  v0.12.9 changes were exercised on either: the setup token's hotspot-only
  handout, the pairing pause and its expiry, the app-fetch body budget, and
  the mark-valid record are compiled and booted, not tested.
- Refresh with Wi-Fi active, OTA into or out of v0.12.9, soak, and every
  open item in the earlier records remain unmeasured.
