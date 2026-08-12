#!/usr/bin/env node
// base_project:managed
// Claude Code hook target for PostToolUse, Stop, and UserPromptExpansion. Reads
// the hook's stdin JSON, resolves which base_project plugin/command (if any) the
// call belongs to, and appends one JSONL line to the shared usage log read by the
// local dashboard server. Must never block or fail the tool call/turn it's
// attached to.
//
// Invoked as:
//   node log-usage.js                     for PostToolUse
//   node log-usage.js --stop               for the Stop hook (marks a prompt_id
//                                           finished, so the dashboard can show
//                                           "still running" vs "done" per turn)
//   node log-usage.js --prompt-expansion   for UserPromptExpansion (fires when a
//                                           slash command like /council expands —
//                                           this is the ONLY place the command
//                                           name is visible; PostToolUse only
//                                           sees the underlying Bash/Read/etc
//                                           calls it triggers, with no trace back
//                                           to the command name)

const fs = require("fs");
const os = require("os");
const path = require("path");

const LOG_PATH = path.join(os.homedir(), ".base_project", "usage.jsonl");

// Maps an MCP server name (the middle segment of a `mcp__<server>__<tool>` tool
// name) to the plugins.json catalog id it corresponds to. Does NOT cover Skills —
// see SKILL_MAP below, skills need a completely different detection path.
const PLUGIN_MAP = {
  context7: "context7",
  playwright: "playwright",
  git: "git",
  github: "github",
  filesystem: "filesystem",
  supabase: "supabase",
  postgres: "postgres",
  sqlite: "sqlite",
  graphify: "graphify",
  ruflo: "ruflo",
};

// CLI-kind catalog entries (source/plugins.json) invoked as a plain shell command
// rather than through an MCP tool name — only visible via the Bash tool_input's
// actual command string, never the tool_name itself.
const CLI_MAP = {
  headroom: "headroom",
  "strix-agent": "strix",
  strix: "strix",
};

// Skills ALWAYS report tool_name: "Skill" (never the skill's own name) — the real
// name only lives in tool_input.skill (confirmed against a live payload capture:
// {"tool_name":"Skill","tool_input":{"skill":"ponytail-help"}, ...}). PLUGIN_MAP's
// substring match against tool_name can never work for these; they need their own
// lookup keyed by the exact tool_input.skill value.
const SKILL_MAP = {
  ponytail: "ponytail",
  "ponytail-review": "ponytail",
  "ponytail-audit": "ponytail",
  "ponytail-debt": "ponytail",
  "ponytail-gain": "ponytail",
  "ponytail-help": "ponytail",
  // Best-effort — not verified against a real invocation yet (none of these were
  // installed/used in this environment when mapped). If the actual skill name
  // differs once someone installs and runs one, fix here and update
  // NPInstructions.md's "Erros conhecidos" with what the real value turned out to be.
  "frontend-design": "skill-ui",
  "baseline-ui": "skill-ui",
  "fixing-accessibility": "skill-ui",
  "mcp-builder": "example-skills",
  "webapp-testing": "example-skills",
  // emil-design-eng ships 10 sub-skills under one repo (emilkowalski/skill) —
  // folder names taken from the repo listing, not yet confirmed against a real
  // tool_input.skill payload.
  "emil-design-eng": "emil-design-eng",
  animate: "emil-design-eng",
  "review-animations": "emil-design-eng",
  "improve-animations": "emil-design-eng",
  "find-animation-opportunities": "emil-design-eng",
  "animation-vocabulary": "emil-design-eng",
  "apple-design": "emil-design-eng",
  "pick-ui-library": "emil-design-eng",
  prototype: "emil-design-eng",
  "ask-sonner": "emil-design-eng",
  // impeccable — single skill, name confirmed for real against the marketplace's
  // own plugin/skills/impeccable/SKILL.md (not yet against a live tool_input
  // payload, but the identifier itself is verified, not guessed).
  impeccable: "impeccable",
  // taste-skill (leonxlnx) — several independent skill variants in one repo;
  // SKILL.md frontmatter `name:` values, not yet confirmed against a real
  // tool_input.skill payload.
  "design-taste-frontend": "taste-skill",
  "design-taste-frontend-v1": "taste-skill",
  "gpt-taste": "taste-skill",
  "image-to-code": "taste-skill",
  "redesign-existing-projects": "taste-skill",
  "high-end-visual-design": "taste-skill",
  "full-output-enforcement": "taste-skill",
  "minimalist-ui": "taste-skill",
  "industrial-brutalist-ui": "taste-skill",
  "stitch-design-taste": "taste-skill",
  "imagegen-frontend-web": "taste-skill",
  "imagegen-frontend-mobile": "taste-skill",
  brandkit: "taste-skill",
};

