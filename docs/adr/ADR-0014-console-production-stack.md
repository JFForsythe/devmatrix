# ADR-0014 — Console production stack: Preact + TypeScript + Vite

**Status:** Accepted · 2026-08-07 · part of the ADR-0009 adoption set

## Context

ADR-0005, the old ROADMAP.md, and docs/PORTAL.md all deliberately
reserved the production Console stack so the throwaway prototype could
not harden into a foundation by accident. The approved production plan
(docs/PRODUCTION-PLAN.md) needs that reservation closed: one real
codebase must serve both the device-hosted Local Console and the
hosted simulator, and the browser constraints it depends on have
named feasibility spikes at gate P1.

## Decision

The production Console stack is Preact + TypeScript + Vite: one
codebase shared by the device-local and hosted-simulator modes. This
is the formal stack decision the old gate reserved. The P1
browser-transport spike remains its acceptance gate — if P1 falsifies
the browser constraints the Console depends on, the stack decision is
revisited by a superseding ADR, not silently patched.

The following Console technical commitments land with the stack:

- Typography is the system UI stack at normal 400 weight plus the
  native monospace stack for terminals; no runtime font download.
- Terminals are custom DOM components, never a full shell or heavy
  terminal emulator. The REPL runs in a disposable app sandbox and
  never exposes the ESP host.
- One transport abstraction covers real LAN devices, WebSerial
  setup/recovery, and the simulator. Each transport publishes a
  capability descriptor in `contracts/` (bandwidth class, concurrent
  streams, auth model, frame-preview support) so the Console degrades
  declaratively, never by accident.
- The simulator emulates the device's connection cap, handshake
  latency, and stream backpressure as part of conformance.

This ADR does not supersede ADR-0005: `portal/prototype/` stays a
single static mock-only HTML file, and no prototype code flows into
the production Console. No production Console code exists yet; it is
authorized only after the P2 contract freeze.

## Consequences

docs/PORTAL.md records the stack and drops its open question, keeping
the P1 spike as a launch gate. Transport degradation becomes contract
work in `contracts/`, not per-UI special-casing, and simulator
conformance gains explicit timing and backpressure requirements. If
P1 fails, the cost is one superseding ADR — never an entangled
prototype migration.
