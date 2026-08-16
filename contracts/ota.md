# OTA contract — draft

**Status: DRAFT — non-normative until the P2 freeze.** Documents the
update surface the firmware implements today, and the gate M0 target
it grows into (signed manifest OTA — docs/SECURITY.md owns the trust
model; [ROADMAP.md](../ROADMAP.md) owns the gate). Public sources:
[RFC 9110](https://www.rfc-editor.org/rfc/rfc9110) (multipart upload
semantics), [RFC 8032](https://www.rfc-editor.org/rfc/rfc8032)
(Ed25519, for the M0 signature scheme).

## Partition layout (docs/FIRMWARE.md owns the budget)

Two 2 MB app slots (`ota_0`/`ota_1`); updates always write the
**inactive** slot. A 256 KB TinyUF2 factory partition survives every
update and provides drag-and-drop USB recovery
(firmware/dk01/README.md → "USB recovery (make a UF2)"). A 3.7 MB
`ffat` data partition is reserved.

## Today: `POST /update` (authenticated multipart upload)

- One multipart file field carrying an app image (`.bin` from the
  documented build). Authorization is checked when the upload starts
  **and** again before the final response; an unauthorized upload is
  discarded without writing.
- The image is validated by the platform's magic-byte and length
  checks only — **not signature-verified** (disclosed in
  firmware/dk01/README.md → Honest limits; closing this is M0).
- During the write the panel shows `UPDATING <n> KB / keep power on`;
  on success the response is `{"ok":true,"rebooting":true}` and the
  device reboots into the new slot. On failure:
  `500 {"error":"<platform error>"}` and the running image continues
  untouched (the inactive slot is simply left invalid).
- Rollback machinery: the bootloader's app-rollback support is
  compiled in; a new image marks itself valid only after a healthy
  boot. The health signal and its test evidence are M0 acceptance
  work (hardware/procedures/bench-week.md, run 5) — until then treat
  rollback as designed-but-unproven, with TinyUF2 USB recovery as the
  floor.

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
