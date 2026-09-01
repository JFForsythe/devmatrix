// SPDX-License-Identifier: GPL-3.0-or-later
import { useEffect, useRef, useState } from "preact/hooks";
import { useMemo } from "preact/hooks";
import { Card, copyText, Status, ViewHeader } from "../components";
import { STATION_PATTERN, weatherLayout } from "../layouts";
import type { ConsoleTransport } from "../transport";
import type { StatusMessage } from "../types";

interface RouteDefinition {
  label: string;
  method: "GET" | "POST";
  path: string;
  body?: string;
  open?: boolean;
  multipart?: boolean;
}
const ROUTES: RouteDefinition[] = [
  { label: "Health", method: "GET", path: "/api/v1/health", open: true },
  { label: "Device info", method: "GET", path: "/api/v1/info" },
  { label: "Push text", method: "POST", path: "/api/v1/display/text", body: '{"text":"SHIP IT","duration_s":30}' },
  { label: "Push frame", method: "POST", path: "/api/v1/display/frame", body: '{"b64":"<4096-byte RGB565 frame base64>"}' },
  { label: "Brightness", method: "POST", path: "/api/v1/display/brightness", body: '{"value":110}' },
  { label: "Clear display", method: "POST", path: "/api/v1/display/clear" },
  { label: "Identify", method: "POST", path: "/api/v1/identify" },
  { label: "Start claim", method: "POST", path: "/api/v1/claim/start", open: true },
  { label: "Finish claim", method: "POST", path: "/api/v1/claim/finish", body: '{"code":"123456"}', open: true },
  { label: "Read settings", method: "GET", path: "/api/v1/settings" },
  { label: "Save timezone", method: "POST", path: "/api/v1/settings", body: '{"tz":"CST6CDT,M3.2.0,M11.1.0"}' },
  { label: "Read MQTT config", method: "GET", path: "/api/v1/mqtt" },
  { label: "Save MQTT config", method: "POST", path: "/api/v1/mqtt", body: '{"enabled":true,"host":"broker.home.arpa","port":1883,"username":"DMX-4E71-0952","password":"write-only","tls":false}' },
  { label: "Read app settings", method: "GET", path: "/api/v1/apps" },
  { label: "Save app settings", method: "POST", path: "/api/v1/apps", body: '{"id":"messages","enabled":true,"interval_s":10,"refresh_s":30}' },
  { label: "Read Messages config", method: "GET", path: "/api/v1/apps/messages" },
  { label: "Save Messages config", method: "POST", path: "/api/v1/apps/messages", body: '{"phrases":["HELLO FROM THE\\nDEV CONSOLE"],"rotation_s":30}' },
  { label: "Show Messages", method: "POST", path: "/api/v1/apps/messages/show" },
  { label: "Read Custom layout", method: "GET", path: "/api/v1/apps/custom" },
  { label: "Save Custom layout", method: "POST", path: "/api/v1/apps/custom", body: '{"v":1,"source":null,"rows":[{"y":11,"color":[255,178,36],"text":"CUSTOM READY"}]}' },
  { label: "Show Custom layout", method: "POST", path: "/api/v1/apps/custom/show" },
  { label: "Read Flights config", method: "GET", path: "/api/v1/apps/flights" },
  { label: "Save Flights config", method: "POST", path: "/api/v1/apps/flights", body: '{"url":"http://receiver/data/aircraft.json","interval_s":1,"rows":2,"format":"kts","view":"list"}' },
  { label: "App fetch diagnostics", method: "GET", path: "/api/v1/apps/diag" },
  { label: "Show Flights list", method: "POST", path: "/api/v1/apps/flights_list/show" },
  { label: "Rotate token", method: "POST", path: "/api/v1/token/rotate" },
  { label: "Reboot", method: "POST", path: "/api/v1/reboot" },
  { label: "Change Wi-Fi", method: "POST", path: "/api/v1/wifi/reset" },
  { label: "Factory reset", method: "POST", path: "/api/v1/factory/reset" },
  { label: "OTA upload", method: "POST", path: "/update", multipart: true },
];

