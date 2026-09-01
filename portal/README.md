# Console design reference

A **design prototype** of the Devmatrix Console: one self-contained
`prototype/index.html` — inline CSS, vanilla JS, mock data, zero
dependencies, zero network calls, and readable local system-font stacks.
Under [ADR-0027](../docs/adr/ADR-0027-one-console-codebase.md), this is a spec to
react to, not the production Console foundation.

## Run it

Hosted URL: **https://devmatrix-console.vercel.app**. This mock remains
live until the coordinated cutover. The hosting state and cutover recipe
are owned by [docs/OPERATIONS.md](../docs/OPERATIONS.md); the
developer-side handoff steps live in
[`console/README.md`](console/README.md#vercel-handoff).

```sh
make portal            # from the repo root → http://localhost:8787
# or just open portal/prototype/index.html in a browser
```

Theme switcher lives in the top bar: paper (default), solarized
light/dark, nord, dracula, gruvbox — persisted per browser.

## What to look at

- **Welcome / claim ceremony** — what Maya sees at T+3 min (skip with
  "Explore the demo"). Enter the address and code shown on the panel,
  verify the session code, name the device, and send the tokenized first
  text command. Only after that success does it offer the primary
  **Local Mode** path or a clearly optional paid Cloud preview.
- **Dashboard → Mirror** — the simulated 64×32 panel is live; type in
  "Push text" and watch it scroll. Brightness slider and scene chips
  work. Quick action "Screenshot" downloads the actual framebuffer.
- **Deploy** — switch the channel to `beta` and run the update to see
  the staged progress + history; note the auto-rollback entry.
- **Dev Console → Playground** — `POST /display/text` really drives the
  Mirror.
- **Search** — use the top-bar control or `Cmd/Ctrl+K` to find pages,
  devices, apps, keys, settings, and developer tools.
- **Dev Console → Device workbench** — four compact CLI panes start as
  REST, MQTT, device logs, and a layout/binding inspector. Change any
  pane's profile; drag
  or use its arrow controls to reorder it; remove and restore panes. The
  layout persists in the browser, but commands remain safe mock behavior.
- **Per-device access truth** — switch devices or disconnect a device's
  relay in Security. The mode chip, API target, MQTT root, workbench,
  snapshots, and actions all follow the selected device; unavailable
  commands return a visible mock 503 instead of reporting false success.
- **Security** — passkeys, root-of-trust enrollment state, Local Mode,
  E2EE Snapshots, audit export (downloads real JSON), Eject.
- Switch to **Guest Loft** in the top bar to see the offline treatment.

## Deliberately fake

Everything. No backend, no real device, no WebSerial. Buttons that
would need hardware or cloud say so in a toast. Mock identifiers match
docs/USER-STORY.md exactly (drift rule in AGENTS.md). Sparkline/status
colors were validated with the dataviz palette checker against this
surface (`#0e141b`).
