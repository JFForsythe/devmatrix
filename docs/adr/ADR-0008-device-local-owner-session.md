# ADR-0008 — Device-local authorization for trust enrollment

**Status:** Accepted · 2026-08-06 · refines ADR-0004 and supersedes
ADR-0006 only for its passkey authorization requirement

## Context

ADR-0006 correctly requires physical presence to enroll an owner's
firmware-signing key, but its original wording also requires a Console
passkey re-authentication. ADR-0007 later made Local Mode the complete,
account-free product. Requiring a Cloud account passkey for a local
hardware-ownership ceremony would contradict that boundary.

Cloud account authentication and device ownership are separate claims.
The enrollment ceremony needs strong proof of the latter without making
the former a dependency.

## Decision

In Local Mode, a fresh device-local owner session authorizes the Console
to begin root-of-trust enrollment. The device then displays the pending
change and requires its physical button to be held for 5 seconds before
adding the owner's public key. The session alone can never alter the
trust set, and no Devmatrix account or account passkey is required.

When a device is attached to a Cloud account, Cloud initiation also
requires account passkey re-authentication. That check is additive: the
device prompt and physical hold remain mandatory. Enrollment and every
use of the owner key remain permanently visible in the device audit log.

## Consequences

Local owners retain full hardware control if the company is unreachable,
while Cloud-originated security changes still receive a fresh account
authentication check. The production design must specify expiry,
revocation, and secure storage for device-local owner sessions and prove
the browser-to-device transport at the P1 gate.
