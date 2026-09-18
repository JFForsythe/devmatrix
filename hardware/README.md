# Hardware, manufacturing, and evidence

This directory owns the physical product's artifacts. It is for maintainers
and bench operators; owners should start with the
[manual](../docs/MANUAL.md). Product qualification and milestone status are
owned by the [production plan](../docs/PRODUCTION-PLAN.md) and
[roadmap](../ROADMAP.md).

## What is here

| Directory | Purpose |
|---|---|
| [evidence/](evidence/) | Dated records of a specific device, build, method, result, and limitation |
| [procedures/](procedures/) | The [bench run list](procedures/bench-week.md) and [flash-station script](procedures/flash-station.sh) |
| [insert/](insert/) | Printable card variants, a per-unit template, and its PDF generator |

A successful flash or a boxed pilot unit does not close a production gate.
The latest production-path record reports **199 Hz with Wi-Fi active**
against the production plan's **200 Hz minimum**. Instrumented power,
extended soak, destructive recovery, and remaining qualification evidence
are still owed. See the bench run list for the next measurements.

## Before using the flash station

`flash-station.sh` flashes firmware and erases NVS. It is a destructive
operator tool, not an owner setup command. Keep exactly one identified,
authorized DK-01 attached; an explicit port argument does not replace that
physical isolation. Build using the pinned recipe in the
[firmware README](../firmware/dk01/README.md) and record the commit and binary
hash. The script refuses to erase unless the partition table it reads back
from the board equals the build's.

The [September full review](../docs/reviews/2026-09-08-full-review/examples-hardware-operations.md)
recorded failure-handling and port-selection defects in the script
(**EH-01**). The script now fails closed on each of them, and
[flash-station.test.sh](procedures/flash-station.test.sh) injects those
failures without hardware on every `make check`; the
[2026-09-18 record](evidence/2026-09-18-flash-station-fault-injection.md)
has the method and its limits. Simulated tools are not a bench run: the
hardened script's first pass on real boards still needs its own dated record.

“BOARD READY” now covers one device identity for the whole run, a fully
hash-verified write, a factory-fresh NVS, and observed setup mode. It does
not cover visible panel text or assembly quality. Confirm those per unit
before boxing, with the unit's ledger row. A visual pass on one panel cannot
establish another unit's assembly quality.

## Print pieces

Use [card-template.html](insert/card-template.html) with
[make-card.sh](insert/make-card.sh) for a unit-specific 4×6 card.
[quick-start-card.html](insert/quick-start-card.html),
[welcome-receipt.html](insert/welcome-receipt.html), and
[welcome-ticket.html](insert/welcome-ticket.html) are alternate static layouts.
The generator needs macOS Google Chrome, Python 3, and the `qrcode` package;
`--print` is tied to the bench's named printer. Generate and inspect the PDF
before printing, with the serial validated against [GLOSSARY.md](../docs/GLOSSARY.md).

The generated QR opens that unit's HTTP `.local` Console after setup.
The phone must be on the same LAN and able to resolve mDNS. It is an address
shortcut, not a pairing secret or proof of device identity.

The guide URL and hosted-domain operations are owned by
[OPERATIONS.md](../docs/OPERATIONS.md). Confirm the printed `/start` route and
public source/help links before a new print batch. The current cards' broad
power-supply wording still needs the instrumented supply qualification in the
bench procedure; a working guide URL alone does not qualify all printed claims.

## Evidence index

Read each record's scope and limitations. Earlier “still open” lists are
historical snapshots; later evidence can close a specific item without
rewriting the old record.

| Date | Record | Observed scope |
|---|---|---|
| 2026-09-18 | [Flash-station fault injection](evidence/2026-09-18-flash-station-fault-injection.md) | v0.12.7 build identity; 22 simulated failure scenarios against the hardened script, with 8 unsafe acceptances reproduced on the previous script; no hardware touched |
| 2026-08-26 | [First-ship bench](evidence/2026-08-26-r0-first-ship-bench.md) | v0.12.6 writes and NVS wipes; one production-path board's double-reset **mount** observed; 200 Hz idle / 199 Hz loaded; visual checks still pending in the ledger |
| 2026-08-24 | [Production intake](evidence/2026-08-24-mp-qual-01-production-intake.md) | One accelerated pilot sample, v0.12.2 write and mapping; later addendum records owner-path OTA to v0.12.4; not whole-lot qualification |
| 2026-08-17 | [Pixlet live proof](evidence/2026-08-17-pixlet-bridge-live-proof.md) | One Intel Mac, one app, 150 frames, authenticated panel push; no unattended service or catalog-wide acceptance |
| 2026-08-16 | [OTA and hardening](evidence/2026-08-16-v0120-ota-and-hardening-verification.md) | v0.11.0→v0.12.0 OTA, signature interop, selected auth checks; destructive recovery and hostile-browser tests not run |
| 2026-08-13 | [Hosted connect](evidence/2026-08-13-hosted-connect-verification.md) | Browser flow against a protocol mock; not real-device/browser transport acceptance |
| 2026-08-12 | [Console parity](evidence/2026-08-12-console-parity-verification.md) | Dated deterministic build and rendered views; not present-day artifact or hardware proof |
| 2026-08-12 | [Transport spike](evidence/2026-08-12-browser-transport-spike.md) | Research behind ADR-0031; browser experiments left open |
| 2026-08-07 | [Integrated firmware and OTA](evidence/2026-08-07-integrated-firmware-ota.md) | Early OTA slot swaps, brightness clamp, reset reporting |
| 2026-08-07 | [Panel bring-up](evidence/2026-08-07-panel-and-local-firmware.md) | Pattern ladder and early 200 Hz result on a development unit |
| 2026-08-07 | [Board-alone bring-up](evidence/2026-08-07-board-alone-bringup.md) | Chip/memory/toolchain checks, no panel |
