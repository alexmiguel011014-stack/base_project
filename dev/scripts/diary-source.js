#!/usr/bin/env node
// base_project:managed
//
// Deterministic extractor behind the /diario command.
//
// Reads the usage ledger that source/hooks/usage-log.js already writes
// (~/.claude/base_project/usage/*.jsonl), groups events by project and by local
// calendar day, and — when the project is a git repository — merges its commits into the
// same per-day structure. Emits JSON on stdout.
//
// This script decides nothing about wording. It answers "what happened, when, for how
// long"; turning that into diary prose is the command's job. Same split as
// contrast-check.js (computes WCAG ratios, /designreview judges everything else) and
// scan-skill.js (finds patterns, /plugins interprets them).

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { execFileSync } = require("node:child_process");

// A gap longer than this between two events is treated as "not working" and excluded
// from the total. Without it, a session left open overnight reports as 14 hours.
const MAX_IDLE_GAP_MS = 30 * 60 * 1000;

function ledgerDir() {
  return path.join(os.homedir(), ".claude", "base_project", "usage");
}

/**
 * Parse ledger lines, skipping malformed ones rather than failing the whole run —
 * the ledger's one-entry-per-line format exists precisely so a bad write can't
 * take its neighbours down with it.
 */
function parseLedgerLines(lines) {
  const events = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line);
      if (event && typeof event.ts === "string") events.push(event);
    } catch {
      // Malformed line: skip it, keep going.
    }
  }
  return events;
}

function readLedger(dir) {
  if (!fs.existsSync(dir)) return [];
  const lines = [];
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".jsonl")) continue;
    try {
      lines.push(...fs.readFileSync(path.join(dir, file), "utf8").split("\n"));
    } catch {
      // Unreadable file: skip it, keep the rest.
    }
  }
  return parseLedgerLines(lines);
}

function normalizePath(p) {
  if (typeof p !== "string" || !p) return null;
  return p.replace(/\\/g, "/").replace(/\/+$/, "");
}

function isInside(child, parent) {
  if (!child || !parent || child === parent) return false;
  return child.startsWith(`${parent}/`);
}

function gitOutput(cwd, args) {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

/** Real git resolver. Tests inject a fake instead of shelling out. */
const gitResolver = {
  toplevel(dir) {
    const out = gitOutput(dir, ["rev-parse", "--show-toplevel"]);
    return out ? normalizePath(out) : null;
  },
  remoteName(dir) {
    const url = gitOutput(dir, ["remote", "get-url", "origin"]);
    if (!url) return null;
    const match = url
      .trim()
      .replace(/\.git$/, "")
      .match(/([^/:]+)$/);
    return match ? match[1] : null;
  },
  commits(dir, since) {
    const SEP = "\x1f";
    const args = ["log", "--date=short", "--format=%ad%x1f%H%x1f%s"];
    if (since) args.push(`--since=${since}`);
    const out = gitOutput(dir, args);
    if (!out) return [];
    return out
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [date, hash, subject] = line.split(SEP);
        return { date, hash: (hash || "").slice(0, 7), subject };
      });
  },
};

/**
 * Resolve one working directory to the project that owns it.
 * A git work tree resolves to its toplevel, so ERP_HK/ERP/modules and ERP_HK itself
 * are the same project rather than three. Non-git directories stand alone.
 */
function resolveProjectRoot(cwd, git) {
  const normalized = normalizePath(cwd);
  if (!normalized) return null;
  return git.toplevel(normalized) || normalized;
}

/**
 * A directory that isn't a repository and merely *contains* observed projects is a
 * container, not a project — the folder you keep projects in, not one of them.
 */
function isContainerOnly(root, allRoots, git) {
  if (git.toplevel(root)) return false;
  return allRoots.some((other) => isInside(other, root));
}

function projectName(root, git) {
  return git.remoteName(root) || path.basename(root);
}

/**
 * Pull the edited file out of a ledger event's `input`.
 *
 * `usage-log.js` stores `input` as a JSON *string* and truncates oversized ones so a
 * single large Write can't bloat the ledger — which means a straight JSON.parse fails
 * on exactly the events most likely to matter. Parse when possible, fall back to
 * reading the key out of the raw text when the JSON was cut mid-value.
 */
function extractFilePath(input) {
  if (!input) return null;
  if (typeof input === "object")
    return input.file_path || input.notebook_path || null;
  if (typeof input !== "string") return null;
  try {
    const parsed = JSON.parse(input);
    return parsed.file_path || parsed.notebook_path || null;
  } catch {
    const match = input.match(
      /"(?:file_path|notebook_path)"\s*:\s*"((?:[^"\\]|\\.)*)"/,
    );
    if (!match) return null;
    try {
      return JSON.parse(`"${match[1]}"`);
    } catch {
      return null;
    }
  }
}

