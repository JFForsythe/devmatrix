# ADR-0026 — Three-tier app model; declarative apps at launch

**Status:** Accepted · 2026-08-09

## Context

docs/VISION.md tier 2 promises "upload sandboxed apps, no toolchain".
docs/USER-STORY.md has the owner writing a 120-line app and dragging a
`.dmapp` onto the Console in week one. docs/GLOSSARY.md defines **App**
as user code in a sandboxed runtime.

None of that exists. The runtime is still a spike:
docs/PRODUCTION-PLAN.md benchmarks Lua 5.4 against Berry on real
hardware and records an explicit fallback — if neither passes, "remove
the on-device scripting promise before launch and support layouts plus
external JSON/MQTT rendering instead". docs/FIRMWARE.md owns the
description of that fallback.

The owner's 2026-08-09 decision reframed the product: the DK-01 is a
framework that ships everything needed to build and expand on it, apps
run on a host the owner already has, made fast and easy, and the
transport must survive that host later moving to a real server.

One piece of firmware evidence changes the shape of the answer.
`firmware/dk01/dk01.ino` already fetches and validates receiver JSON
over `HTTPClient`, and already stores per-app configuration in NVS. The
device can pull its own data. Most starter apps therefore need no
second machine at all — which the fallback wording did not anticipate.

## Decision

Elect the documented fallback ahead of the spike, and split one
overloaded word into three tiers.

1. **Declarative app** — a layout, data bindings, and a schedule,
   installed from the Console and rendered by the device, which fetches
   its own data over HTTPS or MQTT. Needs no second machine and no
   broker. Bundled: Weather, Stocks, Messages, Flights list, clock
   variants.
2. **Host app** — a program on hardware the owner already runs, pushing
   content to the device over LAN REST by default, or MQTT when they
   want Home Assistant or remote hosting. For work the device cannot
   do: Flights Overhead's 8 fps radar view is the canonical example.
3. **Scripted app** — an on-device sandboxed VM. **Deferred**, out of
   P1, and additive if a runtime ever clears the docs/PRODUCTION-PLAN.md
   bar. It is not a launch promise.

The company hosts nothing in any tier. Brokers are always the owner's
(contracts/mqtt.md, ADR-0016).

## Consequences

Rewritten in this change: docs/VISION.md tier 2, docs/USER-STORY.md's
week-one beats, docs/GLOSSARY.md (**App**, **Preloaded apps**, **Flights
Overhead**, plus new **Declarative app**, **Host app**, **App host**,
**Layout**, **Binding**), docs/FIRMWARE.md's runtime section,
docs/SECURITY.md's app-sandbox section (VM protections deferred with
their tier; the declarative enforcement surface is the binding engine),
docs/PRODUCTION-PLAN.md's runtime section and its P1/M4 gate
annotations, CLAUDE.md, and ROADMAP.md — where P1 drops the Lua/Berry
spike and M4 drops the `.dmapp` scripting runtime, per-app instruction
budgets, and VM sandbox fuzzing while keeping declarative bundles, the
Registry, permissions, and rollback.

The storefront must state plainly that host apps require a computer the
owner keeps switched on, and must stop claiming on-device scripting.
That is a P0 claims-sweep item (docs/PRODUCTION-PLAN.md) and it blocks
the first sale, not this ADR.

Accepted cost: the declarative engine is new firmware scope — layout
schema, binding engine, and fetch scheduler — that no earlier gate
costed. It is worth it because it converts "you also need a Raspberry
Pi" into "you need nothing" for the majority of starter apps, and it
preserves the one-click, no-toolchain install promise that the plain
fallback would have withdrawn.
