# Security model

The buyers are high-profile and actively targeted. Security here is a
visible feature: everything below must be inspectable by the owner in
the Console (audit log, key fingerprints, session list) — not asserted
in marketing copy.

## Principles

1. **Physical presence beats cloud.** Claiming, factory reset, and
   root-of-trust changes require touching the device.
2. **User owns the device, really.** Own signing key enrollment, Local
   Mode, Eject. We never hold a capability the owner can't revoke.
3. **No inbound WAN ports, ever.** The LAN API listens only on the local
   network; remote access uses a device-initiated outbound relay.
   mTLS is the device→relay link. We never expose the LAN listener to
   the public internet.
4. **Assume account compromise attempts.** Passkeys only; no passwords,
   no SMS, no security questions. (ADR-0004)
5. **Minimal data.** Telemetry opt-in and off by default; Snapshots are
   end-to-end encrypted — we cannot read device backups.

## Identity & key hierarchy

Firmware trust is two distinct layers, not one "trust set"
([ADR-0021](adr/ADR-0021-two-layer-trust-model.md)): a permanent
hardware root, and a wipeable software trust set it verifies.

| Key | Layer & custody | Purpose | Status |
|---|---|---|---|
| Secure Boot v2 digests (RSA-3072) | Hardware — one-way eFuse slots on ESP32-S3 | Root of trust for the boot chain; burning and revocation permanent, no erase path | **Ahead** — resolved on sacrificial boards at gate P2 |
| Release signing key (Ed25519) | Software OTA trust set; private key offline/HSM, company | Signs official firmware; verified by the RSA-signed chain | **Ahead · gate M0** (signed OTA) |
| Owner signing key (optional, Ed25519) | Software OTA trust set; owner's custody | Enrolled via ceremony; device then also accepts owner-signed firmware | **Ahead · gate M2** |
| Per-device identity keypair + cert | Burned at provisioning (secure boot; flash encryption per the stance below) | Device authentication to relay (mTLS) and to LAN clients | LAN half **today** (first-boot Ed25519 identity key, v0.9.0+, ADR-0031); provisioning-burned cert + relay mTLS **Ahead · gate C1** |
| Account passkeys (WebAuthn) | User's authenticators | Only way into a Cloud account; hardware keys supported | **Ahead · gate C0** |
| Device LAN token / pairing | Device NVS | Guards `/api/v1` on LAN; rotatable from Console | **Today** |
| Snapshot key | Derived on the user side | E2EE backups; never leaves user custody | **Ahead · gate M2** |

Flash encryption stance (ADR-0021): either (a) Secure Boot without
release-mode flash encryption, or (b) flash encryption with the
per-device key handed to the owner at provisioning — never escrowed.
Burning `DIS_DOWNLOAD_MODE` is forbidden; USB recovery must survive.

## Discovery & local transport

How a browser finds and talks to the box — specified here because this
is where LAN products usually hand-wave (browsers cannot scan a LAN,
and we would not want them to):

- **Provisioning first.** Out of the box the device has no network.
  Join it via the `DEVMATRIX-XXXX` SoftAP captive portal today, or —
  **Ahead · gate M0** ([docs/MODES.md](MODES.md) owns the gate) — Improv
  WiFi over USB (the start page talks to the cable, not the LAN). No app.
- **The setup window is open by design — and bounded.** The
  `DEVMATRIX-XXXX` hotspot is unencrypted and its `/setup` surface is
  unauthenticated; from a successful Wi-Fi join until the owner
  finishes setup, the joining page (or any client still on the
  hotspot) can read the minted LAN token. Exposure is bounded by RF
  range and the seconds-long setup window; hardening (an AP password
  shown on the panel, auto-closing the window) is tracked for gate M0.
- **The panel is the directory.** Once on WiFi, the panel shows its
  own address (`dmx-0952.local`) next to the claim code. Discovery is
  the owner reading the panel — never a cloud page scanning the LAN.
- **The box never scans either (ADR-0032).** The device initiates
  connections only to addresses the owner explicitly configured — SNTP,
  the owner's MQTT broker, and owner-entered app sources. There are no
  discovery probes: consumer router security suites flag
  device-initiated multi-host probing, and a panel that gets its
  owner's network flagged is a failure regardless of how polite the
  probe was. Its mDNS *responder* only answers questions, never asks
  them. Receiver discovery is owner-side (a finder prompt in the
  Console), not device-side.
- **LAN auth is the LAN token.** Every `/api/v1` route requires
  `Authorization: Bearer <LAN token>`. The token is minted at claim,
  surfaced in the Console (which renders copy-paste commands with it
  embedded), and rotatable/revocable per device. Read-only scoped
  tokens for integrations are **Ahead · gate M1**.
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
  self-signed HTTPS with a panel-displayed fingerprint stays available
  as an advanced, opt-in path. mTLS remains reserved for the
  device→relay link, where no browser is involved.
