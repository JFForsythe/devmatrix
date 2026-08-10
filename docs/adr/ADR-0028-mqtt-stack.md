# ADR-0028 — MQTT client stack and JSON parsing

**Status:** Accepted · 2026-08-09

## Context

contracts/mqtt.md is a complete DRAFT — topic tree, versioned envelope,
QoS and retain guidance, `expiry` replay guard, Home Assistant
discovery, and Mosquitto ACL examples — designed from the public OASIS
and Home Assistant specifications. No firmware implements it: there is
no MQTT code in `firmware/dk01/` at all.

ADR-0026's host apps need a transport that survives the app host moving
off the LAN, and docs/VISION.md promise 5 requires Home Assistant
discovery out of the box. The device never opens an inbound WAN port
(docs/PORTAL.md), so an outbound-dialling broker connection is the only
seam that works from a remote host.

The sketch currently parses JSON with hand-rolled string scanners
(`jsonGet`, `jsonInt`) that locate a key and read characters until the
closing quote. They cannot parse the nested, versioned envelopes in
contracts/mqtt.md.

## Decision

**Client: `esp-mqtt`**, the ESP-IDF MQTT client already vendored inside
the pinned arduino-esp32 core (Apache-2.0). It adds no new dependency to
a fork's toolchain, and it supports MQTT 3.1.1 and 5.0, TLS, large
payloads, and WebSocket transport.

**JSON: ArduinoJson** (MIT), replacing the hand-rolled scanners for
envelope parsing and serialisation.

**Broker: always the owner's.** contracts/mqtt.md already owns this
stance and ADR-0016 forbids a company-run broker, proxy, or relay in
Local v1. MQTT is optional: the core product never requires a broker
to exist — one appears only where the owner wants Home Assistant
integration or ADR-0026's remote-hosting case, and Home Assistant
owners already run one.

**Workbench transport decided.** contracts/mqtt.md left one question
open before the P2 freeze, because a browser cannot open a raw MQTT TCP
connection. The answer is the owner's broker exposing a **WebSocket
listener**, documented in the pane UI and the setup docs, rather than
routing MQTT through the device's own client. The device is not made a
broker proxy for the Console.

**Recorded rejection, so it is not rediscovered:** PubSubClient is the
most commonly reached-for Arduino MQTT client and defaults to a
256-byte packet buffer — 24× smaller than a 6,144-byte 64×32 RGB frame.
Publishes fail silently at that size. It is rejected for that reason,
not for licence or maintenance.

## Consequences

docs/FIRMWARE.md's `mqtt/` module becomes real work rather than a
placeholder, and ArduinoJson lands with it regardless of MQTT
scheduling because the hand-rolled scanners are already at their limit.
Public provenance for both libraries goes in the pull request per
AGENTS.md. contracts/mqtt.md's Console-workbench open question closes
in this change; the contract itself stays DRAFT until the P2 freeze.
