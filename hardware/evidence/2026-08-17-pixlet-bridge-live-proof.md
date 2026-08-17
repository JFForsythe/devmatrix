# Evidence — Pixlet bridge end-to-end on real hardware

**Date:** 2026-08-17 · **Gate:** ADR-0030 acceptance (owner-hosted
Pixlet bridge) · **Hardware:** DK-01 `DMX-AC93-7A08` at `10.0.0.32`,
firmware v0.12.0 · **Host:** the owner's Intel Mac.

## Method

- `bridge.mjs --self-test` (hardware-free): RGB565 byte order, delay
  clamp, GIF disposal-mode coalescing — all pass.
- Tronbyt Pixlet **v0.53.1** (`darwin-amd64` release binary, public
  github.com/tronbyt/pixlet) + a fresh shallow clone of
  github.com/tronbyt/apps — measured catalog: **1,045 app
  directories** (docs/MANUAL.md's "1,000+" restored on this basis;
  ADR-0030's "hundreds" was the pre-measurement estimate and stands as
  written).
- Owner-side config (`BRIDGE_CONFIG`) pointing at the device;
  token via `DMX_TOKEN` env, never in JSON.
- `bridge.mjs --check` preflight: token, binary, apps checkout, device
  health — all ok.
- `bridge.mjs --once dvdlogo` (zero-config catalog app).

## Result

**`Pushed 150 frame(s) for dvdlogo.`** The animation rendered on the
physical panel through the complete pipeline: Starlark app → Pixlet
GIF → disposal-coalesced frames → RGB565 little-endian → authenticated
`POST /api/v1/display/frame` at the bridge's paced cadence → panel.
First end-to-end proof of the ADR-0030 path on hardware, and of the
frame layer under firmware v0.12.0 (post-hardening: body cap and CORS
middleware active — LAN host-tool traffic unaffected, as designed).

## What this does not prove

Catalog apps needing per-app API keys were not exercised; the
long-running rotation service (installer path) was deliberately not
installed — this unit is scheduled for repurposing. The `--once` path
exercises render, coalesce, encode, auth, and push; scheduler
longevity rides the (still owed) soak on the next unit.
