# ADR-0033 — Cloud Mode and support are demand-driven offers

**Status:** Accepted · 2026-08-26

## Context

ADR-0007 split the product into free Local Mode and a paid Cloud Mode,
and ROADMAP.md carries the C0–C3 gate track. The owner-facing wording
that grew around that split — "the paid tier behind its own gates",
subscription framing — reads as a committed second product. Devmatrix
is a one-person operation selling a self-serve developer device; the
docs and the storefront need one plain signal instead. This ADR
refines ADR-0007's messaging; it changes none of its economics.

## Decision

The single signal everywhere owner-facing copy speaks: **the DK-01 is
the owner's own device.** Local Mode is the complete product. Cloud
Mode is something I would offer if demand requires it — the C0–C3
gates stay in ROADMAP.md as the sequence that offer would ship
through, not as a commitment that it ships. The same rule governs
support: the manual, the Console's built-in Guide, the troubleshooting
chapter, and self-explaining diagnostics are the support; I add real
support capacity only if demand requires it. ADR-0007's economics
(Local never subsidizes Cloud; subscribers fund what they use), the
sunset covenant, and ADR-0018's returns and warranty terms are
unchanged.

## Consequences

MODES.md, VISION.md, GLOSSARY.md, ROADMAP.md, README.md, and MANUAL.md
drop the salesy cloud framing in the same change, and the storefront
product page carries the same signal. Nothing about the mode split's
engineering changes; if demand shows up, the C-gates are the plan.
