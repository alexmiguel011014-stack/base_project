// base_project:managed
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execSync } = require("node:child_process");

function tmpHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "bp-resolve-test-"));
}

test("resolve-layers layer order global→project and merge", () => {
  const home = tmpHome();
  execSync(`node dev/scripts/config-store.js --init`, {
    env: { ...process.env, AGENTS_HOME: home },
    encoding: "utf8",
  });
  // add a project
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), "bp-resolve-proj-"));
  execSync(`node dev/scripts/config-store.js add "${proj}" --name testproj`, {
    env: { ...process.env, AGENTS_HOME: home },
    encoding: "utf8",
  });
  // create a project-specific rule
  fs.mkdirSync(path.join(home, "rules", "testproj"), { recursive: true });
  fs.writeFileSync(
    path.join(home, "rules", "testproj", "custom.md"),
    "# custom\n",
  );
  const out = JSON.parse(
    execSync(`node dev/scripts/resolve-layers.js --project "${proj}" --json`, {
      env: { ...process.env, AGENTS_HOME: home },
      encoding: "utf8",
    }),
  );
  assert.equal(out.layers[0].source, "global");
  assert.ok(out.layers.some((l) => l.source === "project:testproj"));
  assert.ok(out.effectiveConfig.instructions.length >= 2);
  // project layer should be last
  assert.equal(out.layers[out.layers.length - 1].source, "project:testproj");
  fs.rmSync(home, { recursive: true, force: true });
  fs.rmSync(proj, { recursive: true, force: true });
});

test("resolve-layers supports --agent and global→agent→project", () => {
  const home = tmpHome();
  execSync(`node dev/scripts/config-store.js --init`, {
    env: { ...process.env, AGENTS_HOME: home },
    encoding: "utf8",
  });
  // create agent-specific layer
  fs.mkdirSync(path.join(home, "rules", "cursor"), { recursive: true });
  fs.writeFileSync(
    path.join(home, "rules", "cursor", "cursor.md"),
    "# cursor\n",
  );
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), "bp-resolve-proj2-"));
  execSync(`node dev/scripts/config-store.js add "${proj}" --name testproj2`, {
    env: { ...process.env, AGENTS_HOME: home },
    encoding: "utf8",
  });
  const out = JSON.parse(
    execSync(
      `node dev/scripts/resolve-layers.js --project "${proj}" --agent cursor --json`,
      { env: { ...process.env, AGENTS_HOME: home }, encoding: "utf8" },
    ),
  );
  const sources = out.layers.map((l) => l.source);
  assert.ok(sources.includes("global"));
  assert.ok(sources.includes("agent:cursor"));
  assert.ok(sources.includes("project:testproj2"));
  // order global -> agent -> project
  assert.ok(sources.indexOf("global") < sources.indexOf("agent:cursor"));
  assert.ok(
    sources.indexOf("agent:cursor") < sources.indexOf("project:testproj2"),
  );
  fs.rmSync(home, { recursive: true, force: true });
  fs.rmSync(proj, { recursive: true, force: true });
});
