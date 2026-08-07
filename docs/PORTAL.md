# The Console — portal spec

The Console is the product's face: one web app where an owner claims,
controls, extends, and — if they want — leaves. Every screen answers
three questions: *what is my box doing, can I change it, can I trust it?*

## Principles

1. **Local-first.** The same Console works in Local Mode (LAN, no
   account, free) and Cloud Mode (paid: remote, multi-site fleet,
   hosted snapshots). Cloud adds reach, never capability — the full
   split, pricing, and sunset covenant live in docs/MODES.md.
   (ADR-0003, ADR-0007)
   The complete Local Console is bundled with and served by each
   device. A public static copy may also provide docs, demos, and a
   convenient entry point, but it is never required to operate a box.
2. **Show, don't claim.** Live Mirror instead of a status dot. Audit log
   instead of "secure by design" copy. Rollback history instead of
   "reliable".
3. **Tenancy is absolute.** An account sees exactly its own devices.
   No global views, no shared anything, no "community presence" leaks.
4. **Every capability has an API.** Anything a button does, a documented
   `/api/v1` call or MQTT topic does too. The Console is a client, not
   a priesthood.

## Information architecture

| Nav item | Job to be done | Key modules |
|---|---|---|
| **Welcome / Claim** (first run) | From box to claimed in minutes | enter the panel's local address + claim code, verify the session code on-panel, possession proof, LAN token mint, prove first pixel over LAN, then make the explicit Local-free choice; optional passkey account and separately confirmed Cloud subscription (☁) |
| **Dashboard** | What is my box doing right now? | Mirror (live panel), quick text push, brightness, scene switch, stat tiles (uptime, heap, RSSI, temp), recent activity, firmware card, quick actions (screenshot, identify, reboot, quiet hours) |
| **Devices** | Manage my fleet (only mine) | Device cards, groups, claim-new flow, rename, transfer ownership, guest access (scoped links ☁), remove |
| **Apps** | Run my code on my box | Installed apps with status + permission chips + resource meters, upload (.dmapp drag-drop → OTA), template link, community Registry browse/install, per-app logs, rollback, delete |
| **Deploy** | Control what firmware runs | Current version + channel selector, update/rollback with history, staged rollout across fleet, USB flash from browser (WebSerial recovery), BYO builds (CI → signed with owner's enrolled key) |
| **Dev Console** | Integrate and debug | Device workbench (four minimal movable/resizable/removable/restorable panes profiled as REST, MQTT, logs, or app-runtime REPL), API keys (scoped, revocable), API playground, WebSocket event tail, MQTT credentials + topic tree (user's broker), metrics history, device file manager |
| **Security** | Trust, verify, own | Passkeys & hardware keys, active sessions, audit log (export), root-of-trust status + enrollment, Local Mode toggle, Snapshots (E2EE backup/restore/clone), privacy & data controls, Eject |
| **Settings** | Make it mine | Device name/timezone, network info, panel calibration, notifications (offline alerts ☁), plan & billing (Cloud), account |

Console-wide search is a combined search and command palette, available
from every post-claim screen and from the keyboard (`Cmd/Ctrl+K`). It
covers pages, settings, devices, installed apps, API keys, actions,
documentation, and local log results, then navigates to the matched
surface or runs the matched action. This is still the owner's
already-loaded Console state plus that device's local logs — never a
server-side or cross-tenant search service.

The Device workbench is intentionally smaller than a browser IDE. Its
job is fast integration and debugging against one selected box: run a
documented REST or MQTT command, inspect logs, or try the sandboxed app
REPL without hiding the underlying contracts. Panes are movable,
resizable, removable, and restorable, and the pane layout is saved
locally in that browser. Terminals are custom DOM components
(ADR-0014); the Console never exposes a general host shell, and the
prototype never executes arbitrary code.

One workbench constraint is decided before the P2 contract freeze: a
browser cannot speak raw MQTT TCP, so the MQTT pane either documents
the owner-broker WebSocket-listener requirement in the pane UI and
setup docs, or routes through the device's own MQTT client over the
multiplexed event socket. Deciding early keeps the pane from working
in the simulator yet failing against real brokers.

Console typography is the system UI stack at normal 400 weight, with
the native monospace stack for terminals; the Console never downloads
a font at runtime (ADR-0014).

## Five-minute first pixel

The Local path is the primary onboarding path and must fit on one
checklist:

1. Power the DK-01 and join WiFi over USB Improv or its setup SoftAP.
2. Read the local address and claim code shown on the panel.
3. Enter both in the Console; verify the short “CLAIM → 7F2Q?” session
   code on the panel and hold the physical button.
4. Name the device and push text with the tokenized curl command. See
   the first pixel change over the LAN; no account, checkout, or
   Devmatrix server is involved.
5. Continue in free Local Mode. Only after first-pixel success may the
   Console explain optional paid Cloud or owner-hosted remote access.

## The full-control inventory

Ways an owner has *actual* control, beyond the obvious. Each maps to a
tier from VISION.md and must survive into the real build.
(☁ = Cloud Mode, the paid layer — docs/MODES.md is the line.)

- **Push anything**: text, full frames, JSON layouts, notification
  overlays — from curl, HA, Node-RED, SDKs, or the Console.
- **Run anything (sandboxed)**: upload apps with explicit, visible
  permissions (net hosts, storage quota, message rate); kill-switch and
  resource meters per app.
- **Flash anything**: OTA channels, or browser USB flash of *any*
  firmware — including their own fork.
- **Own the root of trust**: enroll their own signing key (physical
  ceremony); their CI ships to their boxes.
- **Leave**: Eject wizard sets a self-hosted OTA manifest URL, exports
  Snapshots, links the self-host guide. No dark patterns.
- **See everything**: audit log of every action (human or automatic),
  exportable; live logs; metrics history; screenshot of the framebuffer.
- **Share safely**: locally, sharing is the LAN token — all-or-nothing,
  by design. Cloud ☁ adds guest access with narrow scopes and expiry.
  Ownership transfer with a clean handover (old owner's data purged).
- **Go dark**: Local Mode — cloud relay off, LAN-only; telemetry is
  opt-in and off by default; export-all and delete-all are one click.
- **Recover always**: Snapshots restore/clone; USB recovery flash works
  on a dead device; factory reset requires physical access.
- **Lose it safely ☁**: mark a device lost — relay access dies
  instantly, secrets wipe on next contact, LAN token / WiFi / MQTT
  credentials rotate in one click. Local-only, the recovery tool is
  physical access.
- **Fleet as config**: export a device's setup as a named config and
  apply it to a group — declarative, diffable, audit-logged.

## Architecture (modes)

```mermaid
flowchart LR
  subgraph LAN
    D[DK-01<br>full Local Console bundle]
    C1[Browser - Local Mode] -->|load Console + token /api/v1| D
    HA[Home Assistant / MQTT broker] <--> D
  end
  subgraph Cloud["Cloud (paid, optional)"]
    C2[Console - Cloud Mode] --> R[Relay + Fleet + staged rollout]
  end
  S[Static OTA manifest + signed binaries<br>CDN · free · self-hostable]
  D -->|outbound WSS only| R
  D -->|HTTPS poll| S
```

- Device never opens an inbound WAN port. Its LAN-only API serves Local
  Mode; Cloud Mode rides the device's outbound relay connection.
- Discovery is read-off-the-panel (address + claim code); the Console
  never scans a LAN. LAN auth is the LAN token; mTLS is device→relay
  only. See SECURITY.md → Discovery & local transport.
- The device serves the complete static Local Console, including setup,
  control, apps, deploy, developer tools, security, and Eject. The
  hosted Console is an optional distribution of the same client, not a
  dependency.
- The production stack is decided: Preact + TypeScript + Vite, one
  codebase for device-local and hosted-simulator modes (ADR-0014).
  The P1 browser-transport spike remains its acceptance gate: local
  name resolution, trustworthy HTTPS, secure-context requirements,
  Local Network Access permission, CORS, Host/Origin validation,
  token storage, and all target browsers. Ordinary page JavaScript
  cannot install or pin a device certificate.
- API contract: DRAFT contracts live in
  [contracts/](../contracts/README.md), including the per-transport
  capability descriptors; they freeze at gate P2 (ADR-0019).

## Non-goals

No social features, no public device pages, no ads, no telemetry by
default, no company-run MQTT broker, no accounts required for LAN use.

## Open questions

- Exact browser-to-device HTTPS trust/bootstrap design. This is a P1
  launch blocker, not copy to paper over. (The production stack itself
  is decided — ADR-0014 — with the P1 transport spike as its
  acceptance gate.)
- Domain/brand for the hosted Console; `devmatrix.example` is a
  placeholder everywhere until then.
- Enclosure question (bare panel vs stand) — affects photography, not
  software.
