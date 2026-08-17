// SPDX-License-Identifier: GPL-3.0-or-later
import { useEffect, useMemo, useState } from "preact/hooks";
import { Card, copyText, GateChip, LoadingCard, Status, ViewHeader } from "../components";
import { weatherLayout } from "../layouts";
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

// What the /info scene names mean to a human, on the Apps page.
const SCENE_LABELS: Record<string, string> = {
  clock: "Clock",
  messages: "Messages",
  flights_list: "Flights list",
  custom: "Custom layout",
  text: "A pushed text overlay",
  frame: "Pushed frames (host app)",
  identify: "Identify flash",
  pair: "Pairing code",
};
const ROTATION_ORDER: AppId[] = ["messages", "flights_list", "custom"];

export function AppsView({ transport }: { transport: ConsoleTransport }) {
  const [apps, setApps] = useState<AppsSettings | null>(null);
  const [flights, setFlights] = useState<FlightsSettings | null>(null);
  const [messages, setMessages] = useState<MessagesSettings | null>(null);
  const [customText, setCustomText] = useState("");
  const [customError, setCustomError] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [scene, setScene] = useState("");
  const [firstText, setFirstText] = useState("HELLO WORLD");
  const [firstBusy, setFirstBusy] = useState(false);
  const [station, setStation] = useState("KORD");
  const [weatherBusy, setWeatherBusy] = useState(false);

  // Live "on the panel now" — the answer to "did that button do anything?".
  useEffect(() => {
    let active = true;
    const tick = () =>
      transport.info().then((info) => {
        if (active) setScene(info.scene);
      }).catch(() => {});
    tick();
    const timer = window.setInterval(tick, 2500);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [transport]);

  // Success/info toasts clear themselves; errors stay until replaced.
  useEffect(() => {
    if (!status || status.kind === "error") return;
    const timer = window.setTimeout(() => setStatus(null), 5000);
    return () => window.clearTimeout(timer);
  }, [status]);

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
      setScene(id);
      setStatus({ kind: "ok", text: `${SCENE_LABELS[id]} is on the panel now — it holds for its scene interval, then the rotation continues.` });
    } catch (error) {
      setStatus({ kind: "error", text: error instanceof Error ? error.message : "Could not show app." });
    }
  }

  // One button, three API calls: save the phrase, enable the app, put it on
  // the panel. A first-time owner gets a visible win without learning the
  // save/enable/show model first.
  async function runFirstApp(): Promise<void> {
    const phrase = firstText.trim().slice(0, 64);
    if (!phrase || !messages) return;
    setFirstBusy(true);
    try {
      const nextPhrases = [phrase, ...messages.phrases.filter((item) => item !== phrase)].slice(0, 8);
      const saved = await transport.post<MessagesSettings>("/api/v1/apps/messages", { phrases: nextPhrases });
      setMessages(saved);
      const savedApps = await transport.post<AppsSettings>("/api/v1/apps", { id: "messages", enabled: true });
      setApps(savedApps);
      await transport.post("/api/v1/apps/messages/show");
      setScene("messages");
      setStatus({
        kind: "ok",
        text: "Look at the panel — your words appear within a few seconds. Messages is saved on the device and now part of the rotation.",
      });
    } catch (error) {
      setStatus({ kind: "error", text: error instanceof Error ? error.message : "Could not run your first app." });
    } finally {
      setFirstBusy(false);
    }
  }

  // One-click starter layout: live US weather from the National Weather
  // Service — the decided no-key, any-purpose provider (ADR-0015).
  async function addWeather(): Promise<void> {
    const id = station.trim().toUpperCase();
    if (!/^[A-Z0-9]{3,5}$/.test(id)) {
      setStatus({ kind: "error", text: "Station looks wrong — use a US airport code with a K in front, like KORD or KJFK." });
      return;
    }
    setWeatherBusy(true);
    try {
      const saved = await transport.post<CustomLayout>("/api/v1/apps/custom", weatherLayout(id));
      setCustomText(JSON.stringify(saved, null, 2));
      setCustomError(null);
      const savedApps = await transport.post<AppsSettings>("/api/v1/apps", { id: "custom", enabled: true });
      setApps(savedApps);
      await transport.post("/api/v1/apps/custom/show");
      setScene("custom");
      setStatus({
        kind: "ok",
        text: `Live ${id} weather is on the panel and refreshes every 10 minutes from the National Weather Service — free, no key, no account.`,
      });
    } catch (error) {
      setStatus({ kind: "error", text: error instanceof Error ? error.message : "Could not install the weather layout." });
    } finally {
      setWeatherBusy(false);
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

  // The box never scans a network (ADR-0032). Owners who don't know their
  // receiver's address hand this prompt to any AI assistant — or follow it
  // themselves. It deliberately forbids scanning tools there too.
  async function copyFinderPrompt(): Promise<void> {
    await copyText(
      "Help me find my ADS-B receiver's data URL on my home network. I run one of: " +
        "PiAware, dump1090-fa, readsb, tar1090, or Ultrafeeder. I need the URL of its " +
        "aircraft.json feed. Walk me through it: (1) Open my router's connected-devices " +
        "list and find a device named something like piaware, raspberrypi, adsb, or " +
        "ultrafeeder — note its IP address. (2) In my browser, try these URLs with that " +
        "IP until one shows JSON containing \"aircraft\": http://IP:8080/data/aircraft.json , " +
        "http://IP/skyaware/data/aircraft.json , http://IP/tar1090/data/aircraft.json , " +
        "http://IP:8080/tar1090/data/aircraft.json . (3) Tell me the working URL — I'll " +
        "paste it into my Devmatrix panel's Flights app. Do not use or suggest any " +
        "network-scanning tools; only my router's device list and my browser.",
    );
    setStatus({ kind: "ok", text: "Finder prompt copied — paste it into Claude, ChatGPT, or any assistant on your computer, then paste the URL it finds here." });
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

  // The rotation as the firmware plays it: clock is always slot zero, then
  // each enabled app in order. "Up next" falls out of the current scene.
  const rotation = [
    { key: "clock", label: "Clock", seconds: 10 },
    ...ROTATION_ORDER.filter((id) => app(id)?.enabled).map((id) => ({
      key: id as string,
      label: SCENE_LABELS[id],
      seconds: app(id)!.interval_s,
    })),
  ];
  const liveIndex = rotation.findIndex((slot) => slot.key === scene);
  const upNext = liveIndex >= 0 && rotation.length > 1 ? rotation[(liveIndex + 1) % rotation.length] : null;
  const sceneLabel = scene ? SCENE_LABELS[scene] ?? scene : "…";

  return (
    <div class="view">
      <ViewHeader eyebrow="ON-DEVICE + HOST APPS · TODAY" title="Apps">
        Messages, Flights list, and Custom layout run on the DK-01. The animated Flights radar remains a host app.
      </ViewHeader>

      <Card title="On the panel now" aside={<span class={`chip ${transport.isMock ? "demo" : "ok"}`}>{transport.isMock ? "SIMULATED" : "LIVE"}</span>}>
        <div class="now-playing">
          <span class="now-scene">{sceneLabel}</span>
          {upNext && <span class="now-next">up next: {upNext.label} · rotation below</span>}
          {liveIndex < 0 && scene && (
            <span class="now-next">
              {scene === "frame"
                ? "stays until the host app stops or BACK TO CLOCK on the Dashboard"
                : "temporary — the rotation resumes when it ends"}
            </span>
          )}
        </div>
        <div class="rotation-strip" aria-label="Scene rotation order">
          {rotation.map((slot) => (
            <span key={slot.key} class={`rotation-slot ${slot.key === scene ? "live" : ""}`}>
              {slot.label} · {slot.seconds}s
            </span>
          ))}
          {ROTATION_ORDER.filter((id) => app(id) && !app(id)!.enabled).map((id) => (
            <span key={id} class="rotation-slot off">{SCENE_LABELS[id]} · off</span>
          ))}
        </div>
        <p class="note">The panel cycles through these scenes in order. ENABLE IN ROTATION on any app card adds it; SHOW NOW jumps straight to it.</p>
      </Card>

      {!loaded || !messageApp || !flightsApp || !customApp ? <LoadingCard /> : (
        <>
          <Card title="Messages — your first app" aside={<><span class="chip ok">START HERE</span> <span class="chip ok">ON DEVICE · OFFLINE</span></>}>
            <p class="lead">Type something. Press the button. Look at the panel. That's the whole product loop — everything else on this page is a variation of it.</p>
            <label class="field">
              <span>YOUR WORDS · {firstText.length}/64</span>
              <div class="field-action">
                <input
                  maxLength={64}
                  value={firstText}
                  onInput={(event) => setFirstText(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !firstBusy) void runFirstApp();
                  }}
                />
                <button class="btn primary" type="button" disabled={firstBusy || !firstText.trim()} onClick={() => void runFirstApp()}>
                  {firstBusy ? "SENDING…" : "PUT IT ON THE PANEL"}
                </button>
              </div>
            </label>
            <p class="note">Your words join the phrase list below, the app turns on, and the panel shows it — watch "On the panel now" above flip to Messages.</p>

            <hr class="card-divider" />
            <div class="app-title-row">
              <div class="app-icon" aria-hidden="true">Aa</div>
              <div><strong>A hardware-random phrase board.</strong><p>Up to eight 64-character phrases live only in device NVS; line breaks are preserved. Fine-tune the pack and its pace:</p></div>
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
                <button class="btn" type="button" onClick={() => void copyFinderPrompt()}>COPY FINDER PROMPT</button>
              </div>
            </label>
            <p class="note">
              The panel never scans your network (ADR-0032) — it only ever talks to addresses you give
              it. Don't know your receiver's URL? COPY FINDER PROMPT puts a step-by-step request on
              your clipboard for Claude, ChatGPT, or any assistant — it finds the URL using your
              router's device list and browser, never a scanner. The URL stays in device NVS and is
              never sent to a Devmatrix service.
            </p>
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
            <label class="field">
              <span>START WITH A TEMPLATE · LIVE US WEATHER · NO KEY</span>
              <div class="field-action">
                <input
                  maxLength={5}
                  style="max-width:140px"
                  value={station}
                  onInput={(event) => setStation(event.currentTarget.value.toUpperCase())}
                />
                <button class="btn primary" type="button" disabled={weatherBusy} onClick={() => void addWeather()}>
                  {weatherBusy ? "INSTALLING…" : "ADD LIVE WEATHER"}
                </button>
              </div>
            </label>
            <p class="note">National Weather Service, free for any use. The station is your nearest US airport code with a K in front — KORD is Chicago O'Hare; KJFK, KLAX, KDFW all work. It fills the editor below so you can see exactly how it's built, then change anything.</p>
            <hr class="card-divider" />
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

      <Card title="1,000+ community apps · Pixlet bridge" aside={<span class="chip ok">HOST APP · TODAY</span>}>
        <div class="app-title-row">
          <div class="app-icon" aria-hidden="true">▦</div>
          <div>
            <strong>The whole Tidbyt community catalog, on your panel.</strong>
            <p>Transit, sports, stocks, games — community-built Pixlet apps render on a computer you own (a Pi, NAS, or Mac that stays on) and stream to the DK-01 over your LAN. Nothing routes through a Devmatrix server.</p>
          </div>
        </div>
        <div class="command-block">
          <div><span>ON THE COMPUTER THAT STAYS ON — ONE COMMAND</span><button class="btn small" type="button" onClick={() => void copyText(`git clone https://github.com/JFForsythe/devmatrix\nnode devmatrix/examples/setup-pixlet.mjs --device http://${transport.host}`)}>COPY SETUP COMMAND</button></div>
          <pre>{`git clone https://github.com/JFForsythe/devmatrix\nnode devmatrix/examples/setup-pixlet.mjs --device http://${transport.host}`}</pre>
        </div>
        <p class="note">
          That one command installs everything: the free Pixlet renderer (an integrity-pinned
          download), the 1,000+ community-apps catalog, a starter rotation, and a reachability check
          against this panel. Make it permanent afterwards with
          <code> node devmatrix/examples/install-pixlet-bridge.mjs</code> — it asks for your LAN
          token privately (Dev console → COPY WITH MY TOKEN). Manual steps and details:
          <code> examples/pixlet-bridge/README.md</code>.
        </p>
      </Card>

      <Card title="Community Registry" aside={<GateChip gate="M4" />}>
        <p class="lead">Reviewed declarative apps, permission sheets, and one-click installation arrive at gate M4.</p>
        <p class="note">Today, the three cards above run on the device; only richer host apps such as the animated radar and the Pixlet bridge need another computer.</p>
      </Card>

      {status && (
        <div class="toast" role={status.kind === "error" ? "alert" : "status"}>
          <Status message={status} />
        </div>
      )}
    </div>
  );
}
