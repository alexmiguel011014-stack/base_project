// base_project:managed
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execSync, spawnSync } = require("node:child_process");

function tmpHome() {
  const h = fs.mkdtempSync(path.join(os.tmpdir(), "bp-doctor-home-"));
  execSync(`node dev/scripts/config-store.js --init`, {
    env: { ...process.env, AGENTS_HOME: h },
    encoding: "utf8",
  });
  return h;
}

// doctor exits 1 whenever it reports an error — that is its contract, not a crash — so it
// runs through spawnSync: execSync would throw on the very exit code these tests assert.
function doctor(home, proj, ...extra) {
  return spawnSync(
    process.execPath,
    ["dev/scripts/doctor.js", "--project", proj, ...extra],
    { env: { ...process.env, AGENTS_HOME: home }, encoding: "utf8" },
  );
}

test("doctor reports a missing canonical dir with exit 1 on every platform", () => {
  const home = tmpHome();
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), "bp-doctor-proj-"));
  try {
    fs.rmSync(path.join(home, "mcp"), { recursive: true, force: true });

    const text = doctor(home, proj);
    assert.equal(text.status, 1);
    assert.match(text.stdout, /missing canonical dir/);

    const json = doctor(home, proj, "--json");
    assert.equal(json.status, 1);
    const report = JSON.parse(json.stdout);
    assert.equal(report.healthy, false);
    assert.ok(
      report.issues.some(
        (issue) =>
          issue.level === "error" &&
          issue.message.includes("missing canonical dir"),
      ),
    );
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(proj, { recursive: true, force: true });
  }
});

test("doctor detects broken symlink and suggests apply --fix", (t) => {
  const home = tmpHome();
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), "bp-doctor-proj-"));
  try {
    execSync(
      `node dev/scripts/apply.js --project "${proj}" --agent claude-code`,
      { env: { ...process.env, AGENTS_HOME: home }, encoding: "utf8" },
    );
    const target = path.join(proj, "CLAUDE.md");
    fs.rmSync(target, { force: true });
    try {
      fs.symlinkSync(
        path.join(home, "rules", "global", "MISSING.md"),
        target,
        "file",
      );
    } catch {
      // Windows without Developer Mode cannot create symlinks at all, so there is no broken
      // symlink to detect; the missing-canonical-dir test above still covers exit status there.
      t.skip("symlinks are not available on this platform");
      return;
    }

    const text = doctor(home, proj);
    assert.equal(text.status, 1);
    assert.match(text.stdout, /broken symlink/);
    assert.match(text.stdout, /apply\.js/);

    const json = doctor(home, proj, "--json");
    assert.equal(json.status, 1);
    const report = JSON.parse(json.stdout);
    assert.equal(report.healthy, false);
    assert.ok(
      report.issues.some((issue) => issue.message.includes("broken symlink")),
    );
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(proj, { recursive: true, force: true });
  }
});

test("doctor healthy after init", () => {
  const home = tmpHome();
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), "bp-doctor-healthy-"));
  execSync(
    `node dev/scripts/apply.js --project "${proj}" --agent claude-code`,
    { env: { ...process.env, AGENTS_HOME: home }, encoding: "utf8" },
  );
  const out = execSync(
    `node dev/scripts/doctor.js --project "${proj}" --json`,
    { env: { ...process.env, AGENTS_HOME: home }, encoding: "utf8" },
  );
  const j = JSON.parse(out);
  // should be healthy (no errors) after fresh apply, warnings allowed
  assert.ok(j.healthy === true || j.issues.every((i) => i.level === "warning"));
  fs.rmSync(home, { recursive: true, force: true });
  fs.rmSync(proj, { recursive: true, force: true });
});
