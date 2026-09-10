// base_project:managed
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..", "..");
const workflows = {
  claude: ["source", "claude", "commands", "updates.md"],
  opencode: ["source", "opencode", "command", "updates.md"],
  "opencode-lite": ["source", "opencode", "command-lite", "updates.md"],
  codex: ["source", "codex", "skills", "updates", "SKILL.md"],
};

const requiredInventory = [
  "package.json",
  "package-lock.json",
  "ajv",
  "ajv-formats",
  "@biomejs/biome",
  "typescript",
  "gh",
  "graphifyy",
  "graphify",
  "repomix",
  "jq",
  "@upstash/context7-mcp",
  "@modelcontextprotocol/server-filesystem",
  "mcp-git",
  "source/plugins.json",
  "check-plugin-updates.js",
];

const requiredChecks = [
  "npm outdated --json --all",
  "npm outdated --global --json",
  "uv tool list --outdated",
  "pipx list --outdated",
  "pip list --outdated --format=json",
  "winget list --upgrade-available",
  "brew outdated --json=v2",
  "HOMEBREW_NO_AUTO_UPDATE=1",
  "apt list --upgradable",
  "npm view <package> version --json",
  ".github/dependabot.yml",
];

const statuses = [
  "current",
  "update-in-range",
  "major-update",
  "floating/latest-on-use",
  "not-installed",
  "unknown",
  "unsupported",
  "check-failed",
];

function contentFor(name) {
  return fs.readFileSync(path.join(repoRoot, ...workflows[name]), "utf8");
}

test("updates has one read-only inventory contract in every runtime", () => {
  for (const [runtime, source] of Object.entries(workflows)) {
    const content = contentFor(runtime);
    assert.match(content, /base_project:managed/, `${runtime} is managed`);
    assert.match(
      content,
      /~\/.base_project\/repo-path\.txt/i,
      `${runtime} resolves base_project rather than the current project`,
    );
    assert.match(
      content,
      /unrelated current project/i,
      `${runtime} scopes the repo`,
    );
    assert.match(
      content,
      /\ball\b/i,
      `${runtime} supports explicit full catalog scope`,
    );
    assert.match(
      content,
      /user's language/i,
      `${runtime} localizes its report`,
    );
    assert.match(
      content,
      /never read\s+`.env` values/i,
      `${runtime} protects secrets`,
    );
    assert.match(
      content,
      /never run[\s\S]*?npm install/i,
      `${runtime} prohibits mutation`,
    );
    assert.match(
      content,
      /separate[\s\S]*explicit/i,
      `${runtime} separates applying updates`,
    );
    assert.match(
      content,
      /before and after/i,
      `${runtime} defines the manual mutation comparison`,
    );

    for (const term of requiredInventory) {
      assert.match(
        content,
        new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
      );
    }
    for (const command of requiredChecks) {
      assert.match(
        content,
        new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
      );
    }
    for (const status of statuses) {
      assert.match(content, new RegExp(`\\b${status}\\b`, "i"));
    }

    assert.equal(
      source.at(-1),
      runtime === "codex" ? "SKILL.md" : "updates.md",
    );
  }
});

test("updates remains separate from the mutating base_project update path", () => {
  for (const runtime of ["claude", "opencode", "opencode-lite"]) {
    const updates = contentFor(runtime);
    const update = fs.readFileSync(
      path.join(repoRoot, ...workflows[runtime].slice(0, -1), "update.md"),
      "utf8",
    );
    assert.match(
      updates,
      /\/updates`?.*?(?:not|distinct).*?\/update/is,
      `${runtime} keeps /updates distinct`,
    );
    assert.match(
      update,
      /git .*pull/i,
      `${runtime} /update retains the pull path`,
    );
  }

  const codexUpdates = contentFor("codex");
  const codexUpdate = fs.readFileSync(
    path.join(repoRoot, "source", "codex", "skills", "update", "SKILL.md"),
    "utf8",
  );
  assert.match(codexUpdates, /\$updates.*?(?:not|distinct).*?\$update/is);
  assert.match(codexUpdate, /fast-forward pull/i);
});
