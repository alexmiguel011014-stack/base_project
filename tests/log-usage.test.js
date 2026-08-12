// base_project:managed
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  resolvePlugin,
  resolveCommand,
} = require("../source/dashboard/log-usage.js");

test("resolvePlugin: Skill tool resolves via tool_input.skill, not tool_name", () => {
  assert.equal(resolvePlugin("Skill", { skill: "ponytail-help" }), "ponytail");
  assert.equal(resolvePlugin("Skill", { skill: "impeccable" }), "impeccable");
  assert.equal(resolvePlugin("Skill", { skill: "unknown-skill" }), null);
  assert.equal(resolvePlugin("Skill", null), null);
});

test("resolvePlugin: MCP tool name resolves via the mcp__<server>__ prefix", () => {
  assert.equal(resolvePlugin("mcp__github__get_me", {}), "github");
  assert.equal(resolvePlugin("mcp__playwright__navigate", {}), "playwright");
});

test("resolvePlugin: Bash command text resolves via CLI_MAP substring match", () => {
  assert.equal(
    resolvePlugin("Bash", { command: "strix-agent scan ." }),
    "strix",
  );
  assert.equal(
    resolvePlugin("Bash", { command: "headroom compress out.json" }),
    "headroom",
  );
  assert.equal(resolvePlugin("Bash", { command: "git status" }), null);
});

test("resolvePlugin: unrecognized tool/command returns null, never throws", () => {
  assert.equal(resolvePlugin(null, null), null);
  assert.equal(resolvePlugin("Read", { file_path: "x.js" }), null);
});

test("resolveCommand: strips leading slash and trailing arguments", () => {
  assert.equal(resolveCommand("/plugins"), "plugins");
  assert.equal(resolveCommand("/plugins minimal"), "plugins");
  assert.equal(resolveCommand("/dashboard"), "dashboard");
});

test("resolveCommand: unknown command or empty input returns null", () => {
  assert.equal(resolveCommand("/not-ours"), null);
  assert.equal(resolveCommand(null), null);
  assert.equal(resolveCommand(""), null);
});
