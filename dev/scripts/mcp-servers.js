#!/usr/bin/env node
// base_project:managed
// @ts-check
// The MCP servers base_project registers in every engine, and the definitions it shipped
// before, so an installer can tell its own stale entries from a user's (GOALS 17 R17.23).
//
// source/opencode/mcp.json is the current set. source/opencode/mcp-previous.json lists every
// definition an earlier version registered. A server no longer shipped is retired, and a
// shipped one whose definition changed (a version pin) is upgraded — but only while the
// user's entry still matches one of those definitions exactly. Anything else is the user's
// own and is left untouched.
//
// Usage:
//   node mcp-servers.js --claude-retirements [--claude-config <file>]
//     Prints, one per line, the retired servers still registered in Claude Code's user
//     scope with a definition base_project shipped. The installers pass each name to
//     `claude mcp remove`. Prints nothing when the config is missing or unreadable.

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const mcpSourceDir = path.resolve(__dirname, "..", "..", "source", "opencode");
const CODEX_HEADER =
  "# --- base_project managed MCP servers (safe to edit; re-added if removed) ---";

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function loadCurrent() {
  return readJson(path.join(mcpSourceDir, "mcp.json")).mcpServers;
}

function loadPrevious() {
  return readJson(path.join(mcpSourceDir, "mcp-previous.json")).servers;
}

// JSON with object keys sorted, so two definitions compare equal regardless of key order.
function canonical(value) {
  return JSON.stringify(value, (_key, item) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(
          Object.entries(item).sort(([a], [b]) => (a < b ? -1 : 1)),
        )
      : item,
  );
}

// ---------------------------------------------------------------------------
// Claude Code (user scope, ~/.claude.json)
// ---------------------------------------------------------------------------

// Claude Code stores `claude mcp add` stdio servers as {type:"stdio", command, args, env}
// and --transport http ones as {type:"http", url, headers}.
function claudeMatches(entry, definition) {
  if (!entry || typeof entry !== "object") return false;
  if (definition.type === "remote") {
    return (
      entry.type === "http" &&
      entry.url === definition.url &&
      canonical(entry.headers || {}) === canonical(definition.headers || {})
    );
  }
  return (
    (entry.type === undefined || entry.type === "stdio") &&
    entry.command === definition.command &&
    canonical(entry.args || []) === canonical(definition.args || []) &&
    canonical(entry.env || {}) === canonical(definition.env || {})
  );
}

function claudeRetirements(claudeConfig, current, previous) {
  const registered = claudeConfig?.mcpServers;
  if (!registered || typeof registered !== "object") return [];
  return Object.entries(previous)
    .filter(
      ([name, definitions]) =>
        !Object.hasOwn(current, name) &&
        Object.hasOwn(registered, name) &&
        definitions.some((definition) =>
          claudeMatches(registered[name], definition),
        ),
    )
    .map(([name]) => name);
}

function claudeConfigPath() {
  return process.env.CLAUDE_CONFIG_DIR
    ? path.join(process.env.CLAUDE_CONFIG_DIR, ".claude.json")
    : path.join(os.homedir(), ".claude.json");
}

// ---------------------------------------------------------------------------
// Codex (config.toml) — no TOML parser: only whole tables that match a block base_project
// wrote are replaced or removed; everything else in the file stays byte for byte.
// ---------------------------------------------------------------------------

function codexBlock(name, server, eol = "\n") {
  const lines = [
    `[mcp_servers.${name}]`,
    `command = ${JSON.stringify(server.command)}`,
    `args = [${(server.args || []).map((arg) => JSON.stringify(arg)).join(", ")}]`,
  ];
  const env = Object.entries(server.env || {});
  if (env.length) {
    lines.push(`[mcp_servers.${name}.env]`);
    for (const [key, value] of env) {
      lines.push(`${key} = ${JSON.stringify(value)}`);
    }
  }
  return `${lines.join(eol)}${eol}`;
}

function normalize(block) {
  return block
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .trimEnd();
}

function headerPath(inner) {
  const keys = [];
  let key = "";
  let quote = null;
  for (const character of inner) {
    if (quote) {
      if (character === quote) quote = null;
      else key += character;
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === ".") {
      keys.push(key.trim());
      key = "";
    } else {
      key += character;
    }
  }
  keys.push(key.trim());
  return keys;
}

