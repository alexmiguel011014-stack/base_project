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

test("Codex skill names have exact parity with all command sets", () => {
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
  const opencodeLite = names(
    path.join(repoRoot, "source", "opencode", "command-lite"),
    ".md",
  );
  assert.equal(codex.length, 21);
  assert.deepEqual(codex, claude);
  assert.deepEqual(codex, opencode);
  assert.deepEqual(codex, opencodeLite);

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
  const readWorkflow = (variant, name) => {
    if (variant === "codex") return readSkill(name);
    const source =
      variant === "claude"
        ? ["source", "claude", "commands"]
        : variant === "opencode"
          ? ["source", "opencode", "command"]
          : ["source", "opencode", "command-lite"];
    return fs.readFileSync(
      path.join(repoRoot, ...source, `${name}.md`),
      "utf8",
    );
  };

  for (const variant of ["claude", "opencode", "opencode-lite", "codex"]) {
    assert.match(readWorkflow(variant, "newgoal"), /never execute/i);
    assert.match(readWorkflow(variant, "newgoal"), /GOALS\.md/i);
    assert.match(
      readWorkflow(variant, "newgoal"),
      /goals-archive\/README\.md/i,
    );
    assert.match(readWorkflow(variant, "repertoire"), /never execute/i);
    assert.match(readWorkflow(variant, "repertoire"), /REPERTOIRE\.md/i);
    assert.match(readWorkflow(variant, "ship"), /never force-push/i);
    assert.match(readWorkflow(variant, "execgoals"), /auto-approved/i);
    assert.match(readWorkflow(variant, "execgoals"), /notify-and-proceed/i);
    assert.match(readWorkflow(variant, "execgoals"), /human-in-the-loop/i);
    assert.match(
      readWorkflow(variant, "execgoals"),
      /validate-goals-structure\.js/i,
    );
  }

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
  assert.match(readSkill("usagebp"), /~\/\.claude\/base_project\/usage\//);
});

test("newgoal keeps runtime-specific model and final-response contracts", () => {
  const read = (relativePath) =>
    fs.readFileSync(path.join(repoRoot, ...relativePath), "utf8");
  const workflows = {
    claude: read(["source", "claude", "commands", "newgoal.md"]),
    opencode: read(["source", "opencode", "command", "newgoal.md"]),
    "opencode-lite": read(["source", "opencode", "command-lite", "newgoal.md"]),
    codex: read(["source", "codex", "skills", "newgoal", "SKILL.md"]),
  };

  for (const [runtime, content] of Object.entries(workflows)) {
    assert.match(
      content,
      /never execute/i,
      `${runtime} must remain planning-only`,
    );
    assert.match(content, /GOALS\.md/i, `${runtime} must write the plan`);
  }

  for (const runtime of ["claude", "opencode", "opencode-lite"]) {
    assert.match(workflows[runtime], /haiku\s*\/\s*low/i);
    assert.match(workflows[runtime], /sonnet\s*\/\s*medium/i);
    assert.match(workflows[runtime], /opus\s*\/\s*xhigh/i);
  }

  const codexMappingStart = workflows.codex.indexOf(
    "### Codex-specific model mapping",
  );
  const codexMappingEnd = workflows.codex.indexOf("7. If `GOALS.md` exists");
  assert.ok(codexMappingStart >= 0);
  assert.ok(codexMappingEnd > codexMappingStart);
  const codexMapping = workflows.codex.slice(
    codexMappingStart,
    codexMappingEnd,
  );
  assert.doesNotMatch(codexMapping, /\b(?:haiku|sonnet|opus)\b/i);
  for (const pair of [
    "gpt-5.6-luna · low",
    "gpt-5.6-terra · medium",
    "gpt-5.6-sol · high",
    "gpt-6-astra · xhigh",
  ]) {
    assert.match(codexMapping, new RegExp(pair.replace("·", "\\s*·\\s*")));
  }
  assert.match(
    codexMapping,
    /gpt-6-astra.*gpt-5\.6-sol.*gpt-5\.6-terra.*gpt-5\.6-luna/is,
  );
  assert.match(codexMapping, /preserve the requested effort/i);
  assert.match(
    codexMapping,
    /disclose both the fallback and the changed effort/i,
  );

  const finalContract = workflows.codex.slice(
    workflows.codex.indexOf("9. Report the path"),
  );
  assert.match(finalContract, /exactly one\s+localized final sentence/i);
  assert.equal(
    (finalContract.match(/\*\*<Codex model> · <effort>\*\*/g) || []).length,
    1,
  );
  assert.match(
    finalContract,
    /concrete reason tied to the plan's highest-risk module/i,
  );
  assert.match(finalContract, /manual-only disclaimer/i);
  assert.match(
    finalContract,
    /does not automatically change the\s+selected model, effort, or Codex configuration/i,
  );
  assert.match(finalContract, /\$execgoals.*adjust the plan first/is);
  assert.match(finalContract, /only a `Suggested:` line inside `GOALS\.md`/i);
});

test("Batching and stopping guidance has exact parity across native layers", () => {
  const guidance =
    "### Batching and stopping\n- Batch independent reads and checks, reuse evidence already gathered, and validate once at each area boundary. Stop after the scoped work is verified complete or a real blocker requires user input; do not speculate, retry blindly, or continue into unrelated work. Never use batching or stopping to bypass plan, safety, or diary boundaries.";
  const paths = [
    ["source", "CLAUDE.md"],
    ["source", "opencode-instructions.md"],
    ["source", "codex", "AGENTS.md"],
    ["source", "claude", "commands", "execgoals.md"],
    ["source", "claude", "commands", "fixproject.md"],
    ["source", "claude", "commands", "ship.md"],
    ["source", "opencode", "command", "execgoals.md"],
    ["source", "opencode", "command", "fixproject.md"],
    ["source", "opencode", "command", "ship.md"],
    ["source", "opencode", "command-lite", "execgoals.md"],
    ["source", "opencode", "command-lite", "fixproject.md"],
    ["source", "opencode", "command-lite", "ship.md"],
    ["source", "codex", "skills", "execgoals", "SKILL.md"],
    ["source", "codex", "skills", "fixproject", "SKILL.md"],
    ["source", "codex", "skills", "ship", "SKILL.md"],
  ];

  for (const relativePath of paths) {
    const content = fs.readFileSync(
      path.join(repoRoot, ...relativePath),
      "utf8",
    );
    assert.equal(
      content.split(guidance).length - 1,
      1,
      `${relativePath.join("/")} must contain exactly one shared guidance block`,
    );
  }
});

test("Codex installer synchronizes native layers and is idempotent", () => {
  const roots = temporaryRoots();
  try {
    install(roots);
    install(roots);

    const sourceNewgoal = fs.readFileSync(
      path.join(repoRoot, "source", "codex", "skills", "newgoal", "SKILL.md"),
      "utf8",
    );
    const installedNewgoal = fs.readFileSync(
      path.join(roots.agents, "skills", "newgoal", "SKILL.md"),
      "utf8",
    );
    assert.equal(installedNewgoal, sourceNewgoal);

    const sourceUpdates = fs.readFileSync(
      path.join(repoRoot, "source", "codex", "skills", "updates", "SKILL.md"),
      "utf8",
    );
    const installedUpdates = fs.readFileSync(
      path.join(roots.agents, "skills", "updates", "SKILL.md"),
      "utf8",
    );
    assert.equal(installedUpdates, sourceUpdates);

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
    const formatterGroups = hooks.hooks.PostToolUse.filter((group) =>
      group.hooks.some((hook) =>
        hook.command.includes("base_project/hooks/post-edit-format.js"),
      ),
    );
    assert.equal(formatterGroups.length, 1);
    assert.equal(
      formatterGroups[0].matcher,
      "apply_patch|Edit|Write|MultiEdit",
    );
    const goalsValidationGroups = hooks.hooks.PostToolUse.filter((group) =>
      group.hooks.some((hook) =>
        hook.command.includes("base_project/hooks/validate-goals.js"),
      ),
    );
    assert.equal(goalsValidationGroups.length, 1);
    assert.equal(
      goalsValidationGroups[0].matcher,
      "apply_patch|Edit|Write|MultiEdit",
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
