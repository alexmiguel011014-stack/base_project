// base_project:managed
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..", "..");

// The "what do you want to do now?" menu is ~3.8k characters of Portuguese. A rule that also
// printed it after every finished task cost that on each task and kept it in the context for the
// rest of the session (ROADMAP item 56). It is shown once, at session start, and on demand.
const CLAUDE_HEADING =
  /^### "What do you want to do now\?" menu \(WhatsApp-style\)$/m;
const RULE_FILES = [
  {
    file: ["source", "CLAUDE.md"],
    heading: CLAUDE_HEADING,
    reference: "~/.claude/base_project/references/command-menu.md",
    onDemand: "`/wpp`",
  },
  {
    file: ["source", "opencode-instructions.md"],
    heading: CLAUDE_HEADING,
    reference: "~/.config/opencode/base_project/references/command-menu.md",
    onDemand: "`/wpp`",
  },
  {
    file: ["source", "codex", "AGENTS.md"],
    heading: /^### WhatsApp-Style Menu$/m,
    reference: "~/.codex/base_project/references/command-menu.md",
    onDemand: "`$wpp`",
  },
];

const PROHIBITION =
  /Never show it after finishing a task or after any reply: a finished task ends with its result, not with a list of commands\./;

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, ...relativePath), "utf8");
}

// Whitespace-collapsed: the same sentence is hard-wrapped differently across the rule files.
function collapse(text) {
  return text.replace(/\s+/g, " ");
}

// From the heading to the next `### ` heading.
function menuSection(content, heading) {
  const start = content.search(heading);
  assert.notEqual(start, -1, `menu heading not found: ${heading}`);
  const rest = content.slice(start);
  const next = rest.indexOf("\n### ", 1);
  return collapse(next === -1 ? rest : rest.slice(0, next));
}

test("every global rule file shows the menu only at session start", () => {
  for (const rule of RULE_FILES) {
    const section = menuSection(read(rule.file), rule.heading);
    const name = rule.file.join("/");
    assert.match(section, /only at the (very )?start of a session/i, name);
    assert.ok(
      section.includes(rule.reference),
      `${name} cites its own menu file`,
    );
    const withoutProhibition = section.replace(PROHIBITION, "");
    assert.doesNotMatch(
      withoutProhibition,
      /after (closing|completing|finishing)|substantial task|two moments/i,
      `${name} must not bring back a post-task trigger`,
    );
  }
});

test("every global rule file forbids the menu after a task and names the on-demand command", () => {
  for (const rule of RULE_FILES) {
    const section = menuSection(read(rule.file), rule.heading);
    const name = rule.file.join("/");
    assert.match(
      section,
      PROHIBITION,
      `${name} needs the explicit prohibition`,
    );
    assert.ok(
      section.includes(rule.onDemand),
      `${name} points at ${rule.onDemand}`,
    );
  }
});

test("the diary suggestion carries its own threshold instead of borrowing the menu rule's", () => {
  for (const file of [
    ["source", "CLAUDE.md"],
    ["source", "opencode-instructions.md"],
  ]) {
    const content = collapse(read(file));
    assert.doesNotMatch(
      content,
      /the same threshold the menu rule/i,
      file.join("/"),
    );
    assert.ok(
      content.includes(
        "After closing a substantial task (multiple file edits, subagents, or TodoWrite involved)",
      ),
      `${file.join("/")} keeps the diary threshold`,
    );
  }
});

test("the /wpp wrappers do not promise an automatic menu after a task", () => {
  for (const file of [
    ["source", "claude", "commands", "wpp.md"],
    ["source", "opencode", "command", "wpp.md"],
    ["source", "opencode", "command-lite", "wpp.md"],
    ["source", "codex", "skills", "wpp", "SKILL.md"],
  ]) {
    const content = collapse(read(file));
    const name = file.join("/");
    assert.doesNotMatch(
      content.replace(/never shown on its own after a task/gi, ""),
      /after (a |the )?(substantial )?task|after substantial work|two automatic moments/i,
      name,
    );
  }
});

test("README and ARCHITECTURE describe /wpp without an after-task menu", () => {
  const row = (file, marker) =>
    read(file)
      .split("\n")
      .find((line) => line.startsWith(marker));
  const readme = row(["README.md"], "| `/wpp` |");
  const architecture = row(["ARCHITECTURE.md"], "| `/wpp` |");
  assert.ok(readme, "README has a /wpp row");
  assert.ok(architecture, "ARCHITECTURE has a /wpp row");
  assert.doesNotMatch(
    readme.replace(/never shown on its own after a task/i, ""),
    /after a (substantial )?task/i,
  );
  assert.doesNotMatch(architecture, /fim de tarefa/i);
});
