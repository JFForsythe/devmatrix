# ADR-0023 — Clean-room re-scope: protect internals, allow flight features

**Status:** Accepted · 2026-08-07

## Context

ADR-0001 banned two different things at once: reuse of the closed
FlightTrackerLED products' technical artifacts, and flight features as
an entire category. The owner has clarified the intent: the boundary
exists to protect the closed products' internals — code, backend
logic, schemas, MQTT topic structure, provisioning, architecture —
not the concept of showing aircraft, which has been open source for a
decade (the dump1090/readsb/tar1090 lineage). The dev-kit storefront
already positions a small preloaded flight app. ADR-0022 built its
two-tier word gate around the old category ban.

## Decision

The clean-room boundary is re-scoped to technical artifacts only, and
that half hardens: never open, copy, or derive from closed
FlightTrackerLED source, backend logic, schemas, MQTT topics,
provisioning, OTA, tests, assets, or architecture. Independent design
from cited public sources remains mandatory; the byline remains the
only shared element. This supersedes ADR-0001's flight-feature
category ban and retains everything else in it.

Flight features are permitted as independently built product
features. DK-01 ships preloaded starter apps including **Flights
Overhead**: a small aircraft display fed exclusively by a receiver on
the owner's LAN speaking the open dump1090/readsb JSON format.
Local-only forever — no company aircraft feed and no third-party
flight-data service integrations, so ADR-0003 keeps zero exceptions.
Cannibalization of the closed content appliances is a deliberate,
accepted trade; the canvas-versus-content positioning in
docs/VISION.md is unchanged.

Because buyers get full dev access, shipped units must contain zero
manufacturer-environment traces: no company or development Wi-Fi
credentials, IP addresses, broker or receiver endpoints, or tokens.
Bench and development units never ship; R0 per-unit provisioning
verifies a factory-fresh unit (docs/SECURITY.md owns the guarantee).

The term gate is re-scoped (refining ADR-0022): the tier-2
context-word gate is retired — flight, tracker, and aircraft are
legitimate product copy now — and receiver-ecosystem terms the
local-only design needs (ADS-B, dump1090, readsb, tar1090) are
unbanned. The banned-identifier gate remains and still hard-fails
everywhere: the closed-product codename, internal repository and
tooling names, the closed domain, and third-party flight-data
services, with which no integration will ever exist.

## Consequences

CLAUDE.md invariant 1, README.md, docs/VISION.md's IP line,
docs/GLOSSARY.md, docs/SECURITY.md, docs/FIRMWARE.md's risk register,
ROADMAP.md's M4 scope, AGENTS.md, and scripts/check-repo.mjs are
updated in this change. The storefront's flights-overhead copy stops
being a category violation, but claims-to-evidence still applies: no
present-tense claim until the app ships. Reviewers still never open
the closed repositories — independence is proven by cited public
sources, never by comparison.
