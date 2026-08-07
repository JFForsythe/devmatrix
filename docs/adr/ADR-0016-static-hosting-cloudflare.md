# ADR-0016 — Static Cloudflare Pages hosting for the public portal

**Status:** Accepted · 2026-08-07

## Context

The device-local Console is the authoritative product (ADR-0003,
ADR-0007); the company hosts only static public files. Today the
portal prototype deploys through Vercel's git integration on a Hobby
plan, and the release chain — scripts/ship.mjs, scripts/verify-live.mjs,
and the CI verify-production job — is hardwired to Vercel deployment
verification. Vercel explicitly limits Hobby to non-commercial use
([Vercel Hobby terms](https://vercel.com/docs/plans/hobby)), so the
current arrangement cannot host the portal of a shipping commercial
product. Local v1 must also keep working with zero standing company
compute (ADR-0007). Part of the ADR-0009 adoption set.

## Decision

1. The commercial public portal and docs move to **static Cloudflare
   Pages** — no Functions, no database, no accounts, no standing
   compute. Cloudflare documents 500 free builds per month and
   unlimited static requests
   ([Pages limits](https://developers.cloudflare.com/pages/platform/limits/)),
   and a project with no Functions serves every route statically
   ([static routing](https://developers.cloudflare.com/pages/functions/routing/)).
2. **Trigger: the migration completes before the first sale.** Until
   then the prototype stays on the current Vercel git-integration
   deployment, which is acceptable pre-commercial.
3. scripts/ship.mjs and scripts/verify-live.mjs are retargeted to the
   new host **in the same change as the migration** — never before
   (that breaks the release chain against the still-live deployment)
   and never after (that leaves production unverified).
4. Firmware, recovery images, Registry metadata, and app packages ship
   as **signed GitHub Release assets**, mirrorable and locally
   installable.
5. No company relay, proxy, MQTT broker, weather proxy, stock proxy,
   or telemetry backend exists in Local v1. Optional Cloud Mode
   develops on its own paid gates (ADR-0007), and the company-hosted
   relay is also published as a self-hostable container.

## Consequences

The first sale gains a hard hosting gate; docs/OPERATIONS.md owns the
current hosting state and tracks the trigger. The migration is one
atomic change: deploy target, ship.mjs, and verify-live.mjs move
together, and `make verify-live` must prove the new host serves the
committed artifact before the old deployment is retired. Zero standing
compute keeps the company-disappears promise in docs/MODES.md literal:
everything the company hosts can be mirrored by anyone.
