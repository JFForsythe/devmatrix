# ADR-0029 — Layered display API: frames are LAN-only

**Status:** Accepted · 2026-08-09

## Context

ADR-0026 allows a host app to move off the owner's LAN to a remote
server. The device never opens an inbound WAN port (docs/PORTAL.md), so
a remote host reaches it only through a broker both sides dial out to
(ADR-0028).

The arithmetic decides the rest. A 64×32 RGB frame is 6,144 bytes. The
Flights Overhead radar view runs at 8 fps — roughly 48 KB/s sustained,
about 400 kbit/s. That is unremarkable on a LAN and unacceptable across
the internet, especially against a shared or free-tier broker.

Treating every display capability as equally available on every
transport would freeze a contract at P2 that works in the simulator and
on a bench, then fails or misbehaves the first time someone follows the
documented remote-hosting path.

## Decision

The display API has two layers with deliberately different reach.

**Frame layer** — `display/frame` and the WebSocket binary stream —
rides the device's REST and WebSocket transports and is **never
exposed over MQTT**. On the LAN that is a direct connection; the only
remote path is Cloud Mode's paid relay, which tunnels the same
WebSocket outbound (docs/MODES.md owns that split — its "push frames
from anywhere" promise is the relay, never a broker). Full pixel
control, high rate, no interpretation by the device.

**Semantic layer** — text, layouts, bindings, scene selection,
brightness, notifications. Available on every transport including MQTT,
and therefore remote-safe. The sender describes; the device renders.

A broker-hosted app cannot push frames by design; in Local Mode a
frame pusher is same-LAN. An app that wants broker-based remote
portability targets the semantic layer.

## Consequences

The P2 contract freeze must mark per-transport availability rather than
one flat capability list — docs/PORTAL.md already contemplates
per-transport capability descriptors, and this ADR makes them load-bearing.

Concretely for the bundled apps: Flights **list** is remote-safe;
Flights **radar** needs the frame layer — same-LAN in Local Mode, the
paid relay being the only remote path — and the docs must say so where
the app is described rather than leaving a user to discover it by
trying. The
same split tells a developer which layer to target before they write
code, instead of after their VPS-hosted app saturates a broker.

Accepted cost: two capability tiers are more to document and test than
one, and some capability will sit awkwardly on the boundary. The
boundary is drawn by reach, not by convenience: if it needs the LAN's
bandwidth, it is frame layer.
