#!/usr/bin/env node
// base_project:managed
const fs = require("node:fs");
const path = require("node:path");
const { canonicalHome } = require("./paths");

function help() {
  console.log(`tasks — local-first task tracking per project
Usage:
  node dev/scripts/tasks.js --project <path> add "task title"
  node dev/scripts/tasks.js --project <path> list [--json]
  node dev/scripts/tasks.js --project <path> done <id>
`);
}

function tasksFile(projectPath, home) {
  const name = path.basename(path.resolve(projectPath || "global"));
  return path.join(home || canonicalHome(), "tasks", `${name}.jsonl`);
}

function historyFile(projectPath, home) {
  const name = path.basename(path.resolve(projectPath || "global"));
  return path.join(home || canonicalHome(), "history", `${name}.jsonl`);
}

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h") || args.length === 0) {
  help();
  process.exit(0);
}
const projIdx = args.indexOf("--project");
const proj = projIdx !== -1 ? args[projIdx + 1] : null;
const home =
  process.env.AGENTS_HOME || process.env.BASE_PROJECT_HOME
    ? process.env.AGENTS_HOME || process.env.BASE_PROJECT_HOME
    : canonicalHome();
const sub = args.find((a) => ["add", "list", "done"].includes(a));

if (!proj) {
  console.error("tasks requires --project <path>");
  process.exit(2);
}

if (sub === "add") {
  const titleIdx = args.indexOf("add") + 1;
  const title = args[titleIdx];
  if (!title) {
    console.error("add requires <title>");
    process.exit(1);
  }
  const file = tasksFile(proj, home);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const id = Date.now().toString(36);
  const entry = {
    id,
    title,
    status: "open",
    created: new Date().toISOString(),
    project: path.resolve(proj),
  };
  fs.appendFileSync(file, `${JSON.stringify(entry)}\n`, "utf8");
  // also append to history
  const hFile = historyFile(proj, home);
  fs.mkdirSync(path.dirname(hFile), { recursive: true });
  fs.appendFileSync(
    hFile,
    `${JSON.stringify({ ts: entry.created, action: "task:add", id, title })}\n`,
    "utf8",
  );
  console.log(`added task ${id}: ${title}`);
  process.exit(0);
}
if (sub === "list") {
  const file = tasksFile(proj, home);
  if (!fs.existsSync(file)) {
    if (args.includes("--json")) console.log(JSON.stringify([], null, 2));
    else console.log("(no tasks)");
    process.exit(0);
  }
  const lines = fs
    .readFileSync(file, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));
  if (args.includes("--json")) console.log(JSON.stringify(lines, null, 2));
  else for (const t of lines) console.log(`${t.id} [${t.status}] ${t.title}`);
  process.exit(0);
}
if (sub === "done") {
  const idIdx = args.indexOf("done") + 1;
  const id = args[idIdx];
  const file = tasksFile(proj, home);
  if (!fs.existsSync(file)) {
    console.error("no tasks file");
    process.exit(1);
  }
  const lines = fs
    .readFileSync(file, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));
  const found = lines.find((t) => t.id === id);
  if (!found) {
    console.error(`task ${id} not found`);
    process.exit(1);
  }
  found.status = "done";
  found.doneAt = new Date().toISOString();
  fs.writeFileSync(
    file,
    `${lines.map((l) => JSON.stringify(l)).join("\n")}\n`,
    "utf8",
  );
  console.log(`done ${id}`);
  process.exit(0);
}

help();
process.exit(1);
