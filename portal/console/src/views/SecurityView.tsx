// SPDX-License-Identifier: GPL-3.0-or-later
import { useState } from "preact/hooks";
import { Card, GateChip, Status, ViewHeader } from "../components";
import type { ConsoleTransport } from "../transport";
import type { StatusMessage } from "../types";

export function SecurityView({ transport }: { transport: ConsoleTransport }) {
  const [confirmation, setConfirmation] = useState("");
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [newToken, setNewToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [identityStatus, setIdentityStatus] = useState<StatusMessage | null>(null);
  const [identityBusy, setIdentityBusy] = useState(false);

  async function verifyIdentityNow(): Promise<void> {
    setIdentityBusy(true);
    setIdentityStatus({ kind: "info", text: "Challenging the device with a fresh nonce…" });
    try {
      const { identity, verified, pinMatch } = await transport.verifyNow();
      if (!verified) {
        setIdentityStatus({
          kind: "error",
          text: "The device failed its identity proof. Something on the network may be answering in its place.",
        });
      } else if (!pinMatch) {
        setIdentityStatus({
          kind: "error",
          text:
            `Signature valid, but key ${identity.fingerprint} is NOT the key this browser pinned. ` +
            "Expected after a reflash or factory reset — forget the device in Settings and reconnect. Otherwise, distrust it.",
        });
      } else {
        setIdentityStatus({
          kind: "ok",
          text: `Verified: ${identity.device} holds the pinned key ${identity.fingerprint}.`,
        });
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : "Identity check failed.";
      setIdentityStatus({
        kind: "error",
        text: text.includes("404")
          ? "This firmware predates identity verification — update it from the Deploy page."
          : text,
      });
    } finally {
      setIdentityBusy(false);
    }
  }

  async function act(path: string, pending: string, success: string): Promise<void> {
    setBusy(true);
    setStatus({ kind: "info", text: pending });
    try {
      const result = await transport.post<{ token?: string }>(path);
      if (result.token) {
        transport.saveToken(result.token);
        setNewToken(result.token);
      }
      setStatus({ kind: "ok", text: success });
    } catch (error) {
      setStatus({ kind: "error", text: error instanceof Error ? error.message : "Security action failed." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div class="view">
      <ViewHeader eyebrow="LOCAL TRUST CONTROLS" title="Security">
        Rotate shared LAN access or deliberately reset network and device state. Destructive actions are never one-click.
      </ViewHeader>

      <Card
        title="Device identity"
        aside={
          transport.isMock ? (
            <span class="chip demo">SIMULATED</span>
          ) : transport.pinnedFingerprint ? (
            <span class="chip ok">ED25519 · PINNED</span>
          ) : (
            <span class="chip">ED25519</span>
          )
        }
      >
        <p class="lead">
          The panel proves it is your panel: it signs a fresh challenge with a key minted on its first
          boot, and this browser checks the signature against the key it pinned when you paired. mDNS
          names can be squatted, and plain HTTP proves nothing about who's answering.
        </p>
        <p>
          Pinned key fingerprint:{" "}
          <code>{transport.pinnedFingerprint || (transport.isMock ? "DEMO-MODE" : "none yet — verify or pair to pin one")}</code>
        </p>
        <button class="btn" type="button" disabled={identityBusy} onClick={() => void verifyIdentityNow()}>
          {identityBusy ? "VERIFYING…" : "VERIFY NOW"}
        </button>
        <Status message={identityStatus} />
      </Card>

      <div class="grid two">
        <Card title="Rotate LAN token" aside={<span class="chip warn">LOGS OUT EVERY CLIENT</span>}>
          <p class="lead">This invalidates every paired browser and script. The new token stays in this browser; all others must pair again.</p>
          <button
            class="btn danger"
            type="button"
            disabled={busy}
            onClick={() => {
              if (window.confirm("Rotate the LAN token? This logs out every browser and script except this one.")) {
                void act("/api/v1/token/rotate", "Rotating the LAN token…", "Token rotated. Every other client must pair again.");
              }
            }}
          >
            ROTATE LAN TOKEN
          </button>
        </Card>

        <Card title="Change Wi-Fi" aside={<span class="chip warn">REBOOTS TO SETUP</span>}>
          <p class="lead">Removes Wi-Fi credentials only. The LAN token, timezone, brightness, and Flights configuration survive.</p>
          <button
            class="btn danger"
            type="button"
            disabled={busy}
            onClick={() => {
              if (window.confirm("Remove Wi-Fi credentials and reboot into the DEVMATRIX setup hotspot?")) {
                void act("/api/v1/wifi/reset", "Removing Wi-Fi credentials…", "Rebooting into the DEVMATRIX setup hotspot.");
              }
            }}
          >
            CHANGE WI-FI…
          </button>
        </Card>
      </div>

      <Card title="Factory reset" aside={<span class="chip crit">WIPES DEVICE SETTINGS</span>} className="danger-card">
        <p class="lead">Erases Wi-Fi, the LAN token, timezone, brightness, MQTT credentials, messages, the custom layout, and Flights configuration from NVS.</p>
        <label class="field">
          <span>TYPE “FACTORY RESET” TO CONFIRM</span>
          <input value={confirmation} autoComplete="off" onInput={(event) => setConfirmation(event.currentTarget.value)} />
        </label>
        <button
          class="btn danger"
          type="button"
          disabled={busy || confirmation !== "FACTORY RESET"}
          onClick={() => void act("/api/v1/factory/reset", "Erasing device settings…", "Factory reset accepted. Rebooting factory-fresh.")}
        >
          FACTORY RESET
        </button>
      </Card>

      <Status message={status} />
      {newToken && (
        <p class="token-result">
          <span>NEW TOKEN · SAVED IN THIS BROWSER</span>
          <code>{newToken}</code>
        </p>
      )}

      <div class="grid two">
        <Card title="Passkeys & hardware keys" aside={<GateChip gate="M1" />}>
          <p class="lead">Optional account passkeys and hardware-key enrollment arrive at gate M1. LAN control needs no account.</p>
        </Card>
        <Card title="Audit log" aside={<GateChip gate="M1" />}>
          <p class="lead">Timestamped action history and export arrive at gate M1. No audit controls are simulated here.</p>
        </Card>
      </div>
    </div>
  );
}
