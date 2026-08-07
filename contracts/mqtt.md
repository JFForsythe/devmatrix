# MQTT contract — draft

**Status: DRAFT — non-normative until the P2 freeze.** Designed from
public specifications only — the OASIS
[MQTT 3.1.1](https://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html)
and [MQTT 5.0](https://docs.oasis-open.org/mqtt/mqtt/v5.0/mqtt-v5.0.html)
standards and the public
[Home Assistant MQTT docs](https://www.home-assistant.io/integrations/mqtt/)
([ADR-0001](../docs/adr/ADR-0001-clean-room.md)). At the P2 freeze this
prose becomes AsyncAPI + JSON Schema in this directory
([README.md](README.md)); the firmware implementing it is an M2
deliverable ([ROADMAP.md](../ROADMAP.md)).

## Topic tree

The root namespace is `devmatrix/<serial>/`, where `<serial>` is the
device serial in `DMX-####-####` format
([docs/GLOSSARY.md](../docs/GLOSSARY.md)). Every example below uses the
canonical serial `DMX-4E71-0952`
([docs/USER-STORY.md](../docs/USER-STORY.md)).

| Topic | Publisher | Purpose |
|---|---|---|
| `devmatrix/DMX-4E71-0952/availability` | device (and broker LWT) | `online` / `offline`, retained |
| `devmatrix/DMX-4E71-0952/state/<resource>` | device | Last known state, retained — e.g. `state/display`, `state/health` |
| `devmatrix/DMX-4E71-0952/event/<kind>` | device | Transient occurrences, never retained — e.g. `event/button`, `event/app` |
| `devmatrix/DMX-4E71-0952/request/<verb>` | client | Commands; verbs are dot-namespaced in one topic level, e.g. `request/display.text` |
| `devmatrix/DMX-4E71-0952/response/<request-id>` | device | Exactly one response per request, correlated by the request's `id` |

## Message envelope

Every message body is versioned JSON:

```json
{"v": 1, "id": "<uuid>", "ts": "<RFC3339>", "expiry": 30, "payload": {}}
```

- `v` — envelope version; `1` for this draft.
- `id` — UUID unique to this message. A request's `id` names its
  response topic.
- `ts` — RFC 3339 UTC creation time.
- `expiry` — **requests only**: seconds after `ts` the request stays
  valid. The device drops an expired request unexecuted and answers
  the response topic with an error — a command must not fire long
  after its sender gave up, or replay when a broker delivers a queued
  session backlog.
- `payload` — resource-specific body. Field names, units, and ranges
  freeze as JSON Schema at P2.

One deliberate exception: `availability` carries the bare strings
`online` / `offline` with no envelope. The broker stores the will
message verbatim at connect time, so a truthful `ts` is impossible,
and Home Assistant expects plain availability payloads.

## QoS and retain guidance

| Topic class | Retain | QoS | Why |
|---|---|---|---|
| `availability` | yes | 1 | Registered as the LWT at connect; the broker publishes `offline` on ungraceful disconnect |
| `state/#` | yes | 1 | Latest value only; late subscribers catch up instantly |
| `event/#` | no | 0 | Transient by definition; a missed event must not replay later |
| `request/<verb>` | no | 1 | Never retain a request — a retained command re-fires for every new subscriber; `expiry` backstops queued duplicates |
| `response/<request-id>` | no | 1 | Correlated by topic; the requester unsubscribes after receipt |

QoS 2 is unused by design: the envelope `id` makes handlers idempotent
where it matters, at far lower cost on a small device.

## Worked examples

**Push text — the request/response round trip.** Subscribe to
`devmatrix/DMX-4E71-0952/response/+` (or the exact id below), then
publish to `devmatrix/DMX-4E71-0952/request/display.text`:

```json
{"v": 1, "id": "b3f1c9d2-8a45-4e6b-9c07-2d5e8f13a6b4",
 "ts": "2026-08-07T16:20:04Z", "expiry": 30,
 "payload": {"text": "SHIP IT"}}
```

The device answers on
`devmatrix/DMX-4E71-0952/response/b3f1c9d2-8a45-4e6b-9c07-2d5e8f13a6b4`:

```json
{"v": 1, "id": "7c2a4f8e-1d6b-4a3c-8e59-0f4b7d2c9a16",
 "ts": "2026-08-07T16:20:05Z", "payload": {"ok": true}}
```

Had the request arrived after `ts + expiry`, the same topic would carry
`{"ok": false, "error": "request-expired"}` and nothing would execute.

**Set brightness.** Publish to
`devmatrix/DMX-4E71-0952/request/display.brightness`:

```json
{"v": 1, "id": "4d81a7e0-52c3-47f9-b1d6-9e0a3c5f82b7",
 "ts": "2026-08-07T16:22:11Z", "expiry": 30,
 "payload": {"brightness": 120}}
```

Brightness uses the 0–255 Home Assistant light convention (draft; the
P2 schema decides finally). The device confirms on the response topic
and republishes the retained `state/display`.

**Health state.** Retained on
`devmatrix/DMX-4E71-0952/state/health`, republished on change and on a
slow heartbeat:

```json
{"v": 1, "id": "e5c92b04-7f18-4a6d-b3c0-1d8e4f7a2905",
 "ts": "2026-08-07T16:21:00Z",
 "payload": {"uptime_s": 86432, "heap_free_b": 118432,
             "rssi_dbm": -52, "temp_c": 41.2}}
```

## Home Assistant

The device announces itself with standard
[MQTT discovery](https://www.home-assistant.io/integrations/mqtt/)
config messages under the public `homeassistant/` prefix, declaring
light (brightness), scene, notify, and text entities whose availability
is wired to `devmatrix/DMX-4E71-0952/availability`. The device also
subscribes to Home Assistant's birth topic (`homeassistant/status`) and
republishes discovery after a Home Assistant restart. The M2 acceptance
is zero custom YAML: Home Assistant discovers and controls the device
with no manual configuration ([ROADMAP.md](../ROADMAP.md)).

## Broker configuration

The broker is always the owner's own, on their LAN —
[docs/SECURITY.md](../docs/SECURITY.md) owns that stance. The company
runs no broker, and a device never requires one to exist: MQTT is an
optional integration beside the always-present LAN API.

Use per-device credentials with ACLs scoped to the device's own tree.
[Mosquitto](https://mosquitto.org/man/mosquitto-conf-5.html) example:

```
# mosquitto.conf
password_file /etc/mosquitto/passwd
acl_file /etc/mosquitto/acl

# acl — one credential per device, scoped to its own tree
user DMX-4E71-0952
topic readwrite devmatrix/DMX-4E71-0952/#
topic write homeassistant/+/DMX-4E71-0952/config
topic read homeassistant/status
```

The device's MQTT username and password are entered — and rotated in
one click — on the Console's MQTT credentials page
([docs/SECURITY.md](../docs/SECURITY.md)).

## Console workbench

Browsers cannot open raw MQTT TCP connections, so the Console's
workbench MQTT pane ([docs/PORTAL.md](../docs/PORTAL.md) owns the pane
behavior) either requires the owner's broker to expose a WebSocket
listener —

```
listener 9001
protocol websockets
```

— or routes through the device's own MQTT client over the multiplexed
event socket. That choice is decided before the P2 freeze so the pane
cannot work in the simulator yet fail against real brokers.

## Reserved prefixes and apps

Everything under `devmatrix/<serial>/` shown above is device-reserved.
Apps declare their MQTT topic patterns in the `.dmapp` manifest; the
device rejects any app subscribe or publish outside its declared
patterns, and no app pattern may cover the reserved prefixes. Topic
pattern handling — wildcards, overlapping subscriptions, reserved
prefixes — is part of the gate M4 fuzzing corpus
([docs/PRODUCTION-PLAN.md](../docs/PRODUCTION-PLAN.md)).
