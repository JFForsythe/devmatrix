# Step 08 — Ops and release pipeline

Produced by a dedicated pipeline deep dive (every script + test read in
full; live state checked with `node --test`, `check-repo`, `gh run
list`, `gh api` for branch protection and deployments). Key live facts
it established, quoted from command output: all 48 script self-tests
pass; last 5 CI runs green (24–34 s each); the repo is private with
branch protection unavailable on the current plan (HTTP 403 "Upgrade to
GitHub Pro or make this repository public"); Vercel deployment records
exist per pushed commit, created by `vercel[bot]` seconds after each
push; zero GitHub Releases; zero git tags; no root `vercel.json`.

## What is genuinely strong

- **ship.mjs implements all 8 AGENTS.md release steps**, in order,
  fail-closed: exact-change assertion (the tree must equal the named
  file list), literal-pathspec staging, tree-hash re-validation, remote
  re-checks before commit and push, CI wait keyed to the exact SHA with
  "pushed, CI failed — not verified" wording on failure, then
  deployment + byte-proof delegated to verify-live. Release lockfile,
  branch pinning to `main`, and origin URL identity checks go beyond
  the doc. State strings are set only after their verifying call
  returns — no way to claim success without proof today.
- **verify-live proves content byte-for-byte** (sha256 + Buffer
  equality) against the committed artifact with cache-busting, redirect
  origin pinning, and a fail-closed unreachable-base rule that is
  negative-tested.
- **CI hygiene is excellent**: `permissions: {}` top-level, per-job
  read-only grants, `persist-credentials: false`, actions pinned to
  full commit SHAs, no cache to poison, weekly grouped dependabot for
  actions.
- The Stop hook in `.claude/settings.json` only warns on a dirty tree
  and exits 0 — it matches CLAUDE.md/AGENTS.md exactly and can neither
  block nor publish.

## Findings

- **[P1] Deploys are not gated on CI.** The Vercel GitHub App deploys
  each push to main immediately — the latest deployment record was
  created 4 seconds after CI *started* a 34-second run. A commit that
  fails Repository checks still goes live at the public URL; the verify
  chain detects it afterward but neither prevents nor rolls back.
  Needs Vercel's require-checks/Ignored-Build-Step gating (or a
  CI-driven deploy) before anything is sold.
- **[P1] No server-side enforcement on `main`.** Branch protection is
  unavailable (private repo, free plan — verified 403). Every
  safeguard lives in ship.mjs convention; a plain `git push` bypasses
  all of it. Making the repo public (GA requires public source anyway)
  or upgrading unlocks required status checks and force-push
  protection.
- **[P1] No firmware pipeline exists at all.** Firmware is never
  compiled in CI (no arduino-cli anywhere in the automation); there
  are no versioned artifacts, no signing implementation, no OTA
  manifest tooling, no releases, no tags, no changelog.
  `FW_VERSION "0.11.0"` is a `#define` tied to a commit only by
  commit-message convention. (Signed OTA is M0's gate; the *compile
  check* has no reason to wait.)
- **[P2] The local gate is weaker than CI.** Committed-artifact drift
  (dist-hosted + generated device header vs a rebuild) is checked only
  by CI's console-build job. `make check` — which the pre-commit hook
  and ship's preflight run — never builds the console, so a stale
  generated header is caught only *after* push, landing in "pushed, CI
  failed" instead of being refused pre-push.
- **[P2] No TypeScript typecheck anywhere.** Vite/esbuild transpiles
  without checking; `tsconfig.json` is never enforced by any gate, so
  CI passes with type errors in the console.
- **[P2] Node version split in CI.** validate/verify-production run
  Node 24 (`.node-version`); console-build hard-pins Node 20 with no
  documented rationale. Local regeneration on 24 vs CI's 20 is a
  latent determinism-confusion trap.
- **[P2] Two OPERATIONS.md claims are present-tense with no machinery
  behind them** (also logged as doc findings in step 02): "static
  artifact availability and integrity are monitored" (no scheduled
  job of any kind exists) and release artifacts "ship as signed GitHub
  Release assets" (zero releases exist). A nightly scheduled
  verify-live run would implement the first almost for free.
- **[P2] Step 2's "review" is self-attestation.** `--confirm-reviewed`
  is a flag; the staged *content* diff is never displayed by ship.mjs
  (only --stat/name-status). Honesty rests on the caller. Acceptable
  solo pre-sale; not a GA answer.
- **[P2] No hosted-console rollback procedure** is documented — the
  implicit revert-and-ship path is untested; Vercel instant rollback
  is unmentioned in OPERATIONS.md.
- **[P2] npm ecosystems get no automated updates** — dependabot covers
  only github-actions; no npm audit runs for `portal/console` or
  `examples/pixlet-bridge`.
- **[P3] Rapid successive pushes can strand a release**:
  `cancel-in-progress: true` cancels the prior push's CI run, which
  ship then reports as "pushed, CI failed" (fail-closed, but a
  false-alarm generator on a two-release afternoon).
- **[P3] Cutover constants live in three places** across two files
  (ship.mjs RELEASE_URL, verify-live DEFAULT_URL + DEFAULT_FILE); the
  ADR-0016 cutover must change all of them together, and only one
  carries a comment saying so.
- **[P3] CI-wait run matching accepts a PR-flavored run** of the same
  name/SHA (which skips verify-production). No integrity gap today —
  ship separately proves deployment and bytes — but the "CI succeeded"
  claim can mean fewer jobs than a push run.
- **[P3] verify-live proves content, not provenance** — byte-equality
  plus an independent deployment-success check; which deployment
  actually served the bytes is inferred (`x-vercel-id` logged, never
  asserted). Harmless for a single static file; a real gap if the
  bundle ever stops being single-file.

## One memory correction (session-side, not repo)

The assistant's project memory said the Stop hook "handles checkpoints"
(auto-commits). Verified false — the hook only warns, and AGENTS.md
forbids automation committing on session end. The memory is corrected
as part of this review so future sessions don't rely on a phantom
checkpoint.
