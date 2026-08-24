#!/usr/bin/env node
// Flights Overhead — companion-script edition. Two views, one script:
//
//   list   AAL2883 - 295kts        radar   every pixel is an aircraft,
//          SKW5402 - 100kts                altitude-colored, faint white
//                                          comet trails, paired runway
//                                          lines that landing planes
//                                          thread; runways strobe green
//                                          on touchdown
//
// Radar animates at FPS (default 8) by dead-reckoning each aircraft along
// its reported ground speed and track between 1 Hz data updates, with
// sub-pixel rendering — dots glide instead of jumping.
//
// Toggle the view (and everything else) from the Console's Flights page —
// this script re-reads the device's config every few cycles and follows.
// Data comes from YOUR ADS-B receiver (dump1090-fa / readsb / PiAware —
// the open receiver ecosystem, ADR-0023) via its public aircraft.json
// format. Privacy: receiver URL lives only in device NVS (typed into
// the Console — its COPY FINDER PROMPT helps locate the URL; the box
// never scans, ADR-0032); no URL, token, or location is in this file.
// Airport geometry below is public FAA data.
//
// Run:
//   DMX_URL=http://dmx-xxxx.local DMX_TOKEN=<your LAN token> [AIRPORT=ord] \
//     node examples/flights-overhead.mjs
//
// Env overrides: RECEIVER_URL, INTERVAL_S, ROWS, FORMAT=kts|alt,
//                VIEW=list|radar, VIEW_MI=16, FPS=8
// Flags: --once

const DMX_URL = process.env.DMX_URL;
const DMX_TOKEN = process.env.DMX_TOKEN;
const VIEW_MI = Number(process.env.VIEW_MI ?? 16);
const FPS = Math.min(15, Math.max(2, Number(process.env.FPS ?? 8)));
const ONCE = process.argv.includes("--once");

if (!DMX_URL || !DMX_TOKEN) {
  console.error(
    "usage: DMX_URL=http://dmx-xxxx.local DMX_TOKEN=<LAN token> " +
      "[AIRPORT=ord] node examples/flights-overhead.mjs\n" +
      "(pair a browser first — the Console's Flights page has this command)",
  );
  process.exit(2);
}

// Public airport geometry (FAA). Runways as [lat, lonWest, lonEast]
// horizontal segments — O'Hare's parallels run true east-west. Add yours.
const AIRPORTS = {
  ord: {
    name: "Chicago O'Hare",
    lat: 41.9786,
    lon: -87.9048,
    runways: [
      [42.006, -87.93, -87.885], // north parallel complex
      [41.962, -87.925, -87.88], // south parallel complex
    ],
  },
};
const airport = AIRPORTS[(process.env.AIRPORT ?? "").toLowerCase()] ?? null;

const authHeaders = {
  Authorization: `Bearer ${DMX_TOKEN}`,
  "Content-Type": "application/json",
};
const get = (url, headers) =>
  fetch(url, { headers, signal: AbortSignal.timeout(4000) }).then((r) => {
    if (!r.ok) throw new Error(`${url} -> HTTP ${r.status}`);
    return r.json();
  });
const post = (path, body) =>
  fetch(`${DMX_URL}${path}`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(4000),
  });

// ---------- config: the device is the source of truth ----------
let cfg = { url: "", interval_s: 1, rows: 2, format: "kts", view: "list" };
async function syncConfig() {
  try {
    const d = await get(`${DMX_URL}/api/v1/apps/flights`, authHeaders);
    cfg = {
      url: process.env.RECEIVER_URL ?? d.url,
      interval_s: Number(process.env.INTERVAL_S ?? d.interval_s ?? 1),
      rows: Number(process.env.ROWS ?? d.rows ?? 2),
      format: process.env.FORMAT ?? d.format ?? "kts",
      view: process.env.VIEW ?? d.view ?? "list",
    };
  } catch (e) {
    console.log("config sync failed (keeping last):", e.message);
  }
  if (!cfg.url) {
    console.error(
      "No receiver configured. Console -> Apps -> Flights list -> enter your receiver's aircraft.json URL (COPY FINDER PROMPT helps find it), then rerun.",
    );
    process.exit(2);
  }
}

