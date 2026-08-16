# Step 05 — Contracts and examples vs firmware ground truth

Produced by a dedicated deep dive (contracts/*, all five example
scripts + installers, diffed against the actual route/topic
implementations in dk01.ino / mqtt_client.h / apps_engine.h /
apps_builtin.h). Headline findings re-verified directly in the tree
before inclusion (fetch cap, scan text, event topics, token format,
README heading).

## Contract coverage — the P2 mountain, quantified

The implemented REST surface is ~28 routes (health, info, display/*,
identify, identity + verify, claim/*, token/rotate, settings, mqtt,
apps + per-app config/show + diag, reboot, wifi/reset, factory/reset,
OTA `/update`, plus the setup-mode portal surface). **Contracts exist
for none of it.** contracts/ holds exactly two DRAFT prose files (mqtt,
layout). Unwritten and needed for the P2 freeze: REST OpenAPI, the
WebSocket stream AsyncAPI (**no WS exists in firmware at all** — the
frame layer's second transport in ADR-0029/FIRMWARE.md is currently
imaginary), OTA manifest/channel/signing format, `.dmapp` bundle
(**a word, not a format** — no manifest schema, no permission fields,
nothing behind USER-STORY's drag-drop beat), diagnostics schema, the
transport capability descriptors ADR-0029 calls load-bearing, and an
error format (today: ad-hoc `{"error":"…"}` strings). Zero
machine-readable schema exists, so the promised CI drift checks have
nothing to check. [P1 aggregate]

## Contract accuracy

- **[P1] layout.md is wrong by 16× on the fetch cap.**
  contracts/layout.md:31 still says the device "accepts only a
  complete response of 4 KB or less"; firmware v0.10.0's headline
  change moved it to 64 KiB PSRAM (`DMX_APP_FETCH_CAP = 65536`,
  apps_engine.h:21 — verified). The v0.10.0 commit fixed FIRMWARE.md
  but not the contract: a same-change rule violation, and the exact
  class of drift the truth map exists to prevent.
- **[P2] mqtt.md's "implemented in v0.8.0 except the scene entity"
  overstates.** Verified: the entire `event/<kind>` topic class
  (`event/button`, `event/app`, mqtt.md:30,65) has **no publisher in
  mqtt_client.h** — only availability, state/*, response/* exist.
- **[P2] Envelope `expiry` is mandatory-and-nonzero in firmware but
  reads optional in the contract, with no upper bound** (a client can
  send a huge expiry and defeat the replay guard).
- **[P2] Brightness means three things**: REST `value` 10–150; MQTT
  command 0–255 mapped down; retained state republished on the HA
  0–255 scale. The freeze must reconcile or explicitly bless this.
- **[P2] Undocumented payloads**: `state/display` fields,
  `display.clear`, `app.show {"app":…}` appear in firmware but not in
  the contract's examples.
- **[P2] layout `max` semantics diverge**: the contract reads as
  clipping the bound value; firmware truncates the whole composed
  prefix+value+suffix row at `max` chars (apps_builtin.h:469-471) —
  `max:4` with prefix `"TEMP "` renders `TEMP` and eats the value.
- [P3] A cluster of real-but-unstated firmware limits (URL ≤192 chars,
  value text ≤64, array index ≤4096, `interval_s`/`stale_after_s`
  required with an object source), silent QoS-1 duplicate drops with
  no response, `temp_c` hardcoded `0.0` vs the contract example's
  realistic reading, MQTT pinned to 3.1.1 while the contract cites
  3.1.1 and 5.0, and NVS-persist-failure leaving a saved-in-RAM layout
  behind a 400.

## Examples

- **[P1] flights-overhead.mjs directs owners to a UI that ADR-0032
  deleted.** Its terminal failure path (line 95, verified) says
  `Console -> Flights -> "Scan my network", then rerun` — the scan was
  removed in v0.11.0; the Console now offers COPY FINDER PROMPT. The
  header comment (line 20) has the same stale text. An owner hitting
  the script's exit-2 path is sent to a control that no longer exists.
- **[P2] Linux reinstall does not restart a running service, but
  MANUAL.md:274-275 says it does.** Both installers use
  `systemctl enable --now` — a no-op on an already-active unit — so a
  rotated token or changed URL is not picked up until something
  restarts the unit. macOS (bootout→bootstrap) is fine. Add
  `systemctl restart`.
- Otherwise the examples are in genuinely good shape (verified by the
  deep dive): every route/field they touch exists; frame encoding
  matches the wire format exactly; tokens come from env/hidden
  prompts, are redacted in dry-runs and error output, never land in
  unit files on Linux; uninstall/purge/status/dry-run are real;
  pixlet-bridge self-test is the one hardware-free test artifact in
  the directory.
- [P3] cluster: dmx-top's config file is written 0644-then-chmod-0600
  (brief world-readable window — the installers do it right);
  flights-overhead reads `interval_s` once and never reschedules its
  timer despite claiming to follow config; macOS installers write an
  env file nothing reads (token duplicated in the 0600 plist);
  pixlet-bridge README's example command omits the required
  `--format gif`; four different Node floors (18/20/20+/24) across one
  directory; `--token` on argv lands in shell history with no warning;
  `After=network-online.target` without `Wants=`.

## Canon and clean-room

- **[P2] The canonical token format contradicts the firmware.**
  USER-STORY.md:36 (`Bearer dmx_lan_…`), mock.ts
  (`dmx_lan_demo_4e710952`), and the prototype (`dmx_lan_demo`) all
  present a `dmx_lan_` prefix; firmware `makeToken()` returns 32
  unprefixed hex chars (dk01.ino:199-204, verified). Either firmware
  adopts the prefix (it's genuinely useful for secret-scanners) or the
  story canon drops it — decide once, at the P2 freeze at latest.
- **[P3] The prototype's first-pixel mock command uses
  `https://dmx-0952.local`** (prototype:535,2288, verified) —
  contradicting ADR-0031's plain-HTTP-permanently decision.
  USER-STORY.md:35 correctly uses `http://`. Mock-only, but it's the
  exact command a demo viewer copies.
- **[P3] firmware/dk01/README.md:115 still titles its limits
  "(v0.9.0, pre-P2-freeze)"** under FW_VERSION 0.11.0 (verified).
- **Local-first: clean.** No company infrastructure, no third-party
  flight-data service anywhere in contracts/ or examples/; flight data
  only from the owner's configured receiver; NWS weather is ADR-0015's
  sanctioned no-key provider. Worth a P2-freeze footnote: the one
  hardcoded non-owner address the device ever dials is SNTP
  (`pool.ntp.org`/`time.nist.gov`), and dk01.ino:12's "no credentials
  are ever … logged" comment is inaccurate as written — the LAN token
  prints to USB serial every 10 s by design (physical-cable-only;
  restate the posture, don't claim "never logged").

## Toward M2/M4

No SDK, no simulator, no mock device (each example hand-rolls its own
proto-SDK — three divergent fetch/auth/timeout clients an eventual SDK
must subsume); a ~100-line mock `/api/v1` server would make all three
scripts CI-testable and later anchor M2 simulator conformance. HA gate
remainders: scene entity (known P2 item), brightness tri-scale, the
hardcoded `homeassistant/` discovery prefix, and an encoded discovery
payload contract.
