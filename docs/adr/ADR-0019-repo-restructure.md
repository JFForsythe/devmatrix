# ADR-0019 — Target repository structure

**Status:** Accepted · 2026-08-07

## Context

The repository today is docs, scripts, and a single-file Console
prototype. The production plan (docs/PRODUCTION-PLAN.md, adopted by
ADR-0009) needs independently testable components with clear owners —
without inventing empty directory trees long before their code exists.

## Decision

Target structure, one independently testable owner per directory:

- `firmware/` — board support, display, networking, local API, apps,
  OTA, and recovery.
- `console/` — the production Console application (stack per ADR-0014),
  shared by device-local and hosted simulator modes.
- `contracts/` — OpenAPI, AsyncAPI, JSON Schemas, app bundle,
  diagnostics, and OTA formats.
- `simulator/` — contract-compatible virtual device and 64×32 golden
  renderer.
- `apps/` — official `.dmapp` examples.
- `registry/` — static Registry tooling (ADR-0017).
- `hardware/` — manufacturing files and fixtures.

A directory is created when its work starts — no empty scaffolds.
`contracts/` starts now, DRAFT and non-normative: this change adds
[contracts/README.md](../../contracts/README.md) and
[contracts/mqtt.md](../../contracts/mqtt.md). It becomes the frozen
contract owner at the P2 freeze, and transport capability descriptors
will live there per docs/PORTAL.md. `portal/prototype/` remains under
ADR-0005 constraints, unaffected, until that ADR is superseded.

## Consequences

docs/PORTAL.md's note that a contracts owner arrives at "gate P1" used
the retired ladder (ADR-0009 renames the gates); owner docs are updated
in the adoption commits. Until the P2 freeze, contracts are drafts —
implementations must not treat them as frozen — and the CI drift checks
(generated clients, docs, simulator conformance) attach to each
directory as it is created. The truth map in CLAUDE.md gains an owner
row for each directory as it lands, starting with `contracts/`.
