# Repository controls, documentation, and product review

Review date: 2026-09-08. Source baseline: `180f0572edebe133c7e7f22bf5b2c962dfee7f4b`.
This is a point-in-time assessment; owner documents remain authoritative.
Source line references below use the baseline unless stated otherwise.

## R1 · High — release preflight omits the Console build gate

`Makefile:11–12,19–20` runs tooling tests and the repository checker. It does not
compile firmware or typecheck/rebuild the Console. `scripts/ship.mjs:477–478`
calls only `make check` and `git diff --check` before staging; it never calls
`console-verify`. `AGENTS.md:104–107` requires that gate for Console changes.
A source-only Console edit can therefore pass automated local release
preflight, push, and fail artifact-drift CI afterward. The old August review
identified this; adding an optional Make target did not wire it into release.

The existing `console-verify` also needs a pre-commit-safe comparison:
`Makefile:14–16` rebuilds and runs plain `git diff --exit-code`, which compares
working files against the index. Correctly regenerated, uncommitted artifact
changes therefore fail this target until staged. Pre-staging is expressly
refused by `ship.mjs:457,247–255`; inserting the target unchanged into its
preflight would reject valid Console changes as well as stale artifacts.
The target is appropriate on a clean committed tree, as used by CI, but its
comparison is not sufficient for the required pre-commit workflow.

Fix: capture the intended source/artifact content, rebuild in an isolated
snapshot, and compare rebuilt bytes to that intended artifact set before any
release mutation. Invoke this verification when source/build inputs change,
with artifact regeneration and review occurring before release. Add both
fixtures: matching changed source/artifacts must pass without pre-staging;
stale or mismatched artifacts must refuse before stage/commit/push. Keep the
normal non-force release path.

## R2 · High — branch protection does not require successful checks

Read-only GitHub API inspection of `repos/JFForsythe/devmatrix/branches/main/protection`
on the review date returned `enforce_admins.enabled: true`, force-push and
branch-deletion disabled, but `required_status_checks: null` and
`required_pull_request_reviews: null`. Repository visibility is public.
The old private/free-plan explanation is no longer current.

`ship.mjs` waits for CI after pushing, but that wait observes a result; it
cannot prevent an independently connected deployment provider from deploying
while CI runs. `.github/workflows/ci.yml:129–135` makes production verification
depend only on repository validation, with firmware and Console jobs separate.
Vercel dashboard promotion settings were not inspected, so an actual current
failed-build promotion was not reproduced.

Fix: design required checks and deployment promotion together so production
is promoted only after the exact commit passes every required job. The
existing direct-main release contract must continue to work or be revised
explicitly; enabling checks blindly can strand that workflow. Prove refusal
with a controlled failing candidate before calling the policy enforced.

## R3 · Medium — the default production probe misses the printed domain

`scripts/ship.mjs:15` pins the Vercel alias; `scripts/verify-live.mjs:10` defaults
to that alias too. A broken DNS record, certificate, or `/start` redirect at
the printed canonical domain can leave the release gate green.

This review separately fetched both public origins: both returned HTTP 200
and the same committed 143,051-byte Console. SHA-256:
`b3bfdc54d85301a7ef7d1e59fc0b996964f845fab6e1f8ae2b42fffbd69c822a`.
That observation does not repair the automated monitoring gap.

Fix: verify the canonical origin and `/start` behavior as part of release
and scheduled monitoring, retaining the alias as an additional diagnostic.
Use an isolated fixture for a healthy alias and broken canonical origin.

## R4 · Medium — repository tests do not establish product correctness

All 48 tooling tests passed. The test corpus in `scripts/*.test.mjs` exercises
repository policy, release refusal, and artifact verification with temporary
Git repositories and injected network/provider fixtures. It does not execute
the firmware HTTP handlers, on-panel rendering, pairing UX, real MQTT,
Pixlet service lifecycle, or Console API behavior. `ci.yml` adds compilation
and artifact reproducibility, but no product-level runtime suite.

This explains why credential reuse, stale radar, malformed JSON, and broken
copied shell commands survive a green badge. Add behavior-focused tests for
the findings in this review: malformed inputs, timeouts, stale sources,
authentication boundaries, host shutdown/restart, and network-loss recovery.
Do not inflate the suite with tests that simply repeat implementation details.

