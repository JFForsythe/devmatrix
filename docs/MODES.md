# Local Mode & Cloud Mode

This file owns the mode split (ADR-0007). If any other doc, UI copy, or
product page disagrees with this file, this file wins and the other
must be fixed.

**One sentence each:**

- **Local Mode** — the complete product. Your browser talks to your box
  on your LAN. Free forever, works with the company unreachable, needs
  no account. The box serves the complete Local Console itself.
- **Cloud Mode** — a paid tier I would offer if demand requires it
  (ADR-0033): control from anywhere, every site in one view, hosted
  encrypted backups, alerts. It would add *reach*, never a capability
  the box itself lacks.

## Feature matrix

| Capability | Local (free forever) | Cloud (subscription) |
|---|---|---|
| Setup & WiFi provisioning | ✓ SoftAP today · USB Improv **Ahead · gate M0** | — (always local) |
| Claiming | ✓ possession + LAN token, no account | adds passkey account binding |
| Mirror, push text/frames, scenes | ✓ push text/frames/scenes today · live Mirror **Ahead · gate M1** | ✓ from anywhere (relay) |
| Install / upload apps | ✓ | ✓ remote |
| Firmware OTA | ✓ manual upload to the inactive slot today · signed manifest + channels (stable/beta/dev) **Ahead · gates M0/M1** | ✓ plus staged multi-site rollout |
| USB recovery flash | ✓ TinyUF2 USB today · browser WebSerial **Ahead · gate M2** | — (inherently local) |
| Home Assistant / MQTT / SDKs | ✓ your broker, your LAN | — (unchanged; never hosted by me) |
| Fleet view | ✓ one device per browser today · same-LAN fleet **Ahead · gate M1** | ✓ across homes/offices/sites |
| Remote access | via your own VPN/Tailscale (documented) | ✓ built in, zero config |
| Snapshots (E2EE) | export/restore as files **Ahead · gate M2** | ✓ hosted sync + retention |
| Audit log | on-device ring buffer, exportable **Ahead · gate M1** | ✓ synced, long retention |
| Guest access | share the LAN token (all-or-nothing) | ✓ scoped, expiring guest links |
| Offline / security alerts | — | ✓ email + push |
| Mark lost / remote wipe / rotate | — (physical access is your tool) | ✓ |
| Own signing key, BYO firmware | physical ceremony **Ahead · gate M2** | ✓ plus CI deploy convenience |
| Eject (self-host everything) | ✓ always | ✓ always |

The matrix marks Local capability. Where a row is not yet built, its gate
is named inline using the same Today/Ahead discipline as
[docs/MANUAL.md](MANUAL.md).

## Who runs what, who pays for what

- **Local:** you run nothing but the box. It serves the full Local
  Console. I host only **static public files** (an optional Console
  entry point, docs, Registry, manifest, and signed binaries) —
  cacheable, mirrorable, no accounts, no relay, no telemetry.
- **Owner-hosted remote:** owners may put Local Mode behind their own
  VPN, Tailscale network, NAS, Raspberry Pi, or VPS. I document this
  path and do not charge for or operate it.
- **Cloud:** if demand brings it, I run the relay, account store,
  snapshot storage, and alert delivery. The subscription exists to pay
  for exactly that, with margin — the free tier never quietly
  subsidizes it.
- There is no permanent free managed relay. Cloud capacity is
  provisioned only when paying subscribers cover its fixed and variable
  costs; Local launches and keeps working independently.
- The community **Registry stays free** in both modes (a public PR-based
  repo served statically).
- **Price:** set at the C0 billing gate (ADR-0007). Any figure that
  appears anywhere before then is a placeholder, not an offer.

## Support — your device, my docs

This is your own device (ADR-0033). The support is built in and
written down: the owner's manual ([MANUAL.md](MANUAL.md)), the
Console's **Guide** view served by the panel itself, the
troubleshooting chapter, and diagnostics that explain themselves
(`GET /api/v1/apps/diag`). I add real support capacity only if demand
requires it. Returns and warranty stay as
[ADR-0018](adr/ADR-0018-returns-and-warranty.md) defines them.

## The claim/account split

Claiming is **device-local**: possession proof mints the LAN token in
your browser — no account exists yet. Creating a **passkey account** is
an optional next step toward Cloud Mode, but it never purchases or
activates a subscription by itself. Remote relay activation requires a
separate, explicit plan and price confirmation. Local-only owners skip
both and lose nothing local. Subscribing later re-uses the same claim
attestation; cancelling later keeps every Local capability.

## Failure & lapse behavior

| Situation | What still works |
|---|---|
| Your internet is down | Everything on the LAN (control, apps, scenes) |
| My cloud is down | Everything Local; Cloud features queue/pause |
| Your subscription lapses | Everything Local; Cloud features pause — never the box |
| The company disappears | Everything Local, forever; OTA continues from any mirror of the static manifest; Eject was always available |

**Sunset covenant:** if I ever end Cloud Mode, subscribers get 12
months' notice and an automatic, guided Eject. A dead cloud costs
convenience, never function.

## Rollout

Both modes are specced together (this file) and built against the same
contracts. **Local readiness gates launch; Cloud ships only if demand
requires it — when the billing + relay gates pass and subscribers fund
it**. Local never waits. The Console shows each selected
device's mode at all times (`LOCAL · FREE` / `CLOUD`).
