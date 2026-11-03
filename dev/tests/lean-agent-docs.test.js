// base_project:managed
// Contract for GOALS 19: executor-v1 plans, tiered dispatch, the AI-facing writing standard,
// and the BLUF output rule — across Claude, opencode dense, opencode lite and Codex.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { lintText } = require("../scripts/ai-style-lint.js");

const repoRoot = path.resolve(__dirname, "..", "..");
const read = (relative) =>
  fs.readFileSync(path.join(repoRoot, relative), "utf8");

const REFERENCE = "source/claude/references/ai-writing-standard.md";
const REFERENCE_COPY = "source/opencode/references/ai-writing-standard.md";

const RUNTIMES = {
  claude: {
    newgoal: "source/claude/commands/newgoal.md",
    execgoals: "source/claude/commands/execgoals.md",
    reference: "~/.claude/base_project/references/ai-writing-standard.md",
    mapping: "`light` → `haiku`",
  },
  opencode: {
    newgoal: "source/opencode/command/newgoal.md",
    execgoals: "source/opencode/command/execgoals.md",
    reference:
      "~/.config/opencode/base_project/references/ai-writing-standard.md",
    mapping: "`@coder`",
  },
  "opencode-lite": {
    newgoal: "source/opencode/command-lite/newgoal.md",
    execgoals: "source/opencode/command-lite/execgoals.md",
    reference:
      "~/.config/opencode/base_project/references/ai-writing-standard.md",
    mapping: "`@coder`",
  },
  codex: {
    newgoal: "source/codex/skills/newgoal/SKILL.md",
    execgoals: "source/codex/skills/execgoals/SKILL.md",
    reference: "~/.codex/base_project/references/ai-writing-standard.md",
    mapping: "advisory",
  },
};

const GLOBAL_RULE_FILES = [
  "source/CLAUDE.md",
  "source/opencode-instructions.md",
  "source/codex/AGENTS.md",
];
const BLUF_BULLET =
  "- Put the answer, the decision, or the result in the first sentence; give the evidence after it. Use short sentences of about 15 words, active voice, and one fact per sentence. Report work status as done, blocked (with the reason), or next.";

const GOAL_TYPES = ["build", "feature", "fix", "process", "research"];

test("the AI writing standard ships as two identical managed copies", () => {
  const reference = read(REFERENCE);
  assert.equal(read(REFERENCE_COPY), reference);
  assert.ok(reference.startsWith("# base_project:managed"));
  for (const heading of [
    "## A. Text an agent follows (English)",
    "## B. Glossary: one word, one meaning",
    "## C. Text the user reads (the user's language)",
  ]) {
    assert.ok(reference.includes(heading), heading);
  }
  assert.match(reference, /Answer the user in the user's language/);
});

test("every newgoal variant writes executor-v1 plans with its own reference path", () => {
  for (const [runtime, files] of Object.entries(RUNTIMES)) {
    const content = read(files.newgoal);
    assert.ok(content.includes("Format: executor-v1"), runtime);
    assert.ok(content.includes(files.reference), `${runtime} reference path`);
    assert.ok(content.includes("tier: user"), runtime);
    assert.ok(content.includes("Owner backlog"), runtime);
    assert.ok(!content.includes("Suggested: <"), `${runtime} Suggested line`);
  }
});

test("every execgoals variant dispatches executor-v1 items and keeps old plans on the old path", () => {
  for (const [runtime, files] of Object.entries(RUNTIMES)) {
    const content = read(files.execgoals);
    for (const phrase of [
      "Format: executor-v1",
      "- proof:",
      "BLOCKED",
      "Owner backlog",
      files.mapping,
      "Old-format sections are archived only when every",
    ]) {
      assert.ok(content.includes(phrase), `${runtime}: ${phrase}`);
    }
    assert.ok(!/Read the whole file/i.test(content), `${runtime} full read`);
  }
});

test("the BLUF bullet occurs exactly once in each global rule file", () => {
  for (const file of GLOBAL_RULE_FILES) {
    assert.equal(read(file).split(BLUF_BULLET).length - 1, 1, file);
  }
});

test("goal-type modules carry the executor-v1 check paragraph in both identical trees", () => {
  for (const name of GOAL_TYPES) {
    const claude = read(`source/claude/references/goal-types/${name}.md`);
    const opencode = read(`source/opencode/references/goal-types/${name}.md`);
    assert.equal(opencode, claude, name);
    assert.ok(
      claude.includes("In an executor-v1 plan, write this as the item's"),
      name,
    );
  }
});

test("lintText flags each rule and passes a clean line", () => {
  const rules = (text) => lintText(text).map((finding) => finding.rule);
  assert.deepEqual(rules("Verify the output."), ["banned-term"]);
  assert.deepEqual(rules("You should run it."), ["modal"]);
  assert.deepEqual(rules("Run it — then stop."), ["dash-aside"]);
  assert.deepEqual(rules(`${"word ".repeat(26).trim()}.`), ["long-sentence"]);
  assert.deepEqual(rules("Run `verify --should` and stop."), []);
  assert.deepEqual(rules("| verify | table rows are skipped |"), []);
  assert.deepEqual(rules("```\nVerify inside a fence.\n```"), []);
});

test("the enforced files pass the AI-style lint", () => {
  const result = spawnSync(
    process.execPath,
    [path.join(repoRoot, "dev", "scripts", "ai-style-lint.js"), "--enforce"],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stdout);
});
