// base_project:managed
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { FORMATTABLE_EXT } = require("../../source/hooks/post-edit-format.js");

test("FORMATTABLE_EXT covers the JS/TS/JSON/CSS family", () => {
  for (const ext of [
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".mjs",
    ".cjs",
    ".json",
    ".css",
  ]) {
    assert.ok(FORMATTABLE_EXT.has(ext), `expected ${ext} to be formattable`);
  }
});

test("FORMATTABLE_EXT excludes unrelated extensions", () => {
  for (const ext of [".md", ".py", ".png", ".lock", ""]) {
    assert.ok(
      !FORMATTABLE_EXT.has(ext),
      `expected ${ext} to NOT be formattable`,
    );
  }
});

test("path.extname integrates correctly with the FORMATTABLE_EXT check", () => {
  assert.ok(FORMATTABLE_EXT.has(path.extname("source/dashboard/server.js")));
  assert.ok(!FORMATTABLE_EXT.has(path.extname("ROADMAP.md")));
});