function buildCurl(route: RouteDefinition, baseUrl: string, token: string, includeToken: boolean, body: string): string {
  const parts = [`curl -X ${route.method} '${baseUrl}${route.path}'`];
  if (!route.open) parts.push(`  -H 'Authorization: Bearer ${includeToken ? token || "<pair-this-browser>" : "$TOKEN"}'`);
  if (route.multipart) parts.push("  -F 'firmware=@firmware.bin'");
  else if (route.method === "POST" && body) {
    parts.push("  -H 'Content-Type: application/json'");
    parts.push(`  -d '${body}'`);
  }
  return parts.join(" \\\n");
}

const TERMINAL_HELP = [
  "commands:",
  "  info · diag · apps            read device state",
  "  text <message>                push text for 30s",
  "  show messages|flights|custom  jump the rotation",
  "  clear · bright <10-150>       display controls",
  "  weather <STATION>             install the NWS layout (e.g. weather KORD)",
  "  flights <url>                 set the receiver URL + enable the list",
  "  get <path> · post <path> [json]   any documented route",
];
const TERMINAL_APPS: Record<string, string> = { messages: "messages", flights: "flights_list", flights_list: "flights_list", custom: "custom" };

// The same command language as examples/dmx-top.mjs, running in the
// browser over the existing authenticated transport. A custom DOM
// terminal per ADR-0014 — never a host shell.
function CommandTerminal({ transport }: { transport: ConsoleTransport }) {
  const [lines, setLines] = useState<string[]>(["DK-01 command line — type help"]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    outputRef.current?.scrollTo(0, outputRef.current.scrollHeight);
  }, [lines]);

  function print(...added: string[]): void {
    setLines((current) => [...current, ...added].slice(-300));
  }

  async function execute(commandLine: string): Promise<void> {
    const [command, ...rest] = commandLine.trim().split(/\s+/);
    const argument = rest.join(" ");
    switch (command) {
      case "help": print(...TERMINAL_HELP); return;
      case "info": case "diag": case "apps": {
        const path = command === "info" ? "/api/v1/info" : command === "diag" ? "/api/v1/apps/diag" : "/api/v1/apps";
        print(JSON.stringify(await transport.get(path), null, 1));
        return;
      }
      case "text": {
        if (!argument) { print("usage: text <message>"); return; }
        await transport.post("/api/v1/display/text", { text: argument, duration_s: 30 });
        print(`text on the panel for 30s: "${argument}"`);
        return;
      }
      case "show": {
        const id = TERMINAL_APPS[argument];
        if (!id) { print("usage: show messages|flights|custom"); return; }
        await transport.post(`/api/v1/apps/${id}/show`);
        print(`showing ${id}`);
        return;
      }
      case "clear": await transport.post("/api/v1/display/clear"); print("cleared — rotation resumes"); return;
      case "bright": {
        await transport.post("/api/v1/display/brightness", { value: Number(argument) });
        print(`brightness ${argument}`);
        return;
      }
      case "weather": {
        const station = (argument || "KORD").toUpperCase();
        if (!STATION_PATTERN.test(station)) { print("usage: weather <US station, e.g. KORD>"); return; }
        await transport.post("/api/v1/apps/custom", weatherLayout(station));
        await transport.post("/api/v1/apps", { id: "custom", enabled: true });
        await transport.post("/api/v1/apps/custom/show");
        print(`weather ${station} installed + showing — run diag to watch the fetch`);
        return;
      }
      case "flights": {
        if (!argument) { print("usage: flights <aircraft.json url>"); return; }
        await transport.post("/api/v1/apps/flights", { url: argument });
        await transport.post("/api/v1/apps", { id: "flights_list", enabled: true });
        print("receiver url saved + flights list enabled — run diag to watch the fetch");
        return;
      }
      case "get": case "post": {
        if (!rest[0]) { print(`usage: ${command} /api/v1/… [json]`); return; }
        const body = rest.length > 1 ? (JSON.parse(rest.slice(1).join(" ")) as unknown) : undefined;
        const result = command === "get" ? await transport.get(rest[0]) : await transport.post(rest[0], body);
        print(JSON.stringify(result, null, 1));
        return;
      }
      case undefined: case "": return;
      default: print(`unknown: ${command} — type help`);
    }
  }

  async function submit(): Promise<void> {
    const commandLine = input.trim();
    if (!commandLine || busy) return;
    setInput("");
    print(`> ${commandLine}`);
    setBusy(true);
    try {
      await execute(commandLine);
    } catch (error) {
      print(`error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div class="terminal">
      <div class="terminal-out" ref={outputRef} aria-live="polite">
        {lines.map((line) => <div>{line}</div>)}
      </div>
      <div class="terminal-in">
        <span aria-hidden="true">›</span>
        <input
          value={input}
          disabled={busy}
          placeholder="help"
          spellcheck={false}
          autoComplete="off"
          onInput={(event) => setInput(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void submit();
          }}
        />
      </div>
    </div>
  );
}

export function DevConsoleView({ transport }: { transport: ConsoleTransport }) {
  const [routeIndex, setRouteIndex] = useState(2);
  const [body, setBody] = useState(ROUTES[2].body ?? "");
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const route = ROUTES[routeIndex];
  const preview = useMemo(() => buildCurl(route, transport.address, transport.getToken(), false, body), [route, body, transport]);

  function chooseRoute(index: number): void {
    setRouteIndex(index);
    setBody(ROUTES[index].body ?? "");
    setStatus(null);
  }

  async function copyWithToken(): Promise<void> {
    try {
      await copyText(buildCurl(route, transport.address, transport.getToken(), true, body));
      setStatus({ kind: "ok", text: route.open ? "Command copied. This route is open." : "Command copied with this browser’s LAN token." });
    } catch {
      setStatus({ kind: "error", text: "Clipboard access failed. Select the command and copy it manually." });
    }
  }

  return (
    <div class="view">
      <ViewHeader eyebrow="DOCUMENTED LAN API" title="Dev console">
        Talk to the box from here — a command line, plus curl commands to copy into your own scripts.
      </ViewHeader>

      <Card title="Command line" aside={<span class={`chip ${transport.isMock ? "demo" : "ok"}`}>{transport.isMock ? "SIMULATED" : "RUNS ON THIS DEVICE"}</span>}>
        <p class="lead">The same commands as <code>examples/dmx-top.mjs</code>, in the browser: type <code>help</code> to start, <code>diag</code> to see why any app is blank.</p>
        <CommandTerminal transport={transport} />
      </Card>

      <Card title="API workbench" aside={<span class="chip">{ROUTES.length} DOCUMENTED ROUTES</span>}>
        <div class="workbench-grid">
          <label class="field">
            <span>ROUTE</span>
            <select value={routeIndex} onChange={(event) => chooseRoute(Number(event.currentTarget.value))}>
              {ROUTES.map((definition, index) => (
                <option value={index}>{definition.method} · {definition.label}</option>
              ))}
            </select>
          </label>
          <div class="route-preview"><span>{route.method}</span><code>{route.path}</code>{route.open && <i>OPEN</i>}</div>
        </div>

        {route.method === "POST" && !route.multipart && (
          <label class="field">
            <span>JSON BODY</span>
            <textarea rows={5} value={body} onInput={(event) => setBody(event.currentTarget.value)} spellcheck={false} />
          </label>
        )}

        <div class="command-block large">
          <div><span>CURL COMMAND</span><button class="btn small" type="button" onClick={() => void copyWithToken()}>COPY WITH MY TOKEN</button></div>
          <pre>{preview}</pre>
        </div>
        <Status message={status} />
      </Card>

      <Card title="Authentication model" aside={<span class="chip">BEARER · LAN</span>}>
        <p class="lead">Health and claim routes are open. Every other API route uses the LAN token stored in this browser.</p>
        <p class="note">Full frames are exactly 4096 bytes of RGB565 data encoded as base64 inside the b64 JSON field.</p>
      </Card>
    </div>
  );
}
