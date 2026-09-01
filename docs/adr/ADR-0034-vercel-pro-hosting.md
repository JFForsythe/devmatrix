# ADR-0034 — The hosted Console stays on Vercel Pro; the domain attaches there

**Status:** Accepted · 2026-09-01 · Supersedes ADR-0016

## Context

ADR-0016 moved the commercial public portal to static Cloudflare Pages
before the first sale because the Vercel deployment ran on a Hobby
plan, which bars commercial use. Both of its load-bearing facts have
changed: the Vercel team ("John's projects") is on the Pro plan, which
permits commercial use, and the first units shipped
(hardware/evidence/2026-08-26) with the migration unexecuted. The
release chain — scripts/ship.mjs, scripts/verify-live.mjs, and the CI
verify-production job — is already wired to Vercel deployment
verification, and the hosted domain's parent DNS zone (ADR-0025)
lives on Cloudflare regardless of host. John decided on 2026-09-01 to keep the
existing project and take the domain live on it.

## Decision

1. The hosted Console stays on the existing GitHub-connected Vercel
   Pro project (`devmatrix-console`). The cutover clears the project's
   Root Directory and adds the repository-root `vercel.json` (output
   directory `portal/console/dist-hosted`; `/start → /#/guide` for the
   in-box card) in one coordinated change with the verifier default —
   ADR-0016's atomicity rule survives the supersession.
2. `devmatrix.flighttrackerled.com` (ADR-0025) attaches to this
   project; its DNS record is a DNS-only CNAME in the existing
   Cloudflare zone.
3. ADR-0016's Cloudflare Pages migration is superseded. Its surviving
   principles carry forward unchanged: static files only, zero
   standing company compute, firmware and artifacts as mirrorable
   GitHub Release assets, everything self-hostable.

## Consequences

The release chain keeps its Vercel wiring unchanged. Hosting now
depends on the paid Pro plan; if that ever lapses, a successor ADR
picks a new static host and retargets ship.mjs and verify-live.mjs in
the same change, exactly as ADR-0016 prescribed. The
company-disappears promise stays literal: the portal is one static
file anyone can mirror.
