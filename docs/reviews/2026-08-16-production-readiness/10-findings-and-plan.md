# Step 10 — Master findings and the path to production

Rollup of steps 01–09. Every finding was verified against the tree,
the live deployment, or command output before inclusion; nothing here
is secondhand. Severity counts: **P0: 0 · P1: 16 · P2: ~30 · P3: ~35.**

The one-paragraph verdict: **the architecture, decision discipline,
and code quality are genuinely production-grade; the gap is between
what the docs assert today and what has been proven.** No invariant is
violated in code. The two youngest gates (P0, P1) are 90 % done and
neither is closed; the firmware has outrun its hardware evidence by
seven versions; and the P2 contract freeze — the gate everything
sellable waits on — has 2 of ~9 surfaces drafted.

## The P1 ledger (everything that blocks a gate)

| # | Finding | Step |
|---|---|---|
| 1 | MANUAL's "Today" hosted-Console path: domain has no DNS record; production serves the prototype byte-for-byte | 02 |
| 2 | MODES feature matrix marks six unbuilt capabilities ✓ (Mirror, OTA channels/manifest, fleet view, snapshots, audit log, signing ceremony) | 02 |
| 3 | ADR index omits ADR-0006's supersession → stale "passkey required for Local enrollment" reads current | 02 |
| 4 | Contract coverage is 2 of ~9 surfaces; REST (28 routes), WS, OTA, `.dmapp`, diagnostics, capabilities, errors unwritten | 02/05 |
| 5 | contracts/layout.md states a 4 KB fetch cap; firmware is 64 KiB (16× drift in a DRAFT contract) | 05 |
| 6 | flights-overhead.mjs's failure path directs owners to the "Scan my network" UI ADR-0032 removed | 05 |
| 7 | USB-recovery manual row is untested and unfollowable (no UF2 artifact or conversion instructions in the repo) | 07 |
| 8 | In-tree firmware v0.11.0 has never run on hardware (last on-board: v0.4.0) | 07 |
| 9 | P1 evidence gaps: 24 h soak, current/thermal instrumentation, 8–12 user tests, panel supplier intake, enclosure/BOM/cost model | 07 |
| 10 | LAN token + Ed25519 identity key minted before Wi-Fi radio start (entropy verification needed) | 03 |
| 11 | OTA images unsigned (disclosed; M0 blocker for sold units) | 03 |
| 12 | Vercel deploys before CI completes — a red commit still goes live | 08 |
| 13 | No branch protection possible on current plan; `main` writable outside the release chain | 08 |
| 14 | Firmware is never compiled by any CI; no release pipeline, tags, or changelog | 08 |
| 15 | Storefront claims sweep (P0 exit, owner-only) still open | 01 |
| 16 | DNS-rebinding/CSRF exercise SECURITY.md itself requires at P1: not run | 06 |

## The plan, in leverage order

**Phase 1 — Truth pass (docs only, ~a day).** Fix every
present-tense-vs-reality claim: MODES matrix gate labels (six rows),
MANUAL hosted-path "until cutover" label, FIRMWARE.md's stale "mDNS
receiver scan" clause, ADR-index row for ADR-0006 (+0008/0021),
layout.md 64 KiB cap, flights-overhead.mjs scan text, firmware README
v0.9.0 header, mqtt.md self-contradiction, scoped-token tense in
SECURITY/GLOSSARY, diag-verdict enum, workbench M1/M2 caveat. John:
run the storefront sweep. **Exit: P0 closable.**

**Phase 2 — Bench week (the hardware debt, all at once).** Flash
v0.11.0 to the DK-01. Re-run the pattern ladder + refresh floor.
24 h display+Wi-Fi soak with MQTT and an HTTPS app source active.
Instrument current/voltage/temperature. Execute the USB-recovery
drill end-to-end and write the UF2 conversion instructions the manual
needs. Verify (or defer) the pre-radio entropy path. Run the
DNS-rebinding/CSRF exercise and the four ADR-0031 browser experiments
against the real board. One evidence file per run. In parallel:
supplier intake for the panel. **Exit: P1 closable except user tests
+ enclosure/BOM.**

**Phase 3 — Hosted cutover (one coordinated change).** Per
OPERATIONS.md's recipe: root `vercel.json` + Vercel Root Directory +
verify-live defaults + DNS record + retire the prototype (and `make
portal`); add the CSP at the same time; gate deploys on CI (Vercel
required-checks or Ignored Build Step); decide public-repo-or-Pro for
branch protection. **Exit: the manual's hosted path becomes true; P1
#1/#12/#13 close.**

**Phase 4 — Pipeline completion (CI catches what conventions
currently carry).** arduino-cli compile in CI; `tsc --noEmit`;
console-build drift check runnable locally (make check or pre-push);
one Node version everywhere; dependabot for the two npm ecosystems;
nightly scheduled verify-live (implements OPERATIONS' monitoring
claim); start tagging releases + changelog. **Exit: P1 #14 closes;
the "definition of done" is machine-enforced.**

**Phase 5 — Contract drafts (the P2 on-ramp).** Write REST OpenAPI
directly from step 03's verified inventory; decide WebSocket (build
at M1 or strip it from present-tense frame-layer language until
then); OTA manifest/channel format; `.dmapp` manifest + permission
schema; capability descriptors; error format; reconcile envelope
`expiry` bounds, brightness tri-scale, layout `max` semantics, token
prefix canon. Then the P2 security bench: Secure Boot v2 +
flash-encryption + owner-key + recovery coexistence on sacrificial
boards. **Exit: P2 freeze is a review, not an invention.**

**Phase 6 — Firmware hardening backlog (pre-M0, all small).** Body
size cap before auth; setup-AP password shown on panel (or shortened
token-exposure window); single-pass flights frame build; NVS write
debounce; tighten the rollback validity signal; Protomatter-failure
path that reboots instead of hanging; token serial-print cadence;
setup-mode middleware. **Exit: the M0 build is the hardened build.**

**Phase 7 — The gates themselves, in order.** M0: 10 EVT units,
signed OTA, 50 power cycles, corrupted-OTA recovery, 72 h soak,
fixtures + procedures in `hardware/`. M1: claim ceremony
(reconciling the PORTAL/USER-STORY spec vs today's pairing by ADR),
WebSocket, audit log, scoped tokens, search/Mirror or honest chips,
root-of-trust + Eject surfaces, 9-of-10 user test,
company-domains-blocked test. Then M2–M4 per ROADMAP (simulator, SDK
from contracts, `.dmapp` installer, Registry), L0 (outside
developers, FCC, runbooks), R0 (provisioning procedure + yield), GA.

## What this review did not cover

No hardware was run (the review is why that matters). The generated
`web_console.h` blob was verified as generated output, not
hand-audited. The closed-product storefront was not opened
(owner-only item, and out of clean-room scope for this repo's
tooling). The examples were statically verified against firmware
ground truth but not executed against a live device.

## Step index

00 scope · 01 governance · 02 docs truth-map · 03 firmware ·
04 console · 05 contracts+examples · 06 security · 07 hardware
evidence · 08 ops pipeline · 09 gate scorecard · 10 this file.
