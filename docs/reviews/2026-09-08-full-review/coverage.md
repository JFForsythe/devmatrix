# Coverage manifest

Baseline: `180f0572edebe133c7e7f22bf5b2c962dfee7f4b` — **156 tracked paths**.

This accounts for every tracked file in the public checkout at the start of
the review. Source review, artifact verification, and reading dated evidence
are different kinds of coverage; none claims every runtime path was exercised.
Untracked build outputs, installed dependencies, private records, other repos,
and every historical Git object are outside this manifest. The new review
files are the deliverable, not part of the baseline count.

| Baseline path | Review area | Method |
|---|---|---|
| [.claude/settings.json](../../../.claude/settings.json) | Root | Product/governance/configuration review |
| [.githooks/pre-commit](../../../.githooks/pre-commit) | Root | Product/governance/configuration review |
| [.github/dependabot.yml](../../../.github/dependabot.yml) | Root | Product/governance/configuration review |
| [.github/pull_request_template.md](../../../.github/pull_request_template.md) | Root | Product/governance/configuration review |
| [.github/workflows/ci.yml](../../../.github/workflows/ci.yml) | Root | Product/governance/configuration review |
| [.gitignore](../../../.gitignore) | Root | Product/governance/configuration review |
| [.node-version](../../../.node-version) | Root | Product/governance/configuration review |
| [AGENTS.md](../../../AGENTS.md) | Root | Product/governance/configuration review |
| [CLAUDE.md](../../../CLAUDE.md) | Root | Product/governance/configuration review |
| [LICENSE](../../../LICENSE) | Root | Standard license identified; no legal opinion |
| [Makefile](../../../Makefile) | Root | Product/governance/configuration review |
| [PLAN.md](../../../PLAN.md) | Root | Product/governance/configuration review |
| [README.md](../../../README.md) | Root | Product/governance/configuration review |
| [ROADMAP.md](../../../ROADMAP.md) | Root | Product/governance/configuration review |
| [contracts/README.md](../../../contracts/README.md) | Firmware/contracts | Source or contract review; see firmware report |
| [contracts/layout.md](../../../contracts/layout.md) | Firmware/contracts | Source or contract review; see firmware report |
| [contracts/mqtt.md](../../../contracts/mqtt.md) | Firmware/contracts | Source or contract review; see firmware report |
| [contracts/ota.md](../../../contracts/ota.md) | Firmware/contracts | Source or contract review; see firmware report |
| [contracts/rest.md](../../../contracts/rest.md) | Firmware/contracts | Source or contract review; see firmware report |
| [docs/FIRMWARE.md](../../../docs/FIRMWARE.md) | Firmware/contracts | Source or contract review; see firmware report |
| [docs/GLOSSARY.md](../../../docs/GLOSSARY.md) | Root | Product/governance/configuration review |
| [docs/MANUAL.md](../../../docs/MANUAL.md) | Root | Product/governance/configuration review |
| [docs/MODES.md](../../../docs/MODES.md) | Root | Product/governance/configuration review |
| [docs/OPERATIONS.md](../../../docs/OPERATIONS.md) | Examples/hardware/ops | Source/procedure review; hardware records are historical evidence |
| [docs/PORTAL.md](../../../docs/PORTAL.md) | Console | Source, build, UX and documentation review |
| [docs/PRODUCTION-PLAN.md](../../../docs/PRODUCTION-PLAN.md) | Root | Product/governance/configuration review |
| [docs/SECURITY.md](../../../docs/SECURITY.md) | Firmware/contracts | Source or contract review; see firmware report |
| [docs/USER-STORY.md](../../../docs/USER-STORY.md) | Root | Product/governance/configuration review |
| [docs/VISION.md](../../../docs/VISION.md) | Root | Product/governance/configuration review |
| [docs/adr/ADR-0001-clean-room.md](../../../docs/adr/ADR-0001-clean-room.md) | Root + relevant technical area | Decision/supersession review; accepted ADR unchanged |
| [docs/adr/ADR-0002-portal-first.md](../../../docs/adr/ADR-0002-portal-first.md) | Root + relevant technical area | Decision/supersession review; accepted ADR unchanged |
| [docs/adr/ADR-0003-one-console-two-modes.md](../../../docs/adr/ADR-0003-one-console-two-modes.md) | Root + relevant technical area | Decision/supersession review; accepted ADR unchanged |
| [docs/adr/ADR-0004-passkeys-first.md](../../../docs/adr/ADR-0004-passkeys-first.md) | Root + relevant technical area | Decision/supersession review; accepted ADR unchanged |
| [docs/adr/ADR-0005-prototype-constraints.md](../../../docs/adr/ADR-0005-prototype-constraints.md) | Root + relevant technical area | Decision/supersession review; accepted ADR unchanged |
| [docs/adr/ADR-0006-user-root-of-trust.md](../../../docs/adr/ADR-0006-user-root-of-trust.md) | Root + relevant technical area | Decision/supersession review; accepted ADR unchanged |
| [docs/adr/ADR-0007-local-free-cloud-paid.md](../../../docs/adr/ADR-0007-local-free-cloud-paid.md) | Root + relevant technical area | Decision/supersession review; accepted ADR unchanged |
| [docs/adr/ADR-0008-device-local-owner-session.md](../../../docs/adr/ADR-0008-device-local-owner-session.md) | Root + relevant technical area | Decision/supersession review; accepted ADR unchanged |
| [docs/adr/ADR-0009-adopt-production-plan.md](../../../docs/adr/ADR-0009-adopt-production-plan.md) | Root + relevant technical area | Decision/supersession review; accepted ADR unchanged |
| [docs/adr/ADR-0010-license-scheme.md](../../../docs/adr/ADR-0010-license-scheme.md) | Root + relevant technical area | Decision/supersession review; accepted ADR unchanged |
| [docs/adr/ADR-0011-us-launch-first-run.md](../../../docs/adr/ADR-0011-us-launch-first-run.md) | Root + relevant technical area | Decision/supersession review; accepted ADR unchanged |
| [docs/adr/ADR-0012-matrixportal-production-intent.md](../../../docs/adr/ADR-0012-matrixportal-production-intent.md) | Root + relevant technical area | Decision/supersession review; accepted ADR unchanged |
| [docs/adr/ADR-0013-arduino-cli-protomatter-toolchain.md](../../../docs/adr/ADR-0013-arduino-cli-protomatter-toolchain.md) | Root + relevant technical area | Decision/supersession review; accepted ADR unchanged |
| [docs/adr/ADR-0014-console-production-stack.md](../../../docs/adr/ADR-0014-console-production-stack.md) | Root + relevant technical area | Decision/supersession review; accepted ADR unchanged |
| [docs/adr/ADR-0015-official-app-data-providers.md](../../../docs/adr/ADR-0015-official-app-data-providers.md) | Root + relevant technical area | Decision/supersession review; accepted ADR unchanged |
| [docs/adr/ADR-0016-static-hosting-cloudflare.md](../../../docs/adr/ADR-0016-static-hosting-cloudflare.md) | Root + relevant technical area | Decision/supersession review; accepted ADR unchanged |
| [docs/adr/ADR-0017-registry-pipeline.md](../../../docs/adr/ADR-0017-registry-pipeline.md) | Root + relevant technical area | Decision/supersession review; accepted ADR unchanged |
| [docs/adr/ADR-0018-returns-and-warranty.md](../../../docs/adr/ADR-0018-returns-and-warranty.md) | Root + relevant technical area | Decision/supersession review; accepted ADR unchanged |
| [docs/adr/ADR-0019-repo-restructure.md](../../../docs/adr/ADR-0019-repo-restructure.md) | Root + relevant technical area | Decision/supersession review; accepted ADR unchanged |
| [docs/adr/ADR-0020-browser-support-matrix.md](../../../docs/adr/ADR-0020-browser-support-matrix.md) | Root + relevant technical area | Decision/supersession review; accepted ADR unchanged |
| [docs/adr/ADR-0021-two-layer-trust-model.md](../../../docs/adr/ADR-0021-two-layer-trust-model.md) | Root + relevant technical area | Decision/supersession review; accepted ADR unchanged |
| [docs/adr/ADR-0022-clean-room-enforcement.md](../../../docs/adr/ADR-0022-clean-room-enforcement.md) | Root + relevant technical area | Decision/supersession review; accepted ADR unchanged |
| [docs/adr/ADR-0023-clean-room-rescope.md](../../../docs/adr/ADR-0023-clean-room-rescope.md) | Root + relevant technical area | Decision/supersession review; accepted ADR unchanged |
| [docs/adr/ADR-0024-living-firmware-tree.md](../../../docs/adr/ADR-0024-living-firmware-tree.md) | Root + relevant technical area | Decision/supersession review; accepted ADR unchanged |
| [docs/adr/ADR-0025-hosted-console-domain.md](../../../docs/adr/ADR-0025-hosted-console-domain.md) | Root + relevant technical area | Decision/supersession review; accepted ADR unchanged |
| [docs/adr/ADR-0026-three-tier-app-model.md](../../../docs/adr/ADR-0026-three-tier-app-model.md) | Root + relevant technical area | Decision/supersession review; accepted ADR unchanged |
| [docs/adr/ADR-0027-one-console-codebase.md](../../../docs/adr/ADR-0027-one-console-codebase.md) | Root + relevant technical area | Decision/supersession review; accepted ADR unchanged |
| [docs/adr/ADR-0028-mqtt-stack.md](../../../docs/adr/ADR-0028-mqtt-stack.md) | Root + relevant technical area | Decision/supersession review; accepted ADR unchanged |
| [docs/adr/ADR-0029-layered-display-api.md](../../../docs/adr/ADR-0029-layered-display-api.md) | Root + relevant technical area | Decision/supersession review; accepted ADR unchanged |
| [docs/adr/ADR-0030-pixlet-bridge.md](../../../docs/adr/ADR-0030-pixlet-bridge.md) | Root + relevant technical area | Decision/supersession review; accepted ADR unchanged |
| [docs/adr/ADR-0031-browser-to-device-transport.md](../../../docs/adr/ADR-0031-browser-to-device-transport.md) | Root + relevant technical area | Decision/supersession review; accepted ADR unchanged |
| [docs/adr/ADR-0032-no-device-initiated-discovery.md](../../../docs/adr/ADR-0032-no-device-initiated-discovery.md) | Root + relevant technical area | Decision/supersession review; accepted ADR unchanged |
| [docs/adr/ADR-0033-demand-driven-cloud-and-support.md](../../../docs/adr/ADR-0033-demand-driven-cloud-and-support.md) | Root + relevant technical area | Decision/supersession review; accepted ADR unchanged |
| [docs/adr/ADR-0034-vercel-pro-hosting.md](../../../docs/adr/ADR-0034-vercel-pro-hosting.md) | Root + relevant technical area | Decision/supersession review; accepted ADR unchanged |
| [docs/adr/README.md](../../../docs/adr/README.md) | Root + relevant technical area | Decision/supersession review; accepted ADR unchanged |
| [docs/reviews/2026-08-16-production-readiness/00-scope-and-method.md](../../../docs/reviews/2026-08-16-production-readiness/00-scope-and-method.md) | Corresponding review areas | Historical assessment read; findings rechecked in current source |
| [docs/reviews/2026-08-16-production-readiness/01-governance-repo-health.md](../../../docs/reviews/2026-08-16-production-readiness/01-governance-repo-health.md) | Corresponding review areas | Historical assessment read; findings rechecked in current source |
| [docs/reviews/2026-08-16-production-readiness/02-product-docs-truth-map.md](../../../docs/reviews/2026-08-16-production-readiness/02-product-docs-truth-map.md) | Corresponding review areas | Historical assessment read; findings rechecked in current source |
| [docs/reviews/2026-08-16-production-readiness/03-firmware-deep-dive.md](../../../docs/reviews/2026-08-16-production-readiness/03-firmware-deep-dive.md) | Corresponding review areas | Historical assessment read; findings rechecked in current source |
| [docs/reviews/2026-08-16-production-readiness/04-console-deep-dive.md](../../../docs/reviews/2026-08-16-production-readiness/04-console-deep-dive.md) | Corresponding review areas | Historical assessment read; findings rechecked in current source |
| [docs/reviews/2026-08-16-production-readiness/05-contracts-and-examples.md](../../../docs/reviews/2026-08-16-production-readiness/05-contracts-and-examples.md) | Corresponding review areas | Historical assessment read; findings rechecked in current source |
| [docs/reviews/2026-08-16-production-readiness/06-security-audit.md](../../../docs/reviews/2026-08-16-production-readiness/06-security-audit.md) | Corresponding review areas | Historical assessment read; findings rechecked in current source |
| [docs/reviews/2026-08-16-production-readiness/07-hardware-and-gate-evidence.md](../../../docs/reviews/2026-08-16-production-readiness/07-hardware-and-gate-evidence.md) | Corresponding review areas | Historical assessment read; findings rechecked in current source |
| [docs/reviews/2026-08-16-production-readiness/08-ops-release-pipeline.md](../../../docs/reviews/2026-08-16-production-readiness/08-ops-release-pipeline.md) | Corresponding review areas | Historical assessment read; findings rechecked in current source |
| [docs/reviews/2026-08-16-production-readiness/09-gate-ladder-assessment.md](../../../docs/reviews/2026-08-16-production-readiness/09-gate-ladder-assessment.md) | Corresponding review areas | Historical assessment read; findings rechecked in current source |
| [docs/reviews/2026-08-16-production-readiness/10-findings-and-plan.md](../../../docs/reviews/2026-08-16-production-readiness/10-findings-and-plan.md) | Corresponding review areas | Historical assessment read; findings rechecked in current source |
| [docs/reviews/2026-08-16-production-readiness/README.md](../../../docs/reviews/2026-08-16-production-readiness/README.md) | Corresponding review areas | Historical assessment read; findings rechecked in current source |
| [docs/reviews/2026-08-16-production-readiness/TODO.md](../../../docs/reviews/2026-08-16-production-readiness/TODO.md) | Corresponding review areas | Historical assessment read; findings rechecked in current source |
| [examples/README.md](../../../examples/README.md) | Examples/hardware/ops | Source/procedure review; hardware records are historical evidence |
| [examples/dmx-top.mjs](../../../examples/dmx-top.mjs) | Examples/hardware/ops | Source/procedure review; hardware records are historical evidence |
| [examples/flights-overhead.mjs](../../../examples/flights-overhead.mjs) | Examples/hardware/ops | Source/procedure review; hardware records are historical evidence |
| [examples/install-flights.mjs](../../../examples/install-flights.mjs) | Examples/hardware/ops | Source/procedure review; hardware records are historical evidence |
| [examples/install-pixlet-bridge.mjs](../../../examples/install-pixlet-bridge.mjs) | Examples/hardware/ops | Source/procedure review; hardware records are historical evidence |
| [examples/pixlet-bridge/README.md](../../../examples/pixlet-bridge/README.md) | Examples/hardware/ops | Source/procedure review; hardware records are historical evidence |
| [examples/pixlet-bridge/bridge.config.json](../../../examples/pixlet-bridge/bridge.config.json) | Examples/hardware/ops | Source/procedure review; hardware records are historical evidence |
| [examples/pixlet-bridge/bridge.mjs](../../../examples/pixlet-bridge/bridge.mjs) | Examples/hardware/ops | Source/procedure review; hardware records are historical evidence |
| [examples/pixlet-bridge/package-lock.json](../../../examples/pixlet-bridge/package-lock.json) | Examples/hardware/ops | Source/procedure review; hardware records are historical evidence |
| [examples/pixlet-bridge/package.json](../../../examples/pixlet-bridge/package.json) | Examples/hardware/ops | Source/procedure review; hardware records are historical evidence |
| [examples/pixlet-manager/app.js](../../../examples/pixlet-manager/app.js) | Examples/hardware/ops | Source/procedure review; hardware records are historical evidence |
| [examples/pixlet-manager/index.html](../../../examples/pixlet-manager/index.html) | Examples/hardware/ops | Source/procedure review; hardware records are historical evidence |
| [examples/pixlet-manager/lib.mjs](../../../examples/pixlet-manager/lib.mjs) | Examples/hardware/ops | Source/procedure review; hardware records are historical evidence |
| [examples/pixlet-manager/manager.mjs](../../../examples/pixlet-manager/manager.mjs) | Examples/hardware/ops | Source/procedure review; hardware records are historical evidence |
| [examples/pixlet-manager/styles.css](../../../examples/pixlet-manager/styles.css) | Examples/hardware/ops | Source/procedure review; hardware records are historical evidence |
| [examples/setup-pixlet.mjs](../../../examples/setup-pixlet.mjs) | Examples/hardware/ops | Source/procedure review; hardware records are historical evidence |
| [firmware/dk01/README.md](../../../firmware/dk01/README.md) | Firmware/contracts | Source or contract review; see firmware report |
| [firmware/dk01/apps_builtin.h](../../../firmware/dk01/apps_builtin.h) | Firmware/contracts | Source or contract review; see firmware report |
| [firmware/dk01/apps_engine.h](../../../firmware/dk01/apps_engine.h) | Firmware/contracts | Source or contract review; see firmware report |
| [firmware/dk01/dk01.ino](../../../firmware/dk01/dk01.ino) | Firmware/contracts | Source or contract review; see firmware report |
| [firmware/dk01/mqtt_client.h](../../../firmware/dk01/mqtt_client.h) | Firmware/contracts | Source or contract review; see firmware report |
| [firmware/dk01/web_console.h](../../../firmware/dk01/web_console.h) | Firmware + Console | Generated output rebuilt and compared |
| [firmware/dk01/web_setup.h](../../../firmware/dk01/web_setup.h) | Firmware/contracts | Source or contract review; see firmware report |
| [hardware/README.md](../../../hardware/README.md) | Examples/hardware/ops | Source/procedure review; hardware records are historical evidence |
| [hardware/evidence/2026-08-07-board-alone-bringup.md](../../../hardware/evidence/2026-08-07-board-alone-bringup.md) | Examples/hardware/ops | Source/procedure review; hardware records are historical evidence |
| [hardware/evidence/2026-08-07-integrated-firmware-ota.md](../../../hardware/evidence/2026-08-07-integrated-firmware-ota.md) | Examples/hardware/ops | Source/procedure review; hardware records are historical evidence |
| [hardware/evidence/2026-08-07-panel-and-local-firmware.md](../../../hardware/evidence/2026-08-07-panel-and-local-firmware.md) | Examples/hardware/ops | Source/procedure review; hardware records are historical evidence |
| [hardware/evidence/2026-08-12-browser-transport-spike.md](../../../hardware/evidence/2026-08-12-browser-transport-spike.md) | Examples/hardware/ops | Source/procedure review; hardware records are historical evidence |
| [hardware/evidence/2026-08-12-console-parity-verification.md](../../../hardware/evidence/2026-08-12-console-parity-verification.md) | Examples/hardware/ops | Source/procedure review; hardware records are historical evidence |
| [hardware/evidence/2026-08-13-hosted-connect-verification.md](../../../hardware/evidence/2026-08-13-hosted-connect-verification.md) | Examples/hardware/ops | Source/procedure review; hardware records are historical evidence |
| [hardware/evidence/2026-08-16-v0120-ota-and-hardening-verification.md](../../../hardware/evidence/2026-08-16-v0120-ota-and-hardening-verification.md) | Examples/hardware/ops | Source/procedure review; hardware records are historical evidence |
| [hardware/evidence/2026-08-17-pixlet-bridge-live-proof.md](../../../hardware/evidence/2026-08-17-pixlet-bridge-live-proof.md) | Examples/hardware/ops | Source/procedure review; hardware records are historical evidence |
| [hardware/evidence/2026-08-24-mp-qual-01-production-intake.md](../../../hardware/evidence/2026-08-24-mp-qual-01-production-intake.md) | Examples/hardware/ops | Source/procedure review; hardware records are historical evidence |
| [hardware/evidence/2026-08-26-r0-first-ship-bench.md](../../../hardware/evidence/2026-08-26-r0-first-ship-bench.md) | Examples/hardware/ops | Source/procedure review; hardware records are historical evidence |
| [hardware/insert/card-template.html](../../../hardware/insert/card-template.html) | Examples/hardware/ops | Source/procedure review; hardware records are historical evidence |
| [hardware/insert/make-card.sh](../../../hardware/insert/make-card.sh) | Examples/hardware/ops | Source/procedure review; hardware records are historical evidence |
| [hardware/insert/quick-start-card.html](../../../hardware/insert/quick-start-card.html) | Examples/hardware/ops | Source/procedure review; hardware records are historical evidence |
| [hardware/insert/welcome-receipt.html](../../../hardware/insert/welcome-receipt.html) | Examples/hardware/ops | Source/procedure review; hardware records are historical evidence |
| [hardware/insert/welcome-ticket.html](../../../hardware/insert/welcome-ticket.html) | Examples/hardware/ops | Source/procedure review; hardware records are historical evidence |
| [hardware/procedures/bench-week.md](../../../hardware/procedures/bench-week.md) | Examples/hardware/ops | Source/procedure review; hardware records are historical evidence |
| [hardware/procedures/flash-station.sh](../../../hardware/procedures/flash-station.sh) | Examples/hardware/ops | Source/procedure review; hardware records are historical evidence |
| [portal/README.md](../../../portal/README.md) | Console | Source, build, UX and documentation review |
| [portal/console/.gitignore](../../../portal/console/.gitignore) | Console | Source, build, UX and documentation review |
| [portal/console/README.md](../../../portal/console/README.md) | Console | Source, build, UX and documentation review |
| [portal/console/dist-hosted/index.html](../../../portal/console/dist-hosted/index.html) | Firmware + Console | Generated output rebuilt and compared |
| [portal/console/index.html](../../../portal/console/index.html) | Console | Source, build, UX and documentation review |
| [portal/console/package-lock.json](../../../portal/console/package-lock.json) | Console | Source, build, UX and documentation review |
| [portal/console/package.json](../../../portal/console/package.json) | Console | Source, build, UX and documentation review |
| [portal/console/scripts/gen-header.mjs](../../../portal/console/scripts/gen-header.mjs) | Console | Source, build, UX and documentation review |
| [portal/console/src/PairingFlow.tsx](../../../portal/console/src/PairingFlow.tsx) | Console | Source, build, UX and documentation review |
| [portal/console/src/components.tsx](../../../portal/console/src/components.tsx) | Console | Source, build, UX and documentation review |
| [portal/console/src/frame.ts](../../../portal/console/src/frame.ts) | Console | Source, build, UX and documentation review |
| [portal/console/src/identity.ts](../../../portal/console/src/identity.ts) | Console | Source, build, UX and documentation review |
| [portal/console/src/layouts.ts](../../../portal/console/src/layouts.ts) | Console | Source, build, UX and documentation review |
| [portal/console/src/main.tsx](../../../portal/console/src/main.tsx) | Console | Source, build, UX and documentation review |
| [portal/console/src/mock.ts](../../../portal/console/src/mock.ts) | Console | Source, build, UX and documentation review |
| [portal/console/src/styles.css](../../../portal/console/src/styles.css) | Console | Source, build, UX and documentation review |
| [portal/console/src/transport.ts](../../../portal/console/src/transport.ts) | Console | Source, build, UX and documentation review |
| [portal/console/src/types.ts](../../../portal/console/src/types.ts) | Console | Source, build, UX and documentation review |
| [portal/console/src/views/AppsView.tsx](../../../portal/console/src/views/AppsView.tsx) | Console | Source, build, UX and documentation review |
| [portal/console/src/views/DashboardView.tsx](../../../portal/console/src/views/DashboardView.tsx) | Console | Source, build, UX and documentation review |
| [portal/console/src/views/DeployView.tsx](../../../portal/console/src/views/DeployView.tsx) | Console | Source, build, UX and documentation review |
| [portal/console/src/views/DevConsoleView.tsx](../../../portal/console/src/views/DevConsoleView.tsx) | Console | Source, build, UX and documentation review |
| [portal/console/src/views/DevicesView.tsx](../../../portal/console/src/views/DevicesView.tsx) | Console | Source, build, UX and documentation review |
| [portal/console/src/views/GuideView.tsx](../../../portal/console/src/views/GuideView.tsx) | Console | Source, build, UX and documentation review |
| [portal/console/src/views/SecurityView.tsx](../../../portal/console/src/views/SecurityView.tsx) | Console | Source, build, UX and documentation review |
| [portal/console/src/views/SettingsView.tsx](../../../portal/console/src/views/SettingsView.tsx) | Console | Source, build, UX and documentation review |
| [portal/console/src/views/WelcomeView.tsx](../../../portal/console/src/views/WelcomeView.tsx) | Console | Source, build, UX and documentation review |
| [portal/console/tsconfig.json](../../../portal/console/tsconfig.json) | Console | Source, build, UX and documentation review |
| [portal/console/vite.config.ts](../../../portal/console/vite.config.ts) | Console | Source, build, UX and documentation review |
| [portal/prototype/.gitignore](../../../portal/prototype/.gitignore) | Console | Source, build, UX and documentation review |
| [portal/prototype/index.html](../../../portal/prototype/index.html) | Console | Source, build, UX and documentation review |
| [scripts/check-repo.mjs](../../../scripts/check-repo.mjs) | Root + independent Console reviewer | Implementation and all tooling tests reviewed |
| [scripts/check-repo.test.mjs](../../../scripts/check-repo.test.mjs) | Root + independent Console reviewer | Implementation and all tooling tests reviewed |
| [scripts/ship.mjs](../../../scripts/ship.mjs) | Root + independent Console reviewer | Implementation and all tooling tests reviewed |
| [scripts/ship.test.mjs](../../../scripts/ship.test.mjs) | Root + independent Console reviewer | Implementation and all tooling tests reviewed |
| [scripts/verify-live.mjs](../../../scripts/verify-live.mjs) | Root + independent Console reviewer | Implementation and all tooling tests reviewed |
| [scripts/verify-live.test.mjs](../../../scripts/verify-live.test.mjs) | Root + independent Console reviewer | Implementation and all tooling tests reviewed |
| [vercel.json](../../../vercel.json) | Root | Product/governance/configuration review |
