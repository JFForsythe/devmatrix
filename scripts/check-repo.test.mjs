// SPDX-License-Identifier: GPL-3.0-or-later

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  CLEAN_ROOM_BANNED_ENCODED,
  checkCanonicalStory,
  checkCleanRoom,
  checkCleanRoomContent,
  checkHtml,
  checkMarkdownLinks,
  checkPrototypeInventory,
  checkRepositoryFiles,
  evaluateAdrPolicy,
  extractCanonicalIdentifiers,
  extractMarkdownLinks,
  runRepositoryChecks,
} from "./check-repo.mjs";

function checks(issues) {
  return issues.map(found => found.check);
}

test("HTML checker accepts a self-contained script with resolvable IDs", () => {
  const html = `<!doctype html>
    <html><head><link rel="icon" href="data:image/svg+xml,ok"></head>
    <body><main id="root"></main><script>
      const $ = value => document.querySelector(value);
      $("#root").textContent = "ready";
    </script></body></html>`;
  assert.deepEqual(checkHtml(html), []);
});

test("HTML checker rejects syntax errors, duplicate IDs, and stale literal selectors", () => {
  const html = `<main id="same"><div id="same"></div></main>
    <script>$("#missing"); const broken = ;</script>`;
  const issues = checkHtml(html);
  assert.ok(checks(issues).includes("html-ids"));
  assert.ok(checks(issues).includes("html-id-references"));
  assert.ok(checks(issues).includes("inline-js"));
});

test("HTML checker rejects dependency tags and browser network calls", () => {
  const html = `<link rel="stylesheet" href="https://cdn.example/ui.css">
    <img src="./logo.png"><script src="./bundle.js"></script>
    <script>fetch("/api/mock")</script>`;
  const issues = checkHtml(html).filter(found => found.check === "offline-prototype");
  assert.ok(issues.length >= 4);
  assert.match(issues.map(found => found.message).join("\n"), /fetch\(\)/);
});

const STORY_FIXTURE = `
**Maya Chen**, 41. Example buyer.
The card has serial \`DMX-4E71-0952\`.
The claim screen says \`dmx-0952.local · H7Q-4KD\` and then
\`CLAIM → 7F2Q?\`. She names it **Study** and sends {"text":"SHIP IT"}.
Installs **GitHub Stars** from the registry.
Buys two more: **Workshop** and one for the chalet, **Guest Loft**.
Firmware shown is v0.4.2.
`;

test("canonical identifiers are extracted from the story instead of duplicated configuration", () => {
  const { identifiers, issues } = extractCanonicalIdentifiers(STORY_FIXTURE);
  assert.deepEqual(issues, []);
  assert.deepEqual(identifiers.map(([, value]) => value), [
    "Maya Chen",
    "DMX-4E71-0952",
    "dmx-0952.local",
    "H7Q-4KD",
    "7F2Q?",
    "Study",
    "Workshop",
    "Guest Loft",
    "GitHub Stars",
    "SHIP IT",
    "v0.4.2",
  ]);
  assert.deepEqual(checkCanonicalStory(STORY_FIXTURE, identifiers.map(([, value]) => value).join("\n")), []);
});

test("canonical identifier drift reports the missing semantic value", () => {
  const issues = checkCanonicalStory(STORY_FIXTURE, STORY_FIXTURE.replace("Workshop", "Garage"));
  assert.equal(issues.length, 1);
  assert.match(issues[0].message, /second device name.*Workshop/);
});

test("Markdown scanner ignores code and external URLs", () => {
  const markdown = "[local](guide.md) [web](https://example.test) ` [sample](missing.md) `\n```md\n[fenced](missing.md)\n```";
  assert.deepEqual(extractMarkdownLinks(markdown).map(link => link.destination), ["guide.md", "https://example.test"]);
});