The checker also checks dependency *names* appearing in adjacent READMEs
(`scripts/check-repo.mjs:304–337`), not licenses, vulnerability status, or
public-source validity. Its secret scan is a small set of known patterns
(`scripts/check-repo.mjs:557–568`), not proof that arbitrary passwords, LAN
credentials, historical secrets, or encoded data are absent.

Independent test-file review read all 24 checker, 17 release, and 7 live-verifier
tests in full. The release fixture's `make check` is a successful no-op
(`scripts/ship.test.mjs:34`), so no fixture proves Console source/artifact
coherence. Its staged-tree test verifies hash equality, not that the matched
content passed checks. The seven verifier tests cover argument handling,
hashing, remote-selection policy, and deployment-base decisions, but do not
exercise artifact mismatch, cross-origin redirect rejection, provider failure,
wrong deployment SHA, dirty-tree refusal, or remote divergence. Those are
missing regression cases, not evidence that the corresponding guards fail.
This independent pass did not rerun the already-passing suite.

## R5 · Medium — preflight validates mutable worktree content before staging

`ship.mjs:477–489` validates the worktree, then compares path names and HEAD.
It stages at line 516 and captures the staged tree at 531; line 541 checks the committed tree against that captured value. If another editor
changes the *same named path* between the validation and staging, path-set
checks still pass and the hook accepts the newly staged tree as already
validated (`.githooks/pre-commit:7–22`). The tree hash ensures the commit
matches what was staged, but does not bind that tree to what `make check`
actually read. This is a concurrent-edit correctness race, not an observed
incident in this run.

Fix: capture the content/tree to validate and verify it has not changed before
commit, or validate the final staged content with an equally explicit check.
Add a fixture that changes a named file after checks and require refusal.

## R6 · Medium — the public docs overstated the present product

Corrected in this change:

- README: stale pre-cutover hosting instructions, floating build commands,
  blanket app-count/compatibility claims, and unconditional recovery language.
- VISION/MODES: `.dmapp`, WebSocket, Registry, signing, Cloud and Eject targets
  separated from the currently usable product; public-internet data and
  cold-boot clock dependencies stated.
- USER-STORY: fictional target journey and timings explicitly labeled;
  canonical demo identifiers preserved.
- MANUAL: navigation by task; working API placeholders; quoted token example;
  files for apostrophe-containing JSON; explicit USB board selection; first
  message and post-update success checks; host-versus-device distinction;
  offline switch-device workaround and identity-check limits.
- FIRMWARE/SECURITY/contracts: source-backed behavior and unimplemented
  safeguards clearly distinguished by the firmware review.
- Console/examples/hardware/operations guides: current paths, expected results,
  setup limitations, service caveats, and dated evidence navigation.
- ROADMAP and production-plan header: current acceptance versus historical
  blueprint separated. August review bodies and accepted ADRs remain intact.

The product UI still contains some older claims; docs corrections do not fix
those strings or the underlying code. See the [Console review](console.md).

## R7 · Medium — contributor and release artifacts need a complete ownership path

The repository includes a GPL license and an ADR defining the intended
license split; it lacks the complete license/SBOM/provenance enforcement
promised by ADR-0010 and the production plan. Prose statements of intended
licensing are not a machine-checked license inventory. Do not infer legal
compliance from this technical review.

Similarly, a dated first-ship note is not a complete per-unit record,
qualified production BOM, approved cost model, support/RMA process, or proof
that every gate passed. Hardware and operations findings are detailed in
[the assigned review](examples-hardware-operations.md). Keep personal
manufacturing records and credentials out of this public repository.

## What is already useful

The single Console source with reproducible committed artifacts keeps bare
firmware forks usable without Node. The local API and owner-hosted integrations
allow useful content without company compute. The explicit app tiers prevent
an ESP32 from being sold as an unlimited application server. The clean-room
boundary, immutable ADRs, exact-file release scope, and refusal to call a failed
push verified are sound foundations. Preserve them while closing the gaps.

## Scope and limits

Read current repository governance, root configs, release/checker/verifier
implementation, CI and test structure, all owner product docs, accepted ADRs,
and the corresponding historical review material. Standard license text was
identified, not treated as a legal opinion. All current tracked paths are
accounted for in [coverage.md](coverage.md). No other project, closed-product
source, customer account, storefront, or private customer records were reviewed.
No branch protection, deployment settings, Git commits, or hardware were changed.
