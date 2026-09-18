# Firmware and public-contract review — 2026-09-08

Reviewed source commit: `180f0572edebe133c7e7f22bf5b2c962dfee7f4b`.
This is a source, toolchain and isolated host-behavior review, not hardware
acceptance. No board was contacted, uploaded, reset or provisioned. No device
secrets were read. Only this public project and its public toolchain were
inspected; no closed-product material was opened or compared.

The firmware builds successfully and has useful explicit bounds, but the
current source does not yet meet its security and recovery promises. The
highest-value next work is setup/pairing authority, genuinely bounded data
fetches, validated JSON contracts, and verified update/recovery behavior.
Documentation was corrected in this review; **the code findings below remain
open**. Severity denotes product impact: P1 before relying on the affected
security/release promise; P2 normal correctness work; P3 polish or maintainability.

## Coverage

Every line of these authored firmware files was reviewed: `dk01.ino` (1,617),
`apps_engine.h` (528), `apps_builtin.h` (634), `mqtt_client.h` (818), and
`web_setup.h` (194), totaling 3,791 lines. All five `contracts/*.md` files,
`firmware/dk01/README.md`, `docs/FIRMWARE.md`, and `docs/SECURITY.md` were read
against the source. Generated `web_console.h` was checked as a gzip artifact,
through its HTTP integration and a complete firmware compile; its generated
JavaScript is covered by the separate Console review.

Decision records read for this scope: ADR-0001, 0003, 0004, 0006, 0008, 0013,
0021, 0023, 0024, 0026, 0027, 0028, 0029, 0030, 0031, and 0032. The glossary
and canonical user story were checked for names and example identifiers.
Current CI firmware build configuration and installed arduino-esp32 3.3.11
HTTPClient/WebServer source, partition map and SDK configuration were inspected.
The other review reports own the full Console, host-app, hardware, operations,
product and repository-tooling assessments.

## Findings

### FW-01 · P1 · Setup can disclose authority on both network interfaces

Evidence: `firmware/dk01/dk01.ino:1343` selects AP+STA mode; `:64` creates a
port-only WebServer; `:1308–1317` returns the LAN token after join;
`:1350–1364` exposes setup without an interface, session or Origin check.
`:1459–1464` also opens setup after a provisioned device fails to join for
25 seconds. The successful-join timeout is `:1564–1570`.

Reproduction on an authorized test board: join Wi-Fi through setup, then
request `/setup/status` through the station IP before Finish/timeout. The
handler returns the same token as the hotspot client. Repeat with a
provisioned board whose network is unavailable at boot: setup reopens without
a button hold. Source proves the exposure; these network steps were not run.

Impact: the earlier RF-only disclosure statement was false. A reachable LAN
client can obtain full device authority during the window; an automatic
recovery hotspot also permits unauthenticated network reconfiguration.
Require physical authorization for recovery setup, constrain setup to the
intended interface/session, and verify timeout and teardown paths. The
90-second post-success timer does not bound failed setup sessions.

### FW-02 · P1 · Five guesses per code is not a pairing rate limit

Evidence: `dk01.ino:1035–1043` immediately mints a code when the previous
code is absent; `:1075–1078` removes it after five failures. No cooldown,
requester/session binding or global attempt budget exists. `:1053–1072`
returns the shared full-control token to each successful pairing.

Reproduction: five wrong finishes, then another start, permits five more
attempts immediately. An unauthenticated LAN client can also keep forcing
fresh pairing screens or destroy another user's active code. At five guesses
per fresh six-digit code, resetting the code does not impose a time bound on
continued guessing. Add aggregate throttling and physically confirmed,
session-bound pairing; retain a recoverable path for legitimate owners.

### FW-03 · P1 · Signed nonce is not an authenticated HTTP channel

Evidence: `dk01.ino:1006–1029` signs only the domain-separated serial and
caller nonce; `:1071–1072` returns the key and bearer token on the same HTTP
response. `web_setup.h:175–188` receives identity metadata but carries only
`#t=<token>` to the Console. No firmware code renders `idFingerprint` on the
panel; it is in API responses and serial output (`dk01.ino:1542`).

