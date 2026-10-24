// base_project:managed
// Per-project rule overrides (GOALS 20): project key, store, protected-rule gate, render cap and
// the SessionStart integration. Everything runs against a throwaway home and throwaway repos.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");
const rules = require("../../source/hooks/project-rules.js");

const repoRoot = path.resolve(__dirname, "..", "..");
const CLI = path.join(repoRoot, "source", "hooks", "project-rules.js");
const HOOK = path.join(
  repoRoot,
  "source",
  "hooks",
  "session-start-git-context.js",
);
const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "t",
  GIT_AUTHOR_EMAIL: "t@t.t",
  GIT_COMMITTER_NAME: "t",
  GIT_COMMITTER_EMAIL: "t@t.t",
};

const created = [];
function temp(prefix) {
  const dir = fs.realpathSync.native(
    fs.mkdtempSync(path.join(os.tmpdir(), prefix)),
  );
  created.push(dir);
  return dir;
}
test.after(() => {
  for (const dir of created) fs.rmSync(dir, { recursive: true, force: true });
});

// A home with installed rules, a normal command and a safety-gated command.
function fakeHome() {
  const home = temp("bp-rop-home-");
  const claude = path.join(home, ".claude");
  fs.mkdirSync(path.join(claude, "commands"), { recursive: true });
  fs.writeFileSync(
    path.join(claude, "CLAUDE.md"),
    [
      "## base_project - Global Operating Rules",
      "### Security",
      "- Never commit real API keys.",
      "### Workflow",
      "5. **Tiered autonomy** - classify every action",
      "   before taking it: auto-approved for routine work.",
      "### Task Sizing",
      "- Write notes in English by default.",
    ].join("\n"),
  );
  fs.writeFileSync(
    path.join(claude, "commands", "newgoal.md"),
    "5. **Write `GOALS.md` in English**, regardless of the language.\n",
  );
  fs.writeFileSync(
    path.join(claude, "commands", "ship.md"),
    "Never force-push, ever.\n",
  );
  return home;
}

function repo() {
  const dir = temp("bp-rop-repo-");
  execFileSync("git", ["init", "-q"], { cwd: dir });
  fs.writeFileSync(path.join(dir, "a.txt"), "a");
  execFileSync("git", ["add", "."], { cwd: dir });
  execFileSync(
    "git",
    ["-c", "commit.gpgsign=false", "commit", "-q", "-m", "init"],
    { cwd: dir, env: GIT_ENV },
  );
  return dir;
}

function cli(args, { home, cwd }) {
  const result = spawnSync(
    process.execPath,
    [CLI, ...args, "--home", home, "--cwd", cwd],
    { encoding: "utf8" },
  );
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

test("one repository has one key across subdirectories and git worktrees", () => {
  const main = repo();
  const sub = path.join(main, "sub");
  fs.mkdirSync(sub);
  const tree = path.join(temp("bp-rop-wt-"), "wt");
  execFileSync("git", ["worktree", "add", "-q", tree, "-b", "other"], {
    cwd: main,
  });
  const base = rules.projectInfo(main);
  assert.equal(rules.projectInfo(sub).key, base.key);
  assert.equal(rules.projectInfo(tree).key, base.key);
  assert.equal(rules.projectInfo(tree).root, base.root);
});

test("different directories get different keys, and a non-git directory works", () => {
  const plain = temp("bp-rop-plain-");
  const other = temp("bp-rop-plain-");
  const info = rules.projectInfo(plain);
  assert.match(info.key, /^[a-z0-9-]+-[0-9a-f]{8}$/);
  assert.notEqual(rules.projectInfo(other).key, info.key);
});

test("add, list, render and remove round-trip through the CLI", () => {
  const home = fakeHome();
  const cwd = repo();
  assert.match(cli(["list"], { home, cwd }).stdout, /no overrides/);

  const first = cli(["add", "--rule", "Write notes in Portuguese."], {
    home,
    cwd,
  });
  assert.equal(first.status, 0, first.stderr);
  assert.match(first.stdout, /added O1/);

  const second = cli(
    [
      "add",
      "--replaces",
      "GOALS.md in English",
      "--anchor",
      "Write `GOALS.md` in English",
      "--rule",
      "Write GOALS.md in Portuguese.",
    ],
    { home, cwd },
  );
  assert.equal(second.status, 0, second.stderr);
  assert.match(second.stdout, /added O2/);

  const listed = cli(["list"], { home, cwd }).stdout;
  assert.match(listed, /O1 \| addition \| Write notes in Portuguese\./);
  assert.match(listed, /O2 \| ok \| instead of "GOALS.md in English": /);

  const block = cli(["render"], { home, cwd }).stdout;
  assert.match(block, /^Project overrides for /);
  assert.match(block, /- O1: Write notes in Portuguese\./);
  assert.match(block, /- O2 instead of "GOALS.md in English": /);

  assert.equal(cli(["remove", "O1"], { home, cwd }).status, 0);
  assert.equal(cli(["remove", "O1"], { home, cwd }).status, 1);
  assert.equal(cli(["remove", "O2"], { home, cwd }).status, 0);
  assert.match(cli(["list"], { home, cwd }).stdout, /no overrides/);
  assert.equal(cli(["render"], { home, cwd }).stdout, "");
});

test("a protected rule or a safety-gated command is refused without the flag", () => {
  const home = fakeHome();
  const cwd = repo();
  for (const anchor of [
    "Never commit real API keys",
    "before taking it",
    "Never force-push",
  ]) {
    const refused = cli(["add", "--anchor", anchor, "--rule", "Allow it."], {
      home,
      cwd,
    });
    assert.equal(refused.status, 3, anchor);
    assert.match(refused.stderr, /protected/);
  }
  assert.match(cli(["list"], { home, cwd }).stdout, /no overrides/);

  const allowed = cli(
    [
      "add",
      "--anchor",
      "Never commit real API keys",
      "--rule",
      "Test keys may be committed.",
      "--allow-protected",
    ],
    { home, cwd },
  );
  assert.equal(allowed.status, 0, allowed.stderr);
  assert.match(cli(["list"], { home, cwd }).stdout, /O1 \| protected \|/);
  const found = cli(["find", "Never commit real"], { home, cwd }).stdout;
  assert.match(found, /\[protected\]/);
});

test("an anchor that matches nothing is refused, and a later edit marks the override stale", () => {
  const home = fakeHome();
  const cwd = repo();
  const missing = cli(
    ["add", "--anchor", "no such text anywhere", "--rule", "x"],
    { home, cwd },
  );
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /anchor not found/);

  assert.equal(
    cli(
      [
        "add",
        "--anchor",
        "Write notes in English by default",
        "--rule",
        "Write notes in Portuguese.",
      ],
      { home, cwd },
    ).status,
    0,
  );
  assert.match(cli(["list"], { home, cwd }).stdout, /O1 \| ok \|/);

  const file = path.join(home, ".claude", "CLAUDE.md");
  fs.writeFileSync(
    file,
    fs.readFileSync(file, "utf8").replace("Write notes in English", "Notes"),
  );
  assert.match(cli(["list"], { home, cwd }).stdout, /O1 \| stale \|/);
});