// ---------- geometry ----------
let home = null; // receiver location: distance ranking + radar fallback center
async function findHome() {
  try {
    const rx = await get(cfg.url.replace("aircraft.json", "receiver.json"));
    if (typeof rx.lat === "number") home = { lat: rx.lat, lon: rx.lon };
  } catch {
    /* fine */
  }
}
const R_MI = 3958.8;
function miles(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_MI * Math.asin(Math.sqrt(h));
}

// ---------- list view ----------
function nearest(aircraft, n) {
  const usable = aircraft.filter(
    (a) =>
      a.flight?.trim() &&
      typeof a.alt_baro === "number" &&
      typeof a.lat === "number" &&
      typeof a.lon === "number" &&
      (a.seen ?? 99) < 30,
  );
  for (const a of usable) a._mi = home ? miles(home, a) : null;
  usable.sort((x, y) => (home ? x._mi - y._mi : x.alt_baro - y.alt_baro));
  return usable.slice(0, n);
}
function listLine(a) {
  const cs = a.flight.trim();
  if (cfg.format === "alt") {
    const alt =
      a.alt_baro >= 10000
        ? Math.round(a.alt_baro / 1000) + "k"
        : a.alt_baro + "ft";
    return `${cs} - ${alt}`;
  }
  const kts = typeof a.gs === "number" ? Math.round(a.gs) : "?";
  return `${cs} - ${kts}kts`;
}
async function renderList(data) {
  const top = nearest(data.aircraft ?? [], cfg.rows);
  if (!top.length) return "quiet skies — panel keeps its clock";
  const text = top.map(listLine).join("\n");
  const r = await post("/api/v1/display/text", {
    text,
    duration_s: Math.max(3, cfg.interval_s + 2),
  });
  return r.ok
    ? `list <- "${text.replaceAll("\n", " | ")}"`
    : `list push failed: HTTP ${r.status}`;
}

// ---------- radar view ----------
const W = 64, H = 32;
const rgb565 = (r, g, b) => ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3);
const C_RUNWAY = rgb565(90, 90, 100);
const C_RUNWAY_HIT = rgb565(0, 255, 80);
function altRGB(alt) {
  if (alt === "ground") return [210, 210, 210];
  if (alt < 1000) return [255, 55, 35];
  if (alt < 4000) return [255, 175, 0];
  if (alt < 10000) return [50, 220, 70];
  return [45, 170, 255];
}
// Long comet tail in low white light — faint and fading.
const TRAIL_FADE = [0.32, 0.26, 0.21, 0.17, 0.13, 0.1, 0.08, 0.06, 0.05, 0.04];

const isDown = (alt) =>
  alt === "ground" || (typeof alt === "number" && alt <= 100);

// Was this track's last known position over a runway footprint?
function overRunway(center, t) {
  if (!airport) return false;
  const MI_PER_PX = VIEW_MI / W;
  const MI_LON = 69.17 * Math.cos((center.lat * Math.PI) / 180);
  const px = W / 2 + ((t.lon - center.lon) * MI_LON) / MI_PER_PX;
  const py = H / 2 - ((t.lat - center.lat) * 69.05) / MI_PER_PX;
  return airport.runways.some(([lat, w, e]) => {
    const y = H / 2 - ((lat - center.lat) * 69.05) / MI_PER_PX;
    const x0 = W / 2 + ((w - center.lon) * MI_LON) / MI_PER_PX;
    const x1 = W / 2 + ((e - center.lon) * MI_LON) / MI_PER_PX;
    return Math.abs(py - y) <= 2.5 && px >= x0 - 8 && px <= x1 + 8;
  });
}

// Track store: dead-reckoned between data updates so motion is smooth.
const tracks = new Map(); // hex -> {lat,lon,gs,track,alt,posT,flight,trail:[]}
let runwayFlash = 0; // frames of green strobe remaining
const recentTouch = new Set();

