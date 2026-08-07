# ADR-0020 — Browser support matrix

**Status:** Accepted · 2026-08-07

## Context

DK-01 setup and recovery flash firmware from the browser over Web
Serial, which only some browsers implement. Separately, four verified
2026 web-platform constraints bound what a local device origin can
ever do:

1. Mixed-content blocking: an https page cannot fetch
   `http://device.local`, and Chrome's Local Network Access permission
   is additive, not a bypass.
2. Chrome refuses WebAuthn on origins with certificate errors, even
   after manual click-through — no passkey ceremony can run on a
   self-signed device origin.
3. Public CAs cannot issue certificates for `.local` names, and bare
   IP addresses are not valid WebAuthn RP IDs.
4. Per-device public-certificate schemes face short lifetimes (200
   days today, 47 by 2029) — a renewal cloud-dependency in tension
   with Local-first (ADR-0003).

## Decision

Chrome and Edge on desktop are the baseline supported browsers for USB
setup and recovery. Firefox 151+, which shipped Web Serial in May
2026, is verified at P1 — verified, not promised. Safari and all other
current desktop browsers get the LAN Console after setup; none is ever
required for setup or recovery.

Working position, validated at P1: WebAuthn ceremonies execute only on
a trusted https origin. The device origin is a token-authenticated
transport (the LAN token of docs/SECURITY.md), never a WebAuthn
surface. This is consistent with ADR-0008: device-local authority
comes from the device-local owner session and physical presence, not
from a passkey ceremony performed against the device itself.

## Consequences

Setup documentation and the storefront must state the Chrome/Edge
baseline plainly, and Firefox support is claimed only after P1
evidence. The Console never attempts a passkey ceremony against the
device origin, and no per-device public-CA certificate scheme enters
the design. The P1 transport spike (docs/PRODUCTION-PLAN.md) carries a
named experiment for each of the four constraints; if measurement
contradicts any of them, this matrix is revisited by a superseding
ADR.
