#!/usr/bin/env node
// base_project:managed
// @ts-check
// Per-project rule overrides (the rulesonproject command). The SessionStart hook prints the
// override block for the current project; the command runs this file's CLI to read and edit
// it. Overrides live outside the project, in ~/.base_project/project-rules/<key>.json, so
// neither the project nor base_project's own rules change (the zero-footprint decision).
// This file sits in hooks/ because both installers already copy every hooks/*.js; it is a
// library plus CLI, not a registered hook.

const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { parseArgs } = require("node:util");
const { execFileSync } = require("node:child_process");

const MAX_BLOCK_CHARS = 5000;
const MAX_REPLACES = 200;
const MAX_RULE = 600;
const MAX_FIND_HITS = 20;

// Vetoing these needs --allow-protected, which the command passes only after the user has
// confirmed the exact text in chat.
const PROTECTED_HEADING =
  /^#{2,3} (?:Security|Autonomy (?:&|and) Confirmations|UI verification & screen control)\b/i;
const PROTECTED_TEXT = /tiered autonomy|human-in-the-loop/i;
const PROTECTED_COMMANDS = new Set([
  "ship",
  "pr",
  "uninstall",
  "undo",
  "council",
]);

// Where the installed base_project rules, commands and references live, relative to home.
const SOURCE_ROOTS = [
  [".claude", "CLAUDE.md"],
  [".claude", "commands"],
  [".claude", "agents"],
  [".claude", "base_project"],
  [".config", "opencode", "AGENTS.md"],
  [".config", "opencode", "command"],
  [".config", "opencode", "agent"],
  [".config", "opencode", "base_project"],
  [".codex", "AGENTS.md"],
  [".codex", "base_project"],
  [".agents", "skills"],
];
const SKIPPED_DIRECTORIES = new Set(["usage", "node_modules"]);

function git(args, cwd) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    timeout: 5000,
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

function slug(name) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "project"
  );
}

function realPath(target) {
  try {
    return fs.realpathSync.native(target);
  } catch {
    return path.resolve(target);
  }
}

// The project is the main working tree of the repository, so every git worktree of one
// repository shares one set of overrides. Outside git, the directory itself is the project.
function projectInfo(cwd) {
  let root = path.resolve(cwd);
  try {
    const common = path.resolve(
      cwd,
      git(["rev-parse", "--git-common-dir"], cwd),
    );
    root =
      path.basename(common) === ".git"
        ? path.dirname(common)
        : git(["rev-parse", "--show-toplevel"], cwd);
  } catch {
    // not a git repository
  }
  const real = realPath(root).replaceAll("\\", "/");
  const identity = process.platform === "win32" ? real.toLowerCase() : real;
  const digest = crypto
    .createHash("sha256")
    .update(identity)
    .digest("hex")
    .slice(0, 8);
  return { key: `${slug(path.posix.basename(real))}-${digest}`, root: real };
}

function storeDirectory(home) {
  return path.join(home, ".base_project", "project-rules");
}

function storeFile(key, home) {
  return path.join(storeDirectory(home), `${key}.json`);
}

function readStore(file) {
  if (!fs.existsSync(file)) return null;
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  if (data?.version !== 1 || !Array.isArray(data.rules)) {
    throw new Error(`Unsupported project-rules file: ${file}`);
  }
  return data;
}

