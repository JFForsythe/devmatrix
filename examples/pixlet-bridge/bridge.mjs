#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later

import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BRIDGE_PATH = fileURLToPath(import.meta.url);
const BRIDGE_DIR = path.dirname(BRIDGE_PATH);
const DEFAULT_CONFIG_PATH = path.join(BRIDGE_DIR, "bridge.config.json");
const WIDTH = 64;
const HEIGHT = 32;
const FRAME_BYTES = WIDTH * HEIGHT * 2;
const MIN_DELAY_MS = Math.ceil(1000 / 15);
const PIXLET_TIMEOUT_MS = 30_000;
const PIXLET_RELEASES = "https://github.com/tronbyt/pixlet/releases";
const APPS_UPSTREAM = "https://github.com/tronbyt/apps";

let activeChild = null;
let runtime = null;
let shuttingDown = false;

function usage() {
  return `Usage: node examples/pixlet-bridge/bridge.mjs [mode]

Modes:
  --check               Check Node, Pixlet, apps, token, and device health
  --once APP            Render and push one animation cycle
  --render-test APP     Render/decode only; preserve GIF and frame-0.ppm
  --dry-run             Print the complete rotation plan; do no I/O
  --self-test           Test RGB565 byte order and the frame-delay clamp
  --help                Show this help

Configuration defaults to ${DEFAULT_CONFIG_PATH}.
Set BRIDGE_CONFIG to use another file; the device token comes from the
environment variable named by device.tokenEnv.`;
}

function parseArgs(argv) {
  const options = {
    check: false,
    dryRun: false,
    help: false,
    once: null,
    renderTest: null,
    selfTest: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--check") options.check = true;
    else if (argument === "--dry-run") options.dryRun = true;
    else if (argument === "--self-test") options.selfTest = true;
    else if (argument === "--help" || argument === "-h") options.help = true;
    else if (argument === "--once" || argument === "--render-test") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${argument} requires an app.`);
      index += 1;
      if (argument === "--once") options.once = value;
      else options.renderTest = value;
    } else {
      throw new Error(`Unknown option: ${argument}`);
    }
  }

  const modes = [
    options.check,
    options.dryRun,
    options.once !== null,
    options.renderTest !== null,
    options.selfTest,
  ].filter(Boolean).length;
  if (modes > 1) throw new Error("Choose only one mode.");
  return options;
}

function assertNode20() {
  const major = Number.parseInt(process.versions.node, 10);
  if (major < 20) throw new Error(`Node 20 or newer is required (found ${process.versions.node}).`);
}

function readConfig() {
  const configPath = path.resolve(process.env.BRIDGE_CONFIG || DEFAULT_CONFIG_PATH);
  let source;
  try {
    source = fs.readFileSync(configPath, "utf8");
  } catch (error) {
    throw new Error(`Could not read bridge config ${configPath}: ${error.message}`);
  }

  let raw;
  try {
    raw = JSON.parse(source);
  } catch (error) {
    throw new Error(`Invalid JSON in ${configPath}: ${error.message}`);
  }
  return normalizeConfig(raw, configPath);
}

function normalizeConfig(raw, configPath) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`Bridge config must be a JSON object: ${configPath}`);
  }
  if (!raw.device || typeof raw.device !== "object" || Array.isArray(raw.device)) {
    throw new Error("device must be an object with url and tokenEnv.");
  }
  if (typeof raw.device.url !== "string" || !raw.device.url.trim()) {
    throw new Error("device.url must be a non-empty http:// or https:// URL.");
  }
  let deviceUrl;
  try {
    const parsed = new URL(raw.device.url);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("unsupported protocol");
    if (parsed.username || parsed.password) throw new Error("credentials do not belong in device.url");
    deviceUrl = raw.device.url.replace(/\/+$/, "");
  } catch (error) {
    throw new Error(`device.url must be a complete http:// or https:// URL (${error.message}).`);
  }
  if (
    typeof raw.device.tokenEnv !== "string" ||
    !/^[A-Za-z_][A-Za-z0-9_]*$/.test(raw.device.tokenEnv)
  ) {
    throw new Error("device.tokenEnv must be an environment-variable name such as DMX_TOKEN.");
  }
  if (typeof raw.pixlet !== "string" || !raw.pixlet.trim()) {
    throw new Error('pixlet must be "auto" or a binary path.');
  }
  if (typeof raw.appsDir !== "string" || !raw.appsDir.trim()) {
    throw new Error("appsDir must name the local Tronbyt apps checkout.");
  }
  if (!Array.isArray(raw.rotation) || raw.rotation.length === 0) {
    throw new Error("rotation must contain at least one app slot.");
  }

  const rotation = raw.rotation.map((slot, index) => normalizeSlot(slot, index));
  const configDir = path.dirname(configPath);
  return {
    configPath,
    device: { url: deviceUrl, tokenEnv: raw.device.tokenEnv },
    pixlet: raw.pixlet === "auto" ? "auto" : resolveFrom(configDir, raw.pixlet),
    appsDir: resolveFrom(configDir, raw.appsDir),
    rotation,
  };
}

