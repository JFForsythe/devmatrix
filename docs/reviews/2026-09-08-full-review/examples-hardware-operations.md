# Examples, hardware, and operations review

Review date: 2026-09-08. Baseline commit:
`180f0572edebe133c7e7f22bf5b2c962dfee7f4b`. Source references below name the
unchanged code or historical evidence at that commit. Documentation was
corrected locally; **the code defects below remain open**.

## Coverage and method

Read every tracked file under `examples/` and `hardware/`: terminal tool,
Flights app, both installers, Pixlet setup, bridge/config/package/lockfile,
manager server/library/browser JS/HTML/CSS, both hardware shell scripts,
all four insert HTML files, all ten dated evidence records, directory docs,
and the bench procedure. Read OPERATIONS, the relevant hardware, toolchain,
hosting, transport, Pixlet, and discovery ADRs, plus the applicable production
criteria. Cross-checked CI and hosting config with the root review.

Also read the August review's `05-contracts-and-examples`,
`07-hardware-and-gate-evidence`, and `08-ops-release-pipeline` in full. Those
are historical findings, not current assertions. Examples: the removed scan
instruction and missing `--format gif` were fixed; service restart and
terminal secret-file concerns remain. Later records supersede the old
v0.4.0-only hardware baseline and the claim that USB mount was never tested.

Local ignored PDFs, generated cards, dependency trees, private host configs,
device backups, and external catalog checkouts are not part of the public
tracked-file inventory. No device, service installation, eFuse, printer,
provider setting, or release was changed. HTML/CSS received source review;
print quality, QR scanning, and browser interaction were not visually accepted
in this workstream. Parent review covers the live Console separately.

## High-priority findings

### EH-01 · P1 · Flash-station failure checks can admit an unverified device

Evidence: `hardware/procedures/flash-station.sh:78-92` discards esptool exit
status and returns the result of `echo`; retry suppresses failure.
Lines `109-121` accept any output containing “read” and classify
`all(b == 0xFF for b in d)` as blank without requiring the expected byte
count. An empty failed dump therefore satisfies the blank predicate. Upload
success at `129-136` is inferred from “Hard resetting”; the hash-verified
region count is printed but never required. At `173`, a missing explicit
port falls back to the first globbed port for final telemetry.

Impact: a failed read can weaken the pre-flash identity gate; reset/log text
can be mistaken for verified writes; another unit can supply the final
setup-mode observation. The initial and post-flash MAC comparison does not
bind every later fresh port selection to that same device. This is especially
serious because the next steps flash firmware and erase NVS.

Fix: propagate every subprocess status, require exact dump length and parsed
partition information, require expected region verification, and bind every
operation/re-enumeration to one verified device. Fail if a selected port
disappears. Exercise fake failed reads/uploads and port swaps before another
unattended production run. No destructive reproduction was attempted.

### EH-02 · P1 · Linux installers run owner-editable programs as root

