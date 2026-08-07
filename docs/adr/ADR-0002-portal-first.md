# ADR-0002 — Portal-first build order

**Status:** Accepted · 2026-08-04

## Context
Plan v1 sequenced firmware first (M0 bring-up). But the product's actual
differentiator is the owner experience: claim → control → deploy → own.
That experience is cheapest to design, test, and change while it is
mock-data in a browser, and most expensive to change after firmware and
cloud contracts calcify around a bad UX.

## Decision
Build and validate the Console (prototype with mock data, then the real
app) before firmware work starts. Firmware M0 is deferred until the P1
gate (ROADMAP.md) passes. The prototype's screens become the working
spec for the device API surface.

## Consequences
No hardware demos early — accepted. The API contract gets designed from
the consumer side in, which historically produces better APIs. Risk:
prototype promises something firmware can't deliver — mitigated by
keeping FIRMWARE.md constraints (memory, sandbox spike) attached to
every Console feature that depends on them.
