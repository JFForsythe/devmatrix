# Run Pixlet community apps on your panel

The Pixlet bridge runs on your own computer, renders native 64×32 GIFs with
the Tronbyt-maintained Pixlet engine, and sends frames to your DK-01 over the
LAN. Your computer must stay awake. The company runs no renderer, proxy, or
app service ([ADR-0030](../../docs/adr/ADR-0030-pixlet-bridge.md)). Some
community apps need internet access or your own provider keys.

## Start with Easy Mode

You need Node 20+, Git, `tar`, a DK-01 already connected to your Wi-Fi, and
macOS or Linux on x64/arm64. The automatic download does not support 32-bit
Raspberry Pi OS or Windows. Run setup as your ordinary user:

```sh
git clone https://github.com/JFForsythe/devmatrix
cd devmatrix
node examples/setup-pixlet.mjs --device http://dmx-xxxx.local
node examples/pixlet-manager/manager.mjs --config "$HOME/tronbyt/bridge.config.json"
```

Replace `dmx-xxxx.local` with the address on your panel. Setup installs the
engine and catalog under `~/tronbyt`, installs the bridge's dependency in this
checkout, and creates `~/tronbyt/bridge.config.json`. `--dir /path/to/folder`
selects another location; pass that config path to the manager and bridge too.

The manager opens `http://127.0.0.1:47832` on the same computer. If browser
opening fails, open the printed address manually. It binds only to loopback;
opening that URL on your phone does not reach the manager on your computer.

1. Click **Show pair code**, read the panel, and enter its six digits.
2. Choose an app and fill its settings. Start with `dvdlogo`, which needs no
   provider key. **Partial support** means some fields need the upstream
   dynamic, OAuth, or upload flow; it does not mean every catalog app works
   through Easy Mode.
3. Click **Preview**, then **Show on panel once** to verify the full path.
4. Click **Add to rotation** to save your choice. This edits the config; it
   does not start a continuous bridge or reload one already running.

Pairing saves a mode-`0600` file named `.bridge.config.json.manager.env`
beside the config. The browser never receives the LAN token. The continuous
bridge and service installer do not read this file automatically: supply the
token through the bridge environment or the installer's hidden prompt.

Setup reruns preserve your rotation and app settings, tighten config mode to
`0600`, and update **only `device.url`** when you pass a different `--device`.
They may download dependencies or change the catalog checkout to the approved
commit. Local catalog edits can prevent that update. Move or back up any
ignored files inside the catalog before rerunning setup: its current dirty
check misses ignored files, which a checkout can overwrite (review EH-15).
Review the printed result;
do not assume an old engine or dependency was replaced just because setup
finished. Restart the manager and pair again when changing panels.

## Run the rotation

From the repository root, set the exact config path for every bridge command:

```sh
BRIDGE_CONFIG="$HOME/tronbyt/bridge.config.json" \
  node examples/pixlet-bridge/bridge.mjs --dry-run

DMX_TOKEN='<LAN token>' BRIDGE_CONFIG="$HOME/tronbyt/bridge.config.json" \
  node examples/pixlet-bridge/bridge.mjs --check

DMX_TOKEN='<LAN token>' BRIDGE_CONFIG="$HOME/tronbyt/bridge.config.json" \
  node examples/pixlet-bridge/bridge.mjs
```

The token placeholder must be replaced with your panel's token. The Console's
Dev console provides **COPY WITH MY TOKEN**. Treat copied commands as secrets.
The package's own `bridge.config.json` is only a placeholder template, not the
file setup created in your home directory.

`--check` checks host prerequisites and the public device-health route. It
checks that a token exists; it does **not** prove that token is accepted or
that the GIF decoder can load. **Show on panel once** or `--once dvdlogo`
provides the stronger end-to-end check.

