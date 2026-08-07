# ADR-0010 — Layered license scheme

**Status:** Accepted · 2026-08-07

## Context

Devmatrix publishes everything it owns — firmware, Console, hardware
files, documentation (docs/PRODUCTION-PLAN.md, adopted by ADR-0009).
One license cannot serve every layer: copyleft on API schemas would
force every integration into GPL, while a permissive firmware license
would let closed forks strip the owner-control guarantees the product
is built on. This records the licensing decision; no LICENSE files are
claimed to exist yet.

## Decision

License by artifact class:

- First-party implementation code (firmware, Console, simulator,
  tooling):
  [GPL-3.0-or-later](https://www.gnu.org/licenses/gpl-3.0.html).
- Public API schemas and client SDKs:
  [Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0) —
  integrations are never forced into GPL.
- Owned hardware files:
  [CERN-OHL-S-2.0](https://ohwr.org/cern_ohl_s_v2.txt).
- Documentation:
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); code
  samples inside docs carry an explicit software license.

License flow is one-way and CI-enforced: Apache-2.0 contract/SDK code
may flow into GPL firmware, never the reverse — GPL helper code copied
into contracts or SDKs would silently break the no-forced-GPL promise.

Publish everything owned: enclosure, harness, fixture, BOM, panel
profiles, source, tests, and future PCB files. Exclude only private
keys, credentials, customer/manufacturing records, supplier-confidential
material, and trademarks.

## Consequences

GPLv3 §6 (Installation Information): once any external GPL contribution
or dependency lands in firmware, owner-installable firmware on this
consumer device becomes a license obligation, not just a brand value —
the legal duty aligns with the never-brick and user-ownable
root-of-trust invariants (ADR-0006). The one-way flow needs a CI check,
a named P0 deliverable alongside the clean-room enforcement of
ADR-0022. Each directory adopts its LICENSE and SPDX headers when its
first code or schema artifact lands (ADR-0019) — prose drafts carry no
LICENSE file — and every dependency choice must pass GPL compatibility
review before it lands.
