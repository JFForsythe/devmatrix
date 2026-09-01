# Production-readiness review — scope and method

**Date:** 2026-08-16 · **Baseline commit:** `444691f` (main, clean tree, in sync with origin)
**Review:** full-depth pass, requested by John.

## Question under review

What is everything still needed to make devmatrix production-perfect —
i.e., to walk the ROADMAP.md ladder (P0 → GA) with no unresolved
critical gap in code, docs, security, hardware evidence, or ops?

## Baseline state at start of review

- `node scripts/check-repo.mjs` — **passing** (63 Markdown files, 169 concrete HTML ids).
- Working tree clean; `main` == `origin/main` at `444691f`.
- Firmware at v0.11.0 (ADR-0032 "the box never scans"); 33 ADRs; Console rebuilt at `portal/console/` (ADR-0027).
- ROADMAP position: **P0 in progress** (open item: storefront claims sweep); P1 evidence exists in `hardware/evidence/`; firmware is a living tree per ADR-0024.

## Method

Each numbered step in this directory is one deep-dive area. Every
finding carries a severity and file evidence. Severities:

- **P0 — production blocker**: violates an invariant, a security hole, or a gate cannot pass.
- **P1 — must fix before the affected gate**: gap in a gate's acceptance criteria.
- **P2 — should fix**: drift, doc contradiction, or robustness gap.
- **P3 — polish**: nice-to-have before GA.

Steps:

| Step | File | Area |
|---|---|---|
| 00 | this file | Scope, method, baseline |
| 01 | 01-governance-repo-health.md | AGENTS/CLAUDE contracts, checker, CI, hooks |
| 02 | 02-product-docs-truth-map.md | Owner docs consistency, ADR-wins rule |
| 03 | 03-firmware-deep-dive.md | firmware/dk01 code, security, invariants |
| 04 | 04-console-deep-dive.md | portal/console code, build targets, parity |
| 05 | 05-contracts-and-examples.md | contracts/ vs implementations, examples |
| 06 | 06-security-audit.md | Threat model vs implemented reality |
| 07 | 07-hardware-and-gate-evidence.md | hardware/evidence vs P1/EVT acceptance |
| 08 | 08-ops-release-pipeline.md | ship/verify-live/CI/Vercel chain |
| 09 | 09-gate-ladder-assessment.md | P0→GA scorecard against PRODUCTION-PLAN §3 |
| 10 | 10-findings-and-plan.md | Master prioritized findings + production plan |

Review is read-only: no product code or owner doc was modified during
it. Fixes are proposed, not applied.

## Clean-room note

Per ADR-0001/0023 and AGENTS.md, no FlightTracker closed-product
source, docs, or schemas were opened or compared against at any point
in this review.
