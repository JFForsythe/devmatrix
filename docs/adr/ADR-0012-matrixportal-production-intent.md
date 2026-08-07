# ADR-0012 — MatrixPortal ESP32-S3 production intent

**Status:** Accepted · 2026-08-07

## Context

DK-01 needs a controller and a 64×32 panel that can actually be
shipped. The Adafruit MatrixPortal ESP32-S3 is a purchasable,
documented board matching DK-01's spec (ESP32-S3, 8 MB flash, 2 MB
PSRAM, HUB75 drive): see the
[MatrixPortal S3 guide](https://learn.adafruit.com/adafruit-matrixportal-s3?view=all).
The only panel evidence today is a supplier photograph. The production
plan (docs/PRODUCTION-PLAN.md, adopted by ADR-0009) requires hardware
intent to survive named gates, not to be assumed.

## Decision

MatrixPortal ESP32-S3 is the production-intent controller for DK-01 v1
only if it passes the display/Wi-Fi, security/recovery, memory,
supply, and certification gates. Failing any gate automatically
inserts a custom controller into the roadmap before DVT; there is no
ship-it-anyway path.

The photographed panel is an unverified HUB75-style panel, likely
FM6124-family. Nothing about scan ratio, pinout, color order, power,
or production-lot consistency is assumed until P1 bench measurement.
64×32 stays the product requirement (docs/GLOSSARY.md): panels that
fail verification are rejected, not respecified.

Chip-level caveat: secure-ownership and recovery failures live in the
ESP32-S3 ROM and eFuse design — Secure Boot v2 is RSA-3072 with
one-way digest slots, and hardening constrains ROM recovery paths; see
[ESP32-S3 Secure Boot v2](https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/security/secure-boot-v2.html).
A custom board on the same chip cannot cure them. If MatrixPortal
fails on those axes, the fallback must name a different chip family or
an ADR-recorded re-scoping of invariants 3 and 5 — never a same-chip
custom board, and never a silent weakening of recovery or ownership.

## Consequences

Hardware work proceeds on purchasable boards, with no custom-PCB spend
until evidence demands it. P1 intake and bring-up produce the panel
profile and display/Wi-Fi evidence; P2 resolves the security/recovery
axis on sacrificial boards. A gate failure is a planned branch, not a
crisis: the custom-controller insertion (or chip-family change) is
already the recorded consequence. No doc, demo, or storefront copy may
present MatrixPortal as the shipped controller until the gates pass.
