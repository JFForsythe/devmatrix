// SPDX-License-Identifier: GPL-3.0-or-later
import { useEffect, useMemo, useState } from "preact/hooks";
import { Card, copyText, GateChip, LoadingCard, Status, ViewHeader } from "../components";
import type { ConsoleTransport } from "../transport";
import type {
  AppId,
  AppsSettings,
  CustomLayout,
  FlightsSettings,
  MessagesSettings,
  StatusMessage,
} from "../types";

const BASELINES = new Set([5, 11, 17, 23, 29]);

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validateLayout(text: string): string | null {
  if (new TextEncoder().encode(text).length > 2048) return "Layout must be 2 KB or smaller.";
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return "Layout is not valid JSON.";
  }
  if (!record(value) || value.v !== 1) return "Layout v must equal 1.";
  if (value.source !== null) {
    if (!record(value.source)) return "source must be an object or null.";
    if (typeof value.source.url !== "string" || !/^https?:\/\//.test(value.source.url)) return "source.url must use HTTP or HTTPS.";
    if (!Number.isInteger(value.source.interval_s) || Number(value.source.interval_s) < 1 || Number(value.source.interval_s) > 86400) return "source.interval_s must be 1–86400.";
    if (!Number.isInteger(value.source.stale_after_s) || Number(value.source.stale_after_s) < 1 || Number(value.source.stale_after_s) > 604800) return "source.stale_after_s must be 1–604800.";
  }
  if (!Array.isArray(value.rows) || value.rows.length > 5) return "rows must be an array with at most 5 entries.";
  for (const [index, rowValue] of value.rows.entries()) {
    if (!record(rowValue)) return `Row ${index + 1} must be an object.`;
    if (typeof rowValue.y !== "number" || !BASELINES.has(rowValue.y)) return `Row ${index + 1} y must be 5, 11, 17, 23, or 29.`;
    if (!Array.isArray(rowValue.color) || rowValue.color.length !== 3 || rowValue.color.some((channel) => !Number.isInteger(channel) || channel < 0 || channel > 255)) return `Row ${index + 1} color must contain three 0–255 integers.`;
    const hasText = typeof rowValue.text === "string";
    const hasBind = typeof rowValue.bind === "string";
    if (hasText === hasBind) return `Row ${index + 1} needs exactly one of text or bind.`;
    if (hasText && String(rowValue.text).length > 64) return `Row ${index + 1} text is longer than 64 characters.`;
    if (hasBind) {
      const bind = String(rowValue.bind);
      if (bind.length > 64 || (bind && !bind.startsWith("/"))) return `Row ${index + 1} bind must be an RFC 6901 path up to 64 characters.`;
      for (const field of ["prefix", "suffix"] as const) {
        if (rowValue[field] !== undefined && (typeof rowValue[field] !== "string" || rowValue[field].length > 16)) return `Row ${index + 1} ${field} must be at most 16 characters.`;
      }
      if (rowValue.max !== undefined && (!Number.isInteger(rowValue.max) || Number(rowValue.max) < 1 || Number(rowValue.max) > 16)) return `Row ${index + 1} max must be 1–16.`;
    }
  }
  return null;
}

