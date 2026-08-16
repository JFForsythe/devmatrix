# Roadmap

No dates until the first gate passes. Every phase ends demo-able.
Sequencing follows ADR-0007: **Local readiness gates launch; the paid
Cloud track ships when its own gates pass — same day if ready, and
Local never waits.**

One ladder (ADR-0009). This file owns the sequence and the acceptance
summaries; full gate criteria live in section 3 of
[docs/PRODUCTION-PLAN.md](docs/PRODUCTION-PLAN.md) — a preserved
snapshot: where §3 and an owner doc or later ADR disagree (for
example, the workbench and command palette are **Ahead · gate M2**
per docs/GLOSSARY.md, not §3's M1 line), the owner doc or ADR wins.

## The ladder — P0 → GA

- **P0 — Governance and roadmap reset** *(in progress)*: adopt the
  production plan as ADR-0009..0022 with owner docs updated, one gate
  ladder, clean-room CI enforcement, clean repository baseline.
  *Accept: accepted ADRs, clean-room CI green, no unsupported product
  claim in repo or storefront.* Open owner-only item: the storefront
  claims sweep. The pre-publication git-history scrub completed with
  the 2026-08-07 public-baseline squash (ADR-0022).
- **P1 — Hardware bring-up + feasibility spikes**: panel intake and
  bench verification, MatrixPortal bring-up, the browser-security
  spike, unassisted-setup user tests. The Lua/Berry runtime spike is
  dropped from this gate (ADR-0026). Firmware is a living tree from P1
  onward (ADR-0024). *Accept: controlled first pixel on
  target hardware; every product-killing unknown has evidence;
  MatrixPortal approved for production intent or replaced by a
  custom-controller plan.*
- **P2 — Contract and security freeze**: freeze REST, WebSocket,
  MQTT, OTA, and app-bundle contracts, budgets, toolchain pins, and
  the secure-boot/owner-key/recovery resolution on sacrificial
  boards. Production code is authorized only after this gate.
  *Accept: Console, simulator, firmware, SDK, and tests can be built
  independently against frozen contracts.*
- **M0+EVT — Firmware bedrock (10 units)**: display, native clock,
  Wi-Fi, provisioning, safe mode, diagnostics, dual-slot OTA with
  rollback, recovery image. *Accept: a blank unit flashes to the
  clock; interrupted power and corrupted OTA recover; a 72-hour soak
  passes; every failure is diagnosable without a remote shell.*
- **M1 — Real Local product**: device-local claim, owner sessions,
  real REST/WebSocket, device-hosted Console, signed OTA channels.
  Real claim-to-first-pixel acceptance lives here (ADR-0009).
  *Accept: at least 9 of 10 independent users reach first pixel in
  under five minutes; the whole flow works with all company domains
  blocked; bad updates roll back; factory reset returns an unclaimed
  device.*
- **M2+M3 — Integrations + open developer platform**: clean-room MQTT
  and Home Assistant discovery, layouts and bindings, simulator,
  SDKs, fork and self-hosted OTA guides. *Accept: HA discovers and
  controls the device without custom YAML; REST, MQTT, WebSocket,
  simulator, and SDK conformance agree; a fork builds and flashes
  from a clean machine in under 15 minutes; third parties mirror and
  update with company infrastructure blocked.*
- **M4 — Apps and Registry**: declarative app engine (layout renderer,
  binding engine, schedule), `.dmapp` installer, permissions and
  quotas. Today's bundled apps are Messages, Flights list, and Custom
  layout; M4 adds Weather, clock variants, and Registry apps. Stocks
  stays disabled pending an owner key (ADR-0015). The curated Registry
  also permits unrestricted sideload. No on-device scripting VM at
  launch (ADR-0026). *Accept: a user publishes,
  installs, updates, and rolls back a documented app; a malicious app
  or hostile data source is contained; installed apps survive Registry
  or GitHub outages.*
- **L0+DVT — Production-intent beta**: production-intent enclosure,
  packaging, fixtures; ten outside developers for 30+ combined
  device-weeks; FCC/module-integration review; support runbooks and
  RMA procedure. *Accept: no unresolved critical/high security,
  brick, data-loss, secret-exposure, thermal, provisioning, or
  claim-evidence defect.*
- **R0+PVT — First sellable run (50 units)**: ~60 input sets, 95%+
  first-pass yield, 100% identity provisioning, per-unit testing, the
  exact tested candidate promoted (never rebuilt), returns/warranty/
  support complete (ADR-0018). *Accept: random sealed units complete
  unbox-to-first-pixel unassisted; public source hashes reconcile
  with shipped firmware.*
- **GA — Sell**: *Accept: fifty conforming units and spares
  reconciled; Local operation, Eject, recovery, source, docs, and
  release artifacts public; every marketing claim links to acceptance
  evidence; price approved from measured EVT/PVT cost.*

## Cloud track — C0–C3, the paid tier (behind its own gates)

- **C0 — Accounts + billing**: passkey accounts, subscription billing,
  tenancy, sunset-covenant terms published. *Accept: subscribe,
  cancel, lapse — device capability never changes.*
- **C1 — Relay + fleet**: outbound WSS relay, remote Mirror, multi-site
  fleet view, offline alerts. *Accept: chalet box controlled from the
  city; relay outage degrades to Local silently.*
- **C2 — Hosted layer**: E2EE snapshot sync + retention, guest links,
  mark-lost / remote wipe / credential rotation.
- **C3 — Ecosystem**: Registry polish (stays free/static), CI deploy
  convenience for BYO firmware.

**Amendment (ADR-0026):** apps split into three tiers — declarative
(on-device), host (owner's own machine), and scripted (deferred). P1
drops the Lua/Berry spike and M4 drops the scripting VM, its
instruction budgets, and VM sandbox fuzzing; docs/FIRMWARE.md owns the
tier descriptions.

**Amendment (ADR-0024):** the DK-01 firmware tree
([firmware/dk01/](firmware/dk01/README.md)) develops continuously from
P1 onward — P2's "production code is authorized only after this gate"
no longer applies to it. Contracts stay DRAFT until the P2 freeze, and
M0 acceptance evidence still gates any sold unit.

## Standing rules

When tracks conflict, the buyer journey in docs/USER-STORY.md wins.
When any doc conflicts on the mode split, docs/MODES.md wins.

## History

The 2026-08-04 "definition + prototype" milestone (docs restructure,
ADRs 0001–0007, mode split, Console prototype, adversarial review)
completed under this file's legacy gate names. ADR-0009 retired those
names; the ladder above is the only one.
