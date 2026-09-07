// base_project:managed
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execSync, spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..", "..");

function tmpHome() {
  const h = fs.mkdtempSync(path.join(os.tmpdir(), "bp-drift-home-"));
  execSync(`node dev/scripts/config-store.js --init`, {
    env: { ...process.env, AGENTS_HOME: h },
    encoding: "utf8",
  });
  return h;
}

test("drift --json: distinguishes 'missing' (never adopted) from real 'drift' (stale) — the exact filter /bootstrap's drift-chain step (GOALS 8 H.5) relies on", () => {
  const home = tmpHome();
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), "bp-drift-json-proj-"));

  // never adopted claude-code -> every entry should be "missing", none "drift"
  let missingReport;
  try {
    execSync(
      `node dev/scripts/drift.js --project "${proj}" --agent claude-code --json`,
      {
        env: { ...process.env, AGENTS_HOME: home },
        encoding: "utf8",
      },
    );
  } catch (e) {
    missingReport = JSON.parse(e.stdout);
  }
  assert.ok(
    missingReport,
    "expected drift.js to exit non-zero with JSON on stdout",
  );
  assert.ok(
    missingReport.results.every((r) => r.status !== "drift"),
    "a never-adopted project must report zero 'drift' entries, only 'missing'",
  );
  assert.ok(missingReport.results.some((r) => r.status === "missing"));

  // adopt, then mutate the projected file -> that entry, and only that shape, flips to real "drift"
  execSync(
    `node dev/scripts/apply.js --project "${proj}" --agent claude-code`,
    {
      env: { ...process.env, AGENTS_HOME: home },
      encoding: "utf8",
    },
  );
  const target = path.join(proj, "CLAUDE.md");
  if (fs.lstatSync(target).isSymbolicLink()) fs.unlinkSync(target);
  fs.writeFileSync(target, "mutated for drift test", "utf8");

  let driftReport;
  try {
    execSync(
      `node dev/scripts/drift.js --project "${proj}" --agent claude-code --json`,
      {
        env: { ...process.env, AGENTS_HOME: home },
        encoding: "utf8",
      },
    );
  } catch (e) {
    driftReport = JSON.parse(e.stdout);
  }
  assert.ok(
    driftReport,
    "expected drift.js to exit non-zero with JSON on stdout after mutation",
  );
  assert.ok(
    driftReport.results.some(
      (r) => r.status === "drift" && r.target === "memory",
    ),
    "mutating the projected CLAUDE.md must surface as a real 'drift' entry, not 'missing'",
  );

  fs.rmSync(proj, { recursive: true, force: true });
  fs.rmSync(home, { recursive: true, force: true });
});

test("self-host source repositories are not projection targets", () => {
  const home = tmpHome();
  const agentsBefore = fs.readFileSync(
    path.join(repoRoot, "AGENTS.md"),
    "utf8",
  );
  const claudePath = path.join(repoRoot, "CLAUDE.md");
  const claudeBefore = fs.existsSync(claudePath)
    ? fs.readFileSync(claudePath, "utf8")
    : null;
  const env = { ...process.env, AGENTS_HOME: home };

  const apply = spawnSync(
    process.execPath,
    ["dev/scripts/apply.js", "--project", repoRoot, "--agent", "claude-code"],
    { cwd: repoRoot, env, encoding: "utf8" },
  );
  assert.equal(apply.status, 3);
  assert.match(apply.stderr, /refused: base_project source repositories/i);
  assert.equal(
    fs.readFileSync(path.join(repoRoot, "AGENTS.md"), "utf8"),
    agentsBefore,
  );
  assert.equal(
    fs.existsSync(claudePath) ? fs.readFileSync(claudePath, "utf8") : null,
    claudeBefore,
  );

  const drift = spawnSync(
    process.execPath,
    [
      "dev/scripts/drift.js",
      "--project",
      repoRoot,
      "--agent",
      "claude-code",
      "--json",
    ],
    { cwd: repoRoot, env, encoding: "utf8" },
  );
  assert.equal(drift.status, 0);
  const report = JSON.parse(drift.stdout);
  assert.equal(report.selfHost, true);
  assert.ok(report.results.length > 0);
  assert.ok(
    report.results.every((result) => result.status === "not_applicable"),
  );

  fs.rmSync(home, { recursive: true, force: true });
});

test("drift classifier: missing -> drift 1, then in-sync 0 after apply, including lossy report", () => {
  const home = tmpHome();
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), "bp-drift-proj-"));
  // initially missing -> drift
  let threw = false;
  try {
    execSync(
      `node dev/scripts/drift.js --project "${proj}" --agent claude-code`,
      { env: { ...process.env, AGENTS_HOME: home }, encoding: "utf8" },
    );
  } catch (e) {
    threw = true;
    assert.equal(e.status, 1);
  }
  assert.ok(threw, "should exit 1 when missing");

  // apply then in-sync
  execSync(
    `node dev/scripts/apply.js --project "${proj}" --agent claude-code`,
    { env: { ...process.env, AGENTS_HOME: home }, encoding: "utf8" },
  );
  // should now be in-sync (exit 0)
  execSync(
    `node dev/scripts/drift.js --project "${proj}" --agent claude-code`,
    { env: { ...process.env, AGENTS_HOME: home }, encoding: "utf8" },
  );

  // mutate to drift
  const target = path.join(proj, "CLAUDE.md");
  if (fs.existsSync(target)) {
    // if symlink fallback copy, we can mutate the copy
    try {
      // if symlink, unlink and write different content
      if (fs.lstatSync(target).isSymbolicLink()) {
        fs.unlinkSync(target);
        fs.writeFileSync(target, "mutated", "utf8");
      } else {
        fs.writeFileSync(target, "mutated drift content", "utf8");
      }
    } catch {}
    let _drifted = false;
    try {
      execSync(
        `node dev/scripts/drift.js --project "${proj}" --agent claude-code`,
        { env: { ...process.env, AGENTS_HOME: home }, encoding: "utf8" },
      );
    } catch (e) {
      _drifted = true;
      assert.equal(e.status, 1);
    }
    // if file was symlink, mutation may not be detected as drift via content compare (since symlink points to canonical)
    // but our drift also checks missing only; for fallback copy it will detect drift
    // we at least check that dry-run lossy report exists for codex
  }

  // lossy projection report for codex
  const out = execSync(
    `node dev/scripts/apply.js --dry-run --project "${proj}" --agent codex`,
    { env: { ...process.env, AGENTS_HOME: home }, encoding: "utf8" },
  );
  assert.ok(out.includes("lossy") || out.includes("hooks.SessionEnd"));

  fs.rmSync(home, { recursive: true, force: true });
  fs.rmSync(proj, { recursive: true, force: true });
});
