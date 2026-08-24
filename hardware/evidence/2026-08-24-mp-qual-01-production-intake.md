# MP-QUAL-01 production-intake flash

**Date:** 2026-08-24
**Disposition:** Accelerated pilot/engineering sample; not full production
qualification and not evidence for the other 19 controllers in the lot.

## Scope

This run identified one new controller, preserved its pre-flash state, built
and flashed the current DK-01 firmware, then exercised it first board-alone and
later with the HUB75 panel, Wi-Fi, and basic LAN API checks. It is flash,
bring-up, mapping, and short runtime evidence. It is not instrumented power,
recovery, soak, compliance, or full production-release evidence.

No production key was installed, no eFuse was burned, and no device MAC, API
token, Wi-Fi name, or credential is recorded here.

## Source and toolchain

- Repository base commit: `5beb421110331b42588c96fc978835c8618fbfe8`
- Firmware version flashed: `0.12.2`
- Pre-commit firmware patch SHA-256:
  `62f9c528ae562797bf6773ed004158079769fdba9c3376d691b9027a4df31648`
- FQBN: `esp32:esp32:adafruit_matrixportal_esp32s3`
- Arduino CLI: `1.5.1`
- Espressif Arduino core: `3.3.11`
- esptool: `5.3.1`
- Adafruit Protomatter: `1.7.1`
- ArduinoJson: `7.4.3`
- Crypto: `0.4.0`
- Pre-flash checks: `make check` passed (48 tests); repository checks passed;
  `git diff --check` passed.

The firmware and generated Console source paths were clean at the recorded
base commit. The firmware patch and this evidence record were the intended
production-intake changes.

## Hardware identity before write

Read-only esptool probes on the one newly enumerated USB port reported:

- ESP32-S3 QFN56, revision v0.2, dual-core 240 MHz, Wi-Fi and Bluetooth LE
- 40 MHz crystal
- embedded 2 MB PSRAM
- 8 MB quad flash, manufacturer `c8`, device `4017`, 3.3 V
- native USB Serial/JTAG
- Secure Boot disabled; flash encryption disabled; crypt count zero

These electronic identifiers do not prove the controller's supplier,
authenticity, PCB revision, level-shifter population, or connector pin map.
Front/back photographs and physical intake inspection remain required.

Before erase, the complete 8 MB supplier flash was read to a private temporary
local file. Its SHA-256 was
`9f9b02f5ee6cbef5e018c1ee424095fc21a842ea6968c0d36114b5930dab2ba1`.
The backup is not committed because its provenance and contents are not yet
approved for public distribution.

## Built and flashed artifacts

The clean compile used 1,367,939 of 2,097,152 application bytes (65%) and
116,708 of 327,680 static RAM bytes (35%). The exact application file written
was 1,368,080 bytes.

| Offset | Artifact | SHA-256 |
| ---: | --- | --- |
| `0x000000` | bootloader | `1dde272697fd0564f232a9f8823cce2ce55cc6e29227d40175c8a65a50e89768` |
| `0x008000` | partition table | `a4b273cfa878c78ab2531cdc28544914beafb3631dd9054c47007690efe9dcff` |
| `0x00e000` | `boot_app0.bin` | `f94c5d786a7a8fab06ac5d10e33bf37711a6697636dc037559ea19cc410a17f0` |
| `0x010000` | DK-01 application | `9379cf0f1fadb8f6c818abd5d63fcae424516168c4b3267cc3de2ad05ddf93f9` |
| `0x410000` | TinyUF2 factory app | `6074d66d8468b1c226c5cbd6637d5f43d1c1c544ca33f288c4b9e4775366067b` |

The upload used the `tinyuf2` partition option, a full erase appropriate to
this blank production-intake sample, 460800 baud, and upload verification.
esptool verified the hash of every written region. An operator interruption
during the first v0.12.2 attempt produced an application digest mismatch; the
unit was held back, the upload was repeated from the exact build directory,
and all five regions then verified successfully. The generated merged binary
was not used because it omits the TinyUF2 factory application.

## Board-alone observations

- The initial v0.12.1 flash re-enumerated with the expected MatrixPortal USB
  descriptor and advertised the expected open `DEVMATRIX-[redacted]` setup
  network. Board-alone telemetry held 200 Hz.
