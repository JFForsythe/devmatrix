# Devmatrix DK-01 clean-room production plan

**Status:** Approved execution blueprint · 2026-08-06 · hardened after
multi-agent audit 2026-08-06 · **adopted into repo canon 2026-08-07 as
ADR-0009…ADR-0022.** This file is a preserved snapshot: present-tense
"currently absent" / "today" statements below describe the pre-adoption
state of 2026-08-06, and several of those gaps (clean-room CI, the
ship-time CI wait, this file being tracked) closed in the adoption
change itself. The clean-room scope was subsequently re-drawn by
ADR-0023: flight features built independently on the owner's own local
receiver data are now in scope, and the two-tier term gate described
below became a single banned-identifier gate. Wherever this file and
an owner doc or ADR disagree, the owner doc and ADR win.

This document preserves the approved path from blank hardware to a sellable
DK-01. It does not claim that the described firmware, applications,
manufacturing system, or production gates are implemented. Until work lands
through the repository's normal ADR and owner-document process, `docs/`,
`ROADMAP.md`, and accepted ADRs remain the current-state authority.

## 1. Product and architecture decisions

- Launch in the United States with a first run sized to produce 50 saleable
  units. Set retail price after EVT establishes the real BOM, assembly labor,
  certification, support, and warranty costs.
- Use MatrixPortal ESP32-S3 for production v1 only if it passes the
  display/Wi-Fi, security/recovery, memory, supply, and certification gates.
  Failure automatically requires a custom controller before sale.
- Treat the photographed panel as an unverified HUB75-style, likely
  FM6124-family panel. Do not assume 1/16 scan, pinout, color order,
  power, or production-lot consistency until measured. 64×32 stays the
  product requirement (docs/GLOSSARY.md canon): panels that fail
  verification are rejected, not respecified.
