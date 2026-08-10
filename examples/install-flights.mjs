#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Writable } from "node:stream";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";

const LABEL = "com.devmatrix.flights";
const UNIT = "dmx-flights.service";
const INSTALLER_PATH = fileURLToPath(import.meta.url);
const FLIGHTS_PATH = path.resolve(path.dirname(INSTALLER_PATH), "flights-overhead.mjs");
const NODE_PATH = path.resolve(process.execPath);
const CONFIG_FLAGS = new Map([
  ["--url", "DMX_URL"],
  ["--token", "DMX_TOKEN"],
  ["--receiver-url", "RECEIVER_URL"],
  ["--airport", "AIRPORT"],
  ["--view-mi", "VIEW_MI"],
  ["--fps", "FPS"],
]);

let knownToken = "";

function usage() {
  return `Usage: node examples/install-flights.mjs [mode] [options]

Modes:
  --install                 Install or replace the service (default)
  --uninstall               Stop and remove the service
  --status                  Show service state and the last five log lines
  --dry-run                 Print the selected action without changing anything

Install options:
  --url URL                 Device URL (DMX_URL; prompted when omitted)
  --token TOKEN             LAN token (DMX_TOKEN; securely prompted when omitted)
  --receiver-url URL        Override RECEIVER_URL
  --airport CODE            Set AIRPORT
  --view-mi MILES           Set VIEW_MI
  --fps RATE                Set FPS (2-15)

Uninstall options:
  --purge                   Also remove the saved environment file

Other:
  --help                    Show this help`;
}

function parseArgs(argv) {
  const options = {
    action: "install",
    dryRun: false,
    env: {},
    explicitAction: null,
    help: false,
    purge: false,
  };

  const chooseAction = action => {
    if (options.explicitAction && options.explicitAction !== action) {
      throw new Error(`Choose only one of --${options.explicitAction} and --${action}.`);
    }
    options.action = action;
    options.explicitAction = action;
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--install") {
      chooseAction("install");
      continue;
    }
    if (argument === "--uninstall") {
      chooseAction("uninstall");
      continue;
    }
    if (argument === "--status") {
      chooseAction("status");
      continue;
    }
    if (argument === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (argument === "--purge") {
      options.purge = true;
      continue;
    }
    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }

    const equals = argument.indexOf("=");
    const flag = equals === -1 ? argument : argument.slice(0, equals);
    if (!CONFIG_FLAGS.has(flag)) {
      throw new Error(`Unknown option: ${flag}`);
    }

    let value = equals === -1 ? argv[index + 1] : argument.slice(equals + 1);
    if (equals === -1) index += 1;
    if (value === undefined || value === "" || (equals === -1 && value.startsWith("--"))) {
      throw new Error(`${flag} requires a value.`);
    }
    options.env[CONFIG_FLAGS.get(flag)] = value;
  }

  if (options.purge && options.action !== "uninstall") {
    throw new Error("--purge can only be used with --uninstall.");
  }
  if (options.dryRun && options.action === "status") {
    throw new Error("--dry-run cannot be combined with --status (status is already read-only).");
  }
  if (options.action !== "install" && Object.keys(options.env).length > 0) {
    throw new Error("Configuration flags can only be used with --install or its dry run.");
  }
  return options;
}

function assertSafeValue(name, value) {
  if (value.includes("\0") || value.includes("\n") || value.includes("\r")) {
    throw new Error(`${name} cannot contain NUL or newline characters.`);
  }
}

function validateConfig(env) {
  for (const [name, value] of Object.entries(env)) assertSafeValue(name, value);

  for (const name of ["DMX_URL", "RECEIVER_URL"]) {
    if (!env[name]) continue;
    let parsed;
    try {
      parsed = new URL(env[name]);
    } catch {
      throw new Error(`${name} must be a complete http:// or https:// URL.`);
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error(`${name} must use http:// or https://.`);
    }
  }

  if (env.VIEW_MI !== undefined && (!Number.isFinite(Number(env.VIEW_MI)) || Number(env.VIEW_MI) <= 0)) {
    throw new Error("--view-mi must be a positive number.");
  }
  if (
    env.FPS !== undefined &&
    (!Number.isFinite(Number(env.FPS)) || Number(env.FPS) < 2 || Number(env.FPS) > 15)
  ) {
    throw new Error("--fps must be a number from 2 through 15.");
  }
}

