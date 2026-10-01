#!/usr/bin/env node
// base_project:managed
// @ts-check
// Opt-in retention for the usage ledger (GOALS 17 R17.26). base_project never prunes the
// ledger on its own: it is the only source /diario has for past hours, so the default is to
// keep everything, and deleting history is the user's call.
//
// The ledger is one file per UTC day and session, `YYYY-MM-DD-<session>.jsonl`, written by
// source/hooks/usage-log.js. This script selects whole files by the date in their name, so
// it never rewrites a file. Anything else in the directory (/usagebp's
// .zero-use-tracking.json, a note of the user's) is never touched.
//
// Usage:
//   node ledger-prune.js --keep-days <N> [--apply] [--dir <ledger dir>]
//   node ledger-prune.js --before <YYYY-MM-DD> [--apply] [--dir <ledger dir>]
//
// Without --apply it is a dry run: it lists what would go and deletes nothing.

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const LEDGER_FILE = /^(\d{4}-\d{2}-\d{2})-.+\.jsonl$/;
const DAY_MS = 24 * 60 * 60 * 1000;

function ledgerDir() {
  return path.join(os.homedir(), ".claude", "base_project", "usage");
}

function argumentValue(args, flag) {
  const index = args.indexOf(flag);
  return index !== -1 ? (args[index + 1] ?? "") : null;
}

function isCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

// Files dated before the cutoff go; the cutoff day itself is kept.
function cutoffFor(args, now) {
  const keepDays = argumentValue(args, "--keep-days");
  const before = argumentValue(args, "--before");
  if ((keepDays === null) === (before === null)) {
    throw new Error(
      "pass exactly one of --keep-days <N> or --before <YYYY-MM-DD>",
    );
  }
  if (before !== null) {
    if (!isCalendarDate(before)) {
      throw new Error(`--before needs a YYYY-MM-DD date, got '${before}'`);
    }
    return before;
  }
  const days = Number(keepDays);
  if (!Number.isInteger(days) || days < 1) {
    throw new Error(
      `--keep-days needs a whole number of days >= 1, got '${keepDays}'`,
    );
  }
  const today = Date.parse(`${now.toISOString().slice(0, 10)}T00:00:00Z`);
  return new Date(today - days * DAY_MS).toISOString().slice(0, 10);
}

function planPrune(dir, cutoff) {
  const files = [];
  const entries = fs.existsSync(dir)
    ? fs.readdirSync(dir, { withFileTypes: true })
    : [];
  for (const entry of entries) {
    const match = entry.isFile() ? LEDGER_FILE.exec(entry.name) : null;
    if (!match || match[1] >= cutoff) continue;
    files.push({
      name: entry.name,
      date: match[1],
      bytes: fs.statSync(path.join(dir, entry.name)).size,
    });
  }
  files.sort((a, b) => (a.name < b.name ? -1 : 1));
  return {
    files,
    bytes: files.reduce((total, file) => total + file.bytes, 0),
    from: files[0]?.date ?? null,
    to: files.at(-1)?.date ?? null,
  };
}

function megabytes(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function run(args, now = new Date(), out = process.stdout) {
  let cutoff;
  try {
    cutoff = cutoffFor(args, now);
  } catch (error) {
    out.write(
      `ledger-prune: ${error instanceof Error ? error.message : error}\n`,
    );
    return 64;
  }
  const dirArgument = argumentValue(args, "--dir");
  if (dirArgument === "") {
    out.write("ledger-prune: --dir needs a directory\n");
    return 64;
  }
  const dir = path.resolve(dirArgument || ledgerDir());
  const plan = planPrune(dir, cutoff);
  if (plan.files.length === 0) {
    out.write(
      `Nothing to prune: no ledger file in ${dir} is dated before ${cutoff}.\n`,
    );
    return 0;
  }
  const summary = `${plan.files.length} ledger file(s), ${megabytes(plan.bytes)}, dated ${plan.from} to ${plan.to}`;
  if (!args.includes("--apply")) {
    out.write(
      `Dry run - nothing deleted. Would delete ${summary} from ${dir}.\n` +
        `After that, /diario cannot rebuild hours before ${cutoff}: the ledger is its only source.\n` +
        "Re-run with --apply to delete them.\n",
    );
    return 0;
  }
  for (const file of plan.files) fs.rmSync(path.join(dir, file.name));
  out.write(
    `Deleted ${summary} from ${dir}. /diario can no longer rebuild hours before ${cutoff}.\n`,
  );
  return 0;
}

if (require.main === module) {
  process.exitCode = run(process.argv.slice(2));
}

module.exports = { cutoffFor, planPrune, run };
