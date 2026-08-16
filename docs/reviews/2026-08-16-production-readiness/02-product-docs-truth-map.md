# Step 02 — Product docs and truth-map consistency

Reviewed personally, in full: VISION.md, MODES.md, SECURITY.md,
FIRMWARE.md, PORTAL.md, GLOSSARY.md, OPERATIONS.md, USER-STORY.md,
MANUAL.md, PRODUCTION-PLAN.md, ROADMAP.md, PLAN.md, contracts/README.md,
plus both console-related evidence files. Live-state claims were
verified against production (DNS + byte-hash), not assumed.
A parallel full-corpus sweep (all 63 Markdown files including every ADR)
ran independently; its confirmed additions are merged at the end.

## Findings

1. **[P1] MANUAL's "Today" hosted-Console path is unsupported by
   reality.** docs/MANUAL.md:87-92 instructs owners *today* to "Open
   `devmatrix.flighttrackerled.com`", and ch. 5 describes the hosted
   welcome screen as present. Verified 2026-08-16:
   `dig devmatrix.flighttrackerled.com` returns no A/CNAME record, and
   the live Vercel deployment (`devmatrix-console.vercel.app`) serves
   `portal/prototype/index.html` **byte-for-byte** (SHA-256 prefix
   `7968951ba718428a`, 143,882 bytes — the mock prototype, not
   `dist-hosted/index.html` at `25ccf9cca88cb5ba`). OPERATIONS.md:13-45
   and the 2026-08-13 evidence file both correctly say the cutover and
   DNS record are still outstanding — the manual got ahead of them.
   Since MANUAL.md:8-9 declares "no unsupported claim" a P0 rule, this
   is a P0-exit violation, not a nit. Fix: either complete the cutover
   (OPERATIONS.md owns the recipe) or relabel the manual's hosted-path
   text "Ahead · cutover" until it lands.

2. **[P2] FIRMWARE.md contradicts itself (and ADR-0032) about the
   receiver scan.** docs/FIRMWARE.md:6-9 states v0.11.0 "removes the
   receiver scan entirely" — but the same changelog paragraph still
   says Flights Overhead config is "held in device NVS **with an mDNS
   receiver scan**, so the owner's receiver address exists only on
   their own hardware" (docs/FIRMWARE.md:49-51). ADR-0032 wins; the
   stale clause must be cut from the historical narrative or clearly
   past-tensed ("v0.8.0 shipped with a scan; v0.11.0 removed it").

3. **[P2] SECURITY.md presents USB-Improv provisioning as a current
   path.** docs/SECURITY.md:50-52: "Join it via Improv WiFi over USB
   (the start page talks to the cable, not the LAN) or the
   `DEVMATRIX-XXXX` SoftAP." MODES.md — the owner of the split — marks
   USB Improv "**Ahead · gate M0**" (docs/MODES.md:20), and
   MANUAL ch. 3 agrees (docs/MANUAL.md:61-62). SECURITY.md should mark
   the Improv clause Ahead or write it as target design.
   (Same pattern, lesser degree: PORTAL.md:71 lists "USB Improv or its
   setup SoftAP" in the five-minute path with no gate label — P3.)

4. **[P3] Gate-label mismatch for USB Improv.** MANUAL says
   "Ahead · P1/M0" (docs/MANUAL.md:61); MODES says "Ahead · gate M0"
   (docs/MODES.md:20). Same feature, two labels; MODES wins — make the
   manual say M0.

5. **[P2] SECURITY.md's claiming ceremony carries no status label.**
   docs/SECURITY.md:112-131 describes the button-hold possession
   ceremony in present tense; today's firmware implements 6-digit-code
   pairing only, and MANUAL correctly labels the full ceremony
   "Ahead · M1" (docs/MANUAL.md:94-96). SECURITY.md is the model owner
   and may speak in target tense, but one status line ("today:
   panel-code pairing; the button ceremony lands at M1") would keep the
   two files from reading as contradiction.

6. **[P1] Contract coverage is 2 of ~8 surfaces.** contracts/README.md:
   only `mqtt.md` and `layout.md` drafts exist. REST `/api/v1` — the
   surface every example, the Console, and the manual depend on — has
   no contract draft at all (FIRMWARE.md's sketch is labeled
   "illustrative"). P2's exit ("Console, simulator, firmware, SDK, and
   tests built independently against frozen contracts",
   docs/PRODUCTION-PLAN.md:505-506) cannot be approached until REST,
   WebSocket, OTA, app-bundle, diagnostics, capability-descriptor, and
   error-format drafts exist. This is the single largest documentation
   work item between here and P2.

7. **[P2] VISION's launch promises include surfaces that do not exist
   yet, without gate labels.** docs/VISION.md:40 promises "MQTT + REST
   + WebSocket ready; Home Assistant discovery out of the box" — the
   WebSocket stream is unimplemented (no `/api/v1/stream` in firmware;
   ROADMAP places real WebSocket at M1). VISION promises 3 and 7 model
   the right pattern ("**Ahead · gate M2**", "**Ahead · gate M0**");
   promise 5 should carry "WebSocket **Ahead · gate M1**" the same way.
   VISION.md:31 frames all promises as launch-mapped, so this is
   labeling drift, not a false claim — but the file's own convention is
   inconsistent, and the promises list is exactly what a storefront
   would copy.

## Verified-consistent (checked, no finding)

- PLAN.md is still a pointer (PLAN.md:1-18). ✓
- OPERATIONS.md's live-state description matches measured production
  reality exactly (prototype live, cutover pending, DNS outstanding). ✓
- Bundled-app set is consistent across ROADMAP.md:57-59, GLOSSARY
  ("Bundled apps"), MANUAL ch. 5/7, FIRMWARE.md changelog. ✓
- Serial/AP/hostname canon (`DMX-4E71-0952` → `DEVMATRIX-0952` →
  `dmx-0952.local`) agrees across GLOSSARY, USER-STORY, MANUAL,
  SECURITY. ✓
- Today/Ahead labels on dual-slot OTA (today) vs signed OTA +
  auto-rollback (M0) vs browser USB flash (M2) agree across VISION,
  MODES, MANUAL ch. 9/10. ✓
- MANUAL "eight views" + hosted welcome = the nine files in
  `portal/console/src/views/`. ✓
- P0's required GLOSSARY additions (MatrixPortal, Protomatter,
  EVT/DVT/PVT, gate ladder, safe mode, native clock, scene, golden
  renderer, workbench terms) are all present. ✓