- **Because TLS is absent, the device authenticates at the application
  layer** (implemented in firmware 0.9.0). mDNS is unauthenticated — any
  LAN host can claim the name — and plain HTTP authenticates no server,
  so a bearer token alone can be phished by a spoofer. The device
  therefore signs a Console-supplied nonce
  (`"dmx-id-v1:<serial>:" + nonce`) with an Ed25519 device key minted on
  first boot and held in NVS; the Console verifies the signature and
  pins the public key at pairing time — the possession-proof moment —
  then checks every later proof against the pin. The panel-readable
  key fingerprint is the first 4 bytes of SHA-256 of the public key.
  A non-secure origin has no `crypto.subtle`, so the Console carries a
  small pure-JS verifier (@noble/ed25519); it prefers WebCrypto where
  the browser's WebCrypto supports Ed25519. Firmware enforces the
  exact-origin CORS allowlist (never `*`) and a Host-header allowlist
  against DNS rebinding, and the token is a bearer header only — never
  a cookie, so there is no ambient authority to forge.
- **No WebAuthn on the device origin, ever.** Chrome refuses WebAuthn on
  origins with certificate errors, and bare IPs are not valid RP IDs.
  Passkeys are a Cloud Mode account credential on the hosted origin
  only; device-local authority is the LAN token plus physical presence.
- **Rebinding/CSRF-hostile.** Mutating routes validate `Host` against
  the device's own names and reject foreign `Origin`s; combined with
  the bearer-token requirement. P1 must exercise DNS-rebinding and CSRF
  cases against the chosen browser transport before this mitigation is
  considered proven.

## Ceremonies

**Claiming** (proof of possession — the full ceremony below is the
gate M1 target; today's firmware pairs by panel code,
[docs/MANUAL.md](MANUAL.md) ch. 4):
1. Unclaimed device shows its claim code and LAN address on the panel
   (see Discovery & local transport — nothing secret is broadcast).
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
owner-signed builds are exempt from our floor (their box, their rules).
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

## Tenancy & cloud

- Strict isolation: row-level security keyed by account; device list,
  metrics, logs, and audit streams are never queryable across tenants.
- Relay auth: device presents its cert (mTLS); sessions bind device ↔
  claiming account only. Fleet views are just "my devices", plural.
- MQTT stays the **user's broker** on their LAN. If we ever offer a
  hosted broker it will be opt-in with per-device ACLs scoped to
  `devmatrix/<serial>/#` — but the default posture is: we don't run one.

## App sandbox

Apps declare capabilities in the bundle manifest; the Console shows them
before install (permission chips): allowed hosts, storage quota, refresh
rate, draw access. Launch apps are declarative (ADR-0026), so the
enforcement surface is the binding engine: fetches go only to declared
hosts, responses have bounded size and parse depth, and refresh-rate and
storage quotas are enforced per app — a hostile app or a hostile data
source cannot hang the panel or reach beyond its declared hosts. The
scripted tier's VM protections (per-tick instruction budgets, watchdog
kill) are deferred with that tier and return only if it ships. Registry
apps get static checks + community review; sideloaded apps are the
owner's own risk, stated plainly.

## Data & privacy

- Telemetry: **off by default**, opt-in, and visible ("what we'd send"
  preview). Crash reports likewise.
- Export-all and delete-all (device data, account) are self-serve.
- Snapshots E2EE; loss of user key = loss of backups, and we say so.
- No location collection. mDNS/LAN discovery never leaves the LAN.

## Ops & supply chain

- Firmware built and signed by public CI from tagged releases;
  reproducible builds documented; SBOM published per release.
- Dependencies pinned; the display driver is Adafruit Protomatter at
  the exact pinned release (ADR-0013).
- Shipped units carry zero manufacturer-environment traces: no company
  or development Wi-Fi credentials, IP addresses, broker or receiver
  endpoints, or tokens. Bench and development units never ship; R0
  per-unit provisioning verifies a factory-fresh unit (ADR-0023).
- `security.txt`, a disclosure policy, and a named response SLA.
- Signing keys: release key offline; a documented key-rotation and
  compromise-response runbook before the first sellable run (gate R0).

## Threats → mitigations (abridged)

| Threat | Mitigation |
|---|---|
| Phished account | Passkeys only; no password/SMS to phish; new-login + security-event notifications |
| Stolen/resold device | Re-claim requires factory reset + physical access; prior owner notified; data wiped |
| Claimed device lost / walks away | Owner marks it lost: relay sessions revoked instantly; secure wipe of NVS secrets + app storage queued for next contact; LAN token / WiFi / MQTT credentials rotated in one click; all audit-logged |
| LAN scanner / drive-by | LAN token required on every route; Host/Origin validation is tested against DNS rebinding + CSRF; no inbound WAN ports; nothing anonymously writable |
| Malicious app / hostile data source | Declared capabilities, quotas, bounded fetch + parsers, per-app audit (ADR-0026) |
| Malicious/compromised OTA | Signature verify against trust set, anti-rollback floor, dual-slot rollback |
| Insider/cloud breach | E2EE snapshots, minimal data, Local Mode & Eject as standing exits, audit transparency |
| Supply-chain dep attack | Pinned deps, SBOM, public reproducible CI |
| Buyer dumps a shipped unit's flash/NVS | Full dev access is the product; units ship factory-fresh with no manufacturer credentials, addresses, or endpoints to find (ADR-0023) |

## What we never do

Run required cloud. Hold unencrypted backups. Ship silent updates
(every change lands in the audit log and the changelog feed). Reuse
closed-product code or schemas (ADR-0001). Sell or share telemetry.
