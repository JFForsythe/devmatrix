// SPDX-License-Identifier: GPL-3.0-or-later

import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { normalizeReleasePaths, parseArgs, runShip } from "./ship.mjs";

const SHIP_SCRIPT = fileURLToPath(new URL("./ship.mjs", import.meta.url));
const PRECOMMIT_HOOK = fileURLToPath(new URL("../.githooks/pre-commit", import.meta.url));

function command(commandName, args, cwd) {
  return execFileSync(commandName, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function createRepository(t) {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "devmatrix-ship-"));
  const repo = path.join(fixtureRoot, "repo");
  const remote = path.join(fixtureRoot, "remote.git");
  fs.mkdirSync(repo);
  t.after(() => fs.rmSync(fixtureRoot, { recursive: true, force: true }));

  command("git", ["init", "--initial-branch=main"], repo);
  command("git", ["config", "user.name", "Release Test"], repo);
  command("git", ["config", "user.email", "release@example.test"], repo);
  fs.writeFileSync(path.join(repo, "Makefile"), "check:\n\t@true\n");
  fs.writeFileSync(path.join(repo, "tracked.txt"), "before\n");
  command("git", ["add", "--", "Makefile", "tracked.txt"], repo);
  command("git", ["commit", "-m", "initial"], repo);
  command("git", ["init", "--bare", remote], fixtureRoot);
  command("git", ["remote", "add", "origin", remote], repo);
  command("git", ["push", "-u", "origin", "main"], repo);
  return { repo, remote };
}

