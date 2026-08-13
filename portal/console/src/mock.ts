// SPDX-License-Identifier: GPL-3.0-or-later
import type {
  AppsSettings,
  CustomLayout,
  DeviceInfo,
  DeviceSettings,
  FleetDevice,
  FlightsSettings,
  Health,
  MessagesSettings,
  MqttSettings,
} from "./types";

export const MOCK_TOKEN = "dmx_lan_demo_4e710952";
export const MOCK_ADDRESS = "http://dmx-0952.local";

export const MOCK_FLEET: FleetDevice[] = [
  {
    name: "Study",
    serial: "DMX-4E71-0952",
    address: "dmx-0952.local · 10.0.4.22",
    firmware: "0.8.0",
    location: "home",
    online: true,
    mock: true,
  },
  {
    name: "Workshop",
    serial: "DMX-4E71-1108",
    address: "dmx-1108.local · 10.0.4.23",
    firmware: "0.8.0",
    location: "home",
    online: true,
    mock: true,
  },
  {
    name: "Guest Loft",
    serial: "DMX-3C22-0417",
    address: "dmx-0417.local · offline",
    firmware: "0.8.0",
    location: "chalet",
    online: false,
    mock: true,
  },
];

export interface MockState {
  health: Health;
  info: DeviceInfo;
  settings: DeviceSettings;
  mqtt: MqttSettings;
  apps: AppsSettings;
  messages: MessagesSettings;
  custom: CustomLayout;
  flights: FlightsSettings;
  token: string;
  lastFrameBytes: number;
}
export function createMockState(): MockState {
  return {
    health: { ok: true, device: "DMX-4E71-0952", fw: "0.8.0", mode: "run" },
    info: {
      device: "DMX-4E71-0952",
      name: "Study",
      serial: "DMX-4E71-0952",
      fw: "0.8.0",
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
    mqtt: {
      enabled: true,
      host: "broker.home.arpa",
      port: 1883,
      username: "DMX-4E71-0952",
      tls: false,
      has_password: true,
      status: "connected",
    },
    apps: {
      apps: [
        { id: "messages", enabled: true, interval_s: 10, refresh_s: 30 },
        { id: "flights_list", enabled: false, interval_s: 10, refresh_s: 1 },
        { id: "custom", enabled: false, interval_s: 10, refresh_s: 60 },
      ],
    },
    messages: {
      phrases: ["MAKE SOMETHING", "SHIP SMALL\nLEARN FAST", "LOCAL FIRST"],
      rotation_s: 30,
    },
    custom: {
      v: 1,
      source: null,
      rows: [{ y: 11, color: [255, 178, 36], text: "CUSTOM READY" }],
    },
    flights: { url: "", interval_s: 1, rows: 2, format: "kts", view: "list" },
    token: MOCK_TOKEN,
    lastFrameBytes: 0,
  };
}
