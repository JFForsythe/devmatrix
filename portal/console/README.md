# Devmatrix Console

`portal/console/` is the single production Console codebase established by
[ADR-0027](../../docs/adr/ADR-0027-one-console-codebase.md). It uses the Preact,
TypeScript, and Vite stack selected in
[ADR-0014](../../docs/adr/ADR-0014-console-production-stack.md), including only
system UI and native monospace fonts. Packet 2B ports the complete seven-view
Local Console, the live `/api/v1` transport and panel-code pairing flow, plus
an interactive in-memory demo seeded from `docs/USER-STORY.md`.

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

The repository-root [`vercel.json`](../../vercel.json) builds and publishes the
hosted Console only when the Vercel project's Root Directory is the repository
root. The `devmatrix-console` project is still configured with
`portal/prototype`, so the mock design reference remains live until the owner
changes that dashboard setting.

Coordinate the setting with the switch commit: in Vercel, open
**devmatrix-console → Settings → Build and Deployment → Root Directory → Edit**,
clear `portal/prototype` so the repository root is selected, and save. Do this
immediately before releasing the switch commit; its push then runs the root
`vercel.json` build. Do not redeploy the pre-switch commit from the new root.

`scripts/verify-live.mjs` defaults to the committed hosted artifact and will
fail closed if production still serves the prototype. During the intentional
pre-switch window only, the old deployment can be checked explicitly with
`DEVMATRIX_LIVE_FILE=portal/prototype/index.html make verify-live`. Unset that
override for the switch release.

## Runtime modes

- The device build talks to same-origin `/api/v1` and `/update` routes.
- The hosted build uses live mode when `?device=<host>` is supplied (and
  remembers that address locally); otherwise it uses clearly labeled mock data.
- LAN bearer tokens are browser-local. A `401` opens claim-code pairing and
  retries the interrupted request after the panel code is accepted.

## Dependency provenance

All dependencies are public packages from the npm registry. Versions are exact
in `package.json` and their complete resolved closure is recorded in
`package-lock.json`.

| Package | Exact version | License | Upstream |
|---|---:|---|---|
| `fflate` | 0.8.2 | MIT | <https://github.com/101arrowz/fflate> |
| `preact` | 10.27.2 | MIT | <https://github.com/preactjs/preact> |
| `vite` | 5.4.21 | MIT | <https://github.com/vitejs/vite> |
| `typescript` | 5.9.3 | Apache-2.0 | <https://github.com/microsoft/TypeScript> |
| `@preact/preset-vite` | 2.10.2 | MIT | <https://github.com/preactjs/preset-vite> |
| `vite-plugin-singlefile` | 2.3.0 | MIT | <https://github.com/richardtallent/vite-plugin-singlefile> |