test("Markdown link checker resolves files and heading fragments", t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "devmatrix-checker-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, "docs"));
  fs.writeFileSync(path.join(root, "README.md"), "[guide](docs/guide.md#setup)\n");
  fs.writeFileSync(path.join(root, "docs/guide.md"), "# Setup\n");
  assert.deepEqual(checkMarkdownLinks(root, ["README.md", "docs/guide.md"]), []);

  fs.writeFileSync(path.join(root, "README.md"), "[missing](docs/nope.md)\n[heading](docs/guide.md#absent)\n");
  const issues = checkMarkdownLinks(root, ["README.md", "docs/guide.md"]);
  assert.equal(issues.length, 2);
  assert.ok(issues.every(found => found.check === "markdown-links"));
});

const ACCEPTED_0006 = "# ADR-0006 — Existing\n\n**Status:** Accepted · 2026-08-04\n\n## Context\nOld context.\n\n## Decision\nOld decision.\n\n## Consequences\nOld consequences.\n";
const ACCEPTED_0007 = "# ADR-0007 — Existing\n\n**Status:** Accepted · 2026-08-04\n\n## Context\nCurrent context.\n\n## Decision\nCurrent decision.\n\n## Consequences\nCurrent consequences.\n";
const SUPERSEDING_0008 = "# ADR-0008 — Replacement\n\n**Status:** Accepted · 2026-08-06\n\nSupersedes ADR-0006.\n\n## Context\nNew context.\n\n## Decision\nNew decision.\n\n## Consequences\nNew consequences.\n";

test("accepted ADRs remain immutable even when a superseding ADR is added", () => {
  const baselineAdrs = new Map([
    ["docs/adr/ADR-0006-existing.md", ACCEPTED_0006],
    ["docs/adr/ADR-0007-existing.md", ACCEPTED_0007],
  ]);
  const currentAdrs = new Map([
    ["docs/adr/ADR-0006-existing.md", `${ACCEPTED_0006}\nChanged.\n`],
    ["docs/adr/ADR-0007-existing.md", ACCEPTED_0007],
    ["docs/adr/ADR-0008-replacement.md", SUPERSEDING_0008],
  ]);
  const changes = [
    { status: "M", path: "docs/adr/ADR-0006-existing.md" },
    { status: "A", path: "docs/adr/ADR-0008-replacement.md" },
  ];
  const issues = evaluateAdrPolicy({ baselineAdrs, currentAdrs, changes });
  assert.equal(issues.length, 1);
  assert.match(issues[0].message, /accepted ADRs are immutable/);

  currentAdrs.set("docs/adr/ADR-0006-existing.md", ACCEPTED_0006);
  assert.deepEqual(evaluateAdrPolicy({ baselineAdrs, currentAdrs, changes: changes.slice(1) }), []);
});

test("accepted ADRs cannot be deleted, even when a replacement exists", () => {
  const baselineAdrs = new Map([
    ["docs/adr/ADR-0006-existing.md", ACCEPTED_0006],
    ["docs/adr/ADR-0007-existing.md", ACCEPTED_0007],
  ]);
  const currentAdrs = new Map([
    ["docs/adr/ADR-0007-existing.md", ACCEPTED_0007],
    ["docs/adr/ADR-0008-replacement.md", SUPERSEDING_0008],
  ]);
  const issues = evaluateAdrPolicy({
    baselineAdrs,
    currentAdrs,
    changes: [
      { status: "D", path: "docs/adr/ADR-0006-existing.md" },
      { status: "A", path: "docs/adr/ADR-0008-replacement.md" },
    ],
  });
  assert.ok(issues.some(found => /was deleted/.test(found.message)));
});

test("new ADR numbers must be append-only and unique", () => {
  const baselineAdrs = new Map([["docs/adr/ADR-0007-existing.md", ACCEPTED_0007]]);
  const currentAdrs = new Map([
    ["docs/adr/ADR-0007-existing.md", ACCEPTED_0007],
    ["docs/adr/ADR-0006-too-low.md", ACCEPTED_0006],
    ["docs/adr/ADR-0007-duplicate.md", ACCEPTED_0007],
  ]);
  const issues = evaluateAdrPolicy({ baselineAdrs, currentAdrs, changes: [] });
  assert.ok(issues.some(found => /not higher than/.test(found.message)));
  assert.ok(issues.some(found => /also used/.test(found.message)));
});

