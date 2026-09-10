// base_project:managed
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..", "..");

const globalInstructions = {
  claude: ["source", "CLAUDE.md"],
  opencode: ["source", "opencode-instructions.md"],
  codex: ["source", "codex", "AGENTS.md"],
};

const bootstrapWorkflows = {
  claude: ["source", "claude", "commands", "bootstrap.md"],
  opencode: ["source", "opencode", "command", "bootstrap.md"],
  "opencode-lite": ["source", "opencode", "command-lite", "bootstrap.md"],
  codex: ["source", "codex", "skills", "bootstrap", "SKILL.md"],
};

const shipWorkflows = {
  claude: ["source", "claude", "commands", "ship.md"],
  opencode: ["source", "opencode", "command", "ship.md"],
  "opencode-lite": ["source", "opencode", "command-lite", "ship.md"],
  codex: ["source", "codex", "skills", "ship", "SKILL.md"],
};

function contentAt(...segments) {
  return fs.readFileSync(path.join(repoRoot, ...segments), "utf8");
}

test("every global instruction file defines the multi-agent branch/worktree convention", () => {
  for (const [runtime, source] of Object.entries(globalInstructions)) {
    const content = contentAt(...source);
    assert.match(
      content,
      /<agent-id>\/<slug>/,
      `${runtime} defines the <agent-id>/<slug> branch convention`,
    );
    assert.match(
      content,
      /main.{0,80}only receives reviewed, merged work/is,
      `${runtime} states main only receives reviewed, merged work`,
    );
    assert.match(
      content,
      /git worktree/i,
      `${runtime} mentions git worktree isolation`,
    );
    assert.doesNotMatch(
      content,
      /Branch_<AIName>/,
      `${runtime} does not use the literal Branch_<AIName> naming, which was generalized`,
    );
  }
});

test("Claude's convention prefers the native EnterWorktree tool; opencode/Codex fall back to manual git worktree add", () => {
  const claude = contentAt(...globalInstructions.claude);
  assert.match(
    claude,
    /EnterWorktree/,
    "Claude references its native worktree tool",
  );

  for (const runtime of ["opencode", "codex"]) {
    const content = contentAt(...globalInstructions[runtime]);
    assert.match(
      content,
      /no native worktree tool/i,
      `${runtime} states it has no native worktree tool`,
    );
    assert.match(
      content,
      /git worktree add .*-b <agent-id>\/<slug>/,
      `${runtime} gives the explicit manual worktree command`,
    );
  }
});

test("project-standards.md carries the multi-agent version-control checklist item", () => {
  const content = contentAt(
    "source",
    "claude",
    "references",
    "project-standards.md",
  );
  assert.match(
    content,
    /more than one AI\/agent develops this project/i,
    "project-standards.md scopes the check to multi-agent projects",
  );
  assert.match(
    content,
    /<agent-id>\/<slug>/,
    "project-standards.md references the same branch convention",
  );
});

test("every bootstrap workflow references the branch/worktree convention without restating it", () => {
  for (const [runtime, source] of Object.entries(bootstrapWorkflows)) {
    const content = contentAt(...source);
    assert.match(
      content,
      /Multi-[Aa]gent\s[Bb]ranching\s(?:and|&)\s[Ww]orktrees/,
      `${runtime} bootstrap points at the convention by name`,
    );
    assert.match(
      content,
      /<agent-id>\/<slug>/,
      `${runtime} bootstrap names the convention's shape`,
    );
  }
});

test("every ship workflow notes the default-branch case without adding a new push block", () => {
  for (const [runtime, source] of Object.entries(shipWorkflows)) {
    const content = contentAt(...source);
    assert.match(
      content,
      /Multi-[Aa]gent\s[Bb]ranching\s(?:and|&)\s[Ww]orktrees/,
      `${runtime} ship references the convention by name`,
    );
    assert.match(
      content,
      /does not block the push/i,
      `${runtime} ship keeps shipping whatever branch it's asked to`,
    );
    // Existing force-push and default-branch contract must remain intact.
    assert.match(
      content,
      /force-push/i,
      `${runtime} ship still documents its never-force-push rule`,
    );
  }
});
