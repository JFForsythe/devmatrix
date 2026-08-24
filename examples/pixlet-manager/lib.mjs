// SPDX-License-Identifier: GPL-3.0-or-later

import assert from "node:assert/strict";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const BODY_LIMIT = 64 * 1024;
export const DIRECT_WIDGETS = new Set([
  "color",
  "datetime",
  "dropdown",
  "location",
  "onoff",
  "text",
]);

const DYNAMIC_WIDGETS = new Set(["generated", "locationbased", "typeahead"]);
const EXTERNAL_WIDGETS = new Set(["image", "oauth", "oauth2", "photo", "photoselect", "png"]);
const APP_KEY_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const APP_REFERENCE_RE = /^(?:apps\/)?[A-Za-z0-9][A-Za-z0-9._-]{0,127}(?:\/[A-Za-z0-9][A-Za-z0-9._-]{0,127}\.star)?$/;
const CONFIG_KEY_RE = /^[A-Za-z_][A-Za-z0-9_.-]{0,127}$/;

export class PublicError extends Error {
  constructor(status, message, details = undefined) {
    super(message);
    this.name = "PublicError";
    this.status = status;
    this.details = details;
  }
}

export function usage(defaultConfig) {
  return `Usage: node examples/pixlet-manager/manager.mjs [options]

Options:
  --config PATH   Exact bridge.config.json to manage
                  (default: BRIDGE_CONFIG or ${defaultConfig})
  --port PORT     Local port, 1024-65535 (default: 47832)
  --no-open       Do not open the browser automatically
  --self-test     Run built-in parsing, containment, config, and CSRF tests
  --help, -h      Show this help

The server always binds 127.0.0.1. The device token stays in the process
environment or a mode-0600 file beside the selected config; it is never sent
to the browser.`;
}