## Additional findings from the same personal pass

8. **[P3] The module map's `net/` line could echo ADR-0032's
   constraint.** docs/FIRMWARE.md:80 lists "mDNS" in the target module
   map; ADR-0032 constrains mDNS to responder-only. The map is
   explicitly labeled "Target shape" (docs/FIRMWARE.md:71), so this is
   not a contradiction — but writing "mDNS responder" would carry the
   invariant into the sketch for free.

9. **[P3] The 2 KB layout ceiling is stated in two files.**
   contracts/layout.md:11 ("no larger than 2 KB") and
   docs/MANUAL.md:131 both state the number; they agree today. The
   contract is the owner once frozen — the manual should link rather
   than restate so a P2 renegotiation cannot silently diverge them.

Checked and cleared during the same verification: docs/adr/README.md:19
**already** annotates ADR-0009 with its ADR-0024/ADR-0026 amendments,
so no index fix is needed there.

## Doc-level findings surfaced by the code deep dives (verified; owned by their step files)

- Claim-ceremony divergence: PORTAL.md:73-74 and USER-STORY.md T+0:03
  describe the session-code + button-hold ceremony untagged, while the
  shipped flow is 6-digit pairing and only MANUAL labels the ceremony
  Ahead·M1 → step 04 [P2].
- Token-format canon (`dmx_lan_…` in USER-STORY/mocks vs unprefixed
  32-hex firmware token) → step 05 [P2].
- contracts/layout.md's 4 KB fetch-cap claim vs the 64 KiB firmware
  reality → step 05 [P1].
- OPERATIONS.md present-tense claims with no machinery behind them
  (artifact monitoring; signed GitHub Release assets — zero releases
  exist) → step 08 [P2].
- MANUAL.md:274-275 "replaces and restarts" vs the Linux installer's
  no-restart `enable --now` → step 05 [P2].
- MANUAL.md:401-405 USB-recovery row (untested, no UF2 artifact or
  conversion instructions in the repo) → step 07 [P1].
- Prototype's first-pixel mock command uses `https://` against
  ADR-0031's plain-HTTP decision → step 05 [P3].
- firmware/dk01/README.md:115 "(v0.9.0…)" heading under v0.11.0 →
  step 05 [P3].

## Merged from the full-corpus sweep (all 63 files; each item below re-verified in the tree)

