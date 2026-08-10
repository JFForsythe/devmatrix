# DK-01 owner's manual

The complete instruction manual for using a DK-01: setup, everyday
control, apps, updates, and recovery. Product *specs* live in their
owner files (linked throughout); this file owns the owner's
step-by-step instructions.

Two status labels keep this manual honest (a P0 rule — no unsupported
claim in this repo):

- **Today** — works now, on firmware v0.6.0, verified on real hardware.
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

**Ahead · M1:** the full claim ceremony — session code on the panel
plus a 2-second physical button hold, per
[docs/SECURITY.md](SECURITY.md) → Ceremonies.

## 5 · The Console, page by page — Today

Served by the device itself at `http://dmx-xxxx.local/` — no internet
needed. Today's device Console has seven views, converged with
[docs/PORTAL.md](PORTAL.md) from one codebase per
[ADR-0027](adr/ADR-0027-one-console-codebase.md):

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
- **Apps** — configures the Flights Overhead companion app (chapter 8):
  **RECEIVER URL**, **SCAN MY NETWORK**, interval (1–60 s), rows (1–5),
  speed/altitude value, and List/Radar view. **SAVE TO DEVICE** keeps the
  configuration in device NVS; **COPY WITH MY TOKEN** copies the host
  command. **Ahead · gate M4** — the Community Registry adds reviewed
  declarative apps, permission sheets, and one-click installation.
- **Deploy** — shows the running version and slot. Choose a `.bin`, then
  **UPLOAD & REBOOT** to send it to the inactive OTA slot and watch
  progress while the device returns; chapter 9 covers the full process.
  **Ahead · gate M0** — signed OTA verification and automatic rollback
  after a failed boot. USB recovery is available today.
- **Dev console** — select any documented LAN API route, inspect its
  method and path, edit the JSON body where applicable, and build a
  ready-to-run `curl` command. **COPY WITH MY TOKEN** includes this
  browser's LAN token; health and claim routes remain open.
- **Security** — **ROTATE LAN TOKEN** logs out every other client,
  **CHANGE WI-FI…** removes only Wi-Fi credentials and reboots to setup,
  and **FACTORY RESET** wipes device settings after you type the exact
  confirmation. **Ahead · gate M1** — optional account passkeys,
  hardware-key enrollment, and the timestamped exportable audit log.
- **Settings** — choose a common **Clock timezone** preset or enter a
  custom **POSIX STRING**, then **SAVE TIMEZONE**. The same view shows
  the hostname, IP address, and current Console target.

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
| **Declarative app** — layout + data bindings; the device fetches its own data | the DK-01 | nothing else | **Ahead · M2–M4** |
| **Host app** — a program pushing content over the LAN API | a machine you keep on | Pi / NAS / HA box / mini PC | **Today** (chapter 8) |
| **Scripted app** — sandboxed code in an on-device VM | the DK-01 | — | **Deferred** (ADR-0026) |

The honest caveat, plainly: **today, every rich app is a host app** —
it needs a computer that stays on. The M4 bundled apps (Weather,
Stocks, Messages, Flights list) will run on the box alone.

## 8 · Flights Overhead — Today (host app)

Shows aircraft your own ADS-B receiver hears — a live list, or an
animated radar with altitude-colored aircraft, comet trails, runways,
and green landing strobes. Local receiver only, by design
([docs/VISION.md](VISION.md) — never a company feed).

**You need:** a receiver on your LAN speaking the open
dump1090/readsb `aircraft.json` format (a PiAware Pi qualifies), plus
any always-on machine with Node 18+.

1. Console → **Flights** → **Scan my network**. The device finds
   common receiver images itself; or type the receiver URL manually.
2. Set interval, rows, format, and List or Radar. Save — the config
   lives on the device, and any host machine obeys it.
3. The Flights page prints your exact run command. It looks like:

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

More examples and script details: [examples/README.md](../examples/README.md).

## 9 · Update firmware over the air — Today

1. Build the new `.bin` (chapter 2) — or take a published release
   artifact once releases begin (**Ahead · M0**, signed).
2. Console → **Update** → choose the `.bin` → upload. It writes to the
   inactive slot and reboots into it; the Dashboard shows the new
   version and slot.

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
| Rotate the token | Settings → **Rotate LAN token** | every paired browser/script credential |
| Factory reset | Security → **FACTORY RESET** (`factory/reset`) | everything in NVS: Wi-Fi, token, timezone, flights config |
| USB recovery | Double-press the board's reset button — it mounts as a USB drive; drag a UF2 firmware file on | nothing by itself — reflashes firmware |

The TinyUF2 factory partition survives every OTA, so USB recovery is
always there even if both app slots are bad. Physical access is the
recovery tool — by design ([docs/SECURITY.md](SECURITY.md)).

## 11 · Home Assistant and MQTT — Ahead · gate M2

When the MQTT client lands (ADR-0028, contract already drafted):

1. Run any Mosquitto broker — Home Assistant's add-on is one click,
   or `apt install mosquitto` on a Pi. The company never runs one.
2. Create a broker user for the device.
3. Console → Settings → MQTT → enter host, port, username, password.
4. The device announces itself; Home Assistant discovers light,
   scene, notify, and text entities with **zero YAML**.

Topic tree, payload envelope, and per-device broker ACLs:
[contracts/mqtt.md](../contracts/mqtt.md) (DRAFT until the P2 freeze).

## 12 · Remote control — Ahead

- **Your own infrastructure, free:** put the LAN behind your own
  VPN/Tailscale ([docs/MODES.md](MODES.md) → owner-hosted remote), or
  — once MQTT lands — point the device and a remote host app at a
  broker they can both reach. Semantic commands (text, layouts,
  scenes) work remotely; raw frames never ride a broker (ADR-0029).
- **Paid Cloud Mode (gates C0–C3):** relay, fleet view, alerts —
  optional, subscription-funded, never required.
  [docs/MODES.md](MODES.md) is the line.

## 13 · Troubleshooting — Today

| Symptom | Fix |
|---|---|
| Captive portal never opened | Browse to `http://192.168.4.1` while on the `DEVMATRIX-XXXX` network |
| `dmx-xxxx.local` not found | Your network blocks mDNS — use the IP the panel showed at setup; both work |
| `401 unauthorized` | Stale token — re-pair (chapter 4) or re-copy from the Dev console view |
| Panel resets at high brightness | Under-powered supply. The 150 cap exists for this; the Dashboard's reset-reason tile confirms a brown-out |
| Clock is wrong | Settings → timezone; the clock needs one internet moment for SNTP after boot |
| Flights page saves but panel shows nothing | The host script isn't running — chapter 8; check `systemctl status dmx-flights` |
| Upload port busy while flashing | Close any serial monitor — the port is exclusive-open |
| Nothing works at all | USB recovery (chapter 10), then set up again — setup data is five minutes to recreate |

## 14 · Rules this manual follows

Facts belong to their owner docs — this manual only walks you through
them. If this file ever contradicts [docs/PORTAL.md](PORTAL.md),
[docs/MODES.md](MODES.md), [docs/SECURITY.md](SECURITY.md),
[docs/FIRMWARE.md](FIRMWARE.md), or an ADR, the owner doc wins and
this manual gets fixed in the same change (CLAUDE.md).
