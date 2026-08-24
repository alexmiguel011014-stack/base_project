// base_project:managed
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execSync } = require("node:child_process");

function tmpHome() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-config-test-"));
  return dir;
}

test("config-store init creates canonical layout", () => {
  const home = tmpHome();
  execSync(`node dev/scripts/config-store.js --init`, {
    env: { ...process.env, AGENTS_HOME: home },
    encoding: "utf8",
  });
  assert.ok(fs.existsSync(path.join(home, "config.json")));
  assert.ok(fs.existsSync(path.join(home, "rules", "global", "CLAUDE.md")));
  assert.ok(fs.existsSync(path.join(home, "mcp", "mcp.json")));
  fs.rmSync(home, { recursive: true, force: true });
});

test("config-store add/remove project and BASE_PROJECT_HOME override", () => {
  const home = tmpHome();
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), "bp-proj-"));
  execSync(`node dev/scripts/config-store.js add "${proj}" --name myproj`, {
    env: { ...process.env, AGENTS_HOME: home },
    encoding: "utf8",
  });
  let list = JSON.parse(
    execSync(`node dev/scripts/config-store.js list --json`, {
      env: { ...process.env, AGENTS_HOME: home },
      encoding: "utf8",
    }),
  );
  assert.ok(list.myproj);
  assert.equal(path.resolve(list.myproj.path), path.resolve(proj));
  // test BASE_PROJECT_HOME override
  const home2 = tmpHome();
  execSync(`node dev/scripts/config-store.js --init`, {
    env: { ...process.env, BASE_PROJECT_HOME: home2, AGENTS_HOME: undefined },
    encoding: "utf8",
  });
  assert.ok(fs.existsSync(path.join(home2, "config.json")));
  // remove
  execSync(`node dev/scripts/config-store.js remove myproj`, {
    env: { ...process.env, AGENTS_HOME: home },
    encoding: "utf8",
  });
  list = JSON.parse(
    execSync(`node dev/scripts/config-store.js list --json`, {
      env: { ...process.env, AGENTS_HOME: home },
      encoding: "utf8",
    }),
  );
  assert.ok(!list.myproj);
  fs.rmSync(home, { recursive: true, force: true });
  fs.rmSync(home2, { recursive: true, force: true });
  fs.rmSync(proj, { recursive: true, force: true });
});

test("config-store --help exits 0", () => {
  const out = execSync(`node dev/scripts/config-store.js --help`, {
    encoding: "utf8",
  });
  assert.ok(out.includes("config-store"));
});
