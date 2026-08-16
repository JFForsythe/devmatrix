# devmatrix — working agreements for this repo

Read this before changing anything. It exists to prevent drift.

## What this is

Devmatrix is an open, hackable 64×32 LED display kit sold as
**"Dev Kit by FlightTrackerLED."** It is a developer product: open
firmware, documented APIs, and a control portal (the **Console**).
It is not the closed flight-tracker appliance: it is a canvas
platform whose bundled apps include a small local-only flight
display fed by the owner's own receiver (ADR-0023). No
closed-product code, logic, or schemas — ever.

## Truth map — one owner file per topic

| Topic | Owner file |
|---|---|
| Product, brand, audience, tiers, IP line | docs/VISION.md |
| Owner instruction manual — setup, usage, recovery steps | docs/MANUAL.md |
| Buyer journey & canonical mock identifiers | docs/USER-STORY.md |
| Console spec (IA, features, connection modes) | docs/PORTAL.md |
| Mode split: Local vs Cloud, pricing, sunset | docs/MODES.md |
| Threat model, key hierarchy, ceremonies | docs/SECURITY.md |
| Firmware architecture (living tree from P1 — ADR-0024) | docs/FIRMWARE.md |
| Canonical names, serial/ID formats | docs/GLOSSARY.md |
| Company-side ops: hosting, deploys, secrets, artifact monitoring | docs/OPERATIONS.md |
| Public interface contracts (DRAFT until the P2 freeze) | contracts/ |
| Host apps, example scripts, service installers | examples/README.md |
| Manufacturing files, fixtures, hardware gate evidence | hardware/ |
| Sequencing, gates, milestone acceptance | ROADMAP.md |
| Approved production blueprint; gate-criteria snapshot (§3) | docs/PRODUCTION-PLAN.md |
| Decisions and their reasoning | docs/adr/ |
| Repository workflow and definition of done | AGENTS.md |

Rules:
- A fact lives in exactly **one** owner file; everywhere else links to it.
- PLAN.md is a pointer, not a document. Never grow it back.
- If a doc and a newer ADR disagree, the ADR wins and the doc must be
  fixed **in the same change**.

## Invariants (change only by superseding the relevant ADR)

1. **Clean room** (ADR-0001, re-scoped by ADR-0023). No code, backend
   logic, schemas, MQTT topics, API shapes, provisioning, or assets
   from the closed FlightTrackerLED products — ever. Independently
   built flight features fed by the owner's own local receiver are
   allowed; company aircraft feeds and third-party flight-data
   services are not. The brand byline and the hosted Console's domain
   (devmatrix.flighttrackerled.com, ADR-0025) are the only shared
   elements.
2. **Local-first** (ADR-0003). Every device feature works on a LAN with
   the company unreachable. Cloud is convenience, never dependency.
3. **Never brick.** Dual OTA slots, automatic rollback, USB recovery
   always available.
4. **Passkeys-first** (ADR-0004). No password authentication, ever.
5. **User-ownable root of trust** (ADR-0006). Owners can enroll their own
   firmware signing key via a physical-presence ceremony.
6. Names come from docs/GLOSSARY.md. Add a term there **before** using it.

## Working rules

- Follow `AGENTS.md` for the tool-neutral definition of done, validation,
  exact-file staging, publication, and deployment verification rules. The
  Claude Stop hook only warns about a dirty tree; it never changes Git or
  publishes anything. A release request must run the complete chain defined in
  `AGENTS.md`; never stop at an intermediate commit or push.

- New decision → new ADR (`docs/adr/ADR-NNNN-slug.md`, ≤1 page:
  Context / Decision / Consequences), then update the owner doc in the
  same commit. Supersede old ADRs; never rewrite them.
- The Console is **one codebase** at `portal/console/`, built to two
  targets: a gzipped bundle generated into the firmware (committed, so
  Arduino-IDE forks need no Node) and a static bundle for the hosted
  domain (ADR-0027, superseding ADR-0005). Never hand-edit the
  generated device header. `portal/prototype/index.html` is now the
  design reference and stays single-file, dependency-free, and
  mock-only until `portal/console/` reaches parity and retires it.
- Mock data in the prototype must match docs/USER-STORY.md identifiers
  (device names, serials like `DMX-4E71-0952`, firmware versions) — one
  story everywhere, so demos, docs, and tests never contradict each other.
- The FlightTrackerLED workspace habits in `~/CLAUDE.md`
  (docs-autoupdate, release-sync) do **not** apply to this repo — it is
  clean-room and has no customer site content to sync.
