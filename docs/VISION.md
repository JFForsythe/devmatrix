# Vision

**One line:** a beautiful networked pixel display that its owner fully
controls — open firmware, stable APIs, and a Console for shipping your
own apps to your own hardware.

## Brand

- Product name: **Devmatrix**. First hardware model: **DK-01**
  (ESP32-S3, 64×32 RGB matrix).
- Byline on packaging and first boot: **"Dev Kit by FlightTrackerLED."**
  The panel's first words out of the box, typed across three rows:
  `WELCOME TO` / `DEV KIT` / `BY FLIGHTTRACKERLED`
  (this file owns the boot copy; everything else renders or links it)
- Positioning: the closed FlightTrackerLED products are *content*
  appliances (turnkey). Devmatrix is a *canvas* platform (yours). The
  byline and the hosted Console's domain —
  `devmatrix.flighttrackerled.com` (ADR-0025) — borrow the hardware
  credibility; everything else — code, contracts, firmware, backend
  logic, community — is separate and open.

## Audience

Developers, tinkerers, and technical executives who buy hardware the way
they buy instruments: they expect precision, no lock-in, and security
they can inspect. Many are high-profile; assume they are actively
targeted (phishing, account takeover, resale scams). Security is a
feature they can see, not a checkbox. "Basic code/config comfort"
expected; delight comes from how far the same box can go.

## Promises (every claim must map to a shipped feature at launch)

1. First pixel in under 5 minutes, using only the quickstart.
2. No app, no account, no cloud **required** — full control on your
   LAN, free forever (docs/MODES.md owns the split).
3. Upload your own apps to the box: OTA from the Console, or USB flash
   from the browser.
4. Hosted OTA included — static files, free, fully self-hostable (the
   Eject path).
5. MQTT + REST + WebSocket ready; Home Assistant discovery out of the box.
6. Full implementation guide; versioned `/api/v1` contract.
7. Never bricks: dual slots, auto-rollback, browser USB recovery.
8. Cloud Mode is optional **and paid** — the subscription funds its own
   operations, and the sunset covenant (12-month notice + automatic
   Eject) means the box can never be held hostage.

## The four tiers of hackability

Each tier is a complete, satisfying stopping point. The Console is the
surface for all four.

| Tier | Who | What they do | Console surface |
|---|---|---|---|
| 0 — Configure | everyone | WiFi, brightness, scenes, quiet hours | Dashboard, Settings |
| 1 — Integrate | smart-home users | push content via REST/MQTT/WS; JSON layouts; HA discovery | Dev Console, API keys |
| 2 — Extend | tinkerers | install declarative apps (layout + bindings), no toolchain; run host apps on a machine you already own (ADR-0026) | Apps |
| 3 — Fork | firmware devs | build/flash own firmware, enroll own signing key, self-host | Deploy (BYO builds), Eject |

## The IP line (what stays closed, what ships open)

No reuse of any closed-product firmware or backend code, logic,
contracts, or topic schemas — ever. If it feels convenient to "just
borrow" something from the closed products, that is the signal to
redesign it here, in the open, differently, from cited public sources
(ADR-0023).

Flight display itself is in scope in exactly one narrow form:
**Flights Overhead**, a bundled app fed only by an ADS-B
receiver on the owner's LAN (the open dump1090/readsb JSON format).
Local-only forever — no company aircraft feed, no third-party
flight-data services. The closed products stay the turnkey content
appliances; Devmatrix stays the canvas.
