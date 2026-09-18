# Security model

This document owns the threat model, key hierarchy and security ceremonies.
It separates implemented controls from the release design. The
[manual](MANUAL.md) owns owner actions; [contracts/rest.md](../contracts/rest.md)
owns exact endpoint authentication; [ROADMAP.md](../ROADMAP.md) owns acceptance.

## What exists today

| Area | Firmware v0.12.6 reality | Remaining work |
|---|---|---|
| LAN authority | One full-control bearer token per device, minted on first boot, stored in NVS and rotatable | Scoped tokens, revocable individual browser sessions, physical confirmation of sensitive actions |
| Browser pairing | Six panel digits, five-minute code lifetime, five misses per code | Global throttling and session-bound physical confirmation; a fresh code can currently be requested immediately |
| Device identity | First-boot Ed25519 key and signed-nonce proof, Console key pinning | Independently authenticated first-use key capture and protection against an active HTTP proxy |
| LAN transport | Plain HTTP, Host allowlist in Console mode, hosted-origin CORS responses | Request-side Origin checks, pre-buffer request caps and complete browser/device abuse tests |
| Setup | Open hotspot; unauthenticated setup routes; closes after successful join and Finish or a 90-second timeout | Constrain setup to the intended interface/session and require presence before reopening on a provisioned device |
| OTA | Bearer-authenticated image upload into the inactive app slot; SDK rollback support enabled | Signed manifests/images, health-based rollback acceptance and recovery evidence |
| App sources | Size/depth limits, stale rendering; HTTPS certificate verification disabled | CA trust, redirect destination enforcement and total fetch deadlines |
| MQTT TLS | TLS option exists, but the code supplies no CA or other verification mechanism | Verified broker trust and a successful TLS device test; do not assume the option establishes a working TLS connection |
| Cloud and advanced security UI | Design and demo surfaces | Passkeys/accounts, relay, audit log, guests, snapshots and owner signing-key enrollment are not implemented device services |

Plain HTTP does not encrypt credentials, commands or responses. A trusted LAN
is part of today's operating assumptions. The identity proof can detect a
changed pinned key, but cannot make the HTTP connection confidential or stop
an active proxy from forwarding a valid proof and then reading bearer traffic.
The device-served Console itself is delivered over HTTP. Do not describe this
as equivalent to server-authenticated TLS.

## Principles — target design

These are design requirements. The table above identifies current exceptions;
planned controls below must not be presented as release evidence.

1. **Physical presence beats cloud.** Claiming, factory reset, and
   root-of-trust changes require touching the device.
2. **User owns the device, really.** Own signing key enrollment, Local
   Mode, Eject. I never hold a capability the owner can't revoke.
3. **No inbound WAN ports, ever.** The LAN API listens only on the local
   network; remote access uses a device-initiated outbound relay.
   mTLS is the device→relay link. I never expose the LAN listener to
   the public internet.
4. **Assume account compromise attempts.** Passkeys only; no passwords,
   no SMS, no security questions. (ADR-0004)
5. **Minimal data.** Telemetry opt-in and off by default; Snapshots are
   end-to-end encrypted — I cannot read device backups.

## Identity & key hierarchy

Firmware trust is two distinct layers, not one "trust set"
([ADR-0021](adr/ADR-0021-two-layer-trust-model.md)): a permanent
hardware root, and a wipeable software trust set it verifies.

| Key | Layer & custody | Purpose | Status |
|---|---|---|---|
| Secure Boot v2 digests (RSA-3072) | Hardware — one-way eFuse slots on ESP32-S3 | Root of trust for the boot chain; burning and revocation permanent, no erase path | **Ahead** — resolved on sacrificial boards at gate P2 |
| Release signing key (Ed25519) | Software OTA trust set; private key offline/HSM, company | Signs official firmware; verified by the RSA-signed chain | **Ahead · gate M0** (signed OTA) |
| Owner signing key (optional, Ed25519) | Software OTA trust set; owner's custody | Enrolled via ceremony; device then also accepts owner-signed firmware | **Ahead · gate M2** |
| Per-device identity keypair + cert | Today: Ed25519 secret in runtime NVS. Target relay certificate: provisioning | Key continuity for LAN clients; future relay mTLS | LAN key **Today** (ADR-0031); provisioning certificate + relay mTLS **Ahead · gate C1** |
| Account passkeys (WebAuthn) | User's authenticators | Only way into a Cloud account; hardware keys supported | **Ahead · gate C0** |
| Device LAN token / pairing | Device NVS | Guards `/api/v1` on LAN; rotatable from Console | **Today** |
| Snapshot key | Derived on the user side | E2EE backups; never leaves user custody | **Ahead · gate M2** |

