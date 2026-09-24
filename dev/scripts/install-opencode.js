#!/usr/bin/env node
// base_project:managed
// Merges base_project's global instructions path and MCP servers into opencode's
// global config (opencode.jsonc) without taking over the rest of the file.
//
// Why this exists (dev/auditoria-2026-09-24.md, F3): the installers used to assign
// `instructions` and `mcp` wholesale, deleting every MCP server and instruction path the
// user had added, and treated any `//` comment — legal in a .jsonc file — as invalid JSON,
// so the whole file was recreated from scratch while the installer printed "other keys
// preserved". Both installers now call this one implementation instead:
//
// - The file is parsed tolerantly (comments, trailing commas, BOM) and edited in place:
//   only the `instructions` value and the individual MCP entries base_project owns are
//   rewritten, so comments and formatting elsewhere survive.
// - MCP servers base_project added are tracked in <state-dir>/opencode-managed-mcp.json.
//   A same-named server the user defined themselves is left alone (and reported); a
//   server base_project added earlier but no longer ships is removed. Before any state
//   exists (an install made by an older installer), a server no longer shipped counts as
//   base_project's only while it still matches a definition listed in
//   source/opencode/mcp-previous.json.
// - Anything unparseable is left untouched (exit code 2) — never "start fresh".
//
// Usage: node install-opencode.js [--opencode-home <dir>] [--state-dir <dir>]

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { loadPrevious } = require("./mcp-servers.js");

const repoRoot = path.resolve(__dirname, "..", "..");
const INSTRUCTIONS_FILE = "opencode-instructions.md";
const SCHEMA_URL = "https://opencode.ai/config.json";

function ok(message) {
  process.stdout.write(`  OK  ${message}\n`);
}

// Warnings go to stdout on purpose: Windows PowerShell with ErrorActionPreference=Stop can
// turn a native command's stderr into a terminating error, and a warning must never abort
// the installer.
function warn(message) {
  process.stdout.write(`  !!  ${message}\n`);
}

// ---------------------------------------------------------------------------
// JSONC reading
// ---------------------------------------------------------------------------

function skipString(text, i) {
  // `i` is at the opening quote; returns the index just past the closing quote.
  let j = i + 1;
  while (j < text.length) {
    if (text[j] === "\\") {
      j += 2;
      continue;
    }
    if (text[j] === '"') return j + 1;
    j += 1;
  }
  throw new Error("unterminated string");
}

function skipTrivia(text, i) {
  let j = i;
  while (j < text.length) {
    const c = text[j];
    if (c === " " || c === "\t" || c === "\n" || c === "\r" || c === "﻿") {
      j += 1;
    } else if (c === "/" && text[j + 1] === "/") {
      const end = text.indexOf("\n", j);
      j = end === -1 ? text.length : end;
    } else if (c === "/" && text[j + 1] === "*") {
      const end = text.indexOf("*/", j + 2);
      if (end === -1) throw new Error("unterminated block comment");
      j = end + 2;
    } else {
      break;
    }
  }
  return j;
}

// Comments and trailing commas removed, strings untouched — then plain JSON.parse.
function parseJsonc(text) {
  let out = "";
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === '"') {
      const end = skipString(text, i);
      out += text.slice(i, end);
      i = end;
    } else if (c === "/" && (text[i + 1] === "/" || text[i + 1] === "*")) {
      const end = skipTrivia(text, i);
      out += " ";
      i = end;
    } else if (c === ",") {
      const next = skipTrivia(text, i + 1);
      if (text[next] !== "}" && text[next] !== "]") out += c;
      i += 1;
    } else if (c === "﻿") {
      i += 1;
    } else {
      out += c;
      i += 1;
    }
  }
  return JSON.parse(out);
}

