# ADR-0003 — One Console, two connection modes

**Status:** Accepted · 2026-08-04 · refined by ADR-0007 (hosted OTA's
static manifest is free/Local; Cloud adds staged multi-site rollout only)

## Context
Plan v1's non-negotiable: no company cloud required. The product vision
adds a portal with accounts, fleet views, and hosted OTA — which sounds
like a cloud dependency. These must be reconciled without forking the UI
into two products.

## Decision
One Console codebase with two connection modes:
- **Local Mode**: browser ↔ device directly over LAN. No account, no
  cloud, full device capability.
- **Cloud Mode**: adds accounts (passkeys), multi-device fleet, remote
  access via the device's outbound relay, hosted OTA, Snapshots sync.

Every device capability works in Local Mode; Cloud Mode adds reach and
convenience only. The device never requires the cloud to function, and
never opens inbound ports for it.

## Consequences
The device API must be complete enough for a cloudless Console — good
discipline. The relay is an additive transport, not a control plane.
Eject (self-hosting) stays honest because Local Mode keeps it exercised.
