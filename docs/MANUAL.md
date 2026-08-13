# DK-01 owner's manual

The complete instruction manual for using a DK-01: setup, everyday
control, apps, updates, and recovery. Product *specs* live in their
owner files (linked throughout); this file owns the owner's
step-by-step instructions.

Two status labels keep this manual honest (a P0 rule — no unsupported
claim in this repo):

- **Today** — current firmware v0.10.0 behavior. This slice is build-verified;
  final on-panel and live-receiver acceptance remains a hardware step.
- **Ahead · gate X** — specified and coming; the gate names are
  [ROADMAP.md](../ROADMAP.md)'s. Nothing labeled Ahead is a promise the
  current firmware keeps.

## 1 · What you need — Today

- The board and panel: Adafruit MatrixPortal S3 driving a 64×32 HUB75
  RGB matrix (the DK-01 hardware, [docs/VISION.md](VISION.md)).
  Verified bring-up evidence lives in [hardware/](../hardware/).
- A 5 V supply with real headroom. A full-bright white frame can
  out-draw weak USB-C power and brown-out the board — the firmware
  caps brightness at 150/255 for exactly that reason, and the
  Dashboard warns you when a reset was a brown-out.
- A phone or laptop with Wi-Fi, and a 2.4 GHz network to join.
- No app, no account, no cloud — ever, for anything in this manual
  ([docs/MODES.md](MODES.md) owns that split).

## 2 · Get the firmware onto the board — Today

One cable flash, then never again (updates go over the air):

1. Install `arduino-cli`, the pinned `esp32` core (3.3.x), and
   Adafruit Protomatter 1.7.1 — exact commands in
   [firmware/dk01/README.md](../firmware/dk01/README.md).
