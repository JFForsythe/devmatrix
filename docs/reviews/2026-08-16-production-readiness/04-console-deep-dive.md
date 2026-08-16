# Step 04 — Console deep dive (portal/console)

Produced by a dedicated deep dive (all 19 src files, build config,
generated artifacts, prototype, cross-referenced against PORTAL.md,
USER-STORY.md, MODES.md, ADR-0025/0027/0031/0032 and the firmware
routes). Key claims re-verified in the tree (localStorage keys, absent
CSP, absent timeout, mock versions, live-deployment hash — the latter
confirmed independently in step 02).

## The dominating fact

**The rebuilt Console is committed but not deployed.** Production
serves the prototype (byte-verified in step 02); `verify-live.mjs`
still defaults to `portal/prototype/index.html`; no root `vercel.json`
exists; the ADR-0025 domain has no DNS record. Everything below
describes code that is not yet the live artifact.

## Security

- **Strongest point — XSS hygiene is exemplary.** Zero `innerHTML`,
  `dangerouslySetInnerHTML`, `eval`, or `document.write` in src/
  (verified); all device-supplied JSON renders as escaped text nodes.
  A hostile device response cannot inject markup.
- **Dependencies: minimal and exact-pinned.** 4 runtime deps
  (@noble/ed25519, @noble/hashes, fflate, preact), all MIT, provenance
  table checker-enforced. No concern.
- **[P2] No Content-Security-Policy on any target** (verified: zero
  CSP tags in console index, dist-hosted, prototype; no vercel.json to
  add headers). The bundle is fully self-contained, so a strict CSP is
  cheap — add it at cutover.
- **[P2] LAN token persists in `localStorage`** (`dmx_token`,
  transport.ts:19,43-59 — verified) along with the pinned key. No XSS
  sink exists today, so contained — but for a GA buyer origin,
  localStorage + no CSP is a defense-in-depth gap worth an explicit
  decision (session-scoped vs persistent is also a UX choice).
- **[P2] First-contact identity is TOFU but the Welcome copy says
  "verified".** The Ed25519 proof authenticates *continuity*, not
  first contact (any spoofer's self-consistent key pins fine);
  WelcomeView tells the user the device "verified its identity" on
  first connect. Reword to first-use-pinning language — the real
  first-contact proof is the panel claim code.
- **[P2] Legacy downgrade path.** If `identity/verify` fails, status
  becomes "legacy" and CONNECT ANYWAY proceeds with **no pin** — an
  attacker gets this by simply not implementing the endpoint.
  By-design for pre-0.9.0 firmware; needs at least a scarier warning
  and probably a remembered per-device "expect identity" bit.
- Good: key-mismatch fails loudly, requires explicit TRUST THE NEW
  KEY, and claim-finish re-checks the pin and throws on mismatch.

## Robustness

- **[P2] No timeout on the primary transport path** (verified:
  `request()`'s fetch has no AbortController; only the health probe
  has an 8 s timeout; OTA XHR has none). A device that accepts the
  socket but never responds hangs the call; Dashboard/Apps/Settings
  poll every 2.5–5 s, so stalled requests pile up. This is the most
  material console robustness gap.
- Good: offline chip + friendly errors on network failure; 401 opens
  the pairing modal and retries the interrupted request exactly once;
  every polling effect has an active-flag cleanup; brightness input is
  debounced against poll clobber.
- [P3] Pairing modal lacks a focus trap/Escape/focus-restore;
  listener registration happens in the render body; three duplicate
  base64 helpers; dead `isOnline` getter.
- TypeScript `strict: true` and honored; but note (step 08) nothing
  runs `tsc` in CI.

## Parity vs PORTAL.md

Honestly gate-chipped in the UI: signed OTA + rollback (M0), passkeys
+ audit log (M1), Registry/.dmapp (M4), Cloud (C1). **Missing with no
gate chip** — the only spec items whose absence is undocumented:

- **[P2] Console-wide search / Cmd+K command palette** (PORTAL
  mandates it on every post-claim screen; the prototype had it).
- **[P2] Live Mirror** — the story's T+0:04 beat; console has a paint
  canvas but no read-back of what the panel shows.
- **[P2] Root-of-trust enrollment** — invariant 5's surface; absent
  without even a chip.
- **[P2] Eject** — the ownership promise; absent without a chip.
- Device workbench panes, API keys, WS event tail, metrics history:
  M2-flagged in GLOSSARY; acceptable.

Conversely the console has ADR-backed features PORTAL.md's IA table
never absorbed (command terminal, finder prompt, NWS template, Pixlet
card) — PORTAL.md needs a refresh pass [P3].

- **[P2] The implemented claim ceremony differs from PORTAL/
  USER-STORY.** Spec: bidirectional session code ("CLAIM → 7F2Q?") +
  2 s button hold. Implemented: one-way 6-digit panel code typed into
  the browser. MANUAL correctly labels the full ceremony Ahead·M1, but
  PORTAL's five-minute path and the story present it untagged — and
  the story text is CI-load-bearing (the checker extracts `7F2Q`).
  Reconcile: either an ADR blesses the shipped pairing model for
  pre-M1 and the docs mark the ceremony Ahead everywhere, or M1
  implements the spec.
- **[P3] Mock firmware versions are stale and self-inconsistent**
  (verified): mock.ts pins `0.8.0` on all surfaces — *below* the
  0.9.0 identity floor the console's own copy cites while mock
  identity reports verified; the prototype says `0.9.0-beta.2`;
  shipped firmware is 0.11.0. USER-STORY pins no version, so the
  checker can't catch this. Pick a canon version at each release
  (or derive mocks from one constant).
- [P3] Live devices show serial-as-name: `/api/v1/info` returns no
  `name`/`serial` fields, so the fleet card falls back — a small
  firmware addition would fix the buyer-visible polish.

## Build integrity

- Two-target build is real; gen-header is deterministic (gzip mtime 0
  + assertion); CI's console-build job rebuilds and diffs both
  committed artifacts — drift cannot land silently *post-push*.
- **[P2] Node 20 (console-build job + README) vs Node 24
  (.node-version, all other jobs)** — a local regeneration under 24
  can diff against CI's 20-built baseline. Pin one version everywhere.
  (Also logged in step 08.)
- [P3] dist-hosted has no static "no external requests" assertion —
  self-containment rests on the singlefile plugin + rebuild-diff; the
  prototype gets a checker rule, the real console doesn't.

## What a buyer-facing GA console still needs (concrete)

1. The cutover itself (Vercel root dir + vercel.json + verify-live
   defaults + DNS) — owns step 10's top action.
2. Request timeouts; CSP; first-contact copy fix; downgrade-path
   hardening.
3. Decide-and-chip (or build): search/Cmd+K, Mirror, root-of-trust,
   Eject.
4. Claim-ceremony reconciliation (doc or code).
5. Cloud Mode is entirely unbuilt (correctly, per MODES — its gates
   are separate and Local never waits).
