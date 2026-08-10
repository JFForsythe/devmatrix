// SPDX-License-Identifier: GPL-3.0-or-later
import { useEffect, useState } from "preact/hooks";
import { Card, GateChip, LoadingCard, Status, ViewHeader } from "../components";
import type { ConsoleTransport } from "../transport";
import type { DeviceInfo, StatusMessage } from "../types";

export function DeployView({ transport }: { transport: ConsoleTransport }) {
  const [info, setInfo] = useState<DeviceInfo | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [rebooting, setRebooting] = useState(false);
  const [status, setStatus] = useState<StatusMessage | null>(null);

  useEffect(() => {
    let active = true;
    transport
      .info()
      .then((value) => {
        if (active) setInfo(value);
      })
      .catch((error: unknown) => {
        if (active) setStatus({ kind: "error", text: error instanceof Error ? error.message : "Could not read firmware status." });
      });
    return () => {
      active = false;
    };
  }, [transport]);

  async function upload(): Promise<void> {
    if (!file) {
      setStatus({ kind: "error", text: "Choose a .bin firmware file first." });
      return;
    }
    setUploading(true);
    setRebooting(false);
    setProgress(0);
    setStatus({ kind: "info", text: "Uploading firmware… keep the device powered." });
    try {
      await transport.uploadFirmware(file, setProgress);
      setProgress(100);
      setStatus({ kind: "ok", text: "Upload complete — rebooting…" });
      if (!transport.isMock) {
        setRebooting(true);
        for (let attempt = 0; attempt < 40; attempt += 1) {
          await new Promise((resolve) => window.setTimeout(resolve, 1_500));
          try {
            await transport.health();
            window.location.reload();
            return;
          } catch {
            // Reboot recovery is expected to be unreachable between polls.
          }
        }
        setStatus({ kind: "error", text: "Upload completed, but the device did not return within 60 seconds." });
      }
    } catch (error) {
      setStatus({ kind: "error", text: error instanceof Error ? error.message : "Firmware upload failed." });
      setProgress(0);
    } finally {
      setUploading(false);
      setRebooting(false);
    }
  }

  return (
    <div class="view">
      <ViewHeader eyebrow="FIRMWARE CONTROL" title="Deploy">
        Upload a local build to the inactive OTA slot, then watch the device reboot into it.
      </ViewHeader>

      {!info ? (
        <LoadingCard />
      ) : (
        <Card title="Running firmware" aside={<span class="chip ok">CURRENT DEVICE</span>}>
          <div class="version-panel">
            <div><span>VERSION</span><strong>v{info.fw}</strong></div>
            <div><span>RUNNING SLOT</span><strong>{info.slot}</strong></div>
            <div><span>DEVICE</span><strong>{info.device}</strong></div>
          </div>
        </Card>
      )}

      <Card title="OTA upload" aside={<span class="chip">MULTIPART · /update</span>}>
        <div class="upload-row">
          <label class="file-picker">
            <span>{file ? file.name : "CHOOSE A .BIN FILE"}</span>
            <input type="file" accept=".bin,application/octet-stream" onChange={(event) => setFile(event.currentTarget.files?.[0] ?? null)} />
          </label>
          <button class="btn primary" type="button" disabled={uploading || !file} onClick={() => void upload()}>
            {rebooting ? "REBOOTING…" : uploading ? "UPLOADING…" : "UPLOAD & REBOOT"}
          </button>
        </div>
        <div class="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
          <i style={{ width: `${progress}%` }} />
        </div>
        <Status message={status} />
      </Card>

      <div class="grid two">
        <Card title="Signed OTA" aside={<GateChip gate="M0" />}>
          <p class="lead">Images are length- and magic-checked today. Signature verification arrives at gate M0.</p>
        </Card>
        <Card title="Automatic rollback" aside={<GateChip gate="M0" />}>
          <p class="lead">Automatic rollback after a failed boot arrives at gate M0. Until then, use USB recovery.</p>
        </Card>
      </div>

      <Card title="USB recovery" aside={<span class="chip ok">AVAILABLE TODAY</span>}>
        <p class="lead">Double-press reset, mount the board as a USB drive, then drag a UF2 firmware file onto it.</p>
        <p class="note">See the Owner’s Manual, chapter 10 · Recovery and resets, for the full recovery ladder.</p>
      </Card>
    </div>
  );
}