function writeStore(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(data, null, 2)}\n`);
  fs.renameSync(temporary, file);
}

function markdownFiles(target, depth = 0) {
  let stat;
  try {
    stat = fs.statSync(target);
  } catch {
    return [];
  }
  if (stat.isFile()) return target.endsWith(".md") ? [target] : [];
  if (!stat.isDirectory() || depth > 4) return [];
  return fs
    .readdirSync(target)
    .filter((name) => !SKIPPED_DIRECTORIES.has(name))
    .sort()
    .flatMap((name) => markdownFiles(path.join(target, name), depth + 1));
}

function commandName(file) {
  const base = path.basename(file);
  if (base === "SKILL.md") return path.basename(path.dirname(file));
  const folder = path.basename(path.dirname(file));
  return folder === "commands" || folder === "command"
    ? base.replace(/\.md$/, "")
    : "";
}

// Case-insensitive search of one line of text in the installed rule sources.
function findInSources(needle, home) {
  const wanted = needle.toLowerCase();
  const hits = [];
  for (const root of SOURCE_ROOTS) {
    for (const file of markdownFiles(path.join(home, ...root))) {
      const protectedCommand = PROTECTED_COMMANDS.has(commandName(file));
      let heading = "";
      let itemStart = "";
      const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
      for (const [index, line] of lines.entries()) {
        if (/^#{1,6} /.test(line)) {
          heading = line;
          itemStart = "";
        } else if (/^\s*(?:\d+\.|[-*]) /.test(line)) {
          itemStart = line;
        }
        if (!line.toLowerCase().includes(wanted)) continue;
        hits.push({
          file,
          line: index + 1,
          text: line.trim(),
          heading,
          protected:
            protectedCommand ||
            PROTECTED_HEADING.test(heading) ||
            PROTECTED_TEXT.test(`${itemStart}\n${line}`),
        });
      }
    }
  }
  return hits;
}

function ruleStatus(rule, home) {
  if (!rule.anchor) return "addition";
  const hits = findInSources(rule.anchor, home);
  if (hits.length === 0) return "stale";
  return hits.some((hit) => hit.protected) ? "protected" : "ok";
}

function nextId(rules) {
  const numbers = rules
    .map((rule) => Number(String(rule.id).replace(/^O/, "")))
    .filter(Number.isFinite);
  let highest = 0;
  for (const number of numbers) highest = Math.max(highest, number);
  return `O${highest + 1}`;
}

function clean(text, max, label) {
  const value = String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!value) throw new Error(`${label} is empty`);
  if (value.length > max) {
    throw new Error(`${label} is longer than ${max} characters`);
  }
  return value;
}

// The text the SessionStart hook injects. Capped so a long list cannot crowd out the session.
function renderBlock(store, name) {
  if (!store || store.rules.length === 0) return "";
  const head = [
    `Project overrides for ${name} (set with rulesonproject). Each override replaces the base_project rule, command step, or reference text it names, in this project only.`,
    "If a base_project rule says A and an override says B, do B.",
  ];
  const lines = [];
  let used = head.join("\n").length;
  for (const rule of store.rules) {
    const line = rule.replaces
      ? `- ${rule.id} instead of "${rule.replaces}": ${rule.rule}`
      : `- ${rule.id}: ${rule.rule}`;
    if (used + line.length + 1 > MAX_BLOCK_CHARS) break;
    lines.push(line);
    used += line.length + 1;
  }
  const hidden = store.rules.length - lines.length;
  if (hidden > 0) {
    lines.push(
      `- ${hidden} more override(s) not shown. Run the rulesonproject command with list.`,
    );
  }
  return [...head, ...lines].join("\n");
}

// Never throws: the hook must not fail the session.
function renderForCwd(cwd, home = os.homedir()) {
  try {
    const info = projectInfo(cwd);
    const store = readStore(storeFile(info.key, home));
    return renderBlock(store, path.posix.basename(info.root));
  } catch {
    return "";
  }
}

const USAGE = `Usage: node project-rules.js <command> [options]
  key                         show this project's key, root and store file
  find <text>                 search the installed rules, commands and references
  list [--all]                list this project's overrides (--all: every project)
  add --rule <text> [--replaces <text>] [--anchor <text>] [--allow-protected]
  remove <id>                 remove one override
  render                      print the block the SessionStart hook injects
  adopt <old-key>             move another project's overrides to this project
