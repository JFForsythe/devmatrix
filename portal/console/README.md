# Devmatrix Console

`portal/console/` is the single production Console codebase established by
[ADR-0027](../../docs/adr/ADR-0027-one-console-codebase.md). It uses the Preact,
TypeScript, and Vite stack selected in
[ADR-0014](../../docs/adr/ADR-0014-console-production-stack.md), including only
system UI and native monospace fonts. Packet 2B ports the complete seven-view
Local Console, the live `/api/v1` transport and panel-code pairing flow, plus
an interactive in-memory demo seeded from `docs/USER-STORY.md`.

## Build targets

- `npm run build:hosted` writes the hosted static bundle to `dist-hosted/`.
- `npm run build:device` writes one self-contained HTML file to `dist-device/`,
  gzips it deterministically at level 9, and regenerates
  `../../firmware/dk01/web_console.h`.
- `npm run build` builds both targets.

Use Node 20. With the pinned dependencies already installed, build from this
directory with:

```sh
npm run build
```

The generated header is committed for Arduino IDE users. Do not hand-edit it.

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
