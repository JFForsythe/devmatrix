# Console review — 2026-09-08

Reviewed baseline commit: `180f0572edebe133c7e7f22bf5b2c962dfee7f4b`.
Scope: every tracked file under `portal/`, including all Console source,
styles, configuration, lockfile metadata, generated-output integration, and
the historical prototype's markup, styles, and JavaScript. Related owner
docs and public contracts were used to check behavior. No closed-product
source or artifacts were accessed. No source, dependency, generated bundle,
or accepted ADR was changed by this review.

P1 means address before extending the public pilot or making the affected
security/reliability promise. P2 means a functional or usability defect to
fix in the next implementation pass. P3 means polish or reference cleanup.
Findings below remain open unless explicitly described as a documentation
correction. Static evidence establishes code paths; hardware/browser
acceptance is separate.

## Findings

### CON-01 · P1 · A changed target receives the previous device's bearer token

`portal/console/src/transport.ts:135–153` persists a `?device=` override,
loads the globally stored `dmx_token`, and enters live mode without calling
`connectDevice`. `request` attaches that token before any identity proof
(`:377–389`); firmware uploads also attach it directly (`:580–585`). Cached
reconnects follow the same unchecked path. A link to the hosted Console with
an attacker-controlled HTTPS target can therefore cause a saved LAN token
to be sent to that target if it permits the browser's CORS request.

**Verified in isolation:** a synthetic stored token and pinned key, a
`?device=https://example.invalid` override, and one `info()` call produced
one request to that new origin with the sentinel bearer token and zero
identity requests. `fetch` was replaced with a local stub; no real token or
network destination was used.

**Fix/acceptance:** namespace address, identity, and token by validated
device identity; treat a changed address as untrusted; prove continuity
before attaching secrets; block on a failed proof or changed pin. Test
query overrides, cached targets, address changes, malicious responses, and
OTA uploads. This closes the accidental credential disclosure path; it
does not solve active HTTP relay or page-tampering risks. Those architectural
limits belong to [SECURITY.md](../../SECURITY.md).

### CON-02 · P1 · Vulnerable Preact receives unchecked network values

`portal/console/package.json:20` pins Preact `10.27.2`. Network JSON is cast
to `T`, not validated (`src/transport.ts:398–414`); values such as
`health.fw`, `info.slot`, and `info.scene` render directly as children
(`src/views/DashboardView.tsx:225–233`). This matches the upstream JSON
VNode injection advisory's preconditions when a device response is
malicious or tampered with. The inline-script CSP in `index.html:16–19`
is not a strict inline-execution mitigation.