function resolveFrom(base, value) {
  return path.isAbsolute(value) ? path.normalize(value) : path.resolve(base, value);
}

function normalizeSlot(slot, index) {
  const label = `rotation[${index}]`;
  if (!slot || typeof slot !== "object" || Array.isArray(slot)) {
    throw new Error(`${label} must be an object.`);
  }
  if (typeof slot.app !== "string" || !slot.app.trim()) {
    throw new Error(`${label}.app must be a non-empty app name or relative .star path.`);
  }
  const durationS = Number(slot.duration_s);
  const renderIntervalS = Number(slot.render_interval_s);
  if (!Number.isFinite(durationS) || durationS <= 0) {
    throw new Error(`${label}.duration_s must be a positive number.`);
  }
  if (!Number.isFinite(renderIntervalS) || renderIntervalS < 0) {
    throw new Error(`${label}.render_interval_s must be zero or a positive number.`);
  }
  const appConfig = slot.config ?? {};
  if (!appConfig || typeof appConfig !== "object" || Array.isArray(appConfig)) {
    throw new Error(`${label}.config must be an object.`);
  }
  for (const [key, value] of Object.entries(appConfig)) {
    if (!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(key)) {
      throw new Error(`${label}.config has an invalid key: ${key}`);
    }
    if (value !== null && !["string", "number", "boolean"].includes(typeof value)) {
      throw new Error(`${label}.config.${key} must be a string, number, boolean, or null.`);
    }
  }
  return {
    app: slot.app,
    duration_s: durationS,
    render_interval_s: renderIntervalS,
    config: appConfig,
  };
}

function pixletBinary(config) {
  return config.pixlet === "auto" ? "pixlet" : config.pixlet;
}

function printPlan(config) {
  console.log("Devmatrix Pixlet bridge dry run");
  console.log(`Config: ${config.configPath}`);
  console.log(`Device: ${config.device.url} (LAN frame API)`);
  console.log(
    `Token: environment ${config.device.tokenEnv} (${process.env[config.device.tokenEnv] ? "set" : "not set"}; value hidden)`,
  );
  console.log(`Pixlet: ${config.pixlet === "auto" ? "pixlet on PATH (auto)" : config.pixlet}`);
  console.log(`Apps checkout: ${config.appsDir}`);
  console.log("Rotation:");
  config.rotation.forEach((slot, index) => {
    const keys = Object.keys(slot.config);
    console.log(
      `  ${index + 1}. ${slot.app} — show ${slot.duration_s}s; render every ${slot.render_interval_s}s; ` +
        `config ${keys.length ? `${keys.join(", ")} (values hidden)` : "none"}`,
    );
  });
  console.log(
    `Playback: native ${WIDTH}x${HEIGHT}, RGB565 little-endian (${FRAME_BYTES} bytes), delays >=${MIN_DELAY_MS}ms.`,
  );
  console.log("Dry run complete: no Pixlet process started and no device contacted.");
}

