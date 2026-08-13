// SPDX-License-Identifier: GPL-3.0-or-later
import { useState } from "preact/hooks";
import { Status } from "./components";
import type { ConsoleTransport } from "./transport";
import type { StatusMessage } from "./types";

export function PairingFlow({
  transport,
  onClose,
}: {
  transport: ConsoleTransport;
  onClose: () => void;
}) {
  const [started, setStarted] = useState(false);
  const [code, setCode] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [manualToken, setManualToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<StatusMessage | null>(null);

  async function start(): Promise<void> {
    setBusy(true);
    setStatus(null);
    try {
      await transport.startClaim();
      setStarted(true);
      setStatus({ kind: "info", text: "The 6-digit code is now showing on the panel for five minutes." });
    } catch (error) {
      setStatus({ kind: "error", text: error instanceof Error ? error.message : "Could not start pairing." });
    } finally {
      setBusy(false);
    }
  }

  async function finish(): Promise<void> {
    // The panel shows the code as two rows of three, so owners often type a
    // space or dash. The device ignores separators; accept them here too
    // rather than blocking submit on a length check.
    const digits = code.replace(/\D/g, "");
    if (digits.length !== 6) return;
    setBusy(true);
    setStatus(null);
    try {
      await transport.finishClaim(digits);
      onClose();
    } catch (error) {
      setStatus({ kind: "error", text: error instanceof Error ? error.message : "That code was not accepted." });
    } finally {
      setBusy(false);
    }
  }

  function cancel(): void {
    transport.cancelPairing();
    onClose();
  }

  return (
    <div class="pairing-backdrop" role="presentation">
      <section class="pairing-card" role="dialog" aria-modal="true" aria-labelledby="pair-title">
        <span class="chip live">LIVE DEVICE</span>
        <h2 id="pair-title">Pair this browser</h2>
        <p>
          The saved LAN token was missing or rejected. Ask the device to show a code, then type the six digits from the
          panel. The interrupted action retries automatically.
        </p>

        {!started ? (
          <button class="btn primary wide" type="button" disabled={busy} onClick={start}>
            {busy ? "STARTING…" : "SHOW A CODE ON THE PANEL"}
          </button>
        ) : (
          <div class="pair-code-row">
            <label>
              <span>6-DIGIT PANEL CODE</span>
              <input
                autoFocus
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                placeholder="123456"
                onInput={(event) => setCode(event.currentTarget.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void finish();
                }}
              />
            </label>
            <button class="btn primary" type="button" disabled={busy || code.replace(/\D/g, "").length !== 6} onClick={finish}>
              {busy ? "PAIRING…" : "PAIR & RETRY"}
            </button>
          </div>
        )}

        <Status message={status} />
        <button class="text-button" type="button" onClick={() => setAdvanced(!advanced)}>
          {advanced ? "Hide token entry" : "Advanced: paste a LAN token instead"}
        </button>
        {advanced && (
          <div class="manual-token-row">
            <input
              type="password"
              value={manualToken}
              placeholder="LAN token"
              autoComplete="off"
              onInput={(event) => setManualToken(event.currentTarget.value.trim())}
            />
            <button
              class="btn"
              type="button"
              disabled={!manualToken}
              onClick={() => {
                transport.useTokenAndRetry(manualToken);
                onClose();
              }}
            >
              USE TOKEN & RETRY
            </button>
          </div>
        )}
        <button class="btn ghost wide" type="button" onClick={cancel}>
          CANCEL
        </button>
      </section>
    </div>
  );
}