An active proxy can forward a valid challenge to the real device and then
observe the later bearer request. First-use key capture is not independent
of that proxy, and device-served JavaScript also arrives via HTTP. This is a
protocol limitation, not a claim that Ed25519 is broken. The nonce provides
proof of access to the key and remembered-key continuity; it does not bind
subsequent requests or encrypt anything. Resolve the ADR-0031 out-of-band-key
requirement and define the active-network threat explicitly before claiming
anti-spoofing beyond these limits. Coordinate the fix with Console transport.

### FW-04 · P1 · Request guards run too late for some work and omit Origin rejection

Evidence: Console middleware at `dk01.ino:1379–1409` validates Host and
OPTIONS but never rejects a foreign Origin on actual requests. Its body cap
checks `arg("plain")` after buffering. In the installed public core,
`WebServer.cpp:447–455` parses the request before middleware, and
`Parsing.cpp:497–505` calls the upload callback while parsing. The OTA callback
at `dk01.ino:1196–1219` checks only bearer authority before writing.

Impact: the advertised 8 KB cap is not an allocation limit against oversized
unauthenticated input. A bearer-authorized multipart request with an invalid
Host can begin/write an image before the final Host rejection. Browser CORS
response restrictions do not themselves prevent public pairing side effects.
Add pre-body limits and enforce sensitive-route checks at the actual start
of upload; explicitly validate request Origin where required. An invalid
Host does not bypass the token requirement.

### FW-05 · P1 · A slow data source can stall rendering and controls for hours

Evidence: `apps_engine.h:443–460` resets the idle timer after each byte and
has no absolute request deadline. `dk01.ino:1588–1593` runs synchronous app
fetches before rendering and MQTT command handling; HTTP service is also in
the same loop at `:1551`.

A source sending one byte each second stays below the 1.2-second idle timeout;
filling the 65,536-byte cap can take over 18 hours. The hardware scan engine
may continue refreshing its existing frame while the application stops
advancing clock, pairing, frame leases, API requests and broker commands.
This timing bound follows directly from the loop; no prolonged device test
was attempted. Add an absolute deadline across connect/redirect/body work and
move fetch progress off the synchronous display/control path. Validate with
stalling, trickling and disconnected sources, not only successful local feeds.

### FW-06 · P1 · Redirects violate the configured-destination boundary

Evidence: `apps_engine.h:417–418` enables two automatic redirects without
destination checks. Public core `HTTPClient.cpp:1444–1480` permits a new host
when the scheme stays the same. This conflicts with ADR-0032's explicit
configured-address-only rule and the planned app-host permission boundary.

A configured endpoint returning a same-scheme Location to another host causes
the panel to connect there. Disable cross-host redirects or validate each hop
against the owner-approved origin/port; add a bounded test with one configured
server and one unapproved destination. No scanning tool or LAN probe was run.

### FW-07 · P1 · Update integrity and rollback health remain release blockers

Evidence: `dk01.ino:1204–1219` calls `Update.begin/write/end` without signature,
manifest or signer verification. `:1558–1562` marks the image valid on one
loop iteration once global uptime exceeds 30 seconds, sets its local success
flag before the call, and ignores the return code. A boot-time 25-second Wi-Fi
attempt counts toward that interval (`:1459–1464`).

The current SDK enables rollback; two slots and a validation API call do not
prove the intended health policy. A newly installed image can be marked
valid after only a few seconds in the main loop. Implement the signed-image
contract and explicit health criteria, then prove failure rollback and USB
recovery on authorized hardware. No signing key, fuse, flash or device was
mutated in this review. The previous OTA draft's claimed final token recheck
was corrected: `handleOtaFinal` reads the saved `otaAuthed` flag (`:1227`).

### FW-08 · P1 · MQTT TLS configuration is incomplete; app HTTPS skips identity

