// SPDX-License-Identifier: GPL-3.0-or-later
import { useEffect, useState } from "preact/hooks";
import { Card, LoadingCard, Status, ViewHeader } from "../components";
import type { ConsoleTransport } from "../transport";
import type { DeviceInfo, DeviceSettings, MqttSettings, StatusMessage } from "../types";

const TIMEZONES = [
  ["US Central", "CST6CDT,M3.2.0,M11.1.0"],
  ["US Eastern", "EST5EDT,M3.2.0,M11.1.0"],
  ["US Mountain", "MST7MDT,M3.2.0,M11.1.0"],
  ["Arizona", "MST7"],
  ["US Pacific", "PST8PDT,M3.2.0,M11.1.0"],
  ["UTC", "UTC0"],
] as const;

export function SettingsView({ transport }: { transport: ConsoleTransport }) {
  const [info, setInfo] = useState<DeviceInfo | null>(null);
  const [settings, setSettings] = useState<DeviceSettings | null>(null);
  const [mqtt, setMqtt] = useState<MqttSettings | null>(null);
  const [mqttPassword, setMqttPassword] = useState("");
  const [status, setStatus] = useState<StatusMessage | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([transport.info(), transport.settings(), transport.mqtt()])
      .then(([nextInfo, nextSettings, nextMqtt]) => {
        if (!active) return;
        setInfo(nextInfo);
        setSettings(nextSettings);
        setMqtt(nextMqtt);
      })
      .catch((error: unknown) => {
        if (active) setStatus({ kind: "error", text: error instanceof Error ? error.message : "Could not load settings." });
      });
    const timer = window.setInterval(() => {
      transport.mqtt().then((nextMqtt) => {
        if (!active) return;
        setMqtt((current) => current
          ? { ...current, status: nextMqtt.status, has_password: nextMqtt.has_password }
          : nextMqtt);
      }).catch(() => {
        if (active) setMqtt((current) => current ? { ...current, status: "error" } : current);
      });
    }, 3_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [transport]);

  async function saveTimezone(): Promise<void> {
    if (!settings?.tz.trim()) {
      setStatus({ kind: "error", text: "Enter a POSIX timezone string." });
      return;
    }
    try {
      await transport.post("/api/v1/settings", { tz: settings.tz.trim() });
      setStatus({ kind: "ok", text: "Timezone saved to the device." });
    } catch (error) {
      setStatus({ kind: "error", text: error instanceof Error ? error.message : "Could not save the timezone." });
    }
  }

  async function saveMqtt(): Promise<void> {
    if (!mqtt) return;
    if (!Number.isInteger(mqtt.port) || mqtt.port < 1 || mqtt.port > 65_535) {
      setStatus({ kind: "error", text: "MQTT port must be between 1 and 65535." });
      return;
    }
    const body: Record<string, unknown> = {
      enabled: mqtt.enabled,
      host: mqtt.host.trim(),
      port: mqtt.port,
      username: mqtt.username.trim(),
      tls: mqtt.tls,
    };
    if (mqttPassword) body.password = mqttPassword;
    try {
      const saved = await transport.post<MqttSettings>("/api/v1/mqtt", body);
      setMqtt(saved);
      setMqttPassword("");
      setStatus({ kind: "ok", text: saved.status === "disabled" ? "MQTT settings saved; the client is off." : "MQTT settings saved; the client is connecting." });
    } catch (error) {
      setStatus({ kind: "error", text: error instanceof Error ? error.message : "Could not save MQTT settings." });
    }
  }

  const mqttChip = mqtt?.status === "connected" ? "ok" : mqtt?.status === "error" ? "crit" : mqtt?.status === "connecting" ? "warn" : "";

  return (
    <div class="view">
      <ViewHeader eyebrow="DEVICE PREFERENCES" title="Settings">
        Keep everyday configuration here. Token, Wi-Fi, and factory-reset controls live together under Security.
      </ViewHeader>

      {!info || !settings ? (
        <LoadingCard />
      ) : (
        <div class="grid two">
          <Card title="Clock timezone" aside={<span class="chip">POSIX TZ</span>}>
            <label class="field">
              <span>COMMON PRESET</span>
              <select
                value={TIMEZONES.some(([, value]) => value === settings.tz) ? settings.tz : "custom"}
                onChange={(event) => {
                  if (event.currentTarget.value !== "custom") setSettings({ ...settings, tz: event.currentTarget.value });
                }}
              >
                {TIMEZONES.map(([label, value]) => <option value={value}>{label}</option>)}
                <option value="custom">Custom POSIX string</option>
              </select>
            </label>
            <label class="field">
              <span>POSIX STRING</span>
              <input value={settings.tz} onInput={(event) => setSettings({ ...settings, tz: event.currentTarget.value })} spellcheck={false} />
            </label>
            <button class="btn primary" type="button" onClick={() => void saveTimezone()}>SAVE TIMEZONE</button>
          </Card>

          <Card title="Device address" aside={<span class={`chip ${transport.isMock ? "demo" : "ok"}`}>{transport.isMock ? "MOCK" : "LIVE"}</span>}>
            <dl class="device-details large">
              <div><dt>HOSTNAME</dt><dd>{info.mdns}</dd></div>
              <div><dt>IP ADDRESS</dt><dd>{info.ip}</dd></div>
              <div><dt>CONSOLE TARGET</dt><dd>{transport.address}</dd></div>
            </dl>
            <p class="note">A hosted Console remembers an address supplied with <code>?device=&lt;host&gt;</code> in this browser.</p>
          </Card>
        </div>
      )}

      {mqtt && (
        <Card
          title="MQTT broker"
          aside={(
            <>
              <span class={`chip ${mqttChip}`} aria-live="polite">{mqtt.status.toUpperCase()}</span>
              {transport.isMock && <span class="chip demo">SIMULATED</span>}
            </>
          )}
        >
          <p class="lead">Optional connection to a broker you own. An empty host keeps MQTT completely off.</p>
          <div class="form-grid four">
            <label class="field">
              <span>BROKER HOST</span>
              <input value={mqtt.host} onInput={(event) => setMqtt({ ...mqtt, host: event.currentTarget.value })} placeholder="broker.home.arpa" spellcheck={false} />
            </label>
            <label class="field">
              <span>PORT</span>
              <input type="number" min="1" max="65535" value={mqtt.port} onInput={(event) => setMqtt({ ...mqtt, port: Number(event.currentTarget.value) })} />
            </label>
            <label class="field">
              <span>USERNAME</span>
              <input value={mqtt.username} onInput={(event) => setMqtt({ ...mqtt, username: event.currentTarget.value })} autocomplete="username" spellcheck={false} />
            </label>
            <label class="field">
              <span>PASSWORD · WRITE ONLY</span>
              <input type="password" value={mqttPassword} onInput={(event) => setMqttPassword(event.currentTarget.value)} autocomplete="new-password" placeholder={mqtt.has_password ? "Saved — enter to replace" : "Not set"} />
            </label>
          </div>
          <div class="button-row wrap">
            <label class="check-chip">
              <input type="checkbox" checked={mqtt.enabled} onChange={(event) => setMqtt({ ...mqtt, enabled: event.currentTarget.checked })} /> ENABLE MQTT
            </label>
            <label class="check-chip">
              <input type="checkbox" checked={mqtt.tls} onChange={(event) => setMqtt({ ...mqtt, tls: event.currentTarget.checked })} /> TLS TRANSPORT
            </label>
            <button class="btn primary" type="button" onClick={() => void saveMqtt()}>SAVE MQTT</button>
          </div>
          <p class="note">The password never comes back from the device. TLS is encrypted but not yet CA-verified in this pre-P2 firmware.</p>
        </Card>
      )}

      <Status message={status} />

      <Card title="Destructive actions" aside={<span class="chip warn">SECURITY</span>}>
        <p class="lead">Rotate the LAN token, change Wi-Fi, or factory-reset the device from the Security view.</p>
        <a class="btn" href="#/security">OPEN SECURITY →</a>
      </Card>
    </div>
  );
}
