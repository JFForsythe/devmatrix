// SPDX-License-Identifier: GPL-3.0-or-later
import type { DeviceInfo, DeviceSettings, FleetDevice, FlightsSettings, Health } from "./types";

export const MOCK_TOKEN = "dmx_lan_demo_4e710952";
export const MOCK_ADDRESS = "http://dmx-0952.local";

export const MOCK_FLEET: FleetDevice[] = [
  {
    name: "Study",
    serial: "DMX-4E71-0952",
    address: "dmx-0952.local · 10.0.4.22",
    firmware: "0.4.2",
    location: "home",
    online: true,
    mock: true,
  },
  {
    name: "Workshop",
    serial: "DMX-4E71-1108",
    address: "workshop.local · 10.0.4.23",
    firmware: "0.4.2",
    location: "home",
    online: true,
    mock: true,
  },
  {
    name: "Guest Loft",
    serial: "DMX-3C22-0417",
    address: "guest-loft.local · offline",
    firmware: "0.4.1",
    location: "chalet",
    online: false,
    mock: true,
  },
];

export interface MockState {
  health: Health;
  info: DeviceInfo;
  settings: DeviceSettings;
  flights: FlightsSettings;
  token: string;
  lastFrameBytes: number;
}
export function createMockState(): MockState {
  return {
    health: { ok: true, device: "DMX-4E71-0952", fw: "0.4.2", mode: "run" },
    info: {
      device: "DMX-4E71-0952",
      name: "Study",
      serial: "DMX-4E71-0952",
      fw: "0.4.2",
      uptime_s: 1_052_820,
      heap_free: 151_552,
      rssi_dbm: -52,
      ip: "10.0.4.22",
      mdns: "dmx-0952.local",
      brightness: 110,
      refresh_hz: 241,
      slot: "ota_0",
      scene: "clock",
      reset_reason: "poweron",
    },
    settings: { tz: "CST6CDT,M3.2.0,M11.1.0", brightness: 110 },
    flights: { url: "", interval_s: 1, rows: 2, format: "kts", view: "list" },
    token: MOCK_TOKEN,
    lastFrameBytes: 0,
  };
}
