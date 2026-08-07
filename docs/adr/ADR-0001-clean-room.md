# ADR-0001 — Clean-room boundary

**Status:** Accepted · 2026-08-01 (retro-documented from Plan v1)

## Context
The company also ships closed flight-tracking products. Devmatrix must
be open source without contaminating or leaking that IP, and must never
be read as "cheaper flight tracker."

## Decision
Zero reuse from closed products: no code, contracts, MQTT topic schemas,
wire formats, provider integrations, enclosure files, or distinctive
product ideas. Own repo lineage, own namespace (`devmatrix/`), own API
shapes, own OTA pipeline. Flight features are out of scope permanently.
The brand byline ("Dev Kit by FlightTrackerLED") is the only shared
element.

## Consequences
Some things get redesigned that already exist internally — accepted
cost. The urge to "just borrow" is itself the tripwire: redesign in the
open instead. Community-built trackers on their own boxes are theirs.
