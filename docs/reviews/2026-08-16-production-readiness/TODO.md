# Execution TODO — working the 2026-08-16 review to done

Tracker for executing steps 01–10's findings. Status: `[ ]` open ·
`[x]` done · `[J]` owner-only (John) · `[HW]` needs the physical board.
Every `[x]` lands in a shipped commit; this file is updated as groups
complete.

## Group A — Truth pass (docs)

- [x] MODES.md: gate labels on the six false-✓ rows (Mirror·M1, OTA
      channels/manifest·M0/M1, fleet view·M1, snapshots·M2, audit
      log·M1, signing ceremony·M2)
- [x] MANUAL.md: hosted-Console path labeled "Ahead · hosted cutover";
      troubleshooting row matched; Improv gate label → M0
- [x] FIRMWARE.md: drop the stale "with an mDNS receiver scan" clause;
      complete the apps/diag verdict enum; "mDNS" → "mDNS responder"
      in the module map
- [x] SECURITY.md: Improv marked Ahead·M0; scoped-token tense fixed;
      claiming-ceremony status line; key-hierarchy Status column;
      setup-AP exposure-window note
- [x] GLOSSARY.md: scoped-token phrase gated M1; add Finder prompt,
      TinyUF2 factory partition, Claim attestation
- [x] docs/adr/README.md: supersession rows for ADR-0006 (→0008/0021)
      and ADR-0002 (→0009/0024)
- [x] contracts/layout.md: 64 KiB cap; required-field and limit notes;
      document actual `max` truncation semantics
- [x] contracts/mqtt.md: fix self-contradictory header; mark `event/#`
      planned-not-implemented; `expiry` required/nonzero; document
      `state/display`, `display.clear`, `app.show` payloads; HA scene
      footnote consistency
- [x] examples/flights-overhead.mjs: replace removed-scan guidance with
      finder-prompt guidance (header + failure path)
- [x] examples/README.md: fix "M4 Flights Overhead" gate tag
- [x] firmware/dk01/README.md: "(v0.9.0" header → current; verdict
      enum; UF2 conversion instructions for USB recovery
- [x] MANUAL.md ch. 10: recovery row references the new UF2
      instructions; Pixlet count aligned to ADR-0030's "hundreds"
- [x] CLAUDE.md: truth-map row for docs/PRODUCTION-PLAN.md; ROADMAP
      §3-delegation staleness caveat in ROADMAP.md

## Group B — Pipeline completion (CI/tooling)

- [x] ci.yml: firmware compile job (arduino-cli 1.5.1, core 3.3.11,
      Protomatter 1.7.1, ArduinoJson 7.4.3, Crypto 0.4.0 — all pinned)
- [x] ci.yml: `tsc --noEmit` in console-build (+ `typecheck` script)
- [x] ci.yml: Node split documented as deliberate — console builds pin
      Node 20 for Vercel parity (comment in ci.yml + README); scripts
      run on `.node-version` 24
- [x] ci.yml: daily scheduled verify-production (implements the
      OPERATIONS monitoring claim; OPERATIONS wording updated to match)
- [x] dependabot: npm ecosystems for portal/console +
      examples/pixlet-bridge
- [x] Makefile: `console-verify` drift target; AGENTS.md definition of
      done references it
- [x] v0.11.0 annotated tag pushed; tag discipline recorded in
      OPERATIONS.md
- [x] OPERATIONS.md: pre-sale dashboard hardening bullet (deploy
      gating on CI, branch protection); monitoring + release-asset
      wording made truthful (vercel.json content stays in
      portal/console/README.md → Vercel handoff, linked)

## Group C — Contract drafts

- [ ] contracts/rest.md: full DRAFT for the 28-route REST surface,
      claim/pairing + identity protocols, diag schema, setup surface,
      error format (from step 03's verified inventory + code)
- [ ] contracts/ota.md: DRAFT for today's `/update` + the M0
      manifest/channel/signing target
- [ ] contracts/README.md: table updated (rest, ota; WS/.dmapp/
      capability named as pending P2 work)

## Group D — Firmware v0.12.0 + Console hardening

- [ ] Token minting: `dmx_lan_` prefix (canon reconciliation)
- [ ] Defer first-boot key/token mint until after radio start
      (entropy P1)
- [ ] Body-size cap ahead of auth (as far as the core allows)
- [ ] Setup-mode Host middleware; post-join token window auto-close
- [ ] Single-pass flights frame build (kills the O(n²) stall)
- [ ] NVS brightness debounce
- [ ] Rollback validity: mark-valid on stable uptime, not Wi-Fi join
- [ ] Protomatter init failure: report + retry instead of infinite
      hang
- [ ] claim/start no longer extends an active code's expiry
- [ ] Token dropped from the 10 s serial stat line (boot + claim
      prints stay); fix "never logged" comment
- [ ] `/api/v1/info` gains `serial`
- [ ] Console: request/identity/OTA timeouts (AbortController)
- [ ] Console: CSP meta; TOFU first-connect copy; legacy-downgrade
      warning strengthened; DEMO chip label unified; mock fw version
      → current
- [ ] Rebuild both targets; determinism double-build; compile at
      pinned core; docs updated in the same commit (FIRMWARE.md
      changelog, README, MANUAL, SECURITY setup-window note)

## Group E — Prep for hardware/owner work

- [x] hardware/procedures/bench-week.md: the exact Phase-2 run list
      (soak, instrumentation, recovery drill, entropy check,
      rebinding/CSRF, browser experiments, panel intake), one
      evidence file per run
- [x] hardware/README.md: index (truth-map row exists; dir had none)

## Owner-only / hardware (queued for John)

- [J] Storefront claims sweep (P0 exit)
- [J] Cutover: Vercel Root Directory + root vercel.json commit + DNS
      record + verify-live default flip (runbook: OPERATIONS.md)
- [J] Deploy gating on CI + branch protection (needs public repo or
      plan upgrade — dashboard actions)
- [HW] Execute bench week per hardware/procedures/bench-week.md
- [HW] 8–12 unassisted user tests (M1 overlap)
- [J] Enclosure / harness / BOM / cost model (mechanical)
