# ADR-0013 — Arduino CLI and Protomatter toolchain

**Status:** Accepted · 2026-08-07

## Context

docs/FIRMWARE.md's original Stack section specced PlatformIO on
Arduino core 3.x with the generic community HUB75-DMA library as the
display driver. Neither half survives contact with DK-01's actual
board. The HUB75-DMA library's own README disclaims the MatrixPortal
S3 with concurrent Wi-Fi and warns against Quad-SPI PSRAM as the DMA
buffer — exactly DK-01's configuration. And arduino-esp32 3.x is not
shipped through PlatformIO's first-party espressif32 platform, which
stopped tracking upstream at core 2.x
([espressif32 releases](https://github.com/platformio/platform-espressif32/releases)),
so that pairing rests on community repackaging rather than a supported
toolchain.

## Decision

Bring-up uses Arduino CLI with a pinned arduino-esp32 3.3.x release —
3.3.8 at approval, re-pinned to the latest 3.3.x patch at the P2
freeze — and Adafruit Protomatter 1.7.1 as the display driver, the
library Adafruit documents for this exact board. Firmware stays C++17,
built as clean components so a pure-IDF port remains possible
(docs/FIRMWARE.md). The PlatformIO/Arduino-3.x combination and the
generic HUB75-DMA library are not used unless later benchmarks justify
reopening this decision by a superseding ADR.

This supersedes docs/FIRMWARE.md's previous Stack section, which is
rewritten in this same change. Sources:
[arduino-esp32 releases](https://github.com/espressif/arduino-esp32/releases),
[Protomatter releases](https://github.com/adafruit/Adafruit_Protomatter/releases),
[MatrixPortal S3 guide](https://learn.adafruit.com/adafruit-matrixportal-s3?view=all).

## Consequences

Protomatter is pinned and tracked upstream; fixes go upstream, never
into a silent fork. The Wi-Fi/EMI interference cited against the
HUB75-DMA library is board-level, not library-level — open reports
exist against Protomatter on this same board — so choosing Protomatter
does not retire the risk. P1 therefore pre-registers a first-party
measurement: at least 200 Hz production refresh (Protomatter frame
counter, fixed bit depth, single 64×32 panel) and a 24-hour
simultaneous display + Wi-Fi soak with active TLS traffic, no reset,
corruption, or material RF regression (docs/PRODUCTION-PLAN.md). No
public benchmark exists for this configuration, so the evidence must
be first-party. Flash-slot and heap budgets set under the previous
stack are re-measured at the P2 freeze.
