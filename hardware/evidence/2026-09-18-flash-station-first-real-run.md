# 2026-09-18 — Flash station: first real-board run of the hardened script

**Hardware:** one Adafruit MatrixPortal S3 production-path board, serial
`DMX-8FB1-AD98` (identifier deliberately recorded, as in the
[2026-08-26 ledger](2026-08-26-r0-first-ship-bench.md)). esptool reported
ESP32-S3 (QFN56) revision v0.2, 2 MB embedded PSRAM, 8 MB flash — the
[bring-up record](2026-08-07-board-alone-bringup.md)'s DK-01 identity.
**Firmware:** the v0.12.7 build identified in the
[fault-injection record](2026-09-18-flash-station-fault-injection.md)
(image SHA-256 `116b796f…764a4f`).
**Method:** owner at the bench cabling the board; agent driving
[procedures/flash-station.sh](../procedures/flash-station.sh) over USB from
the same machine. Each run was detached from the session with a
line-timestamped log kept beside the build in the ignored
`firmware/dk01/out/station-logs/`. One board was cabled throughout.

## What happened

1. **Run 1 stopped at the foreign-device gate after 12 s.** Nothing was
   written or erased. A read-only look followed: the partition table on the
   board was byte-identical to the build's, and the NVS region held 25
   entries in three namespaces, all ESP-IDF's own (`phy`, `nvs.net80211`,
   `misc`). Namespace names were compared against that public list and any
   other name would only have been counted, never shown.
2. **Run 2, with `FLASH_ANYWAY=1` on the owner's instruction, stopped before
   the wipe.** The upload returned success, but the station's verification
   refused it: writes at `0x0`, `0xe000`, `0x10000`, `0x13000`, `0x2c000`
   and `0x410000`, none at `0x8000`, and four hash lines instead of five.
3. **Cause: the core's fast-reflash wrapper.** `tools/flasher.py` in esp32
   core 3.3.11 saves `*_flashed.bin` copies in the build folder after every
   upload and passes them to the next upload as `--diff-with`. The copies
   in `out/` were the 2026-08-26 v0.12.6 files. esptool 5.3.1 MD5-checked
   the board's app region against that reference, found it equal, and wrote
   only the changed sectors; it skipped the identical partition table. That
   is safe, because esptool verifies before it trusts the diff. It is also
   not something a station can hold to one standard. It shows this board
   already carried the exact 2026-08-26 build, although it is absent from
   that ledger.
4. **A manual upload with the references moved aside** wrote all five
   regions in full, each hash-verified, in the format the station expects.
5. **The firmware had never been running.** No serial output in 25 s, NVS
   unchanged after two resets of a firmware that mints a token on first
   boot, and a USB identity of `303a:1001`: the chip was latched in its ROM
   loader. esptool's default RTS reset returned to the loader every time.
   `--after watchdog-reset`, which re-samples the boot pins, started the
   firmware; the USB identity became `239a:8125` "MatrixPortal ESP32-S3".
   The likely cause is BOOT held while cabling. That was not observed.
6. **Three script changes**, each now a harness scenario or a harness rule:
   every direct esptool call ends with a watchdog reset; the reflash
   references are cleared before every upload; and NVS holding only
   ESP-IDF's own namespaces with no saved Wi-Fi network classifies as
   `factory` and passes, while a saved network or any other namespace still
   needs the override. The upload transcript is kept as `last-upload.log`.
7. **Run 3 passed cleanly with no override, in 2 min 27 s.**

| Step | Duration | Note |
|---|---|---|
| 1 · build, port, MAC, NVS sniff | 29 s | NVS read `dk01`: the firmware had booted |
| 2 · upload | 33 s | five regions written and hash-verified; app region 8.9 s |
| 3 · MAC re-check, partition-table read-back | 27 s | table on the board equals the build's |
| 4 · NVS erase | 13 s | |
| 5 · setup-mode check | 32 s | `refresh_hz` 170 (boot transient), 200, 200; `rssi=0 ip=0.0.0.0`; heap 159,668–159,992 |
| 6 · final MAC check | 13 s | same MAC on the port that produced the stat lines |

