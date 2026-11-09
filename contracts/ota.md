# OTA contract — draft

**Status: DRAFT — non-normative until the P2 freeze.** Documents the
update surface the firmware implements today, and the gate M0 target
it grows into (signed manifest OTA — docs/SECURITY.md owns the trust
model; [ROADMAP.md](../ROADMAP.md) owns the gate). Public sources:
[RFC 9110](https://www.rfc-editor.org/rfc/rfc9110) (HTTP
semantics), [RFC 8032](https://www.rfc-editor.org/rfc/rfc8032)
(Ed25519, for the M0 signature scheme).

## Partition layout (docs/FIRMWARE.md owns the budget)

Updates target the inactive app slot. The flash map, slot capacity and
TinyUF2 partition are owned by
[docs/FIRMWARE.md](../docs/FIRMWARE.md#hardware-budget-dk-01-8-mb-flash-2-mb-psram).
USB recovery instructions are in the
[firmware README](../firmware/dk01/README.md#usb-recovery-make-a-uf2).
Recovery acceptance remains a hardware gate, not a guarantee established by
the partition layout alone.

## Today: `POST /update` (authenticated multipart upload)

- One multipart file field carrying an app image (`.bin` from the
  documented build). The bearer token is checked when a file upload starts;
  the final handler consults the saved `otaAuthed` flag rather than checking
  the request again. A file upload without valid authorization does not begin
  a flash write. The current server invokes multipart upload callbacks before
  Host middleware, so that middleware is not an early OTA enforcement point.
- The image is validated by the platform's magic-byte and length
  checks only — **not signature-verified** (see
  [the current security posture](../docs/SECURITY.md#what-exists-today);
  closing this is M0).
- During the write the panel shows `UPDATING <n> KB / keep power on`;
  on success the response is `{"ok":true,"rebooting":true}` and the
  device reboots into the new slot. On failure:
  `500 {"error":"<platform error>"}` and the running image continues
  untouched (the inactive slot is simply left invalid).
- **No automatic rollback today.** The DK-01 boots through the board
  package's prebuilt TinyUF2 bootloader, and that bootloader is built without
  ESP-IDF app rollback: a new image is never held pending, and nothing returns
  the device to the previous slot by itself. If an uploaded image cannot serve
  the Console, recovery is the USB path above. This is read from the build
  inputs on 2026-11-09 (the TinyUF2 project's published build configuration
  and the bootloader binary the build flashes); it has not been measured on a
  board. The 0.12.8 revision of this file described a 30-second rollback
  window; that description was wrong.
- The application still calls `esp_ota_mark_app_valid_cancel_rollback()`
  after 30 seconds of loop operation, counted from the first loop pass, and
  retries a failed call up to five times with the result logged on serial.
  With the current bootloader this only records the slot as valid. It becomes
  a health check only with a rollback-capable bootloader, and then the sketch
  must also define `verifyRollbackLater()`, because the Arduino core otherwise
  confirms a pending image before `setup()` runs.
- Automatic rollback needs a rollback-capable bootloader or an
  application-level boot counter, plus health criteria stronger than loop
  uptime. That is M0 work, with bench evidence
  ([bench procedure](../hardware/procedures/bench-week.md), run 5).
  Do not infer rollback from the presence of two slots.

## Gate M0 target: signed manifest OTA (freezes at P2)

The shape the docs already promise (docs/SECURITY.md → Ceremonies →
OTA update), recorded here so the P2 freeze has a draft to edit:

1. **Manifest** — a static JSON document over HTTPS, self-hostable
   and mirrorable (Local-first: any mirror works; the Eject path sets
   a custom manifest URL). Per channel (`stable` | `beta` | `dev`):
   version, minimum-compatible version, image URL, image size,
   SHA-256, Ed25519 signature, release-notes URL, and an
   anti-rollback floor for security releases.
2. **Verification** — sha256 + signature against the device's
   **software trust set** (release key, plus any owner-enrolled key —
   ADR-0006/0008/0021). Owner-signed builds are exempt from the
   company floor; the exemption is enforced by the software updater
   with bootloader anti-rollback off (eFuse anti-rollback has no
   per-signer exemption — ADR-0021).
3. **Apply** — write to the inactive slot, boot-health check, N
   failures → automatic rollback, then the settings-migration hook.
4. The Console's Deploy view drives the same routes; channel
   selection and update history land with it (gate M1 per
   docs/MODES.md).

Exact manifest field names, the channel-selection route, and the
migration-hook contract are the P2 freeze deliverables for this file.