- Use Arduino CLI with a pinned current arduino-esp32 3.3.x release (3.3.8
  at approval; re-pin the latest patch at the P2 freeze) and Adafruit
  Protomatter 1.7.1 for bring-up. Do not use the PlatformIO/Arduino
  3.x combination or generic HUB75-DMA library that docs/FIRMWARE.md still
  documents unless later benchmarks justify them — that library's own README
  disclaims MatrixPortal S3 with Wi-Fi and warns against Quad-SPI PSRAM as
  the DMA buffer, exactly the DK-01 configuration. This toolchain reversal
  supersedes FIRMWARE.md and must land as an ADR that rewrites FIRMWARE.md's
  Stack section in the same commit (P0). See the
  [Arduino ESP32 releases](https://github.com/espressif/arduino-esp32/releases),
  [Protomatter releases](https://github.com/adafruit/Adafruit_Protomatter/releases),
  and [MatrixPortal guide](https://learn.adafruit.com/adafruit-matrixportal-s3?view=all).
- Main firmware is C++ and always owns boot, display, provisioning, security,
  OTA, diagnostics, and the native clock. Downloadable apps use a sandbox
  selected by a real-hardware Lua-versus-Berry gate; Lua wins if both pass.
- Local operation remains complete and free: no account, company cloud, or
  phone-home requirement. Optional hosted Cloud is a paid, self-funding
  track that ships only when its own gates pass — same day as Local if
  ready, later if not; Local never waits (ADR-0007). A self-hosted
  equivalent remains available.
- First-party implementation code uses GPL-3.0-or-later. Public API schemas and
  client SDKs use Apache-2.0 so integrations are not forced into GPL. Owned
  hardware files use CERN-OHL-S-2.0 and documentation uses CC BY 4.0 (code
  samples inside docs carry an explicit software license). License flow is
  one-way and CI-enforced: Apache-2.0 contract/SDK code may flow into GPL
  firmware, never the reverse — GPL helper code copied into contracts/ or
  SDKs would silently break the no-forced-GPL promise. Note GPLv3 §6: once
  any external GPL contribution or dependency lands in firmware, Installation
  Information (owner-installable firmware) becomes a license obligation on
  this consumer device, not just a brand value.
- Publish everything Devmatrix owns: enclosure, harness, fixture, BOM, panel
  profiles, source, tests, and future PCB files. Exclude only private keys,
  credentials, customer/manufacturing records, supplier-confidential material,
  and trademarks.

### Absolute clean-room rule

- Never open, search, compare against, copy, translate, or reuse FlightTracker
  source, internal documentation, APIs, schemas, MQTT topics, provisioning,
  OTA, tests, assets, naming, or architecture.
- Only the existing brand byline may cross the boundary; no technical artifact
  may do so.
- Add the prohibition to `AGENTS.md`, contributor guidance, PR templates,
  release checklists, and every agent task.
- Require a public provenance record for every dependency and borrowed public
  standard.
- CI blocks proprietary leakage repo-wide (including docs, comments, and
  mock data) with two tiers: hard-fail terms that are never legitimate
  (closed-product codenames, internal repo names, flight-data tooling and
  API names, closed domains and topic prefixes) and context-reviewed terms
  (flight, tracker, aircraft) cleared by per-line allowlist annotations.
  Brand-copy files receive a narrow allowlist for the byline only.
  Unexplained third-party code is blocked inside firmware, contracts, apps,
  simulator, and SDKs.
- None of this enforcement exists yet — scripts/check-repo.mjs contains no
  clean-room checks and AGENTS.md and the PR template carry no prohibition
  text. Implementing all of it is a named P0 deliverable, not background
  work.
- Git history predating this plan contains closed-product codename
  references and a personal author email. Before the repository is ever
  published, squash to a clean baseline commit or rewrite history
  (git filter-repo), and add the codename to the hard-fail blocklist so it
  can never re-enter.
- Every technical ADR must show independent reasoning and public sources.
  Reviewers never inspect FlightTracker to "check similarity."

## 2. Production system design

### Repository and Console

Restructure the project into independently testable owners:

- `firmware/`: board support, display, networking, local API, apps, OTA, and
  recovery.
- `console/`: Preact, TypeScript, and Vite application shared by device-local
  and hosted simulator modes.
- `contracts/`: OpenAPI, AsyncAPI, JSON Schemas, app bundle, diagnostics, and
  OTA formats.
- `simulator/`: contract-compatible virtual device and 64×32 golden renderer.
- `apps/`, `registry/`, and `hardware/`: official apps, static Registry
  tooling, manufacturing files, and fixtures.

The real Console includes:

- Global search and command palette covering pages, settings, devices, apps,
  actions, documentation, and local log results.
- A lightweight four-pane workbench with independently selectable REST, MQTT,
  log-tail, and app-REPL panes. Panes are movable, resizable, removable,
  restorable, and saved locally. The MQTT pane cannot speak raw TCP from a
  browser: it either documents the owner-broker WebSocket-listener
  requirement in the pane UI and setup docs, or routes through the device's
  own MQTT client over the multiplexed event socket — decided before the P2
  freeze so the pane cannot work in the simulator yet fail against real
  brokers.
- Custom DOM terminals, not a full shell or heavy terminal emulator. The REPL
  runs in a disposable app sandbox and never exposes the ESP host.
- System UI typography at normal 400 weight and a native monospace terminal
  stack; no runtime font download.
- One transport abstraction supporting real LAN devices, WebSerial
  setup/recovery, and the simulator without mock behavior leaking into
  production. Each transport publishes a capability descriptor in
  `contracts/` (bandwidth class, max concurrent streams, auth model,
  frame-preview support) so the Console degrades declaratively rather than
  by accident, and the simulator must emulate the device's connection cap,
  handshake latency, and stream backpressure as part of conformance —
  transports differ irreducibly in concurrency, bandwidth (~11 KB/s at
  115200 baud vs LAN), and auth model (serial possession vs LAN token).
- Where this Console list extends docs/PORTAL.md (resizable panes,
  command-palette actions, documentation/log search scope, typography),
  the extension lands by updating PORTAL.md and GLOSSARY.md in the
  adoption commit — one owner file per fact.

### Independent public contracts

- REST lives under `/api/v1` and covers identity, health, settings,
  display/scenes, apps, integrations, OTA, logs, metrics, audits, diagnostics,
  and recovery-safe actions.
- WebSocket `/api/v1/stream` (FIRMWARE.md's documented name) carries
  versioned state changes, logs, app events, OTA progress, and optional
  frame previews — rate-capped, with a defined preview format and
  subscriber limit. The app-REPL pane rides this same multiplexed socket.
  Device TLS is explicitly budgeted at P2: a stated concurrent-session cap
  (target 2–3; each TLS session costs ~40–50 KB heap on ESP32-S3) with
  defined rejection behavior, mandatory session resumption, PSRAM-backed
  mbedTLS buffers, and a maximum-handshake-latency budget (community
  measurements run 1.6–3 s uncached).
- MQTT is designed from a blank page using MQTT and Home Assistant public
  specifications. Use the independent `devmatrix/{serial}/...` namespace
  already recorded in ADR-0001, docs/FIRMWARE.md, docs/SECURITY.md, and the
  prototype — with separate request, response, state, and event resources;
  versioned JSON messages include IDs, timestamps, expiry, and payloads.
- Generate Console and SDK clients from contracts. CI fails if generated
  clients, documentation, simulator behavior, REST, WebSocket, and MQTT drift
  apart.
- Every feature follows the same completeness rule:
  - Observe through state, logs, metrics, audits, and errors.
  - Adjust through Console and documented APIs.
  - Extend through stable contracts or app APIs.
  - Recover through safe mode, rollback, reset, or USB.
  - Inspect through public source, docs, tests, SBOM, and evidence.

### Display and built-in experiences

- Unclaimed devices show setup instructions and a short physical claim code.
- Claimed devices boot into the native clock, which is also the permanent safe
  fallback.
- Clock supports NTP, timezone, 12/24-hour format, brightness, colors, quiet
  hours, and a visible stale/offline-time state. Manual time entry is available
  because MatrixPortal has no battery-backed RTC.
- Scene scheduling rotates enabled apps, supports per-scene duration and
  schedules, and always returns to the clock after an app failure.

Official `.dmapp` examples use exactly the same public APIs available to
community developers:

- Weather: NWS by default for U.S. forecasts, cached and refreshed
  conservatively with last-update and stale indicators. MET Norway is the
  optional worldwide adapter with required attribution. NWS data is free for
  any purpose; MET Norway data is CC BY 4.0. Both adapters hard-code an
  identifying User-Agent with contact info, honor Expires/If-Modified-Since
  caching, back off on errors with per-device jitter so a fleet never
  synchronizes, and truncate coordinates to four decimals. MET Norway's
  rate ceiling is per application — aggregated across every shipped device
  sharing the UA — fine at 50 units, revisit before larger runs. See the
  [NWS API](https://www.weather.gov/documentation/services-web-api) and
  [MET Norway terms](https://api.met.no/doc/TermsOfService).
- Stocks: disabled by default. Enabling requires an owner-supplied free
  provider key and a local checkbox confirming personal/internal,
  non-commercial use and acceptance of that provider's terms. Store the
  attestation timestamp and terms URL locally. Start with Tiingo because it
  explicitly permits software where each user supplies their own token; also
  support generic JSON and MQTT feeds. Limit the default to five symbols and a
  15-minute refresh, show data timestamp/provider, and never claim
  exchange-wide real-time coverage. See the
  [Tiingo developer policy](https://www.tiingo.com/documentation/general).
- Messages: completely offline curated phrase packs, editable user phrases,
  categories, schedules, hardware-random selection, and no immediate repeats.
  It requires no cloud or AI permission.
- Every official app ships with a tutorial, manifest, permissions explanation,
  configuration schema, source, tests, simulator golden images, failure
  behavior, and "build your own version" exercise.

### App runtime and GitHub installation

- Benchmark Lua 5.4 and Berry on the real 2 MB-PSRAM hardware. Prefer Lua if
  both pass because it provides stronger documented allocator and
  instruction-hook controls (per-VM lua_Alloc; configurable count hooks —
  vs Berry's compile-time-global allocator and coarse ~1M-instruction
  hook). Caveat to record in the selecting ADR, with public sources per the
  provenance rule: Lua count hooks fire only while executing Lua code, not
  during long C calls, so a wall-clock watchdog and lua_Alloc caps are
  mandatory companions, not optional extras.
- Pass requires three representative apps, hostile loops, allocation bombs,
  recursion, malformed input, event floods, install-during-render, and a
  24-hour network/display soak without resetting or starving the clock.
  Measure internal SRAM and PSRAM watermarks separately — TLS sessions,
  Wi-Fi buffers, and DMA descriptors live in internal SRAM that a PSRAM
  app cap cannot protect. Include app HTTPS calls concurrent with OTA and
  Console TLS sessions, 100+ install/update/uninstall cycles tracking
  largest-free-block fragmentation, and a stated minimum per-app quota
  (target ~128–256 KB with 2–3 concurrent apps); fail the runtime if that
  floor is unreachable.
- If neither runtime passes, remove the on-device scripting promise before
  launch and support layouts plus external JSON/MQTT rendering instead.
  This fallback already partially exists as FIRMWARE.md's demotion path and
  the M2+M3 layout deliverables, but the two documents describe it
  differently — reconcile in FIRMWARE.md (the owner) and link from here.

A `.dmapp` is a deterministic ZIP containing:

- Versioned `manifest.json`, app source, bounded assets, README, LICENSE, and
  SPDX SBOM.
- Immutable app ID/version, runtime compatibility, minimum firmware, requested
  capabilities, resource ceilings, configuration schema, secret references,
  source repository, and license.
- Narrow capabilities for display commands, timers, HTTPS hostname allowlists,
  optional LAN access, MQTT topic patterns, KV storage, notifications, and
  named credential handles.
- No raw filesystem, sockets, GPIO, native modules, FFI, shell, unrestricted
  imports, or direct secret access.

Runtime protections include one capped VM per running app, async host calls,
instruction and wall-clock budgets, bounded queues and responses,
storage/network/log quotas, per-app timer-count and minimum-interval quotas,
notification-rate caps, crash-loop disabling, transactional updates,
previous-version rollback, per-app metrics, and automatic return to the
clock. Network controls are explicit, not implied: mandatory TLS certificate
validation against the allowlisted hostname, resolved-IP range checks unless
the LAN capability is granted, credential handles never forwarded across
host changes, and bounded redirect depth.

Determinism is a specified mechanism, not an assumption: a pinned packing
tool with fixed timestamps (SOURCE_DATE_EPOCH), sorted entry order, stripped
extra fields, and fixed permissions, verified by a CI double-build
byte-compare before signing — GitHub runner-image drift breaks byte-identity
otherwise.

GitHub publishing flow:

1. Author forks the public app template.
2. GitHub Actions lint, test in the simulator, validate permissions, build
   deterministically, generate SBOM/hash/provenance, and publish an immutable
   GitHub Release.
3. Author submits a curated Registry PR referencing the immutable asset and
   SHA-256.
4. Registry CI validates ownership, license, compatibility, tests,
   permissions, and bundle safety.
5. Accepted packages are copied into a content-addressed Registry release so
   author deletion cannot break installs.
6. The static Registry publishes signed, rollback-resistant metadata.
7. Console shows provenance, permissions, resource requests, and changes before
   installation.
8. Device independently verifies metadata, digest, limits, and compatibility;
   stages, smoke-tests, atomically activates, and retains the previous version.
9. Updates require manual owner approval. Sideloaded bundles remain allowed
   with an explicit owner-risk warning.
10. V1 supports public GitHub Releases and local drag/drop; private-repository
    OAuth is deferred.

### Hosting and cloud cost

- Keep the device-local Console as the authoritative product.
- Move the commercial public portal/docs from Vercel Hobby before sales unless
  the account is upgraded; Vercel explicitly limits Hobby to non-commercial
  use. See the [Vercel Hobby terms](https://vercel.com/docs/plans/hobby).
- Use static Cloudflare Pages for the public portal/docs, with no Functions,
  database, accounts, or standing compute. Cloudflare documents 500 free
  builds per month and unlimited static requests. The release tooling
  (scripts/ship.mjs, scripts/verify-live.mjs) is currently hardwired to
  Vercel deployment verification and must be retargeted in the same change
  as the migration. See
  [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/)
  and [static routing](https://developers.cloudflare.com/pages/functions/routing/).
- Use signed GitHub Release assets for firmware, recovery images, Registry
  metadata, and app packages. Every artifact is mirrorable and installable
  locally.
- Do not launch a company relay, proxy, MQTT broker, weather proxy, stock
  proxy, or telemetry backend in Local v1.
- Develop optional Cloud Mode on its own separate paid gates; it may ship
  the same day as Local if those gates pass in time, and it never blocks or
  delays Local (ADR-0007). The company-hosted version must be paid; the
  same relay is published as a self-hostable container.

## 3. Delivery gates

### P0 — Governance and roadmap reset

- Adopt this plan by ADR: land its embedded decision clusters (license
  scheme; US launch and 50-unit run; MatrixPortal production intent;
  Arduino CLI/Protomatter toolchain reversal; Console stack; app providers;
  Cloudflare migration; Registry pipeline; returns/warranty; repo
  restructure; browser matrix) as ADR-0009+ with the owner docs
  (FIRMWARE.md, MODES.md, PORTAL.md, ROADMAP.md, GLOSSARY.md, SECURITY.md)
  updated in the same commits. Commit this file; it is currently untracked.
- Reconcile the gate namespace: ROADMAP.md owns sequencing and today
  defines P0/P1/L0/M0–M5/C0–C3 differently than this ladder. Rewrite
  ROADMAP.md to one ladder in the adoption commit; never let two in-tree
  documents define the same gate names differently.
- Add missing GLOSSARY terms before use: MatrixPortal, Protomatter,
  EVT/DVT/PVT, P2/R0/GA, safe mode, native clock, scene, golden renderer,
  and the workbench extensions (resizable panes, command palette).
- Strengthen the clean-room ADR and implement the automated enforcement
  described in section 1 (check-repo blocklist, AGENTS.md and PR-template
  prohibition text, dependency provenance) — all currently absent.
- Supersede the current circular sequencing: P1 may create disposable
  feasibility firmware; P2 authorizes production code.
- Move real claim-to-first-pixel acceptance to M1 and the complete Local launch
  gate after apps.
- Keep the portal's existing visual-mock labeling intact (already
  implemented) and extend the claims-to-evidence rule to the live
  storefront: sweep the dev-kit listing for present-tense claims that lack
  acceptance evidence, including price, hardware specs, preloaded firmware,
  cloud access, and any flight-adjacent copy.

Exit: clean repository baseline, accepted ADRs, explicit gate ownership,
this file tracked, clean-room CI green, and no unsupported product claim in
repo or storefront.

### P1 — Hardware and feasibility

Hardware intake:

- Obtain supplier SKU, front photo, pitch, resolution, scan ratio,
  voltage/current specification, driver BOM, pinout, and lot-change policy.
- With power disconnected, verify polarity, VCC/GND pins, input connector,
  address lines, and resistance.
- Use a current-limited regulated 5 V bench supply; never infer voltage from
  capacitor markings.
- Test the MatrixPortal alone before connecting the panel.
- Power the panel directly and MatrixPortal through USB; do not feed external
  power through MatrixPortal's documented output terminals, and tie panel
  and controller grounds together whenever they are separately powered
  (Adafruit's documented requirement).

Bring-up:

- Start OE blanked, then run black, single pixels, primaries, corners, border,
  numbered rows/columns, checkerboards, gradients, moving lines, and
  low-brightness white.
- Record exact panel profile: dimensions, scan, driver, color map, phase,
  blanking, brightness cap, current, and pins.
- Measure refresh, internal SRAM/PSRAM, bit depth, frame latency, Wi-Fi
  loss/reconnect/TLS behavior, current, voltage drop, and temperature.
- Require at least 200 Hz production refresh and a 24-hour simultaneous
  display/Wi-Fi run with no reset, corruption, or material RF regression.
  Pre-register the measurement method (Protomatter frame counter, fixed bit
  depth, single 64×32 panel, active TLS traffic): no public benchmark
  exists for this configuration, so pass/fail evidence must be first-party
  — and the Wi-Fi/EMI interference risk cited against the alternate DMA
  library also has open reports against Protomatter on this exact board,
  so the official path shares the board-level risk.

Feasibility spikes:

- Browser setup and recovery in current Chrome and Edge (verify Firefox
  151+, which shipped Web Serial in May 2026); local Console behavior
  in Chrome, Edge, Firefox, and Safari.
- HTTPS/local-network/bootstrap experiments, Host/Origin protections, DNS
  rebinding, CSRF, tokens, CORS, and browser Local Network Access behavior.
  Four verified 2026 constraints get named experiments: (1) mixed-content
  blocking — an https page cannot fetch `http://device.local`, and Chrome's
  Local Network Access permission is additive, not a bypass; (2) Chrome
  refuses WebAuthn on origins with certificate errors even after
  click-through, so no passkey ceremony can run on a self-signed device
  origin; (3) public CAs cannot issue certificates for `.local` names, and
  bare IPs are not valid WebAuthn RP IDs; (4) per-device public-cert
  schemes face 200-day (47-day by 2029) certificate lifetimes — a renewal
  cloud-dependency in tension with Local-first. Working position to
  validate: WebAuthn ceremonies execute only on a trusted https origin, and
  the device origin is a token-authenticated transport, never a WebAuthn
  surface.
- Lua/Berry sandbox comparison.
- Eight to twelve representative users attempting setup and first pixel
  without assistance.
- Initial enclosure, one-input fused power-distribution harness, certified 5 V
  supply, BOM, assembly time, and cost model.

Exit: target hardware reaches controlled first pixel, all product-killing
unknowns have evidence, and MatrixPortal is either approved for production
intent or automatically replaced by a custom controller plan.

### P2 — Contract and security freeze

- Freeze REST, WebSocket, MQTT, OTA, app bundle, diagnostics, capability, and
  error contracts.
- Pin the toolchain and dependencies with hashes and license inventory.
- Set measured limits for flash partitions, firmware slots, filesystem,
  Console bundle, heap, PSRAM, app quotas, boot time, frame rate, watchdog
  margin, concurrent TLS sessions, and TLS handshake latency. Re-measure
  slot sizing under the Arduino-CLI/Protomatter build — prior budgets were
  set under the other stack.
- Define device identity, claim, scoped owner tokens, secret storage, reset,
  manufacturing, and audit behavior.
- Resolve ESP32-S3 Secure Boot v2 against owner firmware and browser recovery
  on sacrificial boards. Secure Boot uses RSA-3072 and can disable ROM USB
  recovery paths. Production must prove a signed recovery application and
  physically protected owner-key path. See
  [ESP32-S3 Secure Boot v2](https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/security/secure-boot-v2.html).
- State the two-layer trust model explicitly. The hardware root of trust is
  RSA-3072-PSS — the only Secure Boot v2 scheme on ESP32-S3, with three
  one-way eFuse digest slots, permanent revocation, and no erase path.
  Ed25519 keys live in a software OTA trust set verified by the RSA-signed
  chain. SECURITY.md and ADR-0006 currently conflate the layers
  ("bootloader trust set") and must be reconciled by the superseding ADR,
  which states which layer the owner ceremony modifies — and scopes
  invariant 5's "root of trust" wording if it is the software layer.
- Owner-key promises are layer-dependent: "factory reset wipes enrolled
  keys" is only true for software-layer enrollment; a hardware digest is
  consumed permanently. Field enrollment of a hardware digest requires
  shipping an unrevoked spare slot — a deliberate deviation from
  Espressif's revoke-before-shipping guidance, defensible only as a
  package: Secure Download Mode enabled, firmware-mediated burn as the sole
  eFuse-write path behind the physical-presence hold, aggressive key
  revocation prohibited (it can brick), and sacrificial boards proving both
  directions — the firmware path can burn the slot and ROM-serial paths
  cannot.
- eFuse anti-rollback has no per-signer exemption: the promised owner
  exemption from the version floor must be enforced in the software updater
  (bootloader anti-rollback off) or the promise reworded — an owner image
  that raises secure_version raises the floor for official firmware too.
- Add flash encryption to the same sacrificial-board matrix; it is asserted
  in SECURITY.md but absent from this gate today. In Release mode,
  plaintext serial reflash is impossible without a per-device key. The only
  invariant-compatible options: (a) Secure Boot without release-mode flash
  encryption, or (b) flash encryption with the per-device key handed to the
  owner at provisioning — never escrowed by the company. Burning
  DIS_DOWNLOAD_MODE violates the recovery invariant outright and is
  forbidden.
- Prove browser recovery on hardened boards, not dev boards: Secure
  Download Mode disables the flasher stub and esptool-js documents no
  no-stub mode. WebSerial-flash a signed image from stock Chrome/Edge onto
  a fully hardened board; budget for contributing no-stub support or a
  minimal ROM-protocol flasher if it fails.
- If secure boot, owner control, and customer recovery cannot coexist on
  MatrixPortal, MatrixPortal fails the production gate; do not silently weaken
  recovery or ownership promises. A custom board built on the same ESP32-S3
  cannot cure these constraints — they are chip-level (ROM and eFuse). If
  the S3 trade-offs are rejected on the secure-ownership or recovery axes,
  the fallback must name a different chip family or an ADR-recorded
  re-scoping of invariants 3 and 5. GPLv3 §6 makes owner-installable
  firmware a license duty once external GPL code lands in firmware, so this
  rule is also a legal requirement, not only a value.
- Freeze licenses, threat model, observability schema, redaction rules, and
  manufacturing identity procedure.

Exit: Console, simulator, firmware, SDK, and tests can be implemented
independently against frozen contracts.

### M0 + EVT — Firmware bedrock

Build ten engineering units with:

- Display driver/compositor, fonts, gamma, brightness limits, native clock,
  scene manager, settings, Wi-Fi, time, provisioning, safe mode, and physical
  button.
- Structured serial logs, reset reason, heap/PSRAM watermarks, refresh/FPS,
  Wi-Fi diagnostics, watchdog, crash evidence, and redacted diagnostic export.
- Dual OTA slots, signed dev artifacts, boot-health confirmation, rollback, and
  recovery image.
- Revisioned power harness, enclosure prototype, BOM, approved alternates, and
  pixel/current/Wi-Fi/USB fixture.

Exit:

- Blank unit flashes, joins Wi-Fi, and displays the clock.
- Fifty interrupted-power cycles and deliberately corrupted OTA tests recover.
- USB/recovery succeeds without factory engineering access.
- A 72-hour display/network soak has no unbounded memory or thermal failure.
- Every failure is diagnosable without remote shell access.

### M1 — Real Local product

- Implement device-local claim, owner sessions, scoped/rotatable tokens, real
  REST/WebSocket, device-hosted Console, search, mirror, settings, deploy,
  diagnostics, audit history, and four-pane workbench.
- Implement signed OTA channels and configuration migrations.
- Keep sensitive setup transport aligned with the P2 browser-security decision.

Exit:

- At least 9 of 10 independent users reach first pixel in under five minutes.
- The complete flow works with all Devmatrix/company domains blocked after
  required artifacts are locally available.
- Bad updates roll back repeatedly.
- Factory reset returns a known-good unclaimed device.
- Every Console action maps to a documented API or an explicitly physical-only
  control.

### M2 + M3 — Integrations and open developer platform

- Implement the clean-room MQTT contract and Home Assistant discovery.
- Add layouts, bindings, overlays, scene scheduling, JSON/MQTT sources, and
  per-binding diagnostics.
- Ship simulator, golden renderer, API references, SDKs, examples, fork guide,
  self-hosted OTA guide, and reproducible builds.
- Make logs searchable, configuration exportable, telemetry opt-in and
  previewable, and every integration inspectable.

Exit:

- Home Assistant discovers and controls the device without custom YAML.
- REST, MQTT, WebSocket, simulator, and SDK conformance agree.
- A new developer builds and flashes a fork from a clean machine in under
  15 minutes.
- A third party mirrors firmware/app artifacts and updates with company
  infrastructure blocked.

### M4 — Apps and Registry

- Implement the selected runtime, `.dmapp` installer, permissions, quotas,
  rollback, app logs/metrics, simulator template, Weather, Stocks, Messages,
  and at least two additional small examples.
- Publish the curated Registry and unrestricted sideload path.
- Fuzz bundles, manifests, parsers, VM host calls, HTTP redirects/DNS, MQTT
  topic patterns (wildcards, overlapping subscriptions, device-reserved
  prefixes), storage boundaries, and permission bypasses.

Exit:

- A user creates, publishes, installs, diagnoses, updates, and rolls back a
  documented app.
- A malicious app cannot hang the display, starve OTA/recovery, access
  undeclared hosts, publish or subscribe outside its declared MQTT patterns,
  read another app's storage, steal credentials, or conceal why it was
  killed.
- Installed apps continue working during Registry or GitHub outages.

### L0 + DVT — Production-intent beta

- Build production-intent enclosure, wiring, labels, quickstart, packaging,
  fixture, and controlled provisioning.
- Run ten outside developers for at least 30 combined device-weeks across
  onboarding, Wi-Fi, MQTT, OTA, apps, power loss, and recovery.
- Complete FCC/module-integration review, EMC pre-scan, and required U.S.
  compliance work; use a certified power supply.
- Lock panel/controller/power/ribbon/enclosure revisions and define
  incoming-lot inspection for substituted driver silicon.
- Publish support runbooks, safety information, privacy behavior, known issues,
  warranty boundaries, and RMA procedure.

Exit: no unresolved critical/high security issue, brick, data-loss,
secret-exposure, thermal, provisioning, or claim-evidence defect.

### R0 + PVT — First sellable run

- Purchase approximately 60 input sets to produce at least 50 saleable units
  plus QA/RMA spares.
- Require at least 95% first-pass yield and 100% successful identity/security
  provisioning.
- Test every unit for serial identity, flash/PSRAM, all-pixel camera pattern,
  current, Wi-Fi RSSI, USB/recovery, buttons, clock, OTA, labels, and pack-out.
- Promote the exact tested release candidate to stable; never rebuild
  production binaries.
- Publish source tag, firmware/recovery binaries, hashes, signatures, SBOM,
  provenance, release notes, migrations, known issues, and reproducibility
  result.
- Complete 30-day return policy, one-year limited hardware warranty, support
  channel, replacement inventory, repair/scrap procedure, and stop-ship
  authority.

Exit: random sealed units complete unbox-to-first-pixel without engineering
intervention and public-source hashes reconcile with shipped firmware.

### GA

Sell only when:

- Fifty conforming units and spares are physically reconciled.
- Local operation, Eject/self-hosting, app sideload, recovery, diagnostics,
  source, docs, licenses, and release artifacts are public.
- Every marketing claim links to acceptance evidence.
- Static artifact availability and integrity are monitored without device
  telemetry.
- Price is approved from measured EVT/PVT cost, labor, warranty reserve,
  payment fees, and sustainable margin.
- Optional Cloud is not advertised as available until its separate
  paid/self-hosted gates pass.

## 4. Automation, evidence, and test contract

Create one canonical clean-clone check command used locally and in GitHub
Actions. It must run:

- Clean-room and public-provenance validation.
- Formatting checks, linting, firmware compile matrix, warnings-as-errors, unit
  tests, size/headroom budgets, and dependency locks.
- OpenAPI/AsyncAPI/JSON Schema validation and generated-code drift checks.
- Console typecheck, unit, Playwright, accessibility, search/workbench,
  responsive, and visual-golden tests.
- Simulator/firmware contract conformance and 64×32 golden-frame comparisons.
- App bundle safety, deterministic build, sandbox hostile corpus, resource
  limits, and permission tests.
- Secret scanning, dependency review, CodeQL, license compatibility, SBOM,
  checksums, and artifact provenance.
- Documentation links, command examples, app tutorials, recovery steps, and
  claims-to-evidence validation.
- Manufacturing fixture result-schema and serial uniqueness checks.

Every gate emits an immutable evidence bundle covering:

1. Functional acceptance.
2. Logs, metrics, audits, and failure IDs.
3. User-adjustable configuration and exported state.
4. Source, licenses, SBOM, and reproducible-build result.
5. Security, privacy, secrets, and clean-room proof.
6. Hardware/manufacturing evidence or justified non-applicability.
7. Update, rollback, reset, and recovery evidence.
8. Tested documentation, troubleshooting, and support readiness.

Release behavior remains explicit: when the owner says commit, push, deploy,
publish, ship, or go live, the release workflow means scoped commit, complete
checks, push, remote CI success, appropriate static deployment, live smoke
test, artifact/hash verification, and a clean synchronized worktree. Today
scripts/ship.mjs verifies only deployment-provider success, not the GitHub
Actions run for the pushed commit — add that wait (and the AGENTS.md line
for it) at P0 so the documented and implemented release contracts match.

## 5. Explicit assumptions and fallbacks

- MatrixPortal production use is an intent, not an exemption from the gates.
- The panel photo does not establish a production specification; supplier
  evidence and bench verification are mandatory.
- Chrome/Edge desktop are the supported baseline USB setup/recovery
  browsers; Firefox 151+ ships Web Serial and is verified (not promised) at
  P1. Other current desktop browsers receive the LAN Console after setup.
- Preact/TypeScript/Vite is the candidate Console stack. The production
  choice formally lands at the stack-decision gate that ROADMAP.md,
  PORTAL.md, and ADR-0005 reserve, recorded by ADR in the P0 adoption set.
- Weather remains no-cost using NWS for the U.S.; MET Norway is an attributed
  optional adapter. Open-Meteo's hosted free tier is excluded because it
  prohibits commercial-product use.
- Stock providers remain disabled until the owner supplies a key and confirms
  qualifying personal/internal use. The checkbox records intent but does not
  override provider or exchange terms; connectors are reviewed before every
  release.
- App updates are manual by default.
- Public GitHub releases and local bundles are v1; private GitHub OAuth is
  deferred.
- If both embedded runtimes fail, the product changes its scripting claim
  rather than shipping an unsafe VM.
- If MatrixPortal cannot satisfy display/Wi-Fi, supply, or certification
  requirements, the roadmap automatically inserts a custom ESP32-S3
  controller before DVT. Secure-ownership or recovery failures are
  chip-level, not board-level: that branch requires a different chip family
  or an ADR-recorded re-scoping of invariants (see P2), never a same-chip
  custom board.
- Publishing everything owned is the recommended choice: it strengthens
  repairability, trust, supplier substitution, community contributions, and
  the clean-room record without publishing operational secrets.
