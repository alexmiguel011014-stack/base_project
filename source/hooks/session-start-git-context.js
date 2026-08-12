#!/usr/bin/env node
// base_project:managed
// SessionStart hook: injects a compact git-state summary (branch, uncommitted
// changes, recent commits) directly into context at the start of a session —
// so Claude doesn't have to spend tool calls rediscovering "what was I doing"
// on every fresh start/resume/clear. Plain stdout on exit 0 is added straight
// to context (no JSON wrapper needed) — see Claude Code's SessionStart hook
// docs. Silent (no stdout) when there's nothing worth surfacing, to avoid
// spending tokens on a clean tree with nothing to report.
//
// Registered only for matcher "startup|resume|clear" — deliberately excludes
// "compact"/"fork": those aren't cold starts, and re-dumping git state mid-
// session would be noise, not help.

const { execFileSync } = require("child_process");

function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", () => resolve(data));
    setTimeout(() => resolve(data), 500);
  });
}

function git(args, cwd) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    timeout: 5000,
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

// Pure formatting — testable without touching a real git repo.
function formatGitContext({
  branch,
  statusPorcelain,
  diffStat,
  recentLog,
  aheadBehind,
}) {
  const hasUncommitted = statusPorcelain.trim().length > 0;
  const hasDivergence = aheadBehind && aheadBehind !== "0\t0";
  if (!hasUncommitted && !hasDivergence) {
    return null; // clean tree, in sync with upstream — nothing worth spending tokens on
  }

  const lines = [`Git context for this session (branch: ${branch}):`];

  if (hasDivergence) {
    const [ahead, behind] = aheadBehind.split("\t");
    if (Number(ahead) > 0)
      lines.push(`- ${ahead} commit(s) ahead of upstream, not pushed.`);
    if (Number(behind) > 0)
      lines.push(`- ${behind} commit(s) behind upstream, not pulled.`);
  }

  if (hasUncommitted) {
    const fileCount = statusPorcelain.trim().split("\n").length;
    lines.push(`- ${fileCount} file(s) with uncommitted changes:`);
    if (diffStat) {
      lines.push(diffStat);
    }
  }

  if (recentLog) {
    lines.push("Recent commits:");
    lines.push(recentLog);
  }

  return lines.join("\n");
}

function buildContext(cwd) {
  let isRepo;
  try {
    isRepo = git(["rev-parse", "--is-inside-work-tree"], cwd) === "true";
  } catch {
    return null; // not a git repo — nothing to report
  }
  if (!isRepo) return null;

  let branch = "";
  let statusPorcelain = "";
  let diffStat = "";
  let recentLog = "";
  let aheadBehind = "";
  try {
    branch = git(["branch", "--show-current"], cwd) || "(detached HEAD)";
  } catch {
    // best-effort
  }
  try {
    statusPorcelain = git(["status", "--porcelain"], cwd);
  } catch {
    return null; // if status fails, don't guess at the rest
  }
  try {
    diffStat = git(["diff", "--stat", "HEAD"], cwd);
  } catch {
    // fine — repo may have no commits yet
  }
  try {
    recentLog = git(["log", "-3", "--oneline"], cwd);
  } catch {
    // fine — repo may have no commits yet
  }
  try {
    aheadBehind = git(
      ["rev-list", "--left-right", "--count", "HEAD...@{upstream}"],
      cwd,
    );
  } catch {
    // no upstream configured — not an error, just no divergence info
  }

  return formatGitContext({
    branch,
    statusPorcelain,
    diffStat,
    recentLog,
    aheadBehind,
  });
}

async function main() {
  try {
    const raw = await readStdin();
    const input = raw ? JSON.parse(raw) : {};
    const cwd = input.cwd || process.cwd();
    const context = buildContext(cwd);
    if (context) {
      process.stdout.write(context + "\n");
    }
  } catch {
    // This hook must never fail the session it's attached to — silent no-op on any error.
  }
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = { formatGitContext, buildContext };
