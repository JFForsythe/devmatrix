#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { inferGitHubRepository } from "./verify-live.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const VERIFY_SCRIPT = fileURLToPath(new URL("./verify-live.mjs", import.meta.url));
const RELEASE_BRANCH = "main";
const RELEASE_REPOSITORY = "JFForsythe/devmatrix";
const RELEASE_URL = "https://devmatrix-console.vercel.app/";
const CI_WORKFLOW_NAME = "Repository checks";
const DEFAULT_CI_TIMEOUT_MS = 600_000;

function fail(message) {
  throw new Error(message);
}

function parsePositiveInteger(value, flag) {
  if (!/^\d+$/u.test(value)) {
    fail(`${flag} must be a positive integer`);
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    fail(`${flag} must be a positive integer`);
  }
  return parsed;
}

function resolveCiTimeoutMs(environment) {
  const raw = environment.SHIP_CI_TIMEOUT_MS;
  if (raw === undefined || raw === "") {
    return DEFAULT_CI_TIMEOUT_MS;
  }
  return parsePositiveInteger(raw, "SHIP_CI_TIMEOUT_MS");
}

function parseEnvironmentFiles(environment) {
  if (!environment.SHIP_FILES_JSON) {
    return [];
  }
  let parsed;
  try {
    parsed = JSON.parse(environment.SHIP_FILES_JSON);
  } catch (error) {
    fail(`SHIP_FILES_JSON is not valid JSON: ${error.message}`);
  }
  if (!Array.isArray(parsed) || parsed.some(value => typeof value !== "string" || !value.trim())) {
    fail("SHIP_FILES_JSON must be a JSON array of non-empty path strings");
  }
  return parsed;
}

export function parseArgs(argv, environment = process.env) {
  const options = {
    message: environment.SHIP_MESSAGE || "",
    files: [],
    dryRun: false,
    reviewed: environment.SHIP_REVIEWED === "true",
    attempts: 24,
    delayMs: 5_000,
    help: false,
  };
  let pathsStarted = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];
    if (pathsStarted) {
      options.files.push(argument);
    } else if (argument === "--") {
      pathsStarted = true;
    } else if (argument === "--message" && value) {
      options.message = value;
      index += 1;
    } else if (argument === "--dry-run") {
      options.dryRun = true;
    } else if (argument === "--confirm-reviewed") {
      options.reviewed = true;
    } else if (argument === "--attempts" && value) {
      options.attempts = parsePositiveInteger(value, argument);
      index += 1;
    } else if (argument === "--delay-ms" && value) {
      options.delayMs = parsePositiveInteger(value, argument);
      index += 1;
    } else if (argument === "--help") {
      options.help = true;
    } else {
      fail(`unknown or incomplete argument: ${argument}`);
    }
  }

  const environmentFiles = parseEnvironmentFiles(environment);
  if (options.files.length && environmentFiles.length) {
    fail("provide release files after -- or through SHIP_FILES_JSON, not both");
  }
  options.files = options.files.length ? options.files : environmentFiles;
  options.message = options.message.trim();

  if (!options.help) {
    if (!options.message) {
      fail("a one-line commit message is required with --message or SHIP_MESSAGE");
    }
    if (/[\r\n]/u.test(options.message)) {
      fail("the commit message must be one line");
    }
    if (!options.files.length) {
      fail("at least one exact release file is required after -- or in SHIP_FILES_JSON");
    }
    if (!options.dryRun && !options.reviewed) {
      fail("review the exact diff, then pass --confirm-reviewed or SHIP_REVIEWED=true");
    }
  }
  return options;
}

export function normalizeReleasePaths(repoRoot, requestedPaths) {
  const normalized = [];
  const seen = new Set();
  for (const requestedPath of requestedPaths) {
    if (requestedPath.includes("\0")) {
      fail("release paths cannot contain a NUL byte");
    }
    if (path.isAbsolute(requestedPath)) {
      fail(`release paths must be repository-relative: ${requestedPath}`);
    }
    const absolute = path.resolve(repoRoot, requestedPath);
    const relative = path.relative(repoRoot, absolute);
    if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      fail(`release path is outside the repository or names its root: ${requestedPath}`);
    }
    const gitPath = relative.split(path.sep).join("/");
    if (seen.has(gitPath)) {
      fail(`release path was provided more than once: ${gitPath}`);
    }
    seen.add(gitPath);
    normalized.push(gitPath);
  }
  return normalized;
}

function commandLabel(command, args) {
  return [command, ...args].join(" ");
}