export function parseArgs(argv, { defaultConfig, env = process.env } = {}) {
  const fallback = defaultConfig || path.join(os.homedir(), "tronbyt", "bridge.config.json");
  const options = {
    configPath: path.resolve(env.BRIDGE_CONFIG || fallback),
    help: false,
    noOpen: false,
    port: 47832,
    selfTest: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") options.help = true;
    else if (argument === "--no-open") options.noOpen = true;
    else if (argument === "--self-test") options.selfTest = true;
    else if (argument === "--config" || argument === "--port") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${argument} requires a value.`);
      index += 1;
      if (argument === "--config") options.configPath = path.resolve(value);
      else {
        const port = Number(value);
        if (!Number.isInteger(port) || port < 1024 || port > 65535) {
          throw new Error("--port must be an integer from 1024 through 65535.");
        }
        options.port = port;
      }
    } else {
      throw new Error(`Unknown option: ${argument}`);
    }
  }

  if (options.selfTest && (options.help || options.noOpen || argv.includes("--config") || argv.includes("--port"))) {
    throw new Error("--self-test must be used by itself.");
  }
  return options;
}

export function revisionFor(source) {
  return createHash("sha256").update(source).digest("hex");
}

export function resolveFrom(base, value) {
  return path.isAbsolute(value) ? path.normalize(value) : path.resolve(base, value);
}

export function normalizeSlot(slot, index = 0) {
  const label = `rotation[${index}]`;
  if (!slot || typeof slot !== "object" || Array.isArray(slot)) {
    throw new PublicError(400, `${label} must be an object.`);
  }
  if (typeof slot.app !== "string" || !APP_REFERENCE_RE.test(slot.app)) {
    throw new PublicError(400, `${label}.app must be a contained catalog app reference.`);
  }
  const durationS = Number(slot.duration_s);
  const renderIntervalS = Number(slot.render_interval_s);
  if (!Number.isFinite(durationS) || durationS < 1 || durationS > 3600) {
    throw new PublicError(400, `${label}.duration_s must be from 1 through 3600.`);
  }
  if (!Number.isFinite(renderIntervalS) || renderIntervalS < 0 || renderIntervalS > 86400) {
    throw new PublicError(400, `${label}.render_interval_s must be from 0 through 86400.`);
  }
  const appConfig = slot.config ?? {};
  if (!appConfig || typeof appConfig !== "object" || Array.isArray(appConfig)) {
    throw new PublicError(400, `${label}.config must be an object.`);
  }
  const entries = Object.entries(appConfig);
  if (entries.length > 128) throw new PublicError(400, `${label}.config has too many fields.`);
  for (const [key, value] of entries) {
    if (!CONFIG_KEY_RE.test(key)) {
      throw new PublicError(400, `${label}.config contains an invalid field name.`);
    }
    if (value !== null && !["string", "number", "boolean"].includes(typeof value)) {
      throw new PublicError(400, `${label}.config.${key} must be a scalar value.`);
    }
    if (typeof value === "string" && value.length > 16_384) {
      throw new PublicError(400, `${label}.config.${key} is too long.`);
    }
  }
  return {
    app: slot.app,
    duration_s: durationS,
    render_interval_s: renderIntervalS,
    config: { ...appConfig },
  };
}

export function canonicalAppKey(reference) {
  if (typeof reference !== "string" || !APP_REFERENCE_RE.test(reference)) {
    throw new PublicError(400, "Invalid catalog app reference.");
  }
  const pieces = reference.split("/");
  const key = pieces[0] === "apps" ? pieces[1] : pieces[0];
  if (!key) throw new PublicError(400, "Invalid catalog app reference.");
  return key;
}

export function normalizeConfig(raw, configPath) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new PublicError(400, "Bridge config must be a JSON object.");
  }
  if (!raw.device || typeof raw.device !== "object" || Array.isArray(raw.device)) {
    throw new PublicError(400, "device must contain url and tokenEnv.");
  }
  let deviceUrl;
  try {
    const parsed = new URL(raw.device.url);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("unsupported protocol");
    if (parsed.username || parsed.password) throw new Error("embedded credentials are forbidden");
    deviceUrl = parsed.href.replace(/\/+$/, "");
  } catch (error) {
    throw new PublicError(400, `device.url is invalid (${error.message}).`);
  }
  if (
    typeof raw.device.tokenEnv !== "string" ||
    !/^[A-Za-z_][A-Za-z0-9_]*$/.test(raw.device.tokenEnv)
  ) {
    throw new PublicError(400, "device.tokenEnv must be an environment-variable name.");
  }
  if (typeof raw.pixlet !== "string" || !raw.pixlet.trim()) {
    throw new PublicError(400, 'pixlet must be "auto" or a binary path.');
  }
  if (typeof raw.appsDir !== "string" || !raw.appsDir.trim()) {
    throw new PublicError(400, "appsDir must name the local catalog checkout.");
  }
  if (!Array.isArray(raw.rotation) || raw.rotation.length < 1 || raw.rotation.length > 128) {
    throw new PublicError(400, "rotation must contain from 1 through 128 apps.");
  }

  const configDir = path.dirname(configPath);
  return {
    appsDir: resolveFrom(configDir, raw.appsDir),
    configPath,
    device: { url: deviceUrl, tokenEnv: raw.device.tokenEnv },
    pixlet: raw.pixlet === "auto" ? "auto" : resolveFrom(configDir, raw.pixlet),
    rotation: raw.rotation.map((slot, index) => normalizeSlot(slot, index)),
  };
}

export function loadConfig(configPath) {
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
  return { config: normalizeConfig(raw, configPath), raw, revision: revisionFor(source), source };
}

export function writeConfigAtomic(configPath, raw) {
  const source = `${JSON.stringify(raw, null, 2)}\n`;
  const directory = path.dirname(configPath);
  const temporary = path.join(
    directory,
    `.${path.basename(configPath)}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`,
  );
  let descriptor;
  try {
    descriptor = fs.openSync(temporary, "wx", 0o600);
    fs.writeFileSync(descriptor, source, "utf8");
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.renameSync(temporary, configPath);
    fs.chmodSync(configPath, 0o600);
    try {
      const directoryDescriptor = fs.openSync(directory, "r");
      fs.fsyncSync(directoryDescriptor);
      fs.closeSync(directoryDescriptor);
    } catch {
      // The atomic file write and file fsync are the required guarantees.
      // Some filesystems do not allow opening a directory for fsync.
    }
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    if (fs.existsSync(temporary)) fs.rmSync(temporary, { force: true });
  }
  return { revision: revisionFor(source), source };
}

export function ensurePrivateRegularFile(file) {
  const stat = fs.lstatSync(file);
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new Error(`Refusing non-regular config file: ${file}`);
  }
  fs.chmodSync(file, 0o600);
}

function yamlScalar(value) {
  const source = value.trim();
  if (source.startsWith("'") && source.endsWith("'")) {
    return source.slice(1, -1).replaceAll("''", "'");
  }
  if (source.startsWith('"') && source.endsWith('"')) {
    try {
      return JSON.parse(source);
    } catch {
      return source.slice(1, -1);
    }
  }
  return source;
}

export function parseManifest(source) {
  const result = { tags: [] };
  let listKey = "";
  for (const line of source.split(/\r?\n/)) {
    const list = /^\s{2,}-\s+(.*)$/.exec(line);
    if (list && listKey === "tags") {
      result.tags.push(yamlScalar(list[1]));
      continue;
    }
    const field = /^([A-Za-z][A-Za-z0-9_]*)\s*:\s*(.*)$/.exec(line);
    if (!field) continue;
    const [, key, value] = field;
    listKey = value === "" ? key : "";
    if (["author", "category", "desc", "id", "name", "summary"].includes(key)) {
      result[key] = yamlScalar(value);
    } else if (key === "recommendedInterval") {
      const number = Number(yamlScalar(value));
      if (Number.isFinite(number)) result.recommendedInterval = number;
    }
  }
  return result;
}

export function catalogRootFor(appsDir) {
  const nested = path.join(appsDir, "apps");
  const selected = fs.existsSync(nested) && fs.statSync(nested).isDirectory() ? nested : appsDir;
  if (!fs.existsSync(selected) || !fs.statSync(selected).isDirectory()) {
    throw new Error(`Catalog directory not found: ${selected}`);
  }
  return fs.realpathSync(selected);
}

export function assertContainedAppPath(catalogRoot, appKey) {
  if (typeof appKey !== "string" || !APP_KEY_RE.test(appKey)) {
    throw new PublicError(400, "Invalid catalog app key.");
  }
  const root = fs.realpathSync(catalogRoot);
  const candidate = path.join(root, appKey);
  let actual;
  try {
    actual = fs.realpathSync(candidate);
  } catch {
    throw new PublicError(404, `Catalog app not found: ${appKey}`);
  }
  const relative = path.relative(root, actual);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new PublicError(400, "App path escapes the catalog root.");
  }
  if (!fs.statSync(actual).isDirectory()) {
    throw new PublicError(400, "Catalog app is not a directory.");
  }
  const starFiles = fs.readdirSync(actual).filter(name => name.endsWith(".star"));
  if (starFiles.length === 0) throw new PublicError(400, "Catalog app has no .star entrypoint.");
  return actual;
}

export function buildCatalog(appsDir) {
  const root = catalogRootFor(appsDir);
  const entries = [];
  for (const directoryName of fs.readdirSync(root).sort((a, b) => a.localeCompare(b))) {
    if (!APP_KEY_RE.test(directoryName)) continue;
    let appPath;
    try {
      appPath = assertContainedAppPath(root, directoryName);
    } catch {
      continue;
    }
    let manifest = {};
    const manifestPath = path.join(appPath, "manifest.yaml");
    if (fs.existsSync(manifestPath) && fs.statSync(manifestPath).isFile()) {
      try {
        manifest = parseManifest(fs.readFileSync(manifestPath, "utf8"));
      } catch {
        manifest = {};
      }
    }
    // Manifest strings come from the third-party catalog; cap them like
    // normalizeSchema does so one crafted multi-megabyte line cannot bloat
    // every /api/catalog response.
    entries.push({
      app: directoryName,
      author: text(manifest.author, 120) || "Community contributor",
      category: text(manifest.category, 48) || "other",
      name: text(manifest.name, 120) || directoryName,
      recommendedInterval: manifest.recommendedInterval ?? null,
      summary: text(manifest.summary, 400) || text(manifest.desc, 400) || "Community Pixlet app",
      tags: Array.isArray(manifest.tags) ? manifest.tags.slice(0, 24).map(tag => text(tag, 48)).filter(Boolean) : [],
    });
  }
  return { entries, root };
}

function text(value, maximum = 4096) {
  return typeof value === "string" ? value.slice(0, maximum) : "";
}

export function normalizeSchema(raw) {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.schema)) {
    throw new Error("Pixlet returned an invalid schema document.");
  }
  const fields = [];
  for (const item of raw.schema.slice(0, 256)) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const type = text(item.type, 64).toLowerCase();
    const id = text(item.id, 128);
    if (!type || (id && !CONFIG_KEY_RE.test(id))) continue;
    const field = {
      default: item.secret ? undefined : ["string", "number", "boolean"].includes(typeof item.default)
        ? item.default
        : undefined,
      description: text(item.description),
      id,
      name: text(item.name, 256) || id || type,
      secret: item.secret === true,
      type,
    };
    if (Array.isArray(item.options)) {
      field.options = item.options.slice(0, 512).flatMap(option => {
        if (!option || typeof option !== "object") return [];
        const value = ["string", "number", "boolean"].includes(typeof option.value)
          ? option.value
          : undefined;
        if (value === undefined) return [];
        return [{ label: text(option.display || option.text, 256) || String(value), value }];
      });
    }
    fields.push(field);
  }
  return { fields, version: text(raw.version, 32) || "unknown", compatibility: compatibilityFor(fields) };
}

export function compatibilityFor(fields) {
  const unsupported = [];
  for (const field of fields) {
    if (DIRECT_WIDGETS.has(field.type)) continue;
    let reason = "This Pixlet widget is not supported by the local form yet.";
    if (DYNAMIC_WIDGETS.has(field.type)) {
      reason = "This field needs a Pixlet server-side search or generated widget.";
    } else if (EXTERNAL_WIDGETS.has(field.type)) {
      reason = "This field needs an OAuth or file-upload flow that Easy Mode does not impersonate.";
    }
    unsupported.push({ id: field.id, name: field.name, reason, type: field.type });
  }
  return {
    status: unsupported.length === 0 ? "ready" : "partial",
    summary: unsupported.length === 0
      ? "All settings use locally supported controls."
      : `${unsupported.length} setting${unsupported.length === 1 ? "" : "s"} require the upstream Pixlet UI. They are preserved but cannot be edited here.`,
    unsupported,
  };
}

export function editableSchema(schema, currentConfig = {}) {
  const fields = schema.fields.map(field => {
    const hasCurrent = field.id && Object.hasOwn(currentConfig, field.id);
    if (field.secret) {
      return { ...field, default: undefined, value: undefined, configured: hasCurrent && currentConfig[field.id] !== "" };
    }
    if (!DIRECT_WIDGETS.has(field.type)) {
      return { ...field, default: undefined, value: undefined, configured: hasCurrent };
    }
    return { ...field, value: hasCurrent ? currentConfig[field.id] : field.default };
  });
  const known = new Set(fields.map(field => field.id).filter(Boolean));
  return {
    ...schema,
    fields,
    preservedUnknownFields: Object.keys(currentConfig).filter(key => !known.has(key)),
  };
}

export function mergeSubmittedConfig(currentConfig, submittedConfig) {
  const normalized = normalizeSlot(
    { app: "merge-test", duration_s: 1, render_interval_s: 0, config: submittedConfig },
    0,
  ).config;
  // An empty submitted value clears the stored setting (back to the app's
  // default). Without this, a cleared location field would keep the old
  // coordinates in the config file forever while the form shows blanks.
  const merged = { ...(currentConfig || {}) };
  for (const [key, value] of Object.entries(normalized)) {
    if (value === "") delete merged[key];
    else merged[key] = value;
  }
  return merged;
}

export function assertRevision(actual, requested) {
  if (typeof requested !== "string" || requested !== actual) {
    throw new PublicError(409, "The config changed on disk. Reload before saving again.");
  }
}

export function csrfMatches(actual, expected) {
  if (typeof actual !== "string" || typeof expected !== "string") return false;
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function validateBrowserRequest(
  { csrf, fetchSite = "", host = "", method = "GET", origin = "" },
  { csrfToken, expectedHost, expectedOrigin },
) {
  if (host !== expectedHost) throw new PublicError(403, "Invalid local Host header.");
  if (fetchSite && !["none", "same-origin"].includes(fetchSite)) {
    throw new PublicError(403, "Cross-site requests are not allowed.");
  }
  if (!csrfMatches(csrf, csrfToken)) throw new PublicError(403, "Invalid CSRF token.");
  if (!["GET", "HEAD"].includes(method) && origin !== expectedOrigin) {
    throw new PublicError(403, "Invalid request origin.");
  }
  return true;
}

export function searchCatalog(entries, query, limit = 100) {
  const needle = String(query || "").trim().toLocaleLowerCase();
  const filtered = needle
    ? entries.filter(entry =>
        [entry.app, entry.name, entry.summary, entry.author, entry.category, ...entry.tags]
          .join(" ")
          .toLocaleLowerCase()
          .includes(needle),
      )
    : entries;
  return { apps: filtered.slice(0, limit), total: filtered.length };
}

export function locationValue(parts) {
  const latitude = Number(parts.lat);
  const longitude = Number(parts.lng);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new PublicError(400, "Location latitude must be from -90 through 90.");
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new PublicError(400, "Location longitude must be from -180 through 180.");
  }
  const timezone = String(parts.timezone || "").trim();
  if (!timezone || timezone.length > 128 || /[\0\r\n]/.test(timezone)) {
    throw new PublicError(400, "Location timezone is required.");
  }
  const description = String(parts.description || "").trim().slice(0, 256);
  return JSON.stringify({
    lat: String(latitude),
    lng: String(longitude),
    description,
    locality: description,
    timezone,
  });
}

export function runSelfTest() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "dmx-pixlet-manager-test-"));
  try {
    const appsDir = path.join(temp, "catalog");
    const appDir = path.join(appsDir, "apps", "weather");
    fs.mkdirSync(appDir, { recursive: true });
    fs.writeFileSync(path.join(appDir, "weather.star"), "def main(config):\n  return None\n");
    fs.writeFileSync(
      path.join(appDir, "manifest.yaml"),
      "---\nid: weather\nname: 'Weather'\nsummary: Forecast nearby\nauthor: Example\ncategory: weather\ntags:\n  - local\n  - utility\n",
    );
    const parsed = parseManifest(fs.readFileSync(path.join(appDir, "manifest.yaml"), "utf8"));
    assert.equal(parsed.name, "Weather");
    assert.deepEqual(parsed.tags, ["local", "utility"]);
    const catalog = buildCatalog(appsDir);
    assert.equal(catalog.entries.length, 1);
    assert.equal(catalog.entries[0].app, "weather");
    assert.equal(assertContainedAppPath(catalog.root, "weather"), fs.realpathSync(appDir));
    assert.throws(() => assertContainedAppPath(catalog.root, "../outside"), /Invalid catalog app key/);

    const outside = path.join(temp, "outside");
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(outside, "bad.star"), "");
    fs.symlinkSync(outside, path.join(catalog.root, "escape"));
    assert.throws(() => assertContainedAppPath(catalog.root, "escape"), /escapes/);

    const configPath = path.join(temp, "bridge.config.json");
    const raw = {
      device: { url: "http://dmx-test.local", tokenEnv: "DMX_TOKEN" },
      pixlet: "./pixlet",
      appsDir: "./catalog",
      rotation: [{ app: "weather", duration_s: 15, render_interval_s: 30, config: {} }],
    };
    const written = writeConfigAtomic(configPath, raw);
    assert.equal(fs.statSync(configPath).mode & 0o777, 0o600);
    const loaded = loadConfig(configPath);
    assert.equal(loaded.revision, written.revision);
    assert.equal(loaded.config.appsDir, appsDir);
    assert.equal(loaded.config.rotation[0].app, "weather");

    const options = parseArgs(["--config", configPath, "--port", "41234", "--no-open"], {
      defaultConfig: "/unused",
      env: {},
    });
    assert.equal(options.configPath, configPath);
    assert.equal(options.port, 41234);
    assert.equal(options.noOpen, true);

    const rules = { csrfToken: "fixed-token", expectedHost: "127.0.0.1:41234", expectedOrigin: "http://127.0.0.1:41234" };
    assert.equal(
      validateBrowserRequest(
        { csrf: "fixed-token", fetchSite: "same-origin", host: rules.expectedHost, method: "POST", origin: rules.expectedOrigin },
        rules,
      ),
      true,
    );
    assert.throws(
      () => validateBrowserRequest({ csrf: "wrong", host: rules.expectedHost }, rules),
      /CSRF/,
    );
    assert.throws(
      () => validateBrowserRequest({ csrf: "fixed-token", host: "attacker.test" }, rules),
      /Host/,
    );

    const schema = normalizeSchema({
      version: "1",
      schema: [
        { type: "text", id: "api_key", name: "API key", secret: true, default: "must-not-leak" },
        { type: "location", id: "location", name: "Location" },
        { type: "oauth2", id: "auth", name: "Account" },
      ],
    });
    const editable = editableSchema(schema, { api_key: "also-must-not-leak", hidden: "preserved" });
    assert.equal(editable.compatibility.status, "partial");
    assert.equal(editable.fields[0].value, undefined);
    assert.equal(editable.fields[0].default, undefined);
    assert.equal(JSON.stringify(editable).includes("must-not-leak"), false);
    assert.deepEqual(editable.preservedUnknownFields, ["hidden"]);
    assert.deepEqual(JSON.parse(locationValue({ lat: 41.88, lng: -87.63, timezone: "America/Chicago", description: "Chicago" })), {
      lat: "41.88",
      lng: "-87.63",
      description: "Chicago",
      locality: "Chicago",
      timezone: "America/Chicago",
    });
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}
