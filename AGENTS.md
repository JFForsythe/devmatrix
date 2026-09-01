# Repository operating contract

These rules apply to every human, agent, editor, and automation tool that
changes this repository. The product boundaries and the one-owner truth map
are below — read them before changing anything.

## What this is

Devmatrix is an open, hackable 64×32 LED display kit sold as
**"Dev Kit by FlightTrackerLED."** It is a developer product: open
firmware, documented APIs, and a control portal (the **Console**). It is
not the closed flight-tracker appliance: it is a canvas platform whose
bundled apps include a small local-only flight display fed by the owner's
own receiver (ADR-0023). No closed-product code, logic, or schemas — ever.

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
| Repository workflow, definition of done, invariants, truth map | AGENTS.md (this file) |

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

## Work safely

- Start with `git status --short --branch`. Preserve unrelated changes and
  never reset, clean, or rewrite work you did not create.
- Read the owner document before changing a product fact. Update that owner in
  the same change; elsewhere, link to it instead of copying it.
- Record a new decision in a new ADR (`docs/adr/ADR-NNNN-slug.md`, ≤1 page:
  Context / Decision / Consequences), then update the owner doc in the same
  commit. Never rewrite an accepted ADR; a later ADR must explicitly refine
  or supersede it.
- The Console is one codebase at `portal/console/`, built to two targets
  (ADR-0027, superseding ADR-0005): a gzipped bundle generated into the
  firmware (committed, so Arduino-IDE forks need no Node) and a static bundle
  for the hosted domain. Never hand-edit the generated device header;
  regenerate it. Keep `portal/prototype/index.html` single-file, static,
  dependency-free, and mock-only; it stays the design reference until
  `portal/console/` reaches parity and retires it.
- Mock data in the prototype and the Console demo must match
  docs/USER-STORY.md identifiers (device names, serials like
  `DMX-4E71-0952`, firmware versions) — one story everywhere, so demos,
  docs, and tests never contradict each other.

### Clean-room boundary

- Never open, search, compare against, copy, translate, or reuse FlightTracker
  source, internal docs, APIs, schemas, MQTT topics, provisioning, OTA, tests,
  assets, naming, or architecture. Only the brand byline and the hosted domain
  (ADR-0025) cross the boundary.
- Record public provenance in the PR for every new dependency and every
  borrowed public standard.
- CI enforces a banned-identifier clean-room gate in
  `scripts/check-repo.mjs`: closed-product identifiers hard-fail
  everywhere and are stored only encoded (ADR-0022, re-scoped by
  ADR-0023). Independently built flight features are allowed;
  closed-product code, logic, schemas, and topics are not.

## Definition of done

An implementation is complete only when all of the following are true:

1. Code, tests/checks, owner documentation, and any required ADR agree.
2. `make check` and `git diff --check` pass from the repository root. A
   change touching `portal/console/` also passes `make console-verify`
   locally — the same rebuild-and-diff gate CI's console-build job
   enforces, run before pushing instead of after.
3. The exact changed-file diff and `git status --short` have been reviewed; no
   unrelated or generated files are included.
4. The final report distinguishes **local**, **committed**, **pushed**, and
   **deployed** state. Never describe one as another.

## Release requests

Any affirmative request to **commit**, **push**, **deploy**, **go live**,
**publish**, or **ship** the current work is a release request. Polite
instructions such as “can you push this?” count. These words are aliases for
the same outcome and authorize and require the complete release chain in the
same task:

1. Run `make check` and `git diff --check`.
2. Review the exact changed-file diff and exclude unrelated files.
3. Stage named paths only, then review the staged names, staged diff, and
   `git diff --cached --check`.
4. Create one descriptive commit for the coherent change.
5. Push through the repository's normal non-force path and verify that the
   destination branch resolves to local `HEAD`.
6. Wait for the "Repository checks" GitHub Actions run for the exact pushed
   commit and require conclusion success. A failed, cancelled, or timed-out
   run means “pushed, CI failed — production not verified”; stop there.
7. Wait for the configured production deployment and verify the provider
   reports success for that exact commit.
8. From the clean, pushed tree, run `make verify-live` and prove the production
   artifact matches the committed Console artifact.

Do not stop after committing or pushing. Use the fail-closed release command
with an explicit message and exact file list:

```sh
node scripts/ship.mjs --message "type: concise summary" --confirm-reviewed -- path/to/file another/file
```

`SHIP_MESSAGE="type: concise summary"`, `SHIP_REVIEWED=true`, and a JSON array
in `SHIP_FILES_JSON` may be passed to `make ship` instead. The command must
refuse pre-staged work, unrelated dirty paths, a non-`main` branch, a remote
that moved, failed checks, or missing release credentials. It stages named
paths only and never uses a force push. Do not use `git add .`, `git add -A`,
`git commit -a`, bypass hooks or branch protection, create a new deployment
target, or expose credentials.

If any gate fails, stop before later steps, report the last state that was
actually proven, and never claim a downstream state succeeded. A release is
not a perfectly atomic transaction across GitHub and Vercel: after a successful
push, a CI or deployment failure means “pushed, production unverified,” not
rolled back.

A status question (“is it pushed?”), a read-only explanation, quoted text,
code or UI terminology, a hypothetical, or an explicit negative instruction
is not a release request. A polite imperative is. The latest explicit
prohibition such as “do not deploy” wins; if the intended target or authority
is genuinely unclear, ask before the external mutation.

## Automation policy

- Checks may run automatically. Staging, committing, pushing, and deploying run
  only for a release request as defined above, never merely because a session
  ends or a dirty tree exists.
- Editor and session stop-hooks may warn about a dirty tree; they never change
  Git or publish anything.
- Automation must fail visibly. Do not hide failures with `|| true` or report
  success from partial evidence.
- GitHub Actions is the shared enforcement point; local hooks are convenience
  only and must invoke the same repository checks. Run `make install-hooks`
  once per clone to enable the tracked pre-commit gate.
