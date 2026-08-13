# ADR-0032 — No device-initiated network discovery

**Status:** Accepted · 2026-08-13 · removes the receiver scan shipped in
firmware 0.5.x–0.10.0

## Context

The Console has never scanned a LAN — discovery is the owner reading
the panel (docs/PORTAL.md, docs/SECURITY.md). The firmware, however,
shipped `POST /api/v1/apps/flights/scan`: four mDNS name queries plus
up to sixteen bounded HTTP probes against hosts that answered. By
packet count it is politer than a phone joining Wi-Fi.

Politeness is not the bar. Consumer router security suites (Eero
Secure, Firewalla, Asus AiProtection and peers) heuristically flag
device-initiated multi-host probing, and a field report from the
closed FlightTracker product line saw a device blocked from its own
network by exactly such a feature. A display panel that gets its
owner's network flagged is a support incident regardless of how
bounded the probe was — and the claim "this box never scans your
network" is only worth printing if it is absolute.

## Decision

**The DK-01 never initiates a connection to any address the owner did
not explicitly configure.** Device-originated traffic is exactly: SNTP,
MQTT to the owner-entered broker, and HTTP(S) fetches of owner-entered
app sources. There are no discovery probes of any kind.

`POST /api/v1/apps/flights/scan` and its firmware implementation are
removed. Receiver discovery moves to the owner's side: manual URL
entry, assisted by a Console-provided copy-paste prompt the owner can
hand to any AI assistant (or follow as a checklist themselves) to
locate their receiver's `aircraft.json` from a computer they already
own. The prompt itself instructs the assistant to use the router's
device list and a browser — never scanning tools.

The mDNS **responder** is unaffected: advertising `dmx-xxxx.local`
answers questions, it never asks them.

## Consequences

Owners who do not know their receiver's address gain one manual step,
covered by the finder prompt in the Flights card, docs/MANUAL.md ch. 8,
and `dmx-top`'s `flights prompt`. The Console's Flights card, the Dev
console route table, `examples/dmx-top.mjs`, firmware/dk01/README.md,
and docs/SECURITY.md's discovery section are updated in this change.
The "never scans" guarantee becomes symmetric — browser and box — and
is now a marketable, testable product claim.
