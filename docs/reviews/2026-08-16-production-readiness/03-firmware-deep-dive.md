# Step 03 — Firmware deep dive (firmware/dk01, v0.11.0)

Produced by a dedicated line-by-line review of all six source files
against FIRMWARE.md, SECURITY.md, GLOSSARY.md and ADRs
0024/0026/0028/0029/0031/0032, plus the local build artifacts. Every
headline claim below was re-verified directly (boot order, open AP,
constant-time compare, sdkconfig flags, setup-status token exposure,
Content-Length handling, compile command).

## Verdict

**No P0.** The invariants hold in code: Local-first (no company
endpoint on any critical path; Console served from PROGMEM),
Passkeys-first (zero password auth, zero on-device WebAuthn),
clean-room (owner-entered receiver URL only, no defaults), and
ADR-0032 (verified: no mDNS queries, no probe loops, no scan route;
the only `WiFi.scanNetworks` calls are setup-portal SSID listing,
which ADR-0032 does not restrict — though step 02 notes the manual's
wording should keep that distinction crisp). Defensive coding is
genuinely good: zero `sprintf`/`strcpy`/`strcat` anywhere, bounded
parsers with depth caps, a single-task handler/render model that
eliminates web-vs-render races, MQTT commands marshalled through a
bounded queue under a critical section, and a textbook constant-time
token compare (dk01.ino:209-217, verified).

## Security findings

- **[P1] The LAN token and the Ed25519 identity key are minted before
  Wi-Fi starts.** Verified in `setup()`: token mint (dk01.ino:1388-91)
  and `identityBegin()` (1392) precede `startSetupMode()`/
  `startStation()` (1396-97). `esp_random()` on ESP32-S3 is only
  guaranteed cryptographically strong with the RF subsystem active;
  pre-radio it can degrade to the bootloader-seeded source. The
  identity key is the device's anti-spoofing root and is minted once,
  on first boot, in exactly this window. Fix is one of: verify the
  boot-entropy path on hardware and record it as evidence, or defer
  first-boot key/token mint until after the radio is up. Cheap either
  way; must be settled before P2 freezes the identity design.
- **[P2] Open setup AP with a post-join token-harvest window.**
  `WiFi.softAP(apName)` has no password (dk01.ino:1228, verified);
  all setup routes are unauthenticated; and once a join succeeds,
  `/setup/status` returns the LAN token (and identity) to any AP
  client until the owner taps Finish — the setup page itself hands
  off via `http://<mdns>/#t=<token>` (web_setup.h:185, verified).
  Bounded by RF proximity and timing, consistent with the
  physical-presence model, but a panel-displayed AP password would
  close it. At minimum it needs an explicit risk note in SECURITY.md
  before sale.
- **[P2] Unauthenticated request-body buffering with no size cap.**
  The WebServer buffers the full POST body into heap before `authed()`
  runs; `Content-Length` is collected (dk01.ino:1248-49, verified)
  but never enforced. A LAN caller (curl ignores CORS; Host is easily
  correct) can push multi-hundred-KB bodies that allocate before
  denial — an unauthenticated heap-pressure vector. Add a body-size
  cap ahead of parsing.
- **[P2] The CORS/Host middleware exists only in Console mode** —
  setup mode registers none. Low impact (transient AP at
  192.168.4.1), worth one line of hardening.
- [P3] The LAN token prints to USB serial every 10 s in the stat line
  (by-design reveal, but the cadence widens log-capture exposure —
  once at boot plus on-demand would do); unauthenticated
  `claim/start` lets a LAN client keep the panel showing a pairing
  code indefinitely (display-griefing only, cannot complete without
  reading the panel); `msg[96]` in the identity signer is sized by
  the serial format with no defensive length check.

The Ed25519 verify path itself is sound (verified by the dive):
domain-separated serial-bound message, bounded base64 nonce ≥16 bytes,
correct fingerprint derivation; replay is structurally absent
(Console-chosen fresh nonce).

