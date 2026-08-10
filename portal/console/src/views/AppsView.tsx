// SPDX-License-Identifier: GPL-3.0-or-later
import { useEffect, useMemo, useState } from "preact/hooks";
import { Card, copyText, GateChip, LoadingCard, Status, ViewHeader } from "../components";
import type { ConsoleTransport } from "../transport";
import type { FlightsSettings, StatusMessage } from "../types";

export function AppsView({ transport }: { transport: ConsoleTransport }) {
  const [settings, setSettings] = useState<FlightsSettings | null>(null);
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    let active = true;
    transport
      .flights()
      .then((value) => {
        if (active) setSettings(value);
      })
      .catch((error: unknown) => {
        if (active) setStatus({ kind: "error", text: error instanceof Error ? error.message : "Could not load Flights settings." });
      });
    return () => {
      active = false;
    };
  }, [transport]);

  const command = useMemo(
    () =>
      `DMX_URL=${transport.address} DMX_TOKEN=${transport.getToken() || "<pair-this-browser>"} node examples/flights-overhead.mjs`,
    [transport, settings],
  );

  async function save(): Promise<void> {
    if (!settings) return;
    try {
      const saved = await transport.post<FlightsSettings>("/api/v1/apps/flights", settings);
      setSettings(saved);
      setStatus({ kind: "ok", text: "Flights settings saved in device NVS." });
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
        setSettings((current) => (current ? { ...current, url: result.found! } : current));
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

  return (
    <div class="view">
      <ViewHeader eyebrow="HOST APP · TODAY" title="Apps">
        Flights Overhead follows configuration stored on the device; the companion process runs on your Pi, NAS, or Mac.
      </ViewHeader>

      {!settings ? (
        <LoadingCard />
      ) : (
        <Card title="Flights Overhead" aside={<span class="chip ok">AVAILABLE TODAY</span>}>
          <div class="app-title-row">
            <div class="app-icon" aria-hidden="true">✈</div>
            <div><strong>Your antenna, your panel.</strong><p>Point the app at a local dump1090/readsb aircraft.json feed.</p></div>
          </div>

          <label class="field">
            <span>RECEIVER URL</span>
            <div class="field-action">
              <input
                type="url"
                value={settings.url}
                placeholder="http://receiver/data/aircraft.json"
                onInput={(event) => setSettings({ ...settings, url: event.currentTarget.value })}
              />
              <button class="btn" type="button" disabled={scanning} onClick={() => void scan()}>
                {scanning ? "SCANNING…" : "SCAN MY NETWORK"}
              </button>
            </div>
          </label>
          <p class="note">The receiver URL stays in device NVS. It is never sent to a Devmatrix service.</p>

          <div class="form-grid four">
            <label class="field">
              <span>INTERVAL · 1–60 S</span>
              <input
                type="number"
                min={1}
                max={60}
                value={settings.interval_s}
                onInput={(event) =>
                  setSettings({ ...settings, interval_s: Math.min(60, Math.max(1, Number(event.currentTarget.value))) })
                }
              />
            </label>
            <label class="field">
              <span>ROWS · 1–5</span>
              <select
                value={settings.rows}
                onChange={(event) => setSettings({ ...settings, rows: Number(event.currentTarget.value) })}
              >
                {[1, 2, 3, 4, 5].map((rows) => <option value={rows}>{rows}</option>)}
              </select>
            </label>
            <label class="field">
              <span>VALUE</span>
              <select value={settings.format} onChange={(event) => setSettings({ ...settings, format: event.currentTarget.value as "kts" | "alt" })}>
                <option value="kts">Speed · kts</option>
                <option value="alt">Altitude · ft</option>
              </select>
            </label>
            <label class="field">
              <span>VIEW</span>
              <select value={settings.view} onChange={(event) => setSettings({ ...settings, view: event.currentTarget.value as "list" | "radar" })}>
                <option value="list">List</option>
                <option value="radar">Radar</option>
              </select>
            </label>
          </div>
          <div class="button-row"><button class="btn primary" type="button" onClick={() => void save()}>SAVE TO DEVICE</button></div>
          <Status message={status} />

          <div class="command-block">
            <div><span>READY-TO-RUN HOST COMMAND</span><button class="btn small" type="button" onClick={() => void copyText(command)}>COPY WITH MY TOKEN</button></div>
            <pre>{command}</pre>
          </div>
        </Card>
      )}

      <Card title="Community Registry" aside={<GateChip gate="M4" />}>
        <p class="lead">Reviewed declarative apps, permission sheets, and one-click installation arrive at gate M4.</p>
        <p class="note">Today, every rich app is a host app and needs a computer that stays on.</p>
      </Card>
    </div>
  );
}
