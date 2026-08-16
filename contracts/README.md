# contracts/ — public interface contracts

This directory is the future owner of the DK-01's public interface
contracts ([ADR-0019](../docs/adr/ADR-0019-repo-restructure.md)):
REST (`/api/v1`), WebSocket (`/api/v1/stream`), MQTT, OTA, app bundle,
diagnostics, transport capability descriptors, and error formats.

**Today it holds drafts.** Nothing here is normative until the P2
contract-and-security freeze ([ROADMAP.md](../ROADMAP.md)). Until a
surface's draft lands here, [docs/FIRMWARE.md](../docs/FIRMWARE.md)
keeps the illustrative REST/WebSocket sketch; implementations must not
treat any draft as frozen.

## Current files

| File | Surface | Status |
|---|---|---|
| [rest.md](rest.md) | The complete `/api/v1` LAN surface: routes, auth, identity + pairing protocols, diagnostics schema, error shape, setup-mode surface | DRAFT |
| [mqtt.md](mqtt.md) | MQTT topic tree, envelope, Home Assistant discovery, broker setup | DRAFT |
| [layout.md](layout.md) | Declarative v1 JSON source, rows, bindings, and stale behavior | DRAFT |
| [ota.md](ota.md) | Today's authenticated `/update` upload + the gate M0 signed-manifest target | DRAFT |

Plus this README. Still unwritten (P2 freeze work, no empty
scaffolds — ADR-0019): the WebSocket stream (`/api/v1/stream`, not
yet implemented in firmware), transport capability descriptors
(ADR-0029), the `.dmapp` bundle format (gate M4), and a
machine-readable error registry.

## What arrives when

- **Now → P2**: drafts in prose, written clean-room from public
  specifications only
  ([ADR-0001](../docs/adr/ADR-0001-clean-room.md)), each citing its
  public sources.
- **At P2**: every surface freezes as machine-readable contracts —
  OpenAPI for REST, AsyncAPI for MQTT and the WebSocket stream, JSON
  Schema for payloads, plus the OTA, app-bundle, and diagnostics
  formats.
- **With the restructure (ADR-0019)**: generated Console and SDK
  clients, and CI drift checks that fail when generated clients, docs,
  simulator behavior, REST, WebSocket, and MQTT disagree
  ([docs/PRODUCTION-PLAN.md](../docs/PRODUCTION-PLAN.md), section 4).

Contract schemas and generated SDK clients freeze as Apache-2.0; the
directory's LICENSE and SPDX headers land with its first code or schema
artifact, not with prose drafts. Integrations are never forced into
GPL; the license flow is one-way — GPL code never enters this directory
([ADR-0010](../docs/adr/ADR-0010-license-scheme.md)).
