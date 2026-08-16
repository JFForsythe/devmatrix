// SPDX-License-Identifier: GPL-3.0-or-later
import { render } from "preact";
import { useEffect, useState } from "preact/hooks";
import { PairingFlow } from "./PairingFlow";
import { ConsoleTransport } from "./transport";
import { AppsView } from "./views/AppsView";
import { DashboardView } from "./views/DashboardView";
import { DeployView } from "./views/DeployView";
import { DevConsoleView } from "./views/DevConsoleView";
import { DevicesView } from "./views/DevicesView";
import { GuideView } from "./views/GuideView";
import { SecurityView } from "./views/SecurityView";
import { SettingsView } from "./views/SettingsView";
import { WelcomeView } from "./views/WelcomeView";
import "./styles.css";

const views = [
  { route: "dashboard", label: "dashboard" },
  { route: "devices", label: "devices" },
  { route: "apps", label: "apps" },
  { route: "deploy", label: "deploy" },
  { route: "devconsole", label: "dev console" },
  { route: "security", label: "security" },
  { route: "settings", label: "settings" },
  { route: "guide", label: "guide" },
] as const;

type Route = (typeof views)[number]["route"];

const transport = new ConsoleTransport();

function routeFromHash(): Route {
  const candidate = window.location.hash.replace(/^#\/?/, "");
  return views.some((view) => view.route === candidate) ? (candidate as Route) : "dashboard";
}

function ActiveView({ route }: { route: Route }) {
  switch (route) {
    case "dashboard": return <DashboardView transport={transport} />;
    case "devices": return <DevicesView transport={transport} />;
    case "apps": return <AppsView transport={transport} />;
    case "deploy": return <DeployView transport={transport} />;
    case "devconsole": return <DevConsoleView transport={transport} />;
    case "security": return <SecurityView transport={transport} />;
    case "settings": return <SettingsView transport={transport} />;
    case "guide": return <GuideView transport={transport} />;
  }
}

/** The mode chip docs/MODES.md promises: visible on every screen. */
function ModeChip({ online }: { online: boolean }) {
  if (transport.isMock) return <span class="chip demo">DEMO · SAMPLE DATA</span>;
  if (!online) return <span class="chip crit">OFFLINE · RETRYING</span>;
  return <span class="chip ok">LOCAL · FREE</span>;
}

function App() {
  const [activeRoute, setActiveRoute] = useState<Route>(routeFromHash);
  const [pairing, setPairing] = useState(false);
  const [online, setOnline] = useState(true);
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);

  // Registered during render on purpose: child-view effects (which can 401
  // and need the pairing modal) run before this component's own effects.
  transport.setPairingListener(() => setPairing(true));
  transport.setReachabilityListener(setOnline);

  useEffect(() => {
    const updateRoute = () => setActiveRoute(routeFromHash());
    if (!window.location.hash) window.history.replaceState(null, "", "#/dashboard");
    window.addEventListener("hashchange", updateRoute);
    updateRoute();
    return () => window.removeEventListener("hashchange", updateRoute);
  }, []);

  if (transport.needsWelcome && !welcomeDismissed) {
    return <WelcomeView transport={transport} onDemo={() => setWelcomeDismissed(true)} />;
  }

  const activeView = views.find((view) => view.route === activeRoute)!;

  return (
    <div class="shell">
      <aside class="rail">
        <div class="brand" aria-label="Devmatrix Console">
          <span class="brand-mark" aria-hidden="true" />
          <span><strong>DEVMATRIX</strong><small>CONSOLE</small></span>
        </div>

        {transport.isMock && <span class="chip demo rail-demo">DEMO · SAMPLE DATA</span>}

        <nav aria-label="Console views">
          {views.map((view) => (
            <a href={`#/${view.route}`} aria-current={view.route === activeRoute ? "page" : undefined}>
              <span class="nav-pixel" aria-hidden="true" />
              {view.label}
            </a>
          ))}
        </nav>

        <div class="rail-footer">
          <ModeChip online={online} />
          <small title={transport.address}>{transport.host}</small>
          {transport.needsWelcome && (
            <button class="text-button" type="button" onClick={() => setWelcomeDismissed(false)}>
              Connect your device →
            </button>
          )}
        </div>
      </aside>

      <main class="main">
        <header class="topbar">
          <span>Console</span><span aria-hidden="true">/</span><strong>{activeView.label}</strong>
          <span class="topbar-spacer" />
          <ModeChip online={online} />
          <span class={`led ${transport.isMock ? "demo-led" : online ? "" : "crit-led"}`} aria-hidden="true" />
          <span>{transport.isMock ? "interactive demo" : transport.host}</span>
        </header>
        <ActiveView route={activeRoute} />
      </main>

      {pairing && <PairingFlow transport={transport} onClose={() => setPairing(false)} />}
    </div>
  );
}

render(<App />, document.getElementById("app")!);
