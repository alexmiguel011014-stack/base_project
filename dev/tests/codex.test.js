// base_project:managed
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..", "..");

function names(root, extension, directories = false) {
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) =>
      directories
        ? entry.isDirectory()
        : entry.isFile() && entry.name.endsWith(extension),
    )
    .map((entry) =>
      directories ? entry.name : path.basename(entry.name, extension),
    )
    .sort();
}

function temporaryRoots() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bp-codex-"));
  const codex = path.join(root, ".codex");
  const agents = path.join(root, ".agents");
  const claude = path.join(root, ".claude");
  fs.mkdirSync(codex, { recursive: true });
  fs.writeFileSync(path.join(codex, "AGENTS.md"), "user rule\n", "utf8");
  fs.writeFileSync(
    path.join(codex, "hooks.json"),
    JSON.stringify({
      hooks: {
        PostToolUse: [{ hooks: [{ type: "command", command: "custom-hook" }] }],
      },
    }),
    "utf8",
  );
  return { root, codex, agents, claude };
}

function install(roots) {
  execFileSync(process.execPath, ["dev/scripts/install-codex.js"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      BASE_PROJECT_CODEX_ROOT: roots.codex,
      BASE_PROJECT_AGENTS_ROOT: roots.agents,
      BASE_PROJECT_CLAUDE_ROOT: roots.claude,
    },
    encoding: "utf8",
  });
}

test("Codex skill names have exact parity with both command sets", () => {
  const codex = names(
    path.join(repoRoot, "source", "codex", "skills"),
    "",
    true,
  );
  const claude = names(
    path.join(repoRoot, "source", "claude", "commands"),
    ".md",
  );
  const opencode = names(
    path.join(repoRoot, "source", "opencode", "command"),
    ".md",
  );
  assert.equal(codex.length, 21);
  assert.deepEqual(codex, claude);
  assert.deepEqual(codex, opencode);

  for (const name of codex) {
    const skill = fs.readFileSync(
      path.join(repoRoot, "source", "codex", "skills", name, "SKILL.md"),
      "utf8",
    );
    assert.match(skill, /^---\r?\n/);
    assert.match(skill, /base_project:managed/);
    assert.match(skill, new RegExp(`^name: ${name}$`, "m"));
    assert.match(skill, /^description: .+/m);
  }
});

test("Codex menu and high-risk workflow boundaries stay faithful", () => {
  const skillRoot = path.join(repoRoot, "source", "codex", "skills");
  const skillNames = names(skillRoot, "", true);
  const menu = fs.readFileSync(
    path.join(repoRoot, "source", "codex", "references", "command-menu.md"),
    "utf8",
  );
  for (const name of skillNames) {
    assert.match(
      menu,
      new RegExp(`\\$${name}\\b`),
      `menu must include $${name}`,
    );
  }

  const readSkill = (name) =>
    fs.readFileSync(path.join(skillRoot, name, "SKILL.md"), "utf8");
  assert.match(readSkill("newgoal"), /Hard boundary: never execute/i);
  assert.match(readSkill("repertoire"), /Hard boundary: never execute/i);
  assert.match(readSkill("council"), /Always confirm before running/i);
  assert.match(readSkill("ship"), /Never force-push/i);
  assert.match(readSkill("uninstall"), /confirm each tier separately/i);
  assert.match(
    readSkill("diario"),
    /Never write diary content inside any repository/i,
  );
  assert.match(readSkill("diario"), /~\/\.base_project\/diary-root\.txt/);
  assert.match(readSkill("reviewusage"), /~\/\.claude\/base_project\/usage\//);
});

test("Codex installer synchronizes native layers and is idempotent", () => {
  const roots = temporaryRoots();
  try {
    install(roots);
    install(roots);

    assert.equal(names(path.join(roots.agents, "skills"), "", true).length, 21);
    assert.deepEqual(names(path.join(roots.codex, "agents"), ".toml"), [
      "architect",
      "coder",
      "reviewer",
    ]);
    assert.ok(
      fs.existsSync(
        path.join(
          roots.codex,
          "base_project",
          "references",
          "goal-types",
          "fix.md",
        ),
      ),
    );
    assert.ok(
      fs.existsSync(
        path.join(roots.codex, "base_project", "references", "command-menu.md"),
      ),
    );
    assert.ok(
      fs.existsSync(path.join(roots.codex, "base_project", "plugins.json")),
    );

    const instructions = fs.readFileSync(
      path.join(roots.codex, "AGENTS.md"),
      "utf8",
    );
    assert.match(instructions, /^user rule$/m);
    assert.equal(
      (instructions.match(/<!-- base_project:start -->/g) || []).length,
      1,
    );

    const hooks = JSON.parse(
      fs.readFileSync(path.join(roots.codex, "hooks.json"), "utf8"),
    );
    assert.ok(
      hooks.hooks.PostToolUse.some(
        (group) => group.hooks[0].command === "custom-hook",
      ),
    );
    assert.equal(
      hooks.hooks.PostToolUse.filter((group) =>
        group.hooks.some((hook) =>
          hook.command.includes("base_project/hooks/usage-log.js"),
        ),
      ).length,
      1,
    );
    assert.equal(
      hooks.hooks.UserPromptSubmit.filter((group) =>
        group.hooks.some((hook) =>
          hook.command.includes("base_project/hooks/usage-log.js"),
        ),
      ).length,
      1,
    );
  } finally {
    fs.rmSync(roots.root, { recursive: true, force: true });
  }
});

test("Codex installer preserves a colliding user-owned skill", () => {
  const roots = temporaryRoots();
  try {
    const userSkill = path.join(roots.agents, "skills", "wpp", "SKILL.md");
    fs.mkdirSync(path.dirname(userSkill), { recursive: true });
    fs.writeFileSync(userSkill, "user-owned skill\n", "utf8");
    install(roots);
    assert.equal(fs.readFileSync(userSkill, "utf8"), "user-owned skill\n");
  } finally {
    fs.rmSync(roots.root, { recursive: true, force: true });
  }
});
