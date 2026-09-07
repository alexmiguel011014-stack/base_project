#!/usr/bin/env node
// base_project:managed
// PostToolUse hook: validates GOALS.md structure after an edit, but never blocks
// the edit. The deterministic check is shared with the manual /execgoals backstop.

const fs = require("node:fs");
const path = require("node:path");

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

function checkerPath() {
  const installed = path.join(
    __dirname,
    "..",
    "scripts",
    "validate-goals-structure.js",
  );
  if (fs.existsSync(installed)) return installed;
  return path.join(
    __dirname,
    "..",
    "..",
    "dev",
    "scripts",
    "validate-goals-structure.js",
  );
}

function changedFiles(input) {
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

function goalsFiles(input) {
  return changedFiles(input)
    .filter((filePath) => filePath.toLowerCase().endsWith("goals.md"))
    .map((filePath) =>
      path.isAbsolute(filePath)
        ? filePath
        : path.resolve(input.cwd || process.cwd(), filePath),
    );
}

async function main() {
  try {
    const raw = await readStdin();
    const input = raw ? JSON.parse(raw) : {};
    const { check } = require(checkerPath());
    for (const filePath of goalsFiles(input)) {
      const result = check(filePath);
      if (!result.ok) {
        for (const finding of result.findings) {
          process.stderr.write(
            `[base_project] GOALS.md structure warning: ${finding.message}\n`,
          );
        }
      }
    }
  } catch {
    // Hooks are advisory: a malformed payload or unavailable checker must never
    // fail or block the edit that triggered the hook.
  }
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = { changedFiles, checkerPath, goalsFiles };
