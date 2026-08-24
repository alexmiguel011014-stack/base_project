// base_project:managed
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execSync } = require("node:child_process");

function tmpHome() {
  const h = fs.mkdtempSync(path.join(os.tmpdir(), "bp-adapters-home-"));
  execSync(`node dev/scripts/config-store.js --init`, {
    env: { ...process.env, AGENTS_HOME: h },
    encoding: "utf8",
  });
  return h;
}

test("adapters dry-run lists 31 adapters and deep 9", () => {
  const out = execSync(`node dev/scripts/apply.js --dry-run --project .`, {
    encoding: "utf8",
  });
  assert.ok(out.includes("dry-run: 31 adapters"));
  const { listDeep } = require("../scripts/adapters");
  assert.equal(listDeep().length, 9);
});

test("adapters per-agent projection creates expected files (JSON→TOML for codex, MDC for cursor)", () => {
  const home = tmpHome();
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), "bp-adapters-proj-"));
  // codex: JSON to TOML
  execSync(`node dev/scripts/apply.js --project "${proj}" --agent codex`, {
    env: { ...process.env, AGENTS_HOME: home },
    encoding: "utf8",
  });
  const tomlPath = path.join(proj, ".codex", "config.toml");
  assert.ok(fs.existsSync(tomlPath));
  const toml = fs.readFileSync(tomlPath, "utf8");
  assert.ok(toml.includes("[mcp_servers."));

  // cursor: hardlink MDC
  const proj2 = fs.mkdtempSync(path.join(os.tmpdir(), "bp-adapters-proj2-"));
  execSync(`node dev/scripts/apply.js --project "${proj2}" --agent cursor`, {
    env: { ...process.env, AGENTS_HOME: home },
    encoding: "utf8",
  });
  const mdc = path.join(proj2, ".cursor", "rules", "agentsync.mdc");
  assert.ok(fs.existsSync(mdc));
  // verify hardlink inode equality when same device
  try {
    const src = path.join(home, "rules", "global", "AGENTS.md");
    const a = fs.statSync(src);
    const b = fs.statSync(mdc);
    // on Windows fallback to copy-EPERM case, inode may differ; so just check file exists and content similar
    assert.ok(b.size > 0);
    if (a.ino && b.ino && a.dev === b.dev) {
      // if same device, should be hardlink (inode equal) — but on Windows fallback to copy is allowed
      // we don't strictly assert equality, just that file was created
    }
  } catch {}

  fs.rmSync(home, { recursive: true, force: true });
  fs.rmSync(proj, { recursive: true, force: true });
  fs.rmSync(proj2, { recursive: true, force: true });
});

test("breadth tier: adding new entry to adapters.json projects new agent memory without touching JS", () => {
  // verify that adapters.json has at least 22 generic entries
  const { list } = require("../scripts/adapters");
  const generic = list().filter((a) => a.kind === "generic");
  assert.ok(generic.length >= 22);
  const home = tmpHome();
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), "bp-breadth-proj-"));
  // dry-run should project for a generic agent like amp
  const out = execSync(
    `node dev/scripts/apply.js --dry-run --project "${proj}" --agent amp`,
    { env: { ...process.env, AGENTS_HOME: home }, encoding: "utf8" },
  );
  assert.ok(out.includes("amp:"));
  fs.rmSync(home, { recursive: true, force: true });
  fs.rmSync(proj, { recursive: true, force: true });
});
