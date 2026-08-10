// SPDX-License-Identifier: GPL-3.0-or-later
import { useEffect, useState } from "preact/hooks";
import { Card, LoadingCard, ViewHeader } from "../components";
import type { ConsoleTransport } from "../transport";
import type { FleetDevice } from "../types";

export function DevicesView({ transport }: { transport: ConsoleTransport }) {
  const [devices, setDevices] = useState<FleetDevice[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    transport
      .info()
      .then((info) => {
        if (active) setDevices(transport.fleet(info));
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Could not read this device.");
      });
    return () => {
      active = false;
    };
  }, [transport]);

  return (
    <div class="view">
      <ViewHeader eyebrow={transport.isMock ? "DEMO FLEET · MOCK DATA" : "THIS LAN DEVICE"} title="Devices">
        {transport.isMock
          ? "The hosted demo mirrors Maya’s three-device story. These cards never scan your LAN."
          : "The device-local Console shows the box that served this page; pairing another browser never changes the device."}
      </ViewHeader>

      {error && <p class="alert error">{error}</p>}
      {!devices ? (
        <LoadingCard />
      ) : (
        <div class="device-grid">
          {devices.map((device) => (
            <article class="device-card" key={device.serial}>
              <div class="device-preview" aria-hidden="true">
                <span>DEVMATRIX</span>
                <b>{device.name.toUpperCase()}</b>
              </div>
              <div class="card-head">
                <h2><i class={`led ${device.online ? "" : "off"}`} /> {device.name}</h2>
                <div class="card-aside">
                  {device.location && <span class="chip">{device.location}</span>}
                  <span class={`chip ${device.online ? "ok" : "warn"}`}>{device.online ? "ONLINE" : "OFFLINE"}</span>
                </div>
              </div>
              <dl class="device-details">
                <div><dt>SERIAL</dt><dd>{device.serial}</dd></div>
                <div><dt>ADDRESS</dt><dd>{device.address}</dd></div>
                <div><dt>FIRMWARE</dt><dd>v{device.firmware}</dd></div>
              </dl>
              {device.mock && <span class="chip demo">MOCK DEVICE</span>}
            </article>
          ))}
        </div>
      )}

      <Card title="Pair another browser" aside={<span class="chip">LAN · NO ACCOUNT</span>}>
        <ol class="steps">
          <li><b>Open this Console</b> on the other browser and select Pair when it asks for a token.</li>
          <li><b>Read the 6-digit code</b> that appears on the physical panel.</li>
          <li><b>Type the code</b> in that browser. Its LAN token is stored locally and the interrupted request retries.</li>
        </ol>
        <p class="note">Pairing a browser does not reset Wi-Fi or log out existing clients. Token rotation does both at once.</p>
      </Card>
    </div>
  );
}
