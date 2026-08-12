# Evidence — one-codebase Console parity and render verification

**Date:** 2026-08-12 · **Gate:** ADR-0027 acceptance ("one source; both
Consoles from one build") and the M1 precondition that every Console
action maps to a documented API
([docs/PRODUCTION-PLAN.md](../../docs/PRODUCTION-PLAN.md)). Software
only — no hardware involved, no device attached.

This records the first end-to-end verification that the Console the
device serves and the Console served publicly are the same artifact,
and that all seven views actually render. Prior to this run the ported
views had passed type-checking and builds but had never been displayed.

## Method

- Build: `npm run build` in `portal/console/` (Node 20.9.0), producing
  the hosted single-file bundle and the gzipped device header.
- Served `portal/console/dist-hosted/index.html` over local HTTP and
  drove it in Chrome, exercising every hash route.
- Read the device header back by gunzipping the committed
  `firmware/dk01/web_console.h` byte array and inspecting the HTML.
- Firmware compile: `arduino-cli compile --fqbn
  esp32:esp32:adafruit_matrixportal_esp32s3` against the pinned
  arduino-esp32 3.3.11 core.

## Results

**Determinism.** Two consecutive builds produced byte-identical output.
Hosted bundle SHA-256
`10086cadc12da92fc309fab95db484effd692f9d47f569a1ba948f51c608663f`
(80,297 bytes). The device header regenerates identically; CI fails the
build on any drift between committed and rebuilt header.

**Self-containment.** The decompressed device Console (80,364 bytes)
contains no external asset references and no company URLs. Every network
call is a relative `/api/v1/...` path — same-origin, therefore the
device itself. The only absolute `http://` strings are mock demo data
and a placeholder for the owner-entered receiver address. This is the
mechanical proof of the local-first invariant (ADR-0003): the served
Console cannot depend on a company server because it never names one.

**Render.** All seven routes render with correct headings — dashboard,
devices, apps, deploy, dev console, security, settings. No
`undefined`, `NaN`, or `[object Object]` leaked into any view; no
unimplemented mock route was reached. Document scroll width equals
client width (no horizontal overflow). Zero console errors originated
from the page; the only errors observed came from an unrelated browser
wallet extension.

**Honest labelling.** Mock mode displays a `DEMO · MOCK DATA` chip.
Surfaces that are not yet built carry their gate label (Registry M4,
passkeys and audit log M1, signed OTA and auto-rollback M0). Destructive
actions are gated: token rotation warns that it logs out every client,
and factory reset requires typing an exact confirmation.

**Firmware budget.** v0.8.0 compiles at 1,336,915 bytes flash (63 % of
2,097,152) and 120,396 bytes of static RAM (36 % of 327,680), leaving
207,284 bytes for locals.

## What this does not prove

The build has not run on hardware. Flash and RAM figures are compile-time
only; first-boot behaviour, render timing with the app engine and MQTT
client both active, and heap behaviour under load remain unmeasured
until a unit is flashed. The hosted copy's ability to control a real
device over HTTPS is separately blocked by the browser-transport
constraints tracked as a P1 spike — this evidence covers the
device-served path, which is the authoritative one.
