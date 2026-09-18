# Devmatrix — Dev Kit by FlightTrackerLED

[![Repository checks](https://github.com/JFForsythe/devmatrix/actions/workflows/ci.yml/badge.svg)](https://github.com/JFForsythe/devmatrix/actions/workflows/ci.yml)

An open, programmable **64×32 LED display** for your desk, workshop, or
homelab. Put a message on it, draw pixels in your browser, connect Home
Assistant, or write an app using the local HTTP API.

The device serves its own web interface, the **Console**. Basic control needs
no phone app, account, subscription, or company server. Apps that fetch
outside data still need their data source; community Pixlet apps also need a
computer you keep running. [Local Mode](docs/MODES.md) explains those boundaries.

## Start here

| Your situation | Next step |
|---|---|
| I have an assembled kit | Follow the [owner's manual](docs/MANUAL.md#first-boot); skip compiling |
| I want to try it before getting hardware | Open the [Console](https://devmatrix.flighttrackerled.com) and choose **EXPLORE THE INTERACTIVE DEMO** |
| I have a bare MatrixPortal S3 and panel | Use the [pinned build and wiring guide](firmware/dk01/README.md) |
| I want to write code or connect another service | Start with [your first API request](docs/MANUAL.md#first-api-request), then the [REST reference](contracts/rest.md) |
| I want community apps, flights, or a background service | Choose a path in [examples/README.md](examples/README.md) |
| Something stopped working | Use [troubleshooting](docs/MANUAL.md#troubleshooting), then [recovery](docs/MANUAL.md#recovery) |

## What works, and what is still being built

The current implementation and version are recorded in the
[firmware guide](firmware/dk01/README.md). Hardware evidence is indexed in
[hardware/README.md](hardware/README.md); a successful build is not proof of
production qualification. [ROADMAP.md](ROADMAP.md) owns acceptance gates.

| Available in the current implementation | What it needs |
|---|---|
| Messages, native clock, brightness, app rotation | The panel; clock time needs SNTP after a cold boot |
| Browser paint canvas and text/frame HTTP API | A browser or script on the LAN |
| Custom JSON layouts and a weather starter | The device fetches your configured source; outside sources need internet |
| MQTT and Home Assistant discovery | Your own broker; see the [MQTT contract](contracts/mqtt.md) for current limits |
| Flights list | Your own local ADS-B receiver |
| Animated flights radar | Your receiver and a computer running the host app |
| Pixlet community apps and Easy Mode | An always-on computer running the [bridge](examples/pixlet-bridge/README.md); compatibility varies by app |
| Manual firmware OTA and USB recovery | A compatible image and the [update/recovery instructions](docs/MANUAL.md#update-firmware) |

**Still ahead:** signed OTA and qualified automatic rollback, live Mirror,
scoped credentials, device naming/fleet management, browser USB flashing,
owner signing-key enrollment, `.dmapp` installation, and the Devmatrix
Registry. These are specified features, not controls available today.
Managed Cloud Mode is a possible future offer, [only if demand requires it](docs/MODES.md).

This remains development firmware with open security and reliability work.
Use it on a trusted network. Read the [current security limits](docs/SECURITY.md)
and [full repository review](docs/reviews/2026-09-08-full-review/README.md)
before evaluating it for deployment or sale.

## First message on an assembled kit

1. Power it with the correct 5 V supply for your assembly. Follow the panel's
   **SETUP: JOIN DEVMATRIX-XXXX** instruction.
2. Join that hotspot and choose your **2.4 GHz** Wi-Fi network. If the setup
   page does not open, visit `http://192.168.4.1` while joined to the hotspot.
3. Rejoin your normal Wi-Fi and open the exact `http://dmx-xxxx.local/`
   address displayed on the panel. If `.local` fails, use its IP address
   from your router. Pair by entering the six digits on the panel if asked.
4. Open **Apps → Messages**, type a short message, and press
   **PUT IT ON THE PANEL**.

Your words appearing on the physical panel are the success check. The
[manual](docs/MANUAL.md) covers pairing another browser, power, updates,
configuration, and recovery. The under-five-minute setup time is an
[acceptance target](ROADMAP.md), not a measured guarantee for every owner.

## Build an integration

From the repository root, after pairing your browser, use the token from
**Dev console → COPY WITH MY TOKEN**. Replace both placeholders below:

```sh
export DMX_URL='http://dmx-xxxx.local'
export TOKEN='<your LAN token>'
curl --fail-with-body -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"text":"SHIP IT","duration_s":30}' \
  "$DMX_URL/api/v1/display/text"
```

Expect a successful JSON response and **SHIP IT** on the panel. A `401` means
this token is missing or stale; pair again. The token controls the whole
device, so keep it out of screenshots, issues, and source control.

The [REST](contracts/rest.md), [MQTT](contracts/mqtt.md),
[layout](contracts/layout.md), and [OTA](contracts/ota.md) references describe
the implemented subset separately from their draft targets. Contracts remain
**DRAFT** until P2; no stable SDK or WebSocket implementation is shipped here.

## Work on the project

Read [AGENTS.md](AGENTS.md), then choose the relevant owner document below.
Firmware builds use the exact commands in the
[firmware README](firmware/dk01/README.md); Console development uses the
[Console README](portal/console/README.md).

```sh
make check             # repository rules and tooling tests
make console-verify    # install pinned deps, typecheck, rebuild, compare artifacts
```

`make check` does not compile firmware or exercise a physical panel. The
[CI workflow](.github/workflows/ci.yml) also compiles firmware and rebuilds
both Console targets. The old mock design reference is available through
`make portal`; it includes future features and is not the production Console.

There is one Console codebase at `portal/console/`, built for hosted and
device use. Generated artifacts are committed; edit source and regenerate
them, as described in its README. Hosting and release verification are owned
by [docs/OPERATIONS.md](docs/OPERATIONS.md).

## Documentation map

| Topic | Owner |
|---|---|
| Setup, daily use, troubleshooting, recovery | [Owner's manual](docs/MANUAL.md) |
| Product, audience, promises, clean-room boundary | [Vision](docs/VISION.md) |
| Local operation, optional Cloud, support | [Modes](docs/MODES.md) |
| Console behavior and planned interface | [Console specification](docs/PORTAL.md) |
| Authentication, keys, current security limits | [Security](docs/SECURITY.md) |
| Firmware architecture and hardware budgets | [Firmware](docs/FIRMWARE.md) |
| Public interfaces | [Contracts](contracts/README.md) |
| Host apps and service installation | [Examples](examples/README.md) |
| Hardware procedures and dated evidence | [Hardware](hardware/README.md) |
| Delivery gates and production blueprint | [Roadmap](ROADMAP.md), [plan snapshot](docs/PRODUCTION-PLAN.md) |
| Decisions and canonical terminology | [ADRs](docs/adr/README.md), [glossary](docs/GLOSSARY.md) |
| Target buyer journey and shared demo identifiers | [User story](docs/USER-STORY.md) |
| Bugs, review coverage, and product opportunities | [September repository review](docs/reviews/2026-09-08-full-review/README.md) |

## Licensing and independence

First-party code is GPL-3.0-or-later under [LICENSE](LICENSE); documentation
is CC BY 4.0. Contracts/SDK code and hardware files follow the scheme in
[ADR-0010](docs/adr/ADR-0010-license-scheme.md).

Devmatrix is independently built. Its local receiver app uses the owner's
own data; no closed-product code, logic, schemas, or assets cross into this
repository. [VISION.md](docs/VISION.md) owns that boundary.
