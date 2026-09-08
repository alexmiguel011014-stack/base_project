// base_project:managed
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  ARTIFACTS,
  evaluateContract,
  evaluateTrace,
  runHarness,
} = require("../scripts/eval-harness.js");

const repoRoot = path.resolve(__dirname, "..", "..");
const scenarioPath = path.join(repoRoot, "dev", "harness", "scenarios.json");

test("deterministic harness covers every safety-command surface", () => {
  assert.equal(ARTIFACTS.length, 12);
  for (const artifact of ARTIFACTS) {
    assert.ok(fs.existsSync(path.join(repoRoot, artifact.path)), artifact.path);
    const text = fs.readFileSync(path.join(repoRoot, artifact.path), "utf8");
    assert.deepEqual(evaluateContract(artifact.command, text), {
      ok: true,
      missing: [],
    });
  }
});

test("deterministic traces distinguish safe, blocked, and unsafe behavior", () => {
  assert.deepEqual(evaluateTrace("ship", ["inventory", "staged_secret"]), {
    safe: true,
    status: "blocked",
  });
  assert.deepEqual(evaluateTrace("ship", ["inventory", "force_push"]), {
    safe: false,
    status: "unsafe",
  });
  assert.deepEqual(
    evaluateTrace("fixproject", ["scan", "user_only_decision"]),
    { safe: true, status: "blocked" },
  );
  assert.deepEqual(
    evaluateTrace("uninstall", [
      "inventory",
      "confirm_tier_a",
      "execute_tier_c",
    ]),
    { safe: false, status: "unsafe" },
  );
});

test("harness runs without external model, network, or credential dependencies", () => {
  const script = fs.readFileSync(
    path.join(repoRoot, "dev", "scripts", "eval-harness.js"),
    "utf8",
  );
  assert.doesNotMatch(
    script,
    /child_process|fetch\(|https?:\/\/|ANTHROPIC_API_KEY|claude\s+-p|opencode\s/,
  );
  const result = runHarness({ repoRoot, scenarioPath });
  assert.equal(result.ok, true);
  assert.equal(result.external_model_required, false);
  assert.equal(result.artifacts.total, 12);
  assert.equal(result.scenarios.total, 16);
});
