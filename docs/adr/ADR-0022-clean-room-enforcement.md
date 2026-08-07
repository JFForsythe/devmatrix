# ADR-0022 — Automated clean-room enforcement

**Status:** Accepted · 2026-08-07

## Context

ADR-0001 draws the clean-room boundary, but nothing enforced it:
scripts/check-repo.mjs carried no clean-room checks, dependencies had
no provenance requirement, and Git history predating the production
plan contains closed-product codename references and a personal
author email. docs/PRODUCTION-PLAN.md names automated enforcement a
P0 deliverable. This ADR refines ADR-0001; it supersedes nothing.

## Decision

scripts/check-repo.mjs gains a two-tier clean-room gate, run locally
and in CI with the rest of the repository checks.

Tier 1 (hard fail): closed-product identifiers — the codename,
internal repository and tooling names, flight-data services and API
names, and the closed domain — are never legitimate anywhere: code,
docs, comments, or mock data. The checker stores them base64-encoded
so the identifiers themselves never enter the repository, not even
inside the tool that bans them; they decode only in memory into
case-insensitive, word-bounded patterns.

Tier 2 (context-reviewed): the bare words flight, tracker, and
aircraft are legitimate only in a per-file allowlist inside the
checker, each entry carrying a one-line justification (brand byline,
IP line, or clean-room rule text). The plan sketched per-line
annotations; per-file entries with justifications are the adopted v1
because they keep preserved documents and brand files
annotation-free. A hit outside the allowlist fails with instructions
to remove the term or add a justified entry; extending the allowlist
requires ADR review.

Every dependency and borrowed public standard gets a public
provenance record in its PR. Until a dependency manifest exists, this
is enforced by process and the PR template, not by the checker.

Publication gate (owner action, not automation): before this
repository is ever published, the owner squashes to a clean baseline
commit or rewrites history with git filter-repo, because pre-plan
commits contain closed-product codename references and a personal
author email.

## Consequences

The gate can print a banned identifier only at runtime; the
repository itself stays free of them in decoded form. Tier-2 growth
is slow by design — a legitimate new use costs an ADR-reviewed
allowlist entry. The history rewrite remains a tracked precondition
of publication that no script performs, and the codename can never
re-enter once the tier-1 gate is green.