async function collectConfig(initialEnv) {
  const env = { ...initialEnv };
  if (env.DMX_URL && env.DMX_TOKEN) {
    validateConfig(env);
    return env;
  }
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("Pass both --url and --token when input is not an interactive terminal.");
  }

  let muted = false;
  const promptOutput = new Writable({
    write(chunk, encoding, callback) {
      if (!muted) process.stdout.write(chunk, encoding);
      callback();
    },
  });
  promptOutput.isTTY = true;
  promptOutput.columns = process.stdout.columns;
  const prompt = createInterface({ input: process.stdin, output: promptOutput, terminal: true });

  try {
    while (!env.DMX_URL) env.DMX_URL = (await prompt.question("DMX device URL: ")).trim();
    while (!env.DMX_TOKEN) {
      process.stdout.write("DMX token (input hidden): ");
      muted = true;
      env.DMX_TOKEN = await prompt.question("");
      muted = false;
      process.stdout.write("\n");
    }
  } finally {
    if (muted) process.stdout.write("\n");
    muted = false;
    prompt.close();
  }

  validateConfig(env);
  return env;
}

function pathsForPlatform(platform = process.platform) {
  if (platform === "linux") {
    return {
      envDirectory: "/etc/devmatrix",
      envFile: "/etc/devmatrix/flights.env",
      serviceFile: "/etc/systemd/system/dmx-flights.service",
    };
  }
  if (platform === "darwin") {
    const home = os.homedir();
    return {
      envDirectory: path.join(home, "Library", "Application Support", "devmatrix"),
      envFile: path.join(home, "Library", "Application Support", "devmatrix", "flights.env"),
      launchAgentsDirectory: path.join(home, "Library", "LaunchAgents"),
      logDirectory: path.join(home, "Library", "Logs", "devmatrix"),
      stderrLog: path.join(home, "Library", "Logs", "devmatrix", "flights-error.log"),
      stdoutLog: path.join(home, "Library", "Logs", "devmatrix", "flights.log"),
      serviceFile: path.join(home, "Library", "LaunchAgents", `${LABEL}.plist`),
    };
  }
  throw new Error(`Unsupported platform: ${platform}. Use Linux or macOS.`);
}

function orderedEnvironment(env) {
  return ["DMX_URL", "DMX_TOKEN", "RECEIVER_URL", "AIRPORT", "VIEW_MI", "FPS"]
    .filter(name => env[name] !== undefined)
    .map(name => [name, env[name]]);
}

