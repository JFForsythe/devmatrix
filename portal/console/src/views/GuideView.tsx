// SPDX-License-Identifier: GPL-3.0-or-later
// The owner's guide, inside the Console itself — served by the panel, so
// the instructions work with the internet down. The long-form manual is
// docs/MANUAL.md in the repository; this view is the working summary.
// It is one long page on purpose, so the index rail stays with you while
// you scroll (API-readme style); every section is an anchor.
import { useEffect, useState } from "preact/hooks";
import { Card, GateChip, ViewHeader } from "../components";
import type { ConsoleTransport } from "../transport";

const REPO = "https://github.com/JFForsythe/devmatrix";

// The index and the sections are one list so they can never drift apart.
// Entries with group "trouble" render under the TROUBLESHOOTING header.
const SECTIONS = [
  { id: "start", label: "Start here" },
  { id: "pages", label: "Every page" },
  { id: "control", label: "Everyday control" },
  { id: "apps", label: "Apps & rotation" },
  { id: "integrate", label: "MQTT & your code" },
  { id: "modes", label: "Local vs Cloud" },
  { id: "updates", label: "Updates & recovery" },
  { id: "t-setup", label: "Setup & Wi-Fi", group: "trouble" },
  { id: "t-reach", label: "Reaching the panel", group: "trouble" },
  { id: "t-pair", label: "Pairing & identity", group: "trouble" },
  { id: "t-display", label: "Display & apps", group: "trouble" },
  { id: "t-mqtt", label: "MQTT & Home Assistant", group: "trouble" },
  { id: "t-usb", label: "USB recovery", group: "trouble" },
  { id: "deeper", label: "Go deeper" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

// The index is styled after the in-box receipt card (dashed tear-rules,
// mono caps) and the active entry lights a pixel — same square the rail
// nav uses, because on this product "where you are" is a lit LED.
function GuideIndex({ active }: { active: SectionId }) {
  let trbHeaderDone = false;
  return (
    <nav class="guide-index" aria-label="On this page">
      <p class="guide-index-title">ON THIS PAGE</p>
      {SECTIONS.map((section) => {
        const header =
          "group" in section && section.group === "trouble" && !trbHeaderDone
            ? ((trbHeaderDone = true), <p class="guide-index-sub">TROUBLESHOOTING</p>)
            : null;
        return (
          <>
            {header}
            <a
              href={`#/guide`}
              aria-current={active === section.id ? "location" : undefined}
              onClick={(event) => {
                // Stay on the guide route; just scroll. The hash is the
                // router's, so anchors scroll by hand.
                event.preventDefault();
                document.getElementById(section.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              <span class="gi-px" aria-hidden="true" />
              {section.label}
            </a>
          </>
        );
      })}
    </nav>
  );
}

export function GuideView({ transport }: { transport: ConsoleTransport }) {
  const [active, setActive] = useState<SectionId>("start");

  useEffect(() => {
    // Scroll-spy: the topmost section crossing the reading line wins.
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id as SectionId);
      },
      { rootMargin: "-64px 0px -55% 0px" },
    );
    for (const section of SECTIONS) {
      const el = document.getElementById(section.id);
      if (el) observer.observe(el);
    }
    // Sections near the page bottom can never reach the reading line, so
    // the very end of the page hands the highlight to the last section.
    const onScroll = () => {
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
        setActive(SECTIONS[SECTIONS.length - 1].id);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <section class="view guide-view">
      <ViewHeader eyebrow="Guide" title="How to use your Dev Kit">
        Setup, everyday control, and every fix I know — served by the panel itself, so it works with
        the internet down.
      </ViewHeader>

      <div class="guide-layout">
        <GuideIndex active={active} />
        <div class="guide-content">
          <Card id="start" title="From box to first pixel">
            <ol class="steps">
              <li>
                <strong>Power the panel</strong> with a solid 5&thinsp;V USB-C supply — 2&thinsp;A or
                better. The panel lights up and tells you what to do next.
              </li>
              <li>
                <strong>Join its setup hotspot.</strong> On first boot the panel shows
                <code> SETUP: JOIN DEVMATRIX-XXXX</code>. Join that Wi-Fi network from your phone; the
                setup page opens by itself, scans, and joins your network live. One catch: the radio is
                2.4&thinsp;GHz-only, so a 5&thinsp;GHz-only network won't appear. The phone that runs
                setup is signed in to this Console automatically.
              </li>
              <li>
                <strong>Open the address the panel shows</strong> — it reads
                <code> WIFI CONNECTED · LAST STEP: OPEN DMX-XXXX.LOCAL</code>. That address is the last
                four characters of the serial: <code>DMX-4E71-0952</code> answers at
                <code> http://dmx-0952.local</code>. Any browser on the same network works.
              </li>
              <li>
                <strong>Pair each new browser once:</strong> tap PAIR, read the 6-digit code off the
                panel (white row, then blue), type it in. Reading the panel is the proof — codes expire
                in five minutes and die after five wrong tries.
              </li>
              <li>
                <strong>Push something.</strong> Dashboard → quick text, or paint the 64×32 canvas and
                push the frame. That's your first pixel.
              </li>
            </ol>
          </Card>

          <Card id="pages" title="Every page, in one line">
            <table class="guide-table">
              <tbody>
                <tr><th>Dashboard</th><td>What the box is doing now — live stats, quick text, paint canvas, brightness, identify, reboot.</td></tr>
                <tr><th>Devices</th><td>The box serving this Console (the demo shows a sample fleet), and how to pair another browser.</td></tr>
                <tr><th>Apps</th><td>Messages, Flights list, and Custom layout — enable, configure, and rotate them on the panel.</td></tr>
                <tr><th>Deploy</th><td>Update firmware over the air by uploading a <code>.bin</code>; USB recovery notes.</td></tr>
                <tr><th>Dev console</th><td>Every button here is an HTTP call — this page writes the <code>curl</code> commands for you, with your token.</td></tr>
                <tr><th>Security</th><td>Device identity, LAN token rotation, changing Wi-Fi, factory reset.</td></tr>
                <tr><th>Settings</th><td>Timezone, addresses, and MQTT / Home Assistant on your own broker.</td></tr>
              </tbody>
            </table>
          </Card>

          <Card id="control" title="Everyday control">
            <ul class="guide-list">
              <li>
                <strong>Text:</strong> up to 120 characters, shown for 1 second to 5 minutes. A line
                break switches the panel to the small multi-line font.
              </li>
              <li>
                <strong>Pixels:</strong> the canvas pushes one full 64×32 frame. Push from your own code
                too — a frame is 4096 bytes of raw RGB565.
              </li>
              <li>
                <strong>Brightness:</strong> 10–150. The cap is real: a full-white frame above that can
                out-draw USB power and reset the board. The Dashboard tells you if a reset was a
                brownout.
              </li>
              <li>
                <strong>Identify:</strong> flashes a border with the serial for 6 seconds — handy once
                you own more than one.
              </li>
              <li>
                <strong>The clock is home base.</strong> Whatever you pushed, CLEAR (or the end of its
                duration) returns the panel to the clock and its app rotation.
              </li>
            </ul>
          </Card>

          <Card id="apps" title="Apps and the rotation">
            <p>
              Three apps ship on the box: <strong>Messages</strong> (your phrases, rotating),
              <strong> Flights list</strong> (fed by your own receiver; the radar view is its
              companion script's half), and <strong> Custom layout</strong> (a JSON layout you save
              to the panel — it fetches the bound data and renders it itself). Enabled apps take
              turns with the clock; each gets its configured seconds on screen.
            </p>
            <p>
              An enabled app with nothing to show deliberately shows the clock instead of going blank.
              If an app seems missing, that's usually why — see{" "}
              <a href="#/guide" onClick={(e) => { e.preventDefault(); document.getElementById("t-display")?.scrollIntoView({ behavior: "smooth" }); }}>
                Display &amp; apps
              </a>{" "}
              below for how to read the diagnosis.
            </p>
          </Card>

          <Card id="integrate" title="Home Assistant, MQTT, and your own code">
            <p>
              Point the panel at your MQTT broker under Settings and Home Assistant discovers it with
              zero YAML — light, text, and notify entities appear on their own. Prefer HTTP? Everything
              the Console does is a documented <code>/api/v1</code> call with your LAN token; the Dev
              console page writes working <code>curl</code> commands. Frames are raw RGB565, 4096 bytes
              — push them from any language.
            </p>
          </Card>

          <Card id="modes" title="Local Mode and Cloud Mode" aside={<span class="chip ok">LOCAL · FREE</span>}>
            <p>
              <strong>Local Mode is the complete product.</strong> Your browser talks to your box on
              your LAN — free forever, no account, and everything keeps working even if I stop selling
              these tomorrow. Remote access today: put the panel behind your own VPN or Tailscale, and
              it behaves exactly as if you were home.
            </p>
            <p>
              <strong>Cloud Mode</strong> is a paid layer I would offer if demand requires it — control
              from anywhere, all your sites in one view, offline alerts. It never adds a capability the
              box itself lacks, and if it ever sunsets, Local keeps working with 12 months' notice and a
              guided exit. <GateChip gate="C1" />
            </p>
          </Card>

          <Card id="updates" title="Updates and recovery — never brick">
            <p>
              Updates go over the air from the Deploy page. The board keeps two firmware slots plus a
              USB recovery partition: a failed upload leaves the running firmware untouched, the
              previous firmware stays in the other slot, and the recovery flash over a USB cable
              always works, even on a dead image. Automatic rollback after a failed boot arrives at
              gate M0 — until then, USB recovery is the net. Factory reset from the Security page
              needs this Console; without the Console, the USB settings wipe in the manual's recovery
              chapter does the same with no token. Either way the box returns to its setup hotspot.
            </p>
          </Card>

          <Card id="t-setup" title="Trouble: setup and Wi-Fi">
            <ul class="guide-list">
              <li>
                <strong>The setup page never opened?</strong> While joined to the
                <code> DEVMATRIX-XXXX</code> hotspot, browse to <code>http://192.168.4.1</code> — same
                page, opened by hand.
              </li>
              <li>
                <strong>Your Wi-Fi isn't in the list?</strong> The radio is 2.4&thinsp;GHz-only, so a
                5&thinsp;GHz-only network can't appear. Enable a 2.4&thinsp;GHz band or guest SSID on
                your router, then rescan.
              </li>
              <li>
                <strong>The setup page closed before you finished?</strong> Rejoin the hotspot and it
                reopens. If the hotspot is gone, the panel already joined your Wi-Fi and is showing its
                address — skip ahead and open that.
              </li>
              <li>
                <strong>New router or moved house?</strong> Security → CHANGE WI-FI reopens the setup
                flow without losing anything else. No way to reach the Console at all? Hold that thought
                for <em>USB recovery</em> below.
              </li>
            </ul>
          </Card>

          <Card id="t-reach" title="Trouble: can't reach the panel">
            <ul class="guide-list">
              <li>
                <strong><code>dmx-xxxx.local</code> not found?</strong> First: same Wi-Fi network? Guest
                networks and VLANs often block mDNS, and some Android browsers refuse
                <code> .local</code> names outright. The fix is the IP address — the panel's clock
                footer shows its name, your router's client list shows the panel as
                <code> dmx-xxxx</code> with its IP, and a paired Dashboard shows it too.
              </li>
              <li>
                <strong>Using the hosted Console rather than the panel's own address?</strong> Allow
                the browser's local-network permission when it asks (Chrome, Edge, Firefox). Safari
                doesn't offer that permission — open the panel's own address instead; the panel
                serves this exact Console itself.
              </li>
              <li>
                <strong>Panel showing the clock but nothing answers?</strong> Power-cycle it once. It
                rejoins your Wi-Fi by itself; if your router was down, it retries in the background
                until it's back.
              </li>
            </ul>
          </Card>

          <Card id="t-pair" title="Trouble: pairing, tokens, identity">
            <ul class="guide-list">
              <li>
                <strong>Pair code rejected or expired?</strong> Codes live five minutes and die after
                five wrong tries — tap PAIR again and an expired or retired code is replaced with a
                fresh one (a still-active code just re-shows itself).
              </li>
              <li>
                <strong>Everything answers <code>401 unauthorized</code>?</strong> This browser's token
                went stale — usually because the token was rotated or the box was factory reset. Pair
                again; that's the whole fix.
              </li>
              <li>
                <strong>Identity warning (key changed)?</strong> The panel proves itself by signing a
                challenge with a key minted on its first boot. A factory reset (or the USB settings
                wipe) changes that key legitimately — an ordinary firmware update does not. Forget the
                device under Settings (FORGET / SWITCH DEVICE…), reconnect, re-pair. If you didn't
                reset it, stop and check what's answering at that address before you trust it.
              </li>
            </ul>
          </Card>

          <Card id="t-display" title="Trouble: display and apps">
            <ul class="guide-list">
              <li>
                <strong>Panel dim?</strong> Brightness is capped at 150/255 on USB power — the cap is
                what keeps a full-white frame inside a 2&thinsp;A supply's budget.
              </li>
              <li>
                <strong>Panel resets at high brightness?</strong> Under-powered supply. Use a
                5&thinsp;V / 2&thinsp;A+ USB-C supply; the Dashboard's reset-reason tile confirms a
                brownout.
              </li>
              <li>
                <strong>An app only ever shows the clock?</strong> It has no usable data and will tell
                you why: type <code>diag</code> in the Dev console's command line (or copy its
                <em> App fetch diagnostics</em> curl) to see each app's last fetch verdict.
                <code> no-url</code> means set the source URL, <code>connect-failed</code> means the
                panel can't reach the source, <code>http-…</code> means the source answered with an
                error (check the path), <code>too-big</code> means the feed outgrew the fetch buffer
                (point the URL at the raw <code>aircraft.json</code>, not a dashboard page that wraps
                it), and <code>no-aircraft</code> or <code>bind-miss</code> mean the feed answered but
                held nothing to render.
              </li>
              <li>
                <strong>Flights list saves but the radar stays empty?</strong> The companion script on
                your always-on machine isn't running — the Apps page hands you its exact run command,
                and if you installed it as a service, <code>systemctl status dmx-flights</code> tells
                you what it's doing.
              </li>
              <li>
                <strong>Clock is wrong?</strong> Settings → timezone. The clock needs one internet
                moment after boot to sync; until then it shows <code>--:--</code> rather than a wrong
                time.
              </li>
            </ul>
          </Card>

          <Card id="t-mqtt" title="Trouble: MQTT and Home Assistant">
            <ul class="guide-list">
              <li>
                <strong>MQTT stays disabled?</strong> Turn on ENABLE MQTT <em>and</em> enter a broker
                host — an empty host deliberately keeps it off.
              </li>
              <li>
                <strong>MQTT shows an error?</strong> Check the broker address, port, and the
                per-device username, password, and ACL. TLS here is encrypted but not yet CA-verified —
                keep the path inside a network you trust.
              </li>
              <li>
                <strong>Home Assistant didn't discover the panel?</strong> Confirm Settings shows MQTT
                as connected, and that Home Assistant announces itself on the broker
                (<code>homeassistant/status</code> → <code>online</code>). The panel re-announces its
                entities every time Home Assistant restarts.
              </li>
            </ul>
          </Card>

          <Card id="t-usb" title="Trouble: USB recovery — the floor under everything">
            <p>
              The USB path is the floor: it always works and needs no token. Lost the token, or the
              panel is on a Wi-Fi you can't reach? The USB settings wipe in the manual's recovery
              chapter erases the panel's settings — no token, no Console — and it comes back as its
              setup hotspot. Dead or broken firmware? Double-press the reset button and the board
              shows up as a USB drive — drop a UF2 firmware file on it (the recovery chapter shows how
              to make one from a build) and it boots fresh. Panel dark, no hotspot, but the USB port
              shows up? Probably parked in download mode, not dead — the recovery chapter frees it
              with one command. Setup data is five minutes to recreate.
            </p>
            <p class="note">
              Flashing over the data-capable USB-C port with a serial monitor open fails with "port
              busy" — close the monitor first.
            </p>
          </Card>

          <Card id="deeper" title="Go deeper">
            <p>
              The full owner's manual — every chapter from unboxing to recovery — lives with the
              source:
              {" "}<a href={`${REPO}/blob/main/docs/MANUAL.md`} target="_blank" rel="noreferrer">docs/MANUAL.md</a>.
              The firmware, this Console, and the hardware files are all in the same repository
              {" "}(<a href={REPO} target="_blank" rel="noreferrer">{REPO.replace("https://", "")}</a>) —
              fork it and flash your own build. That's the point of a dev kit.
            </p>
            {transport.isMock && (
              <p class="note">You're in the demo right now — connect a real panel from the welcome screen to try all of this live.</p>
            )}
          </Card>
        </div>
      </div>
    </section>
  );
}
