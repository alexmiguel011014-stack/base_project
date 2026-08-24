#!/usr/bin/env node
// base_project:managed
const path = require("node:path");
const { resolveLayers } = require("./resolve-layers");

function help() {
  console.log(`audit — show effective resolved rules for project+agent
Usage:
  node dev/scripts/audit.js --project <path> --agent <id> [--json]
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
  const proj = projIdx !== -1 ? args[projIdx + 1] : null;
  const agent = agentIdx !== -1 ? args[agentIdx + 1] : null;
  if (!proj || !agent) {
    console.error("audit requires --project <path> --agent <id>");
    help();
    process.exit(2);
  }
  const result = resolveLayers(path.resolve(proj), { agent });
  const output = {
    agent,
    project: path.resolve(proj),
    layers: result.layers.map((l) => ({
      source: l.source,
      files: l.files,
      dir: l.dir,
    })),
    effectiveConfig: result.effectiveConfig,
  };
  if (args.includes("--json")) console.log(JSON.stringify(output, null, 2));
  else {
    console.log(`audit for ${agent} @ ${proj}`);
    for (const l of output.layers) {
      console.log(`  ${l.source}: ${l.files.length} files`);
      for (const f of l.files) console.log(`    - ${f}`);
    }
    console.log(
      `effective mcp servers: ${Object.keys(output.effectiveConfig.mcp.mcpServers || {}).length}`,
    );
  }
  process.exit(0);
}

module.exports = { help };
