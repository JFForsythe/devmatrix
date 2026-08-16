# Bench week — the hardware-evidence run list

The queued on-hardware work that closes gate P1's open items and pays
the firmware↔hardware drift accumulated since v0.4.0 (the last version
to run on the board). Each run produces one dated file in
[hardware/evidence/](../evidence/), modeled on
`2026-08-12-console-parity-verification.md`: exact hardware, firmware
commit + version, commands, observed numbers, and an explicit "what
this does not prove" section. Photograph or capture raw serial logs
where the result is visual.

Gate criteria owner: docs/PRODUCTION-PLAN.md §3 (P1, M0). Statuses
here are tracked, not asserted — nothing below is done until its
evidence file exists.

## Run 1 — Current-tree bring-up (re-baseline)

Flash the current `firmware/dk01` build to the DK-01 (cable flash per
firmware/dk01/README.md). Re-run the bring-up ladder: black, single
pixels, primaries, corners, border, rows/columns, checkerboard,
gradients, moving lines, low-brightness white. Record refresh rate at
the production bit depth (Protomatter frame counter — the
pre-registered method), with Wi-Fi associated and the Console open.
Pass floor: ≥ 200 Hz. Record heap/PSRAM watermarks from `/api/v1/info`
with the MQTT client connected and one HTTPS app source enabled — the
first watermark measurement with the full v0.9+ feature set live.

## Run 2 — 24-hour display + Wi-Fi soak (P1's own gate)

24 h continuous: clock + app rotation rendering, Wi-Fi associated,
MQTT connected to the owner broker, one declarative app fetching an
HTTPS source on its normal interval. No reset, no corruption, no
unbounded heap decline (log `/api/v1/info` every 5 min from a host
script). Note RF behavior (RSSI stability) — the Protomatter/Wi-Fi
EMI interaction is the named risk (docs/FIRMWARE.md → Risks).

## Run 3 — Power instrumentation

Bench supply + meter: current at brightness 10 / 75 / 150 with
full-white frame, typical clock, and radar frames; voltage drop at the
connector; board temperature after 1 h at brightness 150 (IR or
thermocouple). This replaces the uninstrumented 150 brightness cap
with measured numbers and feeds the M0 supply spec and the enclosure
thermal budget.

## Run 4 — USB-recovery drill (never-brick evidence)

From the running device: build a UF2 per firmware/dk01/README.md →
"USB recovery (make a UF2)". Double-press reset, confirm the UF2
drive mounts, drag the file, confirm reboot into the new image.
Then the hard half: deliberately corrupt the active slot (flash an
image truncated mid-write over serial, or power-cut during an OTA
write), confirm the device still reaches the UF2 drive, and recover.
This is the evidence behind MANUAL ch. 10's "always there even if
both app slots are bad."

## Run 5 — OTA rollback behavior

The bootloader rollback machinery is compiled in
(`CONFIG_BOOTLOADER_APP_ROLLBACK_ENABLE=y`; the app marks itself valid
after boot). Verify it does what the config promises: OTA-upload an
image built to crash before mark-valid (e.g. an early `abort()`),
power-cycle, and confirm the bootloader falls back to the previous
slot. Then verify the transient-outage case: OTA a good image, boot it
with the router off, power-cycle mid-window, and record whether a
healthy image was rolled back (the known-thin health signal — feeds
the M0 validity-signal design).

## Run 6 — Entropy timing check

The LAN token and Ed25519 identity key are minted before Wi-Fi starts
(dk01.ino `setup()` order). Either (a) confirm from the running
system that the RNG is strongly seeded at that point in the
arduino-esp32 3.3.x boot path (bootloader RF-entropy seeding), citing
the exact source, or (b) move first-boot minting after radio start
and re-verify. File the answer — the identity key is the anti-spoofing
root and is minted exactly once per device lifetime.

## Run 7 — DNS-rebinding / CSRF exercise (required by SECURITY.md)

Against the real board on a real LAN: (1) a rebinding attempt — a
hostile DNS name resolving to the device IP; confirm the Host
allowlist rejects it; (2) cross-site POSTs from a hostile page in
Chrome/Edge/Firefox; confirm CORS + bearer requirement block them;
(3) a curl with correct Host but no token on every mutating route
(expect 401). SECURITY.md → "Rebinding/CSRF-hostile" says this
mitigation is not proven until exercised.

## Run 8 — The four ADR-0031 browser experiments

As named in ADR-0031 / the 2026-08-12 spike file, against the real
board: ws:// under Local Network Access; `.local` vs HTTPS-Upgrades;
Firefox 151→153 parity; macOS local-network permission. Requires the
hosted origin or a stand-in allowlisted origin.

## Run 9 — Panel supplier intake (no board required)

Supplier SKU, front photo into `hardware/`, pitch, resolution,
scan ratio, voltage/current spec, driver BOM (confirm or refute the
"likely FM6124-family" guess from ADR-0012), pinout, lot-change
policy. Power-off checks per PRODUCTION-PLAN: polarity, VCC/GND,
address lines, resistance. Record the full panel profile
(dimensions, scan, driver, color map, phase, blanking, brightness
cap, current, pins).

## Out of scope here (separate efforts)

8–12 unassisted user tests (overlaps M1's 9-of-10 acceptance);
enclosure/harness/BOM/cost model (mechanical design); the P2
sacrificial-board Secure Boot matrix (its own procedure when P2
starts).
