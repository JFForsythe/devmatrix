# Evidence — v0.11.0 → v0.12.0 on-hardware OTA and hardening verification

**Date:** 2026-08-16 (evening) · **Hardware:** the DK-01 dev unit
(MatrixPortal S3 + 64×32 panel), serial `DMX-AC93-7A08`, on the owner's
LAN at `10.0.0.32` (wall USB-C power for most of the session) ·
**Firmware:** v0.11.0 (repo `444691f` build) upgraded over the air to
v0.12.0 (repo `553215e` build, sha256 `2c7d06e3…`, 1,368,000 B) ·
**Driver:** this session's assistant over the LAN API + USB serial;
owner present for physical steps.

Bench-week context (hardware/procedures/bench-week.md): this session
executes parts of runs 1, 5, and 7 and closes the 2026-08-13 interop
item. The board is scheduled to be repurposed; remaining runs transfer
to the next unit.

## Corrections to prior assumptions

- The unit was found running **v0.11.0** (slot `ota_1`), not v0.4.0 —
  it had been reflashed after the 2026-08-07 evidence without a
  written record. Review step 07's "in-tree firmware never ran on
  hardware" was evidence-accurate but factually stale.
- v0.11.0's serial stat line printed the LAN token every 10 s
  (observed live) — the exposure v0.12.0 removes.

## OTA (bench-week run 5, non-destructive half)

`POST /update` with the v0.12.0 `.bin` from a token-authenticated
host → `{"ok":true,"rebooting":true}` → panel showed the UPDATING
counter → device rebooted from `ota_1` into **`ota_0`**,
`reset_reason:"software"`, health `fw:"0.12.0"`. Config (Wi-Fi, token,
receiver URL, custom layout, timezone, brightness) survived intact.
The destructive halves — corrupted image, power-cut mid-write,
crash-before-mark-valid rollback — were **not** run (board leaving the
bench; still owed on the next unit).

## v0.12.0 behavior verifications (all observed live)

| Check | Result |
|---|---|
| `info` gains `serial` field | ✓ `DMX-AC93-7A08` |
| Serial stat line no longer prints token | ✓ (refresh/heap/rssi/ip only) |
| Pre-0.12 bare-hex token still valid after upgrade | ✓ |
| `token/rotate` mints new format | ✓ 40 chars, `dmx_lan_` + 32 hex; old token → 401; new token authenticates |
| Host-header spoof (`Host: evil.example.com`) | ✓ 403 |
| Mutating route without token | ✓ 401 |
| CORS preflight, foreign origin | ✓ 403, no ACAO |
| CORS preflight, hosted origin | ✓ 204 + exact-origin ACAO |
| 9 KB JSON body | ✓ 413 (8 KB cap) |
| `claim/start` twice, 3 s apart | ✓ `expires_s` 300 → 296 (no extension) |
| MQTT password never echoed | ✓ `has_password` boolean only |
| `apps/diag` | ✓ real feed: flights 36,847 B fetches, 57/57 ok — the 64 KiB cap earning its keep (>4 KiB legacy cap) |

These cover bench-week **run 7**'s curl-level rebinding/CSRF cases;
the hostile-page-in-a-real-browser variant is still owed.

## Ed25519 cross-implementation interop (closes the 2026-08-13 open item)

The Console-side stack (`@noble/ed25519` 2.3.0, the exact bundled
library) verified a **real firmware signature** (rweather Crypto 0.4.0
signer) over `"dmx-id-v1:DMX-AC93-7A08:" + nonce` with a fresh 32-byte
nonce: `signature_valid: true`; tampered-message and tampered-signature
negative controls both rejected. Device fingerprint `AA93-766F`
(pubkey 32 B, sig 64 B). Note: this unit's identity key was minted by
pre-0.12 firmware, i.e. under the pre-radio entropy path — the 0.12.0
post-radio mint applies to future first boots and factory resets
(bench-week run 6 still owed on a fresh unit).

## Refresh measurement (bench-week run 1, partial) — **flag**

Protomatter frame-counter method (`getFrameCount()/10 s`), Wi-Fi
associated, HTTP server live, flights app active (5 rows, real
receiver at 1 s interval):

- v0.11.0, pre-OTA, uptime ~2 min: **216–220 Hz** (serial + API).
- v0.12.0, same board/day: **198–199 Hz**, rock-steady across boots
  and a 2 h uptime.
- Diagnostic: setting the flights fetch interval to 30 s (fetch path
  ~idle) left it at **199 Hz** — the fetch/parse path is *not* the
  cause (and the v0.12.0 single-pass builder reduced that load
  anyway).

**199 Hz is 1 Hz under the P1 ≥200 Hz floor.** The v0.11.0 baseline
was sampled only in the first minutes after power-on, so
early-boot-vs-steady-state is a possible confound — but a ~17 Hz drop
across the update on the same hardware is unexplained and is now a
named open item: re-measure both versions under the pre-registered
method on the next unit before calling the P1 floor met.

Heap: stable at ~149 K free across 2 h uptime with flights fetching
every second (no downward trend across samples).

## Owner-configuration snapshot (replication kit)

The unit's full owner config (timezone, brightness, app enables +
intervals, message phrases, custom layout, flights receiver settings,
MQTT config minus the write-only password) was captured to
`~/devmatrix-backup/config-snapshot.json` alongside the v0.12.0
`.bin` + `.uf2`, converter, restore script, and replication README —
the board is scheduled for repurposing, and a replacement unit can be
cloned from that kit (flash → Wi-Fi setup → `restore.mjs`).

## What this does not prove

No 24 h soak (deliberately skipped — the unit is being repurposed; owed
on its successor, run 2). No corrupted-OTA/power-cut recovery, no UF2
recovery drill (runs 4/5). No current/thermal instrumentation (run 3).
No real-browser LNA/CSRF page tests (runs 7/8). The refresh flag above
is unresolved. Mid-session the unit was unreachable for ~40 min —
fully explained by the host Mac roaming to a different Wi-Fi network;
the unit itself ran uninterrupted throughout (uptime carried through).
