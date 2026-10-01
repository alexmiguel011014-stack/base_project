// base_project:managed
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  checkIndex,
  writeIndex,
  sha256,
} = require("../scripts/goals-archive-index.js");

function fixtureArchive() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-archive-"));
  fs.writeFileSync(path.join(dir, "goals-01-a.md"), "## GOALS 1 — A\n", "utf8");
  fs.writeFileSync(path.join(dir, "goals-02-b.md"), "## GOALS 2 — B\n", "utf8");
  const zero = "0".repeat(64);
  fs.writeFileSync(
    path.join(dir, "README.md"),
    [
      "# Completed GOALS archive",
      "",
      "| Plan | Status | Historical body | SHA-256 file checksum |",
      "| --- | --- | --- | --- |",
      `| GOALS 1 — A | completed | [goals-01-a.md](./goals-01-a.md) | \`${zero}\` |`,
      `| GOALS 2 — B | completed | [goals-02-b.md](./goals-02-b.md) | \`${zero}\` |`,
      "",
    ].join("\n"),
    "utf8",
  );
  return dir;
}

test("goals-archive index: the real archive's recorded checksums match its bodies", () => {
  const result = checkIndex();
  assert.equal(result.ok, true, JSON.stringify(result.findings));
  assert.ok(result.rows > 0);
});

test("goals-archive index: --write recomputes the column and --check then passes", () => {
  const dir = fixtureArchive();
  try {
    assert.equal(checkIndex(dir).ok, false);
    assert.deepEqual(writeIndex(dir), { rows: 2, changed: 2 });
    assert.deepEqual(checkIndex(dir), { ok: true, rows: 2, findings: [] });
    const index = fs.readFileSync(path.join(dir, "README.md"), "utf8");
    assert.ok(index.includes(`\`${sha256(path.join(dir, "goals-01-a.md"))}\``));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("goals-archive index: a tampered or missing body fails the check", () => {
  const dir = fixtureArchive();
  try {
    writeIndex(dir);
    fs.appendFileSync(path.join(dir, "goals-01-a.md"), "edited later\n");
    fs.rmSync(path.join(dir, "goals-02-b.md"));
    const result = checkIndex(dir);
    assert.equal(result.ok, false);
    assert.deepEqual(
      result.findings.map((finding) => [finding.file, finding.problem]),
      [
        ["goals-01-a.md", "checksum mismatch"],
        ["goals-02-b.md", "missing body file"],
      ],
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
