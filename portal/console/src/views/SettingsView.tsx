// SPDX-License-Identifier: GPL-3.0-or-later
import { useEffect, useState } from "preact/hooks";
import { Card, LoadingCard, Status, ViewHeader } from "../components";
import type { ConsoleTransport } from "../transport";
import type { DeviceInfo, DeviceSettings, StatusMessage } from "../types";

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
  const [status, setStatus] = useState<StatusMessage | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([transport.info(), transport.settings()])
      .then(([nextInfo, nextSettings]) => {
        if (!active) return;
        setInfo(nextInfo);
        setSettings(nextSettings);
      })
      .catch((error: unknown) => {
        if (active) setStatus({ kind: "error", text: error instanceof Error ? error.message : "Could not load settings." });
      });
    return () => {
      active = false;
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

      <Status message={status} />

      <Card title="Destructive actions" aside={<span class="chip warn">SECURITY</span>}>
        <p class="lead">Rotate the LAN token, change Wi-Fi, or factory-reset the device from the Security view.</p>
        <a class="btn" href="#/security">OPEN SECURITY →</a>
      </Card>
    </div>
  );
}
