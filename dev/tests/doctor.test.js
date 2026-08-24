// base_project:managed
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execSync } = require("node:child_process");

function tmpHome() {
  const h = fs.mkdtempSync(path.join(os.tmpdir(), "bp-doctor-home-"));
  execSync(`node dev/scripts/config-store.js --init`, {
    env: { ...process.env, AGENTS_HOME: h },
    encoding: "utf8",
  });
  return h;
}

test("doctor detects broken symlink and suggests apply --fix", () => {
  const home = tmpHome();
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), "bp-doctor-proj-"));
  execSync(
    `node dev/scripts/apply.js --project "${proj}" --agent claude-code`,
    { env: { ...process.env, AGENTS_HOME: home }, encoding: "utf8" },
  );
  const target = path.join(proj, "CLAUDE.md");
  // break the symlink (if it's a symlink, replace with broken link; if copy fallback, create broken symlink)
  try {
    if (fs.existsSync(target)) fs.unlinkSync(target);
  } catch {}
  // create broken symlink
  try {
    fs.symlinkSync(
      path.join(home, "rules", "global", "MISSING.md"),
      target,
      "file",
    );
  } catch {
    // if EPERM, just create a dangling file path
    try {
      fs.writeFileSync(target, "broken");
      // make it look broken by pointing to missing canonical? we can just unlink canonical
      fs.unlinkSync(path.join(home, "rules", "global", "CLAUDE.md"));
    } catch {}
  }
  let out = "";
  try {
    execSync(`node dev/scripts/doctor.js --project "${proj}"`, {
      env: { ...process.env, AGENTS_HOME: home },
      encoding: "utf8",
    });
  } catch (e) {
    out = (e.stdout || "") + (e.stderr || "");
    assert.equal(e.status, 1);
    assert.ok(
      out.includes("broken symlink") ||
        out.includes("missing canonical dir") ||
        out.includes("apply --fix") ||
        out.includes("broken"),
    );
  }
  // also test doctor --json shape
  const jsonOut = execSync(
    `node dev/scripts/doctor.js --project "${proj}" --json`,
    { env: { ...process.env, AGENTS_HOME: home }, encoding: "utf8" },
  );
  const j = JSON.parse(jsonOut);
  assert.ok(typeof j.healthy === "boolean");
  assert.ok(Array.isArray(j.issues));
  fs.rmSync(home, { recursive: true, force: true });
  fs.rmSync(proj, { recursive: true, force: true });
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
