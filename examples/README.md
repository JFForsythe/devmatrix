# Examples — things a box with an open API can do

Companion scripts that drive a DK-01 from anywhere on your LAN using
nothing but `/api/v1` ([firmware/dk01/README.md](../firmware/dk01/README.md)).
No SDK, no cloud, no firmware changes.

| Script | What it does |
|---|---|
| [`flights-overhead.mjs`](flights-overhead.mjs) | Polls **your own ADS-B receiver** (dump1090-fa / readsb / PiAware `aircraft.json` — the open receiver ecosystem, ADR-0023) and drives the panel in two views, toggled live from the Console's **Flights** page: **List** (`AAL2883 - 295kts`, nearest first) and **Radar** (every pixel an aircraft, altitude-colored with faint white comet trails; runways as paired lines that landing planes thread; touchdowns blink green). A taste of the M4 Flights Overhead app. |

Setup: open the Console → **Flights** → click **Scan my network** (the
device finds your receiver itself) → Save. Then run with Node 18+:

```sh
DMX_URL=http://dmx-xxxx.local DMX_TOKEN=<your LAN token> \
  node examples/flights-overhead.mjs
```

(The Flights page prints this command with your values filled in.)

Pair a browser with the device first — the Console will hand you the
token. Receiver URLs, tokens, and locations live on the device and are
read at runtime; none of them belong in this repository.
