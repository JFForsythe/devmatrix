// SPDX-License-Identifier: GPL-3.0-or-later
import { useEffect, useRef, useState } from "preact/hooks";
import { bytesToBase64, encodeRgb565Frame, FRAME_HEIGHT, FRAME_WIDTH } from "../frame";
import { Card, formatUptime, LoadingCard, Status, ViewHeader } from "../components";
import type { ConsoleTransport } from "../transport";
import type { DeviceInfo, Health, StatusMessage } from "../types";

const COLORS = ["#ffffff", "#d03b3b", "#fab219", "#0ca30c", "#14663e", "#2a78d6", "#8b5cf6", "#000000"];
const RESET_HINTS: Record<string, string> = {
  brownout: "Power could not keep up, usually because bright content exceeded the USB power budget. Keep brightness capped and check the supply.",
  crash: "The firmware hit a fatal error. If this repeats, capture the serial log and file an issue.",
  watchdog: "The firmware stalled long enough for its watchdog to restart the device.",
};

function PaintCanvas({ transport }: { transport: ConsoleTransport }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pixels = useRef(new Uint32Array(FRAME_WIDTH * FRAME_HEIGHT));
  const [color, setColor] = useState("#14663e");
  const [painting, setPainting] = useState(false);
  const [live, setLive] = useState(false);
  const [status, setStatus] = useState<StatusMessage | null>(null);

  function drawCell(index: number): void {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const x = index % FRAME_WIDTH;
    const y = Math.floor(index / FRAME_WIDTH);
    const cellWidth = canvas.width / FRAME_WIDTH;
    const cellHeight = canvas.height / FRAME_HEIGHT;
    context.fillStyle = `#${pixels.current[index].toString(16).padStart(6, "0")}`;
    context.fillRect(x * cellWidth, y * cellHeight, cellWidth, cellHeight);
    context.strokeStyle = "rgba(255,255,255,.05)";
    context.strokeRect(x * cellWidth + 0.5, y * cellHeight + 0.5, cellWidth - 1, cellHeight - 1);
  }

  function repaint(): void {
    for (let index = 0; index < pixels.current.length; index += 1) drawCell(index);
  }

  useEffect(repaint, []);

  function paint(event: PointerEvent): void {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const bounds = canvas.getBoundingClientRect();
    const x = Math.floor(((event.clientX - bounds.left) / bounds.width) * FRAME_WIDTH);
    const y = Math.floor(((event.clientY - bounds.top) / bounds.height) * FRAME_HEIGHT);
    if (x < 0 || x >= FRAME_WIDTH || y < 0 || y >= FRAME_HEIGHT) return;
    const index = y * FRAME_WIDTH + x;
    pixels.current[index] = Number.parseInt(color.slice(1), 16);
    drawCell(index);
  }

  async function pushFrame(quiet = false): Promise<void> {
    try {
      const bytes = encodeRgb565Frame(pixels.current);
      if (bytes.byteLength !== 4096) throw new Error(`Frame is ${bytes.byteLength} bytes, not 4096.`);
      await transport.post("/api/v1/display/frame", { b64: bytesToBase64(bytes) });
      if (!quiet) setStatus({ kind: "ok", text: "4096-byte frame pushed to the panel." });
    } catch (error) {
      setStatus({ kind: "error", text: error instanceof Error ? error.message : "Could not push the frame." });
    }
  }

  function fill(value: number): void {
    pixels.current.fill(value);
    repaint();
    if (live) void pushFrame(true);
  }

  async function backToClock(): Promise<void> {
    try {
      await transport.post("/api/v1/display/clear");
      setStatus({ kind: "ok", text: "The panel is back to its clock scene." });
    } catch (error) {
      setStatus({ kind: "error", text: error instanceof Error ? error.message : "Could not clear the display." });
    }
  }

  return (
    <Card title="64 × 32 paint" aside={<span class="chip">RGB565 · 4096 B</span>} className="paint-card">
      <div class="paint-well">
        <canvas
          ref={canvasRef}
          width={512}
          height={256}
          aria-label="64 by 32 paint canvas"
          onPointerDown={(event) => {
            setPainting(true);
            event.currentTarget.setPointerCapture(event.pointerId);
            paint(event);
          }}
          onPointerMove={(event) => {
            if (painting) paint(event);
          }}
          onPointerUp={() => {
            setPainting(false);
            if (live) void pushFrame(true);
          }}
          onPointerCancel={() => setPainting(false)}
        />
      </div>
      <div class="swatches" aria-label="Paint colors">
        {COLORS.map((preset) => (
          <button
            type="button"
            class={`swatch ${preset === color ? "selected" : ""}`}
            style={{ backgroundColor: preset }}
            title={preset === "#000000" ? "Eraser" : preset}
            aria-label={preset === "#000000" ? "Eraser" : `Use ${preset}`}
            onClick={() => setColor(preset)}
          />
        ))}
        <label class="color-picker">
          <span>CUSTOM</span>
          <input type="color" value={color} onInput={(event) => setColor(event.currentTarget.value)} />
        </label>
      </div>
      <div class="button-row wrap">
        <button class="btn primary" type="button" onClick={() => void pushFrame()}>
          PUSH FRAME
        </button>
        <label class="check-chip">
          <input type="checkbox" checked={live} onChange={(event) => setLive(event.currentTarget.checked)} /> LIVE STROKES
        </label>
        <button class="btn" type="button" onClick={() => fill(Number.parseInt(color.slice(1), 16))}>
          FILL
        </button>
        <button class="btn" type="button" onClick={() => fill(0)}>
          CLEAR CANVAS
        </button>
        <button class="btn ghost" type="button" onClick={() => void backToClock()}>
          BACK TO CLOCK
        </button>
      </div>
      <Status message={status} />
    </Card>
  );
}

