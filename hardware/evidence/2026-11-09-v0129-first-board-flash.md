# 2026-11-09 — v0.12.9 on its first board, through the override path

**Hardware:** one ESP32-S3 board, serial `DMX-AD83-588C` (identifier
deliberately recorded, as in the earlier ledgers). esptool reported ESP32-S3
(QFN56) revision v0.2, 2 MB embedded PSRAM, 8 MB flash: the
[bring-up record](2026-08-07-board-alone-bringup.md)'s DK-01 chip identity.
Board and panel revision or lot were not recorded, and whether a panel was
attached was not observed.
**Firmware:** v0.12.9, source commit
`4157352e4d9bbc4536bd85c8f0dbf585e5b05514`, image `dk01.ino.bin` SHA-256
`5fcc0151a7407c2b79c1b876c0db661d49a4abb7df020ee7bbf1c9b5f00d386a`, built the
same day from the clean tree with arduino-cli 1.5.1, esp32:esp32 3.3.11,
Adafruit Protomatter 1.7.1, ArduinoJson 7.4.3, Crypto 0.4.0, Adafruit GFX
Library 1.12.5 and Adafruit BusIO 1.17.4. The station's direct calls used
esptool 5.2.0; the upload used the core's bundled 5.3.1.
**Method:** owner cabling the board; agent driving
[procedures/flash-station.sh](../procedures/flash-station.sh) over USB from
the same machine, one board cabled throughout. The line-timestamped log is
kept beside the build in the ignored `firmware/dk01/out/station-logs/`.
**Criterion, chosen before the run:** the script's `BOARD READY` — five
regions written and hash-verified, the partition table read back equal to the
build's, NVS erased, a settled setup-mode stat line (`refresh_hz=200 rssi=0
ip=0.0.0.0`), and one eFuse MAC from first read to last.

## What happened

1. **A read-only look before the build existed.** The board sat in its ROM
   loader (USB identity `303a:1001`). Its partition table differed from the
   build's from the third record on and matched no table shipped as a file in
   the board package. Its NVS held 74 entries in five namespaces: ESP-IDF's
   own three (`phy`, `nvs.net80211`, `misc`) and two others, whose names were
   counted and never shown. No Wi-Fi network was saved. The station's own
   classifier read that as `foreign`. Nothing was written, and both dumps
   were deleted afterwards.
2. **The owner was asked and confirmed the override** for this MAC, knowing
   the flash erases whatever the board had been set up as.
3. **One run with `FLASH_ANYWAY=1` passed on the first attempt, in
   2 min 3 s.** The same MAC was required on the port before the script
   started.

| Step | Duration | Note |
|---|---|---|
| 1 · build, port, MAC, NVS sniff | 10 s | no retries: the board was in its loader; NVS read `foreign`, override active |
| 2 · upload | 30 s | five regions written and hash-verified at `0x0`, `0x8000`, `0xe000`, `0x10000`, `0x410000` |
| 3 · MAC re-check, partition-table read-back | 26 s | two retries; table on the board equals the build's |
| 4 · NVS erase | 13 s | one retry |
| 5 · setup-mode check | 31 s | `refresh_hz` 170 (boot transient), 200, 200; `rssi=0 ip=0.0.0.0`; heap 159,728–160,052 |
| 6 · final MAC check | 13 s | one retry; same MAC on the port that produced the stat lines |

After the run the board enumerated as `239a:8125` "MatrixPortal ESP32_S3".

## Per-unit record

| Serial | Arrived | Passing run | Flashed | Hash verified | NVS wiped | Setup mode seen | Hotspot card legible | Boxed |
|---|---|---|---|---|---|---|---|---|
| DMX-AD83-588C | in its loader, another setup's layout and NVS, override on the owner's instruction | 2 min 3 s, first attempt | ✅ 0.12.9 | ✅ (5 regions) | ✅ | ✅ 200 Hz | pending | — |

## What this does not prove

- One board. The panel's `SETUP: JOIN DEVMATRIX-588C` card was not seen by
  the operator of this record; the legibility column stays with the owner.
- Chip identity and a clean flash do not show which board model this is, or
  that its panel wiring is the DK-01's. What the board had been set up as
  was not identified, by design.
- v0.12.9 has now booted to setup mode on one unit, the first board to run
  anything newer than v0.12.7. None of the v0.12.8 and v0.12.9 changes were
  exercised: the setup token's hotspot-only handout, the pairing pause and
  its expiry, the app-fetch body budget, and the mark-valid record are
  compiled and booted, not tested.
- Refresh with Wi-Fi active, OTA into or out of v0.12.9, soak, and every
  open item in the earlier records remain unmeasured.
- This is the first complete station run under the override. One pass does
  not qualify that path, and detection of a saved Wi-Fi network remains
  simulated.