For a persistent service, including platform limitations, secret storage,
status, restart, and removal, see the
[service lifecycle](../README.md#service-lifecycle). Always pass
`--config "$HOME/tronbyt/bridge.config.json"` to the Pixlet installer.
Keep the computer awake and run only one frame-producing host app per panel.

## Manual configuration

For manual setup, install a Tronbyt Pixlet release and clone its app catalog.
Use absolute paths for `pixlet` and `appsDir`; `pixlet: "auto"` instead uses
the process's `PATH`, which may differ between your terminal and a service.
Install the locked JavaScript dependency from the repository root:

```sh
npm ci --prefix examples/pixlet-bridge
```

Copy the package template to a private file outside the checkout and edit it:

```json
{
  "device": { "url": "http://dmx-xxxx.local", "tokenEnv": "DMX_TOKEN" },
  "pixlet": "/absolute/path/to/pixlet",
  "appsDir": "/absolute/path/to/tronbyt-apps",
  "rotation": [
    { "app": "dvdlogo", "duration_s": 15, "render_interval_s": 60, "config": {} }
  ]
}
```

`duration_s` is the slot's display time. `render_interval_s` is the minimum
age of its cached render before re-rendering on a later visit; it is not an
independent timer. A render can take up to 30 seconds and delays playback.
Set provider-backed apps to an interval their provider permits. Configuration
is read at startup: restart after saving edits.

An app can be a catalog name such as `dvdlogo` or a path relative to `appsDir`.
Catalog names prefer the app directory so differing `.star` filenames work.
Config values are strings, numbers, booleans, or `null`, passed to Pixlet as
`key=value` arguments. Provider keys therefore belong only in your private
mode-`0600` config. Easy Mode preserves unsupported or unknown settings when
editing a slot; a blank existing secret field keeps its saved value.

## Diagnose a problem

| Symptom | Check |
|---|---|
| Config still names `dmx-xxxx.local` or `/absolute/path` | Pass the config under `~/tronbyt`; the package file is a template. |
| Manager says paired but pushing returns 401 | The status only means a token is saved. Pair again after token rotation or factory reset. |
| Saved rotation does not change the panel | Start or restart the continuous bridge; the manager saves settings only. |
| Preview works, panel push fails | Confirm both devices are on the same LAN, the URL is current, and the token is valid. |
| App has unsupported settings | Use a compatible app or configure those fields through the upstream workflow before returning to Easy Mode. |
| Service runs but nothing changes | Read recent logs and confirm its config path, absolute Pixlet path, and token. Process registration is not render success. |
| Clock appears between animations | Long GIF delays or a slow render can outlast the current frame lease; see EH-06 in the full review. |

Useful commands, after setting `BRIDGE_CONFIG` to your private file:

```sh
node examples/pixlet-bridge/bridge.mjs --render-test dvdlogo
node examples/pixlet-bridge/bridge.mjs --once dvdlogo
node examples/pixlet-bridge/bridge.mjs --self-test
node examples/pixlet-manager/manager.mjs --self-test
```

`--render-test` does not contact the panel but can access an app's data
providers. It preserves a temporary GIF and `frame-0.ppm` for inspection;
delete them when finished. `--once` also needs the token and sends one
animation cycle. Playback delays are at least 67 ms (at most 15 fps before
network overhead). The bridge never scales non-64×32 output.

SIGINT/SIGTERM attempts to clear the host frame. Firmware 0.12.3+ also honors
the bridge's frame lease if the host disappears. Older firmware needs an
explicit clear. The [full review](../../docs/reviews/2026-09-08-full-review/examples-hardware-operations.md)
tracks remaining scheduler, service, and input-validation limitations.

## Provenance and verification limits

| Component | Repository pin / expectation | License | Upstream |
|---|---|---|---|
| `gifuct-js` | 2.1.2, exact dependency | MIT | <https://github.com/matt-way/gifuct-js> |
| `js-binary-schema-parser` | 2.0.3 in the lockfile, transitive dependency | MIT | <https://github.com/matt-way/jsBinarySchemaParser> |
| Tronbyt Pixlet | Setup downloads v0.53.1 with OS/CPU SHA-256 pins | Apache-2.0 | <https://github.com/tronbyt/pixlet> |
| Tronbyt community apps | Setup pins commit `d0141abcb2f6c92192f2bed0509ae9678915d61c` | Apache-2.0 | <https://github.com/tronbyt/apps> |

Download hashes are recorded in [setup-pixlet.mjs](../setup-pixlet.mjs).
An existing executable or installed dependency is reused without equivalent
pin verification. Third-party apps vary in data access, quality, and upkeep.
The [dated hardware proof](../../hardware/evidence/2026-08-17-pixlet-bridge-live-proof.md)
verified one app on one Intel Mac and panel, not every app, platform, or
unattended service. Built-in self-tests do not install Pixlet or exercise
a real GIF decode, device, or service manager.