2. Compile and upload `firmware/dk01/` with the
   `adafruit_matrixportal_esp32s3` board target (same README, "First
   (and last) cable flash").
3. The panel boots into the setup flow below.

**Ahead · R0:** sold units arrive already flashed and provisioned; this
chapter then applies only to forks and bare boards.

## 3 · First boot and Wi-Fi — Today

1. Power the board. The panel announces its setup hotspot:
   `JOIN ME → DEVMATRIX-XXXX` (the Xs are from your board's serial).
2. On your phone, join that `DEVMATRIX-XXXX` Wi-Fi network. A captive
   portal opens by itself. If it doesn't, browse to `http://192.168.4.1`.
3. The portal scans and lists your networks live. Pick yours, type the
   password, and watch it join in real time — no blind reboot-and-hope.
4. When the join succeeds, the panel shows its address, e.g.
   `dmx-xxxx.local`, and the phone that ran setup is signed in to the
   Console automatically.

**Wrong password?** The portal tells you and lets you retry — the
device doesn't reboot into limbo. **Changed routers later?** Console →
Security → **CHANGE WI-FI…** reopens this flow (or `POST /api/v1/wifi/reset`).

**Ahead · P1/M0:** USB Improv setup (join Wi-Fi over the cable, no
hotspot step) — specified in [docs/PORTAL.md](PORTAL.md).

## 4 · Claim the device and pair more browsers — Today

The phone that ran setup is already paired. For every other browser:

1. Browse to `http://dmx-xxxx.local/` and tap **Pair**.
2. The panel shows a 6-digit code — a white row, then blue.
3. Type the code into that browser. It now holds the LAN token — the
   bearer credential every API call uses ([docs/GLOSSARY.md](GLOSSARY.md)).

Codes expire after 5 minutes and die after 5 wrong tries. Reading the
panel *is* the proof of possession: nothing to write down, and a lost
browser never means factory reset — just pair again. To revoke every
existing session at once: Security → **ROTATE LAN TOKEN**.

Pairing also pins the device's **identity key**: the box signs every
later challenge with an Ed25519 key minted on its first boot, and the
Console verifies the signature against the key it pinned here — so an
mDNS spoofer squatting `dmx-xxxx.local` cannot impersonate your panel
(ADR-0031; [docs/SECURITY.md](SECURITY.md) → Discovery & local
transport). Check or re-run the proof any time: Security → **Device
identity** → **VERIFY NOW**.

**Prefer starting from the hosted Console?** Open
`devmatrix.flighttrackerled.com`, follow the welcome screen, and enter
the panel's address — Chrome, Edge, and Firefox ask once for
local-network permission and then talk straight to the panel over your
LAN. Safari doesn't allow that yet; use the panel's own address there.
Either way the panel stays 100 % local — the hosted page is a static
file, and nothing routes through a server of ours.

**Ahead · M1:** the full claim ceremony — session code on the panel
plus a 2-second physical button hold, per
[docs/SECURITY.md](SECURITY.md) → Ceremonies.

## 5 · The Console, page by page — Today

Served by the device itself at `http://dmx-xxxx.local/` — no internet
needed. Today's Console has eight views, converged with
[docs/PORTAL.md](PORTAL.md) from one codebase per
[ADR-0027](adr/ADR-0027-one-console-codebase.md). The hosted copy adds
a welcome screen that walks a new owner from unboxing to a connected,
identity-verified panel (or into a clearly-labeled interactive demo):

- **Dashboard** — live status tiles: firmware version and slot, display
  refresh (Hz), free heap, uptime, Wi-Fi signal, IP address, current
  scene, and last reset reason. A brown-out reset shows a visible alert.
  Use **SEND TO PANEL** for quick text, the live **BRIGHTNESS** control
  for the USB-safe 10–150 range, and **IDENTIFY** or **REBOOT** for quick
  device actions. The 64×32 paint canvas is now here too: choose a
  color, draw, then use **PUSH FRAME** or turn on **LIVE STROKES**.
- **Devices** — shows the device that served this page with its name,
  serial, address, firmware, and online state. **Pair another browser**
  walks through reading the panel's 6-digit code; the new browser keeps
  its LAN token locally and retries the interrupted request.
- **Apps** — opens with **On the panel now**: what the panel is showing
  this second, what's up next, and the full rotation order — every SAVE
  or SHOW NOW is visible here immediately, and action results pop up as
  a toast. The **Messages** card leads with **your first app — 30
  seconds**: type words, press **PUT IT ON THE PANEL**, and they're
  saved, enabled, and showing; below the divider it edits and rotates
  up to eight offline phrases.
  **Flights list** enables the small on-device list and configures its local
  receiver URL, fetch interval, rows, and speed/altitude value; the Radar
  choice and copied command still need the host app in chapter 8. **Custom
  layout** leads with its starter template — **ADD LIVE WEATHER** installs
  a National Weather Service layout in one click (ADR-0015's no-key
  provider; US METAR stations) and fills the editor so you can see how
  it's built — then validates and saves any 2 KB JSON layout with literal
  rows or RFC 6901 bindings. Each on-device card can be enabled, assigned
  a scene interval, saved to NVS, or shown immediately. The **Pixlet
  bridge** card covers the 1,000+ community-built Tidbyt-ecosystem apps
  via the owner-hosted bridge (chapter 7's host tier; installer in
  `examples/`). **Ahead · gate M4** — the Community Registry adds more
  reviewed apps, permission sheets, and one-click installation.
- **Deploy** — shows the running version and slot. Choose a `.bin`, then
  **UPLOAD & REBOOT** to send it to the inactive OTA slot and watch
  progress while the device returns; chapter 9 covers the full process.
  **Ahead · gate M0** — signed OTA verification and automatic rollback
  after a failed boot. USB recovery is available today.
- **Dev console** — select any documented LAN API route, inspect its
  method and path, edit the JSON body where applicable, and build a
  ready-to-run `curl` command. **COPY WITH MY TOKEN** includes this
  browser's LAN token; health and claim routes remain open.
- **Security** — the **Device identity** card shows the pinned Ed25519
  key fingerprint and **VERIFY NOW** re-runs the signed-nonce proof
  (chapter 4). **ROTATE LAN TOKEN** logs out every other client,
  **CHANGE WI-FI…** removes only Wi-Fi credentials and reboots to setup,
  and **FACTORY RESET** wipes device settings after you type the exact
  confirmation. **Ahead · gate M1** — optional account passkeys,
  hardware-key enrollment, and the timestamped exportable audit log.
- **Settings** — choose a common **Clock timezone** preset or enter a
  custom **POSIX STRING**, then **SAVE TIMEZONE**. The same view shows
  the hostname, IP address, and current Console target, with
  **FORGET / SWITCH DEVICE…** to clear this browser's stored address,
  token, and pinned key. Its **MQTT broker** card holds the optional
  broker host/port, username, write-only password, TLS and enable
  toggles, plus a live connection status chip.
- **Guide** — this manual's working summary, inside the Console: the
  five-minute setup path, what every page does, the Local/Cloud split,
  and first-line troubleshooting. Served by the panel itself, so the
  instructions survive an internet outage.

## 6 · Push things from your own code — Today

Get `$TOKEN` from the Console's Dev console view (**COPY WITH MY
TOKEN**). Full route list:
[firmware/dk01/README.md](../firmware/dk01/README.md).

**Text** (up to 300 s on screen):

```sh
curl -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
     -d '{"text":"SHIP IT","duration_s":30}' \
     http://dmx-xxxx.local/api/v1/display/text
```

**Multi-line boards:** embed `\n` in `text` and the panel switches to a
tiny 3×5 font — up to 5 rows of 16 characters, perfect for tabular
boards like the flights list.

**Full frames:** `POST /api/v1/display/frame` takes one 64×32 frame as
4096 bytes of RGB565 (little-endian), base64-encoded in `{"b64":…}`.
Frames ride REST/WebSocket only, never MQTT (ADR-0029) — push them as
fast as ~15 fps on your LAN.

**Also useful:** `display/brightness` (10–150), `display/clear`,
`identify` (flashes the panel so you can find it), `health` (open, no
token — good for monitoring).

## 7 · The three kinds of apps

The app model (ADR-0026, owner: [docs/FIRMWARE.md](FIRMWARE.md)):

| Kind | Runs on | You need | Status |
|---|---|---|---|
| **Declarative app** — layout + data bindings; the device fetches its own data | the DK-01 | nothing else | **Today (messages, flights list, custom layout) · more at M4** |
| **Host app** — a program pushing content over the LAN API | a machine you keep on | Pi / NAS / HA box / mini PC | **Today** (chapter 8) |
| **Scripted app** — sandboxed code in an on-device VM | the DK-01 | — | **Deferred** (ADR-0026) |

Messages, Flights list, and Custom layout need no other computer.
Richer host apps such as the animated Flights Overhead radar still need
a computer that stays on; M4 adds more reviewed declarative apps.

## 8 · Flights Overhead — Today (host app)

Shows aircraft your own ADS-B receiver hears — a live list, or an
animated radar with altitude-colored aircraft, comet trails, runways,
and green landing strobes. Local receiver only, by design
([docs/VISION.md](VISION.md) — never a company feed).
The radar view pushes raw frames, so it is frame-layer and same-LAN in
Local Mode; Cloud Mode's paid relay (**Ahead · gate C1**) is the only
remote path (ADR-0029).

**You need:** a receiver on your LAN speaking the open
dump1090/readsb `aircraft.json` format (a PiAware Pi qualifies), plus
any always-on machine with Node 18+.

1. Console → **Apps** → **Flights list** → **SCAN MY NETWORK**. The
   device finds common receiver images itself; or type the receiver URL
   manually.
2. Set interval, rows, format, and List or Radar. Save — the config
   lives on the device, and any host machine obeys it.
3. The Flights list card prints your exact run command under **OPTIONAL
   RADAR HOST COMMAND**. It looks like:

   ```sh
   DMX_URL=http://dmx-xxxx.local DMX_TOKEN=<your LAN token> \
     node examples/flights-overhead.mjs
   ```

4. Flip List/Radar from the Console while it runs — no restart needed.

### Keep it running when you close your laptop

The script must live on a machine that stays on, and the checkout must
remain at the same path. Run the installer from the repository root; it
prompts for the device URL and hides the token while you type it:

```sh
# macOS
node examples/install-flights.mjs

# Linux / Raspberry Pi (system files require root)
sudo "$(command -v node)" examples/install-flights.mjs
```

It installs and starts a `launchd` agent on macOS or a `systemd` service
on Linux. The environment file is mode `0600`; on macOS the
credential-bearing plist is also mode `0600`, and service output goes to
`~/Library/Logs/devmatrix/`. Optional overrides are `--receiver-url`,
`--airport`, `--view-mi`, and `--fps`.

Preview every file and command without changing the machine, inspect the
service, or remove it with:

```sh
node examples/install-flights.mjs --dry-run
node examples/install-flights.mjs --status
node examples/install-flights.mjs --uninstall       # keep flights.env
node examples/install-flights.mjs --uninstall --purge
```

On Linux, use the same `sudo "$(command -v node)" ...` prefix for install
and uninstall. Re-running the installer replaces and restarts the existing
service cleanly.

<details>
<summary>What it writes on Linux (systemd)</summary>

The installer writes credentials to `/etc/devmatrix/flights.env` and the
following auditable unit to
`/etc/systemd/system/dmx-flights.service`. The two `ExecStart` paths are
resolved absolute paths on the machine running the installer.

```ini
[Unit]
Description=Devmatrix Flights Overhead
After=network-online.target

[Service]
EnvironmentFile=/etc/devmatrix/flights.env
ExecStart="/absolute/path/to/node" "/absolute/path/to/examples/flights-overhead.mjs"
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

It then runs `systemctl daemon-reload` and
`systemctl enable --now dmx-flights.service`.

</details>

### Hundreds of community apps — the Pixlet bridge

The owner-hosted Pixlet bridge runs the open-source, Tronbyt-maintained
Pixlet engine and community catalog on **your** always-on machine, then pushes
the rendered 64×32 frames straight to the DK-01. The company renders, proxies,
and stores nothing for this feature (ADR-0030).

**You need:** Node 20+, a [Tronbyt Pixlet](https://github.com/tronbyt/pixlet)
binary for your platform, a local clone of the
[community apps fork](https://github.com/tronbyt/apps), and your own API keys
for any apps that call outside services. Install the bridge's one pinned GIF
decoder dependency from `examples/pixlet-bridge/` with `npm install` after
reviewing its provenance table.

Edit `examples/pixlet-bridge/bridge.config.json`, or put the config elsewhere
and set `BRIDGE_CONFIG` to its absolute path:

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

`pixlet` may instead be the binary's absolute path. An `app` may be a path
relative to `appsDir` or a catalog name. Keep the LAN token out of JSON: the
bridge reads the environment variable named by `tokenEnv`.

From the repository root, check the complete setup, push one app for one
animation cycle, then install the rotation as a background service:

```sh
DMX_TOKEN='<LAN token>' node examples/pixlet-bridge/bridge.mjs --check
DMX_TOKEN='<LAN token>' node examples/pixlet-bridge/bridge.mjs --once weather
node examples/install-pixlet-bridge.mjs \
  --config "$PWD/examples/pixlet-bridge/bridge.config.json"
```

The installer securely prompts for the token, records the absolute
`BRIDGE_CONFIG` path and `DMX_TOKEN` in a mode-`0600` environment file, and
installs `dmx-pixlet.service` on Linux or `com.devmatrix.pixlet` on macOS.
Preview it, inspect it, or remove it with the same lifecycle as the Flights
installer above:

```sh
node examples/install-pixlet-bridge.mjs --dry-run --token 'test-only'
node examples/install-pixlet-bridge.mjs --status
node examples/install-pixlet-bridge.mjs --uninstall
node examples/install-pixlet-bridge.mjs --uninstall --purge
```

Use the same `sudo "$(command -v node)" ...` prefix on Linux.

**Honest limits:** raw frames are LAN-only (ADR-0029), so the bridge and DK-01
must share a LAN in Local Mode. These apps are community-maintained; quality,
data sources, key requirements, and continued maintenance vary. Every render
runs on the owner's hardware—the company operates no Pixlet service.

More examples and script details: [examples/README.md](../examples/README.md).

## 9 · Update firmware over the air — Today

1. Build the new `.bin` (chapter 2) — or take a published release
   artifact once releases begin (**Ahead · M0**, signed).
2. Console → **Deploy** → **OTA upload** → choose the `.bin` → **UPLOAD
   & REBOOT**. It writes to the inactive slot and reboots into it; the
   Dashboard shows the new version and slot.

**Honest limits, today:** images are length/magic-checked but not yet
signature-verified, and rollback on a failed boot is not automatic —
both are M0 acceptance work. Until then, chapter 10 is the safety net.
([firmware/dk01/README.md](../firmware/dk01/README.md) owns these
caveats.)

## 10 · Recovery and resets — Today

The never-brick ladder, mildest first:

| Action | How | What it wipes |
|---|---|---|
| Reboot | Dashboard → **REBOOT**, or `POST /api/v1/reboot` | nothing |
| Change Wi-Fi | Security → **CHANGE WI-FI…** (`wifi/reset`) | Wi-Fi credentials only — token and config survive |
| Rotate the token | Security → **ROTATE LAN TOKEN** | every paired browser/script credential |
| Factory reset | Security → **FACTORY RESET** (`factory/reset`) | everything in NVS: Wi-Fi, token, timezone, MQTT credentials, flights config |
| USB recovery | Double-press the board's reset button — it mounts as a USB drive; drag a UF2 firmware file on | nothing by itself — reflashes firmware |

The TinyUF2 factory partition survives every OTA, so USB recovery is
always there even if both app slots are bad. Physical access is the
recovery tool — by design ([docs/SECURITY.md](SECURITY.md)).

## 11 · Home Assistant and MQTT — Today

MQTT is optional and the broker is yours. The company never operates one,
and leaving the host empty keeps the device's MQTT client completely off.

1. Run a broker you control, such as Home Assistant's Mosquitto add-on or
   Mosquitto on a Pi.
2. Create one broker user for this device and scope its ACL to the device's
   `devmatrix/<serial>/#` tree, Home Assistant discovery writes, and the
   `homeassistant/status` birth topic.
3. Console → Settings → **MQTT broker**. Enter the broker hostname or IP,
   port (1883 by default), username, and password; choose TLS if needed,
   turn on **ENABLE MQTT**, then **SAVE MQTT**.
4. Watch the card's status move through **CONNECTING** to **CONNECTED**.
   The password is write-only: a blank password field leaves the saved value
   unchanged, and entering a value replaces it.
5. With Home Assistant's MQTT integration and discovery enabled, the device
   publishes retained light-brightness, text, and notify configs with its
   availability topic. Home Assistant can control them with **zero YAML**.

TLS is encrypted but not yet CA-verified in this pre-P2 firmware; use a
trusted LAN or VPN path. The exact topics, envelope, QoS/retain rules,
per-device Mosquitto ACL, and the broker WebSocket listener needed by a
browser MQTT workbench are in
[contracts/mqtt.md](../contracts/mqtt.md) (DRAFT until the P2 freeze).

## 12 · Remote control — Today and Ahead

- **Your own infrastructure, free:** put the LAN behind your own
  VPN/Tailscale ([docs/MODES.md](MODES.md) → owner-hosted remote), or
  point the device and a remote host app at a broker they can both reach.
  Today's MQTT semantic commands cover text, brightness, clear, and app
  selection; raw frames never ride a broker (ADR-0029).
- **Paid Cloud Mode (gates C0–C3):** relay, fleet view, alerts —
  optional, subscription-funded, never required.
  [docs/MODES.md](MODES.md) is the line.

## 13 · Troubleshooting — Today

| Symptom | Fix |
|---|---|
| Captive portal never opened | Browse to `http://192.168.4.1` while on the `DEVMATRIX-XXXX` network |
| `dmx-xxxx.local` not found | Your network blocks mDNS — use the IP the panel showed at setup; both work |
| Hosted Console can't reach the panel | Same Wi-Fi? Allow the browser's local-network permission when asked (Chrome/Edge/Firefox). Safari can't do this — open the panel's own address instead. Firmware older than 0.9.0 also can't answer the hosted origin; update from the panel's own Deploy page first |
| Identity warning (key mismatch) | A reflash or factory reset legitimately changes the device key — Settings → **FORGET / SWITCH DEVICE…**, then reconnect and re-pair. If you didn't reflash, stop and check what's answering on that address |
| `401 unauthorized` | Stale token — re-pair (chapter 4) or re-copy from the Dev console view |
| Panel resets at high brightness | Under-powered supply. The 150 cap exists for this; the Dashboard's reset-reason tile confirms a brown-out |
| Clock is wrong | Settings → timezone; the clock needs one internet moment for SNTP after boot |
| Weather / Flights list / any fetching app shows only the clock | The app has no usable data and is telling you why: check **`GET /api/v1/apps/diag`** (or run `node examples/dmx-top.mjs`) — `too-big` means firmware older than 0.10.0 (its 4 KB fetch cap was smaller than real feeds; update from Deploy), `no-url` means set the receiver URL, `http-…`/`connect-failed` means the source is unreachable, `no-aircraft`/`bind-miss` means the feed answered but held nothing to render |
| Apps → Flights list saves but the radar shows nothing | The host script isn't running — chapter 8; check `systemctl status dmx-flights` |
| MQTT stays disabled | Turn on **ENABLE MQTT** and enter a host; an empty host deliberately keeps MQTT off |
| MQTT shows error | Check the broker address, port, per-device username/password and ACL from chapter 11; pre-P2 TLS also requires a trusted network path |
| Home Assistant did not discover the device | Confirm MQTT says connected and Home Assistant publishes `online` to `homeassistant/status`; then check the discovery-write ACL in the contract |
| Upload port busy while flashing | Close any serial monitor — the port is exclusive-open |
| Nothing works at all | USB recovery (chapter 10), then set up again — setup data is five minutes to recreate |

## 14 · Rules this manual follows

Facts belong to their owner docs — this manual only walks you through
them. If this file ever contradicts [docs/PORTAL.md](PORTAL.md),
[docs/MODES.md](MODES.md), [docs/SECURITY.md](SECURITY.md),
[docs/FIRMWARE.md](FIRMWARE.md), or an ADR, the owner doc wins and
this manual gets fixed in the same change (CLAUDE.md).
