# Production-readiness review — 2026-08-16

Full-depth review of everything between commit `444691f` and a
sellable DK-01, saved step by step. Start with
[10-findings-and-plan.md](10-findings-and-plan.md) (the rollup and
phased plan) and [09-gate-ladder-assessment.md](09-gate-ladder-assessment.md)
(the P0→GA scorecard); the numbered steps hold the per-area evidence.

| Step | Area |
|---|---|
| [00](00-scope-and-method.md) | Scope, method, baseline, severity scale |
| [01](01-governance-repo-health.md) | Governance, operating contract, repo health |
| [02](02-product-docs-truth-map.md) | Owner docs, truth map, ADR-wins (17 findings) |
| [03](03-firmware-deep-dive.md) | Firmware line-by-line: security, invariants, API inventory |
| [04](04-console-deep-dive.md) | Console: security, build integrity, parity |
| [05](05-contracts-and-examples.md) | Contracts vs firmware; examples and installers |
| [06](06-security-audit.md) | Threat model vs implemented reality |
| [07](07-hardware-and-gate-evidence.md) | Bench evidence vs P1/M0 acceptance |
| [08](08-ops-release-pipeline.md) | ship/verify-live/CI chain, live-state checks |
| [09](09-gate-ladder-assessment.md) | Gate scorecard P0→GA |
| [10](10-findings-and-plan.md) | Master ledger (16 P1s) + the plan in leverage order |

Point-in-time audit evidence, like `hardware/evidence/` — findings
reference the owner docs but own nothing; if a statement here and an
owner doc disagree, the owner doc (or a newer ADR) wins.
