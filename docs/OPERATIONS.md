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
  `portal/console/dist-hosted/index.html`; root `vercel.json` builds it with
  `npm ci` and `npm run build:hosted` after the project is switched to the
  repository root. No server, database, functions, or telemetry backend runs.
- **The release chain is owned by [AGENTS.md](../AGENTS.md).** Commit,
  push, deploy, and verification rules live there; this file does not
  duplicate them.
- **Production is proven, not assumed.** `scripts/verify-live.mjs`
  (`make verify-live`) compares the live response byte-for-byte with the
  committed artifact production actually serves — today
  `portal/prototype/index.html` — and the CI `verify-production` job runs
  it on every push to `main`, additionally requiring a successful provider
  deployment for the exact pushed commit. `DEVMATRIX_LIVE_FILE` overrides
  the artifact path; use it to verify
  `portal/console/dist-hosted/index.html` against a preview before the
  cutover. The switch commit flips the default in the same change as the
  dashboard setting — never before, or every release fails closed
  (ADR-0016's atomicity rule).
- **Outstanding owner dashboard action.** Immediately before releasing the
  switch commit, open **Vercel → devmatrix-console → Settings → Build and
  Deployment → Root Directory → Edit**, clear `portal/prototype` to select the
  repository root, and save. Do not separately redeploy the pre-switch commit.
  The switch commit and this setting are one coordinated cutover: its push
  builds with root `vercel.json`, and the default verifier fails closed if the
  setting still points at the prototype. Until the setting changes, the
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
  metadata, and app packages — ship as signed GitHub Release assets,
  mirrorable and locally installable (ADR-0016).

## Secrets and credentials

The protection story, in order of proximity:

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
  ([ROADMAP.md](../ROADMAP.md)). Monitoring means the published hashes
  and signatures stay fetchable and reconcile with the released
  artifacts; there is no device telemetry to consume, by design.
- **Owner side:** fleet visibility is the Console fleet view —
  same-LAN in Local Mode, cross-site via the paid Cloud track. The
  feature matrix in [docs/MODES.md](MODES.md) and the Console spec in
  [docs/PORTAL.md](PORTAL.md) own the details; they are not restated
  here.

## Wi-Fi and provisioning

Owned elsewhere: [docs/SECURITY.md](SECURITY.md) "Discovery & local
transport" and the [docs/PORTAL.md](PORTAL.md) five-minute first
pixel. Link only.
