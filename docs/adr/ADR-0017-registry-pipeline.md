# ADR-0017 — App Registry pipeline

**Status:** Accepted · 2026-08-07

## Context

M4 ships downloadable `.dmapp` apps and a curated Registry
(docs/PRODUCTION-PLAN.md, adopted by ADR-0009). Distribution must
survive author deletions, CI runner drift, and Registry or GitHub
outages, and a device must never install anything it cannot verify by
itself. This records the pipeline design; none of it is implemented.

## Decision

A `.dmapp` is a deterministic ZIP: pinned packing tool, fixed
timestamps via
[SOURCE_DATE_EPOCH](https://reproducible-builds.org/docs/source-date-epoch/),
sorted entry order, stripped extra fields, and fixed permissions,
verified by a CI double-build byte-compare before signing — GitHub
runner-image drift breaks byte-identity otherwise.

Publishing flow:

1. Author forks the public app template.
2. GitHub Actions lint, test in the simulator, validate permissions,
   build deterministically, generate SBOM/hash/provenance, and publish
   an immutable GitHub Release.
3. Author submits a curated Registry PR referencing the immutable asset
   and its SHA-256.
4. Registry CI validates ownership, license, compatibility, tests,
   permissions, and bundle safety.
5. Accepted packages are copied into a content-addressed Registry
   release, so author deletion cannot break installs.
6. The static Registry publishes signed, rollback-resistant metadata.

The Console shows provenance, permissions, and resource requests before
installation. The device independently verifies metadata, digest,
limits, and compatibility; it stages, smoke-tests, atomically
activates, and retains the previous version. Updates require manual
owner approval. Sideload is always allowed, with an explicit owner-risk
warning. V1 supports public GitHub Releases and local drag/drop;
private-repository OAuth is deferred.

## Consequences

The Registry is static files plus CI — no standing compute (ADR-0016) —
and it is never trusted alone: device-side verification is the real
gate, so a compromised Registry cannot push silent updates. Installed
apps keep working through Registry or GitHub outages (local-first,
ADR-0003). Content addressing duplicates accepted bundles; storage is
cheap, broken installs are not. Curation is a standing review burden,
accepted at 50-unit scale. Implementation, and the hostile-input
fuzzing that must accompany it, lands at M4.
