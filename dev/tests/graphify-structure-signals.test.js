// base_project:managed
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..", "..");

const cleanproject = {
  claude: ["source", "claude", "commands", "cleanproject.md"],
  opencode: ["source", "opencode", "command", "cleanproject.md"],
  "opencode-lite": ["source", "opencode", "command-lite", "cleanproject.md"],
  codex: ["source", "codex", "skills", "cleanproject", "SKILL.md"],
};

const scanproject = {
  claude: ["source", "claude", "commands", "scanproject.md"],
  opencode: ["source", "opencode", "command", "scanproject.md"],
  "opencode-lite": ["source", "opencode", "command-lite", "scanproject.md"],
  codex: ["source", "codex", "skills", "scanproject", "SKILL.md"],
};

const projectStandards = {
  claude: ["source", "claude", "references", "project-standards.md"],
  opencode: ["source", "opencode", "references", "project-standards.md"],
};

// Each variant's pre-existing "never fix/move/delete on its own" contract line,
// used as a regression guard so this goal's edits cannot accidentally weaken it.
const readOnlyGuard = {
  claude: /do not fix, move, or delete anything/i,
  opencode: /do not fix, move, or delete anything/i,
  "opencode-lite": /do not fix, move, or delete anything/i,
  codex: /this skill is read-only/i,
};

const noFixGuard = {
  claude: /do not fix anything in this command/i,
  opencode: /do not fix anything in this command/i,
  "opencode-lite": /do not fix anything in this command/i,
  codex: /do not fix findings/i,
};

function contentFor(map, name) {
  return fs.readFileSync(path.join(repoRoot, ...map[name]), "utf8");
}

test("cleanproject reads Knowledge Gaps and verifies with graphify affected in every runtime", () => {
  for (const runtime of Object.keys(cleanproject)) {
    const content = contentFor(cleanproject, runtime);
    assert.match(
      content,
      /Knowledge Gaps/,
      `${runtime} cleanproject cites the Knowledge Gaps section`,
    );
    assert.match(
      content,
      /graphify affected/,
      `${runtime} cleanproject uses graphify affected as stronger proof than grep`,
    );
    assert.match(
      content,
      /reflection/i,
      `${runtime} cleanproject carries the false-positive caveat`,
    );
    assert.match(
      content,
      /won.t\s+show/i,
      `${runtime} cleanproject's caveat explains why the extractor misses conventional wiring`,
    );
    assert.match(
      content,
      readOnlyGuard[runtime],
      `${runtime} cleanproject still declares itself read-only`,
    );
  }
});

test("scanproject reads Knowledge Gaps and Graph Freshness in every runtime", () => {
  for (const runtime of Object.keys(scanproject)) {
    const content = contentFor(scanproject, runtime);
    assert.match(
      content,
      /Knowledge Gaps/,
      `${runtime} scanproject cites the Knowledge Gaps section`,
    );
    assert.match(
      content,
      /Graph Freshness|built_at_commit/,
      `${runtime} scanproject checks graph freshness before trusting structural findings`,
    );
    assert.match(
      content,
      /reflection/i,
      `${runtime} scanproject carries the false-positive caveat`,
    );
    assert.match(
      content,
      /won.t\s+show/i,
      `${runtime} scanproject's caveat explains why the extractor misses conventional wiring`,
    );
    assert.match(
      content,
      noFixGuard[runtime],
      `${runtime} scanproject still declares it does not fix anything`,
    );
  }
});

test("project-standards.md Structure item documents the Knowledge Gaps signal in both copies", () => {
  for (const runtime of Object.keys(projectStandards)) {
    const content = contentFor(projectStandards, runtime);
    assert.match(
      content,
      /## 9\. Structure[\s\S]*Knowledge Gaps/,
      `${runtime} project-standards.md §9 cites the Knowledge Gaps section`,
    );
    assert.match(
      content,
      /reflection/i,
      `${runtime} project-standards.md §9 carries the false-positive caveat`,
    );
    assert.match(
      content,
      /won.t\s+show/i,
      `${runtime} project-standards.md §9's caveat explains why the extractor misses conventional wiring`,
    );
  }
  assert.strictEqual(
    contentFor(projectStandards, "claude"),
    contentFor(projectStandards, "opencode"),
    "the two project-standards.md copies stay byte-identical",
  );
});
