#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_URL = "https://devmatrix-console.vercel.app/";
// Points at whatever production actually serves today. The host's Root
// Directory still targets portal/prototype, so the prototype is the live
// artifact; the switch commit changes this constant in the same change as
// the dashboard setting, never before (ADR-0016's atomicity rule).
// DEVMATRIX_LIVE_FILE overrides it for verifying the other artifact.
const DEFAULT_FILE = "portal/prototype/index.html";
const SCRIPT_PATH = fileURLToPath(import.meta.url);

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

export function parseArgs(argv, environment = process.env) {
  const options = {
    url: environment.DEVMATRIX_LIVE_URL || DEFAULT_URL,
    file: environment.DEVMATRIX_LIVE_FILE || DEFAULT_FILE,
    branch: environment.GITHUB_REF_NAME || "",
    repository: environment.GITHUB_REPOSITORY || "",
    requireDeployment: environment.VERIFY_REQUIRE_DEPLOYMENT === "true",
    deploymentBase: "",
    attempts: 12,
    delayMs: 5_000,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (flag === "--url" && value) {
      options.url = value;
      index += 1;
    } else if (flag === "--file" && value) {
      options.file = value;
      index += 1;
    } else if (flag === "--branch" && value) {
      options.branch = value;
      index += 1;
    } else if (flag === "--repository" && value) {
      options.repository = value;
      index += 1;
    } else if (flag === "--require-deployment") {
      options.requireDeployment = true;
    } else if (flag === "--deployment-base" && value) {
      options.deploymentBase = value;
      index += 1;
    } else if (flag === "--attempts" && value) {
      options.attempts = parsePositiveInteger(value, flag);
      index += 1;
    } else if (flag === "--delay-ms" && value) {
      options.delayMs = parsePositiveInteger(value, flag);
      index += 1;
    } else if (flag === "--help") {
      console.log(`Usage: node scripts/verify-live.mjs [options]\n\nOptions:\n  --url URL              Production URL (default: ${DEFAULT_URL})\n  --file PATH            Local artifact (default: DEVMATRIX_LIVE_FILE or ${DEFAULT_FILE})\n  --branch NAME          Published branch (default: current branch)\n  --repository OWNER/REPO  GitHub repository (default: inferred)\n  --require-deployment   Require a successful Vercel GitHub deployment\n  --deployment-base REF  Require deployment only when artifact changed since REF;\n                         an unreachable REF requires the deployment unconditionally\n  --attempts N           Fetch attempts (default: 12)\n  --delay-ms N           Delay between attempts (default: 5000)\n\nThe verifier requires a clean branch whose HEAD matches origin, then compares\nthe production response byte-for-byte with the committed local artifact. CI\ncan additionally prove Vercel success for the exact SHA when the artifact changed.`);
      process.exit(0);
    } else {
      fail(`unknown or incomplete argument: ${flag}`);
    }
  }

  try {
    options.url = new URL(options.url).toString();
  } catch {
    fail(`invalid production URL: ${options.url}`);
  }
  return options;
}

