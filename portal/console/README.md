# Devmatrix Console

`portal/console/` is the single production Console codebase established by
[ADR-0027](../../docs/adr/ADR-0027-one-console-codebase.md). It uses the Preact,
TypeScript, and Vite stack selected in
[ADR-0014](../../docs/adr/ADR-0014-console-production-stack.md), including only
system UI and native monospace fonts. The current implementation is pipeline
scaffolding with placeholder routes; no production view behavior has been
ported.

## Build targets

- `npm run build:hosted` writes the hosted static bundle to `dist-hosted/`.
- `npm run build:device` writes one self-contained HTML file to `dist-device/`,
  gzips it deterministically at level 9, and regenerates
  `../../firmware/dk01/web_console_next.h`.
- `npm run build` builds both targets.

Use Node 20. From this directory, install and build with:

```sh
npm ci
npm run build
```

The generated header is committed for Arduino IDE users, but it is not wired
into the running firmware during this scaffold phase. Do not hand-edit it.

## Dependency provenance

All dependencies are public packages from the npm registry. Versions are exact
in `package.json` and their complete resolved closure is recorded in
`package-lock.json`.

| Package | Exact version | License | Upstream |
|---|---:|---|---|
| `preact` | 10.27.2 | MIT | <https://github.com/preactjs/preact> |
| `vite` | 5.4.21 | MIT | <https://github.com/vitejs/vite> |
| `typescript` | 5.9.3 | Apache-2.0 | <https://github.com/microsoft/TypeScript> |
| `@preact/preset-vite` | 2.10.2 | MIT | <https://github.com/preactjs/preset-vite> |
| `vite-plugin-singlefile` | 2.3.0 | MIT | <https://github.com/richardtallent/vite-plugin-singlefile> |
