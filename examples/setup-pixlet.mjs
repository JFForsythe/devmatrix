// SPDX-License-Identifier: GPL-3.0-or-later
//
// One-command Pixlet-bridge setup: everything between "I have a DK-01"
// and "community apps are rendering on my panel", in a single run.
//
//   node examples/setup-pixlet.mjs [--dir ~/tronbyt] [--device http://dmx-xxxx.local]
//
// What it does (idempotent — safe to re-run):
//   1. Checks Node 20+, git, and tar.
//   2. Downloads the pinned Tronbyt Pixlet engine for this OS/CPU and
//      verifies it against a sha256 recorded below BEFORE extracting —
//      the upstream release publishes no checksums, so this file is the
//      integrity record (computed 2026-08-17 from the tagged assets).
//   3. Shallow-clones the community apps catalog (1,000+ apps).
//   4. Installs the bridge's one pinned npm dependency.
//   5. Writes a starter bridge.config.json (never overwrites yours).
//   6. If DMX_TOKEN is set and a device address was given, runs the
//      bridge preflight against your panel.
//
// Provenance (ADR-0030): engine github.com/tronbyt/pixlet v0.53.1
// (Apache-2.0); catalog github.com/tronbyt/apps. Both run on YOUR
// machine — the company renders, proxies, and stores nothing. Your LAN
// token is read from the DMX_TOKEN environment variable and is never
// written to disk or printed by this script.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PIXLET_VERSION = "v0.53.1";
const PIXLET_SHA256 = {
  "darwin-amd64": "2f5c130f23f011867fb3c007862bb24c9eb33d33057b4d264104f6d5c3c9dc97",
  "darwin-arm64": "c7616ebef774c15f2fff1e1f6f849456871c3c9d1cff6cdcb7ecd78944ce60bd",
  "linux-amd64": "8585ae29652bec004c31c1c5af2d9aa682ae86a87e037db6597a86e52fa2cfac",
  "linux-arm64": "3d64306afcf05ebf998cdfa028b0af1c092b6b98a0148806190f0871da960c19",
};

const ok = (msg) => console.log(`[ok] ${msg}`);
const info = (msg) => console.log(`     ${msg}`);
const fail = (msg) => {
  console.error(`[!!] ${msg}`);
  process.exit(1);
};

