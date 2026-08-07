# ADR-0011 — US-only launch with a 50-unit first run

**Status:** Accepted · 2026-08-07

## Context

DK-01 is a first hardware product from a one-person company. Every
additional launch country adds regulatory, tax, shipping, and support
surface before a single unit has proven the line. The first run must
be small enough to hand-verify every unit and large enough to expose
real yield and support behavior. Unit economics — BOM, assembly
labor, certification, support, warranty reserve — are unknown until
EVT measures them.

## Decision

Launch in the United States only. Size the first production run to 50
saleable units, purchasing approximately 60 input sets so QA and RMA
spares never cannibalize sellable stock. Set the retail price only
after EVT establishes the real BOM, assembly labor, certification,
support, and warranty costs; GA requires a price approved from
measured EVT/PVT cost with sustainable margin. As docs/MODES.md
already states for the Cloud subscription price, any hardware price
that appears anywhere earlier is a placeholder, not an offer.

## Consequences

International buyers wait — accepted; expansion is a later decision
with its own compliance scope. U.S. compliance work (FCC and module
integration review, certified power supply) lands at L0+DVT, and the
US-only assumption lets official weather default to NWS (ADR-0015).
No storefront page or document may show a committed price before the
EVT-costed approval; the P0 storefront claims sweep enforces this on
existing copy.
