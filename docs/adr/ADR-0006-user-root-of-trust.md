# ADR-0006 — User-enrollable root of trust

**Status:** Accepted · 2026-08-04

## Context
"Full control of your own hardware" is hollow if only the company's key
can sign firmware the device accepts over the air. Power users (Tier 3)
will fork; making them fight secure boot would push them to disable
security entirely — the worst outcome.

## Decision
Owners can enroll their own Ed25519 firmware-signing public key into the
device trust set via a physical-presence ceremony (Console passkey
re-auth + 5 s button hold). The device then accepts firmware signed by
either the release key or the owner key. Enrollment and every use are
permanently audit-logged and visible on the Security page. Our
anti-rollback floor does not apply to owner-signed builds.

## Consequences
An owner can brick-adjacent their box with bad firmware — mitigated by
dual-slot rollback and USB recovery, and it is their right. Support
policy: owner-signed firmware issues get best-effort help, stated
plainly. Resale safety: factory reset wipes enrolled keys.