/** Local calendar day (YYYY-MM-DD), not UTC — a 21:00 local event belongs to that day. */
function localDay(ts) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Sum only the gaps that look like continuous work. A single event is 0 minutes:
 * one timestamp is a moment, not a duration, and inventing one would be a lie the
 * diary then reports as fact.
 */
function activeDurationMs(timestamps, maxGapMs = MAX_IDLE_GAP_MS) {
  const sorted = timestamps
    .map((t) => new Date(t).getTime())
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => a - b);
  let total = 0;
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i] - sorted[i - 1];
    if (gap <= maxGapMs) total += gap;
  }
  return total;
}

function formatDuration(ms) {
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/**
 * Build the per-project, per-day structure the /diario command reads.
 * `git` is injectable so this is testable without a real repository.
 */
function buildSource(events, options = {}) {
  const git = options.git || gitResolver;
  const since = options.since || null;
  const rootCache = new Map();

  const byRoot = new Map();
  for (const event of events) {
    const day = localDay(event.ts);
    if (!day) continue;
    if (since && day < since) continue;
    if (!event.cwd) continue;

    const cwd = normalizePath(event.cwd);
    if (!rootCache.has(cwd)) rootCache.set(cwd, resolveProjectRoot(cwd, git));
    const root = rootCache.get(cwd);
    if (!root) continue;

    if (!byRoot.has(root)) byRoot.set(root, new Map());
    const days = byRoot.get(root);
    if (!days.has(day)) {
      days.set(day, {
        date: day,
        timestamps: [],
        sessions: new Set(),
        tools: new Map(),
        files: new Set(),
        prompts: [],
        commits: [],
      });
    }
    const entry = days.get(day);
    entry.timestamps.push(event.ts);
    if (event.session) entry.sessions.add(event.session);
    if (event.tool)
      entry.tools.set(event.tool, (entry.tools.get(event.tool) || 0) + 1);
    if (event.prompt) entry.prompts.push(event.prompt);

    const filePath = extractFilePath(event.input);
    if (filePath) entry.files.add(normalizePath(filePath));
  }

  const allRoots = [...byRoot.keys()];
  const projects = [];

  for (const [root, days] of byRoot) {
    if (isContainerOnly(root, allRoots, git)) continue;

    const isRepo = Boolean(git.toplevel(root));
    if (isRepo) {
      for (const commit of git.commits(root, since)) {
        if (!commit.date) continue;
        if (since && commit.date < since) continue;
        if (!days.has(commit.date)) {
          days.set(commit.date, {
            date: commit.date,
            timestamps: [],
            sessions: new Set(),
            tools: new Map(),
            files: new Set(),
            prompts: [],
            commits: [],
          });
        }
        days.get(commit.date).commits.push(commit);
      }
    }

    const dayList = [...days.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((entry) => {
        const ms = activeDurationMs(entry.timestamps);
        return {
          date: entry.date,
          durationMs: ms,
          duration: formatDuration(ms),
          sessions: entry.sessions.size,
          events: entry.timestamps.length,
          tools: Object.fromEntries(
            [...entry.tools.entries()].sort((a, b) => b[1] - a[1]),
          ),
          files: [...entry.files].sort(),
          prompts: entry.prompts,
          commits: entry.commits,
        };
      });

    projects.push({
      name: projectName(root, git),
      root,
      isRepo,
      days: dayList,
      totalDurationMs: dayList.reduce((sum, d) => sum + d.durationMs, 0),
    });
  }

  projects.sort((a, b) => a.name.localeCompare(b.name));
  return {
    generatedAt: new Date().toISOString(),
    maxIdleGapMinutes: MAX_IDLE_GAP_MS / 60000,
    projects,
  };
}

function parseArgs(argv) {
  const options = { project: null, since: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--project" && argv[i + 1])
      options.project = normalizePath(argv[++i]);
    else if (argv[i] === "--since" && argv[i + 1]) options.since = argv[++i];
  }
  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = buildSource(readLedger(ledgerDir()), { since: options.since });
  if (options.project) {
    result.projects = result.projects.filter(
      (p) => p.root === options.project || isInside(options.project, p.root),
    );
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (require.main === module) main();

module.exports = {
  parseLedgerLines,
  resolveProjectRoot,
  isContainerOnly,
  projectName,
  localDay,
  activeDurationMs,
  formatDuration,
  extractFilePath,
  buildSource,
  MAX_IDLE_GAP_MS,
};