test("ADRs require exact filenames and the standard non-empty structure", () => {
  const currentAdrs = new Map([
    ["docs/adr/ADR-0008-UPPER.md", "# ADR-0008 — Broken\n\n**Status:** Unknown\n\n## Decision\nOnly a decision.\n"],
    ["docs/adr/ADR-0009-broken.md", "# ADR-0009 — Broken\n\n**Status:** Unknown\n\n## Decision\nOnly a decision.\n"],
  ]);
  const issues = evaluateAdrPolicy({ baselineAdrs: new Map(), currentAdrs, changes: [] });
  assert.ok(issues.some(found => found.check === "adr-history" && /filename/.test(found.message)));
  assert.ok(issues.some(found => found.check === "adr-structure" && /Status/.test(found.message)));
  assert.ok(issues.some(found => found.check === "adr-structure" && /Context/.test(found.message)));
});

test("prototype inventory permits only the single HTML artifact and its ignore file", () => {
  assert.deepEqual(checkPrototypeInventory([
    "portal/prototype/.gitignore",
    "portal/prototype/index.html",
    "docs/PORTAL.md",
  ]), []);
  const issues = checkPrototypeInventory([
    "portal/prototype/index.html",
    "portal/prototype/app.js",
    "portal/prototype/assets/logo.svg",
  ]);
  assert.deepEqual(issues.map(found => found.file), [
    "portal/prototype/app.js",
    "portal/prototype/assets/logo.svg",
  ]);
});

// Banned-identifier fixtures are built by decoding at runtime; the identifiers
// themselves must never appear in this file as plaintext literals (ADR-0022).
test("banned closed-product identifiers are detected in any file, case-insensitively", () => {
  assert.ok(CLEAN_ROOM_BANNED_ENCODED.length >= 11);
  for (const encoded of CLEAN_ROOM_BANNED_ENCODED) {
    const term = Buffer.from(encoded, "base64").toString("utf8");
    const issues = checkCleanRoomContent([["docs/example.md", `Line one.\nUses ${term.toUpperCase()} here.\n`]]);
    assert.equal(issues.length, 1, `expected exactly one issue for ${encoded}`);
    assert.equal(issues[0].check, "clean-room");
    assert.equal(issues[0].file, "docs/example.md:2");
  }
});

test("banned identifiers are detected with digit or symbol suffixes", () => {
  const service = Buffer.from("ZmxpZ2h0cmFkYXI=", "base64").toString("utf8");
  const repo = Buffer.from("ZnJ2NQ==", "base64").toString("utf8");
  for (const fixture of [`${service}24`, `${service}_backend`, `${repo}-tools`]) {
    const issues = checkCleanRoomContent([["docs/example.md", `${fixture}\n`]]);
    assert.equal(issues.length, 1, `expected detection for ${Buffer.from(fixture).toString("base64")}`);
    assert.equal(issues[0].check, "clean-room");
  }
  // A trailing letter starts a genuinely different word and stays clean.
  assert.deepEqual(checkCleanRoomContent([["docs/example.md", `${service}x\n`]]), []);
});

test("word boundaries keep the brand byline out of clean-room scope", () => {
  assert.deepEqual(checkCleanRoomContent([["docs/anything.md", "Dev Kit by FlightTrackerLED is a canvas.\n"]]), []);
});

test("generic flight words and the open receiver ecosystem are not banned (ADR-0023)", () => {
  const content = "The flight display shows aircraft from an ADS-B receiver speaking dump1090/readsb JSON; a tracker layout is fine.\n";
  assert.deepEqual(checkCleanRoomContent([["docs/NEW-NOTES.md", content]]), []);
});

