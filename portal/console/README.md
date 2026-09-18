# Devmatrix Console

`portal/console/` is the single production Console codebase established by
[ADR-0027](../../docs/adr/ADR-0027-one-console-codebase.md). It uses the Preact,
TypeScript, and Vite stack selected in
[ADR-0014](../../docs/adr/ADR-0014-console-production-stack.md), including only
system UI and native monospace fonts. The source includes eight views, a
hosted welcome/connect flow, panel-code pairing, a live HTTP transport, and
an in-memory demo. The current behavior and remaining feature gaps are
listed in [docs/PORTAL.md](../../docs/PORTAL.md#current-console).

For owner setup and recovery, use the
[Owner's Manual](../../docs/MANUAL.md). This document is for contributors
changing the Console, not a firmware flashing guide.

## Develop locally

From the repository root, using Node 20:

```sh
npm --prefix portal/console ci
npm --prefix portal/console run typecheck
```

To explore the hosted source with sample data:

```sh
cd portal/console
npx vite --host 127.0.0.1
```

Open the local URL printed by Vite and choose **Explore the interactive
demo**. Keep the development server bound to loopback. A development
origin is not automatically in the firmware's CORS allowlist; use the
device-served Console for a live hardware check unless the permitted
origin is deliberately configured. The older `make portal` command serves
the historical prototype, not this source tree.

## Build targets

- `npm run build:hosted` writes one self-contained HTML file to
  `dist-hosted/index.html`. It has inline CSS and JavaScript, makes no asset
  requests, and is committed so the release chain can compare its exact bytes
  with production, following ADR-0027's generated-header precedent.
- `npm run build:device` writes one self-contained HTML file to `dist-device/`,
  gzips it deterministically at level 9, and regenerates
  `../../firmware/dk01/web_console.h`.
- `npm run build` builds both targets.

Use Node 20. With the pinned dependencies already installed, build from this
directory with:

```sh
npm run build
```

Both generated release artifacts are committed. Do not hand-edit
`dist-hosted/index.html` or the device header; regenerate them from this
directory. The lockfile pins the complete dependency closure, so Vercel and
local clean installs use `npm ci`; no additional `.npmrc` is required.

## Vercel handoff

The prototype-to-Console cutover is complete. Current hosting configuration,
public URLs, and provider-side requirements are owned by
[Operations → Hosting today](../../docs/OPERATIONS.md#hosting-today), under
[ADR-0034](../../docs/adr/ADR-0034-vercel-pro-hosting.md). Do not repeat the
old Root Directory migration. The release procedure is owned by
[AGENTS.md](../../AGENTS.md#release-requests).

## Verify a change

After changing source, regenerate both build targets. Then, from the
repository root:

```sh
make check
make console-verify
git diff --check
```

On a clean committed tree, `console-verify` rebuilds and checks that both
artifacts match the source. Its current final `git diff` compares against
the index, so a legitimate uncommitted artifact change also makes the gate
fail; pre-staging to silence that failure conflicts with the release
preflight. This is an open tooling defect, tracked in
[the repository review](../../docs/reviews/2026-09-08-full-review/repository-and-product.md).
Review source and generated changes together, and report that gate result
accurately until the comparison is repaired. These checks do not establish
browser, LAN, or hardware acceptance. Test
the changed flow in the demo and on the intended device/browser path,
including its error and reconnect states. Build output alone does not
prove a new firmware image booted successfully.

For a dependency change, run `npm audit --package-lock-only`, examine
whether each advisory affects runtime or build tooling, and update the
provenance table below with the lockfile. Do not use an automatic forced
upgrade as a substitute for checking compatibility and both outputs.

## Runtime modes

- The device build talks to same-origin `/api/v1` and `/update` routes.
- The hosted build opens with a welcome flow: enter the panel's address to
  connect over the LAN, or enter the labeled interactive demo. A previously
  saved address bypasses the welcome flow. Browser-dependent hosted access
  and the direct-device fallback are explained in the
  [Owner's Manual](../../docs/MANUAL.md); transport policy belongs to
  [ADR-0031](../../docs/adr/ADR-0031-browser-to-device-transport.md).
- The welcome connect action checks an Ed25519 signed nonce, and pairing
  compares returned identity material with the saved key. Security → Device
  identity offers a manual check. These are not an encrypted or
  automatically verified session: current cached reconnects and the
  `?device=<host>` path can send a saved token without a fresh identity
  check. The security model and current limitations are owned by
  [docs/SECURITY.md](../../docs/SECURITY.md).
- LAN bearer tokens are browser-local. A `401` opens claim-code pairing and
  retries the interrupted request after the panel code is accepted.
- Demo changes last only for the current page load. The demo does not prove
  pairing, firmware update, source-fetch, persistence, or recovery behavior
  on hardware. The older prototype is a separate design reference.

## Source map

| Component | Responsibility |
|---|---|
| `src/main.tsx` | Routing, welcome entry, mode/reachability indicator, pairing dialog |
| `src/transport.ts` | HTTP requests, token storage, identity orchestration, mock route handling, OTA upload |
| `src/identity.ts` | Nonce generation and WebCrypto/pure-JavaScript Ed25519 verification |
| `src/PairingFlow.tsx` | Panel-code entry, manual token entry, identity-change recovery |
| `src/views/` | The eight Console pages plus the hosted welcome view |
| `src/frame.ts`, `src/layouts.ts` | RGB565 frame encoding and the weather starter layout |
| `src/mock.ts`, `src/types.ts` | Demo fixtures and TypeScript response shapes; types do not validate network JSON |
| `src/components.tsx`, `src/styles.css` | Shared UI, clipboard fallback, responsive styling |
| `vite.config.ts`, `scripts/gen-header.mjs` | Single-file builds and deterministic device gzip/header generation |

## Dependency provenance

All dependencies are public packages from the npm registry. Versions are exact
in `package.json` and their complete resolved closure is recorded in
`package-lock.json`.

| Package | Exact version | License | Upstream |
|---|---:|---|---|
| `@noble/ed25519` | 2.3.0 | MIT | <https://github.com/paulmillr/noble-ed25519> |
| `@noble/hashes` | 1.8.0 | MIT | <https://github.com/paulmillr/noble-hashes> |
| `fflate` | 0.8.2 | MIT | <https://github.com/101arrowz/fflate> |
| `preact` | 10.27.2 | MIT | <https://github.com/preactjs/preact> |
| `vite` | 5.4.21 | MIT | <https://github.com/vitejs/vite> |
| `typescript` | 5.9.3 | Apache-2.0 | <https://github.com/microsoft/TypeScript> |
| `@preact/preset-vite` | 2.10.2 | MIT | <https://github.com/preactjs/preset-vite> |
| `vite-plugin-singlefile` | 2.3.0 | MIT | <https://github.com/richardtallent/vite-plugin-singlefile> |
