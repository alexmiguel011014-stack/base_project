// base_project:managed
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  normalizeProjectPath,
  readEventsForProject,
  readCatalog,
  buildCatalogSnapshot,
  resolveProfile,
} = require("../source/dashboard/lib/snapshot.js");

test("normalizeProjectPath lowercases, flips slashes, strips trailing slash", () => {
  assert.equal(normalizeProjectPath("D:\\Proj\\foo\\"), "d:/proj/foo");
  assert.equal(normalizeProjectPath("/home/x/bar/"), "/home/x/bar");
  assert.equal(normalizeProjectPath(""), "");
  assert.equal(normalizeProjectPath(null), "");
});

test("readEventsForProject filters the shared log down to one project", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-test-"));
  const logPath = path.join(dir, "usage.jsonl");
  const lines = [
    JSON.stringify({ project: "D:/Proj/A", plugin: "headroom" }),
    JSON.stringify({ project: "D:/Proj/B", plugin: "ponytail" }),
    "not json, must be skipped without throwing",
    JSON.stringify({ project: "d:/proj/a", plugin: "impeccable" }), // same project, different case
  ].join("\n");
  fs.writeFileSync(logPath, lines);

  const events = readEventsForProject(logPath, "D:\\Proj\\A\\");
  assert.equal(events.length, 2);
  assert.deepEqual(events.map((e) => e.plugin).sort(), [
    "headroom",
    "impeccable",
  ]);

  fs.rmSync(dir, { recursive: true, force: true });
});

test("readEventsForProject returns [] for missing log file or empty project", () => {
  assert.deepEqual(readEventsForProject("/does/not/exist.jsonl", "x"), []);
  assert.deepEqual(readEventsForProject("/does/not/exist.jsonl", ""), []);
});

test("readCatalog falls back through multiple paths and returns [] if none exist", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-test-"));
  const goodPath = path.join(dir, "plugins.json");
  fs.writeFileSync(
    goodPath,
    JSON.stringify({ catalog: [{ id: "x", name: "X" }] }),
  );

  const result = readCatalog(["/does/not/exist.json", goodPath]);
  assert.deepEqual(result, [{ id: "x", name: "X" }]);

  assert.deepEqual(readCatalog(["/nope-a.json", "/nope-b.json"]), []);

  fs.rmSync(dir, { recursive: true, force: true });
});

test("buildCatalogSnapshot: installed = used OR confirmed via claude plugin list", () => {
  const catalog = [
    { id: "used-only" },
    { id: "plugin-confirmed", pluginName: "real-name" },
    { id: "neither" },
  ];
  const events = [{ plugin: "used-only" }];
  const claudePlugins = new Set(["real-name"]);

  const result = buildCatalogSnapshot(catalog, events, claudePlugins);
  const byId = Object.fromEntries(result.map((p) => [p.id, p]));

  assert.equal(byId["used-only"].installed, true);
  assert.equal(byId["used-only"].used, true);
  assert.equal(byId["used-only"].installedViaPlugin, false);

  assert.equal(byId["plugin-confirmed"].installed, true);
  assert.equal(byId["plugin-confirmed"].used, false);
  assert.equal(byId["plugin-confirmed"].installedViaPlugin, true);

  assert.equal(byId["neither"].installed, false);
});

test("buildCatalogSnapshot: claudePlugins null (undetectable) never marks installedViaPlugin", () => {
  const catalog = [{ id: "a", pluginName: "a-real" }];
  const result = buildCatalogSnapshot(catalog, [], null);
  assert.equal(result[0].installed, false);
  assert.equal(result[0].installedViaPlugin, false);
});

test("resolveProfile resolves a named profile to its catalog entries, in catalog order", () => {
  const catalog = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const profiles = { minimal: ["c", "a"] };
  const result = resolveProfile(profiles, catalog, "minimal");
  assert.deepEqual(
    result.map((p) => p.id),
    ["a", "c"],
  );
});

test("resolveProfile returns null for an unknown profile name", () => {
  assert.equal(resolveProfile({ minimal: ["a"] }, [{ id: "a" }], "nope"), null);
  assert.equal(resolveProfile(null, [{ id: "a" }], "minimal"), null);
});
