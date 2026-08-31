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
//   3. Checks out the community apps catalog (1,000+ apps) at an
//      approved, immutable commit without discarding local changes.
//   4. Installs the bridge's one pinned npm dependency.
//   5. Writes a mode-0600 starter bridge.config.json. On reruns,
//      --device updates only device.url and preserves the rest.
//   6. If DMX_TOKEN is set and a device address was given, runs the
//      bridge preflight against your panel.
//
// Provenance (ADR-0030): engine github.com/tronbyt/pixlet v0.53.1
// (Apache-2.0); catalog github.com/tronbyt/apps at commit
// d0141abcb2f6c92192f2bed0509ae9678915d61c. Both run on YOUR
// machine — the company renders, proxies, and stores nothing. Your LAN
// token is read from the DMX_TOKEN environment variable and is never
// written to disk or printed by this script.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PIXLET_VERSION = "v0.53.1";
const APPS_REPOSITORY = "https://github.com/tronbyt/apps.git";
const APPS_COMMIT = "d0141abcb2f6c92192f2bed0509ae9678915d61c";
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

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseConfig(configPath) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(configPath, "utf8"));
  } catch (error) {
    throw new Error(`Cannot parse ${configPath} as JSON: ${error.message}`);
  }
  if (!isObject(parsed)) throw new Error(`${configPath} must contain a JSON object.`);
  if (parsed.device !== undefined && !isObject(parsed.device)) {
    throw new Error(`${configPath} device must be a JSON object.`);
  }
  return parsed;
}

