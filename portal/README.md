# Console source and design reference

The Console is the web interface for your Dev Kit. For setup and everyday
use, start with the [Owner's Manual](../docs/MANUAL.md). For the current
feature inventory and the intended product experience, read the
[Console specification](../docs/PORTAL.md).

## Choose the right directory

| Directory | Purpose | Can it control hardware? |
|---|---|---|
| [`console/`](console/README.md) | Preact/TypeScript source for both the device-served and hosted Console; includes its own sample-data demo | Yes, when connected to a panel |
| [`prototype/index.html`](prototype/index.html) | Historical single-file design reference with simulated features | No; every device, service, update, and security ceremony is mocked |

Make product changes in `console/`. Its generated hosted HTML and firmware
header come from the same source; never hand-edit either artifact.
The [Console developer guide](console/README.md) explains the build and
verification commands. Deployment state and the public entry points belong
to [Operations](../docs/OPERATIONS.md#hosting-today).

## Explore the design reference

From the repository root:

```sh
make portal
```

Open `http://localhost:8787`, or open `prototype/index.html` directly. No
dependency installation is needed. The prototype uses local fonts, inline
CSS and JavaScript, and in-memory mock state. Its theme and workbench
preferences persist in this browser; device changes do not survive reloads.

Useful design examples include the simulated first-pixel flow, Dashboard
Mirror, keyboard search (`Cmd/Ctrl+K`), movable developer panes, and the
offline treatment for Guest Loft. These illustrate design goals; their
presence here does not establish that firmware or the current Console
implements them. In particular, the prototype's HTTPS examples, simulated
button ceremony, fleet, Registry, signed updates, and rollback history are
not instructions for operating a real panel.

Keep this reference static, dependency-free, and mock-only. The retirement
rule lives in [ADR-0027](../docs/adr/ADR-0027-one-console-codebase.md), and
the required demo identifiers live in the
[canonical user story](../docs/USER-STORY.md).
