# ADR-0018 — Returns and warranty in place at R0+PVT

**Status:** Accepted · 2026-08-07

## Context

Selling hardware creates obligations that software releases do not:
units fail in transit, buyers change their minds, and defects surface
after money changes hands. A one-person company needs those
obligations bounded and written down before the first sale, not
improvised at the first RMA. The production plan's R0+PVT gate names
the complete set this ADR adopts.

## Decision

The following exist and are complete at the R0+PVT gate, before any
unit sells:

- A 30-day return policy.
- A one-year limited hardware warranty.
- A named support channel.
- Replacement inventory, drawn from the first run's QA/RMA spares
  (ADR-0011).
- A documented repair-or-scrap procedure for returned units.
- Explicit stop-ship authority: a named decision point that halts
  shipments when a defect pattern emerges.

The operational procedures behind these commitments live in
docs/OPERATIONS.md.

## Consequences

R0+PVT cannot pass on manufactured units alone; support readiness is
a gate condition with the same weight as yield. Warranty reserve
becomes a real input to the EVT-costed retail price (ADR-0011).
Anything beyond this floor — extended warranty, international
returns — is a future decision; nothing here implies it.