// base_project's own built-in slash commands (source/claude/commands/*.md) —
// only visible via the UserPromptExpansion hook, which is the sole hook event
// that carries the actual command name the user typed.
const COMMAND_IDS = new Set([
  "council",
  "bootstrap",
  "audit",
  "plugins",
  "dashboard",
]);

function resolvePlugin(toolName, toolInput) {
  if (toolName === "Skill") {
    const skillName =
      toolInput && typeof toolInput.skill === "string" ? toolInput.skill : "";
    return SKILL_MAP[skillName] || null;
  }
  if (toolName) {
    const mcpMatch = /^mcp__([^_]+(?:-[^_]+)*)__/.exec(toolName);
    if (mcpMatch && PLUGIN_MAP[mcpMatch[1]]) return PLUGIN_MAP[mcpMatch[1]];
    const lower = toolName.toLowerCase();
    for (const key of Object.keys(PLUGIN_MAP)) {
      if (lower.includes(key)) return PLUGIN_MAP[key];
    }
  }
  // Bash (or PowerShell) tool: the plugin/CLI name, if any, is only visible in
  // the actual shell command text, not in tool_name (which is just "Bash").
  const command =
    toolInput && typeof toolInput.command === "string"
      ? toolInput.command.toLowerCase()
      : "";
  if (command) {
    for (const key of Object.keys(CLI_MAP)) {
      if (command.includes(key)) return CLI_MAP[key];
    }
  }
  return null;
}

function resolveCommand(commandName) {
  if (!commandName) return null;
  const bare = commandName.replace(/^\//, "").split(/\s/)[0];
  return COMMAND_IDS.has(bare) ? bare : null;
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

const isStopHook = process.argv.includes("--stop");
const isPromptExpansionHook = process.argv.includes("--prompt-expansion");

module.exports = { resolvePlugin, resolveCommand };

async function main() {
  try {
    const raw = await readStdin();
    const input = raw ? JSON.parse(raw) : {};
    let record;
    if (isStopHook) {
      record = {
        ts: new Date().toISOString(),
        engine: "claude",
        project: process.cwd(),
        type: "prompt_end",
        session_id: input.session_id || null,
        prompt_id: input.prompt_id || null,
      };
    } else if (isPromptExpansionHook) {
      const commandId = resolveCommand(input.command_name || null);
      if (!commandId) {
        process.exit(0);
        return;
      } // not one of ours — don't log noise
      record = {
        ts: new Date().toISOString(),
        engine: "claude",
        project: process.cwd(),
        tool: "/" + commandId,
        plugin: commandId,
        session_id: input.session_id || null,
        prompt_id: input.prompt_id || null,
      };
    } else {
      record = {
        ts: new Date().toISOString(),
        engine: "claude",
        project: process.cwd(),
        tool: input.tool_name || null,
        plugin: resolvePlugin(
          input.tool_name || null,
          input.tool_input || null,
        ),
        session_id: input.session_id || null,
        prompt_id: input.prompt_id || null,
      };
    }
    fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
    fs.appendFileSync(LOG_PATH, JSON.stringify(record) + "\n", "utf8");
  } catch {
    // Logging must never break the tool call/turn it's attached to.
  }
  process.exit(0);
}

if (require.main === module) {
  main();
}