// ---------------------------------------------------------------- args
const args = process.argv.slice(2);
function argValue(flag) {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : "";
}
if (args.includes("--help") || args.includes("-h")) {
  console.log("usage: node examples/setup-pixlet.mjs [--dir DIR] [--device http://dmx-xxxx.local]");
  process.exit(0);
}
const dir = resolve((argValue("--dir") || join(homedir(), "tronbyt")).replace(/^~(?=\/)/, homedir()));
const device = argValue("--device");
if (device && !/^https?:\/\/[^\s"']+$/.test(device)) fail(`--device must be an http(s) URL, got: ${device}`);

// ---------------------------------------------------------------- checks
const major = Number(process.versions.node.split(".")[0]);
if (major < 20) fail(`Node 20+ required (found ${process.versions.node}).`);
ok(`Node ${process.versions.node}`);
for (const tool of ["git", "tar"]) {
  if (spawnSync(tool, ["--version"], { stdio: "ignore" }).status !== 0) {
    fail(`'${tool}' is required and was not found on PATH.`);
  }
}
ok("git and tar present");

const platform = { darwin: "darwin", linux: "linux" }[process.platform];
const arch = { x64: "amd64", arm64: "arm64" }[process.arch];
if (!platform || !arch) {
  fail(
    `Unsupported platform ${process.platform}/${process.arch} — the bridge targets ` +
      "macOS and Linux (a Raspberry Pi is perfect). See examples/pixlet-bridge/README.md " +
      "for manual setup on anything else.",
  );
}
const assetKey = `${platform}-${arch}`;
mkdirSync(dir, { recursive: true });
ok(`Working directory: ${dir}`);

// ---------------------------------------------------------------- engine
const pixletPath = join(dir, "pixlet");
function pixletRuns() {
  const probe = spawnSync(pixletPath, ["version"], { encoding: "utf8", timeout: 5000 });
  return probe.status === 0 ? probe.stdout.trim() : "";
}
let version = existsSync(pixletPath) ? pixletRuns() : "";
if (version) {
  ok(`Pixlet already installed: ${version}`);
} else {
  const asset = `pixlet_${PIXLET_VERSION}_${assetKey}.tar.gz`;
  const url = `https://github.com/tronbyt/pixlet/releases/download/${PIXLET_VERSION}/${asset}`;
  info(`downloading ${asset} …`);
  const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(300000) });
  if (!response.ok) fail(`Engine download failed: HTTP ${response.status} for ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== PIXLET_SHA256[assetKey]) {
    fail(
      `sha256 mismatch for ${asset}:\n  expected ${PIXLET_SHA256[assetKey]}\n  got      ${digest}\n` +
        "Refusing to install. The upstream asset changed since this script pinned it — " +
        "inspect github.com/tronbyt/pixlet before proceeding.",
    );
  }
  ok(`sha256 verified (${digest.slice(0, 16)}…)`);
  const tarball = join(dir, asset);
  writeFileSync(tarball, bytes);
  const untar = spawnSync("tar", ["xzf", tarball, "-C", dir], { stdio: "inherit" });
  if (untar.status !== 0) fail("tar extraction failed.");
  chmodSync(pixletPath, 0o755);
  version = pixletRuns();
  if (!version) fail("Extracted pixlet binary did not run.");
  ok(`Pixlet installed: ${version}`);
}

// ---------------------------------------------------------------- catalog
const appsDir = join(dir, "apps");
if (existsSync(join(appsDir, ".git"))) {
  info("updating community apps catalog …");
  const pull = spawnSync("git", ["-C", appsDir, "pull", "--ff-only", "--depth", "1"], { stdio: "ignore" });
  ok(pull.status === 0 ? "Catalog updated" : "Catalog present (update skipped — local state)");
} else {
  info("cloning community apps catalog (one-time, ~1 minute) …");
  const clone = spawnSync(
    "git",
    ["clone", "--depth", "1", "https://github.com/tronbyt/apps.git", appsDir],
    { stdio: "inherit" },
  );
  if (clone.status !== 0) fail("Catalog clone failed.");
  ok("Catalog cloned");
}

// ---------------------------------------------------------------- bridge dep
const exampleDir = dirname(fileURLToPath(import.meta.url));
const bridgeDir = join(exampleDir, "pixlet-bridge");
if (!existsSync(join(bridgeDir, "bridge.mjs"))) {
  fail(`Bridge not found at ${bridgeDir} — run this script from a checkout of the devmatrix repo.`);
}
if (existsSync(join(bridgeDir, "node_modules", "gifuct-js"))) {
  ok("Bridge dependency already installed");
} else {
  info("installing the bridge's pinned npm dependency …");
  const npm = spawnSync("npm", ["install", "--no-fund", "--no-audit"], { cwd: bridgeDir, stdio: "inherit" });
  if (npm.status !== 0) fail("npm install failed in examples/pixlet-bridge.");
  ok("Bridge dependency installed");
}

// ---------------------------------------------------------------- config
const configPath = join(dir, "bridge.config.json");
if (existsSync(configPath)) {
  ok(`Config already exists (left untouched): ${configPath}`);
} else {
  const config = {
    device: { url: device || "http://dmx-xxxx.local", tokenEnv: "DMX_TOKEN" },
    pixlet: pixletPath,
    appsDir,
    rotation: [{ app: "dvdlogo", duration_s: 15, render_interval_s: 60, config: {} }],
  };
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
  ok(`Starter config written: ${configPath}`);
  if (!device) info("(edit device.url to your panel's address, e.g. http://dmx-4e71.local)");
}

// ---------------------------------------------------------------- preflight
const haveToken = Boolean(process.env.DMX_TOKEN);
const configuredDevice = JSON.parse(readFileSync(configPath, "utf8")).device.url;
if (haveToken && !configuredDevice.includes("dmx-xxxx")) {
  info("running bridge preflight against your panel …");
  const check = spawnSync(process.execPath, [join(bridgeDir, "bridge.mjs"), "--check"], {
    stdio: "inherit",
    env: { ...process.env, BRIDGE_CONFIG: configPath },
  });
  if (check.status !== 0) fail("Preflight failed — see messages above (is the panel on and paired?).");
} else {
  info(haveToken ? "set device.url in the config, then rerun to preflight" : "DMX_TOKEN not set — preflight skipped");
}

// ---------------------------------------------------------------- next steps
console.log(`
Done. Next steps (token: Console → Dev console → COPY WITH MY TOKEN):

  # push one app for one animation cycle:
  DMX_TOKEN='<LAN token>' BRIDGE_CONFIG=${configPath} \\
    node ${join("examples", "pixlet-bridge", "bridge.mjs")} --once dvdlogo

  # browse the catalog:            ls ${join(appsDir, "apps")}
  # edit your rotation:            ${configPath}
  # make it a permanent service:   node examples/install-pixlet-bridge.mjs --config ${configPath}
  #   (Linux/Pi: sudo "$(command -v node)" examples/install-pixlet-bridge.mjs --config ${configPath})
`);
