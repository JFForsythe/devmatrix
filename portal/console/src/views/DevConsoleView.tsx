// SPDX-License-Identifier: GPL-3.0-or-later
import { useMemo, useState } from "preact/hooks";
import { Card, copyText, Status, ViewHeader } from "../components";
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
  { label: "Read Flights config", method: "GET", path: "/api/v1/apps/flights" },
  { label: "Save Flights config", method: "POST", path: "/api/v1/apps/flights", body: '{"url":"http://receiver/data/aircraft.json","interval_s":1,"rows":2,"format":"kts","view":"list"}' },
  { label: "Scan for receiver", method: "POST", path: "/api/v1/apps/flights/scan" },
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
        Build ready-to-run curl commands against the selected device without hiding the underlying route or JSON.
      </ViewHeader>

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