test("the current repository tree passes the clean-room gate", () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const listing = spawnSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  assert.equal(listing.status, 0, listing.stderr);
  const files = listing.stdout.split("\0").filter(Boolean).sort();
  assert.deepEqual(checkCleanRoom(root, files), []);
});

test("repository file checks reject malformed JSON and high-confidence secrets", t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "devmatrix-files-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, "broken.json"), "{ nope }\n");
  fs.writeFileSync(path.join(root, "secret.txt"), ["ghp", "A".repeat(40)].join("_") + "\n");

  const issues = checkRepositoryFiles(root, ["broken.json", "secret.txt"]);
  assert.ok(issues.some(found => found.check === "json-syntax"));
  assert.ok(issues.some(found => found.check === "sensitive-data"));
});

// A minimal prototype that mirrors every canonical identifier in STORY_FIXTURE,
// so a fixture repository passes the full check suite with zero issues.
const PROTOTYPE_FIXTURE = `<!doctype html>
<main id="root">
  Maya Chen · DMX-4E71-0952 · dmx-0952.local · H7Q-4KD · 7F2Q? · Study ·
  Workshop · Guest Loft · GitHub Stars · SHIP IT · v0.4.2
</main>
`;

const MISSING_SHA = "f".repeat(40);

function fixtureGit(root, args) {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_SYSTEM: "/dev/null",
      GIT_AUTHOR_NAME: "Checker Test",
      GIT_AUTHOR_EMAIL: "checker@example.test",
      GIT_COMMITTER_NAME: "Checker Test",
      GIT_COMMITTER_EMAIL: "checker@example.test",
    },
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

function createBaselineRepo(t) {
  // realpathSync: macOS tmpdir is a symlink, and the checker compares the
  // requested root against Git's resolved top-level path.
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "devmatrix-ci-base-")));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fixtureGit(root, ["init", "--quiet"]);
  fs.mkdirSync(path.join(root, "docs"));
  fs.mkdirSync(path.join(root, "portal/prototype"), { recursive: true });
  fs.writeFileSync(path.join(root, "docs/USER-STORY.md"), STORY_FIXTURE);
  fs.writeFileSync(path.join(root, "portal/prototype/index.html"), PROTOTYPE_FIXTURE);
  fixtureGit(root, ["add", "docs/USER-STORY.md", "portal/prototype/index.html"]);
  fixtureGit(root, ["commit", "--quiet", "-m", "baseline"]);
  return root;
}

test("--ci falls through unresolvable base refs to HEAD^ instead of failing", t => {
  const root = createBaselineRepo(t);
  fs.writeFileSync(path.join(root, "docs/NOTES.md"), "# Notes\n\nSecond commit.\n");
  fixtureGit(root, ["add", "docs/NOTES.md"]);
  fixtureGit(root, ["commit", "--quiet", "-m", "notes"]);

  // Post-force-push shape: both operator- and event-supplied SHAs are
  // unreachable, but the repository still has a parent commit to compare to.
  const result = runRepositoryChecks({
    root,
    argv: ["--ci"],
    environment: { CHECK_BASE_REF: MISSING_SHA, GITHUB_EVENT_BEFORE: MISSING_SHA },
  });
  assert.deepEqual(result.issues, []);
  assert.equal(result.summary.comparison, "merge-base(HEAD^, HEAD) through working tree");
  assert.equal(result.summary.markdownFiles, 2);
});

test("--ci on a single-commit baseline degrades to whole-tree checks against HEAD", t => {
  const root = createBaselineRepo(t);
  // A squashed public baseline is one orphan commit: no HEAD^ exists and no
  // candidate ref resolves, so the change set is empty by construction.
  const result = runRepositoryChecks({
    root,
    argv: ["--ci"],
    environment: { CHECK_BASE_REF: MISSING_SHA, GITHUB_EVENT_BEFORE: MISSING_SHA },
  });
  assert.deepEqual(result.issues, []);
  assert.equal(result.summary.comparison, "working tree vs HEAD");
  assert.equal(result.summary.markdownFiles, 1);
});
