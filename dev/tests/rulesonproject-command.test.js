// base_project:managed
// Contract for GOALS 22: the rulesonproject command in four variants, its place in the menus
// and docs, the uninstall carve-out for the overrides, and the compact matcher in the installers.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { ENFORCED } = require("../scripts/ai-style-lint.js");

const repoRoot = path.resolve(__dirname, "..", "..");
const read = (relative) =>
  fs.readFileSync(path.join(repoRoot, relative), "utf8");

const VARIANTS = {
  claude: "source/claude/commands/rulesonproject.md",
  opencode: "source/opencode/command/rulesonproject.md",
  "opencode-lite": "source/opencode/command-lite/rulesonproject.md",
  codex: "source/codex/skills/rulesonproject/SKILL.md",
};
const UNINSTALL = [
  "source/claude/commands/uninstall.md",
  "source/opencode/command/uninstall.md",
  "source/opencode/command-lite/uninstall.md",
  "source/codex/skills/uninstall/SKILL.md",
];
const MENUS = {
  "source/claude/references/command-menu.md": "`/rulesonproject`",
  "source/opencode/references/command-menu.md": "`/rulesonproject`",
  "source/codex/references/command-menu.md": "`$rulesonproject`",
};
const INSTALLERS = [
  "dev/scripts/install.sh",
  "dev/scripts/install.ps1",
  "dev/scripts/install-codex.js",
];

test("every variant runs the shared script and keeps the three gates", () => {
  for (const [runtime, file] of Object.entries(VARIANTS)) {
    const content = read(file);
    assert.ok(content.includes("# base_project:managed"), runtime);
    assert.ok(
      content.includes("node ~/.claude/base_project/hooks/project-rules.js"),
      `${runtime} script path`,
    );
    assert.ok(
      content.includes("Ask the user to approve it. Wait."),
      `${runtime} approval gate`,
    );
    assert.match(
      content,
      /again with `--allow-protected` only after a yes\./,
      `${runtime} protected gate`,
    );
    assert.ok(
      content.includes(
        "Add an override only when the user asks for it in chat.",
      ),
      `${runtime} chat-only rule`,
    );
    for (const name of ["list", "remove", "find", "render", "adopt", "key"]) {
      assert.ok(content.includes(`\`${name}`), `${runtime} ${name}`);
    }
  }
});

test("opencode variants say that overrides are not printed at session start", () => {
  for (const runtime of ["opencode", "opencode-lite"]) {
    const content = read(VARIANTS[runtime]);
    assert.ok(
      content.includes("does not print overrides at session start"),
      runtime,
    );
    assert.ok(content.includes("/rulesonproject render"), runtime);
  }
  for (const runtime of ["claude", "codex"]) {
    assert.ok(
      !read(VARIANTS[runtime]).includes("does not print overrides"),
      runtime,
    );
  }
});

test("the command is registered in the menus and the docs", () => {
  for (const [file, spelling] of Object.entries(MENUS)) {
    assert.ok(read(file).includes(spelling), file);
  }
  for (const file of ["README.md", "ARCHITECTURE.md", "dev/ROADMAP.md"]) {
    assert.ok(read(file).includes("rulesonproject"), file);
  }
});

test("uninstall keeps the project overrides with the user's data", () => {
  for (const file of UNINSTALL) {
    assert.ok(read(file).split("project-rules/").length - 1 >= 2, file);
  }
});

test("the installers register the SessionStart hook for compact too", () => {
  for (const file of INSTALLERS) {
    const content = read(file);
    assert.ok(content.includes("startup|resume|clear|compact"), file);
    assert.ok(!/startup\|resume\|clear(?!\|compact)/.test(content), file);
  }
});

test("the four variants are in the enforced AI-style list", () => {
  for (const file of Object.values(VARIANTS)) {
    assert.ok(ENFORCED.includes(file), file);
  }
});

test("the SessionStart hook loads its library from the same folder", () => {
  assert.ok(
    read("source/hooks/session-start-git-context.js").includes(
      'require("./project-rules.js")',
    ),
  );
  assert.ok(
    fs.existsSync(path.join(repoRoot, "source", "hooks", "project-rules.js")),
  );
});
