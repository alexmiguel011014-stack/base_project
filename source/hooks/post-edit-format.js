#!/usr/bin/env node
// base_project:managed
// PostToolUse hook: after Edit/Write/apply_patch touches a JS/TS/JSON/CSS file, runs
// `biome format --write` scoped to THAT SINGLE FILE only — never the whole
// project. Scoping to one file is deliberate: a broad `biome format .` run
// during base_project's own development reformatted 500+ unrelated lines in
// one pass and nearly destroyed uncommitted work when reverted carelessly
// (see CLAUDE.md). Silently does nothing if biome isn't installed/configured
// for the target project — this hook must never block or fail the edit it's
// attached to, and must never install anything on the user's behalf.
//
// It runs the project's own @biomejs/biome entry with the current Node binary,
// and only under a biome.json(c). It deliberately never goes through `npx`:
// `npx --no-install biome` cost ~500 ms per edit even with Biome installed, and
// in projects without it resolved the unrelated npm package `biome@0.3.3` via a
// registry lookup — the same pitfall this repo's CLAUDE.md documents.

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const BIOME_CONFIGS = ["biome.json", "biome.jsonc"];
const BIOME_ENTRY = path.join(
  "node_modules",
  "@biomejs",
  "biome",
  "bin",
  "biome",
);

// Walks from `start` up to the filesystem root; returns the first `visit(dir)`
// result that isn't null.
function findUp(start, visit) {
  let dir = path.resolve(start);
  while (true) {
    const found = visit(dir);
    if (found) return found;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function biomeConfigDir(filePath) {
  return findUp(path.dirname(filePath), (dir) =>
    BIOME_CONFIGS.some((name) => fs.existsSync(path.join(dir, name)))
      ? dir
      : null,
  );
}

function biomeEntry(filePath) {
  return findUp(path.dirname(filePath), (dir) => {
    const candidate = path.join(dir, BIOME_ENTRY);
    return fs.existsSync(candidate) ? candidate : null;
  });
}

const FORMATTABLE_EXT = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".json",
  ".css",
]);

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

function tryFormat(filePath) {
  try {
    const configDir = biomeConfigDir(filePath);
    if (!configDir) return false;
    const entry = biomeEntry(filePath);
    if (!entry) return false;
    // Biome resolves its configuration from the working directory, so run it from
    // the config that governs this file — not from wherever the session started.
    execFileSync(process.execPath, [entry, "format", "--write", filePath], {
      cwd: configDir,
      timeout: 15000,
      stdio: "ignore",
    });
    return true;
  } catch {
    // Biome refused the file (outside its `files.includes`, parse error) or
    // found nothing to do — all silently fine, this is best-effort.
    return false;
  }
}

function editedFiles(input) {
  const toolName = String(input.tool_name || "").toLowerCase();
  if (toolName === "edit" || toolName === "write" || toolName === "multiedit") {
    const filePath = input.tool_input?.file_path;
    return filePath ? [filePath] : [];
  }
  if (toolName !== "apply_patch") return [];

  const toolInput = input.tool_input;
  const patch =
    typeof toolInput === "string"
      ? toolInput
      : toolInput?.command || toolInput?.patch || toolInput?.input || "";
  return [
    ...new Set(
      [...patch.matchAll(/^\*\*\* (?:Add|Update) File: (.+)\r?$/gm)].map(
        (match) => match[1].trim(),
      ),
    ),
  ];
}

async function main() {
  try {
    const raw = await readStdin();
    const input = raw ? JSON.parse(raw) : {};
    for (const filePath of editedFiles(input)) {
      const absolute = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(input.cwd || process.cwd(), filePath);
      if (FORMATTABLE_EXT.has(path.extname(absolute))) {
        tryFormat(absolute);
      }
    }
  } catch {
    // Formatting must never break the tool call/turn it's attached to.
  }
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = {
  FORMATTABLE_EXT,
  editedFiles,
  biomeConfigDir,
  biomeEntry,
  tryFormat,
};
