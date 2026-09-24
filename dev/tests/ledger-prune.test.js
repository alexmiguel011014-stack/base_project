// base_project:managed
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { cutoffFor, run } = require("../scripts/ledger-prune.js");

const NOW = new Date("2026-09-24T15:00:00Z");

function ledger() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-ledger-"));
  const files = {
    "2026-01-10-aaa.jsonl": '{"ts":"2026-01-10T10:00:00Z"}\n',
    "2026-06-26-bbb.jsonl": '{"ts":"2026-06-26T10:00:00Z"}\n',
    "2026-06-25-ccc.jsonl": '{"ts":"2026-06-25T10:00:00Z"}\n',
    "2026-09-24-ddd.jsonl": '{"ts":"2026-09-24T10:00:00Z"}\n',
    ".zero-use-tracking.json": "{}\n",
    "2025-01-01-notes.txt": "the user's own notes\n",
  };
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), content);
  }
  fs.mkdirSync(path.join(dir, "2025-01-01-archive.jsonl"));
  return dir;
}

function capture(args) {
  let text = "";
  const code = run(args, NOW, { write: (chunk) => (text += chunk) });
  return { code, text };
}

test("--keep-days keeps the cutoff day; --before takes the date as given", () => {
  assert.equal(cutoffFor(["--keep-days", "90"], NOW), "2026-06-26");
  assert.equal(cutoffFor(["--before", "2026-02-01"], NOW), "2026-02-01");
});

test("a dry run lists what would go and deletes nothing", () => {
  const dir = ledger();
  const before = fs.readdirSync(dir).sort();
  const { code, text } = capture(["--keep-days", "90", "--dir", dir]);
  assert.equal(code, 0);
  assert.match(text, /Dry run - nothing deleted/);
  assert.match(text, /2 ledger file\(s\).*dated 2026-01-10 to 2026-06-25/);
  assert.match(text, /\/diario cannot rebuild hours before 2026-06-26/);
  assert.deepEqual(fs.readdirSync(dir).sort(), before);
});

test("--apply deletes only dated ledger files before the cutoff", () => {
  const dir = ledger();
  const { code, text } = capture([
    "--keep-days",
    "90",
    "--dir",
    dir,
    "--apply",
  ]);
  assert.equal(code, 0);
  assert.match(text, /Deleted 2 ledger file\(s\)/);
  assert.deepEqual(fs.readdirSync(dir).sort(), [
    ".zero-use-tracking.json",
    "2025-01-01-archive.jsonl",
    "2025-01-01-notes.txt",
    "2026-06-26-bbb.jsonl",
    "2026-09-24-ddd.jsonl",
  ]);
  const again = capture(["--keep-days", "90", "--dir", dir, "--apply"]);
  assert.match(again.text, /Nothing to prune/);
});

test("bad or missing arguments delete nothing", () => {
  const dir = ledger();
  const before = fs.readdirSync(dir).sort();
  for (const args of [
    ["--apply"],
    ["--keep-days", "90", "--before", "2026-01-01", "--apply"],
    ["--keep-days", "0", "--apply"],
    ["--keep-days", "-5", "--apply"],
    ["--keep-days", "--apply"],
    ["--before", "2026-02-30", "--apply"],
    ["--before", "yesterday", "--apply"],
    ["--keep-days", "90", "--apply", "--dir"],
  ]) {
    const { code } = capture([
      ...args,
      ...(args.includes("--dir") ? [] : ["--dir", dir]),
    ]);
    assert.equal(code, 64, args.join(" "));
  }
  assert.deepEqual(fs.readdirSync(dir).sort(), before);
});

test("a missing ledger directory is reported, not an error", () => {
  const missing = path.join(os.tmpdir(), "bp-ledger-missing-dir");
  const { code, text } = capture(["--keep-days", "30", "--dir", missing]);
  assert.equal(code, 0);
  assert.match(text, /Nothing to prune/);
});