## Never-brick: what actually exists (reconciling steps 03 and 07)

Two review passes saw different halves; the reconciled truth,
verified against the local build's sdkconfig:

- Dual OTA slots + TinyUF2 factory partition: real (tinyuf2 scheme;
  three slot swaps exercised on hardware 2026-08-07).
- **Rollback machinery is compiled in**:
  `CONFIG_BOOTLOADER_APP_ROLLBACK_ENABLE=y` (verified), and the app
  marks itself valid only after boot + Wi-Fi join (dk01.ino:1333) —
  so an image that crashes before mark-valid *should* roll back on
  the next boot. But it has **never been tested** (no corrupted-OTA
  or interrupted-power evidence, step 07), MANUAL ch. 9 conservatively
  claims "rollback … is not automatic", and the health signal is thin:
  a good image hitting a transient router outage on first post-OTA
  boot never marks valid and can be rolled back by a power blip
  [P2]. M0's job is to test what's compiled in, tighten the validity
  signal, and then let the docs claim it.
- **Signed OTA is absent** (Update.begin/write/end with magic/length
  checks only; Secure Boot and flash encryption off in the dev build —
  verified). Disclosed everywhere; hard M0 blocker for sold units [P1,
  tracked].
- [P3] The partition scheme and rollback flags are **board-default,
  not pinned**: the README's compile command carries no
  partition-scheme option and no partitions.csv/sdkconfig is
  committed (verified) — reproducibility currently rides
  arduino-esp32 3.3.x board defaults. Pin `--board-options` (or commit
  the scheme) at P2.

## Robustness

- **[P2] O(rows·count²) flights frame build**: `dmxJsonArrayGet`
  re-walks the aircraft array from index 0 for every lookup; on a
  35 KB busy-airspace feed that is ~10⁵–10⁶ re-parses per refresh in
  `loop()` — the most plausible watchdog-adjacent stall in the tree.
  Single-pass rewrite is straightforward.
- **[P2] Default 1 s fetch interval** is heavy for HTTPS sources
  (fresh TLS handshake each cycle, ~22-42 KB heap churn); fine for
  the intended plain-HTTP LAN receiver.
- **[P2] NVS wear**: brightness writes NVS on every change (slider
  drags, HA scene automation); debounce/write-on-idle is cheap.
- Good: per-app fetch diagnostics with honest verdicts; every failure
  falls back to the clock; stale frames dim with an indicator; JSON
  validator caps depth/size/indices exactly as SECURITY.md's sandbox
  section promises (minus the declared-hosts allowlist, which is
  M4-tier and correctly absent today).

## API inventory (the de-facto contract the P2 freeze must capture)

~28 console-mode routes: open — health, identity, identity/verify,
claim/start, claim/finish, `GET /`; Bearer — info, display/{text,
frame,clear,brightness}, identify, token/rotate, settings (GET/POST),
mqtt (GET/POST), apps (GET/POST), apps/diag, apps/messages (+show),
apps/custom (+show), apps/flights_list/show, apps/flights (GET/POST),
reboot, wifi/reset, factory/reset, `/update` (OTA). Setup mode: portal
HTML, setup/{scan,join,status,done}, health, captive 302 — all
unauthenticated on the open AP. **WebSocket: none.** MQTT: 4 request
verbs, availability/state/response topics, HA discovery for
light/text/notify; envelope guards (UUID id, dedup, v==1, ts+expiry)
verified present.

## M0-bedrock gap list (code-side)

Missing vs the gate: signed OTA + tested rollback (above), safe mode
as a distinct always-bootable state (GLOSSARY defines it; today's
degradation ladder is clock-fallback + setup-AP + untested UF2),
structured log export, watermark/crash export, Improv-WiFi serial
(documented as a path in SECURITY/FIRMWARE module map; only SoftAP
exists — step 02 finding 3), owner key enrollment (post-M0 anyway),
and a Protomatter-init failure path better than an infinite bare loop
(step 07; even a serial-print-and-reboot ladder would beat hanging).
