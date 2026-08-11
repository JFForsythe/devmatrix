# ADR-0030 — Pixlet ecosystem bridge, owner-hosted

**Status:** Accepted · 2026-08-11

## Context

The owner's goal: the DK-01 should be able to show "anything a Tidbyt
did" — the discontinued 64×32 display whose community wrote hundreds
of apps (weather, transit, sports, stocks, calendars). After Tidbyt's
cloud shut down, the Tronbyt community forked and actively maintains
both the open-source **Pixlet** app engine and a hard fork of the
community app catalog, all Apache-2.0, designed to run with no company
server — and rendering natively at 64×32, the DK-01's exact panel.

Tidbyt's architecture was precisely this repo's host-app tier
(ADR-0026): apps run on a bigger machine, frames get pushed to a thin
display. ADR-0029 already reserves the frame layer for LAN transports.

## Decision

Ship an owner-hosted **Pixlet bridge** as a first-class host app in
`examples/`: it runs the Tronbyt-maintained Pixlet on the owner's own
always-on machine, renders enabled community apps on their schedules,
and pushes frames to the DK-01 over the LAN `/api/v1` frame API,
rotating between apps.

Constraints, in force:

1. **The owner is the host — always.** Each owner runs their own
   bridge on their own hardware. The company operates no rendering
   service, no shared bridge, and no proxy (ADR-0016 §5); nothing in
   this decision creates standing company compute.
2. **Buyer-grade packaging.** The bridge ships with the same
   installer pattern as the flights service (install/dry-run/status/
   uninstall, 0600 secrets), plus a preflight that detects Pixlet and
   points at the Tronbyt install path for the owner's platform.
3. **Provenance and boundary.** Pixlet and the community apps are
   unrelated third-party projects under Apache-2.0; provenance is
   recorded where they are used. Devmatrix describes the bridge as
   "runs Pixlet community apps" — it does not brand itself with the
   Tidbyt trademark, and no firmware changes for this feature.
4. **API keys are the owner's** (ADR-0015 stance): apps needing
   services get the owner's own keys, configured host-side, never
   shipped or proxied.
5. **Frames stay on the LAN** (ADR-0029) — the bridge is same-LAN by
   design; remote reach is Cloud Mode's relay, never a broker.

## Consequences

The DK-01 gains a catalog of hundreds of existing apps for the cost
of one bridge script — the strongest possible answer to "what can it
do out of the box" that keeps every invariant: local-first, no
company compute, owner-owned keys and hardware. The dependency is a
community fork's health; if Tronbyt's Pixlet ever dies, the bridge
degrades to the native app tiers (ADR-0026) and nothing else breaks.
docs/GLOSSARY.md gains **Pixlet bridge**; docs/MANUAL.md documents
setup when the bridge lands; docs/FIRMWARE.md's host-app tier notes
ecosystem bridges. The storefront caveat is unchanged and now pulls
extra weight: rich apps need a computer the owner keeps on — theirs.
