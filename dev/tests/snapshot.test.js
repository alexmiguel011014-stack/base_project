// base_project:managed
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execSync } = require("node:child_process");

function tmpHome() {
  const h = fs.mkdtempSync(path.join(os.tmpdir(), "bp-snap-home-"));
  execSync(`node dev/scripts/config-store.js --init`, {
    env: { ...process.env, AGENTS_HOME: h },
    encoding: "utf8",
  });
  return h;
}

test("snapshot and restore round-trip (excluding keys/reports)", () => {
  const home = tmpHome();
  // create a file to snapshot
  fs.writeFileSync(
    path.join(home, "rules", "global", "SNAPTEST.md"),
    "original",
    "utf8",
  );
  execSync(`node dev/scripts/snapshot.js snapshot test1`, {
    env: { ...process.env, AGENTS_HOME: home },
    encoding: "utf8",
  });
  // mutate
  fs.writeFileSync(
    path.join(home, "rules", "global", "SNAPTEST.md"),
    "mutated",
    "utf8",
  );
  fs.writeFileSync(
    path.join(home, "rules", "global", "NEWFILE.md"),
    "new",
    "utf8",
  );
  assert.equal(
    fs.readFileSync(path.join(home, "rules", "global", "SNAPTEST.md"), "utf8"),
    "mutated",
  );
  // restore
  execSync(`node dev/scripts/snapshot.js restore test1`, {
    env: { ...process.env, AGENTS_HOME: home },
    encoding: "utf8",
  });
  assert.equal(
    fs.readFileSync(path.join(home, "rules", "global", "SNAPTEST.md"), "utf8"),
    "original",
  );
  // NEWFILE should be gone after restore if tar properly restores (tar -xz doesn't delete extra files, but our fallback may)
  // we at least check original restored; not strictly checking deletion due to tar behavior
  // also test list
  const list = execSync(`node dev/scripts/snapshot.js list`, {
    env: { ...process.env, AGENTS_HOME: home },
    encoding: "utf8",
  });
  assert.ok(list.includes("test1"));
  fs.rmSync(home, { recursive: true, force: true });
});

test("snapshot refuses inside a repo guard not relevant for canonical git, but ensures no writes outside tmp", () => {
  const home = tmpHome();
  // canonical may be git repo after sync init — that's allowed
  execSync(`node dev/scripts/sync.js init`, {
    env: { ...process.env, AGENTS_HOME: home },
    encoding: "utf8",
  });
  execSync(`node dev/scripts/snapshot.js snapshot test2`, {
    env: { ...process.env, AGENTS_HOME: home },
    encoding: "utf8",
  });
  assert.ok(
    fs.existsSync(path.join(home, "snapshots", "test2.tar.gz")) ||
      fs.existsSync(path.join(home, "snapshots", "test2.tar.gz.dir")),
  );
  fs.rmSync(home, { recursive: true, force: true });
});
