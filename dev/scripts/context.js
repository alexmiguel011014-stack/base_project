#!/usr/bin/env node
// base_project:managed
const path = require("node:path");
const { resolveLayers } = require("./resolve-layers");

function help() {
  console.log(`context — output fully-resolved effective config for agent consumption
Usage:
  node dev/scripts/context.js --project <path> --agent <id> [--json]
Outputs: { layers, mcp, skills, instructions }
`);
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    help();
    process.exit(0);
  }
  const projIdx = args.indexOf("--project");
  const agentIdx = args.indexOf("--agent");
  const proj = projIdx !== -1 ? args[projIdx + 1] : path.resolve(".");
  const agent = agentIdx !== -1 ? args[agentIdx + 1] : "claude-code";
  const result = resolveLayers(path.resolve(proj), { agent });
  const output = {
    layers: result.layers.map((l) => ({ source: l.source, files: l.files })),
    mcp: result.effectiveConfig.mcp,
    skills: result.effectiveConfig.skills,
    instructions: result.effectiveConfig.instructions,
    project: path.resolve(proj),
    agent,
    canonicalHome: result.canonicalHome,
  };
  console.log(JSON.stringify(output, null, 2));
  process.exit(0);
}

module.exports = { help };
