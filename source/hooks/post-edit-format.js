#!/usr/bin/env node
// base_project:managed
// PostToolUse hook: after Edit/Write touches a JS/TS/JSON/CSS file, runs
// `biome format --write` scoped to THAT SINGLE FILE only — never the whole
// project. Scoping to one file is deliberate: a broad `biome format .` run
// during base_project's own development reformatted 500+ unrelated lines in
// one pass and nearly destroyed uncommitted work when reverted carelessly
// (see CLAUDE.md). Silently does nothing if biome isn't installed/configured
// for the target project — this hook must never block or fail the edit it's
// attached to, and must never install anything on the user's behalf.

const { execFileSync } = require("child_process");
const path = require("path");

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
    execFileSync(
      "npx",
      ["--no-install", "biome", "format", "--write", filePath],
      {
        timeout: 15000,
        stdio: "ignore",
        shell: process.platform === "win32",
      },
    );
  } catch {
    // No local biome install, no biome.json scoping this path, or biome
    // itself found nothing to do — all silently fine, this is best-effort.
  }
}

async function main() {
  try {
    const raw = await readStdin();
    const input = raw ? JSON.parse(raw) : {};
    const toolName = input.tool_name || "";
    if (
      toolName === "Edit" ||
      toolName === "Write" ||
      toolName === "MultiEdit"
    ) {
      const filePath = (input.tool_input && input.tool_input.file_path) || "";
      if (filePath && FORMATTABLE_EXT.has(path.extname(filePath))) {
        tryFormat(filePath);
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

module.exports = { FORMATTABLE_EXT };