export function AppsView({ transport }: { transport: ConsoleTransport }) {
  const [apps, setApps] = useState<AppsSettings | null>(null);
  const [flights, setFlights] = useState<FlightsSettings | null>(null);
  const [messages, setMessages] = useState<MessagesSettings | null>(null);
  const [customText, setCustomText] = useState("");
  const [customError, setCustomError] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([transport.apps(), transport.flights(), transport.messages(), transport.custom()])
      .then(([nextApps, nextFlights, nextMessages, nextCustom]) => {
        if (!active) return;
        setApps(nextApps);
        setFlights(nextFlights);
        setMessages(nextMessages);
        setCustomText(JSON.stringify(nextCustom, null, 2));
      })
      .catch((error: unknown) => {
        if (active) setStatus({ kind: "error", text: error instanceof Error ? error.message : "Could not load app settings." });
      });
    return () => {
      active = false;
    };
  }, [transport]);

  const command = useMemo(
    () => `DMX_URL=${transport.address} DMX_TOKEN=${transport.getToken() || "<pair-this-browser>"} node examples/flights-overhead.mjs`,
    [transport],
  );

  function app(id: AppId) {
    return apps?.apps.find((item) => item.id === id);
  }

  function patchApp(id: AppId, patch: { enabled?: boolean; interval_s?: number }): void {
    setApps((current) => current ? {
      apps: current.apps.map((item) => item.id === id ? { ...item, ...patch } : item),
    } : current);
  }

  async function saveApp(id: AppId): Promise<void> {
    const current = app(id);
    if (!current) throw new Error(`Missing ${id} app settings.`);
    const saved = await transport.post<AppsSettings>("/api/v1/apps", {
      id,
      enabled: current.enabled,
      interval_s: current.interval_s,
    });
    setApps(saved);
  }

  async function show(id: AppId): Promise<void> {
    try {
      await transport.post(`/api/v1/apps/${id}/show`);
      setStatus({ kind: "ok", text: `${id.replace("_", " ")} pinned for its scene interval.` });
    } catch (error) {
      setStatus({ kind: "error", text: error instanceof Error ? error.message : "Could not show app." });
    }
  }

  async function saveMessages(): Promise<void> {
    if (!messages) return;
    try {
      const saved = await transport.post<MessagesSettings>("/api/v1/apps/messages", messages);
      setMessages(saved);
      await saveApp("messages");
      setStatus({ kind: "ok", text: "Messages phrase pack and rotation saved in device NVS." });
    } catch (error) {
      setStatus({ kind: "error", text: error instanceof Error ? error.message : "Could not save Messages." });
    }
  }

  async function saveFlights(): Promise<void> {
    if (!flights) return;
    try {
      const saved = await transport.post<FlightsSettings>("/api/v1/apps/flights", flights);
      setFlights(saved);
      await saveApp("flights_list");
      setStatus({ kind: "ok", text: "Flights list and host-app settings saved in device NVS." });
    } catch (error) {
      setStatus({ kind: "error", text: error instanceof Error ? error.message : "Could not save Flights settings." });
    }
  }

  async function scan(): Promise<void> {
    setScanning(true);
    setStatus({ kind: "info", text: "The device is scanning common receiver addresses on your LAN…" });
    try {
      const result = await transport.post<{ found: string | null }>("/api/v1/apps/flights/scan");
      if (result.found) {
        setFlights((current) => current ? { ...current, url: result.found! } : current);
        setStatus({ kind: "ok", text: `Found ${result.found}. Save to keep it.` });
      } else {
        setStatus({ kind: "error", text: "No receiver answered. Type its aircraft.json URL instead." });
      }
    } catch (error) {
      setStatus({ kind: "error", text: error instanceof Error ? error.message : "Receiver scan failed." });
    } finally {
      setScanning(false);
    }
  }

  async function saveCustom(): Promise<void> {
    const problem = validateLayout(customText);
    setCustomError(problem);
    if (problem) return;
    try {
      const saved = await transport.post<CustomLayout>("/api/v1/apps/custom", JSON.parse(customText));
      setCustomText(JSON.stringify(saved, null, 2));
      await saveApp("custom");
      setStatus({ kind: "ok", text: "Custom layout validated and saved in device NVS." });
    } catch (error) {
      setStatus({ kind: "error", text: error instanceof Error ? error.message : "Could not save Custom layout." });
    }
  }

  const messageApp = app("messages");
  const flightsApp = app("flights_list");
  const customApp = app("custom");
  const loaded = apps && flights && messages && customText;

  return (
    <div class="view">
      <ViewHeader eyebrow="ON-DEVICE + HOST APPS · TODAY" title="Apps">
        Messages, Flights list, and Custom layout run on the DK-01. The animated Flights radar remains a host app.
      </ViewHeader>
      <Status message={status} />

      {!loaded || !messageApp || !flightsApp || !customApp ? <LoadingCard /> : (
        <>
          <Card title="Messages" aside={<span class="chip ok">ON DEVICE · OFFLINE</span>}>
            <div class="app-title-row">
              <div class="app-icon" aria-hidden="true">Aa</div>
              <div><strong>A hardware-random phrase board.</strong><p>Up to eight 64-character phrases live only in device NVS; line breaks are preserved.</p></div>
            </div>
            <div class="inline-fields app-controls">
              <label class="check-chip"><input type="checkbox" checked={messageApp.enabled} onChange={(event) => patchApp("messages", { enabled: event.currentTarget.checked })} /> ENABLE IN ROTATION</label>
              <label class="field compact"><span>SCENE · 3–300 S</span><input type="number" min={3} max={300} value={messageApp.interval_s} onInput={(event) => patchApp("messages", { interval_s: Math.min(300, Math.max(3, Number(event.currentTarget.value))) })} /></label>
              <label class="field compact"><span>PHRASE ROTATION · 2–3600 S</span><input type="number" min={2} max={3600} value={messages.rotation_s} onInput={(event) => setMessages({ ...messages, rotation_s: Math.min(3600, Math.max(2, Number(event.currentTarget.value))) })} /></label>
            </div>
            <div class="phrase-list">
              {messages.phrases.map((phrase, index) => (
                <label class="field" key={index}>
                  <span>PHRASE {index + 1} · {phrase.length}/64</span>
                  <div class="field-action">
                    <textarea maxLength={64} value={phrase} onInput={(event) => setMessages({ ...messages, phrases: messages.phrases.map((item, itemIndex) => itemIndex === index ? event.currentTarget.value : item) })} />
                    <button class="btn danger" type="button" onClick={() => setMessages({ ...messages, phrases: messages.phrases.filter((_, itemIndex) => itemIndex !== index) })}>REMOVE</button>
                  </div>
                </label>
              ))}
            </div>
            <div class="button-row wrap">
              <button class="btn" type="button" disabled={messages.phrases.length >= 8} onClick={() => setMessages({ ...messages, phrases: [...messages.phrases, "NEW MESSAGE"] })}>ADD PHRASE</button>
              <button class="btn primary" type="button" onClick={() => void saveMessages()}>SAVE MESSAGES</button>
              <button class="btn" type="button" onClick={() => void show("messages")}>SHOW NOW</button>
            </div>
          </Card>

          <Card title="Flights list" aside={<span class="chip ok">LIST · ON DEVICE</span>}>
            <div class="app-title-row">
              <div class="app-icon" aria-hidden="true">✈</div>
              <div><strong>Your antenna, your panel.</strong><p>The list runs on the DK-01. The animated radar still needs the host app on your Pi, NAS, or Mac.</p></div>
            </div>
            <div class="inline-fields app-controls">
              <label class="check-chip"><input type="checkbox" checked={flightsApp.enabled} onChange={(event) => patchApp("flights_list", { enabled: event.currentTarget.checked })} /> ENABLE LIST IN ROTATION</label>
              <label class="field compact"><span>SCENE · 3–300 S</span><input type="number" min={3} max={300} value={flightsApp.interval_s} onInput={(event) => patchApp("flights_list", { interval_s: Math.min(300, Math.max(3, Number(event.currentTarget.value))) })} /></label>
            </div>
            <label class="field">
              <span>RECEIVER URL</span>
              <div class="field-action">
                <input type="url" value={flights.url} placeholder="http://receiver/data/aircraft.json" onInput={(event) => setFlights({ ...flights, url: event.currentTarget.value })} />
                <button class="btn" type="button" disabled={scanning} onClick={() => void scan()}>{scanning ? "SCANNING…" : "SCAN MY NETWORK"}</button>
              </div>
            </label>
            <p class="note">The receiver URL stays in device NVS. It is never sent to a Devmatrix service.</p>
            <div class="form-grid four">
              <label class="field"><span>FETCH · 1–60 S</span><input type="number" min={1} max={60} value={flights.interval_s} onInput={(event) => setFlights({ ...flights, interval_s: Math.min(60, Math.max(1, Number(event.currentTarget.value))) })} /></label>
              <label class="field"><span>ROWS · 1–5</span><select value={flights.rows} onChange={(event) => setFlights({ ...flights, rows: Number(event.currentTarget.value) })}>{[1, 2, 3, 4, 5].map((rows) => <option value={rows}>{rows}</option>)}</select></label>
              <label class="field"><span>VALUE</span><select value={flights.format} onChange={(event) => setFlights({ ...flights, format: event.currentTarget.value as "kts" | "alt" })}><option value="kts">Speed · kts</option><option value="alt">Altitude · ft</option></select></label>
              <label class="field"><span>HOST VIEW</span><select value={flights.view} onChange={(event) => setFlights({ ...flights, view: event.currentTarget.value as "list" | "radar" })}><option value="list">List</option><option value="radar">Radar</option></select></label>
            </div>
            <div class="button-row wrap"><button class="btn primary" type="button" onClick={() => void saveFlights()}>SAVE FLIGHTS</button><button class="btn" type="button" onClick={() => void show("flights_list")}>SHOW LIST NOW</button></div>
            <div class="command-block">
              <div><span>OPTIONAL RADAR HOST COMMAND</span><button class="btn small" type="button" onClick={() => void copyText(command)}>COPY WITH MY TOKEN</button></div>
              <pre>{command}</pre>
            </div>
          </Card>

          <Card title="Custom layout" aside={<span class="chip ok">ON DEVICE · DRAFT CONTRACT</span>}>
            <div class="app-title-row">
              <div class="app-icon" aria-hidden="true">{`{}`}</div>
              <div><strong>Bind five rows to any small JSON feed.</strong><p>Literal-only layouts work offline; HTTP and HTTPS sources refresh on the device and retain dimmed stale data.</p></div>
            </div>
            <div class="inline-fields app-controls">
              <label class="check-chip"><input type="checkbox" checked={customApp.enabled} onChange={(event) => patchApp("custom", { enabled: event.currentTarget.checked })} /> ENABLE IN ROTATION</label>
              <label class="field compact"><span>SCENE · 3–300 S</span><input type="number" min={3} max={300} value={customApp.interval_s} onInput={(event) => patchApp("custom", { interval_s: Math.min(300, Math.max(3, Number(event.currentTarget.value))) })} /></label>
            </div>
            <label class="field">
              <span>LAYOUT JSON · 2 KB MAX</span>
              <textarea class="json-editor" value={customText} spellcheck={false} onInput={(event) => {
                const text = event.currentTarget.value;
                setCustomText(text);
                setCustomError(validateLayout(text));
              }} />
            </label>
            {customError ? <div class="status error">{customError}</div> : <p class="note">Valid v1 layout · rows use baselines 5, 11, 17, 23, 29 · bindings are RFC 6901 JSON Pointers.</p>}
            <div class="button-row wrap"><button class="btn primary" type="button" disabled={Boolean(customError)} onClick={() => void saveCustom()}>VALIDATE & SAVE</button><button class="btn" type="button" onClick={() => void show("custom")}>SHOW NOW</button></div>
          </Card>
        </>
      )}

      <Card title="Community Registry" aside={<GateChip gate="M4" />}>
        <p class="lead">Reviewed declarative apps, permission sheets, and one-click installation arrive at gate M4.</p>
        <p class="note">Today, the three cards above run on the device; only richer host apps such as the animated radar need another computer.</p>
      </Card>
    </div>
  );
}
