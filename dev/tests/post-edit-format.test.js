// base_project:managed
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const {
  FORMATTABLE_EXT,
  editedFiles,
} = require("../../source/hooks/post-edit-format.js");

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

test("editedFiles supports Claude edits and Codex apply_patch payloads", () => {
  assert.deepEqual(
    editedFiles({ tool_name: "Edit", tool_input: { file_path: "src/app.js" } }),
    ["src/app.js"],
  );
  assert.deepEqual(
    editedFiles({
      tool_name: "apply_patch",
      tool_input: {
        patch: [
          "*** Begin Patch",
          "*** Update File: src/app.ts",
          "*** Add File: src/theme.css",
          "*** Delete File: src/old.js",
          "*** Update File: src/app.ts",
          "*** End Patch",
        ].join("\n"),
      },
    }),
    ["src/app.ts", "src/theme.css"],
  );
});
