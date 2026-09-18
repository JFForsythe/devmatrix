# DK-01 owner's manual

The complete instruction manual for using a DK-01: setup, everyday
control, apps, updates, and recovery. Product *specs* live in their
owner files (linked throughout); this file owns the owner's
step-by-step instructions.

Two status labels keep this manual honest (a P0 rule — no unsupported
claim in this repo):

- **Today** — implemented behavior in the [current firmware](../firmware/dk01/README.md).
  This label does not imply every hardware acceptance test passed; the
  [evidence index](../hardware/README.md) records what was tested and when.
- **Ahead · gate X** — specified and coming; the gate names are
  [ROADMAP.md](../ROADMAP.md)'s. Nothing labeled Ahead is a promise the
  current firmware keeps.

## Find the right instructions

| I want to… | Start here |
|---|---|
| Use an assembled kit | [First boot](#first-boot), then [pairing](#pairing) |
| Build firmware for a bare board | [Build and flash](#build-firmware) |
| Put my first message on the panel | [Console → Apps](#console-pages) |
| Send content from my own code | [HTTP API walkthrough](#first-api-request) |
| Choose between built-in and computer-hosted apps | [App types](#app-types) |
| Set up flights or community Pixlet apps | [Host apps](#host-apps) |
| Fix a connection or reset problem | [Troubleshooting](#troubleshooting), then [recovery](#recovery) |

**Before you start:** use a network you trust. Current setup, token handling,
and firmware updates have known security limits in [SECURITY.md](SECURITY.md).
A demo success message does not prove a physical panel displayed anything.
For real setup, success means seeing your chosen message on the panel.

## 1 · What you need — Today

- The board and panel: Adafruit MatrixPortal S3 driving a 64×32 HUB75
  RGB matrix (the DK-01 hardware, [docs/VISION.md](VISION.md)).
  Verified bring-up evidence lives in [hardware/](../hardware/).
- For development, a USB-C supply whose label specifies **5 V at 2 A or
  more**. Check the 5 V output rating; an advertised fast-charging wattage
  alone does not establish suitability.
  A full-bright white frame can out-draw weak USB-C power and
  brown-out the board — the firmware caps brightness at 150/255 for
  that reason, and the Dashboard warns you when a reset was a
  brown-out. This is a starting guideline; supply/cable qualification is
  still open in the [hardware evidence](../hardware/README.md).
- A phone or laptop with Wi-Fi, and a 2.4 GHz network to join.
- No phone app, company account, or company cloud is needed for Local Mode.
  Individual data apps can require outside services, provider accounts, or an
  always-on computer; [docs/MODES.md](MODES.md) owns that split.

<a id="build-firmware"></a>

## 2 · Get the firmware onto the board — Today

**Sold units arrive already flashed** — if your kit came in a box,
skip straight to chapter 3. This chapter is for bare boards, forks,
and rebuilding from source.

Use a cable for the initial flash and keep it for recovery. Later firmware
updates can go over the LAN:

1. Install `arduino-cli` and all core/library versions listed in the
   firmware guide — exact commands in
   [firmware/dk01/README.md](../firmware/dk01/README.md).
2. Compile and upload `firmware/dk01/` with the
   `adafruit_matrixportal_esp32s3` board target (same README, **Cable flash**).
3. The panel boots into the setup flow below.

Re-flashing a board that has been used before? Chapter 10 → **Back to
default** returns it to out-of-box first — the settings wipe needs no
token and no working Console.

<a id="first-boot"></a>

## 3 · First boot and Wi-Fi — Today

1. Power the board. The panel announces its setup hotspot:
   `SETUP: JOIN DEVMATRIX-XXXX` (the Xs are from your board's serial).
2. On your phone, join that `DEVMATRIX-XXXX` Wi-Fi network. A captive
   portal opens by itself. If it doesn't, browse to `http://192.168.4.1`.
3. The portal scans and lists your networks live. Pick yours, type the
   password, and watch it join — no blind reboot-and-hope.
4. When the join succeeds, use **Finish** in the setup page, then rejoin
   your normal Wi-Fi. The full browser may retain the setup token; captive
   portal mini-browsers may not share storage with it. If pairing is asked
   for, follow chapter 4. (If nothing taps Finish, the device
   closes its setup hotspot by itself 90 seconds after the join and
   boots onto your Wi-Fi.)
5. After the restart the panel itself walks you to the last step:
   `WIFI CONNECTED · LAST STEP: OPEN DMX-XXXX.LOCAL IN YOUR BROWSER`.
   That card stays up until the Console reaches the device for the
   first time — opening the Console on any browser, or pairing
   (chapter 4) — then retires forever and the panel shows its clock.
   A factory reset re-arms it.

**Android phones and `.local`:** some Android browsers cannot resolve
mDNS `.local` names. If `dmx-xxxx.local` won't load, use the panel's
IP address instead — chapter 13's first row shows where to find it.

**Wrong password?** The portal tells you and lets you retry — the
device doesn't reboot into limbo. **Changed routers later?** Console →
Security → **CHANGE WI-FI…** reopens this flow (or `POST /api/v1/wifi/reset`).

**Ahead · gate M0:** USB Improv setup (join Wi-Fi over the cable, no
hotspot step) — specified in [docs/PORTAL.md](PORTAL.md);
[docs/MODES.md](MODES.md) owns the gate.

<a id="pairing"></a>

## 4 · Claim the device and pair more browsers — Today

If the browser received the setup token it is already paired. Otherwise,
or for any additional browser:

1. Browse to `http://dmx-xxxx.local/` and tap **Pair**.
2. The panel shows a 6-digit code — a white row, then blue.
3. Type all six digits without a space or hyphen; the current input can
   truncate a pasted separator. It now holds the LAN token — the
   bearer credential every API call uses ([docs/GLOSSARY.md](GLOSSARY.md)).

Codes expire after 5 minutes, die after 5 wrong tries, and asking
again never extends an active code's life. Reading the
panel *is* the proof of possession: nothing to write down, and a lost
browser never means factory reset — just pair again. To revoke every
existing session at once: Security → **ROTATE LAN TOKEN**.

The Console can pin the device's **identity key** and run a signed-nonce
check in **Security → Device identity → VERIFY NOW**. This checks key
continuity against the stored key. It does not encrypt HTTP or protect all
later API calls, and the current saved-token reconnect path does not require
the check before sending credentials. Use the address read from your own
panel; do not follow someone else's `?device=` link in a paired browser.
[SECURITY.md](SECURITY.md) explains first-contact and active-network limits.

**Prefer starting from the hosted Console?** Open the
[hosted Console](https://devmatrix.flighttrackerled.com) and enter the panel's
address. Browser and operating-system local-network permissions can affect
this path. If it fails, open the panel's own HTTP address directly. That
serves the Console from the device and works without the company site.
[PORTAL.md](PORTAL.md) owns browser transport support; [OPERATIONS.md](OPERATIONS.md)
owns hosting status.

**Ahead · M1:** the full claim ceremony — session code on the panel
plus a 2-second physical button hold, per
[docs/SECURITY.md](SECURITY.md) → Ceremonies.

<a id="console-pages"></a>

## 5 · The Console, page by page — Today

Served by the device itself at `http://dmx-xxxx.local/` — no internet
needed. Today's Console has eight views, converged with
[docs/PORTAL.md](PORTAL.md) from one codebase per
[ADR-0027](adr/ADR-0027-one-console-codebase.md). The hosted copy adds
a welcome screen that walks a new owner from unboxing to connecting and
pairing a panel (or into a clearly-labeled interactive demo) —
chapter 4:

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
  bridge** card links the community Pixlet catalog
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
  token, and pinned key. **Current limitation:** this control may not load
  when the saved device is offline; see chapter 13 for browser recovery.
  Its **MQTT broker** card holds the optional
  broker host/port, username, write-only password, TLS and enable
  toggles, plus a live connection status chip.
- **Guide** — this manual's working summary, inside the Console: the
  five-minute setup path, what every page does, the Local/Cloud split,
  and first-line troubleshooting. Served by the panel itself, so the
  instructions survive an internet outage.

<a id="first-api-request"></a>

## 6 · Push things from your own code — Today

Choose the panel's real address and copy the credential from **Dev console →
COPY WITH MY TOKEN**. The generated command contains a bearer token; the
placeholder command without that option currently quotes `$TOKEN` literally.
Use the working pattern below and replace both quoted placeholders:

```sh
export DMX_URL='http://dmx-xxxx.local'
export TOKEN='<your LAN token>'
```

Keep the token out of screenshots, public issues, and committed files.
A normal token grants full device control; it is not read-only. Full route list:
[firmware/dk01/README.md](../firmware/dk01/README.md).

**Text** (up to 300 s on screen):

```sh
curl --fail-with-body -H "Authorization: Bearer $TOKEN" \
     -H 'Content-Type: application/json' \
     -d '{"text":"SHIP IT","duration_s":30}' \
     "$DMX_URL/api/v1/display/text"
```

Expect HTTP success, a JSON response, and **SHIP IT** on the panel. If you
get `401`, pair again and replace the token. For longer JSON or text containing
apostrophes, save the request in `message.json` and use `--data-binary @message.json`
in place of `-d`; the current Console command generator does not escape shell
apostrophes correctly.

**Multi-line boards:** embed `\n` in `text` and the panel switches to a
tiny 3×5 font — up to 5 rows of 16 characters, perfect for tabular
boards like the flights list.

**Full frames:** `POST /api/v1/display/frame` takes one 64×32 frame as
4096 bytes of RGB565 (little-endian), base64-encoded in `{"b64":…}`. Host
apps can add `"lease_ms":3000`; each new frame renews the lease, and the
panel returns to its own rotation if the host disappears.
Today frames use REST, never MQTT (ADR-0029). WebSocket streaming is
**Ahead · gate M1**. The host bridge limits pushes to approximately 15 fps;
actual sustainable throughput depends on network and firmware load.

**Also useful:** `display/brightness` (10–150), `display/clear`,
`identify` (flashes the panel so you can find it), `health` (open, no
token — good for monitoring).

<a id="app-types"></a>

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

<a id="host-apps"></a>

## 8 · Flights Overhead — Today (host app)

The **on-device Flights list** needs only the panel and your local receiver:
enter its `aircraft.json` URL in **Apps → Flights list**, enable it, and save.
Use the host app below when you want the animated radar or host-rendered list.

The host app shows aircraft your own ADS-B receiver hears — a list, or an
animated radar with altitude-colored aircraft, comet trails, runways,
and green landing strobes. Local receiver only, by design
([docs/VISION.md](VISION.md) — never a company feed).
The radar view pushes raw frames, so it is frame-layer and same-LAN in
Local Mode; Cloud Mode's paid relay (**Ahead · gate C1**) is the only
remote path (ADR-0029).

**You need:** a receiver on your LAN speaking the open
dump1090/readsb `aircraft.json` format (a PiAware Pi qualifies), plus
any always-on machine with Node 18+.

1. Console → **Apps** → **Flights list** → type your receiver's
   `aircraft.json` URL. The panel never scans your network (ADR-0032) —
   it only talks to addresses you give it. Don't know the URL?
   **COPY FINDER PROMPT** on that card puts a step-by-step request
   on your clipboard for any AI assistant: it walks
   through your router's connected-devices list (names like `piaware`
   or `raspberrypi`) and browser checks of the standard paths
   (`http://IP:8080/data/aircraft.json`,
   `/skyaware/data/aircraft.json`, `/tar1090/data/aircraft.json`) —
   no scanning tools anywhere.
2. Set interval, rows, format, and List or Radar. Save — the config
   lives on the device, and any host machine obeys it.
3. The Flights list card prints your exact run command under **OPTIONAL
   RADAR HOST COMMAND**. It looks like:

   ```sh
   DMX_URL='http://dmx-xxxx.local' DMX_TOKEN='<your LAN token>' \
     node examples/flights-overhead.mjs
   ```

4. Flip List/Radar from the Console while it runs — no restart needed.

**Current stale-data limitation:** after a receiver outage the radar can keep
showing the last aircraft while continuing to renew its display lease. A
moving or populated radar is not proof of fresh receiver data. Check the host
logs and receiver URL; stop the host process to return control to the panel.

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
and uninstall. Re-running the installer updates its files. On Linux, an
already-running service also needs `sudo systemctl restart dmx-flights.service`
to load the changes; the macOS installer restarts its agent automatically.

Service paths, file formats, and installer limitations are owned by
[examples/README.md](../examples/README.md). Current Linux units run as root;
use the foreground command under your own user while evaluating the host app.

### The Pixlet bridge

The owner-hosted Pixlet bridge runs the open-source, Tronbyt-maintained
Pixlet engine and community catalog on **your** always-on machine, then pushes
the rendered 64×32 frames straight to the DK-01. The company renders, proxies,
and stores nothing for this feature (ADR-0030).

**You need:** Node 20+ on the always-on machine, plus your own API
keys for any apps that call outside services. One command fetches the
rest — the [Tronbyt Pixlet](https://github.com/tronbyt/pixlet) engine
(sha256-pinned download), the
[community apps catalog](https://github.com/tronbyt/apps), the
bridge's one pinned GIF-decoder dependency — writes a starter config,
and checks it can reach your panel (the Console's Pixlet card copies
this with your panel's address filled in):

```sh
git clone https://github.com/JFForsythe/devmatrix
node devmatrix/examples/setup-pixlet.mjs --device http://dmx-xxxx.local
```

**Prefer a browser to a JSON file?** Pixlet **Easy Mode** wraps the whole
loop in a local page — search the catalog, fill an app's settings in a
form, preview the exact 64×32 result, pair with the panel by claim code,
test-push one animation cycle, and build the rotation:

```sh
node devmatrix/examples/pixlet-manager/manager.mjs
```

It binds to `127.0.0.1` only, edits the same `~/tronbyt/bridge.config.json`
the bridge reads, and keeps the LAN token in a mode-`0600` secret file next
to the config — never in the JSON. Install the rotation as a background
service with the installer below, exactly as before.

Prefer assembling the pieces by hand? The step-by-step path is in
`examples/pixlet-bridge/README.md`.

Continue with the [Pixlet bridge walkthrough](../examples/pixlet-bridge/README.md)
for a verified starter app, foreground run, background service, and config
reference. Use `dvdlogo` for the first local render; each community app has
its own settings and API-key requirements.

**Two different actions:** saving in Easy Mode writes the rotation config;
an already-running bridge must be restarted to pick it up. Pairing Easy Mode
also does not automatically populate the service installer's token. The
[examples guide](../examples/README.md) explains the secret files and explicit
`--config` path so all components use the same setup.

Raw frames stay on the LAN (ADR-0029). Community app compatibility, data
sources, and continued maintenance vary; the company operates no Pixlet service.

<a id="update-firmware"></a>

## 9 · Update firmware over the air — Today

1. Build the new `.bin` (chapter 2) — or take a published release
   artifact once releases begin (**Ahead · M0**, signed).
2. Console → **Deploy** → **OTA upload** → choose the `.bin` → **UPLOAD
   & REBOOT**. It writes to the inactive slot and reboots into it; the
   Dashboard shows the new version and slot. Wait for the actual device to
   return, reload the Console, verify the reported version, and send a test
   message. A progress bar finishing is not proof the new image booted.

**Honest limits, today:** images are length/magic-checked but not yet
signature-verified, and rollback on a failed boot is not automatic —
both are M0 acceptance work. Until then, chapter 10 is the safety net.
([firmware/dk01/README.md](../firmware/dk01/README.md) owns these
caveats.)

<a id="recovery"></a>

## 10 · Recovery and resets — Today

Choose the least destructive action that solves the problem:

| Action | How | What it wipes |
|---|---|---|
| Reboot | Dashboard → **REBOOT**, or `POST /api/v1/reboot` | nothing |
| Change Wi-Fi | Security → **CHANGE WI-FI…** (`wifi/reset`) | Wi-Fi credentials only — token and config survive |
| Rotate the token | Security → **ROTATE LAN TOKEN** | every paired browser/script credential |
| Factory reset | Security → **FACTORY RESET** (`factory/reset`) | everything in NVS: Wi-Fi, token, timezone, MQTT credentials, flights config |
| Factory reset over USB | `esptool` NVS erase — first section below; needs no token and no Console | same as factory reset |
| USB recovery | Double-press the board's reset button — it mounts as a USB drive; drag a UF2 firmware file on | nothing by itself — reflashes firmware |

The TinyUF2 factory partition survives every OTA, so USB recovery is
always there even if both app slots are bad. Physical access is the
recovery tool — by design ([docs/SECURITY.md](SECURITY.md)). To turn a
compiled `.bin` into the UF2 file the drive wants, follow
[firmware/dk01/README.md](../firmware/dk01/README.md) → "USB recovery
(make a UF2)". A full-chip erase or an incompatible partition/bootloader flash can
remove TinyUF2 — **Back to default** below covers when that is worth
it and how everything comes back.

### Factory reset over USB — no Console, no token

Lost the LAN token, wrong Wi-Fi saved, picked up a used board, or the
Console is simply unreachable? You never need the token to start over.
Every setting the device holds lives in one small flash region — NVS
([docs/FIRMWARE.md](FIRMWARE.md) → Hardware budget owns the flash
map): Wi-Fi credentials, LAN token, identity key, timezone, MQTT
settings, app config. Blank NVS *is* the out-of-box state, and the
firmware in both app slots stays untouched.

1. Install the flasher once: `python3 -m pip install --upgrade esptool`.
   The commands below use esptool **v5** spellings — an older v4
   install writes them with underscores (`erase_region`) and rejects
   these, so upgrade rather than reuse a stale install.
2. Connect only the board you intend to reset. Run `arduino-cli board list`
   and identify its exact port (for example `/dev/cu.usbmodem1234` on macOS
   or `/dev/ttyACM0` on Linux). In the commands below, replace
   `/dev/cu.usbmodemXXXX` with that exact port; do not use a wildcard.
   Close serial monitors before continuing. These offsets apply only to the
   documented DK-01 partition map, not arbitrary forks.
3. Erase exactly the settings region (offsets from the flash map):

   ```sh
   python3 -m esptool --port /dev/cu.usbmodemXXXX erase-region 0x9000 0x5000
   ```

4. Tap the reset button. The panel comes back factory-fresh —
   `SETUP: JOIN DEVMATRIX-XXXX` — and chapter 3 takes it from there.

The identity key is minted fresh on the next boot, so browsers that
paired before will show the identity warning — that is chapter 13's
"key mismatch" row behaving exactly as designed: **FORGET / SWITCH
DEVICE…**, then pair again.

### Back to default — the complete re-flash

"Make it exactly like a fresh one" is two independent resets — pick
the ones you actually need:

- **Settings to default:** the USB factory reset above (or Security →
  **FACTORY RESET** while the Console still works).
- **Firmware to a known version:** chapter 2's cable flash, or the UF2
  drag-and-drop from the ladder above — either writes the build you
  chose over whatever was running.

Doing both, in either order, is a complete return to stock. There is
usually no reason to erase the whole chip — but for the true
zero-mile state, or a flash you no longer trust:

```sh
python3 -m esptool --port /dev/cu.usbmodemXXXX erase-flash
```

then run chapter 2's cable flash. One upload restores everything the
erase removed — bootloader, partition table, app, **and the TinyUF2
factory partition** ([docs/FIRMWARE.md](FIRMWARE.md) → Hardware
budget). Know what you are choosing: between the erase and a completed
upload the board has no firmware and no UF2 drive, and only the cable
path brings it back. Never-brick still holds — the serial flasher the
cable talks to lives in the chip's ROM, not in flash — but don't
full-erase unless chapter 2's toolchain is already set up.

### Tips from the bench

Hard-won on real boards; each of these looked like a dead unit until
it wasn't.

- **Dark panel, no hotspot, but the USB port shows up** — the board is
  probably stranded in the ROM download mode, not broken. An
  interrupted flash, or any serial tool that toggles the port's
  DTR/RTS lines while opening it, can park the board there: dark on
  the LAN, alive on USB. Any esptool command that ends with a hard
  reset frees it:

  ```sh
  python3 -m esptool --port /dev/cu.usbmodemXXXX --after hard-reset chip-id
  ```

- **Serial monitors lie on this board.** The S3's USB serial port
  re-enumerates on every reset, so a monitor you hold open goes
  silently dead instead of erroring — and you miss the boot lines you
  were waiting for. Reopen the monitor *after* each reset, and close
  it completely before flashing (the port is exclusive-open).
- **A "dead" board is often your own Wi-Fi.** Laptops and phones roam
  between networks, and guest networks isolate clients from each
  other. Before touching the hardware, check which network *your
  computer* is on — `dmx-xxxx.local` only resolves from the network
  the panel joined.
- **Recheck the port after reconnecting.** macOS can assign a new port
  after reset. Use `arduino-cli board list` and select the intended board
  explicitly, especially with more than one USB device attached.
- **Experiments are cheap.** After every OTA the previous firmware is
  still in the other app slot (the Dashboard shows which slot is
  live). Do not assume the previous slot will boot automatically: keep the
  cable, compatible firmware, and recovery instructions available.

## 11 · Home Assistant and MQTT — Today

MQTT is optional and the broker is yours. The company never operates one,
and leaving the host empty keeps the device's MQTT client completely off.

1. Run a broker you control, such as Home Assistant's Mosquitto add-on or
   Mosquitto on a Pi.
2. Create one broker user for this device and scope its ACL to the device's
   `devmatrix/<serial>/#` tree, Home Assistant discovery writes, and the
   `homeassistant/status` birth topic.
3. Console → Settings → **MQTT broker**. Enter the broker hostname or IP,
   port (1883 by default), username, and password. For the current verified
   path use a trusted LAN/VPN broker without the TLS toggle; see the TLS
   limitation below. Turn on **ENABLE MQTT**, then **SAVE MQTT**.
4. Watch the card's status move through **CONNECTING** to **CONNECTED**.
   The password is write-only: a blank password field leaves the saved value
   unchanged, and entering a value replaces it.
5. With Home Assistant's MQTT integration and discovery enabled, the device
   publishes retained light-brightness, text, and notify configs with its
   availability topic. Home Assistant can control them with **zero YAML**.
6. **Prove it from any terminal** — optional. With the
   `mosquitto-clients` tools and the broker user from step 2, watch the
   device's own topic tree; the retained availability, display, and
   health state appear immediately. The examples use the canonical
   serial `DMX-4E71-0952` — yours is on the Console's Devices page:

   ```sh
   mosquitto_sub -h <broker> -u <user> -P '<password>' -v \
     -t 'devmatrix/DMX-4E71-0952/#'
   ```

   Then push text through the broker. Every request is enveloped JSON —
   a UUID, a `Z`-suffixed UTC timestamp, and a short expiry so a stale
   queued command can never replay
   ([contracts/mqtt.md](../contracts/mqtt.md) owns the envelope):

   ```sh
   mosquitto_pub -h <broker> -u <user> -P '<password>' \
     -t 'devmatrix/DMX-4E71-0952/request/display.text' \
     -m "{\"v\":1,\"id\":\"$(uuidgen)\",\"ts\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"expiry\":30,\"payload\":{\"text\":\"VIA MQTT\"}}"
   ```

   The panel shows the text, and the device answers on
   `devmatrix/DMX-4E71-0952/response/<that id>`. The other implemented
   request verbs today are `display.brightness`, `display.clear`, and
   `app.show`.

MQTT TLS is not yet a verified working feature: the current client has no
broker CA configuration, and the reviewed SDK is expected to reject that
setup. Use a broker over a trusted LAN or VPN while CA support and hardware
TLS acceptance remain open. The exact topics, envelope, QoS/retain rules,
per-device Mosquitto ACL, and the broker WebSocket listener needed by a
browser MQTT workbench are in
[contracts/mqtt.md](../contracts/mqtt.md) (DRAFT until the P2 freeze).

## 12 · Remote control — Today and Ahead

- **Your own infrastructure, free:** put the LAN behind your own
  VPN/Tailscale ([docs/MODES.md](MODES.md) → owner-hosted remote), or
  point the device and a remote host app at a broker they can both reach.
  Today's MQTT semantic commands cover text, brightness, clear, and app
  selection; raw frames never ride a broker (ADR-0029).
- **Cloud Mode — offered only if demand requires it:** a paid relay,
  fleet view, alerts — optional, and the box never
  depends on it. [docs/MODES.md](MODES.md) is the line.

<a id="troubleshooting"></a>

## 13 · Troubleshooting — Today

| Symptom | Fix |
|---|---|
| Captive portal never opened | Browse to `http://192.168.4.1` while on the `DEVMATRIX-XXXX` network |
| `dmx-xxxx.local` not found | Your network (or an Android browser) blocks mDNS — use the panel's IP address instead; it works everywhere the name does. Your router's client-device list shows the panel as `dmx-xxxx`; any already-connected Console also shows the IP on the Dashboard's device info |
| Panel is unreachable after a router outage | Restore the router, check the panel's address and your computer's network, then power-cycle once if necessary. If boot cannot join Wi-Fi, firmware can reopen its setup hotspot; follow chapter 3 on a trusted network |
| My Wi-Fi isn't listed in the setup portal | The board's radio is 2.4 GHz-only, so a 5 GHz-only network can't appear. Enable a 2.4 GHz band or guest SSID on your router, then rescan |
| The setup page closed before I finished | Rejoin the `DEVMATRIX-XXXX` hotspot and it reopens (or browse to `http://192.168.4.1`). If the hotspot is gone, the panel already joined your Wi-Fi and is showing its address — chapter 3, step 5 |
| Hosted Console can't reach the panel | Check both devices are on the same LAN and browser/OS local-network permissions allow access. Open the panel's own HTTP address directly if the hosted path fails |
| Settings never loads and I cannot switch an offline device | Current UI bug: the switch control waits for the offline device. Open the correct panel's address directly. For the hosted Console, clear site data for that Console origin in browser settings, then reload and pair again; this removes that origin's saved token/key, not device settings |
| Identity warning (key mismatch) | A factory reset (Console or USB settings wipe) legitimately changes the device key — an ordinary firmware update does not — Settings → **FORGET / SWITCH DEVICE…**, then reconnect and re-pair. If you did not intentionally factory-reset it, stop and check what is answering on that address; an ordinary OTA does not justify a new key |
| `401 unauthorized` | Stale token — re-pair (chapter 4) or re-copy from the Dev console view |
| Panel resets at high brightness | Under-powered supply. The 150 cap exists for this; the Dashboard's reset-reason tile confirms a brown-out |
| Clock is wrong or shows `--:--` | Check Settings → timezone and SNTP reachability. The current firmware cannot set time manually or select a local time server; cold boot without public SNTP leaves time unavailable |
| Weather / Flights list / any fetching app shows only the clock | The app has no usable data and is telling you why: check **`GET /api/v1/apps/diag`** (or run `node examples/dmx-top.mjs`) — `too-big` means the feed outgrew the fetch buffer (point the URL at the raw `aircraft.json`, not a dashboard page that wraps it), `no-url` means set the receiver URL, `connect-failed` means the source is unreachable, `http-…` means it answered with an error (check the path), `no-aircraft`/`bind-miss` means the feed answered but held nothing to render |
| Apps → Flights list saves but the radar shows nothing | The host script isn't running — chapter 8; check `systemctl status dmx-flights` |
| MQTT stays disabled | Turn on **ENABLE MQTT** and enter a host; an empty host deliberately keeps MQTT off |
| MQTT shows error | Check the broker address, port, per-device username/password and ACL from chapter 11; pre-P2 TLS also requires a trusted network path |
| Home Assistant did not discover the device | Confirm MQTT says connected and Home Assistant publishes `online` to `homeassistant/status`; then check the discovery-write ACL in the contract |
| Upload port busy while flashing | Close any serial monitor — the port is exclusive-open |
| Panel dark, no hotspot, but the USB port shows up | Probably stranded in ROM download mode, not dead — chapter 10 → Tips from the bench frees it with one esptool command |
| Serial monitor went silent after a reset | The S3's USB serial re-enumerates on every reset — reopen the monitor afterward; close it before flashing |
| Lost the token *and* the panel or its Wi-Fi is unreachable | Chapter 10 → Factory reset over USB — no token needed, then set up again |
| Nothing works at all | USB recovery (chapter 10), then set up again — setup data is five minutes to recreate |

## 14 · Rules this manual follows

Facts belong to their owner docs — this manual only walks you through
them. If this file ever contradicts [docs/PORTAL.md](PORTAL.md),
[docs/MODES.md](MODES.md), [docs/SECURITY.md](SECURITY.md),
[docs/FIRMWARE.md](FIRMWARE.md), or an ADR, the owner doc wins and
this manual gets fixed in the same change.
