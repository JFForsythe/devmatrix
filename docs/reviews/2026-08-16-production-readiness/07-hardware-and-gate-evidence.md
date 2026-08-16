# Step 07 — Hardware bring-up and gate evidence

Produced by a dedicated evidence deep dive (all six `hardware/evidence/`
files read in full against PRODUCTION-PLAN §3, ROADMAP, ADR-0012/0013/
0020/0024/0031, MANUAL, and the firmware tree). Load-bearing claims
below were independently re-verified in the tree before inclusion
(grep for UF2 tooling, rollback call site, Protomatter failure loop,
button code, `git tag`).

## Headline finding

**[P1] The manual's USB-recovery claim is present-tense, untested, and
not followable as written.** docs/MANUAL.md:401-405 (a "Today" table)
says: double-press reset, the board mounts as a USB drive, "drag a UF2
firmware file on", and "USB recovery is always there even if both app
slots are bad."

- No evidence file records the drill ever being performed;
  `hardware/evidence/2026-08-07-integrated-firmware-ota.md:33` only
  *asserts* TinyUF2 as the recovery path.
- The documented build (firmware/dk01/README.md) produces a **`.bin`**;
  verified: no `.uf2` artifact, converter, or bin→UF2 instruction
  exists anywhere in the repo — an owner at chapter 10 has no UF2 file
  to drag.
- "Even if both app slots are bad" has never been exercised.

This sits on invariant 3 (never brick) and the no-unsupported-claim P0
rule simultaneously. Fix: run and record the drill once (with the
conversion step documented, e.g. `uf2conv`/family with the correct
family ID and 0x410000 factory offset context), or relabel the row.

## P1 gate status (acceptance: first pixel / unknowns evidenced / MatrixPortal approved)

- **First pixel: done.** The 2026-08-07 trio is genuine, dated,
  toolchain-pinned bench evidence (full test-pattern ladder, correct
  color order, confirmed 1/16 scan; arduino-cli 1.5.1 / core 3.3.11).
  Caveats: the bring-up sketches live outside the repo (ADR-0024
  archives them), no photos or raw serial logs are referenced anywhere
  in `hardware/`, and zero git tags exist (verified) so evidence
  version strings map to commits only via commit-message archaeology.
- **Unknowns evidenced: NOT met.** Zero evidence exists for: the
  pre-registered 24 h display+Wi-Fi soak with active TLS (P1's own EMI
  gate), any current/voltage-drop/temperature measurement (the 150
  brightness cap is an uninstrumented interim bound), the 8–12
  unassisted-user setup tests (n=1, the owner, on a disposable sketch),
  panel supplier intake (driver IC still "likely FM6124-family",
  unconfirmed since ADR-0012), and enclosure/fused-harness/certified-
  supply/BOM/cost model. The four named ADR-0031 browser experiments
  remain open. Partial evidence: 200 Hz refresh floor met twice (last
  at v0.2.0); memory watermarks solid.
- **MatrixPortal approval: not decidable.** Of ADR-0012's five
  approval gates: display/Wi-Fi partial, memory evidenced,
  security/recovery (P2 sacrificial boards) not started, supply zero,
  certification zero. No approval ADR exists — correctly.

**[P1] The firmware in the tree has never run on hardware.** Last
on-hardware version is v0.4.0 (2026-08-07). Everything since — MQTT
(v0.8.0), Ed25519 identity (v0.9.0), constant-time auth (v0.9.1),
64 KB PSRAM fetch buffer (v0.10.0), scan removal (v0.11.0) — is
compile- or mock-verified only, and both 2026-08-12/13 evidence files
say so honestly. Seven versions of hardware-untested drift; the 200 Hz
floor was last confirmed five feature-versions ago. MANUAL.md:10-12's
global hedge covers this, barely.

## M0+EVT readiness: ~1.5 of 5 exit criteria, on 1 of 10 units

- Blank-unit-to-clock: partial — one dev unit, but NVS survived every
  reflash, so a genuinely blank first-run has never executed on the
  in-repo firmware.
- 50 interrupted-power cycles + corrupted-OTA recovery: no evidence.
- USB recovery without factory access: no evidence (headline finding).
- 72 h soak: no evidence (nor P1's 24 h one).
- Diagnosable-without-shell: partial — reset-reason + `apps/diag`
  exist; safe mode does not (no code; FIRMWARE.md lists it as target
  shape), and a Protomatter init failure hangs forever in a bare
  `for(;;)` loop with serial-only visibility (dk01.ino:1364-1367,
  verified).
- Strongest ingredient: three real OTA slot swaps on hardware
  exercising both slots (2026-08-07). Rollback is a single
  `esp_ota_mark_app_valid_cancel_rollback()` after boot+join
  (dk01.ino:1333, verified) — no failed-boot rollback yet, honestly
  labeled M0 work everywhere.
- **Fixtures/procedures in repo: none.** No pixel/current/Wi-Fi/USB
  fixture, no soak procedure, no interrupted-power script, no fixture
  result schema (§4 of the plan requires one). No physical-button code
  exists (verified) — correctly labeled Ahead·M1.

## Manufacturing (R0/PVT) — uniformly absent, as expected at P1

No BOM, no supplier record (the panel photo ADR-0012 cites isn't in
the repo), no fixtures, no provisioning *procedure* (device
self-derives serial from eFuse MAC and mints its key on first boot —
fine, but there's no manufacturing record schema, and the 4-hex-digit
serial collision policy across a 50-unit run is undefined), no yield
tracking, no per-unit test procedure for R0's 12 required tests.
`hardware/` contains six markdown files and nothing else; of
CLAUDE.md's three content classes for it (manufacturing files,
fixtures, gate evidence), only evidence exists.

## Evidence-quality notes

The 2026-08-12 console-parity file is the model: hashes, byte counts,
negative checks, explicit "what this does not prove". The 2026-08-07
files are good but assert two things without artifacts: "owner visual
check passed" (no photo/video) and the v0.3.0 panel-read pairing happy
path ("owner-verifiable at the bench" — i.e., possible, not done).
P3: board-alone evidence publishes the dev unit's eFuse MAC.
P3: ADR-0020 stands "Accepted" containing a constraint ADR-0031
corrected; the correction is annotated elsewhere, but ADR-0020 itself
carries no banner (consistent with immutability — the index row is the
place for it, and it exists there).

## What closing the hardware side actually takes

1. One bench week with the current build: flash v0.11.0 to the DK-01,
   re-run the pattern ladder + refresh measurement, run the 24 h soak
   with MQTT+TLS active, record current/voltage/temperature with
   instruments, execute the USB-recovery drill (producing the UF2
   instructions), and file one evidence doc per run.
2. Panel intake: supplier SKU, driver confirmation, pinout, lot
   policy, power-off checks — one supplier conversation + one bench
   session.
3. The four ADR-0031 browser experiments against the real board.
4. 8–12 unassisted user tests (can overlap M1's 9-of-10 acceptance).
5. First enclosure/harness/BOM/cost pass — the only item needing
   mechanical design.
