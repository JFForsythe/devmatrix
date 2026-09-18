# Operations — company-side runbook

This file owns hosting, deployment configuration, secrets handling, and
artifact monitoring. [AGENTS.md](../AGENTS.md) owns release authorization and
the required release chain. Device security belongs to
[SECURITY.md](SECURITY.md); mode availability belongs to [MODES.md](MODES.md).

## Hosting today

| Component | Configured location / behavior |
|---|---|
| Hosted Console | GitHub-connected Vercel project `devmatrix-console`; public domain `devmatrix.flighttrackerled.com`; alias `devmatrix-console.vercel.app` |
| Static artifact | Committed `portal/console/dist-hosted/index.html`, generated from the Console source |
| Vercel root | Repository root since the recorded 2026-09-01 cutover |
| Output and card redirect | Root [vercel.json](../vercel.json): `portal/console/dist-hosted`, `/start → /#/guide` |
| DNS | Recorded cutover configuration: DNS-only CNAME in the parent Cloudflare zone to the Vercel-assigned target |
| Hosting decision | [ADR-0034](adr/ADR-0034-vercel-pro-hosting.md): Vercel Pro, static-only, superseding the Cloudflare Pages migration |
| Company runtime | No application server, database, account service, renderer, or telemetry backend is implemented in this repository |

The device serves its own Console. The hosted page is an additional way to
connect or try the demo, not a device dependency
([PORTAL.md](PORTAL.md)). The prototype remains a repository design reference;
it is not the production output.

**Verified 2026-09-08:** the GitHub repository is public, `main` is its default
branch, and both public Console origins returned the committed 143,051-byte
artifact for commit `180f0572edebe133c7e7f22bf5b2c962dfee7f4b`, SHA-256
`b3bfdc54d85301a7ef7d1e59fc0b996964f845fab6e1f8ae2b42fffbd69c822a`.
These are dated observations, not a promise that future deployments match.
The Vercel billing plan and dashboard build settings were not re-audited by
that byte comparison.

## Before and after a release

Follow [AGENTS.md](../AGENTS.md) for the complete authorized release chain.
Read-only diagnosis does not authorize a release:

```sh
git status --short --branch
make check
git diff --check
make verify-live
```

A Console change also requires `make console-verify` before release.
`make verify-live` compares live bytes against the committed artifact.
A local build, successful push, provider deployment, successful CI run, and
verified public artifact are distinct facts; report each only when proved.

The [verifier](../scripts/verify-live.mjs) defaults to the Vercel alias.
Check the canonical domain and printed `/start` route separately when
diagnosing DNS or onboarding problems; a working alias cannot establish
that the printed domain is usable. `DEVMATRIX_LIVE_FILE` selects another
committed artifact for a deliberate verification target; keep production
defaults aligned with the provider configuration.

Changing the provider Root Directory, output path, or host requires a
coordinated change to the provider and the release/verifier configuration.
The original failed cutover demonstrated that a root `vercel.json` can be
read even while the project's Root Directory points elsewhere.
[ADR-0034](adr/ADR-0034-vercel-pro-hosting.md) preserves the coordinated-cutover
rule; changing files alone does not change the dashboard.

## Enforcement still to close

The 2026-09-08 read-only GitHub check found classic `main` protection enabled:
admin enforcement on, force pushes off, branch deletion off. **Required status
checks and required pull-request reviews were unset.** Earlier statements
that protection was unavailable on a private free-plan repository are obsolete.

Vercel's Git integration and repository checks are separate systems.
The repository does not itself establish that Vercel waits for all CI jobs
before serving a push. CI's `verify-production` job currently depends on
`validate`, while Console build and firmware compile run separately.
A successful artifact-verification job alone is therefore not proof of the
whole workflow passing. Confirm provider gating and required checks before
claiming production is protected against failed builds; the
[full review](reviews/2026-09-08-full-review/README.md) records the remaining
release-tooling gaps. Do not bypass the existing release chain to close them.

## When production is wrong

1. Record the failing URL, time, response status/hash, expected commit, exact
   CI run, and provider deployment result. Keep credentials out of the report.
2. Check whether the issue is DNS/redirect, stale artifact, a failed build,
   or a product behavior that also occurs in the device-served Console.
3. Prepare a minimal fix or a reviewed revert of the offending change. A
   revert creates a new commit; do not reset shared history.
4. Once a release is authorized, use the normal release chain and prove the
   canonical domain, guide redirect, and artifact again.

No provider-side instant-rollback drill is recorded here. A provider rollback
would change what is served without moving Git and needs explicit incident
authorization plus reconciliation afterward. The device-served Console is
the owner's fallback while the hosted page is being repaired.

## Secrets and credentials

- The repository sensitive-data gate checks tracked files for known credential
  signatures; `.env*` files are ignored. This is detection, not proof that
  every secret format or historical commit is clean.
- CI credentials belong in GitHub Actions secrets and provider settings.
  Operator tools may use the operator's authenticated local session; never
  print, copy into a report, or commit those credentials.
- Device-held credentials and firmware-signing keys are owned by
  [SECURITY.md](SECURITY.md). Host-app configs, tokens, and provider keys have
  different storage paths documented in [examples/README.md](../examples/README.md).
  Do not promise that every provider key is stored on the panel: Pixlet keys
  live on the owner's host.
- Bench Wi-Fi credentials, receiver endpoints, raw flash/NVS backups, and
  owner configuration stay in private local files. A factory-wipe record
  belongs in hardware evidence; its secret contents do not.
- For an exposed credential, revoke or rotate it first and assess the affected
  surface. History cleanup is a separate coordinated operation: it rewrites
  shared history and is not authorized by an ordinary docs fix. Extend the
  detection gate for the observed leak class after reviewing false positives.

## Monitoring and release artifacts

[CI](../.github/workflows/ci.yml) runs repository, Console, and firmware checks.
It also schedules daily artifact verification at `09:17 UTC` and repeats
production verification on pushes to `main`. Inspect the actual run result;
a schedule declaration is not evidence that every run completed or that an
incident notification reached an operator.

Firmware, recovery images, Registry metadata, and app packages are intended
to become signed, mirrorable GitHub Release assets. The current tree has
firmware compile checks but no completed signed-artifact release pipeline.
Follow the [roadmap](../ROADMAP.md) for that gate and
[SECURITY.md](SECURITY.md) for signing responsibilities. Historical tags and
bench binaries are not a signed public recovery distribution.

When those assets exist, extend monitoring to availability, hashes,
signatures, and correspondence to release commits. No device telemetry is
needed. Owner-visible device diagnostics and fleet capabilities are owned by
[PORTAL.md](PORTAL.md) and [MODES.md](MODES.md).
