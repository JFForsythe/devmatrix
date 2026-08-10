// SPDX-License-Identifier: GPL-3.0-or-later
import { render } from "preact";
import { useEffect, useState } from "preact/hooks";
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

function routeFromHash(): Route {
  const candidate = window.location.hash.replace(/^#\/?/, "");
  return views.some((view) => view.route === candidate)
    ? (candidate as Route)
    : "dashboard";
}

function App() {
  const [activeRoute, setActiveRoute] = useState<Route>(routeFromHash);

  useEffect(() => {
    const updateRoute = () => setActiveRoute(routeFromHash());

    if (!window.location.hash) {
      window.history.replaceState(null, "", "#/dashboard");
    }

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
          <span>
            <strong>DEVMATRIX</strong>
            <small>CONSOLE</small>
          </span>
        </div>

        <nav aria-label="Console views">
          {views.map((view) => (
            <a
              href={`#/${view.route}`}
              aria-current={view.route === activeRoute ? "page" : undefined}
            >
              <span class="nav-pixel" aria-hidden="true" />
              {view.label}
            </a>
          ))}
        </nav>

        <p class="build-label">CONSOLE SCAFFOLD</p>
      </aside>

      <main class="main">
        <header class="topbar">
          <span>Console</span>
          <span aria-hidden="true">/</span>
          <strong>{activeView.label}</strong>
        </header>

        <section class="placeholder" aria-labelledby="view-title">
          <p class="eyebrow">VIEW PLACEHOLDER</p>
          <h1 id="view-title">{activeView.label}</h1>
          <p>This route is ready for a future view port. No product behavior is implemented yet.</p>
        </section>
      </main>
    </div>
  );
}

render(<App />, document.getElementById("app")!);