function runCaptured(command, args, timeoutMs, secrets = []) {
  return new Promise((resolve, reject) => {
    const child = execFile(
      command,
      args,
      { encoding: "utf8", timeout: timeoutMs, killSignal: "SIGKILL", maxBuffer: 1024 * 1024 },
      (error, stdout, stderr) => {
        if (activeChild === child) activeChild = null;
        if (!error) {
          resolve({ stdout, stderr });
          return;
        }
        if (error.code === "ENOENT") {
          reject(new Error(`Could not find executable: ${command}`));
          return;
        }
        const detail = redact((stderr || stdout || "").trim(), secrets);
        if (error.killed || error.signal === "SIGKILL") {
          reject(new Error(`Process exceeded its ${Math.round(timeoutMs / 1000)} s timeout.`));
          return;
        }
        reject(
          new Error(
            `Process exited with status ${typeof error.code === "number" ? error.code : "unknown"}` +
              `${detail ? `: ${detail.slice(0, 800)}` : "."}`,
          ),
        );
      },
    );
    activeChild = child;
  });
}

function redact(text, secrets) {
  let safe = text;
  for (const secret of secrets) {
    if (secret !== "") safe = safe.split(String(secret)).join("***REDACTED***");
  }
  return safe;
}

async function preflight(config, { device = true, token = true } = {}) {
  let failed = false;
  const fail = message => {
    failed = true;
    console.error(`[fail] ${message}`);
  };

  const nodeMajor = Number.parseInt(process.versions.node, 10);
  if (nodeMajor >= 20) console.log(`[ok] Node ${process.versions.node}`);
  else fail(`Node 20 or newer is required (found ${process.versions.node}).`);

  if (fs.existsSync(config.appsDir) && fs.statSync(config.appsDir).isDirectory()) {
    console.log(`[ok] Apps checkout: ${config.appsDir}`);
  } else {
    fail(`Apps checkout not found: ${config.appsDir}`);
    console.error(
      `       Clone it on this owner host: git clone ${APPS_UPSTREAM}.git /path/to/tronbyt-apps`,
    );
    console.error("       Then set appsDir to that checkout.");
  }

  if (token) {
    if (process.env[config.device.tokenEnv]) {
      console.log(`[ok] Token environment: ${config.device.tokenEnv} is set (value hidden)`);
    } else {
      fail(`Token environment ${config.device.tokenEnv} is not set.`);
      console.error("       Pair in the Console, then export the LAN token on this owner host.");
    }
  }

  try {
    const result = await runCaptured(pixletBinary(config), ["version"], 5_000);
    const version = (result.stdout || result.stderr || "").trim().split(/\r?\n/, 1)[0];
    console.log(`[ok] Pixlet: ${version || pixletBinary(config)}`);
  } catch (error) {
    fail(`Pixlet is unavailable: ${error.message}`);
    console.error(`       Install the Tronbyt Pixlet build for this machine: ${PIXLET_RELEASES}`);
    console.error('       Then put "pixlet" on PATH or set pixlet to its absolute path.');
  }

  if (device && failed) {
    console.error("[skip] Device health was not contacted until the owner-host prerequisites pass.");
  } else if (device) {
    try {
      const response = await fetch(`${config.device.url}/api/v1/health`, {
        signal: AbortSignal.timeout(4_000),
      });
      await response.arrayBuffer();
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      console.log(`[ok] Device health: ${config.device.url}/api/v1/health`);
    } catch (error) {
      fail(`Device health is unreachable at ${config.device.url}: ${error.message}`);
      console.error("       Keep the owner host and DK-01 on the same LAN and check device.url.");
    }
  }

  if (failed) console.error("Preflight failed; fix the items above and run --check again.");
  else console.log("Preflight passed.");
  return !failed;
}

function appPathFor(config, appReference) {
  const candidates = [];
  if (appReference.includes("/") || appReference.includes("\\") || appReference.endsWith(".star")) {
    candidates.push(path.resolve(config.appsDir, appReference));
  } else {
    // The community repo names files in snake_case inside each app's
    // directory (apps/abstractclock/abstract_clock.star), so resolving by
    // name must try the directory itself — pixlet renders app directories
    // natively — before guessing file names.
    candidates.push(
      path.join(config.appsDir, "apps", appReference),
      path.join(config.appsDir, appReference),
      path.join(config.appsDir, "apps", appReference, `${appReference}.star`),
      path.join(config.appsDir, appReference, `${appReference}.star`),
      path.join(config.appsDir, `${appReference}.star`),
    );
  }

  for (const candidate of candidates) {
    const relative = path.relative(config.appsDir, candidate);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error(`App path escapes appsDir: ${appReference}`);
    }
  }
  const found = candidates.find(candidate => fs.existsSync(candidate));
  if (found) return found;
  throw new Error(
    `App "${appReference}" was not found under ${config.appsDir}. Tried: ${candidates
      .map(candidate => path.relative(config.appsDir, candidate))
      .join(", ")}`,
  );
}