// Skips one JSON value starting at `i` (after trivia); returns the index just past it.
function skipValue(text, i) {
  let j = skipTrivia(text, i);
  const c = text[j];
  if (c === '"') return skipString(text, j);
  if (c === "{" || c === "[") {
    let depth = 0;
    while (j < text.length) {
      const ch = text[j];
      if (ch === '"') {
        j = skipString(text, j);
        continue;
      }
      if (ch === "/" && (text[j + 1] === "/" || text[j + 1] === "*")) {
        j = skipTrivia(text, j);
        continue;
      }
      if (ch === "{" || ch === "[") depth += 1;
      if (ch === "}" || ch === "]") {
        depth -= 1;
        if (depth === 0) return j + 1;
      }
      j += 1;
    }
    throw new Error("unterminated value");
  }
  while (j < text.length && !/[,}\]\s/]/.test(text[j])) j += 1;
  return j;
}

// Direct members of the object whose `{` is at `open`, with their text spans.
function scanObject(text, open) {
  if (text[open] !== "{") throw new Error("expected an object");
  const members = [];
  let i = open + 1;
  while (true) {
    i = skipTrivia(text, i);
    if (i >= text.length) throw new Error("unterminated object");
    if (text[i] === "}") return { open, close: i, members };
    if (text[i] === ",") {
      i += 1;
      continue;
    }
    if (text[i] !== '"') throw new Error("expected a property name");
    const keyStart = i;
    i = skipString(text, i);
    const key = JSON.parse(text.slice(keyStart, i));
    i = skipTrivia(text, i);
    if (text[i] !== ":") throw new Error("expected ':'");
    const valueStart = skipTrivia(text, i + 1);
    const valueEnd = skipValue(text, valueStart);
    members.push({ key, keyStart, valueStart, valueEnd });
    i = valueEnd;
  }
}

// ---------------------------------------------------------------------------
// JSONC writing (targeted edits that keep everything else byte-for-byte)
// ---------------------------------------------------------------------------

function lineIndent(text, index) {
  const lineStart = text.lastIndexOf("\n", index - 1) + 1;
  const match = text.slice(lineStart, index).match(/^[ \t]*/);
  return match ? match[0] : "";
}

function render(value, indent) {
  return JSON.stringify(value, null, 2).split("\n").join(`\n${indent}`);
}

// Edits that insert `entries` ([key, value] pairs) at the top of the object.
function insertMembers(text, object, entries, fallbackIndent) {
  if (entries.length === 0) return [];
  const indent = object.members.length
    ? lineIndent(text, object.members[0].keyStart)
    : fallbackIndent;
  const rendered = entries.map(
    ([key, value]) =>
      `${indent}${JSON.stringify(key)}: ${render(value, indent)}`,
  );
  if (object.members.length) {
    return [
      {
        start: object.open + 1,
        end: object.open + 1,
        text: `\n${rendered.join(",\n")},`,
      },
    ];
  }
  const closingIndent = lineIndent(text, object.open);
  return [
    {
      start: object.open + 1,
      end: object.close,
      text: `\n${rendered.join(",\n")}\n${closingIndent}`,
    },
  ];
}

// Edit that deletes one member together with the comma that separates it.
function removeMember(object, index) {
  const member = object.members[index];
  const next = object.members[index + 1];
  if (next) return { start: member.keyStart, end: next.keyStart, text: "" };
  const previous = object.members[index - 1];
  if (previous)
    return { start: previous.valueEnd, end: member.valueEnd, text: "" };
  return { start: object.open + 1, end: object.close, text: "" };
}

function applyEdits(text, edits) {
  let result = text;
  for (const edit of [...edits].sort((a, b) => b.start - a.start)) {
    result = result.slice(0, edit.start) + edit.text + result.slice(edit.end);
  }
  return result;
}

// ---------------------------------------------------------------------------
// base_project's desired state
// ---------------------------------------------------------------------------

function opencodeServer(server) {
  if (server.type === "remote") {
    return {
      type: "remote",
      url: server.url,
      ...(server.headers ? { headers: server.headers } : {}),
    };
  }
  return {
    type: "local",
    command: [server.command, ...(server.args || [])],
    ...(server.env ? { environment: server.env } : {}),
  };
}

