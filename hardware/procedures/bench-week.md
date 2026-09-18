# Bench run list — qualification evidence still needed

Use this procedure on an explicitly selected development or sacrificial DK-01,
with the operator present for physical steps. A review of source code does not
authorize flashing, erasing a device, interrupting power, or burning eFuses.
The [production plan](../../docs/PRODUCTION-PLAN.md) owns gate criteria;
the [roadmap](../../ROADMAP.md) owns milestone status.

The evidence now includes v0.12.6 on production-path boards; v0.12.7 has one flash-station record and no refresh, soak, or OTA measurements yet. The earlier
v0.4.0-only baseline is obsolete. Read the [evidence index](../README.md#evidence-index)
before choosing a run so an old “not tested” statement is not mistaken for
current status.

## Record enough to reproduce the result

Each run produces a new dated file in [evidence/](../evidence/) with:

- Exact board and panel revision/lot, unit identifier, test operator, date,
  firmware commit, firmware version, binary SHA-256, and toolchain versions.
- Supply and cable, brightness/bit depth, Wi-Fi conditions, enabled apps,
  test duration, and the acceptance criterion chosen before the run.
- Commands and raw measurement references, observed values, pass/fail, and
  what the result does **not** prove. Redact credentials and owner data.
- A separate result for each physical unit. Do not copy an observed visual or
  assembly pass onto units that were not inspected.

Preserve dated evidence and accepted ADRs. Fix a failed gate by meeting its
criterion or by an explicit superseding decision and owner-document update.

## 1. Current-build display, refresh, and memory

Rebuild and flash using the [firmware recipe](../../firmware/dk01/README.md).
Record exactly which build ran. Exercise black, corner pixels, primaries,
border, rows/columns, checkerboard, gradients, moving lines, and low-brightness
white. Photograph the panel and its setup instructions.

Measure the Protomatter frame counter over settled windows at production bit
depth, first idle and then with Wi-Fi associated, the Console open, MQTT
connected, and an HTTPS app source active. Compare against the production-plan
minimum; **199 Hz loaded is not a passing 200 Hz result**. Record internal
heap, largest available block where exposed, PSRAM, and reset reason. A
compile-time RAM report is not the runtime watermark.

## 2. Display and Wi-Fi soak

The 24-hour display/Wi-Fi soak remains open in the latest records. Run clock
and app rotation, owner-broker MQTT, and an HTTPS app source together. Sample
available health/info counters every five minutes from a host; retain raw
samples with start/end timestamps. Record resets, display corruption, heap
trend, RSSI, and source/broker reconnects. P1's soak does not substitute for
the longer M0 soak or interrupted-power matrix in the production plan.

## 3. Instrumented power and temperature

With a current-limited regulated supply and meter, record current at brightness
10 / 75 / 150 for full white, typical clock, and radar frames; voltage at the
connector under load; cable/supply identity; and temperature after one hour
at the highest tested level. Stop if the hardware exceeds its documented
ratings. Do not increase the cap merely because the panel looks normal.

The current brightness cap and card wording do not replace these measurements.
Use the results for the supply/harness and enclosure thermal specification.

## 4. USB recovery

The 2026-08-26 evidence proves one unit mounted `MATRXS3BOOT` after a double
reset. It does not record a drag-and-drop reflash or recovery with both app
slots damaged.

First, on the selected development unit, follow the firmware README's UF2
conversion recipe, record input/output hashes, mount the recovery drive, copy
the image, and confirm the expected firmware boots. Only after that ordinary
recovery path passes, use a separately reviewed sacrificial-device procedure
for damaged-slot recovery. Identify and preserve the recovery partition and
bootloader; do not improvise offsets or perform this on a customer's unit.

## 5. OTA rollback and power interruption

Normal OTA slot swaps are evidenced; failed-boot rollback and interrupted
writes are not. Before injecting a crash, verify the actual flashed
bootloader and build configuration support rollback. Then use a controlled
test image that fails before its mark-valid point, record selected slots and
boot reasons, and prove fallback to the previously working image.

Also test a good image with the router unavailable through its health window.
The current firmware marks a running loop valid after a timed window; it is
not the old join-Wi-Fi-only policy. Use the current source and gate criteria
when defining failure injection. Follow the production plan's full
power-cycle matrix separately; a single ordinary OTA is insufficient.

## 6. Fresh-device entropy and identity persistence

Current source starts Wi-Fi before minting a missing LAN token and identity
key. Verify that order and its return/failure behavior on a fresh selected
unit; the original pre-radio minting description is obsolete. Trace the
pinned core's hardware-entropy path and record the source reference.

Verify that an ordinary reboot preserves identity, then verify the documented
factory-reset behavior on the sacrificial unit. Unique-looking output alone
does not establish entropy quality. Never publish the token, private key,
or raw NVS dump.

## 7. Host-header, CSRF, and authentication checks

The 2026-08-16 record covers selected curl-level Host/CORS/auth checks.
The hostile-page browser exercise remains separate: use controlled test
origins on a real LAN, confirm unauthorized mutations fail, and check the
authorized browser path still works. Test every mutating route, including
the distinct OTA upload path, against the current security contract.
Keep traffic within the selected test setup.

## 8. Browser transport matrix

Revisit the four ADR-0031 experiments with current installed browser versions:
WebSocket/LNA behavior where relevant, `.local` and HTTPS upgrades, Firefox
parity, and OS local-network permission. Record OS/browser versions and test
both `.local` and IP fallback. Preserve the device-served Console as the
fallback. A hosted demo or localhost mock does not prove a real HTTPS-to-LAN
connection works in those browsers.

## 9. Supplier, panel, and manufacturing intake

Record supplier SKU and lot, front/back photos, controller PCB revision,
level shifters, panel pitch/resolution, scan ratio, driver IC, pinout, rated
voltage/current, and lot-change policy. Perform the power-off polarity,
continuity, and address-line checks in the production plan. Chip electronic
IDs and a successful flash do not prove a board is genuine or qualify its lot.

Remaining mechanical and manufacturing deliverables include the BOM,
enclosure, fused harness, certified supply, fixtures, per-unit results, and
cost/yield record. The [flash-station review](../../docs/reviews/2026-09-08-full-review/examples-hardware-operations.md)
findings are fixed in the script and covered by
[fault injection](../evidence/2026-09-18-flash-station-fault-injection.md).
Its [first attended real-board run](../evidence/2026-09-18-flash-station-first-real-run.md)
passed after three bench fixes. One board does not qualify an unattended
station: keep runs attended and file each session's per-unit ledger.

## Separate acceptance work

Unassisted-user setup tests, packaging/card readability and QR scanning,
mechanical/compliance work, and the P2 Secure Boot/owner-key matrix have their
own acceptance criteria. They remain separate work even when one bench unit
renders successfully.