function pixletConfigArgs(appConfig) {
  return Object.entries(appConfig).map(([key, value]) => `${key}=${value === null ? "" : String(value)}`);
}

async function renderApp(config, slot, { keepTemp = false } = {}) {
  const appPath = appPathFor(config, slot.app);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dmx-pixlet-"));
  const gifPath = path.join(tempDir, "render.gif");
  const configArgs = pixletConfigArgs(slot.config);
  const secrets = Object.values(slot.config).filter(
    value => value !== null && String(value).length > 0,
  );

  try {
    await runCaptured(
      pixletBinary(config),
      // --format gif is required: this pixlet emits WebP by default even
      // when the output path ends in .gif (verified against tronbyt
      // pixlet v0.53.1).
      ["render", "--format", "gif", "--output", gifPath, appPath, ...configArgs],
      PIXLET_TIMEOUT_MS,
      secrets,
    );
    if (!fs.existsSync(gifPath)) {
      throw new Error(`Pixlet did not create the requested GIF for app "${slot.app}".`);
    }
    const gifBytes = fs.readFileSync(gifPath);
    if (gifBytes.subarray(0, 3).toString("ascii") !== "GIF") {
      throw new Error(`Pixlet output for app "${slot.app}" is not a GIF.`);
    }
    const decoded = await decodeGif(gifBytes, slot.app);
    return { ...decoded, tempDir: keepTemp ? tempDir : null, gifPath: keepTemp ? gifPath : null };
  } catch (error) {
    throw new Error(`Render failed for app "${slot.app}": ${redact(error.message, secrets)}`);
  } finally {
    if (!keepTemp) fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function decodeGif(gifBytes, appName) {
  let gifuct;
  try {
    gifuct = await import("gifuct-js");
  } catch {
    throw new Error(
      "gifuct-js@2.1.2 is not installed; run npm install in examples/pixlet-bridge.",
    );
  }
  const parseGIF = gifuct.parseGIF ?? gifuct.default?.parseGIF;
  const decompressFrames = gifuct.decompressFrames ?? gifuct.default?.decompressFrames;
  if (typeof parseGIF !== "function" || typeof decompressFrames !== "function") {
    throw new Error("gifuct-js@2.1.2 did not expose parseGIF and decompressFrames.");
  }

  const arrayBuffer = gifBytes.buffer.slice(
    gifBytes.byteOffset,
    gifBytes.byteOffset + gifBytes.byteLength,
  );
  const parsed = parseGIF(arrayBuffer);
  const width = Number(parsed?.lsd?.width);
  const height = Number(parsed?.lsd?.height);
  if (width !== WIDTH || height !== HEIGHT) {
    throw new Error(
      `App "${appName}" rendered ${width || "?"}x${height || "?"}; expected exactly ${WIDTH}x${HEIGHT} (scaling is disabled).`,
    );
  }

  const decompressed = decompressFrames(parsed, true);
  if (!Array.isArray(decompressed) || decompressed.length === 0) {
    throw new Error(`App "${appName}" rendered a GIF with no image frames.`);
  }
  const rgbaFrames = coalesceFrames(parsed, decompressed, appName);
  return {
    width,
    height,
    frames: rgbaFrames.map((rgba, index) => ({
      rgba,
      sourceDelayMs: normalizedSourceDelay(decompressed[index].delay),
      delayMs: clampDelay(decompressed[index].delay),
    })),
  };
}

function normalizedSourceDelay(value) {
  const delay = Number(value);
  return Number.isFinite(delay) && delay >= 0 ? delay : 0;
}

function clampDelay(value) {
  return Math.max(MIN_DELAY_MS, normalizedSourceDelay(value));
}

function coalesceFrames(parsed, frames, appName) {
  const background = gifBackground(parsed);
  let canvas = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
  fillCanvas(canvas, background);
  let previous = null;
  const output = [];

  for (let index = 0; index < frames.length; index += 1) {
    if (previous?.disposalType === 2) {
      fillRect(canvas, previous.dims, background);
    } else if (previous?.disposalType === 3 && previous.restore) {
      canvas = previous.restore;
    }

    const frame = frames[index];
    const dims = frame.dims;
    validatePatch(frame, dims, appName, index);
    const restore = frame.disposalType === 3 ? canvas.slice() : null;
    overlayPatch(canvas, frame.patch, dims);
    output.push(canvas.slice());
    previous = { disposalType: frame.disposalType, dims, restore };
  }
  return output;
}

function gifBackground(parsed) {
  const index = Number(parsed?.lsd?.backgroundColorIndex);
  const color = Number.isInteger(index) ? parsed?.gct?.[index] : null;
  if ((!Array.isArray(color) && !ArrayBuffer.isView(color)) || color.length < 3) {
    return [0, 0, 0, 0];
  }
  return [color[0], color[1], color[2], 255];
}

function fillCanvas(canvas, color) {
  for (let offset = 0; offset < canvas.length; offset += 4) {
    canvas[offset] = color[0];
    canvas[offset + 1] = color[1];
    canvas[offset + 2] = color[2];
    canvas[offset + 3] = color[3];
  }
}

function validatePatch(frame, dims, appName, index) {
  if (
    !dims ||
    !Number.isInteger(dims.left) ||
    !Number.isInteger(dims.top) ||
    !Number.isInteger(dims.width) ||
    !Number.isInteger(dims.height) ||
    dims.left < 0 ||
    dims.top < 0 ||
    dims.width <= 0 ||
    dims.height <= 0 ||
    dims.left + dims.width > WIDTH ||
    dims.top + dims.height > HEIGHT
  ) {
    throw new Error(`App "${appName}" has invalid GIF frame ${index} bounds.`);
  }
  if (!frame.patch || frame.patch.length !== dims.width * dims.height * 4) {
    throw new Error(`App "${appName}" has an invalid RGBA patch in GIF frame ${index}.`);
  }
}

function fillRect(canvas, dims, color) {
  for (let y = 0; y < dims.height; y += 1) {
    for (let x = 0; x < dims.width; x += 1) {
      const offset = ((dims.top + y) * WIDTH + dims.left + x) * 4;
      canvas[offset] = color[0];
      canvas[offset + 1] = color[1];
      canvas[offset + 2] = color[2];
      canvas[offset + 3] = color[3];
    }
  }
}

function overlayPatch(canvas, patch, dims) {
  for (let y = 0; y < dims.height; y += 1) {
    for (let x = 0; x < dims.width; x += 1) {
      const patchOffset = (y * dims.width + x) * 4;
      const alpha = patch[patchOffset + 3];
      if (alpha === 0) continue;
      const canvasOffset = ((dims.top + y) * WIDTH + dims.left + x) * 4;
      canvas[canvasOffset] = patch[patchOffset];
      canvas[canvasOffset + 1] = patch[patchOffset + 1];
      canvas[canvasOffset + 2] = patch[patchOffset + 2];
      canvas[canvasOffset + 3] = alpha;
    }
  }
}

function rgbaToRgb565(rgba, width = WIDTH, height = HEIGHT) {
  if (rgba.length !== width * height * 4) {
    throw new Error(`RGBA buffer is ${rgba.length} bytes; expected ${width * height * 4}.`);
  }
  const bytes = Buffer.alloc(width * height * 2);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const source = pixel * 4;
    const alpha = rgba[source + 3] / 255;
    const red = Math.round(rgba[source] * alpha);
    const green = Math.round(rgba[source + 1] * alpha);
    const blue = Math.round(rgba[source + 2] * alpha);
    const value = ((red >> 3) << 11) | ((green >> 2) << 5) | (blue >> 3);
    bytes.writeUInt16LE(value, pixel * 2);
  }
  return bytes;
}

// Every frame renews a device-side lease so firmware 0.12.3+ returns to its
// own clock/rotation if this owner-hosted process is killed or the host
// loses power, instead of freezing on the last Pixlet frame. The lease must
// outlive the sleep that FOLLOWS the frame — slideshow apps legally use
// multi-second frame delays, and slot handoffs re-render synchronously — or
// the panel flaps to its clock mid-animation. Worst-case dead-host recovery
// stays ≤ 30 s (the firmware's cap).
function leaseFor(delayMs) {
  return Math.min(30_000, Math.max(10_000, (Number(delayMs) || 0) + 5_000));
}

async function pushFrame(config, token, rgba, leaseMs) {
  const bytes = rgbaToRgb565(rgba);
  if (bytes.length !== FRAME_BYTES) throw new Error(`Frame encoded to ${bytes.length} bytes.`);
  const response = await fetch(`${config.device.url}/api/v1/display/frame`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ b64: bytes.toString("base64"), lease_ms: leaseMs }),
    signal: AbortSignal.timeout(4_000),
  });
  const status = response.status;
  await response.arrayBuffer();
  if (!response.ok) throw new Error(`Frame push returned HTTP ${status}.`);
}

