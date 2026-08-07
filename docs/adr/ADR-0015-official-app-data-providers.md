# ADR-0015 — Official app data providers

**Status:** Accepted · 2026-08-07 · part of the ADR-0009 adoption set

## Context

The official Weather, Stocks, and Messages apps must ship on public
data sources whose terms a commercial product can honor, with no
company proxy (Local v1 has no standing infrastructure) and without
exposing a fleet of shipped devices to provider rate enforcement.
Provider terms differ sharply: some data is free for any purpose,
some requires attribution, and some hosted tiers prohibit commercial
products outright.

## Decision

Weather uses the
[NWS API](https://www.weather.gov/documentation/services-web-api) by
default for U.S. forecasts — NWS data is free for any purpose. MET
Norway is the optional worldwide adapter; its data is CC BY 4.0 and
the app shows the required attribution
([MET Norway terms](https://api.met.no/doc/TermsOfService)). Both
adapters hard-code an identifying User-Agent with contact info, honor
Expires/If-Modified-Since caching, back off on errors with per-device
jitter so a fleet never synchronizes, and truncate coordinates to
four decimals. Open-Meteo's hosted free tier is excluded: it
prohibits commercial-product use.

Stocks is disabled by default. Enabling requires an owner-supplied
free provider key and a local checkbox confirming personal/internal,
non-commercial use and acceptance of that provider's terms; the
attestation timestamp and terms URL are stored locally. The first
connector is
[Tiingo](https://www.tiingo.com/documentation/general), which
explicitly permits software where each user supplies their own token;
generic JSON and MQTT feeds are also supported. Defaults are five
symbols on a 15-minute refresh, the display always shows data
timestamp and provider, and the product never claims exchange-wide
real-time coverage.

Messages is fully offline and uses no provider at all.

## Consequences

Weather stays no-cost with no company proxy. MET Norway's rate
ceiling is per application — aggregated across every shipped device
sharing the User-Agent — fine at 50 units, revisit before any larger
run. The Stocks checkbox records intent but cannot override provider
or exchange terms, so connectors are reviewed before every release.
Offline Messages guarantees one built-in app that works with no
network at all.
