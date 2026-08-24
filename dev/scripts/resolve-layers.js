#!/usr/bin/env node
// base_project:managed
const fs = require("node:fs");
const path = require("node:path");
const {
  canonicalHome,
  configPath,
  rulesGlobalDir,
  rulesProjectDir,
  mcpPath,
} = require("./paths");

function readJson(p, fallback = null) {
  try {
    if (!fs.existsSync(p)) return fallback;
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return fallback;
  }
}

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => !f.startsWith("."))
      .map((f) => path.join(dir, f));
  } catch {
    return [];
  }
}

function resolveLayers(projectPath, opts = {}) {
  const home = opts.home || canonicalHome();
  const cfg = readJson(configPath(home), { projects: {}, defaults: {} });
  const abs = projectPath ? path.resolve(projectPath) : null;

  let projectName = null;
  if (abs) {
    for (const [k, v] of Object.entries(cfg.projects || {})) {
      if (path.resolve(v.path) === abs) {
        projectName = k;
        break;
      }
    }
    if (!projectName) projectName = path.basename(abs);
  }

  const layers = [];
  const globalDir = rulesGlobalDir(home);
  layers.push({
    source: "global",
    files: listFiles(globalDir),
    dir: globalDir,
  });

  if (opts.agent) {
    const agentDir = path.join(home, "rules", opts.agent);
    if (fs.existsSync(agentDir)) {
      layers.push({
        source: `agent:${opts.agent}`,
        files: listFiles(agentDir),
        dir: agentDir,
      });
    }
  }

  if (projectName) {
    const projDir = rulesProjectDir(projectName, home);
    layers.push({
      source: `project:${projectName}`,
      files: listFiles(projDir),
      dir: projDir,
      name: projectName,
    });
  }

  const mcp = readJson(mcpPath(home), { mcpServers: {} });

  return {
    layers,
    effectiveConfig: {
      mcp,
      skills: listFiles(path.join(home, "skills")),
      instructions: layers.flatMap((l) => l.files),
    },
    canonicalHome: home,
    projectName,
  };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`resolve-layers — resolve effective config layers
Usage:
  node dev/scripts/resolve-layers.js --project <path> [--agent <name>] [--json]
`);
    process.exit(0);
  }
  if (args.includes("--project") || args.includes("--json")) {
    const idx = args.indexOf("--project");
    const agentIdx = args.indexOf("--agent");
    const proj = idx !== -1 ? args[idx + 1] : null;
    const agent = agentIdx !== -1 ? args[agentIdx + 1] : null;
    const result = resolveLayers(proj || process.cwd(), { agent });

    if (args.includes("--json")) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`Layers for ${proj || process.cwd()}:`);
      for (const l of result.layers)
        console.log(`  ${l.source}: ${l.files.length} files`);
      console.log(
        `MCP servers: ${Object.keys(result.effectiveConfig.mcp.mcpServers || {}).length}`,
      );
    }
    process.exit(0);
  }
}

module.exports = { resolveLayers };
