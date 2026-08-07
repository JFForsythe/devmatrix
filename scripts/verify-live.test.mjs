// SPDX-License-Identifier: GPL-3.0-or-later

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  inferGitHubRepository,
  parseArgs,
  runVerification,
  sha256,
  shouldUseGitHubRefApi,
} from "./verify-live.mjs";

function command(commandName, args, cwd) {
  return execFileSync(commandName, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function createRepository(t) {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "devmatrix-verify-"));
  const repo = path.join(fixtureRoot, "repo");
  const remote = path.join(fixtureRoot, "remote.git");
  fs.mkdirSync(repo);
  t.after(() => fs.rmSync(fixtureRoot, { recursive: true, force: true }));

  command("git", ["init", "--initial-branch=main"], repo);
  command("git", ["config", "user.name", "Verify Test"], repo);
  command("git", ["config", "user.email", "verify@example.test"], repo);
  fs.writeFileSync(path.join(repo, "artifact.html"), "artifact v1\n");
  command("git", ["add", "--", "artifact.html"], repo);
  command("git", ["commit", "-m", "initial"], repo);
  command("git", ["init", "--bare", remote], fixtureRoot);
  command("git", ["remote", "add", "origin", remote], repo);
  command("git", ["push", "-u", "origin", "main"], repo);
  return { repo, remote };
}

function commitAndPush(repo, file, content, message) {
  fs.writeFileSync(path.join(repo, file), content);
  command("git", ["add", "--", file], repo);
  command("git", ["commit", "-m", message], repo);
  command("git", ["push", "origin", "main"], repo);
}

function verificationOptions(deploymentBase) {
  return parseArgs([
    "--url", "https://console.example.test/",
    "--file", "artifact.html",
    "--branch", "main",
    "--repository", "owner/repo",
    "--deployment-base", deploymentBase,
    "--attempts", "1",
    "--delay-ms", "1",
  ], {});
}

function offlineVerificationDependencies(repo, deployments) {
  return {
    waitForProductionDeployment: async () => {
      deployments.count += 1;
      return { id: 4242, url: "https://fixture.example.test/", createdAt: "2026-08-07T00:00:00Z" };
    },
    fetchArtifact: async () => ({
      bytes: fs.readFileSync(path.join(repo, "artifact.html")),
      contentType: "text/html; charset=utf-8",
      deploymentId: "fixture-vercel-id",
      lastModified: "fixture",
    }),
  };
}

test("release arguments use explicit values and environment defaults", () => {
  const defaults = parseArgs([], {
    DEVMATRIX_LIVE_URL: "https://console.example.test/",
    GITHUB_REF_NAME: "main",
    GITHUB_REPOSITORY: "owner/repo",
    VERIFY_REQUIRE_DEPLOYMENT: "true",
  });
  assert.equal(defaults.url, "https://console.example.test/");
  assert.equal(defaults.branch, "main");
  assert.equal(defaults.repository, "owner/repo");
  assert.equal(defaults.requireDeployment, true);

  const explicit = parseArgs([
    "--url", "https://release.example.test",
    "--file", "artifact.html",
    "--branch", "release",
    "--repository", "other/project",
    "--deployment-base", "HEAD^",
    "--attempts", "3",
    "--delay-ms", "10",
    "--require-deployment",
  ], {});
  assert.equal(explicit.url, "https://release.example.test/");
  assert.equal(explicit.file, "artifact.html");
  assert.equal(explicit.branch, "release");
  assert.equal(explicit.repository, "other/project");
  assert.equal(explicit.deploymentBase, "HEAD^");
  assert.equal(explicit.attempts, 3);
  assert.equal(explicit.delayMs, 10);
  assert.equal(explicit.requireDeployment, true);
});

test("release arguments reject malformed integers and unknown flags", () => {
  assert.throws(() => parseArgs(["--attempts", "2x"], {}), /positive integer/);
  assert.throws(() => parseArgs(["--unknown"], {}), /unknown or incomplete/);
});

test("GitHub repository inference handles SSH and HTTPS remotes", () => {
  assert.equal(inferGitHubRepository("git@github.com:JFForsythe/devmatrix.git"), "JFForsythe/devmatrix");
  assert.equal(inferGitHubRepository("https://github.com/JFForsythe/devmatrix.git"), "JFForsythe/devmatrix");
  assert.equal(inferGitHubRepository("https://example.test/owner/repo.git"), "");
});

test("local verification trusts Git's remote while Actions uses the GitHub API", () => {
  assert.equal(shouldUseGitHubRefApi({ GITHUB_TOKEN: "present" }), false);
  assert.equal(shouldUseGitHubRefApi({ GITHUB_ACTIONS: "true", GITHUB_TOKEN: "present" }), true);
});

test("artifact hashing is stable", () => {
  assert.equal(
    sha256(Buffer.from("devmatrix\n")),
    "5d8345c1364a928d06d0f9f3908b10b99bd54fd64285d0781927303f5c6c5252",
  );
});

test("an unreachable deployment base requires the deployment instead of failing", async t => {
  const { repo } = createRepository(t);

  for (const unreachableBase of ["0123456789abcdef0123456789abcdef01234567", "HEAD^"]) {
    const deployments = { count: 0 };
    const result = await runVerification(
      verificationOptions(unreachableBase),
      repo,
      {},
      offlineVerificationDependencies(repo, deployments),
    );
    assert.equal(deployments.count, 1, `deployment proof must be required for base ${unreachableBase}`);
    assert.equal(result.artifactChanged, true);
    assert.equal(result.deploymentRequired, true);
    assert.equal(result.deployment.id, 4242);
  }
});

test("a resolvable deployment base requires the deployment only for a changed artifact", async t => {
  const { repo } = createRepository(t);
  const baseline = command("git", ["rev-parse", "HEAD"], repo);
  commitAndPush(repo, "unrelated.txt", "unrelated change\n", "docs: unrelated change");

  const unchangedDeployments = { count: 0 };
  const unchanged = await runVerification(
    verificationOptions(baseline),
    repo,
    {},
    offlineVerificationDependencies(repo, unchangedDeployments),
  );
  assert.equal(unchangedDeployments.count, 0);
  assert.equal(unchanged.artifactChanged, false);
  assert.equal(unchanged.deploymentRequired, false);
  assert.equal(unchanged.deployment, null);

  commitAndPush(repo, "artifact.html", "artifact v2\n", "feat: change the artifact");
  const changedDeployments = { count: 0 };
  const changed = await runVerification(
    verificationOptions(baseline),
    repo,
    {},
    offlineVerificationDependencies(repo, changedDeployments),
  );
  assert.equal(changedDeployments.count, 1);
  assert.equal(changed.artifactChanged, true);
  assert.equal(changed.deploymentRequired, true);
  assert.equal(changed.deployment.id, 4242);
});
