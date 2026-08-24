// base_project:managed
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execSync } = require("node:child_process");

function tmpHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "bp-tasks-home-"));
}

test("tasks add/list/done round-trip and history --since", () => {
  const home = tmpHome();
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), "bp-tasks-proj-"));
  execSync(`node dev/scripts/tasks.js --project "${proj}" add "ship v1"`, {
    env: { ...process.env, AGENTS_HOME: home },
    encoding: "utf8",
  });
  // also test with AGENTS_HOME override via BASE_PROJECT_HOME
  const list = JSON.parse(
    execSync(`node dev/scripts/tasks.js --project "${proj}" list --json`, {
      env: { ...process.env, AGENTS_HOME: home },
      encoding: "utf8",
    }),
  );
  assert.equal(list.length, 1);
  assert.equal(list[0].title, "ship v1");
  assert.equal(list[0].status, "open");
  // done
  execSync(`node dev/scripts/tasks.js --project "${proj}" done ${list[0].id}`, {
    env: { ...process.env, AGENTS_HOME: home },
    encoding: "utf8",
  });
  const list2 = JSON.parse(
    execSync(`node dev/scripts/tasks.js --project "${proj}" list --json`, {
      env: { ...process.env, AGENTS_HOME: home },
      encoding: "utf8",
    }),
  );
  assert.equal(list2[0].status, "done");
  // history
  const hist = JSON.parse(
    execSync(
      `node dev/scripts/history.js --project "${proj}" --since 7d --json`,
      { env: { ...process.env, AGENTS_HOME: home }, encoding: "utf8" },
    ),
  );
  assert.ok(Array.isArray(hist));
  assert.ok(hist.some((h) => h.title === "ship v1" || h.action === "task:add"));
  // ensure no writes outside tmpHome via BASE_PROJECT_HOME
  const home2 = tmpHome();
  execSync(`node dev/scripts/tasks.js --project "${proj}" add "second"`, {
    env: { ...process.env, BASE_PROJECT_HOME: home2, AGENTS_HOME: undefined },
    encoding: "utf8",
  });
  assert.ok(fs.existsSync(path.join(home2, "tasks")));
  fs.rmSync(home, { recursive: true, force: true });
  fs.rmSync(home2, { recursive: true, force: true });
  fs.rmSync(proj, { recursive: true, force: true });
});