Flash encryption stance (ADR-0021): either (a) Secure Boot without
release-mode flash encryption, or (b) flash encryption with the
per-device key handed to the owner at provisioning — never escrowed.
Burning `DIS_DOWNLOAD_MODE` is forbidden; USB recovery must survive.

## Discovery and local transport

How a browser finds and talks to the box — specified here because this
is where LAN products usually hand-wave (browsers cannot scan a LAN,
and I would not want them to):

- **Provisioning first.** Out of the box the device has no network.
  Join it via the `DEVMATRIX-XXXX` SoftAP captive portal today, or —
  **Ahead · gate M0** ([docs/MODES.md](MODES.md) owns the gate) — Improv
  WiFi over USB (the start page talks to the cable, not the LAN). No app.
- **The setup window is open by design, with important limits.** The
  `DEVMATRIX-XXXX` hotspot and setup routes are unauthenticated. Setup runs
  in AP+STA mode, and the HTTP listener is not restricted to the hotspot
  interface. After Wi-Fi joins, `/setup/status` exposes the current token
  to reachable clients on either interface until reboot. Finish closes the
  window; otherwise a successful join starts a 90-second timeout. This does
  not bound an unsuccessful setup session. A provisioned device also reopens
  setup after a 25-second boot-time join failure, without a button press.
  Interface restriction, session binding and physically authorized recovery
  setup are open hardening work, not enforced today.
- **The panel is the directory.** The final setup card shows the device's
  address. Asking to pair replaces it temporarily with two rows of digits;
  address and code are not displayed together today. Discovery begins with
  the owner reading the panel, not a hosted page scanning the LAN.
- **No discovery probes (ADR-0032).** Receiver discovery is owner-side,
  assisted by the Console's finder prompt. Firmware advertises its own mDNS
  name; it contains no receiver-probing route. The stronger configured-host
  boundary still has a gap: app HTTP clients follow redirects without checking
  the new host. SNTP also uses built-in public servers rather than an
  owner-configurable time source. [FIRMWARE.md](FIRMWARE.md) owns that behavior.
- **LAN auth is the LAN token.** Protected routes require
  `Authorization: Bearer <LAN token>`. Health, identity and pairing routes
  are intentional public exceptions, listed in
  [contracts/rest.md](../contracts/rest.md). The token is minted on first boot,
  returned during setup or successful panel-code pairing, and rotatable.
  All paired clients share it; rotating it invalidates every client. There
  is no separate owner account, ownership-transfer lock or individual session
  revocation today. Factory reset currently requires the token, not a button
  hold; the USB reset path requires physical access.
- **The local transport is plain HTTP, permanently** (ADR-0031, decided
  by the P1 spike —
  [evidence](../hardware/evidence/2026-08-12-browser-transport-spike.md)).
  No certificate is ever on the device's critical path: publicly trusted
  certificates cannot be issued for `.local` or private IPs, and every
  company-brokered scheme dies with the company inside a certificate
  lifetime, breaking Local-first (ADR-0003). Owners reach the device by
  top-level navigation, which mixed-content rules never touch. The
  hosted Console may additionally reach it through the browser's Local
  Network Access permission (Chromium and Firefox; never Safari), and
  must degrade to the device-served path rather than fail. Optional
  self-signed HTTPS with a panel-displayed fingerprint is an accepted
  advanced direction, **not implemented in the current firmware**. mTLS remains
  reserved for the planned device→relay link, where no browser is involved.
- **Application-layer identity (ADR-0031).** The device signs a fresh
  Console nonce with its Ed25519 NVS key; the Console can compare the result
  to a remembered public key. [contracts/rest.md](../contracts/rest.md) owns
  the signed bytes and response fields. Key capture during pairing currently
  travels over the same HTTP path as the token; it is trust on first use,
  not an independently authenticated out-of-band channel. The setup page
  receives identity fields but forwards only the token in its Console link.
  The short key fingerprint is visible in the Console and USB serial; the
  firmware does not currently render it on the panel. A trusted copy of the
  Console and an independently checked key improve first-use confidence;
  they do not encrypt later bearer traffic or prevent proof forwarding.