function updateTracks(data) {
  const now = Date.now();
  const seen = new Set();
  let events = "";
  for (const a of data.aircraft ?? []) {
    if (typeof a.lat !== "number" || (a.seen ?? 99) > 15) continue;
    seen.add(a.hex);
    const t = tracks.get(a.hex) ?? { trail: [] };
    if (t.alt !== undefined && !isDown(t.alt) && isDown(a.alt_baro)) {
      runwayFlash = Math.round(FPS * 2); // strobe the strips
      recentTouch.add(a.hex);
      events += ` TOUCHDOWN ${(a.flight ?? a.hex).trim()}`;
    }
    t.lat = a.lat;
    t.lon = a.lon;
    t.gs = typeof a.gs === "number" ? a.gs : 0;
    t.track = typeof a.track === "number" ? a.track : null;
    t.alt = a.alt_baro;
    t.flight = a.flight;
    t.posT = now - ((a.seen_pos ?? a.seen ?? 0) * 1000);
    tracks.set(a.hex, t);
  }
  for (const [hex, t] of [...tracks]) {
    if (seen.has(hex)) continue;
    // Landing aircraft often sink below antenna coverage right at the
    // surface — losing a low track over a runway IS a touchdown.
    const c = airport ?? home;
    if (c && typeof t.alt === "number" && t.alt < 1500 && overRunway(c, t)) {
      runwayFlash = Math.round(FPS * 2);
      events += ` LANDED ${(t.flight ?? hex).trim()} (lost at surface)`;
    }
    tracks.delete(hex);
    recentTouch.delete(hex);
  }
  return events;
}

let framePushes = 0, framePushFails = 0;
async function renderRadarFrame() {
  const center = airport ?? home;
  if (!center) return;
  const MI_PER_PX = VIEW_MI / W;
  const MI_LON = 69.17 * Math.cos((center.lat * Math.PI) / 180);
  const now = Date.now();

  const frame = new Uint16Array(W * H);

  // Runways as paired edge lines with a dark centerline row; the whole
  // strip strobes green at ~4 Hz for ~2 s after a touchdown.
  const strip = runwayFlash > 0 && Math.floor(now / 125) % 2 === 0
    ? C_RUNWAY_HIT
    : C_RUNWAY;
  if (runwayFlash > 0) runwayFlash--;
  // Slow breathing pulse (~0.5 Hz) on aircraft heads — the live dot is
  // the one that breathes; the tail never does.
  const pulse = 0.6 + 0.4 * Math.sin(((now % 2000) / 2000) * 2 * Math.PI);
  const rwRows = [];
  for (const [lat, w, e] of airport?.runways ?? []) {
    const y = Math.round(H / 2 - ((lat - center.lat) * 69.05) / MI_PER_PX);
    const x0 = Math.max(0, Math.round(W / 2 + ((w - center.lon) * MI_LON) / MI_PER_PX));
    const x1 = Math.min(W - 1, Math.round(W / 2 + ((e - center.lon) * MI_LON) / MI_PER_PX));
    if (y < 1 || y > H - 2 || x1 < 0 || x0 > W - 1) continue;
    rwRows.push({ y, x0, x1 });
    for (let x = x0; x <= x1; x++) {
      frame[(y - 1) * W + x] = strip;
      frame[(y + 1) * W + x] = strip;
    }
  }

  for (const [hex, t] of tracks) {
    // Dead-reckon along ground speed + track (capped so stale data
    // doesn't fly ghosts across the screen).
    let { lat, lon } = t;
    const dtH = Math.min(15000, now - t.posT) / 3600000;
    if (t.track !== null && t.gs > 1) {
      const distMi = t.gs * 1.15078 * dtH;
      const rad = (t.track * Math.PI) / 180;
      lat += (distMi * Math.cos(rad)) / 69.05;
      lon += (distMi * Math.sin(rad)) / (69.17 * Math.cos((lat * Math.PI) / 180));
    }
    let px = W / 2 + ((lon - center.lon) * MI_LON) / MI_PER_PX;
    let py = H / 2 - ((lat - center.lat) * 69.05) / MI_PER_PX;
    if (px < -1 || px > W || py < -1 || py > H) continue;

    // Low aircraft near a runway snap to its centerline row so they
    // thread the gap (runway lats are approximate).
    if (isDown(t.alt) || (typeof t.alt === "number" && t.alt < 2000))
      for (const rw of rwRows)
        if (Math.abs(py - rw.y) <= 1.4 && px >= rw.x0 - 6 && px <= rw.x1 + 6) {
          py = rw.y;
          break;
        }

    const cx = Math.max(0, Math.min(W - 1, Math.round(px)));
    const cy = Math.max(0, Math.min(H - 1, Math.round(py)));
    const head = t.trail[0];
    if (!head || head.x !== cx || head.y !== cy)
      t.trail = [{ x: cx, y: cy }, ...t.trail].slice(0, TRAIL_FADE.length + 2);

    // Tail: neutral low-white gray, strictly single-file. Cells that
    // would sit BESIDE the head (turn residue) are suppressed — only the
    // directly-behind neighbor may touch it.
    t.trail.slice(1, 1 + TRAIL_FADE.length).forEach((p, i) => {
      if (p.x < 0 || p.x >= W || p.y < 0 || p.y >= H) return;
      const adj = Math.max(Math.abs(p.x - cx), Math.abs(p.y - cy)) <= 1;
      const straightBehind = i === 0 && (p.x === cx || p.y === cy);
      if (adj && !straightBehind) return;
      const idx = p.y * W + p.x;
      if (frame[idx] === 0) {
        // Build the gray directly in RGB565 (g = 2*r) so every fade step
        // is a true neutral — no green tint at the faint end.
        const v5 = Math.max(1, Math.round(31 * TRAIL_FADE[i]));
        frame[idx] = (v5 << 11) | ((v5 * 2) << 5) | v5;
      }
    });

    // Head: ONE pixel, breathing.
    const [r, g, b] = recentTouch.has(hex) && runwayFlash > 0
      ? [0, 255, 80]
      : altRGB(t.alt);
    frame[cy * W + cx] = rgb565(r * pulse, g * pulse, b * pulse);
  }
  if (runwayFlash === 0) recentTouch.clear();

  const bytes = Buffer.alloc(W * H * 2);
  frame.forEach((v, i) => bytes.writeUInt16LE(v, i * 2));
  try {
    const r = await post("/api/v1/display/frame", {
      b64: bytes.toString("base64"),
      // Loop mode holds a 10 s lease (renewed every 125–500 ms push) so a
      // dead host frees the panel; --once keeps the frame persistent, as it
      // always did, because nothing renews after a single push.
      lease_ms: ONCE ? 0 : 10_000,
    });
    framePushes++;
    if (!r.ok) framePushFails++;
  } catch {
    framePushFails++;
  }
}

