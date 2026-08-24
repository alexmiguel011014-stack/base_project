// base_project:managed
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execSync } = require("node:child_process");

function tmpHome() {
  const h = fs.mkdtempSync(path.join(os.tmpdir(), "bp-audit-home-"));
  execSync(`node dev/scripts/config-store.js --init`, {
    env: { ...process.env, AGENTS_HOME: h },
    encoding: "utf8",
  });
  return h;
}

test("audit returns correct JSON shape for cursor", () => {
  const home = tmpHome();
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), "bp-audit-proj-"));
  execSync(`node dev/scripts/config-store.js add "${proj}" --name audittest`, {
    env: { ...process.env, AGENTS_HOME: home },
    encoding: "utf8",
  });
  const out = JSON.parse(
    execSync(
      `node dev/scripts/audit.js --project "${proj}" --agent cursor --json`,
      { env: { ...process.env, AGENTS_HOME: home }, encoding: "utf8" },
    ),
  );
  assert.equal(out.agent, "cursor");
  assert.ok(Array.isArray(out.layers));
  assert.ok(out.layers.some((l) => l.source === "global"));
  assert.ok(out.effectiveConfig);
  assert.ok(out.effectiveConfig.mcp);
  fs.rmSync(home, { recursive: true, force: true });
  fs.rmSync(proj, { recursive: true, force: true });
});

test("context outputs valid JSON with layers,mcp,skills,instructions", () => {
  const home = tmpHome();
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), "bp-context-proj-"));
  execSync(`node dev/scripts/config-store.js add "${proj}" --name ctxproj`, {
    env: { ...process.env, AGENTS_HOME: home },
    encoding: "utf8",
  });
  const out = JSON.parse(
    execSync(
      `node dev/scripts/context.js --project "${proj}" --agent claude-code`,
      { env: { ...process.env, AGENTS_HOME: home }, encoding: "utf8" },
    ),
  );
  assert.ok(Array.isArray(out.layers));
  assert.ok(out.mcp);
  assert.ok(Array.isArray(out.skills));
  assert.ok(Array.isArray(out.instructions));
  assert.ok(out.project);
  assert.ok(out.agent);
  fs.rmSync(home, { recursive: true, force: true });
  fs.rmSync(proj, { recursive: true, force: true });
});
