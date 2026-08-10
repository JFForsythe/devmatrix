// SPDX-License-Identifier: GPL-3.0-or-later

export type ConsoleMode = "live" | "mock";

export interface Health {
  ok: boolean;
  device: string;
  fw: string;
  mode: string;
}
export interface DeviceInfo {
  device: string;
  fw: string;
  uptime_s: number;
  heap_free: number;
  rssi_dbm: number;
  ip: string;
  mdns: string;
  brightness: number;
  refresh_hz: number;
  slot: string;
  scene: string;
  reset_reason: string;
  name?: string;
  serial?: string;
}

export interface FlightsSettings {
  url: string;
  interval_s: number;
  rows: number;
  format: "kts" | "alt";
  view: "list" | "radar";
}

export type AppId = "messages" | "flights_list" | "custom";

export interface AppSummary {
  id: AppId;
  enabled: boolean;
  interval_s: number;
  refresh_s: number;
}

export interface AppsSettings {
  apps: AppSummary[];
}

export interface MessagesSettings {
  phrases: string[];
  rotation_s: number;
}

export interface CustomLayout {
  v: number;
  source: { url: string; interval_s: number; stale_after_s: number } | null;
  rows: Array<{
    y: number;
    color: [number, number, number];
    text?: string;
    bind?: string;
    prefix?: string;
    suffix?: string;
    max?: number;
  }>;
}

export interface DeviceSettings {
  tz: string;
  brightness: number;
}

export interface FleetDevice {
  name: string;
  serial: string;
  address: string;
  firmware: string;
  location?: string;
  online: boolean;
  mock?: boolean;
}

export interface StatusMessage {
  kind: "ok" | "error" | "info";
  text: string;
}

export interface ActionResult {
  ok: boolean;
  rebooting?: boolean | string;
}
