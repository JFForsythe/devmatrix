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
import { SecurityView } from "./views/SecurityView";
import { SettingsView } from "./views/SettingsView";
import "./styles.css";

const views = [
  { route: "dashboard", label: "dashboard" },
  { route: "devices", label: "devices" },
  { route: "apps", label: "apps" },
  { route: "deploy", label: "deploy" },
  { route: "devconsole", label: "dev console" },
  { route: "security", label: "security" },
  { route: "settings", label: "settings" },
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
  }
}

function App() {
  const [activeRoute, setActiveRoute] = useState<Route>(routeFromHash);
  const [pairing, setPairing] = useState(false);
  transport.setPairingListener(() => setPairing(true));

  useEffect(() => {
    const updateRoute = () => setActiveRoute(routeFromHash());
    if (!window.location.hash) window.history.replaceState(null, "", "#/dashboard");
    window.addEventListener("hashchange", updateRoute);
    updateRoute();
    return () => window.removeEventListener("hashchange", updateRoute);
  }, []);

  const activeView = views.find((view) => view.route === activeRoute)!;

  return (
    <div class="shell">
      <aside class="rail">
        <div class="brand" aria-label="Devmatrix Console">
          <span class="brand-mark" aria-hidden="true" />
          <span><strong>DEVMATRIX</strong><small>CONSOLE</small></span>
        </div>

        {transport.isMock && <span class="chip demo rail-demo">DEMO · MOCK DATA</span>}

        <nav aria-label="Console views">
          {views.map((view) => (
            <a href={`#/${view.route}`} aria-current={view.route === activeRoute ? "page" : undefined}>
              <span class="nav-pixel" aria-hidden="true" />
              {view.label}
            </a>
          ))}
        </nav>

        <div class="rail-footer">
          <span class={`chip ${transport.isMock ? "demo" : "ok"}`}>{transport.isMock ? "MOCK TRANSPORT" : "LIVE DEVICE"}</span>
          <small title={transport.address}>{transport.host}</small>
        </div>
      </aside>

      <main class="main">
        <header class="topbar">
          <span>Console</span><span aria-hidden="true">/</span><strong>{activeView.label}</strong>
          <span class="topbar-spacer" />
          <span class={`led ${transport.isMock ? "demo-led" : ""}`} aria-hidden="true" />
          <span>{transport.isMock ? "interactive demo" : transport.host}</span>
        </header>
        <ActiveView route={activeRoute} />
      </main>

      {pairing && <PairingFlow transport={transport} onClose={() => setPairing(false)} />}
    </div>
  );
}

render(<App />, document.getElementById("app")!);
