# ADR-0007 — Local is the product (free); Cloud is a paid layer

**Status:** Accepted · 2026-08-04 · refines ADR-0003

## Context

The company is one person. The specced Cloud Mode (relay, accounts,
fleet, hosted snapshots) is a 24/7 operational commitment — the heaviest
standing burden in the design — while the market's strongest signal
(post-Tidbyt) is *"this box must outlive the company."* Meanwhile both
modes must be designed together or their seams will show: claiming,
tokens, and the Console UI all straddle the line.

## Decision

1. **Local Mode is the complete product, free forever.** Everything the
   box needs — claiming, control, apps, OTA (static manifest), USB
   recovery, HA/MQTT — works with zero standing company infrastructure.
   The only thing we host for it is static release files.
2. **Cloud Mode is an optional paid subscription** (target price set at
   the C-track gate; priced to fund its own operations with margin). It
   adds reach — remote access, multi-site fleet, hosted E2EE snapshot
   sync, offline alerts, guest links, mark-lost — never capability the
   box itself lacks.
3. **Both are specced now, as first-class, in one owner file:
   docs/MODES.md** (the feature matrix, dependency map, claim/account
   split, sunset covenant). Rollout may be simultaneous if the Cloud
   gates pass in time, but **Local never waits for Cloud** — Local
   readiness alone gates launch.
4. **Sunset covenant:** if Cloud Mode ever ends, subscribers get 12
   months' notice and an automatic Eject; a lapsed or dead cloud costs
   convenience only, never function.

## Consequences

Roadmap resequences: the launch-blocking track is the Local (static)
Console; the C-track becomes the paid tier behind a billing gate.
Claiming must work account-free (LAN pairing) with the passkey account
as an optional Cloud step — SECURITY.md updated. Two-tier confusion is
the new risk; MODES.md and an explicit mode indicator in the Console are
the mitigation. Pricing work (billing, tax, sunset terms) is now real
scope on the C-track.
