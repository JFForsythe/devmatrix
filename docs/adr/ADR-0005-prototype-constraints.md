# ADR-0005 — Prototype is one static HTML file

**Status:** Accepted · 2026-08-04

## Context
We need a high-fidelity Console to make decisions against, fast, without
committing to a production stack or accumulating dependencies that drift.

## Decision
`portal/prototype/` is a single self-contained `index.html`: inline CSS
and vanilla JS, mock data only, zero dependencies, zero network calls,
no build step. It runs by opening the file or `make portal`. Mock
identifiers must match docs/USER-STORY.md. The production stack is
chosen at gate P1 — the prototype is a spec, not a foundation, and will
be thrown away without ceremony.

## Consequences
No component reuse into production — intentional; rewriting against a
real stack is cheaper than untangling a prototype that grew load-bearing.
Single-file keeps review trivial and the demo portable (works from a
USB stick).