options: --cwd <dir>  --home <dir>`;

function runCli(argv, output = process.stdout, errors = process.stderr) {
  const out = (text) => output.write(`${text}\n`);
  const fail = (text) => errors.write(`${text}\n`);
  const [command, ...rest] = argv;
  try {
    const { values, positionals } = parseArgs({
      args: rest,
      allowPositionals: true,
      options: {
        cwd: { type: "string" },
        home: { type: "string" },
        all: { type: "boolean" },
        rule: { type: "string" },
        replaces: { type: "string" },
        anchor: { type: "string" },
        "allow-protected": { type: "boolean" },
      },
    });
    const cwd = values.cwd ?? process.cwd();
    const home = values.home ?? os.homedir();
    const info = projectInfo(cwd);
    const file = storeFile(info.key, home);

    if (command === "key") {
      const store = readStore(file);
      out(`key: ${info.key}`);
      out(`root: ${info.root}`);
      out(`store: ${file.replaceAll("\\", "/")}`);
      out(`overrides: ${store ? store.rules.length : 0}`);
      return 0;
    }

    if (command === "find") {
      const needle = positionals.join(" ").trim();
      if (!needle) throw new Error("find needs the text to search for");
      const hits = findInSources(needle, home);
      if (hits.length === 0) {
        out("no match");
        return 0;
      }
      for (const hit of hits.slice(0, MAX_FIND_HITS)) {
        out(
          `${hit.file.replaceAll("\\", "/")}:${hit.line}${hit.protected ? " [protected]" : ""} ${hit.heading || "(no heading)"} :: ${hit.text.slice(0, 120)}`,
        );
      }
      if (hits.length > MAX_FIND_HITS) {
        out(
          `... ${hits.length - MAX_FIND_HITS} more match(es). Narrow the text.`,
        );
      }
      return 0;
    }

    if (command === "list") {
      if (values.all) {
        const directory = storeDirectory(home);
        const names = fs.existsSync(directory)
          ? fs.readdirSync(directory).filter((name) => name.endsWith(".json"))
          : [];
        if (names.length === 0) out("no projects with overrides");
        for (const name of names.sort()) {
          try {
            const data = readStore(path.join(directory, name));
            const exists = fs.existsSync(data.path)
              ? "path exists"
              : "path missing";
            out(
              `${name.replace(/\.json$/, "")} | ${data.path} | ${exists} | ${data.rules.length} override(s)`,
            );
          } catch (error) {
            out(
              `${name} | unreadable: ${error instanceof Error ? error.message : error}`,
            );
          }
        }
        return 0;
      }
      const store = readStore(file);
      out(`project: ${info.root}`);
      if (!store || store.rules.length === 0) {
        out("no overrides");
        return 0;
      }
      for (const rule of store.rules) {
        const target = rule.replaces ? `instead of "${rule.replaces}": ` : "";
        out(`${rule.id} | ${ruleStatus(rule, home)} | ${target}${rule.rule}`);
      }
      return 0;
    }

    if (command === "add") {
      const rule = clean(values.rule, MAX_RULE, "--rule");
      const replaces = values.replaces
        ? clean(values.replaces, MAX_REPLACES, "--replaces")
        : null;
      const anchor = values.anchor
        ? clean(values.anchor, MAX_REPLACES, "--anchor")
        : null;
      let isProtected = false;
      if (anchor) {
        const hits = findInSources(anchor, home);
        if (hits.length === 0) {
          fail(
            `anchor not found in the installed rule sources: "${anchor}". Run find first.`,
          );
          return 1;
        }
        isProtected = hits.some((hit) => hit.protected);
        if (isProtected && !values["allow-protected"]) {
          fail(
            "protected rule: this text sits in a safety rule or a safety-gated command.",
          );
          for (const hit of hits
            .filter((entry) => entry.protected)
            .slice(0, 5)) {
            fail(
              `${hit.file.replaceAll("\\", "/")}:${hit.line} :: ${hit.text.slice(0, 120)}`,
            );
          }
          fail(
            "Show this text to the user. Add --allow-protected only after the user confirms.",
          );
          return 3;
        }
      }
      const store = readStore(file) ?? {
        version: 1,
        path: info.root,
        rules: [],
      };
      const id = nextId(store.rules);
      store.rules.push({
        id,
        replaces,
        anchor,
        rule,
        protected: isProtected,
        added: new Date().toISOString().slice(0, 10),
      });
      writeStore(file, store);
      out(`added ${id}`);
      return 0;
    }

    if (command === "remove") {
      const id = positionals[0];
      const store = readStore(file);
      const index = store
        ? store.rules.findIndex((rule) => rule.id === id)
        : -1;
      if (!store || index < 0) {
        fail(`no override ${id ?? ""} in this project`);
        return 1;
      }
      store.rules.splice(index, 1);
      if (store.rules.length === 0) fs.unlinkSync(file);
      else writeStore(file, store);
      out(`removed ${id}`);
      return 0;
    }

    if (command === "render") {
      const block = renderForCwd(cwd, home);
      if (block) out(block);
      return 0;
    }

    if (command === "adopt") {
      const oldKey = positionals[0];
      if (!oldKey || !/^[a-z0-9-]+$/.test(oldKey)) {
        throw new Error("adopt needs the old key from list --all");
      }
      const oldFile = storeFile(oldKey, home);
      const data = readStore(oldFile);
      if (!data) {
        fail(`no stored overrides for key ${oldKey}`);
        return 1;
      }
      if (fs.existsSync(file)) {
        fail("this project already has overrides; remove them first");
        return 1;
      }
      data.path = info.root;
      writeStore(file, data);
      fs.unlinkSync(oldFile);
      out(`adopted ${data.rules.length} override(s) from ${oldKey}`);
      return 0;
    }

    fail(USAGE);
    return 1;
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

if (require.main === module) {
  process.exitCode = runCli(process.argv.slice(2));
}

module.exports = {
  MAX_BLOCK_CHARS,
  projectInfo,
  storeFile,
  readStore,
  findInSources,
  ruleStatus,
  renderBlock,
  renderForCwd,
  runCli,
};
