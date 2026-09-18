# Full repository review — 2026-09-08

**Outcome:** the repository has a useful local-first product foundation, but
it has open security, reliability, onboarding, and production-qualification
bugs. A green build does not make it ready for unrestricted production use.
This change improves the documentation and records the code fixes needed;
it does not implement those code fixes.

**Baseline:** public `JFForsythe/devmatrix`, branch `main`, commit
`180f0572edebe133c7e7f22bf5b2c962dfee7f4b`, initially clean, **156 tracked files**.
Every tracked path is accounted for in [coverage.md](coverage.md). Four
parallel review areas covered firmware/contracts, Console, examples/hardware/
operations, and repository/product documentation. Findings use baseline source
lines; owner-document lines changed during this documentation pass.

## Read this first

| Priority | Verified issue or qualification gap | Evidence and fix criteria |
|---|---|---|
| 1 | A changed Console target can receive the previously saved device's bearer token without identity verification | [Console: CON-01](console.md) — reproduced with a sentinel token and stubbed network |
| 2 | Pinned Preact version has an advisory relevant to unchecked API values rendered by the Console | [Console: CON-02](console.md) — lockfile, dataflow, and upstream advisory; no exploit run |
| 3 | Setup status exposes the LAN token during the post-join window, including the joined LAN; failed Wi-Fi boot can reopen setup | [Firmware/security review](firmware-and-contracts.md) — source-backed auth/interface analysis |
| 4 | Slow or chunked data responses can stall controls or fail parsing; REST JSON handling accepts invalid input | [Firmware/contracts review](firmware-and-contracts.md) — source and isolated parser reproductions |
| 5 | Signed OTA and qualified automatic rollback/recovery remain incomplete | [Firmware review](firmware-and-contracts.md), [hardware review](examples-hardware-operations.md) — compile is not recovery acceptance |
| 6 | Production flashing verification can accept incomplete evidence or switch to another port; host Linux services run owner-editable code as root | [Examples/hardware review](examples-hardware-operations.md) |
| 7 | Flights radar keeps renewing its display lease with stale aircraft after receiver failure | [Examples: EH-03](examples-hardware-operations.md) — reproduced with a simulated 61-second outage |
| 8 | An offline saved device can hide the Console's Forget/Switch control | [Console: CON-03](console.md) — source-backed recovery dead end; manual now includes a workaround |
| 9 | Pixlet setup, manager, bridge and installers disagree on config/token lifecycle; catalog updates can overwrite ignored owner files | [Examples review](examples-hardware-operations.md) — isolated config/installer/Git fixtures |
| 10 | Release preflight omits Console verification, branch protection has no required checks, and default production monitoring misses the printed domain | [Repository: R1–R5](repository-and-product.md) — source, tests, and read-only GitHub inspection |

These are grouped priorities, not ten total bugs. The per-area reports include
additional UI data-loss paths, pairing expiry, timers, MQTT/TLS, installer,
dependency, accessibility, documentation, and evidence findings. Severity
labels are local to this review: **P1/High** needs resolution before production
acceptance of the affected surface; **P2/Medium** is a correctness or
operability issue; **P3/Low** is polish. The older August report used a
different scale and should not be compared by counts.

## Documentation improved

The [README](../../../README.md) now starts with what the product does and
routes assembled-kit owners, bare-board builders, and integration developers
to the right instructions. The [manual](../../MANUAL.md) has task navigation,
first-message success checks, safer board selection, working request examples,
and practical recovery paths. It clearly separates on-device apps from host
apps and explains dependencies during an internet outage.

The owner documents, build guides, contract drafts, example guides, hardware
index, and operations runbook now distinguish implemented behavior from design
targets and dated evidence. The target buyer story is explicitly fictional;
canonical demo identifiers are preserved. The production blueprint and August
review retain their historical bodies, with current navigation added. Accepted
ADRs were not rewritten, and no new product decision was silently adopted.

Remaining code and UI-copy defects stay open in the reports. Editing prose does
not resolve token exposure, install bugs, or recovery qualification.

## Verification performed

- Baseline and integrated `make check`: **48/48 tests passed**, plus
  repository rules, Markdown links, canonical identifiers, and clean-room
  checks. The integrated checker covered **93 Markdown files** and 169
  concrete HTML IDs.
- `make console-verify`: **passed** with a temporary npm cache after the
  user's default cache returned EACCES. TypeScript and both builds passed;
  generated hosted HTML and device header matched the committed artifacts.
- No-upload firmware compile: **passed** with core 3.3.11, Protomatter 1.7.1,
  ArduinoJson 7.4.3 and Crypto 0.4.0. Image: **1,373,803 bytes (65% of OTA
  slot)**; globals: **116,708 bytes**. Runtime heap and physical behavior were
  not inferred from those numbers.
- Isolated local reproductions: changed-target sentinel token, shell quoting,
  mock permissiveness, parser/escaping/timer/chunked-body cases, stale radar,
  installer configuration, blank coordinates, and ignored-file overwrite.
  See per-area reports for exact scope and results.
- Browser: public welcome and all eight demo views reviewed; Dashboard text
  and Apps → Messages actions exercised. A 390×844 layout was checked and
  the viewport restored. The visible command generator reproduced broken
  apostrophe quoting. No device pairing, real token, OTA or reset was used.
- Public canonical domain and Vercel alias: **HTTP 200, byte-identical to
  committed Console**; 143,051 bytes, SHA-256
  `b3bfdc54d85301a7ef7d1e59fc0b996964f845fab6e1f8ae2b42fffbd69c822a`.
  The printed `/start` route reached `/#/guide` in the browser.
- Read-only GitHub: repository public; main protected against force push and
  deletion, with admin enforcement, but **no required status checks**.
- Dependency advisories checked separately from build success; see
  [Console dependency findings](console.md) and [host dependencies](examples-hardware-operations.md).

`git diff --check` passed. The exact changed-file diffs and status were
reviewed: 28 existing Markdown documents changed and seven review files
added. No authored code, configuration, dependency pins, accepted ADRs,
generated artifacts, or historical hardware evidence changed.

## Recommended next work

1. Fix credential isolation, unsafe rendering inputs, setup token exposure,
   fetch/parser behavior, and the flashing verification path. Add regression
   tests that fail on the observed behavior.
2. Finish OTA/recovery and hardware evidence against [ROADMAP.md](../../../ROADMAP.md),
   including negative cases and independent unassisted owners.
3. Fix offline recovery, copied commands, and Pixlet's config/service path;
   bring built-in Guide copy into alignment with the corrected manual.
4. Add a small tested set of useful starter experiences, visible data-freshness
   diagnostics, and configuration backup/restore. The
   [product opportunities](product-opportunities.md) give eight prioritized
   ideas and concrete acceptance experiments.

## Limits and change state

This is a source/documentation review with builds, isolated reproductions, and
browser demo checks. It is not an exhaustive proof of correctness, hardware
soak, full accessibility audit, penetration test of a live panel, legal or
regulatory assessment, or review of every public Git-history blob. Historical
records and generated files were assessed as evidence/artifacts, not claimed
as freshly exercised physical systems. The clean-room boundary was preserved;
no other product's source, assets, storefront or private records were opened.

**Local:** documentation and review artifacts changed. **Committed:** no new
commit. **Pushed:** no new push. **Deployed:** no changes deployed. The existing
public artifact was inspected read-only. No release was requested or run.
