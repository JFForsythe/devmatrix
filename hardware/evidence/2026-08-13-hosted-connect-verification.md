# Evidence — hosted-Console connect flow and device-identity verification

**Date:** 2026-08-13 · **Gate:** ADR-0031 implementation (application-layer
device authentication; hosted Console as an additive path) and the
docs/PORTAL.md "five-minute first pixel" onboarding requirement. Software
only — the physical DK-01 was not attached; the device side ran as a
protocol-exact mock. On-hardware acceptance remains open below.

## What was built and what this verifies

Firmware v0.9.0 implements ADR-0031's requirements: an Ed25519 device
identity key minted on first boot (NVS), open `GET /api/v1/identity` and
`POST /api/v1/identity/verify` (signature over
`"dmx-id-v1:<serial>:" + nonce`), the identity riding on `claim/finish`
and setup-join responses, an exact-origin CORS allowlist admitting only
`https://devmatrix.flighttrackerled.com` (never `*`), and a Host-header
allowlist. The Console gained the hosted welcome/connect flow, Ed25519
verification with browser-side key pinning (`src/identity.ts`,
@noble/ed25519 fallback under WebCrypto preference), the Guide view, the
always-visible mode chip, and forget/switch-device controls.

## Method

- A Node mock of the v0.9.0 device surface (`mock-device.mjs`) served
  the new API on `localhost:8990`, signing with a real Ed25519 key via
  the same @noble library family the Console bundles, and enforcing the
  same CORS/preflight and claim semantics as `dk01.ino`. The allowlisted
  origin stood in as `localhost:8000`, which served the committed hosted
  bundle `dist-hosted/index.html`.
- Playwright (Chromium 140-line, revision 1223) drove the full buyer
  flow; the mock's request log is the wire-truth record.
- Firmware compile: `arduino-cli compile --fqbn
  esp32:esp32:adafruit_matrixportal_esp32s3` against the pinned
  arduino-esp32 3.3.11 core with `Crypto@0.4.0`.

## Results

All sixteen scripted checks passed:

- Welcome screen renders on a fresh hosted load; demo entry is offered
  and labeled `DEMO · SAMPLE DATA`; the Guide view renders.
- Connect: health probe → CORS preflight (204, exact-origin echo; a
  hostile origin's preflight gets 403 with no CORS headers) → signed
  nonce verified in-browser → key pinned, fingerprint shown.
- After reload the app is live; the first authenticated call's 401
  opens the pairing modal; the panel code pairs, and `claim/finish`'s
  identity fields match the pin.
- `POST /api/v1/display/text` arrived at the device with the bearer
  token through a preflighted cross-origin request (wire log:
  `POST /api/v1/display/text authed=true origin=http://localhost:8000`).
- Security → VERIFY NOW re-proved identity against the pin; after a
  key rotation on the mock (`/debug/rekey`, simulating a reflash or
  spoofer), the same check flagged the mismatch and refused quietly
  trusting the new key.
- Signature tamper checks fail closed (wrong nonce, wrong message).
- Firmware compiles at 64 % flash / 36 % static RAM.

Cross-implementation note: the firmware signs with rweather `Crypto`
0.4.0 (RFC 8032 Ed25519, 32-byte seed keys) and the Console verifies
with @noble/ed25519 2.3.0 — both RFC 8032 implementations. The E2E run
proves the Console side against a noble signer; firmware-vs-noble
interop rests on both libraries' RFC 8032 conformance until the
on-hardware step below.

## Still open (hardware / owner steps)

- Flash v0.9.0 to the physical DK-01 and repeat: connect from the real
  hosted origin, Chrome/Edge/Firefox LNA permission prompts, `.local`
  resolution, identity verify against the board's own signer.
- The four named ADR-0031 browser experiments (ws:// LNA exemption,
  `.local` vs HTTPS-Upgrades, Firefox 151→153 parity, macOS local
  network permission).
- Hosted-domain cutover and DNS for `devmatrix.flighttrackerled.com`
  (docs/OPERATIONS.md owns the recipe).