function runDryShip(repo, files) {
  return spawnSync(process.execPath, [
    SHIP_SCRIPT,
    "--dry-run",
    "--message", "test: validate release",
    "--",
    ...files,
  ], {
    cwd: repo,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function releaseOptions(files) {
  return {
    message: "test: publish exact change",
    files,
    dryRun: false,
    reviewed: true,
    attempts: 1,
    delayMs: 1,
  };
}

function ciRunPayload(endpoint, overrides = {}) {
  const headSha = new URL(`https://api.github.com${endpoint}`).searchParams.get("head_sha");
  return {
    workflow_runs: [{
      id: 4242,
      name: "Repository checks",
      head_sha: headSha,
      status: "completed",
      conclusion: "success",
      html_url: "https://github.com/JFForsythe/devmatrix/actions/runs/4242",
      ...overrides,
    }],
  };
}

function offlineReleaseDependencies(verifyProduction) {
  return {
    authenticateGitHub: () => "fixture-token",
    resolveRepository: () => "JFForsythe/devmatrix",
    fetchGitHubJson: async endpoint => ciRunPayload(endpoint),
    sleep: async () => {},
    verifyProduction,
  };
}

test("ship arguments accept CLI and JSON environment file scopes", () => {
  const cli = parseArgs([
    "--message", "chore: ship",
    "--confirm-reviewed",
    "--", "AGENTS.md", "scripts/ship.mjs",
  ], {});
  assert.equal(cli.message, "chore: ship");
  assert.deepEqual(cli.files, ["AGENTS.md", "scripts/ship.mjs"]);

  const environment = parseArgs([], {
    SHIP_MESSAGE: "chore: ship",
    SHIP_REVIEWED: "true",
    SHIP_FILES_JSON: '["AGENTS.md","Makefile"]',
  });
  assert.deepEqual(environment.files, ["AGENTS.md", "Makefile"]);
  assert.throws(() => parseArgs(["--message", "bad\nmessage", "--", "AGENTS.md"], {}), /one line/);
  assert.throws(() => parseArgs(["--message", "chore: ship"], {}), /at least one exact/);
  assert.throws(() => parseArgs(["--message", "chore: ship", "--", "AGENTS.md"], {}), /confirm-reviewed/);
});

test("release paths stay inside the repository and cannot be duplicated", () => {
  assert.deepEqual(normalizeReleasePaths("/repo", ["./AGENTS.md", "scripts/ship.mjs"]), [
    "AGENTS.md",
    "scripts/ship.mjs",
  ]);
  assert.throws(() => normalizeReleasePaths("/repo", ["../outside"]), /outside/);
  assert.throws(() => normalizeReleasePaths("/repo", ["/repo/AGENTS.md"]), /repository-relative/);
  assert.throws(() => normalizeReleasePaths("/repo", ["."]), /root/);
  assert.throws(() => normalizeReleasePaths("/repo", ["AGENTS.md", "./AGENTS.md"]), /more than once/);
});

test("dry run validates one exact dirty file without mutating Git", t => {
  const { repo } = createRepository(t);
  const initial = command("git", ["rev-parse", "HEAD"], repo);
  fs.writeFileSync(path.join(repo, "tracked.txt"), "after\n");

  const result = runDryShip(repo, ["tracked.txt"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Dry run passed/);
  assert.equal(command("git", ["rev-parse", "HEAD"], repo), initial);
  assert.equal(command("git", ["diff", "--cached", "--name-only"], repo), "");
  assert.equal(command("git", ["diff", "--name-only"], repo), "tracked.txt");
});

test("literal release paths can contain spaces, glob characters, and a leading dash", t => {
  const { repo } = createRepository(t);
  const unusualFiles = ["space name.txt", "[literal]*.txt", "-leading-dash.txt"];
  for (const file of unusualFiles) {
    fs.writeFileSync(path.join(repo, file), `${file}\n`);
  }

  const result = runDryShip(repo, unusualFiles);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Dry run passed/);
  assert.equal(command("git", ["diff", "--cached", "--name-only"], repo), "");
});

test("ship refuses unrelated working-tree changes", t => {
  const { repo } = createRepository(t);
  fs.writeFileSync(path.join(repo, "tracked.txt"), "after\n");
  fs.writeFileSync(path.join(repo, "unrelated.txt"), "do not ship\n");

  const result = runDryShip(repo, ["tracked.txt"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /unrelated changes: unrelated\.txt/);
  assert.equal(command("git", ["diff", "--cached", "--name-only"], repo), "");
});

test("ship refuses any pre-existing staged change", t => {
  const { repo } = createRepository(t);
  fs.writeFileSync(path.join(repo, "tracked.txt"), "after\n");
  command("git", ["add", "--", "tracked.txt"], repo);

  const result = runDryShip(repo, ["tracked.txt"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /pre-existing staged changes are not allowed/);
});

test("pre-commit reuses only a proof for the exact staged tree", t => {
  const { repo } = createRepository(t);
  fs.writeFileSync(path.join(repo, "tracked.txt"), "validated\n");
  command("git", ["add", "--", "tracked.txt"], repo);
  const stagedTree = command("git", ["write-tree"], repo);

  const accepted = spawnSync(PRECOMMIT_HOOK, [], {
    cwd: repo,
    encoding: "utf8",
    env: { ...process.env, DEVMATRIX_VALIDATED_TREE: stagedTree },
  });
  assert.equal(accepted.status, 0, accepted.stderr);
  assert.match(accepted.stdout, /already passed for staged tree/);

  const rejected = spawnSync(PRECOMMIT_HOOK, [], {
    cwd: repo,
    encoding: "utf8",
    env: { ...process.env, DEVMATRIX_VALIDATED_TREE: "0".repeat(40) },
  });
  assert.equal(rejected.status, 1);
  assert.match(rejected.stderr, /Staged tree changed/);
});

test("ship refuses an active Git operation", t => {
  const { repo } = createRepository(t);
  fs.writeFileSync(path.join(repo, "tracked.txt"), "after\n");
  fs.writeFileSync(path.join(repo, ".git", "MERGE_HEAD"), `${"a".repeat(40)}\n`);

  const result = runDryShip(repo, ["tracked.txt"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Git operation is active \(MERGE_HEAD\)/);
});

test("ship refuses a local branch that is not at the remote release head", t => {
  const { repo, remote } = createRepository(t);
  const other = path.join(path.dirname(repo), "other");
  command("git", ["clone", "--branch", "main", remote, other], path.dirname(repo));
  command("git", ["config", "user.name", "Other Writer"], other);
  command("git", ["config", "user.email", "other@example.test"], other);
  fs.writeFileSync(path.join(other, "remote.txt"), "remote advance\n");
  command("git", ["add", "--", "remote.txt"], other);
  command("git", ["commit", "-m", "advance remote"], other);
  command("git", ["push", "origin", "main"], other);
  fs.writeFileSync(path.join(repo, "tracked.txt"), "after\n");

  const result = runDryShip(repo, ["tracked.txt"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /does not match origin\/main/);
});

test("ship refuses an origin push URL that resolves to another repository", async t => {
  const { repo, remote } = createRepository(t);
  const wrongRemote = path.join(path.dirname(repo), "wrong.git");
  const originalHead = command("git", ["--git-dir", remote, "rev-parse", "refs/heads/main"], repo);
  command("git", ["init", "--bare", wrongRemote], path.dirname(repo));
  command("git", ["remote", "set-url", "--add", "--push", "origin", remote], repo);
  command("git", ["remote", "set-url", "--add", "--push", "origin", wrongRemote], repo);
  fs.writeFileSync(path.join(repo, "tracked.txt"), "must not escape\n");

  await assert.rejects(
    runShip(
      releaseOptions(["tracked.txt"]),
      repo,
      process.env,
      {
        authenticateGitHub: () => "fixture-token",
        resolveRepository: url => url === remote ? "JFForsythe/devmatrix" : "other/wrong",
        verifyProduction: () => assert.fail("production verification must not run"),
      },
    ),
    /exactly one fetch URL and one push URL/,
  );
  assert.equal(command("git", ["status", "--porcelain"], repo), "M tracked.txt");
  assert.equal(command("git", ["diff", "--cached", "--name-only"], repo), "");
  assert.equal(command("git", ["--git-dir", remote, "rev-parse", "refs/heads/main"], repo), originalHead);
  assert.throws(() => command("git", ["--git-dir", wrongRemote, "rev-parse", "refs/heads/main"], repo));
});

test("full release commits, pushes, and invokes production proof for the exact SHA", async t => {
  const { repo, remote } = createRepository(t);
  const oldHead = command("git", ["rev-parse", "HEAD"], repo);
  fs.writeFileSync(path.join(repo, "tracked.txt"), "published\n");
  let verification;

  const result = await runShip(
    releaseOptions(["tracked.txt"]),
    repo,
    process.env,
    offlineReleaseDependencies(context => {
      verification = context;
    }),
  );

  const newHead = command("git", ["rev-parse", "HEAD"], repo);
  assert.notEqual(newHead, oldHead);
  assert.equal(command("git", ["--git-dir", remote, "rev-parse", "refs/heads/main"], repo), newHead);
  assert.equal(command("git", ["status", "--porcelain"], repo), "");
  assert.equal(verification.oldHead, oldHead);
  assert.equal(verification.newHead, newHead);
  assert.equal(result.ci, `Repository checks succeeded for ${newHead}`);
  assert.equal(result.production, `verified for ${newHead}`);
});

test("a post-push production failure reports pushed but unverified state", async t => {
  const { repo, remote } = createRepository(t);
  fs.writeFileSync(path.join(repo, "tracked.txt"), "published without proof\n");

  await assert.rejects(
    runShip(
      releaseOptions(["tracked.txt"]),
      repo,
      process.env,
      offlineReleaseDependencies(() => {
        throw new Error("fixture deployment failed");
      }),
    ),
    error => {
      assert.match(error.message, /fixture deployment failed/);
      assert.match(error.releaseState.push, /origin\/main/);
      assert.match(error.releaseState.ci, /Repository checks succeeded/);
      assert.equal(error.releaseState.production, "not verified");
      return true;
    },
  );

  const localHead = command("git", ["rev-parse", "HEAD"], repo);
  assert.equal(command("git", ["--git-dir", remote, "rev-parse", "refs/heads/main"], repo), localHead);
});

test("release waits for the Repository checks run on the pushed commit before production proof", async t => {
  const { repo } = createRepository(t);
  fs.writeFileSync(path.join(repo, "tracked.txt"), "ci gated\n");
  const sequence = [];
  const endpoints = [];

  const result = await runShip(
    releaseOptions(["tracked.txt"]),
    repo,
    process.env,
    {
      ...offlineReleaseDependencies(() => {
        sequence.push("production");
      }),
      fetchGitHubJson: async endpoint => {
        sequence.push("ci-poll");
        endpoints.push(endpoint);
        return ciRunPayload(endpoint);
      },
    },
  );

  const newHead = command("git", ["rev-parse", "HEAD"], repo);
  assert.deepEqual(sequence, ["ci-poll", "production"]);
  assert.match(endpoints[0], new RegExp(`head_sha=${newHead}`, "u"));
  assert.equal(result.ci, `Repository checks succeeded for ${newHead}`);
});

test("a failed Repository checks run stops the release as pushed, CI failed", async t => {
  const { repo, remote } = createRepository(t);
  fs.writeFileSync(path.join(repo, "tracked.txt"), "ci failure\n");

  await assert.rejects(
    runShip(
      releaseOptions(["tracked.txt"]),
      repo,
      process.env,
      {
        ...offlineReleaseDependencies(() => assert.fail("production verification must not run")),
        fetchGitHubJson: async endpoint => ciRunPayload(endpoint, { conclusion: "failure" }),
      },
    ),
    error => {
      assert.match(error.message, /pushed, CI failed — production not verified/);
      assert.match(error.message, /actions\/runs\/4242/);
      assert.match(error.releaseState.push, /origin\/main/);
      assert.equal(error.releaseState.ci, "not verified");
      assert.equal(error.releaseState.production, "not verified");
      return true;
    },
  );

  const localHead = command("git", ["rev-parse", "HEAD"], repo);
  assert.equal(command("git", ["--git-dir", remote, "rev-parse", "refs/heads/main"], repo), localHead);
});

test("a missing GitHub token refuses the release before any Git mutation", async t => {
  const { repo, remote } = createRepository(t);
  const originalHead = command("git", ["rev-parse", "HEAD"], repo);
  fs.writeFileSync(path.join(repo, "tracked.txt"), "needs token\n");

  await assert.rejects(
    runShip(
      releaseOptions(["tracked.txt"]),
      repo,
      process.env,
      {
        ...offlineReleaseDependencies(() => assert.fail("production verification must not run")),
        authenticateGitHub: () => "",
        fetchGitHubJson: async () => assert.fail("the GitHub API must not be polled without a token"),
      },
    ),
    /set GITHUB_TOKEN or GH_TOKEN, or run `gh auth login`/,
  );

  assert.equal(command("git", ["rev-parse", "HEAD"], repo), originalHead);
  assert.equal(command("git", ["--git-dir", remote, "rev-parse", "refs/heads/main"], repo), originalHead);
  assert.equal(command("git", ["diff", "--cached", "--name-only"], repo), "");
  assert.equal(command("git", ["diff", "--name-only"], repo), "tracked.txt");
});

test("release keeps polling until a late Repository checks run appears and succeeds", async t => {
  const { repo } = createRepository(t);
  fs.writeFileSync(path.join(repo, "tracked.txt"), "late ci\n");
  let polls = 0;
  let pauses = 0;

  const result = await runShip(
    releaseOptions(["tracked.txt"]),
    repo,
    process.env,
    {
      ...offlineReleaseDependencies(() => {}),
      fetchGitHubJson: async endpoint => {
        polls += 1;
        if (polls === 1) {
          return { workflow_runs: [] };
        }
        if (polls === 2) {
          return ciRunPayload(endpoint, { status: "in_progress", conclusion: null });
        }
        return ciRunPayload(endpoint);
      },
      sleep: async () => {
        pauses += 1;
      },
    },
  );

  assert.equal(polls, 3);
  assert.equal(pauses, 2);
  assert.match(result.ci, /Repository checks succeeded/);
});

test("release fails closed when no Repository checks run finishes within the timeout", async t => {
  const { repo } = createRepository(t);
  fs.writeFileSync(path.join(repo, "tracked.txt"), "ci timeout\n");

  await assert.rejects(
    runShip(
      releaseOptions(["tracked.txt"]),
      repo,
      { ...process.env, SHIP_CI_TIMEOUT_MS: "1" },
      {
        ...offlineReleaseDependencies(() => assert.fail("production verification must not run")),
        fetchGitHubJson: async () => ({ workflow_runs: [] }),
      },
    ),
    error => {
      assert.match(error.message, /pushed, CI not verified/);
      assert.match(error.message, /did not succeed within 1 ms/);
      assert.equal(error.releaseState.ci, "not verified");
      assert.equal(error.releaseState.production, "not verified");
      return true;
    },
  );
});
