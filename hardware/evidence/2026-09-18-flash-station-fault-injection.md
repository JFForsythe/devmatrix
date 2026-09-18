# 2026-09-18 — v0.12.7 build identity and flash-station fault injection

**Hardware:** none. No board was connected, flashed, erased, or reset for this
record. It documents a firmware build and a simulated-tool test of
[procedures/flash-station.sh](../procedures/flash-station.sh).
**Why now:** a new flashing run is planned, and two things stood in its way.
The only compiled firmware on the bench machine was the 2026-08-26 v0.12.6
build, which predates the ADR-0035 Console and the 2026-08-31 setup-portal
wording. And the [September review](../../docs/reviews/2026-09-08-full-review/examples-hardware-operations.md)
found that the flash-station script could accept an unverified device (**EH-01**).

## Build identity — v0.12.7

| Item | Value |
|---|---|
| Version banner in the image | `Devmatrix DK-01 fw 0.12.7` |
| Reported size | 1,373,755 B of flash (65% of the 2 MB app slot); 116,708 B static RAM |
| `dk01.ino.bin` | 1,373,904 B, SHA-256 `116b796fb8efb28fb072a27631959dcbdb07a713e586199f1347d99146764a4f` |
| `dk01.ino.partitions.bin` | 3,072 B, SHA-256 `a4b273cfa878c78ab2531cdc28544914beafb3631dd9054c47007690efe9dcff` — identical to the v0.12.6 build's table |
| Embedded Console header | `firmware/dk01/web_console.h`, SHA-256 `0cb8ada8903da746dc459fba809d66988b9d67c65748da73d55440be20fa94a5` (48,522 B gzip) |
| Hosted Console artifact | `portal/console/dist-hosted/index.html`, SHA-256 `ab5b5f51b4fd81402a3388f29e9717e694caf9de767d39eb5cb4683d5e60491d` |
| Toolchain | arduino-cli 1.5.1, esp32 core 3.3.11, Adafruit Protomatter 1.7.1, ArduinoJson 7.4.3, Crypto 0.4.0, `--warnings default`, FQBN `esp32:esp32:adafruit_matrixportal_esp32s3` |

Source delta against the commit the v0.12.6 ship build came from (`cfc4da5a`):
the version define, the regenerated Console header, and four lines of setup
portal wording in `web_setup.h`. No firmware logic changed.

Checks on the result:

- The Console was built twice in a row; both targets were byte-identical
  between runs.
- The 48,522-byte gzip stream from `web_console.h` occurs byte for byte inside
  the v0.12.7 image and does not occur in the archived v0.12.6 image.
- The decompressed embedded Console and the hosted artifact each contain no
  personal-account URL (ADR-0035), one support-mailbox reference, and show
  firmware `0.12.7` in the sample-data demo.
- The image hash identifies this one build. ESP-IDF stamps build time into
  the app descriptor, so a rebuild from the same commit gives a different hash.

The build lives in the ignored `firmware/dk01/out/` on the bench machine. The
v0.12.6 files that were flashed on 2026-08-26 were copied to an `archive-`
subfolder there before the compile overwrote them.

## What changed in the script

Each item is the review's observation, then the behavior now.

1. **Exit status discarded.** Every esptool and arduino-cli status is checked.
   The single retry still absorbs the S3's first-touch re-enumeration; a
   second failure stops the run.
2. **A short NVS dump read as "blank".** The sniff must return exactly
   20,480 bytes before it is classified.
3. **No partition information.** The build's table must place `nvs` at
   `0x9000`+`0x5000`, `otadata` at `0xe000`, `ota_0` at `0x10000`, and carry
   a `uf2` partition. After the flash the table is read back from the board
   and must equal the build's byte for byte. Nothing is erased otherwise.
4. **"Hard resetting" taken as success.** The upload must report a write at
   each of the five expected addresses (bootloader, table, boot_app0, app,
   TinyUF2) and five `Hash of data verified.` lines.
5. **Final telemetry could come from another port.** The serial read refuses
   more than one port and a vanished explicit port. If the boot banner or the
   `setup: join "DEVMATRIX-XXXX"` line is seen, it must match this build and
   this board. A final MAC read must still match the MAC read before flashing.

The ledger row now carries the firmware version.

## Fault injection

[procedures/flash-station.test.sh](../procedures/flash-station.test.sh)
replaces `python3 -m esptool`, `arduino-cli`, `sleep`, and pyserial with
simulators, builds a temporary repository root with a real partition table,
and runs the real script. Each scenario asserts the exit status, the message,
and how many times `erase-region` was invoked. `make check` runs it.

| Scenario | Expected | Hardened script | Script before this change |
|---|---|---|---|
| Normal run, explicit port | ready | ready | ready |
| Normal run, one globbed port | ready | ready | not comparable¹ |
| First esptool touch fails, retry works | ready | ready | ready |
| Re-run of a board already in the ledger | ready + warning | ready + warning | ready + warning |
| Foreign NVS with `FLASH_ANYWAY=1` | ready | ready | ready |
| esptool fails twice | stop, no erase | stop, no erase | stop, no erase² |
| NVS sniff returns 100 bytes | stop, no erase | stop, no erase | **flashed, erased, "ready"** |
| Foreign provisioned device | stop, no erase | stop, no erase | stop, no erase |
| Two ports, no explicit port | stop, no erase | stop, no erase | not comparable¹ |
| Build's table puts `nvs` elsewhere | stop, no erase | stop, no erase | **flashed, erased, "ready"** |
| No build present | stop | stop | stop |
| Upload fails twice | stop, no erase | stop, no erase | stop, no erase |
| One region not hash-verified | stop, no erase | stop, no erase | **erased, "ready"** |
| TinyUF2 region never written | stop, no erase | stop, no erase | **erased, "ready"** |
| Different MAC after the flash | stop, no erase | stop, no erase | stop, no erase² |
| Explicit port vanishes after the flash | stop, no erase | stop, no erase | stop, no erase² |
| Board's table differs from the build's | stop, no erase | stop, no erase | **erased, "ready"** |
| Erase fails twice | stop | stop | stop² |
| Setup-mode stat line never settles | stop after erase | stop | stop |
| Serial shows another firmware version | stop after erase | stop | **"ready"** |
| Serial announces another board's hotspot | stop after erase | stop | **"ready"** |
| Different MAC after the wipe | stop after erase | stop | **"ready"** |

Hardened script: **22 of 22** as expected. Previous script: **8 unsafe
acceptances** (bold).
¹ The previous script had no test-only port override, so its glob looked at
the real `/dev` and found no board. ² Safe outcome with a different message.

## What this does not prove

- The hardened script has not run against a real board. The simulators' tool
  output was written from the esptool 5.2.0 source strings and the arduino
  core's upload pattern. The first real run is the hardware validation and
  needs its own dated record: a clean pass, the measured per-board time, and
  how often the two added esptool touches (table read-back, final MAC) needed
  their retry.
- If the final MAC read fails twice, an S3 can be left in its ROM loader with
  a dark panel. The script prints the recovery command; this path was
  simulated, not observed.
- v0.12.7 has been compiled, not booted. Refresh rate, heap, OTA from v0.12.6,
  and the setup flow on this image are unmeasured.
- Every open item in the 2026-08-26 record still stands, including the 199 Hz
  loaded refresh reading and the pending per-unit legibility checks.
