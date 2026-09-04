// base_project:managed
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..", "..");

test("verification and dependency-update safeguards stay wired into CI", () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"),
  );
  for (const name of [
    "lint",
    "typecheck",
    "audit:prod",
    "check:unused-deps",
    "verify",
  ]) {
    assert.ok(manifest.scripts[name], `missing npm script: ${name}`);
  }
  assert.match(manifest.scripts.verify, /npm run audit:prod/);

  const workflow = fs.readFileSync(
    path.join(repoRoot, ".github", "workflows", "ci.yml"),
    "utf8",
  );
  assert.match(workflow, /run: npm run verify/);
  assert.match(workflow, /validate-goals-structure\.js/);
  assert.match(workflow, /base_project\/hooks\/validate-goals\.js/);

  const dependabot = fs.readFileSync(
    path.join(repoRoot, ".github", "dependabot.yml"),
    "utf8",
  );
  assert.match(dependabot, /package-ecosystem: npm/);
  assert.match(dependabot, /package-ecosystem: github-actions/);
  assert.match(dependabot, /interval: weekly/g);
});