async function pushAnimationOnce(config, token, rendered) {
  for (let index = 0; index < rendered.frames.length; index += 1) {
    const frame = rendered.frames[index];
    await pushFrame(config, token, frame.rgba, leaseFor(frame.delayMs));
    if (index < rendered.frames.length - 1) await sleep(frame.delayMs);
  }
}

async function showSlot(config, token, slot, rendered) {
  const deadline = Date.now() + slot.duration_s * 1000;
  let index = 0;
  while (!shuttingDown && Date.now() < deadline) {
    const frame = rendered.frames[index % rendered.frames.length];
    await pushFrame(config, token, frame.rgba, leaseFor(frame.delayMs));
    index += 1;
    const remaining = deadline - Date.now();
    if (remaining > 0) await sleep(Math.min(frame.delayMs, remaining));
  }
}

async function runRotation(config, token) {
  const cache = new Map();
  console.log(`Pixlet bridge running ${config.rotation.length} slot(s); press Ctrl-C to stop.`);
  while (!shuttingDown) {
    for (const slot of config.rotation) {
      if (shuttingDown) break;
      const key = `${slot.app}\0${JSON.stringify(slot.config)}`;
      let entry = cache.get(key);
      const stale = !entry || Date.now() - entry.at >= slot.render_interval_s * 1000;
      if (stale) {
        try {
          console.log(`[render] ${slot.app}`);
          const rendered = await renderApp(config, slot);
          entry = { at: Date.now(), rendered };
          cache.set(key, entry);
          console.log(`[ready] ${slot.app}: ${entry.rendered.frames.length} frame(s)`);
        } catch (error) {
          cache.set(key, { at: Date.now(), rendered: null });
          console.error(`[skip] ${error.message}`);
          await sleep(Math.min(1000, slot.duration_s * 1000));
          continue;
        }
      }
      if (!entry.rendered) {
        console.error(`[skip] ${slot.app}: waiting for its next render interval after a failure.`);
        await sleep(Math.min(1000, slot.duration_s * 1000));
        continue;
      }
      try {
        console.log(`[show] ${slot.app} for ${slot.duration_s}s`);
        await showSlot(config, token, slot, entry.rendered);
      } catch (error) {
        console.error(`[skip] ${slot.app} push failed: ${error.message}`);
      }
    }
  }
}

