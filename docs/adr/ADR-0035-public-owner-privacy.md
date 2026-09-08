# ADR-0035: Public owner privacy

**Status:** Accepted

Date: 2026-09-08.

## Context

The owner requires removal of personal names, biographies and personal-profile links from every public site and publication artifact.

## Decision

Public Console views and printed inserts use product or organization attribution and the existing brand support mailbox. Personal-account source URLs are omitted. ADR-0022 and ADR-0023 are refined only to allow the exact public role mailbox `hello@flighttrackerled.com`; the ban on closed-product code, internal identifiers and other hostnames remains in force. Source availability and the existing license remain unchanged; support provides the source package. Pixlet setup commands operate on an already obtained source folder.

## Consequences

The hosted and device Console artifacts are regenerated together. No device is flashed. Source-only repository identifiers used by release tooling remain internal to that tooling. This refines the public-link treatment in the Console documentation; product boundaries and source licensing are unchanged.
