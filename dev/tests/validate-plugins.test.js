// base_project:managed
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { validate } = require("../scripts/validate-plugins.js");

function writeTmpCatalog(obj) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-test-"));
  const file = path.join(dir, "plugins.json");
  fs.writeFileSync(file, JSON.stringify(obj));
  return file;
}

test("validate: the real source/plugins.json passes", () => {
  const result = validate(
    path.join(__dirname, "..", "..", "source", "plugins.json"),
  );
  assert.equal(result.valid, true);
  assert.equal(result.errors, null);
});

test("validate: rejects a catalog entry missing a required field", () => {
  const file = writeTmpCatalog({
    _managed_by: "base_project",
    catalog: [
      { id: "x", name: "X", kind: "cli" /* missing summary, recommend_if */ },
    ],
  });
  const result = validate(file);
  assert.equal(result.valid, false);
  assert.ok(result.errors.length > 0);
});

test("validate: rejects a profile that references an unknown catalog id", () => {
  const file = writeTmpCatalog({
    _managed_by: "base_project",
    profiles: { minimal: ["headroom", "nonexistent-id"] },
    catalog: [
      {
        id: "headroom",
        name: "Headroom",
        kind: "cli",
        summary: "x",
        recommend_if: "x",
      },
    ],
  });
  const result = validate(file);
  assert.equal(result.valid, false);
  assert.match(result.errors[0], /nonexistent-id/);
});

test("validate: rejects a dependsOn reference to an unknown catalog id", () => {
  const file = writeTmpCatalog({
    _managed_by: "base_project",
    catalog: [
      {
        id: "a",
        name: "A",
        kind: "cli",
        summary: "x",
        recommend_if: "x",
        dependsOn: ["ghost"],
      },
    ],
  });
  const result = validate(file);
  assert.equal(result.valid, false);
  assert.match(result.errors[0], /ghost/);
});

test("validate: rejects the wrong _managed_by value", () => {
  const file = writeTmpCatalog({
    _managed_by: "someone-else",
    catalog: [
      { id: "a", name: "A", kind: "cli", summary: "x", recommend_if: "x" },
    ],
  });
  const result = validate(file);
  assert.equal(result.valid, false);
});
