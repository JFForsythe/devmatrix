# Step 06 — Security audit: threat model vs implemented reality

Synthesis of SECURITY.md against the verified findings of steps 03
(firmware), 04 (console), and 08 (pipeline). Each finding lives in its
owning step; this file is the security-posture rollup an L0 gate
review would start from.

## What is real today and holds up

- LAN auth: 128-bit random bearer token, constant-time compare, on
  every mutating route; bearer-header-only (no cookie ambient
  authority); rotation implemented.
- Anti-spoofing: Ed25519 identity with domain-separated, serial-bound
  challenge; Console-side pinning with loud mismatch handling.
- Anti-rebinding/CSRF design: Host allowlist + exact-origin CORS
  (never `*`), preflight handled — in Console mode.
- App-data blast radius: bounded fetch (64 KiB cap), depth-capped
  parser, per-app diagnostics, clock fallback — a hostile feed cannot
  crash or wedge the panel (modulo the O(n²) stall, step 03).
- XSS: the console renders all device data as text nodes; zero
  innerHTML-class sinks (step 04).
- Supply chain (console): 4 runtime deps, exact-pinned, provenance
  checker-enforced, deterministic two-target build with CI drift diff.
- Release chain: fail-closed, byte-level production proof (step 08).

## The gap ledger (owning step in parentheses)

**Must settle before P2 freeze:**
- Pre-radio entropy for token + identity-key mint — verify or defer
  (03, P1).
- DNS-rebinding/CSRF mitigations are designed but **unproven**:
  SECURITY.md:104-108 itself requires P1 to exercise rebinding + CSRF
  against the chosen transport; no such evidence exists (07/09, P1).
- Secure Boot v2 / flash-encryption / owner-key coexistence on
  sacrificial boards — the entire P2 security workload, untouched
  (09, P1).

**Must fix before selling (M0/L0):**
- Unsigned OTA + untested rollback (03/07, P1 — tracked and
  disclosed).
- Open setup AP with post-join token-harvest window (03, P2).
- Unauthenticated body buffering with no size cap (03, P2).
- Setup-mode lacks the Host/CORS middleware (03, P2).
- Console: no CSP; token in localStorage; no transport timeouts;
  TOFU presented as "verified"; silent legacy downgrade path (04, all
  P2).
- Deploys not gated on CI; no branch protection; `main` writable
  outside the release chain (08, P1).

**Doc-vs-reality (step 02):** scoped tokens claimed available (M1
reality); MODES matrix ✓s for audit log/snapshots/signing ceremony;
SECURITY.md presents the full key hierarchy without status labels —
of its seven rows, only the LAN token and device identity key exist;
Secure Boot digests, release signing key, owner key, per-device
relay cert, account passkeys, and the snapshot key are all future.
One status column would make the table honest at a glance.

## Threats table audit (SECURITY.md §Threats → mitigations)

| Threat row | Status |
|---|---|
| Phished account | N/A today (no accounts exist; Cloud unbuilt — correctly) |
| Stolen/resold device | Partial: factory reset exists; prior-owner notification and wipe queueing are Cloud/M1 |
| LAN scanner / drive-by | Implemented (token everywhere, Host/Origin checks) but the row's own "tested against DNS rebinding + CSRF" clause is unmet |
| Malicious app / hostile source | Implemented for today's tiers (bounded fetch/parse/quotas); declared-hosts allowlist is M4 |
| Malicious/compromised OTA | **Not mitigated today** — unsigned; dual-slot + UF2 are the only backstops, and the UF2 path is untested (07) |
| Insider/cloud breach | N/A (no cloud); E2EE snapshots unbuilt |
| Supply-chain dep attack | Console: strong. Firmware: deps pinned by README instruction only — no lockfile, no SBOM, no CI compile (08) |
| Flash/NVS dump of shipped unit | Procedure not yet defined (R0), consistent with plan |

## Bottom line

Nothing found contradicts the security *architecture* — the decisions
(ADR-0031 transport, ADR-0032 no-scan, two-layer trust) survive
implementation contact. The exposure is sequencing: several
SECURITY.md sentences read as present-tense while their mechanism is
gated later (the same pattern step 02 found in MODES), and the two
biggest engineering unknowns of the whole project — Secure Boot
coexistence with owner keys and recovery, and signed OTA — have zero
bench evidence yet. Those two, plus the entropy check, are the
security-critical path to a sellable unit.