- **No WebAuthn on the device origin, ever.** Chrome refuses WebAuthn on
  origins with certificate errors, and bare IPs are not valid RP IDs.
  Passkeys are a Cloud Mode account credential on the hosted origin
  only; device-local authority is the LAN token plus physical presence.
- **Host/CORS controls and their limits.** Console-mode middleware rejects
  unrecognized Host values and grants CORS preflight only to the hosted origin.
  Non-OPTIONS handlers do not reject foreign Origin headers. CORS controls
  browser response access, not all request side effects; open pairing routes
  remain anonymously writable. In the current Arduino core, multipart upload
  callbacks run before server middleware, so OTA must enforce relevant checks
  in the upload callback too. Bearer headers avoid cookie-based ambient
  authority, but are not a substitute for these missing checks.

## Outbound connections

App HTTPS currently calls `setInsecure()`: traffic is encrypted without
certificate identity verification. Use data sources appropriate to that
limitation until CA trust is implemented. Redirects and slow-response
handling also need enforcement, as described above.

The MQTT client selects TLS when enabled but provides no CA, certificate
bundle, PSK or global trust store. Skipping the certificate common-name check
alone does not select a trust method. ESP-TLS defaults to failing connection
setup when none is configured; the installed 3.3.11 SDK does not enable the
insecure bypass. A working, verified MQTT TLS path remains unproven. See
[Espressif's verification model](https://docs.espressif.com/projects/esp-idf/en/v5.5/esp32/api-reference/protocols/esp_tls.html#tls-server-verification)
and the [current review](reviews/2026-09-08-full-review/firmware-and-contracts.md).

## Ceremonies — target requirements

The following ceremonies specify the release design. Current pairing and
reset behavior is described above; the button holds, claim attestation,
owner-key enrollment, update signature verification and guest system below
are not implemented in the current tree.

**Claiming** (proof of possession — the full ceremony below is the
gate M1 target; today's firmware pairs by panel code,
[docs/MANUAL.md](MANUAL.md) ch. 4):
1. Unclaimed device shows its claim code and LAN address on the panel
   (see Discovery and local transport).
2. User opens the start page and enters what the panel shows — or
   browses to the device address directly for a cloudless claim.
3. Console requests possession proof → the panel displays the
   requesting session's short code (`CLAIM → 7F2Q?`) and prompts; user
   holds the physical button 2 s within a 60 s window. The attestation
   embeds that session nonce, so a race by a second claimer is visible
   on the panel and the proof is valid only for the session shown.
4. Device mints a claim attestation (signed by its device cert) and the
   LAN token lands in the claiming browser. Claiming is complete here —
   **no account exists yet.** Creating a passkey account is the
   optional next step toward Cloud Mode (docs/MODES.md); the same
   attestation binds it, but relay activation still requires separate,
   explicit subscription confirmation. Local-only owners stop before
   either and lose nothing.
5. Re-claiming a claimed device requires factory reset = physical
   access; the previous owner gets notified and the device's prior data
   is wiped. Stolen-goods hostility by design.

**OTA update**: manifest over HTTPS (static, self-hostable) → verify
sha256 + signature against the software trust set → write to inactive
slot → boot health check (N failures → auto-rollback) → settings
migration hook. Security-fix releases may bump an anti-rollback floor;
owner-signed builds are exempt from my floor (their box, their rules).
The exemption is enforced by the software updater with bootloader
anti-rollback off — eFuse anti-rollback has no per-signer exemption
(ADR-0021).

**Root-of-trust enrollment**: Console proves the device-local owner
session → device prompts → button hold 5 s → owner's public key added
to the software trust set — the default layer, and the only one factory
reset wipes. A Cloud account additionally requires passkey
re-authentication, but Local enrollment never requires an account.
The event is permanent in the audit log and visible on the Security
page forever. The optional hardware-digest path burns a one-way eFuse
slot that survives factory reset and resale; see
[ADR-0021](adr/ADR-0021-two-layer-trust-model.md).

**Guest access**: owner picks scopes (e.g. `display.brightness`,
`quiet-hours`) + expiry → invite link → guest uses their own passkey;
every guest action is audit-logged and attributed.

## Tenancy and cloud — planned

- Strict isolation: row-level security keyed by account; device list,
  metrics, logs, and audit streams are never queryable across tenants.
- Relay auth: device presents its cert (mTLS); sessions bind device ↔
  claiming account only. Fleet views are just "my devices", plural.
- MQTT stays the **user's broker** on their LAN. If I ever offer a
  hosted broker it will be opt-in with per-device ACLs scoped to
  `devmatrix/<serial>/#` — but the default posture is: I don't run one.

## App permissions — current bounds and M4 target

Today's declarative engine accepts one owner-entered custom layout plus the
bundled app settings. It bounds layout bytes, rows, pointer traversal and
response storage; [contracts/layout.md](../contracts/layout.md) owns the
numbers. It does not implement a `.dmapp` capability manifest, allowed-host
list, Registry review pipeline, per-app storage quota or app audit log.
Redirect destinations are not constrained, and a response can hold the main
loop busy by continually sending bytes before the idle timeout.

At M4, declarative apps must declare allowed hosts, storage, refresh rate and
draw permissions before installation, with enforcement in the binding engine.
Registry apps require static checks and community review. The scripted tier
remains deferred (ADR-0026); any future VM additionally needs instruction
budgets and watchdog termination. Sideloading must not be described as a
sandbox guarantee until those controls exist and are tested.

## Data and privacy — target requirements

- Telemetry: **off by default**, opt-in, and visible ("what I'd send"
  preview). Crash reports likewise.
- Export-all and delete-all (device data, account) are self-serve.
- Snapshots E2EE; loss of user key = loss of backups, and I say so.
- No location collection. mDNS/LAN discovery never leaves the LAN.

## Ops and supply chain — release requirements

- Current public CI compiles firmware. Signed tagged-release artifacts,
  reproducible-build evidence and a published SBOM are still release work;
  [OPERATIONS.md](OPERATIONS.md) owns the pipeline.
- Dependencies pinned; the display driver is Adafruit Protomatter at
  the exact pinned release (ADR-0013).
- Shipped units carry zero manufacturer-environment traces: no company
  or development Wi-Fi credentials, IP addresses, broker or receiver
  endpoints, or tokens. Bench and development units never ship; R0
  per-unit provisioning verifies a factory-fresh unit (ADR-0023).
- `security.txt`, a disclosure policy, and a named response SLA.
- Signing keys: release key offline; a documented key-rotation and
  compromise-response runbook before the first sellable run (gate R0).

## Threats → target mitigations (not a current acceptance checklist)

| Threat | Mitigation |
|---|---|
| Phished account | Passkeys only; no password/SMS to phish; new-login + security-event notifications |
| Stolen/resold device | Re-claim requires factory reset + physical access; prior owner notified; data wiped |
| Claimed device lost / walks away | Owner marks it lost: relay sessions revoked instantly; secure wipe of NVS secrets + app storage queued for next contact; LAN token / WiFi / MQTT credentials rotated in one click; all audit-logged |
| LAN scanner / drive-by | Token for protected control routes, explicitly bounded public pairing/setup, Host/Origin validation and browser/device abuse tests; current gaps are listed above |
| Malicious app / hostile data source | Declared capabilities, quotas, bounded fetch + parsers, per-app audit (ADR-0026) |
| Malicious/compromised OTA | Signature verify against trust set, anti-rollback floor, dual-slot rollback |
| Insider/cloud breach | E2EE snapshots, minimal data, Local Mode & Eject as standing exits, audit transparency |
| Supply-chain dep attack | Pinned deps, SBOM, public reproducible CI |
| Buyer dumps a shipped unit's flash/NVS | Full dev access is the product; units ship factory-fresh with no manufacturer credentials, addresses, or endpoints to find (ADR-0023) |

## Product commitments

The product must never require company cloud, hold unencrypted owner backups,
sell or share telemetry, or silently update devices. The planned audit log
and changelog must make updates visible. The clean-room boundary is owned by
[AGENTS.md](../AGENTS.md) and ADR-0023; this security design does not create an
exception to it.