Evidence: `examples/install-pixlet-bridge.mjs:224-237` and
`examples/install-flights.mjs:243-256` create system units without `User=`.
Their `ExecStart` paths point directly into the invoking checkout; the Pixlet
bridge then executes the binary named by its owner-editable config
(`bridge.mjs:363-371`). System services default to root when `User=` is unset,
per the [upstream systemd execution documentation](https://github.com/systemd/systemd/blob/main/man/systemd.exec.xml).

Impact: replacing the checkout script or configured Pixlet binary gives the
next service execution root authority. Network-facing app/render/parser code
also receives more privilege than needed. A mode-0600 token file does not
remove that execution risk. This is a privilege-design defect; no exploit
against the current host was run.

Fix: install as a user service or use a dedicated unprivileged account with
appropriate file ownership and a bounded writable directory. Test fresh
install, upgrade, token rotation, and reboot under that actual account.

### EH-03 · P1 · Receiver failure leaves radar aircraft displayed indefinitely

Evidence: `examples/flights-overhead.mjs:199-233` only removes tracks after a
successful receiver result; `363-365` catches receiver errors without
invalidating tracks. `268-273` caps extrapolation but never expires a track.
The separate frame loop at `374-383` keeps sending frames and renewing a
10-second device lease (`326-332`).

Reproduction: evaluated the unchanged application functions with in-memory
fetch and clock fixtures. After one valid aircraft, advance 61 seconds and
make the receiver fetch fail. Result: one track remains, the second frame is
byte-identical to the first, and `lease_ms` is still `10000`. No socket or
panel was used. Thus the dead-host lease cannot detect a live host with dead
receiver data.

Fix: track successful source timestamps, expire stale positions, stop
renewing data frames after a bounded outage, and show a clear unavailable
state or release the layer. Test outage, malformed response, stale
`seen_pos`, recovery, and view changes.

### EH-13 · P1 · Hardware records do not establish production qualification

Evidence: the August 24 intake explicitly identifies one accelerated sample,
not its lot (`hardware/evidence/2026-08-24-mp-qual-01-production-intake.md:4-13`);
loaded refresh is 199 Hz and not passed (`94-100`), and instrumentation,
soak, interrupted recovery, supply, and compliance remain untested
(`111-120`). The August 26 record observes a USB **mount**, not a recovered
image (`30-36`), repeats the failed loaded-refresh threshold (`37-43`), and
leaves visual checks pending even for the boxed unit (`76-90`). Its footnote
cannot replace a per-unit panel/assembly observation.

Fix: retain the failed/unperformed status, complete the current-build bench
matrix with raw evidence, and record each unit separately. A shortened pilot
exception is not a production acceptance decision. The hardware README and
bench procedure now distinguish these scopes; immutable evidence was kept.

### EH-15 · P1 · Setup can overwrite ignored owner files in the app catalog

Evidence: `examples/setup-pixlet.mjs:231-239` uses
`git status --porcelain=v1 --untracked-files=all`, which omits ignored files.
It later performs `git checkout --detach` at `279-282`. Messages claim local
or ignored files are preserved, but the probe does not establish that.

Reproduction: in a disposable Git repository, create an ignored owner file on
the old catalog commit and a later commit that tracks the same path. The
script's exact dirty probe returns empty; its checkout command replaces the
owner file with upstream content. Result:
`{"setupDirtyProbeEmpty":true,"afterCheckout":"upstream content"}`.

Fix: include ignored files in the preservation/conflict policy and use a
checkout strategy that refuses to overwrite them. Add this two-commit case
to setup tests. The README now explains the current rerun risk.

## Other actionable findings

| ID | Priority | Evidence and impact | Recommended change |
|---|---|---|---|
| EH-04 | P2 | Both installers initialize configuration only from parsed flags (`install-flights.mjs:55-56,156-164`; `install-pixlet-bridge.mjs:50,130-140`). Exported environment values named in help are ignored. Pixlet persists only `DMX_TOKEN` (`200-203`) even if the config selects another `device.tokenEnv`; setup/manager default to a home-directory config while installer/bridge default to the package placeholder. | Share config resolution, honor documented environment inputs, validate the selected config/token variable before installation, and use one default path. A dummy-token environment-only dry run failed as predicted; documentation now uses exact flags and paths. |
| EH-05 | P2 | Easy Mode saves config (`manager.mjs:406-430`) but the bridge reads it once (`bridge.mjs:741,785`). Neither starts nor reloads the continuous process. Linux reinstall uses `enable --now` without restart (`install-pixlet-bridge.mjs:383-390`; `install-flights.mjs:401-408`). | Provide explicit Apply/start/restart behavior with visible saved-versus-running state. Restart existing services after replacing settings. Documented the current manual restart requirement. |
| EH-06 | P2 | `bridge.mjs:556-557` caps the lease at 30 seconds, while `590-593` can sleep for a longer GIF delay. The last frame before another synchronous render has only its normal lease; render timeout is 30 seconds (`368-369,609`). | Renew during long delays and pre-render the next slot or keep a bounded heartbeat during render. Test a 60-second GIF delay and a render taking over 10 seconds; otherwise the clock can appear between frames despite a healthy host. |
| EH-07 | P2 | The bridge reads the complete GIF (`375`), parses/decompresses every frame (`407-420`), and stores all RGBA canvases plus slot caches. There is no GIF byte/frame/decompressed-memory cap. Manager preview alone has a 16 MiB byte cap (`manager.mjs:43,366-367`), which is not a decoded-memory bound. | Bound file size, frames, frame dimensions before allocation where possible, and cached decoded bytes; isolate decoder work with resource/time limits. No memory-exhaustion test was run. |
| EH-08 | P2 | `pixlet-manager/app.js:202-240` updates global selected app before awaiting search/schema and applies every completion without a selection generation check. Rapid A→B selection can display A's late schema under B's title; manager exclusivity may reject B while A completes. | Ignore stale async completions or cancel prior selection requests; test delayed A schema followed by B selection. Also gate preview completion to its selected app. Source-derived, not browser-reproduced. |
| EH-09 | P2 | `pixlet-manager/lib.mjs:487-496` converts missing coordinate strings with `Number`, accepting an empty latitude as zero. The browser sends a location if either coordinate is populated (`app.js:354-358`). | Require both non-empty coordinates and validate the timezone before conversion. Direct call with latitude `''`, longitude `-87.63` produced stored latitude `0`, confirmed locally. |
| EH-10 | P2 | Manager tokens are selected from session/env/a sibling file independently of device URL (`manager.mjs:225-227`). A config URL change does not bind or invalidate that token. State labels saved-token presence as paired (`app.js:108-113`; `manager.mjs:249`). Host tools also send bearer tokens without the Console's device-key challenge. | Bind saved authority to device identity/address, clear it when the target changes, and distinguish token saved from authenticated. Bring host identity behavior under the security contract. No LAN spoofing test was performed. |
| EH-11 | P2 | Both macOS status handlers exit zero whenever an agent is loaded, even if `state = waiting` or the child has crashed (`install-pixlet-bridge.mjs:499-519`; `install-flights.mjs:517-537`). Log-tail helpers read the entire unbounded log before taking five lines (`471-475` / `489-493`). | Require actual running/healthy evidence for success, report last exit reason, and read bounded log tails with rotation. A loaded process is not a working app. |
| EH-12 | P2 | `dmx-top.mjs:173-175` writes token JSON with default creation permissions and only then chmods to 0600. A normal 022 umask creates a briefly readable file; symlinks are followed. Its help says text lasts 10 minutes (`162`) while the command sends 30 seconds (`200`). | Create a private regular temporary file atomically, reject symlinks, and correct the help. The owner docs now use the actual 30-second behavior. |
| EH-14 | P2 | All four insert variants promise any 5 V/2 A+ USB-C supply/phone fast charger, while hardware power/current/thermal qualification remains unrecorded. `make-card.sh:18` only validates a broad `DMX-????-????` glob, and the QR uses no explicit quiet-zone border (`32`). | Finish instrumented supply/cable qualification before broad compatibility claims; strictly validate uppercase hex serials and physically scan printed QR samples. No supply or QR scan failure is asserted without the bench test. |
| EH-16 | P2 | Setup accepts any existing executable that answers `version` (`setup-pixlet.mjs:183-190`) and any installed `gifuct-js` directory (`301-304`). SHA pins protect new downloads only. Bridge path containment is lexical (`bridge.mjs:334-341`), unlike manager realpath containment, so symlinks can resolve outside the catalog. | Verify reused component version/integrity, distinguish custom owner installations from approved pins, and align realpath containment. Do not describe a rerun as a full integrity verification. |
| EH-17 | P2 | Flights creates its data timer once (`flights-overhead.mjs:373`), while later config sync changes `interval_s`; it never reloads receiver location after the initial `findHome` (`369`). Poll callbacks can overlap when a fetch is slow. | Use a non-overlapping rescheduled loop and reset receiver-dependent location/tracks when its URL changes. Test changed interval, changed receiver, and timeout. Current docs advise restart. |

## Documentation corrections completed

- `examples/README.md`: choose-by-goal entry points, explicit prerequisites,
  real Flights behavior, host lifetime, token handling, service restart/removal,
  platform boundaries, and actual installer limitations.
- `examples/pixlet-bridge/README.md`: complete setup→manager→one-time push→rotation
  path, exact home-directory config, pairing-file boundary, app compatibility,
  troubleshooting, locked dependencies, and what preflight/self-tests prove.
- `hardware/README.md`: current inventory, precise evidence scope, destructive
  station limits, per-unit acceptance, and print checks.
- `hardware/procedures/bench-week.md`: current evidence baseline, distinguish
  USB mount from recovery, fresh-key entropy order, timed rollback validation,
  required measurements, and reproducible per-unit records.
- `docs/OPERATIONS.md`: remove stale DNS/private-repository claims, record the
  verified live/public/protected state, identify absent required checks, clarify
  monitoring and signed-artifact limits, and add incident/revert guidance.

## Product opportunities

1. Make Easy Mode a complete owner journey: pair once, select a tested starter
   app, preview, Apply, and see whether the real rotation is running. This
   removes more friction than exposing additional raw app controls.
2. Ship a small curated starter catalog with tested configuration defaults and
   explicit internet/key requirements, plus an offline app. Catalog size alone
   is not compatibility evidence.
3. Add one host diagnostic command that reports config path, runtime versions,
   token accepted, recent source fetch, last frame, and service state without
   revealing secrets. Use a mock panel and fake renderer in CI to exercise it.
4. Provide a recoverable, downloadable firmware/recovery bundle tied to a
   tested hardware version and concise instructions, once the release/security
   gates permit it. Owners should not need an undocumented bench machine.
5. Turn the per-unit ledger into a real acceptance record with assembly/photo,
   display, Wi-Fi, power, recovery, and packaging results. A correctly encoded
   card and a verified recovery path strengthen the product's ownership promise.

These are proposals, not approved changes to product scope or gate criteria.

## Validation performed and limits

- Setup, bridge, and manager built-in self-tests passed on Node 20.9.0.
- Both macOS installer dry runs passed with dummy flag-supplied tokens and
  redacted output; the environment-only Pixlet invocation failed as predicted.
- Safe fixtures reproduced stale radar after 61 seconds, blank latitude becoming
  zero, and ignored catalog-file overwrite on checkout.
- Both hardware shell scripts passed `bash -n`. Syntax acceptance does not
  establish destructive-operation safety.
- Changed-file whitespace checks passed. Root review runs the repository-wide
  gates and reviews the combined diff.

Not run: actual systemd/launchd lifecycle, downloads or catalog installation,
real Pixlet decode/render against the full catalog, hostile-browser exercises,
physical printing, panel flashing, supply/thermal measurements, soak, destructive
recovery, or production deployment. Historical evidence remains historical;
none of these local results re-qualifies a shipped device.
