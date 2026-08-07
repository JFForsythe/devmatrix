# ADR-0024 — One living firmware tree instead of serial spikes

**Status:** Accepted · 2026-08-07

## Context

ADR-0009's ladder allowed P1 only "disposable feasibility firmware" and
gated production code behind the P2 freeze. P1 delivered its evidence
(panel verification, 200 Hz with Wi-Fi live, runtime provisioning, a
device-served console) — but as three throwaway sketches outside the
repository, each re-proving the last one's ground. The owner's
2026-08-07 directive: the dev kit must be plug-and-play now — Wi-Fi
setup, device-served Console, and OTA as one integrated, evolving
firmware, easy for anyone to build and hack on.

## Decision

`firmware/dk01/` is the DK-01 firmware, developed continuously in this
repository from P1 onward (v0.2.0: captive-portal Wi-Fi setup with
live join, device-served Local Console, `/api/v1`, browser OTA onto
dual app slots with the TinyUF2 factory partition kept for USB
recovery). This supersedes ADR-0009's "disposable-only until P2"
firmware posture: implementation now precedes and informs the P2
freeze rather than waiting for it.

Unchanged: the `/api/v1` and OTA shapes remain **DRAFT** until the P2
contract freeze (`contracts/`); the ADR-0013 toolchain (Arduino CLI,
pinned esp32 3.3.x core, Protomatter 1.7.1); the no-credentials rule —
Wi-Fi credentials and the LAN token are created at runtime, live only
in device NVS, and are never compiled in or committed (ADR-0023,
enforced by the `sensitive-data` gate in `scripts/check-repo.mjs`);
and M0 acceptance (signed OTA, verified rollback, soak, recovery
evidence) still gates any sold unit.

## Consequences

docs/FIRMWARE.md is rewritten in this change to describe the living
tree. The P1 spike sketches stay archived outside the repository as
evidence artifacts. M0 hardening becomes work on this tree, not a
restart. Accepted risk: pre-freeze API churn — drafts are cheap while
the only hardware is dev units; the freeze at P2 inherits a tested
surface instead of a paper one.
