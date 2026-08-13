// SPDX-License-Identifier: GPL-3.0-or-later
// The owner's guide, inside the Console itself — served by the panel, so
// the instructions work with the internet down. The long-form manual is
// docs/MANUAL.md in the repository; this view is the working summary.
import { Card, GateChip, ViewHeader } from "../components";
import type { ConsoleTransport } from "../transport";

const REPO = "https://github.com/JFForsythe/devmatrix";

export function GuideView({ transport }: { transport: ConsoleTransport }) {
  return (
    <section class="view">
      <ViewHeader eyebrow="Guide" title="How to use your Dev Kit">
        Setup, everyday control, and what every page does — right here, served by the panel itself, so
        it works even with the internet down.
      </ViewHeader>

      <Card title="From box to first pixel">
        <ol class="steps">
          <li><strong>Power the panel</strong> with a solid 5&thinsp;V USB-C supply.</li>
          <li>
            <strong>Join its setup hotspot.</strong> First boot, the panel shows
            <code> JOIN ME → DEVMATRIX-XXXX</code>. Join that Wi-Fi network from a phone; the setup page
            opens by itself. Pick your network, type the password, and watch it join live. The phone
            that ran setup is signed in to this Console automatically.
          </li>
          <li>
            <strong>Open the address the panel shows</strong> — like <code>http://dmx-4e71.local</code> —
            from any browser on your network, or connect through the hosted Console.
          </li>
          <li>
            <strong>Pair each new browser once:</strong> tap PAIR, read the 6-digit code off the panel
            (white row, then blue), type it in. Reading the panel is the proof — codes expire in five
            minutes and die after five wrong tries.
          </li>
          <li>
            <strong>Push something.</strong> Dashboard → quick text, or paint the 64×32 canvas and push
            the frame. That is your first pixel — no account, no cloud, no server of ours involved.
          </li>
        </ol>
      </Card>

      <Card title="Every page, in one line">
        <table class="guide-table">
          <tbody>
            <tr><th>Dashboard</th><td>What the box is doing now — live stats, quick text, paint canvas, brightness, identify, reboot.</td></tr>
            <tr><th>Devices</th><td>The boxes this browser knows, and how to pair another browser.</td></tr>
            <tr><th>Apps</th><td>Messages, Flights overhead, and Custom layout — enable, configure, and rotate them on the panel.</td></tr>
            <tr><th>Deploy</th><td>Update firmware over the air by uploading a <code>.bin</code>; USB recovery notes.</td></tr>
            <tr><th>Dev console</th><td>Every button here is an HTTP call — this page writes the <code>curl</code> commands for you, with your token.</td></tr>
            <tr><th>Security</th><td>Device identity, LAN token rotation, changing Wi-Fi, factory reset.</td></tr>
            <tr><th>Settings</th><td>Timezone, addresses, and MQTT / Home Assistant on your own broker.</td></tr>
          </tbody>
        </table>
      </Card>

      <Card title="Local Mode and Cloud Mode" aside={<span class="chip ok">LOCAL · FREE</span>}>
        <p>
          <strong>Local Mode is the complete product.</strong> Your browser talks to your box on your
          LAN — free forever, no account, and everything keeps working if our company vanishes. Remote
          access today: put the panel behind your own VPN or Tailscale, and it behaves exactly as if
          you were home.
        </p>
        <p>
          <strong>Cloud Mode</strong> is an optional paid layer that adds <em>reach</em> — control from
          anywhere, all your sites in one view, hosted encrypted backups, offline alerts. It never adds
          a capability the box itself lacks, and if it ever sunsets, Local keeps working with 12 months'
          notice and a guided exit. <GateChip gate="C1" />
        </p>
      </Card>

      <Card title="Home Assistant, MQTT, and your own code">
        <p>
          Point the panel at your MQTT broker under Settings and Home Assistant discovers it with zero
          YAML — light, text, and notify entities appear on their own. Prefer HTTP? Everything the
          Console does is a documented <code>/api/v1</code> call with your LAN token; the Dev console
          page writes working <code>curl</code> commands. Frames are raw RGB565, 4096 bytes — push them
          from any language.
        </p>
      </Card>

      <Card title="Updates and recovery — never brick">
        <p>
          Updates go over the air from the Deploy page. The board keeps two firmware slots plus a USB
          recovery partition: a failed update falls back, and the recovery flash over a USB cable always
          works even on a dead image. Factory reset (Security) requires this Console — physical access to
          your network — and returns the box to its setup hotspot.
        </p>
      </Card>

      <Card title="If something misbehaves">
        <ul class="guide-list">
          <li>
            <strong>Can't reach <code>dmx-xxxx.local</code>?</strong> Same Wi-Fi network? Guest networks
            and VLANs often block mDNS — try the IP address the panel's clock footer shows. From the
            hosted Console, allow the browser's local-network permission; on Safari, open the panel's
            address directly.
          </li>
          <li>
            <strong>Pair code rejected or expired?</strong> Tap PAIR again for a fresh code — five wrong
            tries retires a code on purpose.
          </li>
          <li>
            <strong>Panel dim?</strong> Brightness is capped at 150/255 on USB power so a full-white
            frame cannot brown out the board. The Dashboard warns you if a reset was a brownout.
          </li>
          <li>
            <strong>New router?</strong> Security → CHANGE WI-FI reopens the setup flow without losing
            anything else.
          </li>
          <li>
            <strong>Identity warning?</strong> The panel proves itself by signing a challenge with a key
            minted on its first boot. A reflash or factory reset changes that key legitimately; anything
            else answering in its place is a reason to stop. Check Security → Device identity.
          </li>
        </ul>
      </Card>

      <Card title="Go deeper">
        <p>
          The full owner's manual — every chapter from unboxing to recovery — lives with the source:
          {" "}<a href={`${REPO}/blob/main/docs/MANUAL.md`} target="_blank" rel="noreferrer">docs/MANUAL.md</a>.
          The firmware, this Console, and the hardware files are all in the same repository
          {" "}(<a href={REPO} target="_blank" rel="noreferrer">{REPO.replace("https://", "")}</a>) —
          fork it, build it, flash your own. That is the point of a dev kit.
        </p>
        {transport.isMock && (
          <p class="note">You are in the demo right now — connect a real panel from the welcome screen to try all of this live.</p>
        )}
      </Card>
    </section>
  );
}
