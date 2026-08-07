# ADR-0009 — Adopt the DK-01 production plan and single gate ladder

**Status:** Accepted · 2026-08-07

## Context

docs/PRODUCTION-PLAN.md is the approved, audit-hardened blueprint from
blank hardware to a sellable DK-01 — but a plan is not repo canon.
Meanwhile ROADMAP.md defined its own P0/P1/L0/M0–M5 gates with
different meanings, and the old sequencing was circular: firmware
waited on a gate whose acceptance (claim → first pixel on a real
DK-01) required firmware to exist. Two in-tree documents must never
define the same gate names differently.

## Decision

Adopt docs/PRODUCTION-PLAN.md as the execution blueprint. Its decision
clusters land as the ADR-0009 through ADR-0022 set, each updating its
owner docs in the same change. Wherever the plan states a position
that no accepted ADR has yet landed, the owner docs win.

The repository moves to one canonical gate ladder, owned by
ROADMAP.md: P0 governance and roadmap reset → P1 hardware bring-up
and feasibility spikes → P2 contract and security freeze → M0+EVT
firmware bedrock (10 units) → M1 real Local product → M2+M3
integrations and open developer platform → M4 apps and Registry →
L0+DVT production-intent beta → R0+PVT first sellable run (50 units)
→ GA. The paid Cloud track C0–C3 stays separate behind its own gates
(ADR-0007).

The legacy gate names from the pre-adoption ROADMAP.md (old
P0/P1/L0/M0–M5) are retired. The circular sequencing is superseded:
P1 may produce disposable feasibility firmware only; P2 authorizes
production code. Real claim-to-first-pixel acceptance moves to M1.
The claims-to-evidence rule extends beyond the repo to the live
storefront: no present-tense product claim without acceptance
evidence.

This refines ADR-0002's sequencing without superseding its
portal-first intent: the Console prototype remains the working spec,
and production firmware still starts only after contracts freeze.

## Consequences

ROADMAP.md is rewritten to the single ladder in this change; the
2026-08-04 "definition + prototype" milestone stays recorded there
under a history note. ADRs record decisions only — nothing in the
ADR-0009..0022 set claims that firmware, the production Console, or
manufacturing is implemented. Until each ADR in the set lands with
its owner-doc updates, the affected owner doc remains authoritative
over the plan.