function quoteEnvironmentValue(value) {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function renderEnvFile(env) {
  return `${orderedEnvironment(env)
    .map(([name, value]) => `${name}=${quoteEnvironmentValue(value)}`)
    .join("\n")}\n`;
}

function quoteSystemdArgument(value) {
  const escaped = value
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replaceAll("%", "%%");
  return `"${escaped}"`;
}

function renderSystemdUnit() {
  return `[Unit]
Description=Devmatrix Flights Overhead
After=network-online.target

[Service]
EnvironmentFile=/etc/devmatrix/flights.env
ExecStart=${quoteSystemdArgument(NODE_PATH)} ${quoteSystemdArgument(FLIGHTS_PATH)}
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
`;
}

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function renderLaunchAgent(env, paths) {
  const variables = orderedEnvironment(env)
    .map(
      ([name, value]) =>
        `    <key>${escapeXml(name)}</key>\n    <string>${escapeXml(value)}</string>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${escapeXml(NODE_PATH)}</string>
    <string>${escapeXml(FLIGHTS_PATH)}</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
${variables}
  </dict>
  <key>KeepAlive</key>
  <true/>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${escapeXml(paths.stdoutLog)}</string>
  <key>StandardErrorPath</key>
  <string>${escapeXml(paths.stderrLog)}</string>
</dict>
</plist>
`;
}

function shellQuote(value) {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

function showCommand(command, args, note = "") {
  const rendered = [command, ...args].map(shellQuote).join(" ");
  console.log(`  ${rendered}${note ? `  # ${note}` : ""}`);
}

function printFilePlan(file, mode, content) {
  console.log(`\nWrite ${file} (mode ${mode.toString(8).padStart(4, "0")}):`);
  process.stdout.write(content);
}

function redactedEnvironment(env) {
  return { ...env, DMX_TOKEN: "***REDACTED***" };
}

function printInstallPlan(env, paths) {
  const platformName = process.platform === "darwin" ? "macOS (launchd)" : "Linux (systemd)";
  console.log(`Devmatrix Flights install dry run — ${platformName}`);
  console.log(`Node: ${NODE_PATH}`);
  console.log(`Flights script: ${FLIGHTS_PATH}`);
  if (process.platform === "linux") {
    console.log("Privilege: real installation must run as root (normally via sudo).");
  }
  const safeEnv = redactedEnvironment(env);
  console.log(`\nCreate directory: ${paths.envDirectory}`);
  printFilePlan(paths.envFile, 0o600, renderEnvFile(safeEnv));

  if (process.platform === "linux") {
    printFilePlan(paths.serviceFile, 0o644, renderSystemdUnit());
    console.log("\nCommands:");
    showCommand("systemctl", ["daemon-reload"]);
    showCommand("systemctl", ["enable", "--now", UNIT]);
  } else {
    console.log(`\nCreate directories: ${paths.launchAgentsDirectory}, ${paths.logDirectory}`);
    printFilePlan(paths.serviceFile, 0o600, renderLaunchAgent(safeEnv, paths));
    const domain = `gui/${process.getuid()}`;
    console.log("\nCommands:");
    showCommand("launchctl", ["print", `${domain}/${LABEL}`], "detect an existing service");
    showCommand("launchctl", ["list", LABEL], "older macOS detection fallback");
    showCommand("launchctl", ["bootout", `${domain}/${LABEL}`], "if already loaded");
    showCommand("launchctl", ["bootstrap", domain, paths.serviceFile]);
    showCommand("launchctl", ["load", "-w", paths.serviceFile], "fallback on older macOS");
  }
  console.log("\nDry run complete: no files written and no commands run.");
}

function printUninstallPlan(options, paths) {
  const platformName = process.platform === "darwin" ? "macOS (launchd)" : "Linux (systemd)";
  console.log(`Devmatrix Flights uninstall dry run — ${platformName}`);
  if (process.platform === "linux") {
    console.log("Privilege: real uninstallation must run as root (normally via sudo).");
    console.log("\nCommands:");
    showCommand("systemctl", ["disable", "--now", UNIT], "if installed");
    console.log(`  remove ${paths.serviceFile}`);
    showCommand("systemctl", ["daemon-reload"]);
  } else {
    const domain = `gui/${process.getuid()}`;
    console.log("\nCommands:");
    showCommand("launchctl", ["print", `${domain}/${LABEL}`], "detect a loaded service");
    showCommand("launchctl", ["list", LABEL], "older macOS detection fallback");
    showCommand("launchctl", ["bootout", `${domain}/${LABEL}`], "if loaded");
    showCommand("launchctl", ["unload", "-w", paths.serviceFile], "fallback on older macOS");
    console.log(`  remove ${paths.serviceFile}`);
  }
  if (options.purge) console.log(`  remove ${paths.envFile} (--purge)`);
  else console.log(`  keep ${paths.envFile} (add --purge to remove it)`);
  console.log("\nDry run complete: no files removed and no commands run.");
}

function run(command, args, { allowFailure = false, capture = false } = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });
  if (result.error) throw new Error(`Could not run ${command}: ${result.error.message}`);
  if (result.status !== 0 && !allowFailure) {
    const detail = capture ? (result.stderr || result.stdout || "").trim() : "";
    throw new Error(`${command} exited with status ${result.status}${detail ? `: ${detail}` : ""}`);
  }
  return result;
}

function writeFile(file, content, mode) {
  fs.writeFileSync(file, content, { encoding: "utf8", mode });
  fs.chmodSync(file, mode);
}

function requireLinuxRoot(action) {
  if (process.getuid?.() !== 0) {
    throw new Error(
      `Linux ${action} writes system files and must run as root. Re-run with sudo and enter the token at the hidden prompt.`,
    );
  }
}

function installLinux(env, paths) {
  requireLinuxRoot("installation");
  fs.mkdirSync(paths.envDirectory, { mode: 0o755, recursive: true });
  writeFile(paths.envFile, renderEnvFile(env), 0o600);
  writeFile(paths.serviceFile, renderSystemdUnit(), 0o644);
  run("systemctl", ["daemon-reload"]);
  run("systemctl", ["enable", "--now", UNIT]);
  console.log(`Installed and started ${UNIT}.`);
}

function macServiceState(domain) {
  const modern = run("launchctl", ["print", `${domain}/${LABEL}`], {
    allowFailure: true,
    capture: true,
  });
  if (modern.status === 0) return { loaded: true, output: modern.stdout, source: "print" };
  const legacy = run("launchctl", ["list", LABEL], { allowFailure: true, capture: true });
  return {
    loaded: legacy.status === 0,
    output: legacy.stdout,
    source: legacy.status === 0 ? "list" : "print",
  };
}

function unloadMacService(domain, serviceFile) {
  const bootout = run("launchctl", ["bootout", `${domain}/${LABEL}`], {
    allowFailure: true,
    capture: true,
  });
  if (bootout.status === 0) return;
  const unload = run("launchctl", ["unload", "-w", serviceFile], {
    allowFailure: true,
    capture: true,
  });
  if (unload.status !== 0) {
    const detail = (unload.stderr || bootout.stderr || "").trim();
    throw new Error(`Could not unload ${LABEL}${detail ? `: ${detail}` : ""}`);
  }
}

function installMac(env, paths) {
  fs.mkdirSync(paths.envDirectory, { mode: 0o700, recursive: true });
  fs.mkdirSync(paths.launchAgentsDirectory, { mode: 0o755, recursive: true });
  fs.mkdirSync(paths.logDirectory, { mode: 0o700, recursive: true });
  writeFile(paths.envFile, renderEnvFile(env), 0o600);
  writeFile(paths.serviceFile, renderLaunchAgent(env, paths), 0o600);

  const domain = `gui/${process.getuid()}`;
  if (macServiceState(domain).loaded) unloadMacService(domain, paths.serviceFile);
  const bootstrap = run("launchctl", ["bootstrap", domain, paths.serviceFile], {
    allowFailure: true,
    capture: true,
  });
  if (bootstrap.status !== 0) {
    console.warn("launchctl bootstrap was unavailable; trying the older load -w command.");
    const fallback = run("launchctl", ["load", "-w", paths.serviceFile], {
      allowFailure: true,
      capture: true,
    });
    if (fallback.status !== 0) {
      const detail = (fallback.stderr || bootstrap.stderr || "").trim();
      throw new Error(`Could not load ${LABEL}${detail ? `: ${detail}` : ""}`);
    }
  }
  console.log(`Installed and started ${LABEL}.`);
}

function uninstallLinux(options, paths) {
  requireLinuxRoot("uninstallation");
  const loaded = run("systemctl", ["show", UNIT, "--property=LoadState", "--value"], {
    allowFailure: true,
    capture: true,
  });
  if (loaded.stdout.trim() !== "not-found") run("systemctl", ["disable", "--now", UNIT]);
  fs.rmSync(paths.serviceFile, { force: true });
  run("systemctl", ["daemon-reload"]);
  if (options.purge) fs.rmSync(paths.envFile, { force: true });
  console.log(`Removed ${UNIT}${options.purge ? " and its environment file" : ""}.`);
}

function uninstallMac(options, paths) {
  const domain = `gui/${process.getuid()}`;
  if (macServiceState(domain).loaded) unloadMacService(domain, paths.serviceFile);
  fs.rmSync(paths.serviceFile, { force: true });
  if (options.purge) fs.rmSync(paths.envFile, { force: true });
  console.log(`Removed ${LABEL}${options.purge ? " and its environment file" : ""}.`);
}

function lastLines(file, count = 5) {
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  if (lines.at(-1) === "") lines.pop();
  return lines.slice(-count);
}

function statusLinux() {
  const loaded = run("systemctl", ["show", UNIT, "--property=LoadState", "--value"], {
    allowFailure: true,
    capture: true,
  });
  const active = run("systemctl", ["is-active", UNIT], { allowFailure: true, capture: true });
  const enabled = run("systemctl", ["is-enabled", UNIT], { allowFailure: true, capture: true });
  console.log(`Service: ${UNIT}`);
  console.log(`Loaded: ${loaded.stdout.trim() || "unknown"}`);
  console.log(`Running: ${active.stdout.trim() || "unknown"}`);
  console.log(`Enabled at boot: ${enabled.stdout.trim() || "unknown"}`);

  const journal = run("journalctl", ["-u", UNIT, "-n", "5", "--no-pager"], {
    allowFailure: true,
    capture: true,
  });
  if (journal.stdout.trim()) console.log(`\nLast log lines:\n${journal.stdout.trimEnd()}`);
  else console.log("\nLast log lines: unavailable.");
  process.exitCode = active.status === 0 ? 0 : 1;
}

function statusMac(paths) {
  const domain = `gui/${process.getuid()}`;
  const state = macServiceState(domain);
  console.log(`Service: ${LABEL}`);
  console.log(`Loaded: ${state.loaded ? "yes" : "no"}`);
  const stateMatch = state.output.match(/^\s*state = (.+)$/m);
  const legacyRunning = state.source === "list" && /["']?PID["']?\s*=\s*\d+/m.test(state.output);
  console.log(`Running: ${stateMatch ? stateMatch[1].trim() : legacyRunning ? "yes" : "no"}`);

  let foundLogs = false;
  for (const [label, file] of [
    ["stdout", paths.stdoutLog],
    ["stderr", paths.stderrLog],
  ]) {
    const lines = lastLines(file);
    if (lines.length === 0) continue;
    foundLogs = true;
    console.log(`\nLast ${label} log lines (${file}):\n${lines.join("\n")}`);
  }
  if (!foundLogs) console.log("\nLast log lines: unavailable.");
  process.exitCode = state.loaded ? 0 : 1;
}

async function main() {
  if (Number.parseInt(process.versions.node, 10) < 18) {
    throw new Error(`Node 18 or newer is required (found ${process.versions.node}).`);
  }
  const options = parseArgs(process.argv.slice(2));
  knownToken = options.env.DMX_TOKEN || "";
  if (options.help) {
    console.log(usage());
    return;
  }

  const paths = pathsForPlatform();
  if (options.action === "status") {
    if (process.platform === "linux") statusLinux();
    else statusMac(paths);
    return;
  }
  if (options.action === "uninstall") {
    if (options.dryRun) printUninstallPlan(options, paths);
    else if (process.platform === "linux") uninstallLinux(options, paths);
    else uninstallMac(options, paths);
    return;
  }

  if (process.platform === "linux" && !options.dryRun) requireLinuxRoot("installation");
  if (!fs.existsSync(FLIGHTS_PATH)) {
    throw new Error(`Companion script not found: ${FLIGHTS_PATH}`);
  }
  const env = await collectConfig(options.env);
  knownToken = env.DMX_TOKEN;
  if (options.dryRun) printInstallPlan(env, paths);
  else if (process.platform === "linux") installLinux(env, paths);
  else installMac(env, paths);
}

main().catch(error => {
  let message = error instanceof Error ? error.message : String(error);
  if (knownToken) message = message.split(knownToken).join("***REDACTED***");
  console.error(`install-flights: ${message}`);
  process.exitCode = 1;
});
