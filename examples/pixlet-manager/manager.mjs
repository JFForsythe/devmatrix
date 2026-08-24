#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later

import { execFile, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  BODY_LIMIT,
  DIRECT_WIDGETS,
  PublicError,
  assertContainedAppPath,
  assertRevision,
  buildCatalog,
  canonicalAppKey,
  editableSchema,
  ensurePrivateRegularFile,
  loadConfig,
  locationValue,
  mergeSubmittedConfig,
  normalizeSchema,
  normalizeSlot,
  parseArgs,
  runSelfTest,
  searchCatalog,
  usage,
  validateBrowserRequest,
  writeConfigAtomic,
} from "./lib.mjs";

const MANAGER_PATH = fileURLToPath(import.meta.url);
const MANAGER_DIR = path.dirname(MANAGER_PATH);
const BRIDGE_PATH = path.resolve(MANAGER_DIR, "..", "pixlet-bridge", "bridge.mjs");
const DEFAULT_CONFIG_PATH = path.join(os.homedir(), "tronbyt", "bridge.config.json");
const STATIC_FILES = new Map([
  ["/app.js", { contentType: "text/javascript; charset=utf-8", file: "app.js" }],
  ["/styles.css", { contentType: "text/css; charset=utf-8", file: "styles.css" }],
]);
const MAX_GIF_BYTES = 16 * 1024 * 1024;
const PIXLET_TIMEOUT_MS = 30_000;

function assertNode20() {
  const major = Number.parseInt(process.versions.node, 10);
  if (major < 20) throw new Error(`Node 20 or newer is required (found ${process.versions.node}).`);
}

function runCaptured(command, args, { env = process.env, secrets = [], timeout = 15_000 } = {}) {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      {
        encoding: "utf8",
        env,
        killSignal: "SIGKILL",
        maxBuffer: 2 * 1024 * 1024,
        timeout,
      },
      (error, stdout, stderr) => {
        if (!error) {
          resolve({ stderr, stdout });
          return;
        }
        if (error.code === "ENOENT") {
          reject(new PublicError(502, `Executable not found: ${command}`));
          return;
        }
        let detail = String(stderr || stdout || "").trim();
        for (const secret of secrets) {
          if (secret !== null && secret !== undefined && String(secret) !== "") {
            detail = detail.split(String(secret)).join("***REDACTED***");
          }
        }
        if (error.killed || error.signal === "SIGKILL") {
          reject(new PublicError(502, `Process exceeded its ${Math.round(timeout / 1000)} second timeout.`));
          return;
        }
        // Redacted above; safe to surface — this is the message that tells a
        // user why their app's settings failed to render.
        reject(new PublicError(502, `Process exited with status ${error.code ?? "unknown"}${detail ? `: ${detail.slice(0, 800)}` : "."}`));
      },
    );
  });
}

function secureHeaders(contentType) {
  return {
    "Cache-Control": "no-store",
    "Content-Security-Policy":
      "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
    "Content-Type": contentType,
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  };
}

function sendJson(response, status, value) {
  const body = Buffer.from(JSON.stringify(value));
  response.writeHead(status, { ...secureHeaders("application/json; charset=utf-8"), "Content-Length": body.length });
  response.end(body);
}

async function readJson(request) {
  const contentType = String(request.headers["content-type"] || "").split(";", 1)[0].trim();
  if (contentType !== "application/json") throw new PublicError(415, "Content-Type must be application/json.");
  const declared = Number(request.headers["content-length"] || 0);
  if (Number.isFinite(declared) && declared > BODY_LIMIT) throw new PublicError(413, "Request body is too large.");
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > BODY_LIMIT) throw new PublicError(413, "Request body is too large.");
    chunks.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("not an object");
    }
    return value;
  } catch {
    throw new PublicError(400, "Request body must be a JSON object.");
  }
}

async function readResponseJson(response, limit = BODY_LIMIT) {
  const reader = response.body?.getReader();
  if (!reader) return {};
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      throw new Error("Device response was too large.");
    }
    chunks.push(Buffer.from(value));
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    throw new Error("Device returned invalid JSON.");
  }
}

