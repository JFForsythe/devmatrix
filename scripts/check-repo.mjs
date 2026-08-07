#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const DEFAULT_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..");
const PROTOTYPE_PATH = "portal/prototype/index.html";
const STORY_PATH = "docs/USER-STORY.md";
const ADR_DIRECTORY = "docs/adr";

function issue(check, file, message, hint = "") {
  return { check, file, message, hint };
}

function lineNumber(source, offset) {
  return source.slice(0, offset).split("\n").length;
}

function unique(items) {
  return [...new Set(items)];
}

function matches(source, expression) {
  return [...source.matchAll(expression)];
}

function attributeValue(attributes, name) {
  const expression = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>]+))`, "i");
  const match = attributes.match(expression);
  return match ? (match[1] ?? match[2] ?? match[3] ?? "") : null;
}

function isEmbeddedResource(value) {
  const normalized = value.trim().toLowerCase();
  return normalized === "" || normalized.startsWith("data:") || normalized.startsWith("#") || normalized === "about:blank";
}

function scriptBlocks(html) {
  return matches(html, /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi).map(match => ({
    attributes: match[1],
    source: match[2],
    offset: match.index + match[0].indexOf(match[2]),
  }));
}

/** Check the self-contained prototype without executing it. */
export function checkHtml(html, file = PROTOTYPE_PATH) {
  const issues = [];
  const ids = new Map();

  // Concrete IDs in both the document and HTML-producing template literals count.
  // Expressions such as id="${pane.id}" cannot be proven statically and are skipped.
  for (const match of matches(html, /\bid\s*=\s*(["'])([^"']+)\1/gi)) {
    const id = match[2];
    if (id.includes("${")) continue;
    const line = lineNumber(html, match.index);
    if (ids.has(id)) {
      issues.push(issue(
        "html-ids",
        `${file}:${line}`,
        `Duplicate HTML id "${id}" (first declared on line ${ids.get(id)}).`,
        "Give every rendered element a stable, unique id.",
      ));
    } else {
      ids.set(id, line);
    }
  }

  const blocks = scriptBlocks(html);
  for (const [index, block] of blocks.entries()) {
    const type = (attributeValue(block.attributes, "type") || "text/javascript").toLowerCase();
    if (!["text/javascript", "application/javascript", "module"].includes(type)) continue;
    try {
      // The prototype is deliberately classic vanilla JS. vm.Script catches syntax
      // errors without constructing a DOM or running any browser-side behavior.
      if (type === "module") {
        issues.push(issue(
          "inline-js",
          `${file}:${lineNumber(html, block.offset)}`,
          "Inline module scripts are not supported by the zero-build prototype gate.",
          "Use a classic inline script, or supersede ADR-0005 before adding modules.",
        ));
      } else {
        new vm.Script(block.source, { filename: `${file}#inline-script-${index + 1}` });
      }
    } catch (error) {
      issues.push(issue(
        "inline-js",
        `${file}:${lineNumber(html, block.offset)}`,
        `Inline script ${index + 1} does not parse: ${String(error.message).split("\n")[0]}`,
        "Fix the JavaScript syntax error; this check never executes the script.",
      ));
    }
  }

  const scriptSource = blocks.map(block => block.source).join("\n");
  const selectorPatterns = [
    { expression: /\$\(\s*(["'`])#([A-Za-z][\w:.-]*)\1\s*\)/g, label: "$()" },
    { expression: /\bgetElementById\(\s*(["'`])([A-Za-z][\w:.-]*)\1\s*\)/g, label: "getElementById()" },
  ];
  for (const { expression, label } of selectorPatterns) {
    for (const match of matches(scriptSource, expression)) {
      const id = match[2];
      if (!ids.has(id)) {
        issues.push(issue(
          "html-id-references",
          file,
          `${label} references missing literal id "${id}".`,
          `Add id="${id}" to the rendered HTML or remove the stale selector.`,
        ));
      }
    }
  }

  // Tags that load code or assets must be inline/data URLs. Ordinary <a href>
  // navigation is intentionally not treated as a runtime dependency.
  const loadableAttributes = new Map([
    ["script", ["src"]],
    ["img", ["src", "srcset"]],
    ["iframe", ["src"]],
    ["embed", ["src"]],
    ["object", ["data"]],
    ["source", ["src", "srcset"]],
    ["audio", ["src"]],
    ["video", ["src", "poster"]],
    ["input", ["src"]],
    ["track", ["src"]],
  ]);
  for (const match of matches(html, /<([A-Za-z][\w:-]*)\b([^>]*)>/g)) {
    const tag = match[1].toLowerCase();
    const attributes = match[2];
    const line = lineNumber(html, match.index);

    if (tag === "base" && attributeValue(attributes, "href") !== null) {
      issues.push(issue("offline-prototype", `${file}:${line}`, "A <base href> can redirect all prototype requests.", "Remove the base tag."));
    }
    if (tag === "form") {
      const action = attributeValue(attributes, "action");
      if (action !== null && !isEmbeddedResource(action)) {
        issues.push(issue("offline-prototype", `${file}:${line}`, `Form action "${action}" can leave the offline prototype.`, "Handle mock form behavior in the inline script."));
      }
    }
    if (tag === "link") {
      const rel = (attributeValue(attributes, "rel") || "").toLowerCase().split(/\s+/);
      const href = attributeValue(attributes, "href");
      const loadsResource = rel.some(value => ["stylesheet", "preload", "prefetch", "modulepreload", "preconnect", "dns-prefetch", "manifest"].includes(value));
      if (loadsResource || (href !== null && !isEmbeddedResource(href))) {
        issues.push(issue(
          "offline-prototype",
          `${file}:${line}`,
          `<link> loads "${href || "an external resource"}".`,
          "Inline the asset (a data URL is allowed) to preserve the single-file prototype.",
        ));
      }
    }
    for (const attribute of loadableAttributes.get(tag) || []) {
      const value = attributeValue(attributes, attribute);
      if (value !== null && !isEmbeddedResource(value)) {
        issues.push(issue(
          "offline-prototype",
          `${file}:${line}`,
          `<${tag} ${attribute}="${value}"> adds a runtime file or network dependency.`,
          "Inline the resource as a data URL or remove it (ADR-0005 requires one file).",
        ));
      }
    }
  }

  for (const match of matches(html, /@import\s+(?:url\()?\s*(["']?)([^"')\s;]+)\1/gi)) {
    issues.push(issue("offline-prototype", `${file}:${lineNumber(html, match.index)}`, `CSS @import loads "${match[2]}".`, "Inline the stylesheet."));
  }
  for (const match of matches(html, /\burl\(\s*(["']?)([^"')]+)\1\s*\)/gi)) {
    if (!isEmbeddedResource(match[2])) {
      issues.push(issue("offline-prototype", `${file}:${lineNumber(html, match.index)}`, `CSS url() loads "${match[2]}".`, "Embed the resource as a data URL."));
    }
  }

  const networkCalls = [
    ["fetch()", /\bfetch\s*\(/g],
    ["XMLHttpRequest", /\bnew\s+XMLHttpRequest\b/g],
    ["WebSocket", /\bnew\s+WebSocket\s*\(/g],
    ["EventSource", /\bnew\s+EventSource\s*\(/g],
    ["sendBeacon()", /\bnavigator\.sendBeacon\s*\(/g],
    ["dynamic import()", /\bimport\s*\(/g],
    ["Worker", /\bnew\s+(?:Shared)?Worker\s*\(/g],
  ];
  for (const [name, expression] of networkCalls) {
    for (const match of matches(scriptSource, expression)) {
      issues.push(issue(
        "offline-prototype",
        file,
        `${name} is a runtime dependency in a mock-only prototype.`,
        "Keep the behavior local and simulated, or supersede ADR-0005 first.",
      ));
    }
  }

  return issues;
}

function requiredMatch(story, expression, label, issues) {
  const match = story.match(expression);
  if (!match) {
    issues.push(issue(
      "canonical-story-format",
      STORY_PATH,
      `Could not extract the canonical ${label}.`,
      "Keep the canonical example explicit, or update the checker alongside an intentional story format change.",
    ));
  }
  return match;
}

/** Extract only identifiers that the prototype promises to mirror. */
export function extractCanonicalIdentifiers(story) {
  const issues = [];
  const identifiers = [];

  const buyer = requiredMatch(story, /\*\*([^*\n]+)\*\*,\s*\d+\./, "buyer name", issues);
  if (buyer) identifiers.push(["buyer name", buyer[1]]);

  const serial = requiredMatch(story, /serial\s+`(DMX-[A-Z0-9-]+)`/i, "primary serial", issues);
  if (serial) identifiers.push(["primary serial", serial[1]]);

  const claim = requiredMatch(story, /`([a-z0-9-]+\.local)\s+·\s+([A-Z0-9-]+)`/i, "claim address and code", issues);
  if (claim) {
    identifiers.push(["claim address", claim[1]], ["claim code", claim[2]]);
  }

  const possession = requiredMatch(story, /`CLAIM\s+→\s+([^`]+)`/, "physical possession code", issues);
  if (possession) identifiers.push(["physical possession code", possession[1]]);

  const primaryDevice = requiredMatch(story, /names it\s+\*\*([^*]+)\*\*/i, "primary device name", issues);
  if (primaryDevice) identifiers.push(["primary device name", primaryDevice[1]]);

  const laterDevices = requiredMatch(story, /two more:\s+\*\*([^*]+)\*\*[\s\S]{0,160}?chalet,\s+\*\*([^*]+)\*\*/i, "later device names", issues);
  if (laterDevices) identifiers.push(["second device name", laterDevices[1]], ["third device name", laterDevices[2]]);

  const app = requiredMatch(story, /Installs\s+\*\*([^*]+)\*\*/i, "example app name", issues);
  if (app) identifiers.push(["example app name", app[1]]);

  const firstPixel = requiredMatch(story, /\{["']text["']\s*:\s*["']([^"']+)["']\}/i, "first-pixel text", issues);
  if (firstPixel) identifiers.push(["first-pixel text", firstPixel[1]]);

  for (const version of unique(matches(story, /\bv\d+\.\d+\.\d+(?:[-.][A-Za-z0-9.]+)?\b/g).map(match => match[0]))) {
    identifiers.push(["firmware version", version]);
  }

  return { identifiers, issues };
}

export function checkCanonicalStory(story, html, htmlFile = PROTOTYPE_PATH) {
  const extracted = extractCanonicalIdentifiers(story);
  const issues = [...extracted.issues];
  for (const [label, value] of extracted.identifiers) {
    if (!html.includes(value)) {
      issues.push(issue(
        "canonical-identifiers",
        htmlFile,
        `Missing canonical ${label}: "${value}".`,
        `Use the exact value from ${STORY_PATH}; mock data must tell one consistent story.`,
      ));
    }
  }
  return issues;
}

function withoutMarkdownCode(markdown) {
  const lines = markdown.split("\n");
  let fence = null;
  return lines.map(line => {
    const marker = line.match(/^\s*(`{3,}|~{3,})/);
    if (marker) {
      if (!fence) fence = marker[1][0];
      else if (marker[1][0] === fence) fence = null;
      return "";
    }
    if (fence) return "";
    return line.replace(/`[^`]*`/g, "");
  }).join("\n");
}

export function extractMarkdownLinks(markdown) {
  const source = withoutMarkdownCode(markdown);
  const links = [];
  const inline = /!?\[[^\]]*\]\(\s*(?:<([^>]+)>|([^\s)]+))(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\)/g;
  for (const match of matches(source, inline)) links.push({ destination: match[1] ?? match[2], offset: match.index });
  const definitions = /^\s{0,3}\[[^\]]+\]:\s*(?:<([^>]+)>|([^\s]+))/gm;
  for (const match of matches(source, definitions)) links.push({ destination: match[1] ?? match[2], offset: match.index });
  return links;
}

function headingAnchors(markdown) {
  const source = withoutMarkdownCode(markdown);
  const anchors = new Set();
  const counts = new Map();
  for (const line of source.split("\n")) {
    const match = line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/);
    if (!match) continue;
    const base = match[1]
      .replace(/<[^>]*>/g, "")
      .replace(/!?\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/[^\p{L}\p{N}\s_-]/gu, "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-");
    const seen = counts.get(base) || 0;
    anchors.add(seen ? `${base}-${seen}` : base);
    counts.set(base, seen + 1);
  }
  for (const match of matches(markdown, /\b(?:id|name)\s*=\s*["']([^"']+)["']/gi)) anchors.add(match[1]);
  return anchors;
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

/** Resolve local Markdown links; external URLs are outside this repository gate. */
export function checkMarkdownLinks(root, markdownPaths) {
  const issues = [];
  for (const relativePath of [...markdownPaths].sort()) {
    const absolutePath = path.join(root, relativePath);
    let markdown;
    try {
      markdown = fs.readFileSync(absolutePath, "utf8");
    } catch (error) {
      issues.push(issue("markdown-links", relativePath, `Cannot read Markdown file: ${error.message}`, "Restore or remove the file."));
      continue;
    }

    for (const link of extractMarkdownLinks(markdown)) {
      const destination = link.destination.trim();
      if (!destination || /^(?:[A-Za-z][A-Za-z\d+.-]*:|\/\/)/.test(destination)) continue;
      const hashAt = destination.indexOf("#");
      const beforeHash = hashAt >= 0 ? destination.slice(0, hashAt) : destination;
      const fragmentRaw = hashAt >= 0 ? destination.slice(hashAt + 1) : "";
      const pathRaw = beforeHash.split("?", 1)[0];
      const decodedPath = safeDecode(pathRaw);
      const fragment = safeDecode(fragmentRaw);
      const location = `${relativePath}:${lineNumber(markdown, link.offset)}`;
      if (decodedPath === null || fragment === null) {
        issues.push(issue("markdown-links", location, `Link has invalid percent encoding: "${destination}".`, "Percent-encode the path and fragment correctly."));
        continue;
      }
      if (decodedPath.startsWith("/")) continue; // Site-root links are not filesystem-relative.

      let target = decodedPath ? path.resolve(path.dirname(absolutePath), decodedPath) : absolutePath;
      const relativeTarget = path.relative(root, target);
      if (relativeTarget.startsWith("..") || path.isAbsolute(relativeTarget)) {
        issues.push(issue("markdown-links", location, `Relative link escapes the repository: "${destination}".`, "Point the link at a checked-in repository file."));
        continue;
      }
      if (!fs.existsSync(target)) {
        issues.push(issue("markdown-links", location, `Relative link target does not exist: "${destination}".`, `Create ${path.relative(root, target)} or fix the link.`));
        continue;
      }
      if (fragment) {
        if (fs.statSync(target).isDirectory()) target = path.join(target, "README.md");
        if (!fs.existsSync(target) || path.extname(target).toLowerCase() !== ".md") {
          issues.push(issue("markdown-links", location, `Cannot resolve Markdown fragment "#${fragment}" in "${destination}".`, "Link to a Markdown heading or an explicit HTML id."));
          continue;
        }
        const anchors = headingAnchors(fs.readFileSync(target, "utf8"));
        if (!anchors.has(fragment.toLowerCase()) && !anchors.has(fragment)) {
          issues.push(issue("markdown-links", location, `Heading fragment "#${fragment}" does not exist in ${path.relative(root, target)}.`, "Update the fragment to match the target heading."));
        }
      }
    }
  }
  return issues;
}

function adrNumber(file) {
  const match = path.basename(file).match(/^ADR-(\d{4})-[a-z0-9][a-z0-9-]*\.md$/);
  return match ? Number(match[1]) : null;
}

function adrLabel(number) {
  return `ADR-${String(number).padStart(4, "0")}`;
}

function isAcceptedAdr(content) {
  return /^\*\*Status:\*\*\s*Accepted\b/im.test(content);
}

/** Pure policy check, exported so governance failures have negative tests. */
export function evaluateAdrPolicy({ baselineAdrs, currentAdrs, changes }) {
  const issues = [];
  const baselineEntries = [...baselineAdrs.entries()];
  const currentEntries = [...currentAdrs.entries()];
  const baselineNumbers = baselineEntries.map(([file]) => adrNumber(file)).filter(Number.isInteger);
  const baselineMaximum = baselineNumbers.length ? Math.max(...baselineNumbers) : 0;

  const currentByNumber = new Map();
  for (const [file, content] of currentEntries) {
    const number = adrNumber(file);
    if (number === null) {
      issues.push(issue("adr-history", file, "ADR filename does not match ADR-NNNN-lowercase-slug.md.", "Use the stable numbered ADR filename format."));
      continue;
    }
    if (currentByNumber.has(number)) {
      issues.push(issue("adr-history", file, `${adrLabel(number)} is also used by ${currentByNumber.get(number)}.`, "Assign the next unused ADR number."));
    } else {
      currentByNumber.set(number, file);
    }
    const title = content.match(/^#\s+(ADR-(\d{4}))\b.*$/m);
    if (!title || Number(title[2]) !== number) {
      issues.push(issue("adr-structure", file, `Top-level heading must begin with ${adrLabel(number)} and match the filename.`, `Use "# ${adrLabel(number)} — Decision title".`));
    }
    const status = content.match(/^\*\*Status:\*\*\s*([A-Za-z-]+)/m);
    const allowedStatuses = new Set(["Accepted", "Proposed", "Rejected", "Deprecated", "Superseded"]);
    if (!status || !allowedStatuses.has(status[1])) {
      issues.push(issue("adr-structure", file, "ADR is missing a recognized bold Status field.", "Add **Status:** Accepted (or Proposed, Rejected, Deprecated, or Superseded)."));
    }
    const requiredSections = ["Context", "Decision", "Consequences"];
    const sectionMatches = requiredSections.map(section => matches(content, new RegExp(`^## ${section}\\s*$`, "gm")));
    const positions = sectionMatches.map(found => found[0]?.index ?? -1);
    if (sectionMatches.some(found => found.length !== 1) || positions.some(position => position < 0) || !(positions[0] < positions[1] && positions[1] < positions[2])) {
      issues.push(issue("adr-structure", file, "ADR must contain exactly one Context, Decision, and Consequences section in that order.", "Use the standard ## Context / ## Decision / ## Consequences structure."));
    } else {
      const boundaries = [positions[0] + sectionMatches[0][0][0].length, positions[1], positions[1] + sectionMatches[1][0][0].length, positions[2], positions[2] + sectionMatches[2][0][0].length, content.length];
      const empty = [
        ["Context", content.slice(boundaries[0], boundaries[1])],
        ["Decision", content.slice(boundaries[2], boundaries[3])],
        ["Consequences", content.slice(boundaries[4], boundaries[5])],
      ].filter(([, body]) => !body.trim());
      for (const [section] of empty) issues.push(issue("adr-structure", file, `${section} section is empty.`, `Document the ${section.toLowerCase()} before accepting the ADR.`));
    }
  }

  const addedAdrs = currentEntries
    .filter(([file]) => !baselineAdrs.has(file))
    .map(([file, content]) => ({ file, content, number: adrNumber(file) }))
    .filter(entry => entry.number !== null);
  for (const added of addedAdrs) {
    if (added.number <= baselineMaximum) {
      issues.push(issue(
        "adr-history",
        added.file,
        `${adrLabel(added.number)} is not higher than the baseline maximum ${adrLabel(baselineMaximum)}.`,
        `Use ${adrLabel(baselineMaximum + 1)} or a later unused number; ADR numbers are append-only.`,
      ));
    }
  }

  for (const change of changes) {
    const oldFile = change.oldPath || change.path;
    if (!oldFile.startsWith(`${ADR_DIRECTORY}/`)) continue;
    const oldContent = baselineAdrs.get(oldFile);
    if (!oldContent || !isAcceptedAdr(oldContent)) continue;
    if (["M", "T", "D", "R"].includes(change.status)) {
      const action = ({ M: "edited", T: "changed type", D: "deleted", R: "renamed" })[change.status];
      issues.push(issue(
        "adr-history",
        oldFile,
        `Accepted ${path.basename(oldFile)} was ${action}; accepted ADRs are immutable.`,
        `Restore the file byte-for-byte and put the new decision in ${adrLabel(baselineMaximum + 1)} (or later), explicitly superseding the old ADR there.`,
      ));
    }
  }

  return issues;
}

export function checkPrototypeInventory(files) {
  const allowed = new Set([
    "portal/prototype/.gitignore",
    PROTOTYPE_PATH,
  ]);
  return files
    .filter(file => file.startsWith("portal/prototype/") && !allowed.has(file))
    .sort()
    .map(file => issue(
      "prototype-inventory",
      file,
      "The checked-in prototype may contain only index.html and .gitignore.",
      "Inline the asset into index.html or supersede ADR-0005 before adding prototype files.",
    ));
}

const SENSITIVE_PATTERNS = [
  ["private key", /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g],
  ["GitHub token", /\b(?:gh[opusr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{40,})\b/g],
  ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/g],
  ["Slack token", /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g],
  ["Stripe live secret", /\bsk_live_[A-Za-z0-9]{16,}\b/g],
  ["JWT", /\beyJ[A-Za-z0-9_-]{16,}\.eyJ[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/g],
  ["Google API key", /\bAIza[0-9A-Za-z_-]{35}\b/g],
  ["Google OAuth token", /\bya29\.[A-Za-z0-9_-]{30,}\b/g],
  ["OpenAI-style secret", /\bsk-[A-Za-z0-9_-]{32,}\b/g],
  ["Vercel OIDC token", /\bVERCEL_OIDC_TOKEN\s*=\s*\S{20,}/g],
];

/** Catch malformed tracked JSON and high-confidence credential signatures. */
export function checkRepositoryFiles(root, files) {
  const issues = [];
  for (const file of files) {
    const absolute = path.join(root, file);
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) continue;
    const bytes = fs.readFileSync(absolute);
    if (bytes.length > 2 * 1024 * 1024) {
      issues.push(issue(
        "repository-size",
        file,
        `Checked-in file is ${(bytes.length / 1024 / 1024).toFixed(1)} MiB; repository files must stay under 2 MiB.`,
        "Move large generated/binary artifacts to a release or artifact store.",
      ));
      continue;
    }
    if (bytes.includes(0)) continue;
    const source = bytes.toString("utf8");

    if (file.endsWith(".json")) {
      try {
        JSON.parse(source);
      } catch (error) {
        issues.push(issue(
          "json-syntax",
          file,
          `JSON does not parse: ${error.message}`,
          "Fix the JSON syntax before committing it.",
        ));
      }
    }

    for (const [label, expression] of SENSITIVE_PATTERNS) {
      expression.lastIndex = 0;
      const match = expression.exec(source);
      if (!match) continue;
      issues.push(issue(
        "sensitive-data",
        `${file}:${lineNumber(source, match.index)}`,
        `Possible ${label} is checked into the repository.`,
        "Remove and revoke the credential, then purge it from history if it was ever committed.",
      ));
    }
  }
  return issues;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// The clean-room banned-identifier gate (ADR-0022, re-scoped by ADR-0023):
// closed-product identifiers that are never legitimate anywhere in this
// repository. They are stored base64-encoded so the identifiers themselves
// stay out of the repository — not even the tool that bans them may contain
// one — and decode only in memory, at load time. Exported so tests can build
// fixtures by decoding. Generic words (flight, tracker, aircraft) and the
// open receiver ecosystem (ADS-B, dump1090, readsb, tar1090) are
// deliberately not banned: independently built flight features are in scope
// (ADR-0023).
export const CLEAN_ROOM_BANNED_ENCODED = [
  // Closed-product codename in its spaced, joined, and hyphenated forms.
  "bWFjaCAy",
  "bWFjaDI=",
  "bWFjaC0y",
  // Internal repository and tooling short names.
  "ZnJ2NQ==",
  "ZnRsZWQ=",
  // Third-party flight-data services and API names: the product is
  // local-only forever (ADR-0023), so no integration with these will ever
  // exist and any reference indicates drift.
  "ZmxpZ2h0cmFkYXI=",
  "ZmxpZ2h0YXdhcmU=",
  "b3BlbnNreQ==",
  "YWRzYmV4Y2hhbmdl",
  "YWVyb2FwaQ==",
  // The closed product's domain.
  "ZmxpZ2h0dHJhY2tlcmxlZC5jb20=",
];

// Bounds are asymmetric on purpose: a leading letter or digit means a
// different word, but a trailing digit or symbol is still the banned
// identifier (name24, name_backend, name-2) — a plain \b would let every
// digit-suffixed spelling through. Only a trailing letter starts a
// genuinely different word. Matching is case-insensitive.
const BANNED_PATTERNS = CLEAN_ROOM_BANNED_ENCODED.map(encoded =>
  new RegExp(`(?<![A-Za-z0-9])${escapeRegExp(Buffer.from(encoded, "base64").toString("utf8"))}(?![A-Za-z])`, "gi"));

/** Pure banned-identifier clean-room scan over [file, source] pairs (ADR-0022, ADR-0023). */
export function checkCleanRoomContent(entries) {
  const issues = [];
  for (const [file, source] of entries) {
    for (const expression of BANNED_PATTERNS) {
      expression.lastIndex = 0;
      const match = expression.exec(source);
      if (!match) continue;
      issues.push(issue(
        "clean-room",
        `${file}:${lineNumber(source, match.index)}`,
        `Closed-product identifier "${match[0]}" must never appear in this repository.`,
        "Remove the identifier entirely; the clean-room gate (ADR-0022, ADR-0023) bans it in code, docs, comments, and mock data.",
      ));
    }
  }
  return issues;
}

/** Read repository files and run the clean-room scan; binary files are skipped. */
export function checkCleanRoom(root, files) {
  const entries = [];
  for (const file of files) {
    const absolute = path.join(root, file);
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) continue;
    const bytes = fs.readFileSync(absolute);
    if (bytes.includes(0)) continue;
    entries.push([file, bytes.toString("utf8")]);
  }
  return checkCleanRoomContent(entries);
}

function runGit(root, args, { input } = {}) {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    input,
    maxBuffer: 16 * 1024 * 1024,
  });
  return { status: result.status, stdout: result.stdout || "", stderr: result.stderr || "", error: result.error };
}

function requireGit(root, args, description) {
  const result = runGit(root, args);
  if (result.error || result.status !== 0) {
    const detail = (result.stderr || result.stdout || result.error?.message || "unknown Git error").trim();
    throw new Error(`${description}: ${detail}`);
  }
  return result.stdout;
}

function gitRefExists(root, ref) {
  return runGit(root, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]).status === 0;
}

// Every candidate ref is verified before use because CI can hand us refs
// that no longer exist: after a history rewrite is force-pushed (for
// example squashing to a public-baseline commit), the push event's
// `before` SHA — and any stale CHECK_BASE_REF — points at an unreachable
// commit. An unresolvable candidate therefore falls through to the next
// one instead of failing the run. When nothing resolves at all (a single
// orphan baseline commit has no HEAD^), HEAD is the base: an empty
// change set degrades --ci to the whole-tree invariant checks, which is
// the correct behavior for a fresh baseline.
function resolveCiBase(root, environment) {
  const requested = environment.CHECK_BASE_REF;
  if (requested) {
    if (gitRefExists(root, requested)) return requested;
    process.stderr.write(`CHECK_BASE_REF "${requested}" does not resolve; falling back to the next comparison candidate.\n`);
  }
  if (environment.GITHUB_BASE_REF) {
    const remote = `origin/${environment.GITHUB_BASE_REF}`;
    if (gitRefExists(root, remote)) return remote;
    if (gitRefExists(root, environment.GITHUB_BASE_REF)) return environment.GITHUB_BASE_REF;
  }
  const before = environment.GITHUB_EVENT_BEFORE;
  if (before && !/^0+$/.test(before) && gitRefExists(root, before)) return before;
  if (gitRefExists(root, "HEAD^")) return "HEAD^";
  return "HEAD";
}

function parseArgs(argv) {
  const options = { base: null, ci: false, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") options.help = true;
    else if (argument === "--ci") options.ci = true;
    else if (argument === "--base") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error("--base requires a Git ref (for example: --base origin/main).");
      options.base = value;
      index += 1;
    } else {
      throw new Error(`Unknown argument "${argument}". Run with --help for usage.`);
    }
  }
  if (options.base && options.ci) throw new Error("Use either --base <ref> or --ci, not both.");
  return options;
}

function parseNameStatus(buffer) {
  const fields = buffer.split("\0");
  if (fields.at(-1) === "") fields.pop();
  const changes = [];
  for (let index = 0; index < fields.length;) {
    const statusField = fields[index++];
    const status = statusField[0];
    if (status === "R" || status === "C") {
      const oldPath = fields[index++];
      const newPath = fields[index++];
      changes.push({ status: status === "C" ? "A" : "R", oldPath, path: newPath });
    } else {
      changes.push({ status, path: fields[index++] });
    }
  }
  return changes;
}

function visibleFiles(root, suffix = "") {
  const output = requireGit(root, ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], "Cannot list repository files");
  return output.split("\0").filter(Boolean).filter(file => !suffix || file.endsWith(suffix)).sort();
}

function readAdrsFromDisk(root) {
  const directory = path.join(root, ADR_DIRECTORY);
  if (!fs.existsSync(directory)) return new Map();
  const entries = fs.readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith(".md"))
    .map(entry => `${ADR_DIRECTORY}/${entry.name}`)
    .sort();
  return new Map(entries.map(file => [file, fs.readFileSync(path.join(root, file), "utf8")]));
}

function readBaselineAdrs(root, anchor) {
  const output = requireGit(root, ["ls-tree", "-r", "--name-only", "-z", anchor, "--", ADR_DIRECTORY], "Cannot list baseline ADRs");
  const files = output.split("\0").filter(Boolean).sort();
  return new Map(files.map(file => [
    file,
    requireGit(root, ["show", `${anchor}:${file}`], `Cannot read baseline ${file}`),
  ]));
}

function whitespaceIssues(root, anchor, untracked) {
  const issues = [];
  const diff = runGit(root, ["diff", "--check", anchor, "--", "."]);
  if (diff.error || (![0, 2].includes(diff.status) && !diff.stdout)) {
    issues.push(issue("git-whitespace", ".", `git diff --check failed: ${(diff.stderr || diff.error?.message || "unknown error").trim()}`, "Verify the comparison ref and repository state."));
  } else if (diff.stdout.trim()) {
    for (const line of diff.stdout.trimEnd().split("\n")) {
      if (/^[+]/.test(line)) continue;
      issues.push(issue("git-whitespace", line.split(":", 1)[0] || ".", line, "Remove trailing whitespace or blank lines added at end of file."));
    }
  }
  for (const file of untracked) {
    const absolute = path.join(root, file);
    if (!fs.statSync(absolute).isFile()) continue;
    const result = runGit(root, ["diff", "--no-index", "--check", "--", "/dev/null", absolute]);
    if (result.stdout.trim()) {
      for (const line of result.stdout.trimEnd().split("\n")) {
        if (/^[+]/.test(line)) continue;
        issues.push(issue("git-whitespace", file, line.replaceAll(absolute, file), "Remove trailing whitespace or blank lines added at end of file."));
      }
    }
  }
  return issues;
}

function comparison(root, options, environment) {
  const requested = options.base || (options.ci ? resolveCiBase(root, environment) : "HEAD");
  if (!gitRefExists(root, requested)) throw new Error(`Comparison ref "${requested}" does not resolve to a commit.`);
  const head = requireGit(root, ["rev-parse", "--verify", "HEAD^{commit}"], "Cannot resolve HEAD").trim();
  const requestedCommit = requireGit(root, ["rev-parse", "--verify", `${requested}^{commit}`], `Cannot resolve ${requested}`).trim();
  const anchor = requested === "HEAD"
    ? head
    : requireGit(root, ["merge-base", requestedCommit, head], `Cannot find merge-base for ${requested}`).trim();
  return { requested, anchor };
}

export function usage() {
  return `Usage: node scripts/check-repo.mjs [--base <git-ref> | --ci]\n\n` +
    `  (no args)     Check repository invariants and working-tree changes vs HEAD.\n` +
    `  --base <ref>  Check changes from merge-base(<ref>, HEAD) through the worktree.\n` +
    `  --ci          Resolve the base from CHECK_BASE_REF, GITHUB_BASE_REF,\n` +
    `                GITHUB_EVENT_BEFORE, or HEAD^ — the first that resolves\n` +
    `                to a commit — falling back to HEAD (whole-tree invariant\n` +
    `                checks only) when none do, e.g. after a history rewrite.\n`;
}

export function runRepositoryChecks({ root = DEFAULT_ROOT, argv = [], environment = process.env } = {}) {
  const options = parseArgs(argv);
  if (options.help) return { help: true, issues: [], summary: null };
  const gitRoot = requireGit(root, ["rev-parse", "--show-toplevel"], "Not inside a Git repository").trim();
  if (path.resolve(gitRoot) !== path.resolve(root)) throw new Error(`Expected repository root ${root}, but Git reports ${gitRoot}.`);
  const { requested, anchor } = comparison(root, options, environment);
  const issues = [];

  for (const required of [PROTOTYPE_PATH, STORY_PATH]) {
    if (!fs.existsSync(path.join(root, required))) {
      issues.push(issue("required-files", required, "Required repository truth file is missing.", "Restore the file before running the remaining checks."));
    }
  }

  let html = "";
  let story = "";
  if (fs.existsSync(path.join(root, PROTOTYPE_PATH))) {
    html = fs.readFileSync(path.join(root, PROTOTYPE_PATH), "utf8");
    issues.push(...checkHtml(html));
  }
  if (fs.existsSync(path.join(root, STORY_PATH))) story = fs.readFileSync(path.join(root, STORY_PATH), "utf8");
  if (html && story) issues.push(...checkCanonicalStory(story, html));

  const repositoryFiles = visibleFiles(root);
  issues.push(...checkPrototypeInventory(repositoryFiles));
  issues.push(...checkRepositoryFiles(root, repositoryFiles));
  issues.push(...checkCleanRoom(root, repositoryFiles));
  const markdownPaths = repositoryFiles.filter(file => file.endsWith(".md") && fs.existsSync(path.join(root, file)));
  issues.push(...checkMarkdownLinks(root, markdownPaths));

  const diffOutput = requireGit(root, ["diff", "--name-status", "--find-renames", "-z", anchor, "--", "."], "Cannot inspect changed files");
  const changes = parseNameStatus(diffOutput);
  const untracked = requireGit(root, ["ls-files", "--others", "--exclude-standard", "-z"], "Cannot list untracked files").split("\0").filter(Boolean).sort();
  const changedPaths = new Set(changes.map(change => change.path));
  for (const file of untracked) {
    if (!changedPaths.has(file)) changes.push({ status: "A", path: file });
  }
  issues.push(...whitespaceIssues(root, anchor, untracked));
  issues.push(...evaluateAdrPolicy({
    baselineAdrs: readBaselineAdrs(root, anchor),
    currentAdrs: readAdrsFromDisk(root),
    changes,
  }));

  issues.sort((a, b) => `${a.check}\0${a.file}\0${a.message}`.localeCompare(`${b.check}\0${b.file}\0${b.message}`));
  return {
    help: false,
    issues,
    summary: {
      comparison: requested === "HEAD" ? "working tree vs HEAD" : `merge-base(${requested}, HEAD) through working tree`,
      markdownFiles: markdownPaths.length,
      htmlIds: unique(matches(html, /\bid\s*=\s*(["'])([^"'$]+)\1/gi).map(match => match[2])).length,
    },
  };
}

function printResult(result) {
  if (result.help) {
    process.stdout.write(usage());
    return 0;
  }
  if (result.issues.length) {
    process.stderr.write(`Repository checks failed with ${result.issues.length} issue${result.issues.length === 1 ? "" : "s"}:\n\n`);
    for (const found of result.issues) {
      process.stderr.write(`FAIL [${found.check}] ${found.file}\n  ${found.message}\n`);
      if (found.hint) process.stderr.write(`  Fix: ${found.hint}\n`);
      process.stderr.write("\n");
    }
    return 1;
  }
  process.stdout.write(`Repository checks passed: ${result.summary.comparison}; ${result.summary.markdownFiles} Markdown files; ${result.summary.htmlIds} concrete HTML ids.\n`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(SCRIPT_PATH)) {
  try {
    process.exitCode = printResult(runRepositoryChecks({ argv: process.argv.slice(2) }));
  } catch (error) {
    process.stderr.write(`Repository checker could not run: ${error.message}\n\n${usage()}`);
    process.exitCode = 2;
  }
}
