# ADR-0027 — One Console codebase; the device bundle is generated and committed

**Status:** Accepted · 2026-08-09 · supersedes ADR-0005

## Context

ADR-0014 decided the production Console stack: Preact + TypeScript +
Vite, one codebase serving device-local and hosted-simulator modes.
Nothing implements it. ADR-0005 pins `portal/prototype/` to a single
static file with zero dependencies and mock data only until superseded,
and CLAUDE.md and AGENTS.md restate that rule.

The result is two hand-written Consoles that share no source:
`portal/prototype/index.html` (2,459 lines) and
`firmware/dk01/web_console.h` (710 lines). They drifted. The prototype
navigates dashboard · devices · apps · deploy · dev console · security ·
settings — the docs/PORTAL.md information architecture. The device
serves Dashboard · Paint · Flights · Update · Settings · API: three
views in no specification, five specified views missing.

docs/PORTAL.md states that the device serves the *complete* Local
Console, so this is a specification violation rather than a variation,
and it recurs whenever either side moves. Work framed as "improve the
Console" has had no checkable definition.

## Decision

Supersede ADR-0005. Build `portal/console/` per ADR-0014 and emit two
artifacts from one source:

- **Device** — gzipped bundle compiled in as a *generated* C header
  replacing `firmware/dk01/web_console.h`, served from `PROGMEM` via
  `send_P` with `Content-Encoding: gzip`.
- **Hosted** — static bundle for the domain in ADR-0025.

**The generated header is committed.** A fork therefore opens
`firmware/dk01/dk01.ino` in the Arduino IDE and builds with no Node
toolchain installed, preserving the M2 acceptance bar — a new developer
builds and flashes from a clean machine in under fifteen minutes. Only
Console developers need the build step.

Measured before deciding: the prototype gzips to 40 KB against today's
33 KB served *uncompressed*, so wire bytes fall. `send_P` streams from
flash, so heap cost stays zero either way.

## Consequences

`portal/prototype/index.html` becomes the design reference and is
retired once `portal/console/` reaches parity; until then it stays the
deployed demo. CLAUDE.md's prototype rule and the matching AGENTS.md
line are rewritten in this change. CI builds both targets, and
`scripts/check-repo.mjs` gains dependency-provenance checks per the
clean-room rule.

Console changes then happen in exactly one place, and demo-versus-live
divergence cannot recur structurally rather than being prevented by
discipline. Accepted cost: the repository gains a Node build step and a
generated artifact that must be regenerated and reviewed whenever the
Console changes.
