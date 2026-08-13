# ADR-0031 — Browser-to-device transport: plain HTTP on the LAN

**Status:** Accepted · 2026-08-12 · refines ADR-0020 (constraint 1)

## Context

ADR-0020 recorded four web-platform constraints bounding what a local
device origin can do, and docs/PORTAL.md carried "exact browser-to-device
HTTPS trust/bootstrap design" as a P1 launch blocker. The P1 spike is now
run; its evidence is
[hardware/evidence/2026-08-12-browser-transport-spike.md](../../hardware/evidence/2026-08-12-browser-transport-spike.md).

**One recorded constraint was wrong.** ADR-0020's constraint 1 said
Chrome's Local Network Access permission "is additive, not a bypass."
LNA shipped in Chrome 141/142, Edge 143, and Firefox 151, and it *is*
precisely a permission-gated relaxation of mixed-content blocking for
`.local` names and private-IP literals — a manufacturer's HTTPS page
talking to its own LAN device is a named motivating use case. Safari has
filed no position and blocks even `http://localhost`; it is the sole
holdout. Constraints 2 and 3 are confirmed exactly. Constraint 4 is
confirmed and was understated: the binding number is the CA's own
lifetime (Let's Encrypt 90 days today, 64 from Feb 2027, 45 from Feb
2028), not the CA/B ceiling.

The survey of shipping local-first products is decisive: **no product in
2026 gives a browser a clean padlock on a LAN device without a permanent
vendor dependency.** The Plex/Synology pattern — public wildcard certs
over a vendor DNS zone encoding private IPs — was observed *failing in
production*: CSR rate-limit lockouts only staff can clear, a status-page
component for the DNS zone, and owners unable to reach their own servers
**on their own LAN** during a 2026 outage. Home Assistant evaluated the
same pattern and declined to commit. ESPHome ships exactly the design
recommended below.

## Decision

**The device's permanent, first-class local transport is plain HTTP.**
No certificate is ever on the DK-01's critical path.

1. **Device origin — adopt.** The device serves the complete Console and
   `/api/v1` over HTTP on `http://dmx-XXXX.local` and its IP literal.
   The owner reaches it by top-level navigation, which mixed-content
   rules never touch. Works in every browser, offline, forever.
2. **Hosted Console — adopt as additive.** The hosted origin may reach
   the device via an LNA-permitted cross-origin request. Chromium and
   Firefox only; it must **degrade to path 1, never fail**.
3. **Optional device HTTPS — advanced, opt-in, off by default.** A
   self-signed certificate whose fingerprint the panel can display, for
   owners who deliberately install it. Never required.
4. **Rejected: any company-brokered certificate or DNS scheme.** It
   trades the local-first invariant (ADR-0003) and docs/MODES.md's
   company-disappears promise for a padlock that expires in ~90 days
   and shrinking.

ADR-0020's working position is **kept verbatim**: WebAuthn ceremonies
execute only on a trusted HTTPS origin, and the device origin is a
token-authenticated transport, never a WebAuthn surface. Device-local
authority stays the LAN token plus physical presence.

**TLS is not the device's authentication story, so the application layer
must be.** mDNS is unauthenticated — any LAN host can claim the name, and
plain HTTP authenticates no server, so a bearer token can be phished by a
spoofer. The device therefore signs a Console-supplied nonce with its
device key, and the Console verifies it against a key captured
out-of-band. This is the single most important requirement in this ADR.
Because a non-secure origin has no `crypto.subtle`, the device-served
Console bundles a small pure-JS Ed25519 verifier; the hosted Console uses
WebCrypto. One transport abstraction, two crypto backends.

## Consequences

docs/SECURITY.md's "Discovery & local transport" is rewritten in this
change; docs/FIRMWARE.md's "over TLS" auth line becomes "over the LAN
token, on a plain-HTTP origin"; docs/PORTAL.md's open question closes;
docs/PRODUCTION-PLAN.md's P1 constraint list is corrected and gains the
named experiments below. The ADR-0014 per-transport capability descriptor
gains a `secureContext: false` flag so the crypto-backend and
WebAuthn-availability split is declarative, not UI special-casing.

Firmware requirements: everything inlined (no CDN — ESPHome's
`oi.esphome.io` default is the trap to avoid); mDNS **and** raw-IP
operation; an exact-origin CORS allowlist, never `*`; a Host allowlist
against DNS rebinding; bearer token only, never a cookie, so there is no
ambient authority to forge.

Accepted cost: owners see a "Not secure" chip, exactly as Home Assistant,
ESPHome, and OctoPrint owners do. That is the honest price of a box that
still works when we are gone, and it buys back the ~22–42 KB of heap per
TLS session that an ESP32-S3 cannot spare.

Open, tracked as named P1 experiments: whether `ws://` to a `.local` host
is LNA-exempt (fallback: dial the IP literal); whether `.local` is exempt
from Chrome's HTTPS-Upgrades; Firefox's staged 151→153 parity; and the
macOS/iOS OS-level local-network permission that can block a browser from
resolving `.local` at all. The IETF SETTLE working group's August 2026
"close or recharter" milestone should be re-checked at P2; no standards
rescue arrives inside this timeline.