function slotForApp(config, app) {
  return (
    config.rotation.find(slot => slot.app === app) ?? {
      app,
      duration_s: 1,
      render_interval_s: 0,
      config: {},
    }
  );
}

function writePpm(file, rgba) {
  const rgb = Buffer.alloc(WIDTH * HEIGHT * 3);
  for (let pixel = 0; pixel < WIDTH * HEIGHT; pixel += 1) {
    const source = pixel * 4;
    const target = pixel * 3;
    const alpha = rgba[source + 3] / 255;
    rgb[target] = Math.round(rgba[source] * alpha);
    rgb[target + 1] = Math.round(rgba[source + 1] * alpha);
    rgb[target + 2] = Math.round(rgba[source + 2] * alpha);
  }
  fs.writeFileSync(file, Buffer.concat([Buffer.from(`P6\n${WIDTH} ${HEIGHT}\n255\n`), rgb]));
}

function selfTest() {
  const encoded = rgbaToRgb565(Uint8ClampedArray.from([255, 0, 0, 255]), 1, 1);
  if (encoded.toString("hex") !== "00f8") {
    throw new Error(`RGB565 self-test failed: expected 00f8, got ${encoded.toString("hex")}.`);
  }
  if (clampDelay(1) !== MIN_DELAY_MS || clampDelay(100) !== 100) {
    throw new Error("Delay-clamp self-test failed.");
  }
  const patch = (left, color, disposalType) => ({
    dims: { left, top: 0, width: 1, height: 1 },
    disposalType,
    patch: Uint8ClampedArray.from([...color, 255]),
  });
  const coalesced = coalesceFrames(
    { lsd: { backgroundColorIndex: 0 }, gct: [[0, 0, 0]] },
    [
      patch(0, [255, 0, 0], 1),
      patch(1, [0, 255, 0], 2),
      patch(2, [0, 0, 255], 3),
      patch(3, [255, 255, 255], 1),
    ],
    "self-test",
  );
  const pixel = (frame, x) => Array.from(frame.slice(x * 4, x * 4 + 4));
  if (
    pixel(coalesced[2], 0).join(",") !== "255,0,0,255" ||
    pixel(coalesced[2], 1).join(",") !== "0,0,0,255" ||
    pixel(coalesced[3], 2).join(",") !== "0,0,0,255" ||
    pixel(coalesced[3], 3).join(",") !== "255,255,255,255"
  ) {
    throw new Error("GIF disposal/coalescing self-test failed.");
  }
  console.log("self-test RGB565: red 255,0,0 -> bytes 00 f8 (pass)");
  console.log(`self-test delay clamp: 1 ms -> ${MIN_DELAY_MS} ms; 100 ms unchanged (pass)`);
  console.log("self-test GIF coalescing: partial-frame disposal 2 and 3 (pass)");
}

