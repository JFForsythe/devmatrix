// SPDX-License-Identifier: GPL-3.0-or-later
// The hosted Console's front door (docs/PORTAL.md "Five-minute first
// pixel"). The device-served Console never shows this view — a box is
// already connected there by definition.
import { useState } from "preact/hooks";
import { Card, Status } from "../components";
import type { DeviceIdentity } from "../identity";
import type { ConnectResult, ConsoleTransport } from "../transport";
import type { StatusMessage } from "../types";

type Phase = "idle" | "busy" | "legacy" | "mismatch";

export function WelcomeView({
  transport,
  onDemo,
}: {
  transport: ConsoleTransport;
  onDemo: () => void;
}) {
  const [address, setAddress] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [pending, setPending] = useState<DeviceIdentity | null>(null);

  function enterConsole(): void {
    window.location.hash = "#/dashboard";
    window.location.reload();
  }

  function applyResult(result: ConnectResult): void {
    if (result.identityStatus === "verified") {
      // First contact is trust-on-first-use, not authentication: any
      // responder's self-consistent key would pin. Say so — the panel's
      // 6-digit code in the next step is the real possession proof.
      const keyNote = result.firstPin
        ? `its key ${result.identity?.fingerprint} is now pinned to this browser (first use — ` +
          "every later connection must present this same key, and the panel's 6-digit code " +
          "next proves you have the real panel)"
        : `it presented the key this browser pinned earlier (${result.identity?.fingerprint})`;
      setStatus({
        kind: "ok",
        text:
          `Found ${result.health.device} (firmware v${result.health.fw}) — identity proof passed; ` +
          `${keyNote}. Opening the Console…`,
      });
      window.setTimeout(enterConsole, 1600);
    } else if (result.identityStatus === "bad-signature") {
      setPhase("idle");
      setStatus({
        kind: "error",
        text:
          "The device at this address failed its cryptographic identity proof. Something on your " +
          "network is answering in its place — do not pair with it.",
      });
    } else if (result.identityStatus === "mismatch") {
      setPhase("mismatch");
      setPending(result.identity);
      setStatus(null);
    } else {
      setPhase("legacy");
      setStatus({
        kind: "info",
        text:
          `Found ${result.health.device}, but its firmware predates identity verification. ` +
          "Without it nothing proves this is your panel rather than a device impersonating it — " +
          "connect only on a network you trust, and update from the Deploy page immediately. " +
          "No key will be pinned until the update.",
      });
    }
  }

  async function connect(legacyOk = false): Promise<void> {
    setPhase("busy");
    setStatus({ kind: "info", text: "Reaching the panel… if the browser asks for local-network permission, allow it." });
    try {
      applyResult(await transport.connectDevice(address, legacyOk));
    } catch (error) {
      setPhase("idle");
      setStatus({ kind: "error", text: error instanceof Error ? error.message : "Could not connect." });
    }
  }

  async function trustNewKey(): Promise<void> {
    if (!pending) return;
    transport.trustNewIdentity(pending);
    await connect();
  }

  return (
    <div class="welcome">
      <header class="welcome-hero">
        <div class="brand" aria-label="Devmatrix Console">
          <span class="brand-mark" aria-hidden="true" />
          <span><strong>DEVMATRIX</strong><small>CONSOLE</small></span>
        </div>
        <h1>Your panel, on your network</h1>
        <p>
          The Dev Kit is controlled from this Console — over your own Wi-Fi, with no account and no
          cloud in the loop. This page is a static file; your panel never talks to a server of mine.
        </p>
        <p class="welcome-chips">
          <span class="chip ok">LOCAL · FREE FOREVER</span>
          <span class="chip">NO ACCOUNT NEEDED</span>
          <span class="chip">OPEN FIRMWARE</span>
        </p>
      </header>

      <div class="welcome-grid">
        <Card title="Five minutes to first pixel">
          <ol class="steps">
            <li>
              <strong>Power the panel.</strong> Any good 5&thinsp;V USB-C supply. The panel lights up and
              shows what to do next.
            </li>
            <li>
              <strong>Give it your Wi-Fi.</strong> The panel announces <code>SETUP: JOIN DEVMATRIX-XXXX</code>.
              Join that hotspot from your phone — a setup page opens by itself, scans your networks, and
              joins yours live. The phone that runs setup is signed in automatically.
            </li>
            <li>
              <strong>Read its address off the panel</strong> — something like <code>dmx-0952.local</code>.
            </li>
            <li>
              <strong>Enter the address here</strong> and hit CONNECT. The Console reaches the panel over
              your LAN and verifies it cryptographically.
            </li>
            <li>
              <strong>Type the 6-digit code the panel shows.</strong> That proves you can see the panel —
              this browser is now paired. Push text, paint pixels, run apps.
            </li>
          </ol>
          <p class="note">
            Prefer zero dependence on this page? Open <code>http://dmx-xxxx.local</code> directly — the
            panel serves this exact Console itself. That path also works on Safari, which does not yet
            allow web pages to reach local devices.
          </p>
        </Card>

        <Card title="Connect your panel">
          <label class="field">
            <span>PANEL ADDRESS (FROM THE PANEL OR ITS CLOCK FOOTER)</span>
            <input
              value={address}
              placeholder="dmx-0952.local"
              autoComplete="off"
              spellcheck={false}
              disabled={phase === "busy"}
              onInput={(event) => setAddress(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && address.trim() && phase !== "busy") void connect();
              }}
            />
          </label>

          {phase === "mismatch" && pending ? (
            <div class="alert" role="alert">
              <strong>This box's identity key changed.</strong>
              <p>
                Your browser pinned a different key for {pending.device} earlier. A reflash or factory
                reset explains this; a spoofed device on your network also would. Only continue if you
                expected the change.
              </p>
              <p>New key fingerprint: <code>{pending.fingerprint}</code></p>
              <button class="btn danger" type="button" onClick={() => void trustNewKey()}>
                TRUST THE NEW KEY
              </button>
              <button class="btn ghost" type="button" onClick={() => { setPhase("idle"); setPending(null); }}>
                CANCEL
              </button>
            </div>
          ) : phase === "legacy" ? (
            <div class="button-row">
              <button class="btn primary" type="button" onClick={() => void connect(true)}>
                CONNECT ANYWAY
              </button>
              <button class="btn ghost" type="button" onClick={() => setPhase("idle")}>
                CANCEL
              </button>
            </div>
          ) : (
            <button
              class="btn primary wide"
              type="button"
              disabled={phase === "busy" || !address.trim()}
              onClick={() => void connect()}
            >
              {phase === "busy" ? "CONNECTING…" : "CONNECT"}
            </button>
          )}

          <Status message={status} />

          <p class="note">
            Works in Chrome, Edge, and Firefox on the same network as the panel. If the panel cannot
            be reached from here, open its address directly — every feature works from the panel
            itself, always.
          </p>
        </Card>
      </div>

      <Card title="No panel yet?">
        <p>
          Explore the full Console against a simulated panel — same screens, same controls, sample data.
          Everything you see works the same way on real hardware.
        </p>
        <button class="btn wide" type="button" onClick={onDemo}>
          EXPLORE THE INTERACTIVE DEMO
        </button>
      </Card>
    </div>
  );
}
