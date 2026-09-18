# Host apps and developer tools

These programs run on your computer and control a DK-01 through its LAN API.
The computer must stay awake and connected while a host app is running. Device
setup, pairing, and recovery are in the [owner's manual](../docs/MANUAL.md);
the [firmware README](../firmware/dk01/README.md) documents the current API.

## Choose a starting point

| I want to… | Start here | Requirements |
|---|---|---|
| Inspect the panel or send a quick message | [dmx-top.mjs](dmx-top.mjs) | Node 20+, same LAN |
| Run community clocks, transit, weather, and other Pixlet apps | [Pixlet setup and Easy Mode](pixlet-bridge/README.md) | Node 20+, Git, macOS or 64-bit Linux; some apps also need internet access or your own API keys |
| Show aircraft from my own receiver | [Flights Overhead below](#flights-overhead) | Node 18+, same LAN, your own ADS-B receiver |
| Keep Flights or Pixlet running after closing a terminal | [Service lifecycle below](#service-lifecycle) | Linux/systemd or a signed-in macOS desktop session |

No company account or rendering service is required. External data access is
determined by each app. The current host tools use the LAN path; mode and
remote-access availability are owned by [MODES.md](../docs/MODES.md).

All commands below run from the repository root. Replace `dmx-xxxx.local`
with the address displayed on your panel. If `.local` does not resolve, use
the panel's current IP address. Never commit a token, receiver URL, location,
or app configuration containing your keys.

## Terminal control

```sh
node examples/dmx-top.mjs --device http://dmx-xxxx.local
```

Type `pair`, enter the six digits shown on the panel, then type `help`.
Useful commands include `text Hello`, `clear`, `bright 75`, `diag`, and
`flights prompt`. Pairing saves the device address and token in
`~/.dmx-top.json`; that is a local credential file. Command-line flags take
precedence over `DMX_URL` / `DMX_TOKEN`, which take precedence over that file.

The tool's current `text` command displays a message for **30 seconds**.
Use the Console for the guided settings and firmware-update flow.

## Flights Overhead

The source is your own dump1090-fa, readsb, PiAware, or compatible
`aircraft.json` feed. The clean-room scope is
[ADR-0023](../docs/adr/ADR-0023-clean-room-rescope.md). Configure its URL in
Console → **Apps** → **Flights list**, then save. **COPY FINDER PROMPT**
helps locate the receiver through your router's device list; the panel does
not probe your network ([ADR-0032](../docs/adr/ADR-0032-no-device-initiated-discovery.md)).

Use the Console's **COPY WITH MY TOKEN** command on your own computer, or
supply the two environment variables before starting the script:

```sh
DMX_URL='http://dmx-xxxx.local' DMX_TOKEN='<LAN token>' \
  node examples/flights-overhead.mjs
```

The token placeholder must be replaced. Keep the resulting command out of
screenshots and shared shell history. The installer below offers a hidden
token prompt for persistent use.

**List** shows callsigns and speed or altitude. Distance sorting needs a
valid receiver location; otherwise the script sorts by altitude. **Radar**
pushes animated frames and needs a receiver location or a configured airport.
Only the approximate O'Hare geometry (`AIRPORT=ord`) is bundled. Landing
flashes are visual heuristics, not verified touchdown reports.

The Console chooses the view. Environment overrides are `RECEIVER_URL`,
`INTERVAL_S`, `ROWS`, `FORMAT=kts|alt`, `VIEW=list|radar`, `VIEW_MI`, `FPS`,
and `AIRPORT`. Restart after changing receiver or polling settings so the
host re-reads its location and timer. `--once` performs one update; a radar
frame sent with `--once` persists until cleared.

**Current limitation:** if the receiver stops responding during radar mode,
the host can keep showing the last tracks. Stop the host and clear the display
from the Console when diagnosing a receiver outage. A running host also
continues independently of the device's native app-rotation enable switch.
Run one frame-producing host app per panel to avoid competing writes.

## Service lifecycle

Inspect the plan first with a dummy token; this writes no files and contacts
no device:

```sh
node examples/install-flights.mjs --dry-run \
  --url http://dmx-xxxx.local --token example-placeholder
node examples/install-pixlet-bridge.mjs --dry-run \
  --config "$HOME/tronbyt/bridge.config.json" --token example-placeholder
```

The installers currently take configuration from their **flags and prompts**;
they do not import exported `DMX_TOKEN`, `DMX_URL`, or `BRIDGE_CONFIG` despite
the environment-variable names shown in their help. For Pixlet, always pass
`--config` and keep `device.tokenEnv` set to `DMX_TOKEN`. The manager's saved
pairing file is not automatically imported by the service installer.

On macOS, run the relevant installer without `sudo` and enter the token at
its hidden prompt. For example:

```sh
node examples/install-pixlet-bridge.mjs --config "$HOME/tronbyt/bridge.config.json"
node examples/install-pixlet-bridge.mjs --status
node examples/install-pixlet-bridge.mjs --uninstall
```

Replace `install-pixlet-bridge.mjs` with `install-flights.mjs` for Flights;
its interactive installer also prompts for the panel URL. macOS agents run
in your signed-in desktop session and do not keep a sleeping Mac awake.

Linux installation requires `sudo`, but the current generated systemd units
also run the apps as root. Review finding **EH-02** in the
[full review](../docs/reviews/2026-09-08-full-review/examples-hardware-operations.md)
before using these units on a shared host. Foreground use as your ordinary
user avoids that installer limitation.

The installers reference the current Node executable and checkout by absolute
path. Keep both in place; reinstall if either moves. After editing a Pixlet
rotation, restart the bridge. On Linux, `systemctl enable --now` during
reinstallation does not restart an already-running service; explicitly restart
the corresponding `dmx-flights.service` or `dmx-pixlet.service` afterward.

`--uninstall` removes the service and preserves its environment file.
`--uninstall --purge` also removes that environment file; it does **not**
delete Pixlet app settings, the manager's pairing file, catalog, engine, or
logs. Saved installer secrets use mode `0600`. A successful `--status`
command is not proof of a successful render: inspect the displayed process
state and recent logs, then confirm the panel changes.