function runGit(repoRoot, args) {
  try {
    return execFileSync("git", args, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    const detail = error.stderr?.trim() || error.message;
    fail(`git ${args.join(" ")} failed: ${detail}`);
  }
}

function runGitStatus(repoRoot, args) {
  try {
    execFileSync("git", args, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { status: 0, stderr: "" };
  } catch (error) {
    return {
      status: Number.isInteger(error.status) ? error.status : 2,
      stderr: error.stderr?.trim() || error.message,
    };
  }
}

function runGitCapture(repoRoot, args) {
  try {
    const stdout = execFileSync("git", args, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    return { status: 0, stdout, stderr: "" };
  } catch (error) {
    return {
      status: Number.isInteger(error.status) ? error.status : 2,
      stdout: "",
      stderr: error.stderr?.trim() || error.message,
    };
  }
}

export function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function inferGitHubRepository(remoteUrl) {
  const match = remoteUrl.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/u);
  return match ? `${match[1]}/${match[2]}` : "";
}

async function githubJson(endpoint, token) {
  const response = await fetch(endpoint.startsWith("https://") ? endpoint : `https://api.github.com${endpoint}`, {
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

export function shouldUseGitHubRefApi(environment = process.env) {
  return environment.GITHUB_ACTIONS === "true";
}

async function resolveRemoteHead(repoRoot, repository, branch, token, useGitHubApi) {
  if (useGitHubApi && token && repository) {
    const ref = await githubJson(`/repos/${repository}/git/ref/heads/${encodeURIComponent(branch)}`, token);
    return ref.object?.sha || "";
  }
  const remoteLine = runGit(repoRoot, ["ls-remote", "--heads", "origin", `refs/heads/${branch}`]);
  return remoteLine.split(/\s+/u)[0];
}

async function waitForProductionDeployment(repository, head, token, attempts, delayMs) {
  if (!token) {
    fail("--require-deployment needs GITHUB_TOKEN");
  }
  if (!repository) {
    fail("--require-deployment needs GITHUB_REPOSITORY or --repository OWNER/REPO");
  }

  let lastState = "no Vercel Production deployment found";
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const deployments = await githubJson(
      `/repos/${repository}/deployments?sha=${head}&environment=Production&per_page=20`,
      token,
    );
    const deployment = deployments.find((item) => item.creator?.login === "vercel[bot]");
    if (deployment) {
      const statuses = await githubJson(deployment.statuses_url, token);
      const latest = statuses[0];
      lastState = latest?.state || "deployment has no status";
      if (latest?.state === "success") {
        return {
          id: deployment.id,
          url: latest.environment_url || "unavailable",
          createdAt: latest.created_at || deployment.created_at || "unavailable",
        };
      }
      if (["error", "failure", "inactive"].includes(latest?.state)) {
        fail(`Vercel deployment ${deployment.id} finished with state ${latest.state}`);
      }
    }

    console.error(`Deployment attempt ${attempt}/${attempts}: ${lastState}`);
    if (attempt < attempts) {
      await sleep(delayMs);
    }
  }
  fail(lastState);
}

function sleep(delayMs) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function fetchArtifact(url, head) {
  const target = new URL(url);
  target.searchParams.set("verify", `${head.slice(0, 12)}-${Date.now()}`);
  const response = await fetch(target, {
    headers: {
      accept: "text/html",
      "cache-control": "no-cache",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    fail(`production returned HTTP ${response.status}`);
  }
  if (new URL(response.url).origin !== target.origin) {
    fail(`production redirected to a different origin: ${response.url}`);
  }
  return {
    bytes: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") || "unknown",
    deploymentId: response.headers.get("x-vercel-id") || "unavailable",
    lastModified: response.headers.get("last-modified") || "unavailable",
  };
}

export async function runVerification(
  options,
  cwd = process.cwd(),
  environment = process.env,
  dependencyOverrides = {},
) {
  const dependencies = {
    resolveRemoteHead,
    waitForProductionDeployment,
    fetchArtifact,
    ...dependencyOverrides,
  };

  const repoRoot = runGit(cwd, ["rev-parse", "--show-toplevel"]);
  const dirty = runGit(repoRoot, ["status", "--porcelain"]);
  if (dirty) {
    fail("working tree is not clean; commit the exact reviewed files before verifying production");
  }

  const branch = options.branch || runGit(repoRoot, ["symbolic-ref", "--quiet", "--short", "HEAD"]);
  const head = runGit(repoRoot, ["rev-parse", "HEAD"]);
  const repository = options.repository || inferGitHubRepository(runGit(repoRoot, ["remote", "get-url", "origin"]));
  const githubToken = environment.GITHUB_TOKEN || "";
  const useGitHubApi = shouldUseGitHubRefApi(environment);
  const remoteHead = await dependencies.resolveRemoteHead(repoRoot, repository, branch, githubToken, useGitHubApi);
  if (!remoteHead) {
    fail(`origin has no branch named ${branch}`);
  }
  if (remoteHead !== head) {
    fail(`origin/${branch} is ${remoteHead.slice(0, 12)}, but local HEAD is ${head.slice(0, 12)}`);
  }

  let artifactChanged = null;
  if (options.deploymentBase) {
    const mergeBase = runGitCapture(repoRoot, ["merge-base", options.deploymentBase, head]);
    if (mergeBase.status !== 0 || !mergeBase.stdout) {
      artifactChanged = true;
      console.error(`Deployment base ${options.deploymentBase} is unreachable (${mergeBase.stderr || "no merge base"}); requiring the production deployment unconditionally`);
    } else {
      const comparison = runGitStatus(repoRoot, ["diff", "--quiet", mergeBase.stdout, head, "--", options.file]);
      if (![0, 1].includes(comparison.status)) {
        fail(`could not compare ${options.file} with ${options.deploymentBase}: ${comparison.stderr || "git diff failed"}`);
      }
      artifactChanged = comparison.status === 1;
    }
    options.requireDeployment ||= artifactChanged;
  }

  const deployment = options.requireDeployment
    ? await dependencies.waitForProductionDeployment(repository, head, githubToken, options.attempts, options.delayMs)
    : null;

  const artifactPath = path.resolve(repoRoot, options.file);
  const localBytes = await readFile(artifactPath);
  const localHash = sha256(localBytes);
  let lastError = "production did not return the committed artifact";

  for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
    try {
      const remote = await dependencies.fetchArtifact(options.url, head);
      const remoteHash = sha256(remote.bytes);
      if (remoteHash === localHash && remote.bytes.equals(localBytes)) {
        console.log("Production verification passed");
        console.log(`  commit:     ${head}`);
        console.log(`  branch:     ${branch}`);
        console.log(`  URL:        ${options.url}`);
        console.log(`  artifact:   ${options.file} (${localBytes.length} bytes)`);
        console.log(`  SHA-256:    ${localHash}`);
        if (artifactChanged === false) {
          console.log(`  deployment: not required; ${options.file} is unchanged since ${options.deploymentBase}`);
        }
        if (deployment) {
          console.log(`  deployment: ${deployment.id} (${deployment.createdAt})`);
          console.log(`  deploy URL: ${deployment.url}`);
        }
        console.log(`  type:       ${remote.contentType}`);
        console.log(`  Vercel ID:  ${remote.deploymentId}`);
        console.log(`  modified:   ${remote.lastModified}`);
        return {
          head,
          branch,
          artifactChanged,
          deploymentRequired: options.requireDeployment,
          deployment,
        };
      }
      lastError = `artifact mismatch: production ${remoteHash}, committed ${localHash}`;
    } catch (error) {
      lastError = error.message;
    }

    console.error(`Attempt ${attempt}/${options.attempts}: ${lastError}`);
    if (attempt < options.attempts) {
      await sleep(options.delayMs);
    }
  }

  fail(lastError);
}

async function main() {
  await runVerification(parseArgs(process.argv.slice(2)));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(SCRIPT_PATH)) {
  main().catch((error) => {
    console.error(`Production verification failed: ${error.message}`);
    process.exitCode = 1;
  });
}
