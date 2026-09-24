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
    "test:harness",
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
  assert.match(workflow, /name: Run deterministic contract harness/);
  assert.match(workflow, /run: npm run test:harness/);
  assert.doesNotMatch(workflow, /ANTHROPIC_API_KEY|claude\s+-p/i);
  assert.match(workflow, /validate-goals-structure\.js/);
  assert.match(workflow, /base_project\/hooks\/validate-goals\.js/);

  // Unit tests must run on every OS of the install-test matrix, not only in the Ubuntu
  // validate job — a Windows-only pass once hid a red test for a month.
  const installTest = workflow.slice(workflow.indexOf("install-test:"));
  assert.match(
    installTest,
    /os: \[ubuntu-latest, windows-latest, macos-latest\]/,
  );
  assert.match(
    installTest,
    /name: Run unit tests on this OS\n\s+run: npm test/,
  );

  const dependabot = fs.readFileSync(
    path.join(repoRoot, ".github", "dependabot.yml"),
    "utf8",
  );
  assert.match(dependabot, /package-ecosystem: npm/);
  assert.match(dependabot, /package-ecosystem: github-actions/);
  assert.match(dependabot, /interval: weekly/g);
});

test("the repository rules for Claude Code and Codex stay identical", () => {
  // CLAUDE.md (read by Claude Code) and AGENTS.md (read by Codex) are the same rules kept as
  // two files; this is what keeps them from silently drifting apart.
  const claude = fs.readFileSync(path.join(repoRoot, "CLAUDE.md"), "utf8");
  const agents = fs.readFileSync(path.join(repoRoot, "AGENTS.md"), "utf8");
  assert.equal(agents, claude);
});

test("hooks and installer helpers stay type-checked (GOALS 17 R17.25)", () => {
  // tsconfig keeps checkJs off, so a file is checked only while it opts in. Every hook is
  // covered, including ones added later, plus the helpers that edit user config files.
  const hooks = fs
    .readdirSync(path.join(repoRoot, "source", "hooks"))
    .filter((name) => name.endsWith(".js"))
    .map((name) => path.join("source", "hooks", name));
  const helpers = [
    "install-opencode.js",
    "install-codex.js",
    "mcp-servers.js",
  ].map((name) => path.join("dev", "scripts", name));
  for (const file of [...hooks, ...helpers]) {
    assert.match(
      fs.readFileSync(path.join(repoRoot, file), "utf8"),
      /^\/\/ @ts-check$/m,
      `${file} must keep // @ts-check`,
    );
  }
  const tsconfig = JSON.parse(
    fs.readFileSync(path.join(repoRoot, "tsconfig.json"), "utf8"),
  );
  assert.deepEqual(tsconfig.compilerOptions.types, ["node"]);
  assert.equal(tsconfig.compilerOptions.strict, true);
});
