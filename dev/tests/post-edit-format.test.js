// base_project:managed
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const {
  FORMATTABLE_EXT,
  editedFiles,
  biomeConfigDir,
  biomeEntry,
  tryFormat,
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

test("editedFiles supports Claude edits and both legacy and documented Codex apply_patch payloads", () => {
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
  assert.deepEqual(
    editedFiles({
      tool_name: "apply_patch",
      tool_input: {
        command: [
          "*** Begin Patch",
          "*** Update File: src/codex.ts",
          "*** Add File: src/codex.css",
          "*** End Patch",
        ].join("\n"),
      },
    }),
    ["src/codex.ts", "src/codex.css"],
  );
});

// A throwaway project that borrows this repo's own @biomejs/biome install through a
// directory link ("junction" so it also works on Windows without symlink rights).
function scratchProject({ withConfig }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-format-"));
  fs.symlinkSync(
    path.join(__dirname, "..", "..", "node_modules"),
    path.join(dir, "node_modules"),
    "junction",
  );
  if (withConfig) {
    fs.writeFileSync(
      path.join(dir, "biome.json"),
      JSON.stringify({ formatter: { indentStyle: "space", indentWidth: 2 } }),
    );
  }
  const file = path.join(dir, "src", "app.js");
  fs.mkdirSync(path.dirname(file));
  fs.writeFileSync(file, "const   x  =  {a:1,\n b:2}\n");
  return { dir, file };
}

function runHook(file, env = process.env) {
  const hook = path.join(
    __dirname,
    "..",
    "..",
    "source",
    "hooks",
    "post-edit-format.js",
  );
  return spawnSync(process.execPath, [hook], {
    encoding: "utf8",
    env,
    input: JSON.stringify({
      tool_name: "Edit",
      tool_input: { file_path: file },
    }),
  });
}

test("biomeConfigDir and biomeEntry walk up from the edited file", () => {
  const project = scratchProject({ withConfig: true });
  try {
    assert.equal(
      fs.realpathSync(biomeConfigDir(project.file)),
      fs.realpathSync(project.dir),
    );
    assert.match(
      biomeEntry(project.file),
      /@biomejs[\\/]biome[\\/]bin[\\/]biome$/,
    );
  } finally {
    fs.rmSync(project.dir, { recursive: true, force: true });
  }
});

test("formats an edited file under a biome.json with the project's own Biome, without npx or PATH", () => {
  const project = scratchProject({ withConfig: true });
  try {
    // An empty PATH proves nothing is resolved through npx or a global binary.
    const result = runHook(project.file, { ...process.env, PATH: "" });
    assert.equal(result.status, 0);
    assert.equal(
      fs.readFileSync(project.file, "utf8"),
      "const x = { a: 1, b: 2 };\n",
    );
  } finally {
    fs.rmSync(project.dir, { recursive: true, force: true });
  }
});

test("leaves the file untouched when the project has no Biome config", () => {
  const project = scratchProject({ withConfig: false });
  try {
    const before = fs.readFileSync(project.file, "utf8");
    assert.equal(biomeConfigDir(project.file), null);
    assert.equal(tryFormat(project.file), false);
    const result = runHook(project.file);
    assert.equal(result.status, 0);
    assert.equal(fs.readFileSync(project.file, "utf8"), before);
  } finally {
    fs.rmSync(project.dir, { recursive: true, force: true });
  }
});
