// base_project:managed
// Pure, side-effect-free logic shared by server.js and its tests. No top-level
// I/O, no DatabaseSync, no server.listen() — safe to require() from a test
// runner without touching the real ~/.base_project/ state.

const fs = require("fs");

function normalizeProjectPath(p) {
  if (!p) return "";
  return p.replace(/\\/g, "/").toLowerCase().replace(/\/+$/, "");
}

// The usage log is a single shared file (multiple projects log into it), but the
// dashboard itself never shows more than one project's data — every read filters
// down to the requesting project right here, before anything reaches the client.
function readEventsForProject(logPath, projectPath) {
  const target = normalizeProjectPath(projectPath);
  if (!target) return [];
  try {
    const raw = fs.readFileSync(logPath, "utf8");
    return raw
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter((e) => e && normalizeProjectPath(e.project) === target);
  } catch {
    return [];
  }
}

function readCatalog(catalogPaths) {
  for (const p of catalogPaths) {
    try {
      return JSON.parse(fs.readFileSync(p, "utf8")).catalog || [];
    } catch {
      // try next path
    }
  }
  return [];
}

// "installed" combines two independent signals: the plugin was actually used
// (usedIds, from real hook events) OR — for plugins.json entries with a
// pluginName — `claude plugin list` confirms it's installed even if never used
// yet. Skills installed via `npx skills add` (no central registry) only ever
// get the "used" signal. claudePlugins is a Set or null (undetectable).
function buildCatalogSnapshot(catalog, events, claudePlugins) {
  const usedIds = new Set(events.map((e) => e.plugin).filter(Boolean));
  return catalog.map((p) => {
    const used = usedIds.has(p.id);
    const installedViaPlugin = !!(
      p.pluginName &&
      claudePlugins &&
      claudePlugins.has(p.pluginName)
    );
    return {
      ...p,
      installed: used || installedViaPlugin,
      used,
      installedViaPlugin,
    };
  });
}

function resolveProfile(profiles, catalog, profileName) {
  if (!profiles || !Object.hasOwn(profiles, profileName)) {
    return null;
  }
  const ids = new Set(profiles[profileName]);
  return catalog.filter((p) => ids.has(p.id));
}

module.exports = {
  normalizeProjectPath,
  readEventsForProject,
  readCatalog,
  buildCatalogSnapshot,
  resolveProfile,
};
