## Summary

Describe the user-visible or repository behavior that changed and why.

## Source of truth

Name the owner document and any new or superseding ADR involved. Use `None`
only when no product fact or decision changed.

## Verification

- [ ] `make check` passes from the repository root.
- [ ] I reviewed the exact changed-file diff and excluded unrelated files.
- [ ] Owner documentation and canonical mock identifiers remain aligned.
- [ ] Accepted ADRs were not rewritten; changed decisions use a new ADR.
- [ ] The prototype remains static, dependency-free, mock-only, and free of
      runtime network calls.
- [ ] No closed-product code, logic, schemas, topics, or identifiers enter
      the repository; the clean-room boundary holds (ADR-0001 and ADR-0022,
      re-scoped by ADR-0023).
- [ ] Public provenance is recorded for every new dependency or borrowed
      public standard.
- [ ] Claims match acceptance evidence: nothing unimplemented is described in
      the present tense.
- [ ] If this publishes the Console, I verified the exact commit and live
      artifact instead of relying only on a successful push.
