#!/usr/bin/env node
// base_project:managed
// Keeps the SHA-256 column of dev/goals-archive/README.md in sync with the archived bodies.
// The column used to be edited by hand, and commit 0710eb5 once replaced 10 of 11 checksums
// with values matching no committed body — CI stayed red until someone noticed. `--check`
// (default) reports every mismatch; `--write` recomputes the column from the files on disk.

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_DIR = path.join(__dirname, "..", "goals-archive");
const ROW =
  /^(\|\s*GOALS\s+\d+\s+—[^|]*\|[^|]*\|\s*\[[^\]]+\]\(\.\/([^)]+)\)\s*\|\s*)`([0-9a-f]*)`(\s*\|\s*)$/;

function sha256(file) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(file))
    .digest("hex");
}

function readIndex(dir) {
  const indexPath = path.join(dir, "README.md");
  const lines = fs.readFileSync(indexPath, "utf8").split("\n");
  const rows = [];
  for (const [index, line] of lines.entries()) {
    const match = line.match(ROW);
    if (match) {
      rows.push({
        index,
        prefix: match[1],
        file: match[2],
        recorded: match[3],
        suffix: match[4],
      });
    }
  }
  return { indexPath, lines, rows };
}

function checkIndex(dir = DEFAULT_DIR) {
  const { rows } = readIndex(dir);
  const findings = [];
  for (const row of rows) {
    const bodyPath = path.join(dir, row.file);
    if (!fs.existsSync(bodyPath)) {
      findings.push({ file: row.file, problem: "missing body file" });
      continue;
    }
    const actual = sha256(bodyPath);
    if (actual !== row.recorded) {
      findings.push({
        file: row.file,
        problem: "checksum mismatch",
        recorded: row.recorded,
        actual,
      });
    }
  }
  return { ok: findings.length === 0, rows: rows.length, findings };
}

function writeIndex(dir = DEFAULT_DIR) {
  const { indexPath, lines, rows } = readIndex(dir);
  let changed = 0;
  for (const row of rows) {
    const bodyPath = path.join(dir, row.file);
    if (!fs.existsSync(bodyPath)) continue;
    const actual = sha256(bodyPath);
    if (actual !== row.recorded) {
      lines[row.index] = `${row.prefix}\`${actual}\`${row.suffix}`;
      changed += 1;
    }
  }
  if (changed > 0) fs.writeFileSync(indexPath, lines.join("\n"), "utf8");
  return { rows: rows.length, changed };
}

function main() {
  const args = process.argv.slice(2);
  const dirIndex = args.indexOf("--dir");
  const dir =
    dirIndex !== -1 && args[dirIndex + 1]
      ? path.resolve(args[dirIndex + 1])
      : DEFAULT_DIR;

  if (args.includes("--write")) {
    const { rows, changed } = writeIndex(dir);
    process.stdout.write(
      `goals-archive index: ${changed}/${rows} checksum(s) updated\n`,
    );
    return;
  }

  const result = checkIndex(dir);
  if (result.ok) {
    process.stdout.write(
      `goals-archive index: ${result.rows} checksum(s) OK\n`,
    );
    return;
  }
  for (const finding of result.findings) {
    process.stderr.write(
      `${finding.file}: ${finding.problem}${finding.actual ? ` (recorded ${finding.recorded}, actual ${finding.actual})` : ""}\n`,
    );
  }
  process.stderr.write(
    "Run `node dev/scripts/goals-archive-index.js --write` after verifying the bodies are intended.\n",
  );
  process.exitCode = 1;
}

if (require.main === module) {
  main();
}

module.exports = { checkIndex, writeIndex, readIndex, sha256 };
