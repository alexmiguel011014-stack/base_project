#!/usr/bin/env node
// base_project:managed
// Claude Code PostToolUse hook target. Reads the hook's stdin JSON, resolves which
// base_project plugin (if any) the tool call belongs to, and appends one JSONL line
// to the shared usage log read by the local dashboard server. Must never block or
// fail the tool call it's attached to.

const fs = require("fs");
const os = require("os");
const path = require("path");

const LOG_PATH = path.join(os.homedir(), ".base_project", "usage.jsonl");

// Maps an MCP server name (the middle segment of a `mcp__<server>__<tool>` tool
// name) or a known skill name to the plugins.json catalog id it corresponds to.
const PLUGIN_MAP = {
  context7: "context7",
  playwright: "playwright",
  git: "git",
  github: "github",
  "brave-search": "brave-search",
  filesystem: "filesystem",
  supabase: "supabase",
  postgres: "postgres",
  sqlite: "sqlite",
  ponytail: "ponytail",
  graphify: "graphify",
};

function resolvePlugin(toolName) {
  if (!toolName) return null;
  const mcpMatch = /^mcp__([^_]+(?:-[^_]+)*)__/.exec(toolName);
  if (mcpMatch && PLUGIN_MAP[mcpMatch[1]]) return PLUGIN_MAP[mcpMatch[1]];
  const lower = toolName.toLowerCase();
  for (const key of Object.keys(PLUGIN_MAP)) {
    if (lower.includes(key)) return PLUGIN_MAP[key];
  }
  return null;
}

function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", () => resolve(data));
    // Hooks always get piped JSON, but never hang the tool call waiting for stdin.
    setTimeout(() => resolve(data), 500);
  });
}

async function main() {
  try {
    const raw = await readStdin();
    const input = raw ? JSON.parse(raw) : {};
    const toolName = input.tool_name || null;
    const record = {
      ts: new Date().toISOString(),
      engine: "claude",
      project: process.cwd(),
      tool: toolName,
      plugin: resolvePlugin(toolName),
    };
    fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
    fs.appendFileSync(LOG_PATH, JSON.stringify(record) + "\n", "utf8");
  } catch {
    // Logging must never break the tool call it's attached to.
  }
  process.exit(0);
}

main();
