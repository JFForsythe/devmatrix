#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// dmx-top — a live terminal panel for one DK-01: vitals, what's on the
// panel, per-app fetch diagnostics, an event log, and a command line to
// talk to the box. Zero dependencies; Node 20+.
//
//   node examples/dmx-top.mjs --device http://dmx-xxxx.local
//
// Config resolution: flags > DMX_URL / DMX_TOKEN env > ~/.dmx-top.json
// (written by `pair` and `save`, mode 0600). Type `help` inside the tool.
import { createInterface } from "node:readline";
import { readFileSync, writeFileSync, chmodSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CONFIG_PATH = join(homedir(), ".dmx-top.json");
const args = process.argv.slice(2);
const flag = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
if (args.includes("--help") || args.includes("-h")) {
  console.log(`dmx-top — live DK-01 panel + command line

  --device URL   device base URL (or DMX_URL, or saved config)
  --token TOK    LAN token (or DMX_TOKEN, or saved config; \`pair\` earns one)
  --interval N   poll seconds (default 2)
  --log N        log lines to keep on screen (default 7)`);
  process.exit(0);
}

let config = {};
try { config = JSON.parse(readFileSync(CONFIG_PATH, "utf8")); } catch {}
const state = {
  device: normalize(flag("--device") ?? process.env.DMX_URL ?? config.device ?? ""),
  token: flag("--token") ?? process.env.DMX_TOKEN ?? config.token ?? "",
  intervalMs: Math.max(1, Number(flag("--interval") ?? 2)) * 1000,
  logLines: Math.max(3, Number(flag("--log") ?? 7)),
  health: null, info: null, apps: null, diag: null,
  reachable: false, paired: false,
  log: [],
};
if (!state.device) {
  console.error("No device. Run with --device http://dmx-xxxx.local (see the panel's clock footer).");
  process.exit(1);
}

function normalize(value) {
  const trimmed = String(value).trim().replace(/\/$/, "");
  if (!trimmed) return "";
  return /^https?:\/\//.test(trimmed) ? trimmed : `http://${trimmed}`;
}

function log(text) {
  const at = new Date().toTimeString().slice(0, 8);
  state.log.push(`${at}  ${text}`);
  while (state.log.length > 50) state.log.shift();
}

async function api(path, { method = "GET", body, open = false } = {}) {
  const headers = {};
  if (!open && state.token) headers.Authorization = `Bearer ${state.token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(`${state.device}${path}`, {
    method, headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
  const payload = await response.json().catch(() => ({}));
  if (response.status === 401) { state.paired = false; throw new Error("401 — not paired; type: pair"); }
  if (!response.ok) throw new Error(payload.error ?? `HTTP ${response.status}`);
  return payload;
}

// ------------------------------------------------------------------ polling
let lastScene = "", lastResults = {};
async function poll() {
  try {
    state.health = await api("/api/v1/health", { open: true });
    state.reachable = true;
  } catch {
    if (state.reachable) log("device unreachable");
    state.reachable = false;
    return;
  }
  if (!state.token) return;
  try {
    [state.info, state.apps, state.diag] = await Promise.all([
      api("/api/v1/info"), api("/api/v1/apps"), api("/api/v1/apps/diag").catch(() => null),
    ]);
    state.paired = true;
    if (state.info.scene !== lastScene) {
      if (lastScene) log(`scene ${lastScene} → ${state.info.scene}`);
      lastScene = state.info.scene;
    }
    for (const app of state.diag?.apps ?? []) {
      if (lastResults[app.id] !== undefined && lastResults[app.id] !== app.result) {
        log(`${app.id}: ${lastResults[app.id]} → ${app.result}${app.bytes ? ` (${app.bytes}b)` : ""}`);
      }
      lastResults[app.id] = app.result;
    }
  } catch (error) {
    if (state.paired) log(String(error.message ?? error));
  }
}

// ---------------------------------------------------------------- rendering
const ESC = "\x1b[";
const dim = (t) => `${ESC}2m${t}${ESC}22m`;
const bold = (t) => `${ESC}1m${t}${ESC}22m`;
const green = (t) => `${ESC}32m${t}${ESC}39m`;
const red = (t) => `${ESC}31m${t}${ESC}39m`;
const yellow = (t) => `${ESC}33m${t}${ESC}39m`;
const uptime = (s) => s >= 86400 ? `${(s / 86400).toFixed(1)}d` : s >= 3600 ? `${(s / 3600).toFixed(1)}h` : `${Math.round(s / 60)}m`;

function paneLines() {
  const lines = [];
  const h = state.health, i = state.info;
  const link = state.reachable ? (state.paired ? green("LIVE · PAIRED") : yellow("LIVE · NOT PAIRED (type: pair)")) : red("UNREACHABLE");
  lines.push(`${bold(h?.device ?? "?")} ${dim("·")} fw ${h?.fw ?? "?"} ${dim("·")} ${state.device}  ${link}`);
  if (i) {
    lines.push(dim(`up ${uptime(i.uptime_s)} · heap ${(i.heap_free / 1024).toFixed(0)}k · rssi ${i.rssi_dbm}dBm · ${i.refresh_hz}Hz · bright ${i.brightness} · slot ${i.slot} · reset ${i.reset_reason}`));
    const enabled = (state.apps?.apps ?? []).filter((a) => a.enabled).map((a) => `${a.id} ${a.interval_s}s`);
    lines.push(`NOW ${bold(i.scene.toUpperCase())}   ${dim(`rotation: clock 10s${enabled.length ? " → " + enabled.join(" → ") : ""}`)}`);
  } else {
    lines.push(dim(state.token ? "waiting for first authenticated poll…" : "no token — type: pair"));
    lines.push("");
  }
  lines.push(dim("─".repeat(78)));
  lines.push(dim("APP           EN   RESULT        HTTP  BYTES    AGE   ROWS  OK/TRIES"));
  const diagApps = state.diag?.apps ?? [];
  for (const id of ["messages", "flights_list", "custom"]) {
    const d = diagApps.find((a) => a.id === id);
    if (!d) { lines.push(dim(`${id.padEnd(13)} ${state.token ? "…" : "—"}`)); continue; }
    const good = d.result === "ok" || d.result === "offline-app";
    const result = good ? green(d.result.padEnd(13)) : d.result === "idle" ? dim(d.result.padEnd(13)) : red(d.result.padEnd(13));
    lines.push(
      `${id.padEnd(13)} ${(d.enabled ? "on" : "off").padEnd(4)} ${result} ${String(d.http || "").padEnd(5)} ${String(d.bytes || "").padEnd(8)} ${(d.age_s != null && d.attempts ? d.age_s + "s" : "").padEnd(5)} ${String(d.rows).padEnd(5)} ${d.attempts ? `${d.ok}/${d.attempts}` : ""}`,
    );
  }
  if (state.diag) lines.push(dim(`fetch buffer ${(state.diag.fetch_cap / 1024).toFixed(0)}k (${state.diag.psram ? "PSRAM" : "internal"})`));
  else lines.push("");
  lines.push(dim("─".repeat(78)));
  for (const entry of state.log.slice(-state.logLines)) lines.push(dim(entry));
  for (let pad = state.log.length; pad < state.logLines; pad++) lines.push("");
  return lines;
}

const PANE_HEIGHT = 9 + Number(flag("--log") ?? 7);
function draw() {
  const lines = paneLines().slice(0, PANE_HEIGHT);
  let out = `${ESC}s${ESC}H`;                       // save cursor, home
  for (const line of lines) out += `${line}${ESC}K\n`;
  out += `${dim("─".repeat(78))}${ESC}K\n${ESC}u`;  // restore cursor
  process.stdout.write(out);
  rl.prompt(true);
}

// ---------------------------------------------------------------- commands
const HELP = `commands:
  pair                 show a code on the panel, then type it here
  text <msg…>          push text (10 min: text hello world)
  show <app>           messages | flights | custom
  clear                back to the rotation      bright <10-150>
  weather <STATION>    install NWS layout (e.g. weather KORD)
  flights <url|scan>   set receiver URL, or let the device scan
  enable/disable <app> toggle an app in the rotation
  diag                 log each app's last fetch verdict
  get/post <path> [json]   raw /api/v1 call
  save                 store device+token in ~/.dmx-top.json     q  quit`;

function saveConfig() {
  writeFileSync(CONFIG_PATH, JSON.stringify({ device: state.device, token: state.token }, null, 2));
  chmodSync(CONFIG_PATH, 0o600);
  log(`saved ${CONFIG_PATH}`);
}

const APP_IDS = { messages: "messages", flights: "flights_list", flights_list: "flights_list", custom: "custom" };

async function run(input) {
  const [cmd, ...rest] = input.trim().split(/\s+/);
  const arg = rest.join(" ");
  if (!cmd) return;
  switch (cmd) {
    case "q": case "quit": case "exit": shutdown(); return;
    case "help": for (const line of HELP.split("\n")) log(line); return;
    case "pair": {
      await api("/api/v1/claim/start", { method: "POST", open: true });
      const code = await ask("6-digit code on the panel: ");
      const result = await api("/api/v1/claim/finish", { method: "POST", open: true, body: { code: code.replace(/\D/g, "") } });
      state.token = result.token;
      state.paired = true;
      saveConfig();
      log(`paired with ${result.device ?? "device"}${result.fingerprint ? ` · key ${result.fingerprint}` : ""}`);
      return;
    }
    case "text": {
      if (!arg) { log("usage: text <message>"); return; }
      await api("/api/v1/display/text", { method: "POST", body: { text: arg, duration_s: 30 } });
      log(`text pushed: "${arg}" (30s)`);
      return;
    }
    case "show": {
      const id = APP_IDS[arg];
      if (!id) { log("usage: show messages|flights|custom"); return; }
      await api(`/api/v1/apps/${id}/show`, { method: "POST" });
      log(`showing ${id}`);
      return;
    }
    case "clear": await api("/api/v1/display/clear", { method: "POST" }); log("cleared — rotation resumes"); return;
    case "bright": {
      const value = Number(arg);
      await api("/api/v1/display/brightness", { method: "POST", body: { value } });
      log(`brightness ${value}`);
      return;
    }
    case "weather": {
      const station = (arg || "KORD").toUpperCase();
      const layout = {
        v: 1,
        source: { url: `https://api.weather.gov/stations/${station}/observations/latest`, interval_s: 600, stale_after_s: 7200 },
        rows: [
          { y: 5, color: [90, 170, 255], text: `WEATHER ${station}` },
          { y: 17, color: [235, 235, 235], bind: "/properties/temperature/value", prefix: "TEMP ", suffix: " C" },
          { y: 29, color: [120, 200, 120], bind: "/properties/windSpeed/value", prefix: "WIND ", suffix: " KMH" },
        ],
      };
      await api("/api/v1/apps/custom", { method: "POST", body: layout });
      await api("/api/v1/apps", { method: "POST", body: { id: "custom", enabled: true } });
      await api("/api/v1/apps/custom/show", { method: "POST" });
      log(`weather ${station} installed + showing (watch APP diag for the fetch)`);
      return;
    }
    case "flights": {
      if (arg === "scan") {
        const found = await api("/api/v1/apps/flights/scan", { method: "POST" });
        log(found.found ? `receiver found: ${found.found} — saving` : "no receiver answered");
        if (found.found) await api("/api/v1/apps/flights", { method: "POST", body: { url: found.found } });
      } else if (arg) {
        await api("/api/v1/apps/flights", { method: "POST", body: { url: normalize(arg) } });
        log(`receiver url set: ${arg}`);
      } else { log("usage: flights <url> | flights scan"); return; }
      await api("/api/v1/apps", { method: "POST", body: { id: "flights_list", enabled: true } });
      log("flights list enabled");
      return;
    }
    case "enable": case "disable": {
      const id = APP_IDS[arg];
      if (!id) { log(`usage: ${cmd} messages|flights|custom`); return; }
      await api("/api/v1/apps", { method: "POST", body: { id, enabled: cmd === "enable" } });
      log(`${id} ${cmd}d`);
      return;
    }
    case "diag": {
      const diag = await api("/api/v1/apps/diag");
      for (const app of diag.apps) log(`${app.id}: ${app.result} http=${app.http} bytes=${app.bytes} rows=${app.rows} tries=${app.attempts}`);
      return;
    }
    case "get": case "post": {
      if (!rest[0]) { log(`usage: ${cmd} /api/v1/… [json]`); return; }
      const body = rest[1] ? JSON.parse(rest.slice(1).join(" ")) : undefined;
      const result = await api(rest[0], { method: cmd.toUpperCase(), body });
      log(JSON.stringify(result).slice(0, 200));
      return;
    }
    case "token": state.token = arg; log("token set (type: save to keep it)"); return;
    case "save": saveConfig(); return;
    default: log(`unknown: ${cmd} (type: help)`);
  }
}

// -------------------------------------------------------------------- shell
process.stdout.write(`${ESC}2J${ESC}H${"\n".repeat(PANE_HEIGHT + 1)}`);
const rl = createInterface({ input: process.stdin, output: process.stdout, prompt: "> " });
let asking = null;
function ask(question) {
  return new Promise((resolve) => { asking = resolve; rl.setPrompt(question); rl.prompt(true); });
}
rl.on("line", (line) => {
  if (asking) { const resolve = asking; asking = null; rl.setPrompt("> "); resolve(line); return; }
  run(line).catch((error) => log(String(error.message ?? error))).finally(() => { draw(); rl.prompt(true); });
});
rl.on("close", shutdown);
function shutdown() {
  clearInterval(timer);
  process.stdout.write(`${ESC}2J${ESC}H`);
  process.exit(0);
}

log(`dmx-top · ${state.device} · poll ${state.intervalMs / 1000}s · type help`);
if (!state.token) log("no token yet — type: pair (the panel will show a code)");
const timer = setInterval(async () => { await poll(); draw(); }, state.intervalMs);
await poll();
draw();
rl.prompt();
