// base_project:managed
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execSync } = require("node:child_process");

function tmpHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "bp-lint-home-"));
}

test("lint-config fails on malformed config and passes on valid", () => {
  const home = tmpHome();
  execSync(`node dev/scripts/config-store.js --init`, {
    env: { ...process.env, AGENTS_HOME: home },
    encoding: "utf8",
  });
  // valid should pass
  execSync(`node dev/scripts/lint-config.js`, {
    env: { ...process.env, AGENTS_HOME: home },
    encoding: "utf8",
  });
  // malformed config: write invalid JSON
  fs.writeFileSync(path.join(home, "config.json"), "{ invalid json", "utf8");
  let failed = false;
  try {
    execSync(`node dev/scripts/lint-config.js`, {
      env: { ...process.env, AGENTS_HOME: home },
      encoding: "utf8",
    });
  } catch (e) {
    failed = true;
    assert.equal(e.status, 1);
  }
  assert.ok(failed, "should fail on malformed config");
  // restore valid
  execSync(`node dev/scripts/config-store.js --init`, {
    env: { ...process.env, AGENTS_HOME: home },
    encoding: "utf8",
  });
  execSync(`node dev/scripts/lint-config.js`, {
    env: { ...process.env, AGENTS_HOME: home },
    encoding: "utf8",
  });
  fs.rmSync(home, { recursive: true, force: true });
});

test("lint-config validates adapters.json", () => {
  // valid adapters should pass
  execSync(`node dev/scripts/lint-config.js --json`, { encoding: "utf8" });
});