// ---------- main loop: data at interval_s, radar frames at FPS ----------
let activeView = null;
let dataPolls = 0;
let inFlight = false;

async function dataTick() {
  try {
    if (dataPolls++ % 5 === 0) await syncConfig();
    if (activeView && activeView !== cfg.view)
      await post("/api/v1/display/clear", {}); // clean handoff between views
    activeView = cfg.view;
    const data = await get(cfg.url);
    if (cfg.view === "radar") {
      const events = updateTracks(data);
      console.log(
        new Date().toISOString(),
        `radar: ${tracks.size} aircraft${airport ? " over " + airport.name : ""}` +
          ` (${framePushes} frames, ${framePushFails} failed)${events}`,
      );
      framePushes = framePushFails = 0;
    } else {
      console.log(new Date().toISOString(), await renderList(data));
    }
  } catch (e) {
    console.log(new Date().toISOString(), "data tick skipped:", e.message);
  }
}

await syncConfig();
await findHome();
await dataTick();
if (cfg.view === "radar") await renderRadarFrame();
if (!ONCE) {
  setInterval(() => dataTick(), Math.max(1, cfg.interval_s) * 1000);
  const frameLoop = async () => {
    const t0 = Date.now();
    if (cfg.view === "radar" && !inFlight) {
      inFlight = true;
      await renderRadarFrame();
      inFlight = false;
    }
    setTimeout(frameLoop, Math.max(15, 1000 / FPS - (Date.now() - t0)));
  };
  setTimeout(frameLoop, 1000 / FPS);
}
