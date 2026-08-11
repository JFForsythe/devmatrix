# Pixlet bridge

The Pixlet bridge is an owner-hosted Devmatrix host app. It asks the
Tronbyt-maintained Pixlet fork to render community apps at their native 64×32
size, decodes the resulting GIF on the owner's machine, and sends RGB565 frames
directly to a DK-01 over the LAN `/api/v1/display/frame` endpoint. The company
runs no renderer, proxy, or app service (ADR-0030).

## Prerequisites

- Node 20 or newer.
- A Tronbyt Pixlet release for this machine, either on `PATH` as `pixlet` or at
  the absolute path named by `pixlet` in `bridge.config.json`.
- A local clone of the Tronbyt community apps repository. Point `appsDir` at
  its root.
- The owner's own API keys for any community app that needs an external
  service. Put app settings in the slot's `config`; never commit a populated
  local config.
- A paired DK-01 on the same LAN. Its LAN token is supplied through the
  environment variable named by `device.tokenEnv`, never in JSON.

Install the one JavaScript dependency from this directory, after reviewing the
provenance below:

```sh
cd examples/pixlet-bridge
npm install
```

No dependency is vendored in this repository. The bridge targets
`gifuct-js@2.1.2` and its documented `parseGIF` plus
`decompressFrames(parsedGif, true)` API.

## Configuration

Edit `bridge.config.json`, or set `BRIDGE_CONFIG` to another JSON file:

```json
{
  "device": {
    "url": "http://dmx-xxxx.local",
    "tokenEnv": "DMX_TOKEN"
  },
  "pixlet": "auto",
  "appsDir": "/absolute/path/to/tronbyt-apps",
  "rotation": [
    {
      "app": "apps/weather/weather.star",
      "duration_s": 15,
      "render_interval_s": 30,
      "config": { "location": "Chicago" }
    }
  ]
}
```

An app may be a path relative to `appsDir`, or a catalog name such as
`weather`. A catalog name resolves using the usual
`apps/<name>/<name>.star` layout. Config values must be strings, numbers,
booleans, or `null`; they are passed to Pixlet as `key=value` arguments.

The bridge invokes the Tronbyt CLI as
`pixlet render --output <temporary.gif> <app.star> [key=value ...]`, with a
30-second render timeout. It never scales output: anything other than 64×32 is
rejected with the app name in the error.

## Run and diagnose

From the repository root:

```sh
DMX_TOKEN='<LAN token>' node examples/pixlet-bridge/bridge.mjs --check
DMX_TOKEN='<LAN token>' node examples/pixlet-bridge/bridge.mjs --once weather
node examples/pixlet-bridge/bridge.mjs --render-test weather
node examples/pixlet-bridge/bridge.mjs --dry-run
node examples/pixlet-bridge/bridge.mjs --self-test
```

`--render-test` does not contact the device. It preserves its temporary GIF
and writes `frame-0.ppm` beside it for inspection. `--once` renders and pushes
one animation cycle. During normal rotation, cached renders are reused until
their slot's `render_interval_s` expires. GIF delays are clamped to at least
67 ms, the integer-millisecond ceiling for 15 fps. SIGINT and SIGTERM clear the
host frame before a clean exit so the device can resume its own rotation.

For an unattended service, run `node examples/install-pixlet-bridge.mjs` from
the repository root. Its dry run shows every file and service command with the
token redacted.

## Provenance

| Component | Version used or expected | License | Upstream |
|---|---|---|---|
| `gifuct-js` | **2.1.2** (exact runtime dependency) | MIT | <https://github.com/matt-way/gifuct-js> |
| Pixlet, Tronbyt-maintained fork | Owner-installed release | Apache-2.0 | <https://github.com/tronbyt/pixlet> |
| Tronbyt community apps | Owner-cloned current checkout | Apache-2.0 | <https://github.com/tronbyt/apps> |

Pixlet and the community catalog are independent third-party projects.
Community app behavior, data sources, and maintenance quality vary by app.
Frames use the LAN-only API layer defined by ADR-0029.
