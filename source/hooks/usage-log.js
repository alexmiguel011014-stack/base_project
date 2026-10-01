#!/usr/bin/env node
// base_project:managed
// @ts-check
// PostToolUse + UserPromptSubmit hook: appends one JSONL line per event to a
// per-session ledger, so /usagebp or $usagebp can later answer "was this plugin/MCP/agent
// ever actually used, in which project, and did it error" — questions the catalog
// alone can't answer, because it only records what was *installed*.
//
// Two design rules, both learned the hard way in this project:
//
// 1. WRITE DUMB, READ SMART. This hook records raw facts and classifies nothing.
//    Its predecessor (log-usage.js, deleted with the dashboard) tried to decide at
//    write time which catalog entry a Bash command belonged to, and its #1 recurring
//    bug — documented in dev/scripts/NPInstructions.md — was a plugin that was
//    installed and working but never showed as used, because the matching rule
//    silently didn't fire. Interpretation belongs in /usagebp, where a wrong
//    guess is visible instead of silently absent.
//
// 2. ONE FILE PER SESSION. Hooks are global: a single ledger file would take
//    concurrent appends from every Claude Code/Codex session running on the
//    machine at once (verified live — a session in another project wrote into the
//    same capture during testing). Per-session files remove the contention rather
//    than locking against it, which is also why this needs no database.
//
// Same hard contract as loop-detect.js: never throws, never blocks, always exits 0.
// A broken ledger must never break the tool call it is attached to.

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

// Bounded so a single Write of a large file can't turn the ledger into a second
// copy of the transcript. The Bash command / file_path lands at the start of the
// serialized input, so it survives truncation — which is what /usagebp greps.
const MAX_INPUT_CHARS = 300;
const MAX_RESPONSE_CHARS = 150;
const MAX_PROMPT_CHARS = 200;

function ledgerDir() {
  const home = os.homedir();
  return path.join(home, ".claude", "base_project", "usage");
}

function ledgerFile(sessionId) {
  const safe = String(sessionId || "unknown").replace(/[^a-zA-Z0-9_-]/g, "_");
  const day = new Date().toISOString().slice(0, 10);
  return path.join(ledgerDir(), `${day}-${safe}.jsonl`);
}

// Prompts and tool inputs routinely carry credentials (`export API_KEY=…`, a curl with an
// Authorization header, a pasted token). The ledger is plain text kept indefinitely, so
// well-known secret shapes are masked before anything is written. File paths and ordinary
// commands — what /usagebp and /diario actually read — are left intact.
const SECRET_PATTERNS = [
  [
    /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g,
    "[REDACTED PRIVATE KEY]",
  ],
  [
    /(authorization\\?"?\s*[:=]\s*\\?"?\s*(?:bearer|basic|token)?\s*)[^\s"'\\,;]+/gi,
    "$1[REDACTED]",
  ],
  [
    /\b(?:sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{20,}|glpat-[A-Za-z0-9_-]{20,}|xox[abprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|npm_[A-Za-z0-9]{36})\b/g,
    "[REDACTED]",
  ],
  [
    /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
    "[REDACTED]",
  ],
  [/\b([a-z][a-z0-9+.-]*:\/\/[^\s:/@"'\\]+:)[^\s@/"'\\]+@/gi, "$1[REDACTED]@"],
  [
    /\b([A-Za-z0-9_-]*(?:api[_-]?key|secret|token|passw(?:or)?d|credential)[A-Za-z0-9_-]*)(\\?"?\s*[=:]\s*\\?"?)([^\s"'\\&;,]{3,})/gi,
    "$1$2[REDACTED]",
  ],
];

function redact(text) {
  let result = text;
  for (const [pattern, replacement] of SECRET_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

function truncate(value, max) {
  if (value === undefined || value === null) return null;
  try {
    const text = typeof value === "string" ? value : JSON.stringify(value);
    if (typeof text !== "string") return null;
    // Redact before truncating, so a secret cut at the boundary can't slip through —
    // over a window a little past `max`, not the whole payload (a Write of a large file
    // would otherwise be scanned in full on every call).
    const window = text.length > max + 512 ? text.slice(0, max + 512) : text;
    const safe = redact(window);
    return safe.length > max ? safe.slice(0, max) : safe;
  } catch {
    return null;
  }
}

// Absence, not null, is what marks the main thread: verified against real payloads,
// agent_type/agent_id are simply not present outside a subagent. Normalizing both to
// null here keeps the ledger's shape uniform for the reader.
function entryFor(input) {
  const base = {
    ts: new Date().toISOString(),
    event: input.hook_event_name || null,
    session: input.session_id || null,
    prompt_id: input.prompt_id || null,
    agent_type: input.agent_type || null,
    agent_id: input.agent_id || null,
    cwd: input.cwd || null,
  };
  if (input.hook_event_name === "UserPromptSubmit") {
    return { ...base, prompt: truncate(input.prompt, MAX_PROMPT_CHARS) };
  }
  return {
    ...base,
    tool: input.tool_name || null,
    input: truncate(input.tool_input, MAX_INPUT_CHARS),
    response: truncate(input.tool_response, MAX_RESPONSE_CHARS),
    ms: typeof input.duration_ms === "number" ? input.duration_ms : null,
  };
}

function append(input) {
  writeEntry(entryFor(input), input.session_id);
}

function writeEntry(entry, sessionId) {
  const file = ledgerFile(sessionId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${JSON.stringify(entry)}\n`, "utf8");
}

// Install mode: `node usage-log.js --install <id> [--kind <kind>] [--origin <origin>]`,
// called by /plugins after a successful install. Usage alone can't answer "installed and
// never touched" for anything outside plugins.json — an entry found by live discovery is
// in no catalog to cross-check against, so without this line it is invisible precisely
// when it matters most (installed from the open web, then never used again).
function installEntryFrom(argv) {
  const valueAfter = (flag) => {
    const i = argv.indexOf(flag);
    return i !== -1 && argv[i + 1] ? argv[i + 1] : null;
  };
  const id = valueAfter("--install");
  if (!id) return null;
  return {
    ts: new Date().toISOString(),
    event: "install",
    id,
    kind: valueAfter("--kind"),
    // "catalog" (a plugins.json entry) or "discovery" (found live, never vetted).
    origin: valueAfter("--origin"),
    cwd: process.cwd(),
  };
}

function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", () => resolve(data));
    setTimeout(() => resolve(data), 500);
  });
}

async function main() {
  try {
    // Install mode is a plain CLI call, not a hook event — it reads argv, not stdin,
    // so it must short-circuit before readStdin() blocks waiting for input.
    const install = installEntryFrom(process.argv.slice(2));
    if (install) {
      writeEntry(install, "install");
      process.exit(0);
    }
    const raw = await readStdin();
    const input = raw ? JSON.parse(raw) : {};
    // A payload with neither a tool nor a prompt carries nothing worth recording.
    if (input.tool_name || input.prompt) {
      append(input);
    }
  } catch {
    // Usage logging must never break the tool call/turn it is attached to.
  }
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = {
  entryFor,
  installEntryFrom,
  ledgerDir,
  ledgerFile,
  redact,
  truncate,
};
