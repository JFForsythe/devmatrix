# Product opportunities and suggested order

These are recommendations from the 2026-09-08 review, not accepted product
decisions or promises. [VISION.md](../../VISION.md) owns positioning;
[ROADMAP.md](../../../ROADMAP.md) owns gates. New architecture or commercial
commitments need the normal ADR process. Effort below is relative engineering
judgment, not a delivery estimate or measured customer demand.

## The strongest product promise

Make Devmatrix the desk display a developer can understand and customize in
one sitting: plug it in, put something personally useful on it, inspect how it
works, and keep it working without the company.

The existing first-message action, JSON layouts, local API, and Pixlet bridge
already support this direction. Reliability and an understandable first use
are more valuable next steps than a larger feature list. A demo that names
future features as if they work damages the promise.

## Suggested sequence

| Priority | Improvement | Why an owner would care | Build from | Relative effort | Acceptance experiment |
|---|---|---|---|---|---|
| 1 | Close authentication, setup-token, OTA, stale-data, and fetch-blocking findings | Connecting and updating the panel should not create surprises | Findings in this review | Medium–large | Negative auth tests, outage fixtures, signed-image rejection, destructive recovery trials on designated boards |
| 2 | Make first use one guided path with a visible success check | Owners know when they are done and where to go next | Welcome, Apps → Messages, manual | Small–medium | Nine of ten independent owners get their own message on the physical panel in under five minutes, per M1 |
| 3 | Offer three small, documented starter experiences | A concrete use is easier to choose than a giant catalog | Messages, custom layout, REST/MQTT | Small–medium | A desk message/timer, build-status indicator, and local service-health display; each states prerequisites, source freshness, and failure behavior |
| 4 | Put “why is my panel blank?” in the Apps page | Owners should not need a terminal to diagnose a URL or empty feed | Existing `/api/v1/apps/diag` and rotation state | Small–medium | Simulate no URL, large body, HTTP error, stale feed, missing binding, and inactive scene; show one accurate cause and next action for each |
| 5 | Make Pixlet setup, pairing, and service installation share one config | The richest feature should not fail between its fifth and sixth step | setup script, Easy Mode, bridge, installers | Medium | Fresh-user install through reboot, with custom path, token rotation, offline source, save/reload, and uninstall; no repeated secret copying |
| 6 | Save and restore a complete useful configuration | Experimenting becomes comfortable when a working setup is recoverable | NVS settings and planned snapshot/export work | Medium | Export, factory-reset a designated test unit, restore, and compare settings; handle secrets explicitly and schema-version migrations |
| 7 | Make API learning tangible with an accurate preview | Owners can see the connection between JSON and pixels | Paint canvas, layout parser, proposed simulator/golden renderer | Medium–large | A small corpus of layout fixtures renders byte-identically in preview and firmware; label estimates until equivalence is proven |
| 8 | Give every firmware release a recovery kit | Forking and updating feel owned, not improvised | Compile job, TinyUF2, release plan | Medium | Exact tested binary, UF2, source tag, hashes, known issues and one recovery page; clean-machine recovery with company domains blocked |

## Three starter experiences to test first

**A quiet desk companion.** Rotating personal messages plus a focus timer and
scheduled dimming. Messages already work; timer/quiet-hours controls would be
new work. It demonstrates value without a data provider or second computer.
Measure whether owners still use it after a week, not just whether the first
animation looks good.

**A homelab status display.** A host script translates service health into one
short line or a simple red/amber/green indicator. Use the semantic API and
short-lived content; always show “unknown” when the source stops. Never turn
stale success into a reassuring green display. This uses the product's
existing local API without requiring a company dashboard.

**A build or deployment result.** An owner-operated runner posts success,
failure, or a short queue status. A token with narrow display permission is a
prerequisite for safe sharing into CI; today's full-device token is too broad
for a polished third-party integration. Show an event timestamp and an expiry
so yesterday's build cannot masquerade as today's result.

These are hypotheses to validate with owners. No pricing, adoption, or revenue
claim is inferred from the repository.

## Make the community catalog feel curated

The upstream [Tronbyt apps repository](https://github.com/tronbyt/apps)
publishes community apps and notes that apps vary in supported display size
and Pixlet features. That is useful breadth, not proof that every app works
on DK-01. Prefer a small tested selection showing:

- Runs on the panel or on an always-on host.
- Works offline or uses a named outside service.
- Requires an account/key, and where that key is stored.
- Last tested Pixlet version, app commit, and output dimensions.
- What appears when data is old or unavailable.

Start with one offline animation, one useful no-key data app, and one
owner-key app after the bridge's service/config defects are fixed. Make the
examples editable so the selection teaches owners how to make their own.
Do not rebuild a company rendering service to hide host requirements.

## Presentation changes worth making after correctness

Use the first screen to show a small number of useful actions. Put detailed
board statistics behind a diagnostics view while preserving developer access.
Keep **On the panel now**, but distinguish an app being selected from data
actually having rendered. Give the Messages first-use action a clear policy
for replacing a full eight-phrase list; today it can silently remove a phrase.

On a phone, the eight-link navigation consumes substantial vertical space.
A compact menu would get owners to the main action sooner. The review's
390×844 browser check found the layout readable, but it is not a substitute
for actual touch-device and accessibility testing. Keep offline recovery and
switch-device controls accessible even when every network request fails.

## Work to defer

Keep the demand-driven Cloud stance. First finish the local product, docs,
recovery, and qualification. Defer the on-device scripting VM, a paid relay,
and a large Registry launch until their existing gates and threat models
are satisfied. A small reliable set of owner-editable experiences is a
credible product; an unbounded app or cloud promise is an operating burden.
