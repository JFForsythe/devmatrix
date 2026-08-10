# ADR-0025 — Hosted Console domain

**Status:** Accepted · 2026-08-09

## Context

docs/PORTAL.md has carried "domain/brand for the hosted Console" as an
open question, with `devmatrix.example` as a placeholder everywhere.
Two accepted decisions constrain the answer. ADR-0016 moves the
commercial public portal to static hosting before the first sale,
because Vercel explicitly limits Hobby to non-commercial use and the
prototype deploys there today. docs/VISION.md states that the byline
"Dev Kit by FlightTrackerLED" is the only shared element — code, cloud,
and community stay separate from the closed products.

The owner's 2026-08-09 decision: host the Console at
`devmatrix.flighttrackerled.com`, keeping the local device-served copy
authoritative so the product survives the hosted copy disappearing.

## Decision

The public Console and docs are served from
**`devmatrix.flighttrackerled.com`** — a namespaced subdomain rather
than a bare `console.` host on the parent domain, so Devmatrix reads
as its own platform under the parent brand rather than a feature of
it.

This amends docs/VISION.md: the byline **and the hosting domain** are
shared with the closed products. Code, contracts, firmware, backend
logic, schemas, and community remain separate and open — the ADR-0001
and ADR-0023 clean-room boundary is untouched, because a DNS name is
not product logic.

This amends **ADR-0022's clean-room blocklist**, which bans the closed
product's domain everywhere in the repository — writing the subdomain
into any file hard-failed CI. The ban stands. Exactly one whole host is
excepted, enforced narrowly in `scripts/check-repo.mjs` and covered by
tests, so the bare domain and every other subdomain still fail. Note
that the brand *name* was never on the blocklist; only the domain was,
which is why the byline has always been legal in-tree.

ADR-0016's migration target becomes this hostname. Its trigger is
unchanged (complete before the first sale) and so is its atomicity
rule: the deploy target, `scripts/ship.mjs`, and `scripts/verify-live.mjs`
move in one change, and `make verify-live` must prove the new host
serves the committed artifact before the old deployment is retired.

## Consequences

docs/PORTAL.md's open question closes and its `devmatrix.example`
placeholders are replaced in this change; docs/OPERATIONS.md owns the
DNS and migration state. The hosted copy stays optional: docs/PORTAL.md's
rule that the device serves the complete Local Console is unchanged, and
docs/MODES.md's company-disappears promise is unaffected because this
domain serves only static files that anyone can mirror.

Accepted risk: the brand merge is practically one-way. Moving Devmatrix
to a standalone identity later costs redirects and rebuilt trust, and
buyers will reasonably read the platform as a FlightTrackerLED product.
That is the intended trade — borrowed hardware credibility is the point
of the byline (docs/VISION.md).
