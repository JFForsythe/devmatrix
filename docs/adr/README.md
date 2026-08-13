# Decision log — index and current status

Every decision in this repository is an ADR. **Accepted ADRs are
immutable and CI enforces it byte-for-byte** — a later ADR refines or
supersedes an earlier one, and the earlier file is never edited, not
even to add a pointer. That keeps the log a true record of what was
decided and when.

The cost of immutability is that a reader landing on an old ADR cannot
see what happened next. **This index is the forward pointer.** Anything
not listed below is current as written.

## Superseded or refined

| ADR | Still authoritative for | Superseded / refined by |
|---|---|---|
| [ADR-0001](ADR-0001-clean-room.md) — Clean room | The absolute no-reuse boundary | Scope re-drawn by [ADR-0023](ADR-0023-clean-room-rescope.md) (independently built flight features on the owner's own receiver are in scope); one hosted hostname excepted by [ADR-0025](ADR-0025-hosted-console-domain.md) |
| [ADR-0005](ADR-0005-prototype-constraints.md) — Prototype constraints | Why the prototype was single-file and mock-only | Superseded by [ADR-0027](ADR-0027-one-console-codebase.md); `portal/console/` is the Console, the prototype is a design reference |
| [ADR-0009](ADR-0009-adopt-production-plan.md) — Adopt the production plan | The gate ladder and its acceptance criteria | Firmware posture superseded by [ADR-0024](ADR-0024-living-firmware-tree.md); P1 and M4 rescoped by [ADR-0026](ADR-0026-three-tier-app-model.md) |
| [ADR-0014](ADR-0014-console-production-stack.md) — Console stack | Preact + TypeScript + Vite, no runtime fonts | Build targets and the committed device header defined by [ADR-0027](ADR-0027-one-console-codebase.md) |
| [ADR-0016](ADR-0016-static-hosting-cloudflare.md) — Static hosting | Cloudflare Pages, zero standing compute, before first sale | Destination hostname set by [ADR-0025](ADR-0025-hosted-console-domain.md) |
| [ADR-0020](ADR-0020-browser-support-matrix.md) — Browser support matrix | The supported-browser baseline | Constraint 1 corrected and the transport decided by [ADR-0031](ADR-0031-browser-to-device-transport.md) |
| [ADR-0022](ADR-0022-clean-room-enforcement.md) — Clean-room enforcement | The banned-identifier CI gate | Re-scoped by [ADR-0023](ADR-0023-clean-room-rescope.md); exactly one hostname excepted by [ADR-0025](ADR-0025-hosted-console-domain.md) |

## Reading order for the current design

- **What the product is** — [ADR-0023](ADR-0023-clean-room-rescope.md)
  (clean-room scope), [ADR-0026](ADR-0026-three-tier-app-model.md) (the
  three app tiers), [ADR-0030](ADR-0030-pixlet-bridge.md) (the
  owner-hosted ecosystem bridge).
- **How it is built** — [ADR-0024](ADR-0024-living-firmware-tree.md)
  (living firmware tree),
  [ADR-0027](ADR-0027-one-console-codebase.md) (one Console codebase),
  [ADR-0028](ADR-0028-mqtt-stack.md) (MQTT stack).
- **How it is reached and trusted** —
  [ADR-0031](ADR-0031-browser-to-device-transport.md) (plain HTTP on the
  LAN, permanently), [ADR-0032](ADR-0032-no-device-initiated-discovery.md)
  (the box never scans — connections go only to owner-configured
  addresses), [ADR-0029](ADR-0029-layered-display-api.md) (frame
  vs semantic layer), [ADR-0025](ADR-0025-hosted-console-domain.md)
  (hosted domain).

Owner documents carry the current state; this directory carries the
reasoning. Where a document and a newer ADR disagree, the ADR wins and
the document is fixed in the same change (CLAUDE.md).
