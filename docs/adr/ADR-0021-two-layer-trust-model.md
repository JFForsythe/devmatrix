# ADR-0021 — Two-layer trust model

**Status:** Accepted · 2026-08-07

## Context

docs/SECURITY.md and ADR-0006 describe one "trust set" that owners
join and factory reset wipes. ESP32-S3 hardware has no such thing:
its only verified-boot scheme is Secure Boot v2, which checks
RSA-3072-PSS digests in three one-way eFuse slots — burning and
revocation are permanent, with no erase path ([Espressif Secure Boot
v2](https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/security/secure-boot-v2.html)).
Ed25519 owner keys cannot live in those slots; left conflated, the
docs promise what eFuses cannot do.

## Decision

Adopt a two-layer trust model. This ADR refines ADR-0006 in prose;
ADR-0006 stands unedited, and nothing it states becomes false: its
ceremony, audit, and resale promises hold unchanged for the default
software-layer path, and the hardware path below is additive, opt-in,
and carries its own permanence caveat.

- **Hardware root of trust**: Secure Boot v2, RSA-3072-PSS only,
  three one-way eFuse digest slots, permanent revocation, no erase.
- **Software layer**: an Ed25519 OTA trust set — the release key plus
  an optional owner key — verified by the RSA-signed chain.
- The ADR-0006 ceremony enrolls into the **software layer** by
  default. "Factory reset wipes enrolled keys" is true only there,
  and invariant 5's "root of trust" wording is scoped to that layer.
- **Optional hardware-digest enrollment** deliberately deviates from
  Espressif's revoke-before-shipping guidance and is defensible only
  as a package: ship an unrevoked spare slot; keep Secure Download
  Mode enabled; make firmware-mediated burn behind the
  physical-presence hold the sole eFuse-write path; prohibit
  aggressive key revocation (it can brick); prove on sacrificial
  boards that the firmware path can burn the slot and ROM-serial
  paths cannot. A burned digest survives factory reset and resale.
- eFuse anti-rollback has no per-signer exemption, so the promised
  owner exemption from the version floor is enforced in the software
  updater with bootloader anti-rollback off — an owner image raising
  `secure_version` would raise the floor for official firmware too.
- Flash encryption has exactly two invariant-compatible options:
  (a) Secure Boot without release-mode flash encryption, or (b) flash
  encryption with the per-device key handed to the owner at
  provisioning, never escrowed. Burning `DIS_DOWNLOAD_MODE` is
  forbidden — it violates the never-brick/USB-recovery invariant.
- Browser recovery must be proven on hardened boards at P2: Secure
  Download Mode disables the flasher stub, and esptool-js has no
  no-stub mode — budget for contributing one.

## Consequences

docs/SECURITY.md now states which promise belongs to which layer;
permanence and resale caveats attach to the hardware path alone. P2
owns the sacrificial-board evidence. If secure boot, owner control,
and customer recovery cannot coexist on this chip, that is a
chip-family decision — never a silent weakening of either promise.