function isBaseProjectInstructions(entry) {
  return (
    typeof entry === "string" &&
    entry.replaceAll("\\", "/").endsWith(`/source/${INSTRUCTIONS_FILE}`)
  );
}

function sameJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

// Pure merge: returns { text, changed, warnings, managed } for the given inputs.
function mergeConfig(originalText, options) {
  const { instructionsPath, servers, previouslyManaged, previous } = options;
  const warnings = [];
  const fresh = !originalText || originalText.trim() === "";
  const text = fresh ? `{\n  "$schema": "${SCHEMA_URL}"\n}\n` : originalText;

  const config = parseJsonc(text);
  if (config === null || typeof config !== "object" || Array.isArray(config)) {
    throw new Error("the top level is not a JSON object");
  }
  const root = scanObject(text, skipTrivia(text, 0));
  const edits = [];
  const missingRootMembers = [];

  // instructions: keep the user's entries, replace only base_project's own path.
  const currentInstructions = config.instructions;
  const userInstructions = Array.isArray(currentInstructions)
    ? currentInstructions.filter((entry) => !isBaseProjectInstructions(entry))
    : typeof currentInstructions === "string" &&
        !isBaseProjectInstructions(currentInstructions)
      ? [currentInstructions]
      : [];
  const desiredInstructions = [...userInstructions, instructionsPath];
  const instructionsMember = root.members.find(
    (member) => member.key === "instructions",
  );
  if (!instructionsMember) {
    missingRootMembers.push(["instructions", desiredInstructions]);
  } else if (!sameJson(currentInstructions, desiredInstructions)) {
    edits.push({
      start: instructionsMember.valueStart,
      end: instructionsMember.valueEnd,
      text: render(
        desiredInstructions,
        lineIndent(text, instructionsMember.keyStart),
      ),
    });
  }

  // mcp: only the entries base_project owns are added, updated, or retired.
  const managed = new Set(previouslyManaged || []);
  const firstRun = previouslyManaged === null;
  const currentMcp =
    config.mcp && typeof config.mcp === "object" && !Array.isArray(config.mcp)
      ? config.mcp
      : null;
  const nextManaged = new Set();
  const toSet = [];
  for (const [name, server] of Object.entries(servers)) {
    const desired = opencodeServer(server);
    const exists = currentMcp && Object.hasOwn(currentMcp, name);
    // Before this helper existed, the installer owned the whole `mcp` map, so on the first
    // run every same-named entry is base_project's own; afterwards only recorded names are.
    if (exists && !firstRun && !managed.has(name)) {
      warnings.push(
        `opencode MCP server '${name}' is your own definition - left as is (base_project's version not applied)`,
      );
      continue;
    }
    nextManaged.add(name);
    if (!exists || !sameJson(currentMcp[name], desired)) {
      toSet.push([name, desired]);
    }
  }
  const retired = [...managed].filter(
    (name) =>
      !Object.hasOwn(servers, name) &&
      currentMcp &&
      Object.hasOwn(currentMcp, name),
  );
  if (firstRun && currentMcp) {
    for (const [name, definitions] of Object.entries(previous || {})) {
      if (
        !Object.hasOwn(servers, name) &&
        Object.hasOwn(currentMcp, name) &&
        definitions.some((definition) =>
          sameJson(currentMcp[name], opencodeServer(definition)),
        )
      ) {
        retired.push(name);
      }
    }
  }

  const mcpMember = root.members.find((member) => member.key === "mcp");
  if (!mcpMember || !currentMcp) {
    const value = Object.fromEntries(
      [...Object.entries(currentMcp || {})].filter(
        ([name]) => !retired.includes(name),
      ),
    );
    for (const [name, desired] of toSet) value[name] = desired;
    if (!mcpMember) {
      missingRootMembers.push(["mcp", value]);
    } else {
      edits.push({
        start: mcpMember.valueStart,
        end: mcpMember.valueEnd,
        text: render(value, lineIndent(text, mcpMember.keyStart)),
      });
    }
  } else if (toSet.length || retired.length) {
    const mcpObject = scanObject(text, mcpMember.valueStart);
    const memberIndent = `${lineIndent(text, mcpMember.keyStart)}  `;
    const toInsert = [];
    for (const [name, desired] of toSet) {
      const member = mcpObject.members.find((entry) => entry.key === name);
      if (member) {
        edits.push({
          start: member.valueStart,
          end: member.valueEnd,
          text: render(desired, lineIndent(text, member.keyStart)),
        });
      } else {
        toInsert.push([name, desired]);
      }
    }
    for (const name of retired) {
      const index = mcpObject.members.findIndex((entry) => entry.key === name);
      if (index !== -1) edits.push(removeMember(mcpObject, index));
    }
    edits.push(...insertMembers(text, mcpObject, toInsert, memberIndent));
  }

  edits.push(...insertMembers(text, root, missingRootMembers, "  "));
  const merged = applyEdits(text, edits);
  parseJsonc(merged); // never write something opencode could not read back
  return {
    text: merged,
    changed: fresh || merged !== originalText,
    warnings,
    managed: [...nextManaged].sort(),
    retired,
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function argumentValue(args, flag) {
  const index = args.indexOf(flag);
  return index !== -1 && args[index + 1] ? args[index + 1] : null;
}

function readManaged(stateFile) {
  try {
    const parsed = JSON.parse(fs.readFileSync(stateFile, "utf8"));
    return Array.isArray(parsed.servers) ? parsed.servers : [];
  } catch {
    return null;
  }
}

function run(args) {
  const opencodeHome = path.resolve(
    argumentValue(args, "--opencode-home") ||
      process.env.OPENCODE_HOME ||
      path.join(os.homedir(), ".config", "opencode"),
  );
  const stateDir = path.resolve(
    argumentValue(args, "--state-dir") ||
      path.join(os.homedir(), ".base_project"),
  );
  const configPath = path.join(opencodeHome, "opencode.jsonc");
  const stateFile = path.join(stateDir, "opencode-managed-mcp.json");
  const servers = JSON.parse(
    fs.readFileSync(
      path.join(repoRoot, "source", "opencode", "mcp.json"),
      "utf8",
    ),
  ).mcpServers;
  const instructionsPath = path
    .join(repoRoot, "source", INSTRUCTIONS_FILE)
    .replaceAll("\\", "/");

  const original = fs.existsSync(configPath)
    ? fs.readFileSync(configPath, "utf8")
    : "";
  let result;
  try {
    result = mergeConfig(original, {
      instructionsPath,
      servers,
      previouslyManaged: readManaged(stateFile),
      previous: loadPrevious(),
    });
  } catch (error) {
    warn(
      `${configPath} could not be parsed (${error.message}) - left untouched. Fix it, then re-run the installer.`,
    );
    return 2;
  }

  for (const message of result.warnings) warn(message);
  if (result.changed) {
    fs.mkdirSync(opencodeHome, { recursive: true });
    if (original) fs.writeFileSync(`${configPath}.bak`, original, "utf8");
    fs.writeFileSync(configPath, result.text, "utf8");
  }
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(
    stateFile,
    `${JSON.stringify({ servers: result.managed }, null, 2)}\n`,
    "utf8",
  );
  const retired = result.retired.length
    ? `; retired: ${result.retired.join(", ")}`
    : "";
  ok(
    `opencode.jsonc (${result.changed ? "merged" : "already up to date"}: instructions + ${result.managed.length} base_project MCP server(s)${retired}; your own entries and comments preserved)`,
  );
  return 0;
}

if (require.main === module) {
  try {
    process.exitCode = run(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`install-opencode failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { mergeConfig, parseJsonc, scanObject, opencodeServer, run };
