#!/usr/bin/env node
// base_project:managed
const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");
const { canonicalHome } = require("./paths");

function help() {
  console.log(`sync — git operations on canonical ~/.agents/
Usage:
  node dev/scripts/sync.js init
  node dev/scripts/sync.js status
  node dev/scripts/sync.js commit -m "msg"
  node dev/scripts/sync.js push
  node dev/scripts/sync.js pull
`);
}

function run(cmd, cwd) {
  return execSync(cmd, {
    cwd,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
}

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h") || args.length === 0) {
  help();
  process.exit(0);
}
const home =
  process.env.AGENTS_HOME || process.env.BASE_PROJECT_HOME
    ? process.env.AGENTS_HOME || process.env.BASE_PROJECT_HOME
    : canonicalHome();
const sub = args[0];

if (sub === "init") {
  fs.mkdirSync(home, { recursive: true });
  if (!fs.existsSync(path.join(home, ".git"))) {
    run("git init", home);
    // ensure .gitignore
    const gi = path.join(home, ".gitignore");
    if (!fs.existsSync(gi))
      fs.writeFileSync(gi, "keys/\nreports/\nsnapshots/\n", "utf8");
    const readme = path.join(home, "README.md");
    if (!fs.existsSync(readme))
      fs.writeFileSync(readme, "# ~/.agents\n", "utf8");
    console.log(`sync init: git repo at ${home}`);
  } else {
    console.log(`sync init: already a git repo at ${home}`);
  }
  process.exit(0);
}
if (sub === "status") {
  try {
    const out = run("git status --porcelain", home);
    console.log(out || "(clean)");
    process.exit(0);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
if (sub === "commit") {
  const msgIdx = args.indexOf("-m");
  const msg = msgIdx !== -1 ? args[msgIdx + 1] : "sync";
  try {
    run("git add -A", home);
    run(`git commit -m "${msg.replace(/"/g, '\\"')}"`, home);
    console.log(`sync commit: ${msg}`);
    process.exit(0);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
if (sub === "push") {
  try {
    const out = run("git push", home);
    console.log(out);
    process.exit(0);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
if (sub === "pull") {
  try {
    const out = run("git pull", home);
    console.log(out);
    process.exit(0);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}

console.error(`unknown sync subcommand: ${sub}`);
help();
process.exit(1);
