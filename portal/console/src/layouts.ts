// SPDX-License-Identifier: GPL-3.0-or-later
// Starter custom layouts. Weather uses the National Weather Service — the
// decided no-key, any-purpose provider (ADR-0015); stations are US METAR
// identifiers like KORD.
import type { CustomLayout } from "./types";

export function weatherLayout(station: string): CustomLayout {
  return {
    v: 1,
    source: {
      url: `https://api.weather.gov/stations/${station}/observations/latest`,
      interval_s: 600,
      stale_after_s: 7200,
    },
    rows: [
      { y: 5, color: [90, 170, 255], text: `WEATHER ${station}` },
      { y: 17, color: [235, 235, 235], bind: "/properties/temperature/value", prefix: "TEMP ", suffix: " C" },
      { y: 29, color: [120, 200, 120], bind: "/properties/windSpeed/value", prefix: "WIND ", suffix: " KMH" },
    ],
  };
}

export const STATION_PATTERN = /^[A-Z0-9]{3,5}$/;
