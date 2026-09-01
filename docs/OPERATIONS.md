# Operations — company-side runbook

This file owns company-side operations: hosting, deployment, secrets
handling, and artifact monitoring. Device-side security is owned by
[docs/SECURITY.md](SECURITY.md); the mode split and who-runs-what are
owned by [docs/MODES.md](MODES.md). Where a fact is owned elsewhere,
this file links instead of restating.

## Hosting today

What actually runs now — the complete inventory:

- **One static deployment.** The GitHub-connected Vercel project at
  `devmatrix-console.vercel.app` currently has Root Directory set to
  `portal/prototype`, so `portal/prototype/index.html` remains live. The
  in-repository target is the committed, single-file
  `portal/console/dist-hosted/index.html`, built deterministically and
  verified against drift in CI. A repository-root `vercel.json` must land
  **only** in the cutover commit: added while the Root Directory still points
  at the prototype, it is read anyway and fails the build (observed
  2026-08-12, deployment 5863328863). No server, database, functions, or
  telemetry backend runs.
- **The release chain is owned by [AGENTS.md](../AGENTS.md).** Commit,
  push, deploy, and verification rules live there; this file does not
  duplicate them.
- **Production is verified live.** `scripts/verify-live.mjs`
  (`make verify-live`) compares the live response byte-for-byte with the
  committed artifact production actually serves — today
  `portal/prototype/index.html` — and the CI `verify-production` job runs
  it on every push to `main`, additionally requiring a successful
  provider deployment for the exact pushed commit when the artifact
  changed since the previous commit. `DEVMATRIX_LIVE_FILE` overrides the
  artifact path; use it to verify
  `portal/console/dist-hosted/index.html` against a preview before the
  cutover. The switch commit flips the default in the same change as the
  dashboard setting — never before, or every release fails closed
  (ADR-0016's atomicity rule).
- **Outstanding owner dashboard action.** Immediately before releasing the
  switch commit, open **Vercel → devmatrix-console → Settings → Build and
  Deployment → Root Directory → Edit**, clear `portal/prototype` to select the
  repository root, and save. Do not separately redeploy the pre-switch commit.
  The switch commit and this setting are one coordinated cutover: that commit
  adds the root `vercel.json` and flips the verifier default together, and the
  verifier fails closed if the setting still points at the prototype. That
  `vercel.json` must also carry the in-box card's guide URL —
  `{"redirects": [{"source": "/start", "destination": "/#/guide"}]}` — so the
  printed `devmatrix.flighttrackerled.com/start` lands on the Console's guide
  page (the Console renders `#/guide` with no panel connected for exactly
  this reason). Until the Root Directory setting changes, the
  prototype continues to serve at the public URL.
- **The hosting decision and its trigger** are
  [ADR-0016](adr/ADR-0016-static-hosting-cloudflare.md): before the
  first sale, the public portal/docs move to static Cloudflare Pages —
  no Functions, no database, no accounts, no standing compute — and
  `scripts/ship.mjs` and `scripts/verify-live.mjs` are retargeted in
  the same change. Until that trigger, the Vercel Hobby deployment is
  acceptable because nothing is sold.
- **The destination is decided**:
  [ADR-0025](adr/ADR-0025-hosted-console-domain.md) names
  `devmatrix.flighttrackerled.com` as the hosted Console's domain.
  Outstanding owner action before the migration: create the DNS record.
  The device-served Console stays authoritative either way — the hosted
  copy is a convenience and a demo, never a dependency
  ([docs/PORTAL.md](PORTAL.md)).
- **Release artifacts** — firmware, recovery images, Registry
  metadata, and app packages — will ship as signed GitHub Release
  assets, mirrorable and locally installable (ADR-0016). None exist
  yet: the signing pipeline is gate M0 work. Since 2026-08-16 every
  firmware version is annotated-tagged (`vX.Y.Z`, e.g. `v0.11.0`) so
  versions, commits, and hardware evidence reconcile ahead of that
  pipeline.
- **Outstanding pre-sale dashboard hardening.** Two enforcement gaps
  are dashboard-side and cannot be closed from the repository:
  (1) Vercel deploys each push immediately, before CI concludes — a
  failing commit still goes live until `verify-production` flags it;
  enable build gating (deployment protection / required checks, or an
  Ignored Build Step keyed on CI) before anything is sold. (2) The
  private free-plan repository cannot enable branch protection;
  making the repository public (GA requires public source anyway) or
  upgrading the plan unlocks required status checks and force-push
  protection for `main`.

## Secrets and credentials

The layers, closest to the secret first:

- **Nothing secret is ever committed.** The `scripts/check-repo.mjs`
  sensitive-data gate scans every tracked file for credential
  signatures on every run; local `.env*` files are git-ignored.
- **CI and deploy credentials** live only in GitHub Actions secrets
  and the deploy provider's own settings. Contributor machines hold no
  shared secrets.
- **Owner-supplied provider keys** (for example a stocks key,
  [ADR-0015](adr/ADR-0015-official-app-data-providers.md)) are entered
  by the owner, stored in device NVS, referenced by apps as named
  credential handles, and never transit company infrastructure.
  [docs/SECURITY.md](SECURITY.md) owns the key hierarchy.
- **Firmware signing keys** are owned by
  [docs/SECURITY.md](SECURITY.md) (Identity & key hierarchy, Ops &
  supply chain) — link only.
- **Bench configuration stays local.** Development Wi-Fi credentials,
  LAN addresses, and receiver endpoints live only in git-ignored local
  files or environment variables — never in the repository and never
  in a shipped image ([docs/SECURITY.md](SECURITY.md) owns the
  shipped-unit guarantee, ADR-0023).
- **Incident rule.** An exposed credential is revoked, rotated, and
  purged from history — then the checker's pattern list is extended in
  the same change, so the class of leak is caught next time, not just
  the instance.

## Observability

- **Company side:** static artifact availability and integrity are
  monitored without any device telemetry — a GA requirement
  ([docs/PRODUCTION-PLAN.md](PRODUCTION-PLAN.md) §GA). Implemented
  today for the one live artifact: the CI `verify-production` job
  re-proves the served page byte-for-byte against the committed
  artifact on a **daily schedule** (`.github/workflows/ci.yml`) in
  addition to every push. When release artifacts begin at gate M0,
  monitoring extends to their hashes and signatures staying fetchable
  and reconciling; there is no device telemetry to consume, by design.
- **Owner side:** fleet visibility is the Console fleet view —
  same-LAN in Local Mode, cross-site via the paid Cloud track. The
  feature matrix in [docs/MODES.md](MODES.md) and the Console spec in
  [docs/PORTAL.md](PORTAL.md) own the details; they are not restated
  here.

## Wi-Fi and provisioning

Owned elsewhere: [docs/SECURITY.md](SECURITY.md) "Discovery & local
transport" and the [docs/PORTAL.md](PORTAL.md) five-minute first
pixel. Link only.