function sleep(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function clearAndExit(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n${signal}: returning the panel to its own rotation...`);
  if (activeChild) activeChild.kill("SIGKILL");
  if (runtime) {
    try {
      const response = await fetch(`${runtime.config.device.url}/api/v1/display/clear`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${runtime.token}`,
          "Content-Type": "application/json",
        },
        body: "{}",
        signal: AbortSignal.timeout(4_000),
      });
      await response.arrayBuffer();
      if (!response.ok) console.error(`Display clear returned HTTP ${response.status}.`);
      else console.log("Display cleared.");
    } catch (error) {
      console.error(`Display clear failed: ${error.message}`);
    }
  }
  process.exit(0);
}

process.on("SIGINT", () => void clearAndExit("SIGINT"));
process.on("SIGTERM", () => void clearAndExit("SIGTERM"));

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }
  assertNode20();
  if (options.selfTest) {
    selfTest();
    return;
  }

  const config = readConfig();
  if (options.dryRun) {
    printPlan(config);
    return;
  }
  if (options.check) {
    if (!(await preflight(config))) process.exitCode = 1;
    return;
  }
  if (options.renderTest) {
    if (!(await preflight(config, { device: false, token: false }))) {
      process.exitCode = 1;
      return;
    }
    const slot = slotForApp(config, options.renderTest);
    const rendered = await renderApp(config, slot, { keepTemp: true });
    const ppmPath = path.join(rendered.tempDir, "frame-0.ppm");
    writePpm(ppmPath, rendered.frames[0].rgba);
    console.log(
      `Rendered ${slot.app}: ${rendered.frames.length} frame(s), ${rendered.width}x${rendered.height}.`,
    );
    console.log(
      `Delays (source->playback ms): ${rendered.frames
        .map(frame => `${frame.sourceDelayMs}->${frame.delayMs}`)
        .join(", ")}`,
    );
    console.log(`GIF: ${rendered.gifPath}`);
    console.log(`Frame 0 PPM: ${ppmPath}`);
    return;
  }

  if (!(await preflight(config))) {
    process.exitCode = 1;
    return;
  }
  const token = process.env[config.device.tokenEnv];
  runtime = { config, token };
  if (options.once) {
    const slot = slotForApp(config, options.once);
    const rendered = await renderApp(config, slot);
    await pushAnimationOnce(config, token, rendered);
    console.log(`Pushed ${rendered.frames.length} frame(s) for ${slot.app}.`);
    return;
  }
  await runRotation(config, token);
}

main().catch(error => {
  console.error(`pixlet-bridge: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
