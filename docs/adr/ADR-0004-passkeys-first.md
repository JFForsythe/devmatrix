# ADR-0004 — Passkeys-first, no passwords

**Status:** Accepted · 2026-08-04

## Context
The buyer profile is high-profile and actively phished. Passwords are
the single largest account-takeover surface; SMS 2FA is SIM-swappable.
This audience owns modern devices and hardware keys.

## Decision
Cloud accounts authenticate with WebAuthn passkeys only. No passwords,
no SMS, no security questions, no email-link login as a primary path.
Hardware security keys are first-class. Recovery is explicit and
documented (secondary passkey strongly pushed at onboarding; printed
recovery codes as last resort with a deliberately heavy ceremony).

## Consequences
A small slice of buyers with unusual setups may need the recovery-code
path — accepted. Support scripts never ask for secrets because none
exist. Phishing the Console yields nothing reusable.
