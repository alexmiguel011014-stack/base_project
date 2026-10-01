// base_project:managed
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");

const syncScript = path.join(__dirname, "..", "scripts", "sync.js");
const gitEnv = {
  ...process.env,
  GIT_AUTHOR_NAME: "base_project test",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "base_project test",
  GIT_COMMITTER_EMAIL: "test@example.com",
};

function git(args, cwd) {
  return execFileSync("git", args, {
    cwd,
    env: gitEnv,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function sync(home, ...args) {
  return spawnSync(process.execPath, [syncScript, ...args], {
    env: { ...gitEnv, AGENTS_HOME: home },
    encoding: "utf8",
  });
}

test("sync commit keeps shell syntax in the message literal instead of executing it", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bp-sync-"));
  const home = path.join(root, "agents");
  const marker = path.join(root, "executed");
  try {
    assert.equal(sync(home, "init").status, 0);
    fs.writeFileSync(path.join(home, "note.md"), "x\n");
    const message = `note $(touch ${marker}) "quoted" \`tick\``;
    const result = sync(home, "commit", "-m", message);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(git(["log", "-1", "--format=%s"], home), message);
    assert.equal(fs.existsSync(marker), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("sync pull refuses a diverged canonical store instead of merging", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bp-sync-"));
  const bare = path.join(root, "remote.git");
  const home = path.join(root, "home");
  const other = path.join(root, "other");
  try {
    git(["init", "--bare", "-q", bare], root);
    git(["clone", "-q", bare, home], root);
    fs.writeFileSync(path.join(home, "a.md"), "a1\n");
    git(["add", "-A"], home);
    git(["commit", "-q", "-m", "a1"], home);
    git(["push", "-q", "-u", "origin", "HEAD"], home);

    git(["clone", "-q", bare, other], root);
    fs.writeFileSync(path.join(other, "b.md"), "b1\n");
    git(["add", "-A"], other);
    git(["commit", "-q", "-m", "b1"], other);
    git(["push", "-q", "origin", "HEAD"], other);

    fs.writeFileSync(path.join(home, "a.md"), "a2\n");
    git(["commit", "-q", "-am", "a2"], home);
    // A user who configured merge-on-pull: a plain `git pull` would now create a merge.
    git(["config", "pull.rebase", "false"], home);
    const before = git(["rev-parse", "HEAD"], home);

    const result = sync(home, "pull");
    assert.equal(result.status, 1);
    assert.equal(git(["rev-parse", "HEAD"], home), before);
    assert.equal(git(["log", "-1", "--format=%s"], home), "a2");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