10. **[P1] The MODES feature matrix marks six unbuilt capabilities
    "✓ today."** MODES.md:37-39 sets its own rule ("Where a row is not
    yet built, its gate is named inline") and applies it correctly to
    provisioning and USB-recovery rows — but these rows claim ✓
    against v0.11.0 reality (all verified):
    - `Mirror … ✓ on your LAN` — no Mirror exists (paint canvas only);
      PRODUCTION-PLAN puts mirror at M1.
    - `Firmware OTA (stable/beta/dev) ✓ static manifest, free` — no
      manifest poll, no channels; OTA is manual `.bin` upload.
    - `Fleet view ✓ same LAN` — the live console manages exactly one
      device; the 3-device fleet is mock-only.
    - `Snapshots (E2EE) ✓ export/restore as files` — no snapshot code
      anywhere.
    - `Audit log ✓ on-device ring buffer, exportable` — the console's
      own Security view labels the audit log Ahead·M1.
    - `Own signing key, BYO firmware ✓ physical ceremony` — enrollment
      is unimplemented everywhere.
    MODES.md is the mode-split owner — the single most quotable
    marketing table in the repo — so these are exactly the
    "unsupported product claim" class that P0's exit forbids.
11. **[P1] The ADR index carries no supersession row for ADR-0006**,
    and its header says "anything not listed below is current as
    written" — so ADR-0006's "Console passkey re-auth" requirement for
    the enrollment ceremony reads as current, when ADR-0008 explicitly
    supersedes it for Local (no account needed) and ADR-0021 rescopes
    "factory reset wipes enrolled keys" to the software layer.
    Verified: `grep 0006|0008|0021 docs/adr/README.md` matches
    nothing. One index row fixes an invariant-adjacent misreading.
12. **[P2] contracts/mqtt.md contradicts itself about implementation
    status** (verified verbatim): line 11-12 "the firmware
    implementing it is an M2 deliverable" vs line 14-16 "Implemented
    in firmware v0.8.0". The header paragraph is pre-v0.8.0 text.
13. **[P2] SECURITY.md:68-69 claims "read-only scoped tokens are
    available"** — firmware has exactly one full-power LAN token;
    scoped tokens are M1 work. Same present-tense-vs-gate issue as
    finding 10 (GLOSSARY.md:24 repeats it).
14. **[P2] The apps/diag verdict enum is incomplete in its owner
    docs**: firmware also emits `connect-failed` and `http-<code>`
    (apps_engine.h:421-423, verified); MANUAL.md:455 documents them
    but FIRMWARE.md:15-16 and firmware/dk01/README.md:92-93 list only
    six verdicts.
15. **[P2] Two gate authorities disagree on the workbench/search
    gate**: GLOSSARY says Ahead·M2; PRODUCTION-PLAN §3's M1 line still
    includes "search … four-pane workbench" and ROADMAP delegates
    "full gate criteria" to §3 without a staleness caveat. GLOSSARY
    wins (the snapshot's own disclaimer), but the delegation needs the
    caveat.
16. **[P2] The Vercel hosting/cutover state is restated in four
    files** (OPERATIONS.md the owner, plus README.md:36-39,
    portal/README.md:12-19, portal/console/README.md:37-59). They
    agree today; they should link, not restate.
17. [P3] cluster (all verified or self-evident): USB-Improv gate label
    split (finding 4); OPERATIONS cites ROADMAP for the GA monitoring
    requirement that actually lives in PRODUCTION-PLAN §GA;
    PRODUCTION-PLAN has no truth-map row in CLAUDE.md; GLOSSARY
    missing used terms (finder prompt, TinyUF2 factory partition,
    SoftAP, USB Improv, paint canvas, claim attestation); "Bundled
    apps" vs ADR-0023's "preloaded starter apps" naming;
    examples/README.md:10 still calls Flights Overhead "the M4 app"
    when it ships Today; MANUAL's Pixlet catalog is "1,000+" in ch. 5
    and "Hundreds" in ch. 8; demo chip renders "DEMO · SAMPLE DATA"
    and "DEMO · MOCK DATA" in the same build (main.tsx:52 vs 90,
    verified); first-boot claim-code format `482913` in USER-STORY vs
    GLOSSARY's M1 `XXX-XXX` spec; the `/start` path exists only in
    USER-STORY and SECURITY; MANUAL:51 "the portal scans … your
    networks" (Wi-Fi SSID listing) should be worded to keep ADR-0032's
    "never scans" absolute clean; README links gate evidence to one
    dated file and hardware/ has no README index.

**Sweep's clean bill (verified claims):** every relative link in all
63 tracked files resolves; PLAN.md compliant; serial/hostname/app-set
canon consistent everywhere; supersession chains other than ADR-0006's
are all properly indexed; the nine console views match PORTAL's IA and
MANUAL ch. 5 exactly.
