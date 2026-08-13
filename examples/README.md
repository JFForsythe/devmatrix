# Examples — things a box with an open API can do

Companion scripts that drive a DK-01 from anywhere on your LAN using
nothing but `/api/v1` ([firmware/dk01/README.md](../firmware/dk01/README.md)).
No SDK, no cloud, no firmware changes.

| Script | What it does |
|---|---|
| [`dmx-top.mjs`](dmx-top.mjs) | A live terminal panel for one DK-01 (zero dependencies, Node 20+): vitals, what the panel is showing, per-app fetch diagnostics from `/api/v1/apps/diag` (firmware 0.10.0+), an event log, and a command line — `pair`, `text`, `show`, `weather`, `flights scan`, `bright`, raw `get`/`post`. Config via flags, `DMX_URL`/`DMX_TOKEN`, or `~/.dmx-top.json` (written by `pair`, mode `0600`). Start: `node examples/dmx-top.mjs --device http://dmx-xxxx.local`, then type `help`. |
| [`flights-overhead.mjs`](flights-overhead.mjs) | Polls **your own ADS-B receiver** (dump1090-fa / readsb / PiAware `aircraft.json` — the open receiver ecosystem, ADR-0023) and drives the panel in two views, toggled live from the Console's **Apps** view, Flights list card: **List** (`AAL2883 - 295kts`, nearest first) and **Radar** (every pixel an aircraft, altitude-colored with faint white comet trails; runways as paired lines that landing planes thread; touchdowns blink green). The radar view pushes raw frames, so it is frame-layer and same-LAN in Local Mode; Cloud Mode's paid relay (**Ahead · gate C1**) is the only remote path (ADR-0029). A taste of the M4 Flights Overhead app. |
| [`install-flights.mjs`](install-flights.mjs) | Installs Flights Overhead as a persistent `systemd` service on Linux/Pi or `launchd` agent on macOS; also supports status, dry-run, and uninstall. |
| [`pixlet-bridge/`](pixlet-bridge/) | Runs open-source Pixlet community apps on the owner's machine, coalesces their native 64×32 GIF frames, and pushes RGB565 frames to the DK-01 over the LAN-only frame API (ADR-0030). |
| [`install-pixlet-bridge.mjs`](install-pixlet-bridge.mjs) | Installs the owner-hosted Pixlet rotation as `dmx-pixlet.service` on Linux/Pi or `com.devmatrix.pixlet` on macOS, with redacted dry-run, status, uninstall, purge, and mode-`0600` secrets. |

Setup: open the Console → **Apps** → **Flights list** → **SCAN MY
NETWORK** (the device finds your receiver itself) → Save. Then run with
Node 18+:

```sh
DMX_URL=http://dmx-xxxx.local DMX_TOKEN=<your LAN token> \
  node examples/flights-overhead.mjs
```

(The Flights list card prints this command with your values filled in.)

Permanent service: `node examples/install-flights.mjs` (use the `sudo`
form in the owner's manual on Linux/Pi).

Pair a browser with the device first — the Console will hand you the
token. Receiver URLs, tokens, and locations do not belong in this
repository. The service installer saves its host-side values only in the
mode-`0600` environment file (and the mode-`0600` launch agent on macOS).

To keep a script running unattended (systemd on a Pi, launchd on
macOS), follow the owner's manual:
[docs/MANUAL.md](../docs/MANUAL.md) → "Keep it running".
