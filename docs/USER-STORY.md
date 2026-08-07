# User story — the canonical example

This is the journey every design decision serves. Mock data in the
Console prototype uses these exact identifiers (see CLAUDE.md).

**Maya Chen**, 41. Sold her infrastructure company three years ago.
Runs a homelab she's mildly embarrassed about how much she loves. Buys
hardware the way she buys watches. Actively phished weekly; her threat
model is real. She ordered a DK-01 after a friend's demo.

## Day one

- **T+0:00 — Unbox.** Matte black panel, USB-C, a card that says only
  `devmatrix.example/start` and the serial `DMX-4E71-0952`. No app to
  install.
- **T+0:01 — Power.** The panel types its boot line (VISION.md owns
  the copy), then: `JOIN ME → DEVMATRIX-0952` — the setup hotspot.
  (USB Improv works too; either way, no app.)
- **T+0:02 — WiFi.** She picks her network in the captive portal. The
  panel now shows its address and claim code:
  `dmx-0952.local · H7Q-4KD`.
- **T+0:03 — Claim.** The start page asks for what the panel shows —
  it never scans her LAN (browsers can't, and shouldn't). Possession
  proof: the panel displays her session's code (`CLAIM → 7F2Q?`) and
  she **holds the button for two seconds**. The box is hers — claiming
  needs no account. The Console takes her straight to first pixel before
  it asks about any remote service.

*(Beats marked ☁ use Cloud Mode — the paid layer. Everything else is
Local and free; docs/MODES.md is the line.)*
- **T+0:04 — First pixel.** She names it **Study**. The Console
  dashboard shows the Mirror — her actual panel, live. The quickstart
  hands her a copy-paste command with her LAN token already embedded:
  `curl -X POST https://study.local/api/v1/display/text -H
  "Authorization: Bearer dmx_lan_…" -d '{"text":"SHIP IT"}'`
  — and SHIP IT scrolls across the physical panel. She grins. Under
  five minutes, as promised.
- **After success — optional reach.** Only now does she add a passkey
  account and explicitly confirm the paid Cloud plan (Touch ID ☁),
  because she wants the chalet in one view later. No password exists to
  steal, and declining would leave the working Local product unchanged.

## Week one

- Installs **GitHub Stars** from the community Registry (one click,
  installed over the air in seconds; the permission sheet shows exactly
  what it may touch: `net: api.github.example`, `storage 4 KB`).
- Home Assistant discovered the device the moment she enabled MQTT —
  zero YAML. Brightness follows her house's evening scene.
- Writes her own app from the template — Mars weather, 120 lines —
  drags the `.dmapp` onto the Console, watches it deploy OTA in under
  two minutes. Sets quiet hours (23:00–07:00).
- Adds her YubiKey as a second account passkey ☁. Reviews the audit
  log — every action, hers and the system's, timestamped. Exports it,
  because she can.

## Month one

- Buys two more: **Workshop** and one for the chalet, **Guest Loft**.
  The fleet view shows only her three, across both houses ☁ — tenancy
  is absolute.
- Grants her house manager **guest access** to Guest Loft: brightness
  and quiet hours only, expires in 90 days ☁.
- A beta firmware misbehaves on Workshop; the device **rolls back by
  itself** within a minute. The Console shows exactly what happened and
  when. Trust deepens rather than breaks.

## Month three — full ownership

- Forks the firmware, builds her own, flashes it **from the browser over
  USB**. It fails to boot on the second slot: automatic rollback again.
  She fixes her bug, reflashes. Never bricked.
- Runs the **root-of-trust enrollment** ceremony (device-local owner
  session + physical button hold; Cloud additionally requires passkey
  re-auth): her signing key joins the device. Her CI now ships signed
  builds to her own boxes through the Console ☁ (on the LAN, she could
  push the same builds herself — the cloud adds the convenience).
- Flips **Local Mode** on the chalet box. Everything still works with
  the company unreachable. She checked, because she would.
- She posts a photo of the Mars weather panel. Three of her group chat
  order one that night.

## What she never had to do

Install an app. Create a password. Open a port. Solder anything. Trust
us blindly. Ask permission to run her own code on her own hardware.
