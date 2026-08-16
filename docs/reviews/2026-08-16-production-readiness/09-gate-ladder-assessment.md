# Step 09 — Gate ladder assessment (P0 → GA)

Scored against the acceptance criteria in docs/PRODUCTION-PLAN.md §3
(the owner) and ROADMAP.md's summaries, updated with the verified
findings of steps 01–08. "Evidence" means a written, dated artifact in
the repo — the standard the plan itself sets (§4).

## Scorecard

| Gate | Status 2026-08-16 | What is proven | What still blocks it |
|---|---|---|---|
| **P0** Governance | **~90 % — open** | ADRs 0009–0022 landed; one ladder; clean-room CI green; history squashed; GLOSSARY terms added; PRODUCTION-PLAN tracked; release chain implements its doc | Storefront claims sweep (owner-only, ROADMAP.md:20); repo-side unsupported claims: MANUAL's hosted-Console "Today" text (02 §1), MODES matrix's six false ✓ rows (02 §10), ADR-0006 index row (02 §11) |
| **P1** Hardware + feasibility | **partial** | First pixel + bring-up trio (2026-08-07, toolchain-pinned); 200 Hz floor met (at v0.2.0); memory watermarks; transport spike decided (ADR-0031) | 24 h soak with active TLS: no evidence; current/thermal never measured; 8–12 unassisted user tests: not run; panel supplier intake absent (driver IC still unconfirmed); enclosure/harness/BOM/cost model absent; 4 named ADR-0031 browser experiments open; DNS-rebinding/CSRF exercise required by SECURITY.md unrun; **in-tree firmware (v0.11.0) has never run on hardware — last on-hardware was v0.4.0** |
| **P2** Contract + security freeze | **not started (2/~9 surfaces drafted)** | mqtt.md + layout.md prose drafts | REST (28 routes)/WS/OTA/.dmapp/diagnostics/capability/error contracts unwritten; zero machine-readable schema; layout.md already wrong (4 KB vs 64 KiB, 05); budgets unmeasured; Secure Boot v2 + flash-encryption + owner-key resolution on sacrificial boards untouched; entropy question (03) unsettled; toolchain pins not lockfiled (partition scheme rides board defaults, 03) |
| **M0+EVT** Firmware bedrock | **partial (1 unit, unsigned, untested recovery)** | Dual slots real (3 on-hardware swaps); bootloader rollback compiled in + mark-valid-after-join; TinyUF2 partition preserved; captive-portal provisioning; native clock; reset-reason + apps/diag diagnostics; brightness cap | Signed OTA absent; rollback never tested (corrupted-OTA/power-cycle evidence: none); USB-recovery drill never run and **no UF2 artifact/conversion instructions exist** (07); safe mode absent; structured log/watermark export absent; 10 EVT units; 72 h soak; fixtures: none |
| **M1** Real Local product | **partial** | 6-digit pairing + LAN token; device-served Console (8 views, wired to ~28 real routes); Ed25519 identity + pinning (mock-E2E verified); token rotation; factory reset | Button-hold claim ceremony (spec'd, unbuilt — and PORTAL/USER-STORY present it untagged, 04); **WebSocket /api/v1/stream does not exist**; audit log; scoped tokens (claimed in SECURITY.md, unbuilt); search/Mirror/workbench (gate label conflict 02 §15); 9-of-10 five-minute user test; company-domains-blocked full-flow test; hosted cutover + DNS |
| **M2+M3** Integrations + dev platform | **early** | MQTT client + HA discovery (light/text/notify) real; envelope replay guards verified; examples + installers solid; Pixlet bridge with self-test; fork path documented | MQTT `event/#` class contract-promised but unimplemented (05); scene entity; brightness tri-scale reconciliation; simulator/golden renderer: none; SDKs: none (three hand-rolled proto-clients in examples/); conformance suite: none; 15-min fork-flash test unrun; no firmware CI compile (08) |
| **M4** Apps + Registry | **early** | Declarative engine (Messages, Flights list, Custom layout) with real sandbox bounds + per-app fetch diagnostics | `.dmapp` is a word, not a format (no manifest/permission schema, 05); installer/Registry/permission sheets absent; declared-hosts allowlist absent; hostile-bundle fuzzing absent; Weather remains a template, not a bundled app |
| **L0+DVT** Production-intent beta | **not started** | — | Enclosure, packaging, fixtures, 10 outside developers × 30 device-weeks, FCC/module review, runbooks, RMA, security.txt + disclosure policy |
| **R0+PVT** First sellable run | **not started** | — | ~60 input sets, ≥95 % yield tracking, per-unit provisioning procedure + record schema (serial-collision policy undefined, 07), 12-test per-unit procedure, promote-exact-candidate discipline, returns/warranty/support |
| **GA** | **not started** | — | Everything above + artifact monitoring (claimed in OPERATIONS, unimplemented — 08), claims-to-evidence links, measured pricing, public source, branch protection/CI-gated deploys (08) |
| **C0–C3** Cloud track | **not started (by design)** | Mode split + sunset covenant specced | Separate paid gates; correctly not blocking Local |

## Reading the board

The project is **mid-P1 with deliberate look-ahead work** landed from
later gates under ADR-0024's living-tree rule — legitimate, and the
code quality of that look-ahead work is high (steps 03/04/08). The
structural risks are:

1. **The earliest gates are the closest to done and neither is
   closed.** P0 needs the storefront sweep plus three repo relabels;
   P1 needs roughly one bench week, one supplier conversation, user
   tests, and the browser experiments.
2. **A widening hardware-reality gap.** Seven firmware versions have
   shipped since a board last ran any of this code. Every subsequent
   feature (MQTT task, identity crypto, 64 KiB PSRAM buffer) carries
   untested-on-silicon risk that compounds; the next bench session
   pays this debt all at once.
3. **P2 is the emptiest gate and everything sellable sits behind
   it.** ~28 REST routes, the MQTT envelope, layout schema, OTA, and
   `.dmapp` all need written contracts, and the Secure Boot/owner-key/
   recovery resolution needs sacrificial-board evidence. The single
   highest-leverage documentation work in the repo is writing those
   contract drafts from step 03's verified API inventory.
