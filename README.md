# Devmatrix — Dev Kit by FlightTrackerLED

[![Repository checks](https://github.com/JFForsythe/devmatrix/actions/workflows/ci.yml/badge.svg)](https://github.com/JFForsythe/devmatrix/actions/workflows/ci.yml)

A hackable 64×32 LED matrix appliance for people who want a beautiful
object they fully control: open firmware, stable documented APIs, and a
control portal (the **Console**) for shipping your own apps to your own
hardware — over the air from your browser, or over USB.

Not the closed FlightTrackerLED appliance — a canvas platform with
bundled apps, including a tiny local-only flight display fed by your
own receiver. No closed-product code, logic, or schemas, ever.
See the IP line in [docs/VISION.md](docs/VISION.md).

## Start here

| You want to… | Read |
|---|---|
| **Use the box** — setup, Console, apps, updates, recovery | [docs/MANUAL.md](docs/MANUAL.md) |
| Understand the product & brand | [docs/VISION.md](docs/VISION.md) |
| Feel the buyer's journey (canonical example) | [docs/USER-STORY.md](docs/USER-STORY.md) |
| The Console spec — pages, features, modes | [docs/PORTAL.md](docs/PORTAL.md) |
| Local vs Cloud — what's free, what's paid, what dies | [docs/MODES.md](docs/MODES.md) |
| Threat model, keys, security ceremonies | [docs/SECURITY.md](docs/SECURITY.md) |
| Firmware plan (living tree from P1 — ADR-0024) | [docs/FIRMWARE.md](docs/FIRMWARE.md) |
| Full DK-01 production execution blueprint | [docs/PRODUCTION-PLAN.md](docs/PRODUCTION-PLAN.md) |
| Company-side ops — hosting, deploys, secrets | [docs/OPERATIONS.md](docs/OPERATIONS.md) |
| Draft API contracts (MQTT first) | [contracts/README.md](contracts/README.md) |
| Hardware gate evidence, procedures, manufacturing files | [hardware/README.md](hardware/README.md) |
| Why we decided X | [docs/adr/](docs/adr/) |
| What happens next, and in what order | [ROADMAP.md](ROADMAP.md) |
| Canonical names, IDs, formats | [docs/GLOSSARY.md](docs/GLOSSARY.md) |

## Try the Console

Hosted URL: **https://devmatrix-console.vercel.app**. Until the coordinated
cutover ([docs/OPERATIONS.md](docs/OPERATIONS.md) owns the recipe and current
state) it serves the mock design reference; the switch makes this URL serve
the real, one-codebase Console.

```
make portal        # or serve it locally at http://localhost:8787
```

The command above serves the dependency-free, single-file mock at
`portal/prototype/`. It made the product decisions concrete before firmware
existed and remains the design reference. The production source and committed
hosted artifact live under `portal/console/` (ADR-0027); deployment handoff is
documented in [portal/console/README.md](portal/console/README.md#vercel-handoff).

## Licensing

First-party code — scripts, the Console prototype, and future
firmware/console/simulator — is GPL-3.0-or-later (root [LICENSE](LICENSE));
documentation is CC BY 4.0. `contracts/` and SDKs adopt Apache-2.0 with their
first code or schema artifact; hardware files adopt CERN-OHL-S-2.0. Code
samples inside docs carry their stated software license. Full scheme:
[docs/adr/ADR-0010-license-scheme.md](docs/adr/ADR-0010-license-scheme.md).

## Rules of this repo

See [CLAUDE.md](CLAUDE.md) for product boundaries and [AGENTS.md](AGENTS.md)
for the tool-neutral definition of done. The short version: one owner file
per topic, every decision lands as an ADR, `make check` is the shared gate,
the clean-room boundary is absolute, and the Console is one codebase built
to two targets (ADR-0027) — the prototype stays a single-file design
reference until `portal/console/` reaches parity. Commit, push, deploy, go live,
publish, and ship are release verbs: an affirmative request using any one runs
the complete validated commit-to-production chain defined in `AGENTS.md`.
