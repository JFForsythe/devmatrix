# Step 01 — Governance and repository health

Reviewed personally: AGENTS.md, CLAUDE.md, PLAN.md, Makefile, ROADMAP.md,
checker output, git state. Pipeline internals are covered in step 08.

## What is solid

- **Operating contract.** AGENTS.md defines a complete, fail-closed
  release chain (check → exact-file stage → commit → push → CI wait for
  the exact commit → deployment wait → `make verify-live`), a four-state
  reporting rule (local/committed/pushed/deployed), and a clean-room
  gate wired into CI. This is stronger than most production repos.
- **Truth map discipline.** CLAUDE.md's one-owner-file-per-topic rule is
  real: PLAN.md is verifiably still a pointer (PLAN.md:18), OPERATIONS.md
  links instead of restating (docs/OPERATIONS.md:23-25, 79-81), and the
  MANUAL carries the Today/Ahead honesty labels (docs/MANUAL.md:8-15).
- **Baseline checks pass.** `node scripts/check-repo.mjs` passes at
  `444691f` (63 Markdown files, 169 concrete HTML ids); tree clean and
  pushed.
- **ADR chain is coherent.** 33 ADRs; supersessions are explicit
  (0005→0027, 0022→0023, 0009 amended by 0024/0026); ROADMAP.md carries
  the amendments inline (ROADMAP.md:94-104).

## Findings

- **[P1] P0 gate is still open — storefront claims sweep.** ROADMAP.md:20
  names the storefront claims sweep as the open owner-only P0 item; P0's
  exit is "no unsupported product claim in repo or storefront"
  (docs/PRODUCTION-PLAN.md:362-364). Until the dev-kit listing sweep is
  done and recorded, the *first* gate of the ladder is not passed.
- **[P1] The repo-side no-unsupported-claim rule is currently violated
  by the manual's hosted-Console text** — evidence in step 02, finding 1
  (domain does not resolve; live deployment still serves the prototype).
  Listed here because it is a P0-exit criterion, not just doc drift.
- **[P2] Firmware is invisible to the automated gate.** `make check`
  validates docs/prototype/scripts but never compiles `firmware/dk01`
  or builds `portal/console` (details in step 08). The repo's strongest
  quality claim — "definition of done requires code, tests, docs agree"
  (AGENTS.md:34-44) — is enforced by convention, not automation, for
  the two biggest artifacts. PRODUCTION-PLAN section 4 requires a
  firmware compile matrix and Console typecheck in the canonical check;
  both are absent today. (Gate P2 work, but cheap to start now.)
- **[P3] `make portal` still serves the prototype** (Makefile:31-33).
  Correct today (the prototype remains live production), but it becomes
  a stale affordance at cutover; retire it in the cutover commit.

## Verdict

Governance is genuinely production-grade on paper and mostly in
tooling. The open items are the storefront sweep (P0 exit), making the
manual's hosted-path text truthful, and closing the automation gap so
firmware/console builds are part of the same gate as everything else.
