#!/usr/bin/env node
// base_project:managed
// @ts-check
// PostToolUse hook: validates GOALS.md structure after an edit, but never blocks
// the edit. The deterministic check is shared with the manual /execgoals backstop.
// Findings go out as JSON on stdout (`hookSpecificOutput.additionalContext`), the
// channel Claude Code and Codex hand to the model; stderr on exit 0 never reaches it.

const fs = require("node:fs");
const path = require("node:path");

function contextOutput(eventName, text) {
  return `${JSON.stringify({
    hookSpecificOutput: {
      hookEventName: eventName || "PostToolUse",
      additionalContext: text,
    },
  })}\n`;
}

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
    const targets = goalsFiles(input);
    if (targets.length === 0) process.exit(0);
    const { check } = require(checkerPath());
    const warnings = [];
    for (const filePath of targets) {
      const result = check(filePath);
      if (!result.ok) {
        for (const finding of result.findings) {
          warnings.push(
            `[base_project] GOALS.md structure warning: ${finding.message}`,
          );
        }
      }
    }
    if (warnings.length > 0) {
      process.stdout.write(
        contextOutput(input.hook_event_name, warnings.join("\n")),
      );
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

module.exports = { changedFiles, checkerPath, goalsFiles, contextOutput };