test("the injected block is capped and says how many overrides it hides", () => {
  const many = {
    version: 1,
    path: "x",
    rules: Array.from({ length: 80 }, (_, index) => ({
      id: `O${index + 1}`,
      replaces: null,
      rule: "x".repeat(200),
    })),
  };
  const block = rules.renderBlock(many, "demo");
  assert.ok(block.length <= rules.MAX_BLOCK_CHARS + 120, String(block.length));
  assert.match(block, /\d+ more override\(s\) not shown/);
  assert.equal(
    rules.renderBlock({ version: 1, path: "x", rules: [] }, "d"),
    "",
  );
});

test("renderForCwd is empty without a store and never throws on a corrupt one", () => {
  const home = fakeHome();
  const cwd = repo();
  assert.equal(rules.renderForCwd(cwd, home), "");
  const file = rules.storeFile(rules.projectInfo(cwd).key, home);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, "{ not json");
  assert.equal(rules.renderForCwd(cwd, home), "");
});

test("adopt moves the overrides of a moved project to the new location", () => {
  const home = fakeHome();
  const oldProject = repo();
  const newProject = repo();
  assert.equal(
    cli(["add", "--rule", "Keep replies short."], { home, cwd: oldProject })
      .status,
    0,
  );
  const all = cli(["list", "--all"], { home, cwd: newProject }).stdout;
  const oldKey = rules.projectInfo(oldProject).key;
  assert.ok(all.includes(oldKey), all);
  assert.match(all, /path exists \| 1 override\(s\)/);

  const adopted = cli(["adopt", oldKey], { home, cwd: newProject });
  assert.equal(adopted.status, 0, adopted.stderr);
  assert.match(
    cli(["list"], { home, cwd: newProject }).stdout,
    /O1 \| addition \| Keep replies short\./,
  );
  assert.match(cli(["list"], { home, cwd: oldProject }).stdout, /no overrides/);
});

test("the SessionStart hook prints overrides on every start and only overrides after a compaction", () => {
  const home = fakeHome();
  const cwd = repo();
  fs.writeFileSync(path.join(cwd, "dirty.txt"), "uncommitted");
  const env = { ...process.env, HOME: home, USERPROFILE: home };
  const run = (source) =>
    spawnSync(process.execPath, [HOOK], {
      input: JSON.stringify({ cwd, source }),
      encoding: "utf8",
      env,
    });

  assert.equal(run("compact").stdout, "");

  assert.equal(
    cli(["add", "--rule", "Reply in Portuguese."], { home, cwd }).status,
    0,
  );
  const started = run("startup");
  assert.equal(started.status, 0);
  assert.match(started.stdout, /Git context for this session/);
  assert.match(started.stdout, /- O1: Reply in Portuguese\./);

  const compacted = run("compact");
  assert.equal(compacted.status, 0);
  assert.doesNotMatch(compacted.stdout, /Git context/);
  assert.match(compacted.stdout, /- O1: Reply in Portuguese\./);
});