// Table headers with their spans; a header-looking line inside a multi-line string is skipped.
function tomlTables(text) {
  const tables = [];
  let offset = 0;
  /** @type {string | null} */
  let openString = null;
  for (const line of text.split(/(?<=\n)/)) {
    const content = line.replace(/\r?\n$/, "");
    if (openString) {
      if (content.split(openString).length % 2 === 0) openString = null;
    } else {
      const header = content.match(
        /^[ \t]*(\[\[?)([^[\]]*)\]\]?[ \t]*(?:#.*)?$/,
      );
      if (header) {
        tables.push({
          path: headerPath(header[2]),
          array: header[1] === "[[",
          start: offset,
          end: text.length,
        });
      } else {
        openString =
          ['"""', "'''"].find(
            (delimiter) => content.split(delimiter).length % 2 === 0,
          ) || null;
      }
    }
    offset += line.length;
  }
  tables.forEach((table, index) => {
    if (tables[index + 1]) table.end = tables[index + 1].start;
  });
  return tables;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// A server defined without its own `[mcp_servers.NAME]` table (dotted keys, or inside a
// bare `[mcp_servers]` table) is present too: appending a table would duplicate the key.
function definedWithoutTable(text, tables, name) {
  const key = `(?:${escapeRegExp(name)}|"${escapeRegExp(name)}")`;
  const rootText = text.slice(0, tables[0]?.start ?? text.length);
  const dotted = new RegExp(
    `^[ \\t]*mcp_servers[ \\t]*\\.[ \\t]*${key}[ \\t]*[.=]`,
    "m",
  );
  const parent = tables.find(
    (table) =>
      !table.array &&
      table.path.length === 1 &&
      table.path[0] === "mcp_servers",
  );
  const inParent = parent
    ? new RegExp(`^[ \\t]*${key}[ \\t]*[.=]`, "m").test(
        text.slice(parent.start, parent.end),
      )
    : false;
  return dotted.test(rootText) || inParent;
}

function mergeCodexConfig(originalText, current, previous) {
  const source = originalText || "";
  const eol = source.includes("\r\n") ? "\r\n" : "\n";
  const notes = [];
  const warnings = [];
  const tables = tomlTables(source);
  const rootText = source.slice(0, tables[0]?.start ?? source.length);
  if (/^[ \t]*mcp_servers[ \t]*=/m.test(rootText)) {
    warnings.push(
      "config.toml defines mcp_servers as an inline table - left untouched; add base_project's servers yourself",
    );
    return { text: source, changed: false, notes, warnings };
  }

  const edits = [];
  const present = new Set();
  for (const name of new Set([
    ...Object.keys(current),
    ...Object.keys(previous),
  ])) {
    const desired = current[name];
    const ownTables = tables.filter(
      (table) =>
        !table.array &&
        table.path[0] === "mcp_servers" &&
        table.path[1] === name,
    );
    const main = ownTables.find((table) => table.path.length === 2);
    if (!main) {
      if (ownTables.length || definedWithoutTable(source, tables, name)) {
        present.add(name);
        if (desired) {
          warnings.push(
            `Codex MCP server '${name}' is defined in a form base_project does not manage - left as is`,
          );
        }
      }
      continue;
    }
    present.add(name);
    // The block base_project wrote is the table plus any sub-tables right after it.
    let last = tables.indexOf(main);
    while (
      tables[last + 1] &&
      ownTables.includes(tables[last + 1]) &&
      tables[last + 1].path.length > 2
    ) {
      last += 1;
    }
    const extentEnd = tables[last].end;
    const extent = ownTables.every(
      (table) => table.start >= main.start && table.end <= extentEnd,
    )
      ? normalize(source.slice(main.start, extentEnd))
      : null;
    if (desired && extent === normalize(codexBlock(name, desired))) continue;
    const shipped = (previous[name] || []).some(
      (definition) => extent === normalize(codexBlock(name, definition)),
    );
    if (!shipped) {
      if (desired) {
        warnings.push(
          `Codex MCP server '${name}' is your own definition - left as is (base_project's version not applied)`,
        );
      }
      continue;
    }
    const raw = source.slice(main.start, extentEnd);
    const contentEnd = main.start + raw.length - raw.match(/\s*$/)[0].length;
    const lineEnd = source.indexOf("\n", contentEnd);
    if (desired) {
      edits.push({
        start: main.start,
        end: lineEnd === -1 ? source.length : lineEnd + 1,
        text: codexBlock(name, desired, eol),
      });
      notes.push(
        `upgraded Codex MCP server '${name}' to the current definition`,
      );
    } else {
      edits.push({ start: main.start, end: extentEnd, text: "" });
      notes.push(
        `retired Codex MCP server '${name}' (no longer shipped; it still had base_project's definition)`,
      );
    }
  }

  let text = source;
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    text = text.slice(0, edit.start) + edit.text + text.slice(edit.end);
  }
  // A header comment left with nothing after it is removed with its last server.
  if (text.trimEnd().endsWith(CODEX_HEADER) && edits.length) {
    text = text.trimEnd().slice(0, -CODEX_HEADER.length);
  }

  for (const [name, server] of Object.entries(current)) {
    if (present.has(name)) continue;
    if (!server.command) {
      warnings.push(
        `'${name}' is a remote MCP server - add it to config.toml yourself (url-based syntax not emitted here)`,
      );
      continue;
    }
    if (!text.includes(CODEX_HEADER)) {
      text = `${text.trimEnd()}${text.trim() ? `${eol}${eol}` : ""}${CODEX_HEADER}`;
    }
    text = `${text.trimEnd()}${eol}${eol}${codexBlock(name, server, eol)}`;
    notes.push(`appended Codex MCP server '${name}'`);
  }

  if (text !== source) text = `${text.trimEnd()}${eol}`;
  return { text, changed: text !== source, notes, warnings };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function run(args) {
  if (!args.includes("--claude-retirements")) {
    process.stderr.write(
      "usage: mcp-servers.js --claude-retirements [--claude-config <file>]\n",
    );
    return 64;
  }
  const flag = args.indexOf("--claude-config");
  const file =
    flag !== -1 && args[flag + 1] ? args[flag + 1] : claudeConfigPath();
  let config;
  try {
    config = readJson(file);
  } catch {
    return 0;
  }
  for (const name of claudeRetirements(config, loadCurrent(), loadPrevious())) {
    process.stdout.write(`${name}\n`);
  }
  return 0;
}

if (require.main === module) {
  process.exitCode = run(process.argv.slice(2));
}

module.exports = {
  CODEX_HEADER,
  claudeMatches,
  claudeRetirements,
  codexBlock,
  loadCurrent,
  loadPrevious,
  mergeCodexConfig,
  tomlTables,
};