export function DashboardView({ transport }: { transport: ConsoleTransport }) {
  const [health, setHealth] = useState<Health | null>(null);
  const [info, setInfo] = useState<DeviceInfo | null>(null);
  const [loadError, setLoadError] = useState("");
  const [text, setText] = useState("SHIP IT");
  const [duration, setDuration] = useState(30);
  const [brightness, setBrightness] = useState(110);
  const [brightnessDirty, setBrightnessDirty] = useState(false);
  const brightnessDirtyRef = useRef(false);
  const [status, setStatus] = useState<StatusMessage | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [nextHealth, nextInfo] = await Promise.all([transport.health(), transport.info()]);
        if (!active) return;
        setHealth(nextHealth);
        setInfo(nextInfo);
        if (!brightnessDirtyRef.current) setBrightness(nextInfo.brightness);
        setLoadError("");
      } catch (error) {
        if (active) setLoadError(error instanceof Error ? error.message : "Could not read device status.");
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 5_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [transport]);

  useEffect(() => {
    if (!brightnessDirty) return;
    const timer = window.setTimeout(async () => {
      try {
        await transport.post("/api/v1/display/brightness", { value: brightness });
        brightnessDirtyRef.current = false;
        setBrightnessDirty(false);
        setStatus({ kind: "ok", text: `Brightness set to ${brightness} / 150.` });
      } catch (error) {
        setStatus({ kind: "error", text: error instanceof Error ? error.message : "Could not set brightness." });
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [brightness, brightnessDirty, transport]);

  async function pushText(): Promise<void> {
    try {
      await transport.post("/api/v1/display/text", { text: text || "hi!", duration_s: duration });
      setStatus({ kind: "ok", text: "Text is on the panel." });
    } catch (error) {
      setStatus({ kind: "error", text: error instanceof Error ? error.message : "Could not push text." });
    }
  }

  async function quickAction(path: string, success: string): Promise<void> {
    try {
      await transport.post(path);
      setStatus({ kind: "ok", text: success });
    } catch (error) {
      setStatus({ kind: "error", text: error instanceof Error ? error.message : "Device action failed." });
    }
  }

  return (
    <div class="view">
      <ViewHeader eyebrow="LOCAL CONTROL" title="Dashboard">
        Live stats, quick text, brightness, and the paint canvas.
      </ViewHeader>

      {loadError && <p class="alert error">{loadError}</p>}
      {!info || !health ? (
        <LoadingCard />
      ) : (
        <>
          {RESET_HINTS[info.reset_reason] && (
            <section class={`alert ${info.reset_reason === "brownout" ? "brownout" : "error"}`} role="alert">
              <strong>Last reset: {info.reset_reason}.</strong> {RESET_HINTS[info.reset_reason]}
            </section>
          )}
          <div class="tiles">
            <div class="tile"><span>FIRMWARE</span><strong>{health.fw}</strong></div>
            <div class="tile"><span>RUNNING SLOT</span><strong>{info.slot}</strong></div>
            <div class="tile"><span>REFRESH</span><strong>{info.refresh_hz}<small> Hz</small></strong></div>
            <div class="tile"><span>FREE HEAP</span><strong>{Math.round(info.heap_free / 1024)}<small> KB</small></strong></div>
            <div class="tile"><span>UPTIME</span><strong>{formatUptime(info.uptime_s)}</strong></div>
            <div class="tile"><span>WI-FI RSSI</span><strong>{info.rssi_dbm}<small> dBm</small></strong></div>
            <div class="tile"><span>IP ADDRESS</span><strong>{info.ip}</strong></div>
            <div class="tile"><span>SHOWING</span><strong>{info.scene}</strong></div>
            <div class="tile"><span>RESET REASON</span><strong>{info.reset_reason || "unknown"}</strong></div>
          </div>
        </>
      )}

      <div class="grid two">
        <Card title="Quick text push" aside={<span class="chip">UP TO 300 S</span>}>
          <label class="field">
            <span>TEXT · MULTI-LINE SUPPORTED · 120 CHARACTERS MAX</span>
            <textarea rows={4} maxLength={120} value={text} onInput={(event) => setText(event.currentTarget.value)} />
          </label>
          <div class="inline-fields">
            <label class="field compact">
              <span>DURATION (SECONDS)</span>
              <input
                type="number"
                min={1}
                max={300}
                value={duration}
                onInput={(event) => setDuration(Math.min(300, Math.max(1, Number(event.currentTarget.value))))}
              />
            </label>
            <button class="btn primary" type="button" onClick={() => void pushText()}>
              SEND TO PANEL
            </button>
          </div>
        </Card>

        <Card title="Panel controls" aside={<span class="chip">USB-SAFE LIMIT</span>}>
          <label class="field">
            <span>BRIGHTNESS · {brightness} / 150</span>
            <input
              type="range"
              min={10}
              max={150}
              value={brightness}
              onInput={(event) => {
                setBrightness(Number(event.currentTarget.value));
                brightnessDirtyRef.current = true;
                setBrightnessDirty(true);
              }}
            />
          </label>
          <p class="note">The device caps brightness at 150 to protect the board from USB power brownouts.</p>
          <div class="button-row">
            <button class="btn" type="button" onClick={() => void quickAction("/api/v1/identify", "Look at the flashing panel.")}>
              IDENTIFY
            </button>
            <button
              class="btn danger"
              type="button"
              onClick={() => {
                if (window.confirm("Reboot this device now?")) void quickAction("/api/v1/reboot", "Rebooting… back in about 15 seconds.");
              }}
            >
              REBOOT
            </button>
          </div>
        </Card>
      </div>

      <Status message={status} />

      <PaintCanvas transport={transport} />
    </div>
  );
}
