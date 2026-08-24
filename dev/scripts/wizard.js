#!/usr/bin/env node
// base_project:managed
const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");
const { canonicalHome } = require("./paths");

function help() {
  console.log(`wizard — interactive onboarding for unified layer
Usage:
  node dev/scripts/wizard.js [--dry-run] [--apply]
Modes: from-home / from-manifest / fresh (auto-detected)
`);
}

async function runWizard({ dryRun }) {
  const home =
    process.env.AGENTS_HOME || process.env.BASE_PROJECT_HOME
      ? process.env.AGENTS_HOME || process.env.BASE_PROJECT_HOME
      : canonicalHome();
  const hasCanonical = fs.existsSync(path.join(home, "config.json"));
  const hasAgentsHome = fs.existsSync(home);
  const hasManifest =
    fs.existsSync(path.join(process.cwd(), ".agentsrc.json")) ||
    fs.existsSync(path.join(process.cwd(), ".agents", "config.json"));

  let mode = "fresh";
  if (hasAgentsHome && hasCanonical) mode = "from-home";
  else if (hasManifest) mode = "from-manifest";

  const answers = {};
  if (!dryRun) {
    // In dry-run we don't prompt, just report
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    const ask = (q) => new Promise((res) => rl.question(q, res));
    answers.stack = await ask("stack/app_type? ");
    answers.editor = await ask(
      "editor/harness (claude-code/opencode/cursor/codex)? ",
    );
    answers.automation = await ask("automation level (low/medium/high)? ");
    answers.importExisting = await ask(
      "import existing ~/.claude/ files? (y/N) ",
    );
    rl.close();
  }

  const summary = {
    mode,
    home,
    wouldCreate: !hasAgentsHome
      ? [home, path.join(home, "rules/global"), path.join(home, "mcp")]
      : [],
    answers: dryRun
      ? { note: "dry-run: no prompts, would ask stack/editor/automation" }
      : answers,
  };

  if (dryRun) {
    console.log(JSON.stringify(summary, null, 2));
    console.log("dry-run: no files written");
    return summary;
  }

  // simple scaffold
  for (const d of summary.wouldCreate) fs.mkdirSync(d, { recursive: true });
  // ensure config
  const cfgPath = path.join(home, "config.json");
  if (!fs.existsSync(cfgPath)) {
    fs.mkdirSync(path.dirname(cfgPath), { recursive: true });
    fs.writeFileSync(
      cfgPath,
      JSON.stringify(
        {
          schema_version: "1.0",
          projects: {},
          defaults: { link_type: "auto" },
        },
        null,
        2,
      ),
    );
  }
  console.log(`wizard: initialized ${home} (mode: ${mode})`);
  if (
    answers.importExisting &&
    String(answers.importExisting).toLowerCase().startsWith("y")
  ) {
    console.log(
      "wizard: import existing -> would run capture (not auto-applied without consent)",
    );
  }
  return summary;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    help();
    process.exit(0);
  }
  const dryRun = args.includes("--dry-run");
  // dryRun vs apply: if no flag, default to dry-run for safety
  runWizard({ dryRun: dryRun || !args.includes("--apply") }).then(
    () => process.exit(0),
    (e) => {
      console.error(e.message);
      process.exit(1);
    },
  );
}

module.exports = { runWizard };