function captureRaw(command, args, cwd, environment = process.env) {
  try {
    return execFileSync(command, args, {
      cwd,
      encoding: "utf8",
      env: environment,
      maxBuffer: 16 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    const detail = error.stderr?.trim() || error.stdout?.trim() || error.message;
    fail(`${commandLabel(command, args)} failed: ${detail}`);
  }
}

function capture(command, args, cwd, environment = process.env) {
  return captureRaw(command, args, cwd, environment).trim();
}

function passthrough(command, args, cwd, environment = process.env) {
  const result = spawnSync(command, args, {
    cwd,
    env: environment,
    stdio: "inherit",
  });
  if (result.error) {
    fail(`${commandLabel(command, args)} failed: ${result.error.message}`);
  }
  if (result.status !== 0) {
    fail(`${commandLabel(command, args)} exited with status ${result.status ?? "unknown"}`);
  }
}

function git(repoRoot, args) {
  return capture("git", args, repoRoot);
}

function nulList(repoRoot, args) {
  const output = captureRaw("git", args, repoRoot);
  return output ? output.split("\0").filter(Boolean) : [];
}

function sortedUnique(values) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function sameValues(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function describeSetDifference(expected, actual) {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  const unrelated = actual.filter(value => !expectedSet.has(value));
  const missing = expected.filter(value => !actualSet.has(value));
  const details = [];
  if (unrelated.length) {
    details.push(`unrelated changes: ${unrelated.join(", ")}`);
  }
  if (missing.length) {
    details.push(`requested paths without changes: ${missing.join(", ")}`);
  }
  return details.join("; ");
}

function stagedFiles(repoRoot) {
  return sortedUnique(nulList(repoRoot, ["diff", "--cached", "--name-only", "--no-renames", "-z"]));
}

function unstagedFiles(repoRoot) {
  return sortedUnique([
    ...nulList(repoRoot, ["diff", "--name-only", "--no-renames", "-z"]),
    ...nulList(repoRoot, ["ls-files", "--others", "--exclude-standard", "-z"]),
  ]);
}

function remoteHead(repoRoot) {
  const output = git(repoRoot, ["ls-remote", "--heads", "origin", `refs/heads/${RELEASE_BRANCH}`]);
  return output.split(/\s+/u)[0] || "";
}

function remoteUrls(repoRoot, mode) {
  const args = ["remote", "get-url"];
  if (mode === "push") {
    args.push("--push");
  }
  args.push("--all", "origin");
  return captureRaw("git", args, repoRoot).split(/\r?\n/u).filter(Boolean);
}

function assertExactChanges(repoRoot, expectedFiles) {
  const actual = unstagedFiles(repoRoot);
  if (!sameValues(expectedFiles, actual)) {
    fail(`release scope does not exactly match the working tree (${describeSetDifference(expectedFiles, actual)})`);
  }
}

function assertNoStagedChanges(repoRoot) {
  const staged = stagedFiles(repoRoot);
  if (staged.length) {
    fail(`pre-existing staged changes are not allowed: ${staged.join(", ")}`);
  }
  const indexEntries = captureRaw("git", ["ls-files", "--stage", "-z"], repoRoot);
  if (/(?:^|\0)\d{6} 0{40,64} 0\t/u.test(indexEntries)) {
    fail("pre-existing intent-to-add index entries are not allowed");
  }
}

function assertNoGitOperation(repoRoot) {
  const statePaths = [
    "MERGE_HEAD",
    "CHERRY_PICK_HEAD",
    "REVERT_HEAD",
    "BISECT_LOG",
    "rebase-apply",
    "rebase-merge",
  ];
  for (const statePath of statePaths) {
    const resolved = git(repoRoot, ["rev-parse", "--git-path", statePath]);
    if (existsSync(path.resolve(repoRoot, resolved))) {
      fail(`cannot release while a Git operation is active (${statePath})`);
    }
  }
  const conflicts = sortedUnique([
    ...nulList(repoRoot, ["diff", "--name-only", "--diff-filter=U", "-z"]),
    ...nulList(repoRoot, ["diff", "--cached", "--name-only", "--diff-filter=U", "-z"]),
  ]);
  if (conflicts.length) {
    fail(`cannot release with unresolved conflicts: ${conflicts.join(", ")}`);
  }
}

function acquireReleaseLock(repoRoot) {
  const gitLockPath = git(repoRoot, ["rev-parse", "--git-path", "devmatrix-ship.lock"]);
  const lockPath = path.resolve(repoRoot, gitLockPath);
  try {
    writeFileSync(lockPath, `${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
  } catch (error) {
    if (error.code === "EEXIST") {
      fail(`another release owns ${lockPath}; if no release is running, inspect and remove that stale lock`);
    }
    fail(`could not create the release lock: ${error.message}`);
  }
  return () => {
    try {
      unlinkSync(lockPath);
    } catch (error) {
      console.error(`WARNING: release lock cleanup failed for ${lockPath}: ${error.message}`);
    }
  };
}

function assertRemoteUnchanged(repoRoot, expectedHead) {
  const actual = remoteHead(repoRoot);
  if (!actual) {
    fail(`origin has no ${RELEASE_BRANCH} branch`);
  }
  if (actual !== expectedHead) {
    fail(`origin/${RELEASE_BRANCH} moved from ${expectedHead.slice(0, 12)} to ${actual.slice(0, 12)}`);
  }
}

function printHelp() {
  console.log(`Usage:
  node scripts/ship.mjs --message "type: summary" --confirm-reviewed -- path/to/file [more/files]
  SHIP_MESSAGE="type: summary" SHIP_REVIEWED=true SHIP_FILES_JSON='["path/to/file"]' make ship

Options:
  --message TEXT   Required one-line commit message
  --confirm-reviewed  Confirm the exact changed-file diff was reviewed
  --dry-run        Validate the exact scope without staging or publishing
  --attempts N     Deployment/artifact attempts (default: 24)
  --delay-ms N     Delay between CI/deployment attempts (default: 5000)
  --help           Show this help

This fail-closed release command checks the repository, stages only the named
files, commits, pushes main without force, waits for the "${CI_WORKFLOW_NAME}"
GitHub Actions run on the pushed commit to succeed, waits for the exact Vercel
deployment, and proves the production artifact byte-for-byte. It refuses mixed
worktrees. SHIP_CI_TIMEOUT_MS overrides the ${DEFAULT_CI_TIMEOUT_MS} ms CI wait.`);
}

function authenticateGitHub(repoRoot, environment) {
  const environmentToken = environment.GITHUB_TOKEN || environment.GH_TOKEN;
  if (environmentToken) {
    return environmentToken;
  }
  try {
    capture("gh", ["auth", "status", "--hostname", "github.com"], repoRoot, environment);
    return capture("gh", ["auth", "token", "--hostname", "github.com"], repoRoot, environment);
  } catch (error) {
    fail(`no GitHub token: set GITHUB_TOKEN or GH_TOKEN, or run \`gh auth login\` (${error.message})`);
  }
}

function sleep(delayMs) {
  return new Promise(resolve => setTimeout(resolve, delayMs));
}

async function githubJson(endpoint, token) {
  const response = await fetch(`https://api.github.com${endpoint}`, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "user-agent": "devmatrix-release-verifier",
      "x-github-api-version": "2022-11-28",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    fail(`GitHub API returned HTTP ${response.status} for ${endpoint}`);
  }
  return response.json();
}

async function waitForRepositoryChecks({
  repository,
  headSha,
  githubToken,
  timeoutMs,
  delayMs,
  fetchJson,
  waitBetweenAttempts,
}) {
  const runsEndpoint = `/repos/${repository}/actions/runs?head_sha=${headSha}&per_page=100`;
  const deadline = Date.now() + timeoutMs;
  let lastState = `no "${CI_WORKFLOW_NAME}" run has appeared for ${headSha.slice(0, 12)}`;

  for (;;) {
    const payload = await fetchJson(runsEndpoint, githubToken);
    const runs = Array.isArray(payload?.workflow_runs) ? payload.workflow_runs : [];
    const run = runs.find(candidate => candidate.name === CI_WORKFLOW_NAME && candidate.head_sha === headSha);
    if (run) {
      const runUrl = run.html_url || `https://github.com/${repository}/actions/runs/${run.id}`;
      if (run.status === "completed") {
        if (run.conclusion === "success") {
          return { id: run.id, url: runUrl };
        }
        fail(`pushed, CI failed — production not verified: "${CI_WORKFLOW_NAME}" concluded ${run.conclusion} (${runUrl})`);
      }
      lastState = `"${CI_WORKFLOW_NAME}" run ${run.id} is ${run.status} (${runUrl})`;
    }
    if (Date.now() >= deadline) {
      fail(`pushed, CI not verified — "${CI_WORKFLOW_NAME}" did not succeed within ${timeoutMs} ms; last state: ${lastState}`);
    }
    console.error(`CI wait: ${lastState}`);
    await waitBetweenAttempts(delayMs);
  }
}

function verifyProduction({ repoRoot, repository, githubToken, oldHead, options, environment }) {
  const verifyEnvironment = { ...environment, GITHUB_TOKEN: githubToken };
  passthrough(process.execPath, [
    VERIFY_SCRIPT,
    "--url", RELEASE_URL,
    "--branch", RELEASE_BRANCH,
    "--repository", repository,
    "--require-deployment",
    "--deployment-base", oldHead,
    "--attempts", String(options.attempts),
    "--delay-ms", String(options.delayMs),
  ], repoRoot, verifyEnvironment);
}

export async function runShip(
  options,
  cwd = process.cwd(),
  environment = process.env,
  dependencyOverrides = {},
) {
  const state = {
    commit: "not created",
    push: "not attempted",
    ci: "not verified",
    production: "not verified",
  };
  let releaseLock = () => {};
  const dependencies = {
    authenticateGitHub,
    resolveRepository: inferGitHubRepository,
    fetchGitHubJson: githubJson,
    sleep,
    waitForRepositoryChecks,
    verifyProduction,
    ...dependencyOverrides,
  };

  try {
    if (!options.message || !options.files?.length) {
      fail("a commit message and exact release files are required");
    }
    if (!options.dryRun && !options.reviewed) {
      fail("the exact changed-file diff must be reviewed before release");
    }
    const repoRoot = git(cwd, ["rev-parse", "--show-toplevel"]);
    releaseLock = acquireReleaseLock(repoRoot);
    const branch = git(repoRoot, ["symbolic-ref", "--quiet", "--short", "HEAD"]);
    if (branch !== RELEASE_BRANCH) {
      fail(`releases must run from ${RELEASE_BRANCH}; current branch is ${branch}`);
    }

    assertNoGitOperation(repoRoot);
    const expectedFiles = sortedUnique(normalizeReleasePaths(repoRoot, options.files));
    assertNoStagedChanges(repoRoot);
    assertExactChanges(repoRoot, expectedFiles);

    const oldHead = git(repoRoot, ["rev-parse", "HEAD"]);
    const startingRemote = remoteHead(repoRoot);
    if (!startingRemote) {
      fail(`origin has no ${RELEASE_BRANCH} branch`);
    }
    if (startingRemote !== oldHead) {
      fail(`local HEAD ${oldHead.slice(0, 12)} does not match origin/${RELEASE_BRANCH} ${startingRemote.slice(0, 12)}`);
    }

    console.log("Release preflight");
    console.log(`  branch:  ${branch}`);
    console.log(`  base:    ${oldHead}`);
    console.log(`  message: ${options.message}`);
    for (const file of expectedFiles) {
      console.log(`  file:    ${file}`);
    }

    passthrough("make", ["check"], repoRoot, environment);
    passthrough("git", ["diff", "--check"], repoRoot, environment);

    if (git(repoRoot, ["rev-parse", "HEAD"]) !== oldHead) {
      fail("local HEAD changed while release checks were running");
    }
    assertNoGitOperation(repoRoot);
    assertNoStagedChanges(repoRoot);
    assertExactChanges(repoRoot, expectedFiles);
    assertRemoteUnchanged(repoRoot, oldHead);

    if (options.dryRun) {
      console.log("Dry run passed; no files were staged, committed, pushed, or deployed.");
      return { ...state, dryRun: true, base: oldHead, files: expectedFiles };
    }

    const fetchUrls = remoteUrls(repoRoot, "fetch");
    const pushUrls = remoteUrls(repoRoot, "push");
    if (fetchUrls.length !== 1 || pushUrls.length !== 1) {
      fail(
        `origin must have exactly one fetch URL and one push URL; found `
        + `${fetchUrls.length} fetch and ${pushUrls.length} push URLs`,
      );
    }
    const fetchRepository = dependencies.resolveRepository(fetchUrls[0]);
    const pushRepository = dependencies.resolveRepository(pushUrls[0]);
    if (fetchRepository !== RELEASE_REPOSITORY || pushRepository !== RELEASE_REPOSITORY) {
      fail(
        `origin fetch and push URLs must both be ${RELEASE_REPOSITORY}; found fetch `
        + `${fetchRepository || "unknown"} and push ${pushRepository || "unknown"}`,
      );
    }
    const repository = fetchRepository;
    const ciTimeoutMs = resolveCiTimeoutMs(environment);
    const githubToken = dependencies.authenticateGitHub(repoRoot, environment);
    if (!githubToken) {
      fail("no GitHub token for CI and deployment verification: set GITHUB_TOKEN or GH_TOKEN, or run `gh auth login`");
    }

    passthrough("git", ["--literal-pathspecs", "add", "--", ...expectedFiles], repoRoot, environment);
    const staged = stagedFiles(repoRoot);
    if (!sameValues(expectedFiles, staged)) {
      fail(`staged scope is not exact (${describeSetDifference(expectedFiles, staged)})`);
    }
    const remaining = unstagedFiles(repoRoot);
    if (remaining.length) {
      fail(`working tree changed while staging: ${remaining.join(", ")}`);
    }
    passthrough("git", ["diff", "--cached", "--check"], repoRoot, environment);
    passthrough("git", ["diff", "--cached", "--name-status", "--no-renames"], repoRoot, environment);
    passthrough("git", ["diff", "--cached", "--stat", "--no-renames"], repoRoot, environment);
    if (!sameValues(expectedFiles, stagedFiles(repoRoot)) || unstagedFiles(repoRoot).length) {
      fail("repository state changed after the validation pass");
    }
    const stagedTree = git(repoRoot, ["write-tree"]);
    assertRemoteUnchanged(repoRoot, oldHead);

    const commitEnvironment = { ...environment, DEVMATRIX_VALIDATED_TREE: stagedTree };
    passthrough("git", ["commit", "-m", options.message], repoRoot, commitEnvironment);
    const newHead = git(repoRoot, ["rev-parse", "HEAD"]);
    state.commit = newHead;
    if (git(repoRoot, ["rev-parse", "HEAD^"]) !== oldHead) {
      fail("release commit parent is not the validated starting commit");
    }
    if (git(repoRoot, ["rev-parse", "HEAD^{tree}"]) !== stagedTree) {
      fail("release commit tree does not match the validated staged tree");
    }
    const committedFiles = sortedUnique(nulList(repoRoot, [
      "diff-tree", "--no-commit-id", "--name-only", "--no-renames", "-r", "-z", "HEAD",
    ]));
    if (!sameValues(expectedFiles, committedFiles)) {
      fail(`committed scope is not exact (${describeSetDifference(expectedFiles, committedFiles)})`);
    }
    const statusAfterCommit = git(repoRoot, ["status", "--porcelain"]);
    if (statusAfterCommit) {
      fail("working tree changed during commit; refusing to push a release with leftover changes");
    }
    assertRemoteUnchanged(repoRoot, oldHead);

    passthrough("git", ["push", "--porcelain", "origin", `HEAD:refs/heads/${RELEASE_BRANCH}`], repoRoot, environment);
    const publishedHead = remoteHead(repoRoot);
    if (publishedHead !== newHead) {
      fail(`push could not be proven: origin/${RELEASE_BRANCH} is ${publishedHead.slice(0, 12)}, local HEAD is ${newHead.slice(0, 12)}`);
    }
    state.push = `origin/${RELEASE_BRANCH} at ${newHead}`;

    const ciRun = await dependencies.waitForRepositoryChecks({
      repository,
      headSha: newHead,
      githubToken,
      timeoutMs: ciTimeoutMs,
      delayMs: options.delayMs,
      fetchJson: dependencies.fetchGitHubJson,
      waitBetweenAttempts: dependencies.sleep,
    });
    state.ci = `${CI_WORKFLOW_NAME} succeeded for ${newHead}`;

    dependencies.verifyProduction({
      repoRoot,
      repository,
      githubToken,
      oldHead,
      newHead,
      options,
      environment,
    });
    state.production = `verified for ${newHead}`;

    console.log("Release complete");
    console.log(`  committed: ${newHead}`);
    console.log(`  pushed:    origin/${RELEASE_BRANCH}`);
    console.log(`  CI:        "${CI_WORKFLOW_NAME}" run ${ciRun.id} succeeded (${ciRun.url})`);
    console.log("  deployed:  exact Vercel commit verified");
    console.log("  live:      production artifact matches byte-for-byte");
    return { ...state, dryRun: false, base: oldHead, head: newHead, files: expectedFiles };
  } catch (error) {
    error.releaseState = { ...state };
    throw error;
  } finally {
    releaseLock();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(SCRIPT_PATH)) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      printHelp();
    } else {
      await runShip(options);
    }
  } catch (error) {
    console.error(`Release failed: ${error.message}`);
    if (error.releaseState) {
      console.error("Release state:");
      console.error(`  commit:     ${error.releaseState.commit}`);
      console.error(`  push:       ${error.releaseState.push}`);
      console.error(`  CI:         ${error.releaseState.ci}`);
      console.error(`  production: ${error.releaseState.production}`);
    }
    process.exitCode = 1;
  }
}