function writeConfigAtomic(configPath, config) {
  const temporaryPath = `${configPath}.tmp-${process.pid}-${Date.now()}`;
  try {
    writeFileSync(temporaryPath, `${JSON.stringify(config, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    chmodSync(temporaryPath, 0o600);
    renameSync(temporaryPath, configPath);
    chmodSync(configPath, 0o600);
  } finally {
    if (existsSync(temporaryPath)) rmSync(temporaryPath);
  }
}

function runSelfTest() {
  const testDir = mkdtempSync(join(tmpdir(), "devmatrix-setup-pixlet-"));
  const configPath = join(testDir, "bridge.config.json");
  try {
    const original = {
      device: { url: "http://old.local", tokenEnv: "DMX_TOKEN" },
      rotation: [{ app: "clock", duration_s: 30, config: { timezone: "UTC" } }],
      extension: { preserved: true },
    };
    writeFileSync(configPath, `${JSON.stringify(original, null, 2)}\n`, { mode: 0o644 });
    const updated = parseConfig(configPath);
    updated.device.url = "http://new.local";
    writeConfigAtomic(configPath, updated);
    const actual = parseConfig(configPath);
    if (actual.device.url !== "http://new.local") throw new Error("device.url was not updated");
    if (actual.device.tokenEnv !== "DMX_TOKEN") throw new Error("device settings were not preserved");
    if (actual.rotation[0].config.timezone !== "UTC" || actual.extension.preserved !== true) {
      throw new Error("unrelated config fields were not preserved");
    }
    if ((statSync(configPath).mode & 0o777) !== 0o600) throw new Error("config mode is not 0600");
    ok("Self-test passed (atomic config update, field preservation, mode 0600)");
  } finally {
    rmSync(testDir, { recursive: true });
  }
}

// ---------------------------------------------------------------- args
const args = process.argv.slice(2);
function argValue(flag) {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : "";
}
if (args.includes("--help") || args.includes("-h")) {
  console.log(
    "usage: node examples/setup-pixlet.mjs [--dir DIR] [--device http://dmx-xxxx.local] [--self-test]",
  );
  process.exit(0);
}
if (args.includes("--self-test")) {
  runSelfTest();
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

// Parse and secure an existing config before any download, checkout, or npm
// operation. A malformed config fails after its permissions are tightened,
// without changing the engine, catalog, or bridge dependency.
const configPath = join(dir, "bridge.config.json");
const configAlreadyExists = existsSync(configPath);
let config;
if (configAlreadyExists) {
  try {
    chmodSync(configPath, 0o600);
    config = parseConfig(configPath);
  } catch (error) {
    fail(error.message);
  }
}

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
const catalogGitDir = join(appsDir, ".git");
if (existsSync(appsDir) && !existsSync(catalogGitDir)) {
  fail(`${appsDir} already exists but is not a Git checkout; refusing to replace it.`);
}
if (!existsSync(catalogGitDir)) {
  info("creating community apps catalog checkout (one-time, ~1 minute) …");
  const init = spawnSync("git", ["init", "--quiet", appsDir], { stdio: "inherit" });
  if (init.status !== 0) fail("Catalog Git initialization failed.");
}

const catalogStatus = spawnSync(
  "git",
  ["-C", appsDir, "status", "--porcelain=v1", "--untracked-files=all"],
  { encoding: "utf8" },
);
if (catalogStatus.status !== 0) fail(`Cannot inspect local changes in ${appsDir}.`);
const catalogDirty = catalogStatus.stdout.trim().length > 0;
const catalogHeadProbe = spawnSync("git", ["-C", appsDir, "rev-parse", "--verify", "HEAD"], {
  encoding: "utf8",
});
let catalogHead = catalogHeadProbe.status === 0 ? catalogHeadProbe.stdout.trim() : "";

if (catalogHead !== APPS_COMMIT) {
  if (catalogDirty) {
    fail(
      `Catalog has local or ignored files and is based on ${catalogHead || "an incomplete checkout"}. ` +
        `Preserved it unchanged instead of switching to approved commit ${APPS_COMMIT}. ` +
        "Commit, stash, remove, or move those files, then rerun.",
    );
  }
  const catalogBranch = spawnSync("git", ["-C", appsDir, "symbolic-ref", "--quiet", "--short", "HEAD"], {
    encoding: "utf8",
  });
  if (catalogHead && catalogBranch.status !== 0) {
    // A clean detached HEAD is this script's own resting state from an
    // earlier approved pin, so a plain rerun after a pin bump must not
    // fail. Prove the commit exists upstream before moving off it; only a
    // commit the catalog repository does not recognize (local work) is
    // preserved behind a failure.
    info(`catalog is detached at ${catalogHead}; confirming it is an upstream commit …`);
    const upstreamProbe = spawnSync(
      "git",
      ["-C", appsDir, "fetch", "--depth", "1", APPS_REPOSITORY, catalogHead],
      { stdio: "ignore" },
    );
    if (upstreamProbe.status !== 0) {
      fail(
        `Catalog is detached at ${catalogHead}, which the catalog repository does not recognize — ` +
          "it looks like local work. Preserved it unchanged; switch it to a branch or move the " +
          "checkout, then rerun.",
      );
    }
  }
  info(`fetching approved catalog commit ${APPS_COMMIT} …`);
  const fetchCommit = spawnSync(
    "git",
    ["-C", appsDir, "fetch", "--depth", "1", APPS_REPOSITORY, APPS_COMMIT],
    { stdio: "inherit" },
  );
  if (fetchCommit.status !== 0) fail(`Catalog fetch failed for approved commit ${APPS_COMMIT}.`);
  const checkoutCommit = spawnSync("git", ["-C", appsDir, "checkout", "--detach", APPS_COMMIT], {
    stdio: "inherit",
  });
  if (checkoutCommit.status !== 0) fail(`Catalog checkout failed for approved commit ${APPS_COMMIT}.`);
  catalogHead = APPS_COMMIT;
} else if (catalogDirty) {
  info("Catalog local or ignored files detected; preserving them on the approved base commit.");
}

const resolvedCatalog = spawnSync("git", ["-C", appsDir, "rev-parse", "HEAD"], { encoding: "utf8" });
if (resolvedCatalog.status !== 0) fail("Cannot resolve the installed catalog commit.");
catalogHead = resolvedCatalog.stdout.trim();
if (catalogHead !== APPS_COMMIT) {
  fail(`Catalog resolved to ${catalogHead}, expected approved commit ${APPS_COMMIT}.`);
}
ok(`Catalog commit: ${catalogHead}${catalogDirty ? " (local files preserved)" : ""}`);

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
if (configAlreadyExists) {
  if (device) {
    config.device ??= {};
    if (config.device.url !== device) {
      config.device.url = device;
      try {
        writeConfigAtomic(configPath, config);
      } catch (error) {
        fail(`Cannot atomically update ${configPath}: ${error.message}`);
      }
      ok(`Config device updated; other settings preserved: ${configPath}`);
    } else {
      ok(`Config device already set; mode secured to 0600: ${configPath}`);
    }
  } else {
    ok(`Config preserved; mode secured to 0600: ${configPath}`);
  }
} else {
  config = {
    device: { url: device || "http://dmx-xxxx.local", tokenEnv: "DMX_TOKEN" },
    pixlet: pixletPath,
    appsDir,
    rotation: [{ app: "dvdlogo", duration_s: 15, render_interval_s: 60, config: {} }],
  };
  try {
    writeConfigAtomic(configPath, config);
  } catch (error) {
    fail(`Cannot atomically create ${configPath}: ${error.message}`);
  }
  ok(`Starter config written with mode 0600: ${configPath}`);
  if (!device) info("(edit device.url to your panel's address, e.g. http://dmx-0952.local)");
}

// ---------------------------------------------------------------- preflight
const haveToken = Boolean(process.env.DMX_TOKEN);
const configuredDevice = typeof config.device?.url === "string" ? config.device.url : "";
if (haveToken && configuredDevice && !configuredDevice.includes("dmx-xxxx")) {
  info("running bridge preflight against your panel …");
  const check = spawnSync(process.execPath, [join(bridgeDir, "bridge.mjs"), "--check"], {
    stdio: "inherit",
    env: { ...process.env, BRIDGE_CONFIG: configPath },
  });
  if (check.status !== 0) fail("Preflight failed — see messages above (is the panel on and paired?).");
} else {
  info(
    haveToken
      ? "set device.url in the config, then rerun to preflight"
      : "DMX_TOKEN not set — preflight skipped",
  );
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
