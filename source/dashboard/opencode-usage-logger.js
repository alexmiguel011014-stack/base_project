// base_project:managed
// opencode plugin: logs every tool call to the same shared usage log the Claude Code
// hook writes to, so the local dashboard shows both engines together.

const fs = require("fs");
const os = require("os");
const path = require("path");

const LOG_PATH = path.join(os.homedir(), ".base_project", "usage.jsonl");

const PLUGIN_MAP = {
  context7: "context7",
  playwright: "playwright",
  git: "git",
  github: "github",
  filesystem: "filesystem",
  supabase: "supabase",
  postgres: "postgres",
  sqlite: "sqlite",
  ponytail: "ponytail",
  graphify: "graphify",
};

function resolvePlugin(toolName) {
  if (!toolName) return null;
  const lower = toolName.toLowerCase();
  for (const key of Object.keys(PLUGIN_MAP)) {
    if (lower.includes(key)) return PLUGIN_MAP[key];
  }
  return null;
}

exports.UsageLoggerPlugin = async ({ directory }) => ({
  "tool.execute.after": async (input) => {
    try {
      const toolName = input && input.tool ? input.tool : null;
      const record = {
        ts: new Date().toISOString(),
        engine: "opencode",
        project: directory || process.cwd(),
        tool: toolName,
        plugin: resolvePlugin(toolName),
      };
      fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
      fs.appendFileSync(LOG_PATH, JSON.stringify(record) + "\n", "utf8");
    } catch {
      // Logging must never break the tool call it's attached to.
    }
  },
});