All six direct esptool calls in run 3 needed their single retry. Entering
the loader from running firmware re-enumerates the USB port under esptool's
first attempt. The upload did not need one, and in runs 1 and 2, with the
chip already in the loader, no call did.

## Harness

[procedures/flash-station.test.sh](../procedures/flash-station.test.sh) now
has 26 scenarios, and its simulated arduino-cli reproduces the real
transcript, the wrapper's references, and carriage-return progress output.
With the reference clearing removed from a copy of the script, 15 scenarios
fail. With the watchdog reset removed, 22 fail.

## Per-unit record

| Serial | Flashed | Hash verified | NVS wiped | Hotspot card legible | Boxed |
|---|---|---|---|---|---|
| DMX-8FB1-AD98 | ✅ 0.12.7 | ✅ (5 regions) | ✅ | pending | — |

## What this does not prove

- One board. The panel's `SETUP: JOIN DEVMATRIX-AD98` card was not seen by
  the operator of this record; the legibility column stays with the owner.
- No real board has yet passed the gate as `factory` inside a station run.
  That classification was exercised by simulation and by classifying this
  board's real NVS bytes offline; run 3 read `dk01`. Detection of a saved
  Wi-Fi network has only been simulated.
- Why the chip was latched in its loader was inferred, not observed.
- 2 min 27 s is for a board already running firmware, with six retries. A
  board that arrives in the loader, or blank, will differ.
- v0.12.7 has now booted to setup mode on one unit. Refresh with Wi-Fi
  active, OTA from v0.12.6, soak, and every open item in the 2026-08-26
  record remain unmeasured.

## Addendum — second board, same session

**Hardware:** a second MatrixPortal S3, serial `DMX-8FB1-D520`, same chip
identity. It arrived running firmware that was not this kit's: it
enumerated as `239a:8125` "MatrixPortal ESP32-S3" and printed no stat line
in 12 s.

1. **Attempt 1 stopped at the first read, nothing written.** esptool got
   "No serial data received" twice. The firmware ignored esptool's reset
   request, and it ignored the 1200-baud touch that arduino-cli uses. The
   owner put the board in its ROM loader by hand: hold BOOT, tap RESET,
   release BOOT.
2. **Attempt 2 stopped at the second read, nothing written.** The first
   read succeeded in the loader. It ended with the watchdog reset added for
   the first board, which booted the board's own firmware again, and that
   firmware locked esptool out a second time.
3. **Fourth script change.** Before the flash the station now stays in the
   loader between esptool calls (`--after no-reset`), so whatever a board
   arrives with never runs again. The watchdog reset applies only once this
   kit's firmware is on the board. When esptool gets no response twice, the
   script now prints the BOOT and RESET instruction.
4. **Attempt 3 passed cleanly with no override, in 2 min 15 s.** The gate
   classified this board's NVS as `factory`: the first real board to take
   that path inside a station run.

| Step | Duration | Note |
|---|---|---|
| 1 · build, port, MAC, NVS sniff | 11 s | no retries: the board stayed in its loader; NVS read `factory` |
| 2 · upload | 45 s | five regions written and hash-verified; app region 8.5 s |
| 3 · MAC re-check, partition-table read-back | 20 s | one retry, after the first watchdog reset started the firmware |
| 4 · NVS erase | 13 s | one retry |
| 5 · setup-mode check | 32 s | `refresh_hz` 170, 200, 200; `rssi=0 ip=0.0.0.0`; heap 160,040 |
| 6 · final MAC check | 14 s | one retry; same MAC |

The harness has 27 scenarios. Its simulated esptool now refuses a call that
leaves the loader before the flash or fails to leave it afterwards; with
the watchdog reset forced everywhere in a copy of the script, 22 fail.

| Serial | Flashed | Hash verified | NVS wiped | Hotspot card legible | Boxed |
|---|---|---|---|---|---|
| DMX-8FB1-D520 | ✅ 0.12.7 | ✅ (5 regions) | ✅ | pending | — |

This closes two items from the list above: a real board has now passed the
gate as `factory`, and a board arriving in its loader has a measured time.
Still open: what firmware this board arrived with was not identified, only
that it was not this kit's; detection of a saved Wi-Fi network remains
simulated; both panels' legibility checks stay with the owner.