function gifDimensions(bytes) {
  if (bytes.length < 10 || !["GIF87a", "GIF89a"].includes(bytes.subarray(0, 6).toString("ascii"))) {
    throw new Error("Pixlet output was not a GIF.");
  }
  return { height: bytes.readUInt16LE(8), width: bytes.readUInt16LE(6) };
}

function privateSecretPath(configPath) {
  return path.join(path.dirname(configPath), `.${path.basename(configPath)}.manager.env`);
}

function writeSecretFile(file, tokenEnv, token) {
  if (!/^[\x21-\x7e]{8,1024}$/.test(token)) throw new Error("Device returned an invalid token.");
  const temporary = `${file}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;
  let descriptor;
  try {
    if (fs.existsSync(file) && fs.lstatSync(file).isSymbolicLink()) {
      throw new Error(`Refusing a symlinked secret file: ${file}`);
    }
    descriptor = fs.openSync(temporary, "wx", 0o600);
    fs.writeFileSync(descriptor, `${tokenEnv}=${token}\n`, "utf8");
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.renameSync(temporary, file);
    fs.chmodSync(file, 0o600);
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    if (fs.existsSync(temporary)) fs.rmSync(temporary, { force: true });
  }
}

function readSecretFile(file, tokenEnv) {
  if (!fs.existsSync(file)) return "";
  const stat = fs.lstatSync(file);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`Refusing non-regular secret file: ${file}`);
  fs.chmodSync(file, 0o600);
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const separator = line.indexOf("=");
    if (separator > 0 && line.slice(0, separator) === tokenEnv) return line.slice(separator + 1);
  }
  return "";
}

class PixletManager {
  constructor(configPath) {
    this.configPath = configPath;
    this.secretPath = privateSecretPath(configPath);
    this.schemaCache = new Map();
    this.sessionToken = "";
    this.activeOperation = "";
    this.refreshCatalog();
  }

  read() {
    const loaded = loadConfig(this.configPath);
    if (loaded.config.appsDir !== this.catalogAppsDir) this.refreshCatalog(loaded);
    return loaded;
  }

  refreshCatalog(existing = null) {
    const loaded = existing || loadConfig(this.configPath);
    const catalog = buildCatalog(loaded.config.appsDir);
    this.catalogAppsDir = loaded.config.appsDir;
    this.catalogEntries = catalog.entries;
    this.catalogRoot = catalog.root;
    this.catalogKeys = new Set(catalog.entries.map(entry => entry.app));
    this.schemaCache.clear();
  }

  token(config) {
    return this.sessionToken || process.env[config.device.tokenEnv] || readSecretFile(this.secretPath, config.device.tokenEnv);
  }

  state() {
    const loaded = this.read();
    const mode = fs.statSync(this.configPath).mode & 0o777;
    return {
      catalogCount: this.catalogEntries.length,
      configMode: mode.toString(8).padStart(4, "0"),
      configPath: this.configPath,
      device: { url: loaded.config.device.url },
      revision: loaded.revision,
      rotation: loaded.config.rotation.map((slot, index) => {
        const app = canonicalAppKey(slot.app);
        return {
          app,
          catalogKnown: this.catalogKeys.has(app),
          duration_s: slot.duration_s,
          index,
          render_interval_s: slot.render_interval_s,
          settingCount: Object.keys(slot.config).length,
        };
      }),
      tokenConfigured: Boolean(this.token(loaded.config)),
    };
  }

  appPath(app) {
    if (!this.catalogKeys.has(app)) throw new PublicError(404, `Catalog app not found: ${app}`);
    return assertContainedAppPath(this.catalogRoot, app);
  }

  async schemaFor(app) {
    if (this.schemaCache.has(app)) return this.schemaCache.get(app);
    const loaded = this.read();
    const command = loaded.config.pixlet === "auto" ? "pixlet" : loaded.config.pixlet;
    const result = await runCaptured(command, ["schema", this.appPath(app)], { timeout: 15_000 });
    let raw;
    try {
      raw = JSON.parse(result.stdout);
    } catch {
      throw new PublicError(502, "Pixlet returned invalid schema JSON.");
    }
    const schema = normalizeSchema(raw);
    this.schemaCache.set(app, schema);
    return schema;
  }

  existingConfig(loaded, app, index) {
    if (index === null || index === undefined) return {};
    if (!Number.isInteger(index) || index < 0 || index >= loaded.config.rotation.length) {
      throw new PublicError(400, "Rotation index is invalid.");
    }
    const slot = loaded.config.rotation[index];
    if (canonicalAppKey(slot.app) !== app) throw new PublicError(409, "The selected rotation app changed. Reload first.");
    return slot.config;
  }

  async editable(app, index) {
    const loaded = this.read();
    const current = this.existingConfig(loaded, app, index);
    return editableSchema(await this.schemaFor(app), current);
  }

  async submittedConfig(app, input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new PublicError(400, "App settings must be an object.");
    }
    const schema = await this.schemaFor(app);
    const fields = new Map(schema.fields.filter(field => field.id).map(field => [field.id, field]));
    const output = {};
    for (const [key, rawValue] of Object.entries(input)) {
      const field = fields.get(key);
      if (!field || !DIRECT_WIDGETS.has(field.type)) {
        throw new PublicError(400, `Setting ${key} is not editable in Easy Mode.`);
      }
      if (field.type === "onoff") {
        if (![true, false, "true", "false"].includes(rawValue)) {
          throw new PublicError(400, `${field.name} must be on or off.`);
        }
        output[key] = rawValue === true || rawValue === "true";
      } else if (field.type === "location") {
        if (rawValue === "") {
          // The form cleared this location; the merge deletes the stored key.
          output[key] = "";
          continue;
        }
        let parts;
        try {
          parts = typeof rawValue === "string" ? JSON.parse(rawValue) : rawValue;
        } catch {
          throw new PublicError(400, `${field.name} must contain valid coordinates and timezone.`);
        }
        output[key] = locationValue(parts);
      } else {
        if (typeof rawValue !== "string") throw new PublicError(400, `${field.name} must be text.`);
        if (rawValue.length > 16_384) throw new PublicError(400, `${field.name} is too long.`);
        if (field.type === "dropdown" && field.options?.length) {
          const allowed = field.options.some(option => String(option.value) === rawValue);
          if (!allowed) throw new PublicError(400, `${field.name} has an invalid selection.`);
        }
        if (field.type === "color" && rawValue && !/^#[0-9a-fA-F]{3,8}$/.test(rawValue)) {
          throw new PublicError(400, `${field.name} must be a hexadecimal color.`);
        }
        output[key] = rawValue;
      }
    }
    return output;
  }

  async effectiveSlot(body) {
    const app = String(body.app || "");
    this.appPath(app);
    const loaded = this.read();
    const current = this.existingConfig(loaded, app, body.index ?? null);
    const submitted = await this.submittedConfig(app, body.config || {});
    return {
      loaded,
      slot: normalizeSlot({
        app,
        config: mergeSubmittedConfig(current, submitted),
        duration_s: body.duration_s ?? 15,
        render_interval_s: body.render_interval_s ?? 300,
      }),
    };
  }

  async render(body) {
    const { loaded, slot } = await this.effectiveSlot(body);
    const command = loaded.config.pixlet === "auto" ? "pixlet" : loaded.config.pixlet;
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "dmx-pixlet-preview-"));
    const output = path.join(directory, "preview.gif");
    const values = Object.values(slot.config).filter(value => value !== null && String(value));
    const args = Object.entries(slot.config).map(([key, value]) => `${key}=${value === null ? "" : String(value)}`);
    try {
      await runCaptured(
        command,
        ["render", "--format", "gif", "--output", output, this.appPath(slot.app), ...args],
        { secrets: values, timeout: PIXLET_TIMEOUT_MS },
      );
      const stat = fs.statSync(output);
      if (stat.size < 10 || stat.size > MAX_GIF_BYTES) throw new PublicError(502, "Pixlet GIF had an invalid size.");
      const bytes = fs.readFileSync(output);
      const dimensions = gifDimensions(bytes);
      if (dimensions.width !== 64 || dimensions.height !== 32) {
        throw new PublicError(422, `App rendered ${dimensions.width}x${dimensions.height}; Devmatrix requires exactly 64x32.`);
      }
      return bytes;
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }

  async pushOnce(body) {
    const { loaded, slot } = await this.effectiveSlot(body);
    const token = this.token(loaded.config);
    if (!token) throw new PublicError(409, "Pair this panel before pushing an app.");
    if (!fs.existsSync(BRIDGE_PATH)) throw new Error(`Existing Pixlet bridge not found: ${BRIDGE_PATH}`);
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "dmx-pixlet-push-"));
    const configPath = path.join(directory, "bridge.config.json");
    const temporaryConfig = {
      appsDir: loaded.config.appsDir,
      device: loaded.config.device,
      pixlet: loaded.config.pixlet,
      rotation: [slot],
    };
    fs.writeFileSync(configPath, `${JSON.stringify(temporaryConfig, null, 2)}\n`, { mode: 0o600 });
    const secrets = [token, ...Object.values(slot.config)];
    try {
      await runCaptured(process.execPath, [BRIDGE_PATH, "--once", slot.app], {
        env: { ...process.env, BRIDGE_CONFIG: configPath, [loaded.config.device.tokenEnv]: token },
        secrets,
        timeout: 120_000,
      });
      return { ok: true };
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }

  async upsertRotation(body) {
    const app = String(body.slot?.app || "");
    this.appPath(app);
    // Resolve the schema (which may shell out to pixlet for up to 15 s)
    // BEFORE taking the revision snapshot: nothing may await between the
    // revision check and the write, or a concurrent mutation slips in and
    // this write silently resurrects state the other request removed.
    const submitted = await this.submittedConfig(app, body.slot?.config || {});
    const loaded = this.read();
    assertRevision(loaded.revision, body.revision);
    const index = body.index ?? null;
    const current = this.existingConfig(loaded, app, index);
    const slot = normalizeSlot({
      app,
      config: mergeSubmittedConfig(current, submitted),
      duration_s: body.slot?.duration_s,
      render_interval_s: body.slot?.render_interval_s,
    });
    const rotation = [...loaded.raw.rotation];
    if (index === null) rotation.push(slot);
    else rotation[index] = slot;
    if (rotation.length > 128) throw new PublicError(400, "Rotation cannot exceed 128 apps.");
    loaded.raw.rotation = rotation;
    writeConfigAtomic(this.configPath, loaded.raw);
    return this.state();
  }

  removeRotation(body) {
    const loaded = this.read();
    assertRevision(loaded.revision, body.revision);
    const index = Number(body.index);
    if (!Number.isInteger(index) || index < 0 || index >= loaded.raw.rotation.length) {
      throw new PublicError(400, "Rotation index is invalid.");
    }
    if (loaded.raw.rotation.length === 1) throw new PublicError(409, "A rotation must keep at least one app.");
    loaded.raw.rotation.splice(index, 1);
    writeConfigAtomic(this.configPath, loaded.raw);
    return this.state();
  }

  moveRotation(body) {
    const loaded = this.read();
    assertRevision(loaded.revision, body.revision);
    const from = Number(body.from);
    const to = Number(body.to);
    if (
      !Number.isInteger(from) ||
      !Number.isInteger(to) ||
      from < 0 ||
      to < 0 ||
      from >= loaded.raw.rotation.length ||
      to >= loaded.raw.rotation.length
    ) {
      throw new PublicError(400, "Rotation move is invalid.");
    }
    const [slot] = loaded.raw.rotation.splice(from, 1);
    loaded.raw.rotation.splice(to, 0, slot);
    writeConfigAtomic(this.configPath, loaded.raw);
    return this.state();
  }

  async pairStart() {
    const loaded = this.read();
    const response = await fetch(`${loaded.config.device.url}/api/v1/claim/start`, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(5_000),
    });
    const result = await readResponseJson(response);
    if (!response.ok) throw new PublicError(502, `Panel rejected pairing start (HTTP ${response.status}).`);
    return { expires_s: Number(result.expires_s) || 300, ok: true };
  }

  async pairFinish(code) {
    const digits = String(code || "").replace(/\D/g, "");
    if (!/^\d{6}$/.test(digits)) throw new PublicError(400, "Enter the six-digit code shown on the panel.");
    const loaded = this.read();
    const response = await fetch(`${loaded.config.device.url}/api/v1/claim/finish`, {
      body: JSON.stringify({ code: digits }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(5_000),
    });
    const result = await readResponseJson(response);
    if (!response.ok) {
      const attemptsLeft = Number.isInteger(result.attempts_left) ? result.attempts_left : undefined;
      throw new PublicError(
        response.status === 403 || response.status === 410 || response.status === 429 ? response.status : 502,
        response.status === 403
          ? "That code was not accepted. Check the panel and try again."
          : response.status === 410
            ? "The pair code expired. Start pairing again."
            : response.status === 429
              ? "Too many attempts. Start pairing again for a fresh code."
              : `Panel pairing failed (HTTP ${response.status}).`,
        attemptsLeft === undefined ? undefined : { attemptsLeft },
      );
    }
    if (typeof result.token !== "string") throw new Error("Panel pairing response did not contain a token.");
    writeSecretFile(this.secretPath, loaded.config.device.tokenEnv, result.token);
    this.sessionToken = result.token;
    return {
      device: typeof result.device === "string" ? result.device.slice(0, 128) : "paired panel",
      fingerprint: typeof result.fingerprint === "string" ? result.fingerprint.slice(0, 64) : "",
      ok: true,
    };
  }

  async exclusive(label, operation) {
    if (this.activeOperation) {
      throw new PublicError(409, `${this.activeOperation} is already running. Wait for it to finish.`);
    }
    this.activeOperation = label;
    try {
      return await operation();
    } finally {
      this.activeOperation = "";
    }
  }
}

function createServer(manager, { csrfToken, expectedHost, expectedOrigin }) {
  const indexTemplate = fs.readFileSync(path.join(MANAGER_DIR, "index.html"), "utf8");
  const staticBodies = new Map(
    [...STATIC_FILES].map(([route, asset]) => [route, { ...asset, body: fs.readFileSync(path.join(MANAGER_DIR, asset.file)) }]),
  );

  return http.createServer(async (request, response) => {
    let pathname = "/";
    try {
      if (request.headers.host !== expectedHost) throw new PublicError(403, "Invalid local Host header.");
      const url = new URL(request.url || "/", expectedOrigin);
      pathname = url.pathname;
      if (request.method === "GET" && pathname === "/") {
        const body = Buffer.from(indexTemplate.replace("__DEVMATRIX_CSRF__", csrfToken));
        response.writeHead(200, { ...secureHeaders("text/html; charset=utf-8"), "Content-Length": body.length });
        response.end(body);
        return;
      }
      if (request.method === "GET" && staticBodies.has(pathname)) {
        const asset = staticBodies.get(pathname);
        response.writeHead(200, { ...secureHeaders(asset.contentType), "Content-Length": asset.body.length });
        response.end(asset.body);
        return;
      }
      if (!pathname.startsWith("/api/")) throw new PublicError(404, "Not found.");
      validateBrowserRequest(
        {
          csrf: request.headers["x-devmatrix-csrf"],
          fetchSite: request.headers["sec-fetch-site"],
          host: request.headers.host,
          method: request.method,
          origin: request.headers.origin,
        },
        { csrfToken, expectedHost, expectedOrigin },
      );

      if (request.method === "GET" && pathname === "/api/state") {
        sendJson(response, 200, manager.state());
      } else if (request.method === "GET" && pathname === "/api/catalog") {
        sendJson(response, 200, searchCatalog(manager.catalogEntries, url.searchParams.get("q"), 100));
      } else if (request.method === "POST" && pathname === "/api/schema") {
        const body = await readJson(request);
        sendJson(response, 200, await manager.exclusive("Schema loading", () => manager.editable(String(body.app || ""), body.index ?? null)));
      } else if (request.method === "POST" && pathname === "/api/render") {
        const body = await readJson(request);
        const bytes = await manager.exclusive("Preview rendering", () => manager.render(body));
        response.writeHead(200, { ...secureHeaders("image/gif"), "Content-Length": bytes.length });
        response.end(bytes);
      } else if (request.method === "POST" && pathname === "/api/push-once") {
        const body = await readJson(request);
        sendJson(response, 200, await manager.exclusive("Panel push", () => manager.pushOnce(body)));
      } else if (request.method === "POST" && pathname === "/api/rotation/upsert") {
        const body = await readJson(request);
        sendJson(response, 200, await manager.exclusive("Rotation saving", () => manager.upsertRotation(body)));
      } else if (request.method === "POST" && pathname === "/api/rotation/remove") {
        const body = await readJson(request);
        sendJson(response, 200, await manager.exclusive("Rotation saving", () => manager.removeRotation(body)));
      } else if (request.method === "POST" && pathname === "/api/rotation/move") {
        const body = await readJson(request);
        sendJson(response, 200, await manager.exclusive("Rotation saving", () => manager.moveRotation(body)));
      } else if (request.method === "POST" && pathname === "/api/pair/start") {
        await readJson(request);
        sendJson(response, 200, await manager.exclusive("Pairing", () => manager.pairStart()));
      } else if (request.method === "POST" && pathname === "/api/pair/finish") {
        const body = await readJson(request);
        sendJson(response, 200, await manager.exclusive("Pairing", () => manager.pairFinish(body.code)));
      } else {
        throw new PublicError(404, "API route not found.");
      }
    } catch (error) {
      const status = error instanceof PublicError ? error.status : 500;
      const message = error instanceof PublicError ? error.message : "The local manager could not complete that action.";
      if (!response.headersSent) sendJson(response, status, { error: message, ...(error.details ? { details: error.details } : {}) });
      else response.destroy();
      const safeMessage = error instanceof PublicError ? error.message : error.message || error.name;
      console.error(`[manager] ${request.method || "?"} ${pathname} -> ${status}: ${safeMessage}`);
    }
  });
}

function openBrowser(url) {
  const command = process.platform === "darwin" ? "open" : process.platform === "linux" ? "xdg-open" : "";
  if (!command) return;
  const child = spawn(command, [url], { detached: true, stdio: "ignore" });
  child.on("error", () => {});
  child.unref();
}

async function main() {
  assertNode20();
  const options = parseArgs(process.argv.slice(2), { defaultConfig: DEFAULT_CONFIG_PATH });
  if (options.help) {
    console.log(usage(DEFAULT_CONFIG_PATH));
    return;
  }
  if (options.selfTest) {
    runSelfTest();
    console.log("Pixlet Easy Mode self-test passed: args, manifest, catalog, containment, config, secrets, schema, location, and CSRF.");
    return;
  }
  if (!fs.existsSync(options.configPath)) {
    throw new Error(`Bridge config not found: ${options.configPath}\nRun examples/setup-pixlet.mjs first, or pass --config PATH.`);
  }
  ensurePrivateRegularFile(options.configPath);
  const configPath = fs.realpathSync(options.configPath);
  ensurePrivateRegularFile(configPath);
  const manager = new PixletManager(configPath);
  const csrfToken = randomBytes(32).toString("base64url");
  const expectedHost = `127.0.0.1:${options.port}`;
  const expectedOrigin = `http://${expectedHost}`;
  const server = createServer(manager, { csrfToken, expectedHost, expectedOrigin });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port, "127.0.0.1", resolve);
  });
  const state = manager.state();
  console.log(`Pixlet Easy Mode: ${expectedOrigin}`);
  console.log(`Config: ${configPath} (mode ${state.configMode})`);
  console.log(`Catalog: ${state.catalogCount} apps; panel token: ${state.tokenConfigured ? "available (hidden)" : "pair in the browser"}`);
  if (!options.noOpen) openBrowser(expectedOrigin);

  const close = () => server.close(() => process.exit(0));
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
}

main().catch(error => {
  console.error(`Pixlet Easy Mode failed: ${error.message}`);
  process.exitCode = 1;
});
