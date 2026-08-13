# Devmatrix Console

`portal/console/` is the single production Console codebase established by
[ADR-0027](../../docs/adr/ADR-0027-one-console-codebase.md). It uses the Preact,
TypeScript, and Vite stack selected in
[ADR-0014](../../docs/adr/ADR-0014-console-production-stack.md), including only
system UI and native monospace fonts. Packet 2B ported the complete seven-view
Local Console, the live `/api/v1` transport and panel-code pairing flow, plus
an interactive in-memory demo seeded from `docs/USER-STORY.md`. The tree now
adds the hosted welcome/connect flow, the in-console Guide view (eight views
total), and Ed25519 device-identity verification with key pinning (ADR-0031).

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

The `devmatrix-console` project's Root Directory is still `portal/prototype`,
so the mock design reference remains live. **Do not add a repository-root
`vercel.json` before that setting changes** — it is read while the Root
Directory still points at the prototype and fails the build (observed
2026-08-12, deployment 5863328863). Build config and dashboard setting land
together or not at all.

The cutover, as one coordinated change: in Vercel, open **devmatrix-console →
Settings → Build and Deployment → Root Directory → Edit**, clear
`portal/prototype` so the repository root is selected, and save; then release a
commit that adds the root `vercel.json` (`installCommand` `npm --prefix
portal/console ci`, `buildCommand` `npm --prefix portal/console run
build:hosted`, `outputDirectory` `portal/console/dist-hosted`) and flips
`scripts/verify-live.mjs`'s `DEFAULT_FILE` to the hosted artifact. Set the
Node.js Version to 20.x while in that settings page. Do not redeploy the
pre-switch commit from the new root.

`scripts/verify-live.mjs` defaults to the artifact production actually serves
and fails closed if the two disagree. Before the cutover, the hosted artifact
can be checked against a preview deployment with
`DEVMATRIX_LIVE_URL=<preview-url> DEVMATRIX_LIVE_FILE=portal/console/dist-hosted/index.html make verify-live`.
Unset both for the switch release.

## Runtime modes

- The device build talks to same-origin `/api/v1` and `/update` routes.
- The hosted build opens with a welcome flow: enter the panel's address to
  connect over the LAN (ADR-0031 — the browser's Local Network Access
  permission on Chromium/Firefox; firmware v0.9.0+ answers with the
  exact-origin CORS allowlist), or enter a clearly-labeled interactive demo.
  `?device=<host>` still works and is remembered. Safari cannot reach LAN
  devices from a hosted page; the device-served build is the documented
  fallback there and remains the authoritative live path everywhere.
- Connecting verifies the device's Ed25519 signed-nonce identity proof and
  pins the public key in the browser (`src/identity.ts`); pairing re-checks
  the pin, and Security → Device identity re-runs the proof on demand.
- LAN bearer tokens are browser-local. A `401` opens claim-code pairing and
  retries the interrupted request after the panel code is accepted.

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