Evidence: `mqtt_client.h:439–449` selects SSL and skips common-name checking
but sets no CA, certificate bundle, PSK or global CA store. The installed
ESP32-S3 qio_qspi SDK has neither `CONFIG_ESP_TLS_INSECURE` nor
`CONFIG_ESP_TLS_SKIP_SERVER_CERT_VERIFY`. ESP-TLS normally refuses a TLS
connection with no verification method; see the
[ESP-IDF 5.5 verification documentation](https://docs.espressif.com/projects/esp-idf/en/v5.5/esp32/api-reference/protocols/esp_tls.html#tls-server-verification).

Therefore MQTT TLS is expected to fail under this configuration; it is not
substantiated as the previously documented encrypted-but-unverified working
transport. This is a source/configuration conclusion, not a broker handshake
measurement. In contrast, app HTTPS explicitly calls `setInsecure()` at
`apps_engine.h:421`, so it lacks certificate identity verification. Add real
CA trust and fail-closed configuration validation, then device-test trusted,
untrusted, wrong-name and expired certificates. Do not fix this by enabling
an insecure SDK bypass.

### FW-09 · P2 · Standard chunked JSON responses are read as invalid JSON

Evidence: `apps_engine.h:442–458` reads `getStreamPtr()` directly. The installed
HTTPClient returns its raw network client (`HTTPClient.cpp:850–853`); decoding
chunk framing is implemented separately in `writeToStream` (`:885` onward).

Host reproduction: the exact bounded JSON parser rejects the wire body
`7\r\n{"a":1}\r\n0\r\n\r\n`, while `{"a":1}` is valid JSON. A server using
Transfer-Encoding: chunked therefore yields `bad-json` even when the payload
is correct. This was reproduced in the extracted host harness, not through a
physical HTTP connection. Decode transfer framing into a bounded sink and
preserve total deadlines. The layout draft now describes the current limit.

### FW-10 · P2 · Legacy REST parsers accept wrong types and invalid JSON

Evidence: `dk01.ino:153–224` finds key strings without parsing an object;
`jsonGet` searches for the next quote after a colon. Legacy handlers still
use it for text, frame, settings, flights, MQTT settings, pairing and setup.
`jsonIntStrict` does not require a valid delimiter after the integer.

An isolated C++ harness extracted those exact functions and reproduced:

| Input | Current result |
|---|---|
| `{"text":null,"duration_s":30}` | `jsonGet(...,"text")` returns the string `duration_s` |
| `{"value":12.7}` | `jsonInt` returns 12 |
| `{"lease_ms":3000junk}` | strict lease scanner accepts 3000 despite invalid JSON |

Use one bounded, type-aware parser already available in the toolchain and
validate the complete object before mutating state. Add semantic contract
cases, including wrong types, duplicate/nested keys and trailing garbage.
The draft now avoids promising uniform malformed-input rejection.

### FW-11 · P2 · Some valid input produces invalid JSON responses

Evidence: `dk01.ino:227–230` escapes only slash and quote, then is used for
SSID listing (`:1262`), timezone (`:1094`), receiver URL (`:892`) and MQTT
settings (`:1113`). `appJsonEscape` at `:750–758` handles only some control
characters although the app string parser accepts backspace/form feed.

Host reproduction: serialize a timezone containing an actual newline through
`jsonEscape`; the resulting JSON is rejected by the source's full JSON parser.
Network SSIDs can also contain characters requiring JSON escaping. Invalid
responses can strand the setup list or make Console reads fail. Use the
existing serializer consistently and test all JSON control characters.

### FW-12 · P2 · MQTT replay and delivery guarantees are overstated

Evidence: `mqtt_client.h:173–178` remembers only eight ids; `:407–413` clears
those ids on reset. Expiry at `:229–232` and `:688–692` compares against wall
time with no synchronization/future-time check. Duplicate ids are discarded
before replying (`:672`); enqueue failures do not replay execution responses.

Before SNTP, contemporary command timestamps are in the future, so expiry can
accept stale broker traffic. After eight other ids, an older still-valid id
can execute again. Restart/reconfiguration forgets all ids. Add a clock-ready
policy or monotonic session freshness, bounded future skew, and a documented
retry/idempotency policy. The corrected contract describes bounded deduplication
and response attempts rather than durable exactly-once behavior.

### FW-13 · P2 · Several persistence paths report success or change RAM before storage succeeds

Evidence: token rotation at `dk01.ino:988–990` ignores NVS write success;
MQTT writes at `mqtt_client.h:509–515` ignore each return and its REST caller
ignores the final save/start result (`dk01.ino:1166–1168`). Layout replacement
assigns active RAM at `apps_builtin.h:502` before storage at `:507`.
Message updates similarly modify RAM before three separate writes (`:165–180`).

On NVS failure, success/read-back can describe settings that disappear on
reboot; token rotation may appear to revoke clients while a reboot restores
the old token. A reported failed layout save can still alter current display
state. Implement explicit persistence results, atomic configuration records
where needed, and error behavior that matches actual RAM/flash state. No NVS
fault injection was performed; this is a verified failure-path review.

### FW-14 · P2 · Millisecond rollover breaks pairing, text and identify deadlines

Evidence: `dk01.ino:530–537`, `:586–588`, `:1037` and `:1054` use direct
unsigned deadline comparisons. Frame leases and several app deadlines already
use signed differences correctly, showing an inconsistent timing policy.

Host reproduction: at `now=0xfffffff0`, `until=now+300000` wraps, and
`now < until` is immediately false. Near 49.7 days uptime, a new pairing
window or timed overlay can expire immediately. Use the same wrap-safe helper
for every deadline and test offsets around rollover, including sentinel zero.

### FW-15 · P2 · Home Assistant “off” leaves the display on

Evidence: `mqtt_client.h:615` always reports state `on`; `:622–625` emits
brightness 0 for off; `:717–719` maps MQTT 0 to hardware brightness 10.
This is a predictable integration failure for bedtime automations, not an
unverified HA library behavior. Add a true display-off state that keeps
network/recovery alive, reconcile REST and MQTT state, and verify restoration
of the previous scene/brightness. The contract now describes current behavior.

### FW-16 · P2 · Empty Messages does not remain empty after reboot

Evidence: `dk01.ino:793–805` accepts `phrases:[]`; `apps_builtin.h:177` saves
count 0, but `:138` treats only a positive count as a stored pack and
`:143–158` loads default setup tips otherwise. Distinguish an absent key from
an intentionally empty pack. Until fixed, disable Messages to remove it from
rotation; the draft now explains the distinction.

### FW-17 · P2 · Display handoff and diagnostics can mislead app authors

Evidence: `dk01.ino:479–481` gives a manual app selection priority over a
new frame; `handleFrame` does not clear manual selection (`:943–951`). App
show at `:875–885` does not enable or fetch a disabled source. Custom binding
resolution skips missing rows (`apps_builtin.h:477–479`) and still marks a
frame fresh if a literal row succeeds (`:488–493`). Fetch `okCount` increments
before bindings at `apps_engine.h:475`.

A “show now” click can block subsequent host frames for the scene interval;
a disabled app can show old/no data; a custom layout can report successful
fetches while showing only its static heading. Specify display ownership and
precedence, provide per-binding verdicts and displayed-data age, and make show
now's enable/fetch behavior explicit. These are source-backed scenarios; panel
visual behavior was not tested. Preserve frame leases when improving handoffs.

### FW-18 · P2 · Clock has no LAN-only time bootstrap

Evidence: `dk01.ino:1104` and `:1466` hard-code two public SNTP hosts; the
settings route exposes only timezone. `:363–365` renders `--:--` without a
plausible epoch. There is no RTC/time-setting or LAN-NTP configuration route.
A cold boot without public time service cannot fulfill the accurate native
clock expectation. Add owner-configurable LAN NTP and/or a browser-set clock,
with explicit synchronization status. The current dependency is now disclosed
in FIRMWARE; root review coordinates MANUAL/MODES wording.

### FW-19 · P2 · Toolchain instructions and accepted pin disagree

Evidence: ADR-0013 still names 3.3.8 until P2, while
`.github/workflows/ci.yml:119` installs 3.3.11 and the actual installed build
uses 3.3.11. The old README installed an unversioned core and Protomatter.
README instructions now reproduce current CI with explicit versions and a
selected board port; FIRMWARE explicitly records the decision discrepancy.
A new ADR must reconcile the core pin. Transitive GFX/BusIO versions should
also be captured if byte-reproducibility is a release requirement.

### FW-20 · P3 · Setup needs stronger recovery and network-entry affordances

Evidence: `web_setup.h:129–155` builds only a scanned-network picker and
filters with an ordinary object's inherited keys (`seen={}`); SSIDs such as
`constructor` are silently skipped. There is no manual/hidden SSID field.
`:168` treats an HTTP error response like an accepted join; `:173–181` swallows
poll failures indefinitely. The automatic 90-second close can leave the page
without a clear reconnect state.

Add explicit network entry, `Set`-based deduplication, response-status checks,
a total join UI deadline and a visible reconnect/retry action. These changes
are small compared with the support cost of an apparently frozen first boot.

## Documentation changes made

- Firmware README now starts with source/release status, pins the actual CI
  versions, states the working directory, uses the built output for cable
  upload, and asks developers to select the intended port rather than glob
  every attached board. Exact public API detail links to contracts.
- FIRMWARE now explains the actual files, boot sequence, main-loop behavior,
  app scope and resource placement. A long chronological preamble and
  illustrative future endpoints no longer obscure what developers can use.
- SECURITY now distinguishes current controls from target ceremonies,
  permissions, Cloud services and release requirements. It corrects setup
  reachability, public routes, first-use identity, Origin checks, TLS and
  physical-confirmation claims.
- REST, MQTT, layout and OTA drafts now describe actual password-clearing,
  diagnostics, empty messages/pointers, byte limits, chunked-body limitations,
  persistence, replay, HA off behavior and rollback validation. Planned
  workbench/app permission surfaces are labeled as planned.

Accepted ADRs, authored firmware, Console source, and generated artifacts were
not changed by this review. The broader report owns product opportunities.

## Validation

Fresh local compile, with no upload:

```sh
arduino-cli compile --fqbn esp32:esp32:adafruit_matrixportal_esp32s3 \
  --build-path /tmp/devmatrix-review-20260908-build \
  --output-dir /tmp/devmatrix-review-20260908-output firmware/dk01
```

Result: **PASS**. Arduino CLI 1.5.1; core 3.3.11 / ESP-IDF 5.5.5;
Protomatter 1.7.1; ArduinoJson 7.4.3; Crypto 0.4.0. Installed transitive display
libraries included GFX 1.12.5 and BusIO 1.17.4. Default compile emitted no
warnings. Compiler footprint: **1,373,803 bytes flash**, 65% of the 2,097,152-byte
slot; **116,708 bytes globals**, leaving 210,972 nominal bytes for dynamic
use. The emitted app `.bin` is 1,373,952 bytes including image packaging.
This does not measure runtime heap/stack, TLS peak, PSRAM reliability or power.
The generated partition CSV matched the current core's TinyUF2 8MB map byte
for byte.

The committed generated Console header contains exactly **48,565 gzip bytes**,
successfully decompressing to **143,216 HTML bytes**. Gzip SHA-256:
`0db45cc8f36080d1a30dafd0b23bb34e512a802f80121a1f0d3e343cd22856b3`.
The complete firmware compile includes that header and the route sends it
with gzip content encoding. Console rebuild parity and browser acceptance are
reported by the separate Console/root review.

An isolated `/tmp` C++ harness extracted the current legacy scalar readers,
JSON parser and pointer resolver, added a small std::string adapter for the
Arduino String calls, and compiled with Clang C++17 plus AddressSanitizer and
UndefinedBehaviorSanitizer. It reproduced the exact outcomes in FW-09/10/11/14
and confirmed empty-pointer resolution. Sanitizers reported no faults in these
bounded cases; this is not a parser fuzzing or ESP32 runtime result. No harness
or build output was added to tracked source.

`git diff --check` passed for this scope. Root review runs the final repository
checks over the combined documentation change. No Git commit, push,
production deployment, signed OTA, live broker test, Wi-Fi recovery drill,
physical-button ceremony, rendering measurement or hardware soak was performed.