The read-only npm audit returned **4 affected packages: 2 high and 2
moderate**, including Preact. Upstream classifies Preact's issue as moderate
and lists `10.27.3` as the patched release on this minor line. No exploit
was executed. [Official Preact advisory](https://github.com/preactjs/preact/security/advisories/GHSA-36hm-qxxp-pg3m).

**Fix/acceptance:** upgrade to a reviewed patched version, regenerate both
artifacts, and validate response shapes at the transport boundary. Supply
objects, arrays, nulls, malformed JSON, and missing properties where strings
or numbers are expected; they must produce a recoverable error, never DOM
injection or a blank application. Audit output alone is not proof of an
exploit on a deployed device.

### CON-03 · P1 · An unreachable saved device hides its own recovery control

Settings loads info, preferences, and MQTT together; one rejection prevents
info/settings from being populated (`src/views/SettingsView.tsx:25–34`).
The entire address card, including **Forget / Switch device**, is inside
the successful-load branch (`:96–140`). Meanwhile a stored address bypasses
Welcome (`src/transport.ts:140–151`), and the shell only offers a connect
link when `needsWelcome` is true (`src/main.tsx:106–119`). This leaves an
owner who changed routers, moved a panel, or saved a bad address without a
visible way to change the target while it is offline.

**Fix/acceptance:** render connection target, change/forget, retry, and
read-only Guide actions independently of device reads. Test an unreachable
remembered host, HTTP errors, and an unsupported MQTT endpoint; switching
must work without clearing browser storage manually. Test after an IP
change and at a phone viewport.

### CON-04 · P2 · Pairing cannot recover cleanly from expiry or cancellation

`PairingFlow.tsx:27–29` ignores the returned remaining `expires_s` and
always says five minutes. Once started, `:99–123` exposes code entry but no
fresh-code action. Expired or locked-out codes therefore need cancellation
and another authentication failure to restart. `maxLength={6}` (`:111`)
also truncates pasted `123 456` before the `onInput` normalizer can retain
all six digits, contrary to the comment at `:38–40`.

Dashboard, Apps, and Settings continue polling while awaiting the same
pairing promise (`DashboardView.tsx:157–168`, `AppsView.tsx:87–91`,
`SettingsView.tsx:35–44`, `transport.ts:312–320,405–409`). Pending callers
accumulate and all retry when pairing succeeds; cancellation does not stop
the next poll from reopening the dialog. Leaving an expired modal open
thus has no bounded request queue.

**Fix/acceptance:** show remaining time, remaining attempts, and a clear
restart action; accept six digits with common separators; pause/coalesce
polls while pairing and honor cancellation until an explicit retry. Exercise
expiry, five failures, separator paste, cancel, and several minutes waiting
before pairing. At most one refresh per active resource should resume.

### CON-05 · P2 · Generated shell commands fail on ordinary content

`DevConsoleView.tsx:50–58` embeds the JSON body and URL in single quotes
without escaping embedded apostrophes. A text body containing `I'm home`
produces invalid shell syntax; specially crafted content can also change
shell interpretation. The preview places `$TOKEN` inside single quotes,
so copying the visible command sends the literal placeholder rather than
expanding the user's environment variable. The token-inclusive copy action
avoids that placeholder problem but retains the quoting problem.

**Verified:** isolated execution of the actual `buildCurl` function with a
harmless apostrophe-containing text body failed `/bin/sh -n` with exit 2.
The visible preview also contained a literal single-quoted `$TOKEN`. Nothing
was executed by the shell. Apps' host command also inserts address/token
without shell quoting (`AppsView.tsx:123–125`).

**Fix/acceptance:** use a single tested POSIX quoting helper for literal
arguments and deliberate double quoting for environment substitution.
Round-trip apostrophes, Unicode, newlines, dollar signs, and backticks
through a harmless argv-capturing stub. Keep secrets out of preview text
unless the owner explicitly requests a token-inclusive copy.

### CON-06 · P2 · A successful first pairing leaves the radar command stale

`AppsView.tsx:123–126` memoizes the host command solely on the transport
object. The object remains the same when pairing updates its token. Entering
Apps unpaired computes `<pair-this-browser>`; the view then triggers pairing,
but the command stays cached after success. The **Copy with my token**
button uses that stale value (`:399–401`). A token rotated through the
command interpreter produces a related stale in-memory token problem:
`DevConsoleView.tsx:138` calls generic `post`, which does not save the
returned token as the Security view does.

**Fix/acceptance:** expose auth state reactively or build token-bearing
commands at copy time; handle token rotation consistently through the
transport. Open Apps as the first unpaired route, pair, copy, and verify the
command uses the new token without a reload. Repeat after rotation.

### CON-07 · P2 · Saving one app discards unsaved changes in other app cards

Each enable/interval control updates the shared `apps` draft
(`AppsView.tsx:132–135`); saving one app replaces the entire collection with
the server response (`:138–146`). Example: edit Flights' interval, then save
Messages. The response restores Flights' persisted values and silently
loses its unsaved change. Save Messages/Flights/Custom also perform multiple
requests, so a later failure can leave a partially persisted configuration
without explaining which step succeeded (`:213–266`).

**Fix/acceptance:** separate per-app drafts from persisted state, show dirty
state, preserve unrelated drafts, and report partial saves. Edit two cards,
save one, and verify the second retains its draft; simulate failure of the
second request and verify saved/unsaved state remains clear.

### CON-08 · P2 · Weather overwrites the owner's layout and overstates success

**Add live weather** replaces the one Custom layout immediately
(`AppsView.tsx:187–205`), with no confirmation, backup, or undo for an
existing custom layout. The success toast says live weather is on the panel
as soon as save/enable/show requests succeed, before source diagnostics
prove a fetch or usable values. The weather title/units also compete for a
16-character row (`src/layouts.ts:16–18`); long decimal values may clip units.

**Fix/acceptance:** identify replacement clearly, preserve/export the old
layout, and offer a preview before saving. Report “saved; waiting for data”
until diagnostics establish a usable fetch. Test a pre-existing custom
layout, invalid station, missing observation, slow source, and failure;
never replace work silently or call an empty clock fallback live weather.

### CON-09 · P2 · Deploy verifies reachability, not the new firmware

After upload, `DeployView.tsx:45–55` reloads on the first successful health
response without checking reboot, device identity, new version, running
slot, or boot health. Forty polls are described as 60 seconds, but each
health request can itself take ten seconds (`transport.ts:385–386`), so the
worst wait is about 460 seconds. Leaving Deploy does not cancel this loop;
it can reload a later view and discard new edits.

**Fix/acceptance:** use a wall-clock deadline and cancellation, wait for an
actual reboot transition, then compare identity, running slot, expected
version/build, and boot status. Distinguish upload accepted, rebooting,
returned, and boot verified. Test the old firmware still answering, a failed
boot, a rollback, timeouts, and navigating away during recovery. Firmware
signing/rollback implementation gaps are reviewed separately.

### CON-10 · P2 · Demo success and diagnostics disagree with real behavior

`transport.ts:501` returns `ok:true` for every unrecognized POST. It also
accepts brightness outside the real 10–150 range (`:442–445`). Its app
fetch diagnostics are fixed fixtures (`:469–477`) rather than derived from
the current mock settings; default Custom layout is disabled in `mock.ts:92`
but diagnostics report it enabled and fetching successfully. Timeouts,
rotation, resets, and uploads are similarly incomplete simulations.

**Verified in isolation:** an unknown POST succeeded and brightness 999
was stored. This contradicts Welcome's “Everything you see works the same
way on real hardware” (`WelcomeView.tsx:201–204`) and makes the demo an
unreliable integration test oracle.

**Fix/acceptance:** unknown routes fail closed, shared validation enforces
the documented request ranges, derived diagnostics match current mock
state, and simulation limits are visible. The demo must not substitute for
firmware acceptance. Test identical representative success/failure cases
against mock and a fixture of the actual contract.

### CON-11 · P2 · Core keyboard and small-screen recovery affordances are missing

The pairing dialog declares `aria-modal` but does not trap/restore focus,
make the background inert, or handle Escape (`PairingFlow.tsx:75–158`). It
has no scrollable max-height (`styles.css:328–329`), so a short viewport or
software keyboard can hide its actions. The command input has no accessible
label (`DevConsoleView.tsx:169–179`); route changes do not focus or announce
the new heading (`main.tsx:68–74`). The paint canvas is pointer-only
(`DashboardView.tsx:84–102`). At widths below 760px the rail footer is hidden
(`styles.css:355`), which also hides the demo's only **Connect your device**
button and the pre-connect Guide's return-to-connect action.

**Fix/acceptance:** provide a complete modal focus lifecycle, a scrollable
phone dialog, labeled command input, route announcements, and an accessible
pixel-edit alternative. Keep connect/recovery controls visible on mobile.
Test keyboard-only navigation, screen-reader names, 320px width, short
landscape height, 200% zoom, and an open phone keyboard. These accessibility
findings are source-based; a conformance certification was not performed.

### CON-12 · P2 · Identity errors can be misclassified as old firmware

`connectDevice` treats any identity-request exception or non-success status
as `legacy` (`transport.ts:210–240`), even a timeout, CORS failure, 500, or
an intermittent connection on modern firmware. Welcome then claims the
firmware predates verification and offers **Connect anyway**
(`WelcomeView.tsx:60–67,171–175`). A stored pin is only compared when the
self-reported serial also matches (`transport.ts:231–235`), so a changed
serial can bypass continuity checking during this action.

**Fix/acceptance:** distinguish genuinely unsupported identity endpoints
from network/proof failures, compare the expected pinned device independently
of self-reported identity, validate health/identity consistency, and avoid
an automatic downgrade path. Test 404 on known legacy firmware, 500,
timeout, malformed proof, changed serial, and a changed key. The signature
verifier's primitive checks are useful; they do not establish secure session
or first-contact trust by themselves.

### CON-13 · P2 · Bundled owner instructions still contain misleading details

- Devices says token rotation also resets Wi-Fi (`DevicesView.tsx:69`);
  the real rotation route only changes the token.
- Welcome's generic “any good 5 V USB-C supply” (`WelcomeView.tsx:112–113`)
  omits the actual board/panel power requirements owned by the manual.
- Guide says its recovery path works offline, but detailed token-free wipe
  and firmware reconstruction instructions are only referred to in an
  online manual (`GuideView.tsx:364–385`). Offline control is strongest when
  the recovery instructions are available with it.
- `GateChip` prints internal milestone names in owner-facing UI
  (`components.tsx:41–42`); owners need availability and a usable next step.
- The layout validator allows empty `bind` and does not enforce source URL
  length (`AppsView.tsx:32,47`), so “valid layout” can still fail the device's
  validation. The final firmware response remains authoritative.
- Clipboard fallback ignores the boolean result from `execCommand('copy')`
  (`components.tsx:84`); callers can report successful copying when it failed.

**Fix/acceptance:** align Guide/Welcome/Devices with the manual's verified
behavior, bundle a useful offline recovery card, replace milestone badges
with plain availability text, unify contract validation, and surface actual
clipboard success. Documentation fixes in this review do not alter the
still-generated UI text.

### CON-14 · P2 · Build dependency advisories need a scoped upgrade

The 2026-09-08 read-only `npm audit --package-lock-only` also flags Vite,
esbuild, and fflate. Vite `5.4.21` is within the advisory's affected range;
its highest listed issue concerns exposed development servers and Windows
path handling, not the deployed static HTML. The official advisory lists
`6.4.3`, `7.3.5`, and `8.0.16` as patched branch versions.
[Official Vite advisory](https://github.com/vitejs/vite/security/advisories/GHSA-fx2h-pf6j-xcff).

The fflate report concerns `unzipSync` on malformed ZIP64 files. This
repository's Console build uses `gzipSync` only (`scripts/gen-header.mjs:5,21`)
and has no runtime fflate import in `src/`; direct exploitation through the
reviewed Console path was not established. esbuild's advisory concerns its
development server; the reviewed build invokes Vite's toolchain rather than
calling esbuild's serving API directly. Do not equate four affected package
entries with four demonstrated production exploits.

**Fix/acceptance:** update the supported build stack deliberately, retain
exact version/provenance records, run audit and both reproducibility gates,
and document any accepted non-reachable advisory. The build generator's
zero gzip timestamp, byte cap, and explicit generated output are good
controls to preserve. [npm advisory details for fflate](https://github.com/advisories/GHSA-px8p-9vwx-vf98).

### CON-15 · P3 · The historical prototype still teaches obsolete behavior

The reference has `https://` first-pixel commands and derives a new mDNS name
from a display name (`prototype/index.html:2285–2291,2373–2374`), while today's
panel uses HTTP and serial-derived names. Its generic quiet-hour/scene/
brightness/settings actions can mutate mock state while an offline device
is selected (`:1940–1947,2004–2017,2270–2276`), contrary to the documented
per-device unavailable-action treatment. Its claim first-pixel command uses
JSON serialization as shell quoting, which does not safely quote arbitrary
shell-sensitive content (`:2291`). The prototype's firmware versions and
capability examples also intentionally lag the living demo (`:1202–1216`).

**Fix/acceptance:** retain a prominent historical/mock label, reconcile
examples before reusing them, and create a retirement/parity checklist.
Do not bring these handlers into the live code without transport and
contract review. The prototype's inert background, focus handling, escaped
HTML insertion, bounded terminal output, explicit mock labels, and lack of
network transport are good design/reference boundaries.

## Product improvements worth doing next

These are suggestions, not approved commitments or new architecture.

1. **Make recovery part of the front door.** A persistent connection card
   should show target, last good contact, pending action, retry, switch,
   direct-device fallback, and the offline guide. This reduces support work
   across almost every failure mode above.
2. **Show the actual pixels.** A true read-only Mirror, with an unmistakable
   stale state, plus a saveable screenshot would deliver the spec's clearest
   differentiator. Keep the separate paint editor visibly distinct.
3. **Make Custom layout approachable without destroying work.** A visual
   five-row editor with exact 64×32 preview, field picker, tested source,
   clipping warnings, and import/export can make one small slot useful
   before building a Registry. Add confirmation/undo to template replacement.
4. **Explain the display schedule visually.** Show persisted scene duration,
   data freshness, temporary overlays, and the current frame lease. Let
   owners understand why the clock returned or why a host app took over.
5. **Turn troubleshooting into a local diagnostic export.** Combine firmware,
   reset reason, heap, reachability, and fetch verdicts in a copyable report
   that explicitly removes tokens, passwords, private URLs, and raw feeds.
   Ask the owner before including any sensitive optional detail.
6. **Prefer a few proven recipes over a huge catalog promise.** Package
   Messages, one US weather station, one local JSON example, and one Pixlet
   recipe with visible prerequisites, failure states, and a two-minute win.
   Put the editor/API beside each recipe so owners can change it confidently.

## Documentation corrected in this review

- `portal/README.md`: now directs users to the real Console/manual and
  clearly labels the old prototype as a design reference.
- `portal/console/README.md`: removes obsolete pre-cutover instructions;
  adds local development, source map, build/check sequence, and real demo/
  identity limitations, linking operational and security owners.
- `docs/PORTAL.md`: adds the complete current per-screen inventory and marks
  the broader IA, physical ceremony, workbench, Cloud, and full-control
  inventory as target behavior. Existing accepted decisions are preserved.

## Coverage and verification

- Read all handwritten files under `portal/console/`: all eight views,
  Welcome, pairing, shell/router, shared components/styles, frame and layout
  helpers, mock/type definitions, transport, and crypto. Reviewed the lockfile
  via its package inventory/audit and all package/build configuration.
- Read the complete historical prototype, including mock renderers,
  onboarding, devices, applications, OTA simulation, workbench, search,
  keyboard handling, streams, themes, and responsive CSS. No live network
  call or arbitrary-code execution primitive was found in that prototype.
- Reviewed the generator-to-firmware integration design and generated
  artifact locations. Generated payload bytes are validated by the root
  review's `console-verify` run rather than by claiming a manual audit of
  minified library code or thousands of gzip bytes.
- Ran isolated, in-memory probes against actual compiled transport and curl
  code: changed-target token handling, absent automatic identity request,
  shell syntax, unknown mock POST, and out-of-range mock brightness.
  These probes used sentinel data and stubbed networking only.
- Ran read-only npm audit with a temporary npm cache. It exited 1 with four
  advisory package entries; no automatic dependency repair was attempted.
- Reviewed the exact documentation diff and ran `git diff --check` on the
  three owned documents. The parent review owns final root checks,
  `console-verify`, public-page/browser QA, and aggregate results.

Not established here: a physical device's power budget, Wi-Fi behavior,
cryptographic first-contact trust, active-network attacker resistance,
physical ceremonies, OTA boot/rollback, broker TLS validation, real source
fetches, complete browser compatibility, screen-reader conformance,
production provider settings, or a deployed fix. Those need the appropriate
hardware, protocol, browser, or provider evidence. All changes in this
review are local documentation changes; nothing was committed, pushed, or
deployed by this sub-review.