- The panel photograph showed correct one-pixel-per-LED addressing with no row
  duplication or channel swap, but also exposed clipping in the 64-pixel-wide
  setup status card. v0.12.2 moves four-line status cards to the existing
  compact TomThumb font. The post-Wi-Fi clock layout was visibly correct;
  factory-reset validation of the corrected setup card remains pending.
- After Wi-Fi onboarding, the open health endpoint reported firmware `0.12.2`
  in run mode. Serial telemetry showed RSSI -38 to -45 dBm and free internal
  heap between 153,716 and 158,292 bytes.
- Nine consecutive loaded ten-second windows reported `refresh_hz=199`. This
  is one hertz below the current 200 Hz production gate and is **not passed**;
  the earlier board-alone 200 Hz result does not override the loaded result.
- Bytes for TinyUF2 were written and verified, but a recovery volume was not
  observed during two manual double-reset watch windows. Physical button timing
  was not independently confirmed, so USB recovery is **not passed** by this
  run.

## Result and open gates

**Passed:** exact-device identification, 8 MB flash and 2 MB embedded PSRAM
identity, clean build, full verified write, application boot, setup-hotspot
advertisement, board-alone steady 200 Hz telemetry, correct 64×32
one-pixel-per-LED mapping, post-Wi-Fi clock layout, Wi-Fi association, open
health/identity routes, authenticated-route rejection without a token, and
Host-header rejection.

**Not tested or not passed:** physical PCB/revision inspection, PSRAM write and
watermark test, TinyUF2 mount/reflash recovery, the full
pixel/color/row/gradient pattern ladder, connector voltage, current,
temperature, brownout behavior, a recorded Console claim-code completion,
MQTT/TLS/HTTPS load, OTA A/B and rollback, power-interruption recovery,
extended soak, signing, enclosure, supply, fixture, compliance, and per-unit
manufacturing tests. Loaded telemetry at 199 Hz is not passed. The owner
explicitly waived the 24-hour soak for this two-hour pilot shipment; that
time-boxed risk exception does not convert this run into full production
qualification.

A successful flash does not approve this lot for production. Continue with the
MatrixPortal qualification gates in [the production plan](../../docs/PRODUCTION-PLAN.md)
and [bench-week procedure](../procedures/bench-week.md).

## Addendum — same-day factory-fresh close-out (23:18 UTC)

The repository shipped v0.12.3 (commit `4e84a0f`) after this intake run. The
unit was deliberately **left on v0.12.2**, the exact build this record's
hashes describe: v0.12.3's only device-visible change is the optional
`lease_ms` frame lease, which v0.12.2 ignores harmlessly (verified in
source — its frame handler reads only `b64`), and unverified-on-hardware
firmware does not belong on a unit hours before shipment. The owner can OTA
later from the Console.

To leave the unit factory-fresh, the NVS partition (offset `0x9000`, size
`0x5000`, confirmed by parsing the partition table read back from this
device's flash) was erased over USB with esptool 5.2.0, then the board was
hard-reset. A blank NVS is byte-for-byte the state a factory-new unit boots
with; it wipes the Wi-Fi credentials, LAN API token, Ed25519 identity key,
and brightness/timezone, while both OTA app slots and the TinyUF2 factory
partition were untouched. During an earlier token-recovery attempt the board
was briefly left in ROM download mode and recovered by hard reset; the NVS
wipe made token recovery unnecessary, and no token or credential was ever
recorded.

Post-wipe verification, all from the bench host:

- Serial telemetry reports setup mode: `rssi=0 ip=0.0.0.0`, free internal
  heap 160,656 bytes, and `refresh_hz=200` while driving the setup status
  card.
- The unit's former LAN address no longer answers (credentials gone).
- The open `DEVMATRIX-[redacted]` setup hotspot is broadcasting (observed at
  RSSI −37, no security — the out-of-box pairing path).

Still open for the operator before boxing: visual confirmation and
photograph of the corrected compact-font setup card on the panel, the
TinyUF2 double-reset USB-recovery check, and physical inspection/packaging.
The loaded-telemetry 199 Hz gate result above is unchanged by this addendum.
