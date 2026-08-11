#!/usr/bin/env node
// base_project:managed
// Local live dashboard: serves a single HTML page and pushes new usage events over
// SSE as they're appended to ~/.base_project/usage.jsonl. Never leaves this machine.
// Strictly scoped to the project it was opened from (?project=<path>) — there is no
// cross-project view; every endpoint filters to that one project's data only.

const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const { DatabaseSync } = require("node:sqlite");

const HOME = os.homedir();
const STATE_DIR = path.join(HOME, ".base_project");
const LOG_PATH = path.join(STATE_DIR, "usage.jsonl");
const DB_PATH = path.join(STATE_DIR, "state.db");
const REPO_PATH_FILE = path.join(STATE_DIR, "repo-path.txt");
const CATALOG_PATHS = [
  path.join(HOME, ".claude", "base_project", "plugins.json"),
  path.join(HOME, ".config", "opencode", "base_project", "plugins.json"),
];
const PORT = process.env.BASE_PROJECT_DASHBOARD_PORT || 4317;
const CODEBURN_TTL_MS = 60 * 1000;
const UPDATE_CHECK_TTL_MS = 5 * 60 * 1000;

// Built-in tools that are always considered "installed" (not part of the optional catalog).
const CORE_PLUGIN_IDS = ["context7", "filesystem", "git", "github", "brave-search", "graphify", "codeburn"];

// Commands base_project ships out of the box (source/claude/commands, source/opencode/command).
// Not part of plugins.json since they're not opt-in — always present after install, so they're
// always shown as installed in the catalog checklist.
const BUILTIN_COMMANDS = [
  { id: "council", name: "/council", kind: "command", summary: "Pressure-tests a hard decision through 5 independent advisor perspectives + a synthesized verdict." },
  { id: "bootstrap", name: "/bootstrap", kind: "command", summary: "Maps the current project into graphify-out/ + repomix-output.xml for token-efficient context." },
  { id: "audit", name: "/audit", kind: "command", summary: "Security scan (dependency vulnerabilities, exposed secrets)." },
  { id: "plugins", name: "/plugins", kind: "command", summary: "Recommends and installs optional plugins based on the current project." },
  { id: "dashboard", name: "/dashboard", kind: "command", summary: "Opens this local usage dashboard." },
];

// --- Local state (SQLite) ---------------------------------------------
// Per-project dashboard state that should survive closing/reopening the
// dashboard: last time it was opened, last graphify generation seen, and
// small UI preferences (e.g. which section was expanded).
fs.mkdirSync(STATE_DIR, { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS project_state (
    project TEXT PRIMARY KEY,
    last_opened_at TEXT,
    last_graph_seen_at TEXT,
    ui_prefs TEXT
  )
`);

function getProjectState(projectPath) {
  const row = db.prepare("SELECT * FROM project_state WHERE project = ?").get(projectPath);
  if (!row) return null;
  return { ...row, ui_prefs: row.ui_prefs ? JSON.parse(row.ui_prefs) : {} };
}

function touchProjectOpened(projectPath) {
  db.prepare(
    `INSERT INTO project_state (project, last_opened_at) VALUES (?, ?)
     ON CONFLICT(project) DO UPDATE SET last_opened_at = excluded.last_opened_at`,
  ).run(projectPath, new Date().toISOString());
}

function saveUiPrefs(projectPath, prefs) {
  db.prepare(
    `INSERT INTO project_state (project, ui_prefs) VALUES (?, ?)
     ON CONFLICT(project) DO UPDATE SET ui_prefs = excluded.ui_prefs`,
  ).run(projectPath, JSON.stringify(prefs));
}

// --- First-run setup check --------------------------------------------
// Things base_project genuinely cannot automate: a missing system binary
// (Docker), commands that require the user to type them into the Claude
// Code chat (/plugin install — blocked by design, no CLI/API bypass exists),
// and credentials only the user has. Detected where possible; listed as a
// standing reminder where detection isn't reliable (installed-plugin state
// isn't exposed anywhere we can safely read).
const MCP_JSON_PATH = path.join(HOME, ".config", "opencode", "mcp.json");

function commandExistsSync(cmd) {
  const { execFileSync } = require("child_process");
  try {
    execFileSync(process.platform === "win32" ? "where" : "which", [cmd], { timeout: 5000, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function runSetupCheck() {
  const items = [];

  // 1. Docker — required by the Strix pentest tool in the catalog.
  const dockerOk = commandExistsSync("docker");
  items.push({
    id: "docker",
    ok: dockerOk,
    title: "Docker",
    reason: "Necessário para o Strix (pentest autônomo usado pelo /audit quando instalado).",
    steps: dockerOk ? [] : [
      "Baixe o Docker Desktop em https://www.docker.com/products/docker-desktop/",
      "Instale e abra o Docker Desktop pelo menos uma vez para ele iniciar o daemon.",
      "Confirme que funcionou rodando: docker --version",
    ],
  });

  // 2. Credentials left as placeholders in the installed mcp.json.
  let mcpConfig = null;
  try {
    mcpConfig = JSON.parse(fs.readFileSync(MCP_JSON_PATH, "utf8"));
  } catch {
    // not installed yet — nothing to check
  }
  if (mcpConfig && mcpConfig.mcpServers) {
    const brave = mcpConfig.mcpServers["brave-search"];
    const braveOk = !brave || !JSON.stringify(brave).includes("YOUR_BRAVE_API_KEY");
    items.push({
      id: "brave-search-key",
      ok: braveOk,
      title: "Chave da Brave Search API",
      reason: "O MCP brave-search está registrado mas com um placeholder no lugar da chave real.",
      steps: braveOk ? [] : [
        "Crie uma chave gratuita em https://brave.com/search/api/",
        "Edite " + MCP_JSON_PATH + " e troque YOUR_BRAVE_API_KEY pela chave.",
        "Registre no Claude Code: claude mcp add --scope user brave-search -e BRAVE_API_KEY=<sua-chave> -- npx -y @modelcontextprotocol/server-brave-search",
      ],
    });

    const github = mcpConfig.mcpServers["github"];
    const githubOk = !github || !JSON.stringify(github).includes("YOUR_GITHUB_TOKEN");
    items.push({
      id: "github-token",
      ok: githubOk,
      title: "Token do GitHub MCP",
      reason: "O MCP github está registrado mas com um placeholder no lugar do token real.",
      steps: githubOk ? [] : [
        "Gere um token em https://github.com/settings/tokens (permissões conforme o que você for usar)",
        "Edite " + MCP_JSON_PATH + " e troque YOUR_GITHUB_TOKEN pelo token.",
        "Registre: claude mcp add --scope user --transport http github https://api.githubcopilot.com/mcp/ --header \"Authorization: Bearer <seu-token>\"",
      ],
    });
  }

  // 3. Skills that only install via a chat-typed /plugin command — Claude Code
  // blocks any CLI/API bypass of this by design (installs execute third-party
  // code), and there's no reliable way to read back "already installed" state,
  // so these are always listed as a standing reminder rather than detected.
  const manualPlugins = [
    { id: "skill-ui", title: "Skill UI bundle (frontend-design)", command: "/plugin install frontend-design@claude-plugins-official" },
    { id: "mcp-builder", title: "MCP Builder + Webapp Testing (Anthropic oficial)", command: "/plugin marketplace add anthropics/skills" },
  ];
  for (const p of manualPlugins) {
    items.push({
      id: p.id,
      ok: null, // unknown — can't be verified, always shown as a reminder
      title: p.title,
      reason: "Esses comandos só podem ser digitados por você no chat do Claude Code — instalam código de terceiros, então a confirmação humana é obrigatória por design. Não há como automatizar isso.",
      steps: ["Digite exatamente isto numa mensagem no chat: " + p.command],
    });
  }

  return items;
}

// --- Update check (base_project repo itself) ----------------------------
let updateCache = { data: null, fetchedAt: 0, fetching: false };

function checkForUpdates() {
  if (updateCache.fetching) return;
  let repoPath;
  try {
    repoPath = fs.readFileSync(REPO_PATH_FILE, "utf8").trim();
  } catch {
    updateCache = { data: { available: false, reason: "repo-path not recorded — re-run install" }, fetchedAt: Date.now(), fetching: false };
    return;
  }
  if (!repoPath || !fs.existsSync(repoPath)) {
    updateCache = { data: { available: false, reason: "recorded repo path no longer exists" }, fetchedAt: Date.now(), fetching: false };
    return;
  }
  updateCache.fetching = true;
  execFile("git", ["fetch", "origin"], { cwd: repoPath, timeout: 15000 }, (fetchErr) => {
    if (fetchErr) {
      updateCache = { data: { available: false, reason: "git fetch failed (offline?)" }, fetchedAt: Date.now(), fetching: false };
      return;
    }
    execFile(
      "git",
      ["rev-list", "--count", "HEAD..origin/main"],
      { cwd: repoPath, timeout: 10000 },
      (countErr, stdout) => {
        updateCache.fetching = false;
        if (countErr) {
          updateCache = { data: { available: false, reason: "could not compare with origin/main" }, fetchedAt: Date.now(), fetching: false };
          return;
        }
        const behind = parseInt(String(stdout).trim(), 10) || 0;
        updateCache = {
          data: { available: behind > 0, commitsBehind: behind, repoPath },
          fetchedAt: Date.now(),
          fetching: false,
        };
      },
    );
  });
}

function readCatalog() {
  for (const p of CATALOG_PATHS) {
    try {
      return JSON.parse(fs.readFileSync(p, "utf8")).catalog || [];
    } catch {
      // try next path
    }
  }
  return [];
}

function normalizeProjectPath(p) {
  if (!p) return "";
  return p.replace(/\\/g, "/").toLowerCase().replace(/\/+$/, "");
}

// The usage log is a single shared file (multiple projects log into it), but the
// dashboard itself never shows more than one project's data — every read filters
// down to the requesting project right here, before anything reaches the client.
function readEventsForProject(projectPath) {
  const target = normalizeProjectPath(projectPath);
  if (!target) return [];
  try {
    const raw = fs.readFileSync(LOG_PATH, "utf8");
    return raw
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter((e) => e && normalizeProjectPath(e.project) === target);
  } catch {
    return [];
  }
}

const sseClients = new Set();
let lastSize = 0;

// Each SSE client only ever receives events for the project it's scoped to —
// res._scopedProject is set when the connection is opened in the /api/stream handler.
function broadcast(events) {
  for (const res of sseClients) {
    const target = res._scopedProject;
    const filtered = target ? events.filter((e) => normalizeProjectPath(e.project) === target) : [];
    if (filtered.length) res.write(`data: ${JSON.stringify(filtered)}\n\n`);
  }
}

function watchLog() {
  fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  if (!fs.existsSync(LOG_PATH)) fs.writeFileSync(LOG_PATH, "");
  lastSize = fs.statSync(LOG_PATH).size;

  fs.watch(path.dirname(LOG_PATH), (eventType, filename) => {
    if (filename !== path.basename(LOG_PATH)) return;
    try {
      const stat = fs.statSync(LOG_PATH);
      if (stat.size <= lastSize) {
        lastSize = stat.size;
        return;
      }
      const fd = fs.openSync(LOG_PATH, "r");
      const buf = Buffer.alloc(stat.size - lastSize);
      fs.readSync(fd, buf, 0, buf.length, lastSize);
      fs.closeSync(fd);
      lastSize = stat.size;
      const newEvents = buf
        .toString("utf8")
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(Boolean);
      if (newEvents.length && sseClients.size) broadcast(newEvents);
    } catch {
      // ignore transient read races
    }
  });
}

// --- CodeBurn (token/cost usage) ------------------------------------------
// codeburn export can take a few seconds and shouldn't run on every page load,
// so results are cached briefly and refreshed in the background.
let codeburnCache = { data: null, fetchedAt: 0, fetching: false };

function fetchCodeburn() {
  if (codeburnCache.fetching) return;
  codeburnCache.fetching = true;
  const tmpFile = path.join(os.tmpdir(), `base_project-codeburn-${process.pid}.json`);
  try {
    execFile(
      "npx",
      ["-y", "codeburn", "export", "-f", "json", "--output", tmpFile],
      { timeout: 30000, shell: process.platform === "win32" },
      (err) => {
        codeburnCache.fetching = false;
        if (err) return; // codeburn not installed / no data yet — leave cache as-is
        try {
          const raw = JSON.parse(fs.readFileSync(tmpFile, "utf8"));
          codeburnCache = { data: raw, fetchedAt: Date.now(), fetching: false };
        } catch {
          // ignore malformed/missing export
        } finally {
          fs.unlink(tmpFile, () => {});
        }
      },
    );
  } catch {
    // spawn itself can throw synchronously (e.g. EINVAL) rather than call back —
    // never let a codeburn hiccup take the whole dashboard server down.
    codeburnCache.fetching = false;
  }
}

function codeburnForProject(projectPath) {
  if (!codeburnCache.data) return null;
  const target = normalizeProjectPath(projectPath);
  const row = (codeburnCache.data.projects || []).find(
    (p) => normalizeProjectPath(p.Project) === target,
  );
  return row || null;
}

// Per-day cost/calls for one project, built from the raw per-record export
// (the top-level `daily` block in codeburn's export is global, not per-project).
function codeburnDailySeriesForProject(projectPath) {
  if (!codeburnCache.data || !Array.isArray(codeburnCache.data.records)) return [];
  const target = normalizeProjectPath(projectPath);
  const byDay = new Map();
  for (const r of codeburnCache.data.records) {
    if (normalizeProjectPath(r.project) !== target) continue;
    const day = (r.timestamp || "").slice(0, 10);
    if (!day) continue;
    const entry = byDay.get(day) || { date: day, cost: 0, calls: 0 };
    entry.cost += r.cost || 0;
    entry.calls += 1;
    byDay.set(day, entry);
  }
  return [...byDay.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

// --- Graphify (code graph viz) ---------------------------------------------
function graphifyStatusForProject(projectPath) {
  if (!projectPath) return { available: false };
  const graphHtml = path.join(projectPath, "graphify-out", "graph.html");
  const graphJson = path.join(projectPath, "graphify-out", "graph.json");
  if (!fs.existsSync(graphHtml) || !fs.existsSync(graphJson)) return { available: false };
  let stats = null;
  try {
    const g = JSON.parse(fs.readFileSync(graphJson, "utf8"));
    const nodeCount = Array.isArray(g.nodes) ? g.nodes.length : null;
    const edgeCount = Array.isArray(g.edges) ? g.edges.length : null;
    stats = { nodes: nodeCount, edges: edgeCount };
  } catch {
    // graph.json present but unreadable — still offer the link
  }
  return { available: true, generatedAt: fs.statSync(graphHtml).mtime.toISOString(), stats };
}

// --- HTML page ---------------------------------------------------------
const PAGE = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>base_project — Uso de plugins</title>
<style>
  :root {
    color-scheme: light;
    --surface-1: #fcfcfb;
    --page: #f9f9f7;
    --text-primary: #0b0b0b;
    --text-secondary: #52514e;
    --muted: #898781;
    --grid: #e1e0d9;
    --border: rgba(11,11,11,0.10);
    --good: #0ca30c; --warn: #c98500; --bad: #d34040;
    --series-1: #2a78d6; --series-2: #eb6834; --series-3: #1baf7a; --series-4: #eda100;
    --series-5: #e87ba4; --series-6: #008300; --series-7: #4a3aa7; --series-8: #e34948;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      color-scheme: dark;
      --surface-1: #1a1a19; --page: #0d0d0d; --text-primary: #ffffff; --text-secondary: #c3c2b7;
      --muted: #898781; --grid: #2c2c2a; --border: rgba(255,255,255,0.10);
      --good: #2fbf2f; --warn: #dba33a; --bad: #e2685f;
      --series-1: #3987e5; --series-2: #d95926; --series-3: #199e70; --series-4: #c98500;
      --series-5: #d55181; --series-6: #008300; --series-7: #9085e9; --series-8: #e66767;
    }
  }
  :root[data-theme="dark"] {
    color-scheme: dark;
    --surface-1: #1a1a19; --page: #0d0d0d; --text-primary: #ffffff; --text-secondary: #c3c2b7;
    --muted: #898781; --grid: #2c2c2a; --border: rgba(255,255,255,0.10);
    --good: #2fbf2f; --warn: #dba33a; --bad: #e2685f;
    --series-1: #3987e5; --series-2: #d95926; --series-3: #199e70; --series-4: #c98500;
    --series-5: #d55181; --series-6: #008300; --series-7: #9085e9; --series-8: #e66767;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--page); color: var(--text-primary);
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    padding: 28px; max-width: 1120px; margin-inline: auto;
  }
  .topbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
  .topbar-titles { flex: 1; min-width: 0; }
  h1 { font-size: 19px; margin: 0 0 4px; font-weight: 650; letter-spacing: -0.01em; }
  .sub { color: var(--text-secondary); font-size: 13px; margin: 0 0 10px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .live { display: inline-flex; align-items: center; gap: 6px; }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--good); box-shadow: 0 0 0 0 var(--good); animation: pulse 2s infinite; }
  @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(12,163,12,0.5);} 70% { box-shadow: 0 0 0 6px rgba(12,163,12,0);} 100% { box-shadow: 0 0 0 0 rgba(12,163,12,0);} }
  .scope { margin: 0 0 22px; font-size: 13px; padding-bottom: 14px; border-bottom: 1px solid var(--grid); }
  .scope .proj { font-family: ui-monospace, monospace; color: var(--text-primary); }
  .update-banner { display:none; align-items: center; gap: 10px; background: var(--surface-1); border: 1px solid var(--warn); border-radius: 8px; padding: 10px 14px; font-size: 13px; margin-bottom: 16px; }
  .update-banner code { background: var(--page); padding: 1px 6px; border-radius: 4px; }
  .last-opened { color: var(--muted); font-size: 12px; margin: -16px 0 20px; }

  /* Sidebar toggle button, top-right of the header */
  .sidebar-toggle {
    display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px;
    border-radius: 8px; border: 1px solid var(--border); background: var(--surface-1); color: var(--text-secondary);
    cursor: pointer; font-size: 16px; flex: none;
  }
  .sidebar-toggle:hover { color: var(--text-primary); border-color: var(--series-1); }

  /* Sidebar: a drawer anchored to the top-left, sliding in left-to-right. */
  .sidebar-backdrop {
    display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.35); z-index: 60;
  }
  .sidebar-backdrop.open { display: block; }
  .sidebar {
    position: fixed; top: 0; left: 0; height: 100vh; width: 300px; max-width: 85vw;
    background: var(--surface-1); border-right: 1px solid var(--border);
    box-shadow: 12px 0 32px rgba(0,0,0,0.18); z-index: 61;
    display: flex; flex-direction: column;
    transform: translateX(-100%); transition: transform 0.22s ease;
  }
  .sidebar.open { transform: translateX(0); }
  .sidebar-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid var(--grid); flex: none; }
  .sidebar-head h2 { font-size: 13px; margin: 0; color: var(--text-secondary); font-weight: 600; }
  .sidebar-close { background: none; border: none; color: var(--muted); font-size: 18px; cursor: pointer; line-height: 1; }
  .sidebar-close:hover { color: var(--text-primary); }
  .sidebar-list { list-style: none; margin: 0; padding: 8px; overflow-y: auto; flex: 1; }
  .sidebar-list li { border-radius: 8px; }
  .sidebar-plugin {
    display: flex; align-items: center; gap: 10px; padding: 10px 10px; border-radius: 8px;
    cursor: pointer; font-size: 13px; font-weight: 500; background: none; border: none; width: 100%; text-align: left; color: var(--text-primary);
  }
  .sidebar-plugin:hover { background: var(--page); }
  .sidebar-check { width: 15px; height: 15px; flex: none; accent-color: var(--good); pointer-events: none; }
  .sidebar-kind { font-size: 10px; color: var(--muted); border: 1px solid var(--border); border-radius: 999px; padding: 1px 6px; flex: none; margin-left: auto; }
  .sidebar-empty { padding: 16px; color: var(--muted); font-size: 13px; }

  .modal-backdrop {
    display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.45);
    align-items: center; justify-content: center; z-index: 70; padding: 24px;
  }
  .modal-backdrop.open { display: flex; }
  .modal-card {
    background: var(--surface-1); border: 1px solid var(--border); border-radius: 12px;
    max-width: 440px; width: 100%; max-height: 80vh; overflow-y: auto; padding: 20px 22px;
    box-shadow: 0 12px 40px rgba(0,0,0,0.25);
  }
  .modal-card h3 { margin: 0 0 4px; font-size: 15px; display: flex; align-items: center; gap: 8px; }
  .modal-card .modal-kind { font-size: 10px; color: var(--muted); border: 1px solid var(--border); border-radius: 999px; padding: 1px 7px; font-weight: 400; }
  .modal-card .modal-body { color: var(--text-secondary); font-size: 13px; line-height: 1.6; margin-top: 10px; }
  .modal-close { float: right; background: none; border: none; color: var(--muted); font-size: 18px; cursor: pointer; line-height: 1; }
  .modal-close:hover { color: var(--text-primary); }
  .tile.clickable { cursor: pointer; }

  .collapsible h2 { cursor: pointer; user-select: none; display: flex; align-items: center; gap: 8px; transition: color 0.15s; }
  .collapsible h2:hover { color: var(--text-primary); }
  .collapsible h2::before { content: '▾'; font-size: 9px; color: var(--muted); transition: transform 0.15s; }
  .collapsible.collapsed h2::before { transform: rotate(-90deg); }
  .collapsible.collapsed > div { display: none; }
  .sec-icon { font-size: 13px; }
  .tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 24px; }
  .tile { background: var(--surface-1); border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; transition: border-color 0.15s; }
  .tile:hover { border-color: var(--series-1); }
  .tile .val { font-size: 26px; font-weight: 650; font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }
  .tile .lbl { font-size: 12px; color: var(--text-secondary); margin-top: 2px; }
  section { background: var(--surface-1); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; margin-bottom: 16px; }
  section h2 { font-size: 13px; margin: 0; padding: 13px 16px; border-bottom: 1px solid var(--grid); color: var(--text-secondary); font-weight: 600; }
  .collapsible.collapsed h2 { border-bottom-color: transparent; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; color: var(--muted); font-weight: 500; padding: 8px 16px; border-bottom: 1px solid var(--grid); }
  td { padding: 9px 16px; border-bottom: 1px solid var(--grid); vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  tbody tr { transition: background 0.1s; }
  tbody tr:hover { background: var(--page); }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; margin: 2px 4px 2px 0; border: 1px solid var(--border); cursor: default; }
  .feed { max-height: 420px; overflow-y: auto; }
  .feed-item { padding: 9px 16px; border-bottom: 1px solid var(--grid); font-size: 12px; display: flex; justify-content: space-between; gap: 8px; align-items: center; }
  .feed-item .t { color: var(--muted); white-space: nowrap; font-variant-numeric: tabular-nums; }
  .empty { padding: 28px 16px; color: var(--muted); font-size: 13px; text-align: center; }
  a.graph-link { color: var(--series-1); text-decoration: none; font-weight: 500; }
  a.graph-link:hover { text-decoration: underline; }
  .graph-frame-wrap { padding: 0; }
  .graph-frame-meta { padding: 10px 16px; font-size: 12.5px; color: var(--text-secondary); border-bottom: 1px solid var(--grid); }
  iframe.graph-frame { width: 100%; height: 520px; border: none; display: block; }
  .setup-item { padding: 12px 16px; border-bottom: 1px solid var(--grid); }
  .setup-item:last-child { border-bottom: none; }
  .setup-head { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; cursor: pointer; user-select: none; }
  .setup-status { width: 16px; height: 16px; border-radius: 50%; flex: none; display: flex; align-items: center; justify-content: center; font-size: 10px; }
  .setup-status.s-pending { background: color-mix(in srgb, var(--warn) 18%, transparent); color: var(--warn); }
  .setup-status.s-manual { background: color-mix(in srgb, var(--series-1) 18%, transparent); color: var(--series-1); }
  .setup-reason { color: var(--text-secondary); font-size: 12.5px; margin: 4px 0 0 24px; }
  .setup-steps { margin: 8px 0 0 24px; padding: 10px 12px; background: var(--page); border-radius: 6px; font-size: 12.5px; }
  .setup-steps ol { margin: 0; padding-left: 18px; line-height: 1.7; }
  .setup-steps code { background: var(--surface-1); padding: 1px 6px; border-radius: 4px; word-break: break-all; }
  .setup-toggle { display: none; }
  .setup-toggle:checked ~ .setup-steps { display: block; }
  .setup-steps { display: none; }
</style>
</head>
<body>
  <div class="topbar">
    <div class="topbar-titles">
      <h1>base_project — Uso de plugins</h1>
      <p class="sub"><span class="live"><span class="dot"></span> ao vivo</span> · atualiza sozinho conforme você usa MCP servers e skills</p>
    </div>
    <button class="sidebar-toggle" id="sidebarToggle" title="Catálogo de plugins" aria-label="Abrir catálogo de plugins">☰</button>
  </div>
  <p class="scope" id="scope"></p>
  <p class="last-opened" id="lastOpened"></p>

  <div class="update-banner" id="updateBanner"></div>

  <section id="setupSection" class="collapsible" style="display:none">
    <h2 data-section="setup"><span class="sec-icon">🧭</span> Configuração pendente</h2>
    <div id="setupBody"></div>
  </section>

  <div class="tiles" id="tiles"></div>

  <section id="graphifySection" class="collapsible" style="display:none">
    <h2 data-section="graphify"><span class="sec-icon">🕸️</span> Mapa do código (graphify)</h2>
    <div id="graphifyBody" class="graph-frame-wrap"></div>
  </section>

  <section class="collapsible">
    <h2 data-section="feed"><span class="sec-icon">🕓</span> Atividade recente</h2>
    <div class="feed" id="feed"></div>
  </section>

  <div class="sidebar-backdrop" id="sidebarBackdrop"></div>
  <aside class="sidebar" id="sidebar">
    <div class="sidebar-head">
      <h2>📦 Catálogo de plugins</h2>
      <button class="sidebar-close" id="sidebarClose" aria-label="Fechar">✕</button>
    </div>
    <ul class="sidebar-list" id="sidebarList"></ul>
  </aside>

  <div class="modal-backdrop" id="modalBackdrop">
    <div class="modal-card" id="modalCard"></div>
  </div>

<script>
const COLORS = ['var(--series-1)','var(--series-2)','var(--series-3)','var(--series-4)','var(--series-5)','var(--series-6)','var(--series-7)','var(--series-8)'];
let events = [];
let catalog = [];
const params = new URLSearchParams(location.search);
const scopeProject = params.get('project');
const colorOf = (() => {
  const map = new Map();
  return (id) => {
    if (!id) return 'var(--muted)';
    if (!map.has(id)) map.set(id, COLORS[map.size % COLORS.length]);
    return map.get(id);
  };
})();

function fmtTime(ts) { return new Date(ts).toLocaleTimeString(); }

function renderScopeBar() {
  const el = document.getElementById('scope');
  el.innerHTML = scopeProject
    ? 'Projeto: <span class="proj">' + scopeProject + '</span>'
    : '<span style="color:var(--bad)">Nenhum projeto informado — abra este dashboard com /dashboard de dentro de um projeto.</span>';
}

// --- Sidebar (Plugins usados) — drawer anchored top-right, slides right-to-left ---
function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebarBackdrop').classList.add('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarBackdrop').classList.remove('open');
}
document.getElementById('sidebarToggle').addEventListener('click', openSidebar);
document.getElementById('sidebarClose').addEventListener('click', closeSidebar);
document.getElementById('sidebarBackdrop').addEventListener('click', closeSidebar);

const KIND_LABELS = { mcp: 'MCP', cli: 'CLI', skill: 'skill', command: 'comando' };
function renderSidebar() {
  const list = document.getElementById('sidebarList');
  if (!catalog.length) {
    list.innerHTML = '<div class="sidebar-empty">Catálogo não encontrado — rode o instalador do base_project.</div>';
    return;
  }
  list.innerHTML = catalog.map((p, i) =>
    '<li><button class="sidebar-plugin" data-cat-idx="' + i + '">' +
      '<input type="checkbox" class="sidebar-check" disabled' + (p.installed ? ' checked' : '') + '>' +
      '<span>' + p.name + '</span>' +
      '<span class="sidebar-kind">' + (KIND_LABELS[p.kind] || p.kind || '') + '</span>' +
    '</button></li>'
  ).join('');
  list.querySelectorAll('.sidebar-plugin').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = catalog[Number(btn.dataset.catIdx)];
      openModal(
        '<h3>' + p.name + ' <span class="modal-kind">' + (KIND_LABELS[p.kind] || p.kind || '') + '</span></h3>' +
        '<div class="modal-body">' + (p.summary || 'Sem descrição disponível.') + '</div>' +
        '<div class="modal-body" style="margin-top:12px; color:var(--muted)">' +
          (p.installed ? '✓ instalado' : 'não instalado') +
        '</div>'
      );
    });
  });
}

// --- Generic modal (used by plugin cards and tile explanations) ---
function openModal(html) {
  document.getElementById('modalCard').innerHTML =
    '<button class="modal-close" id="modalCloseBtn" aria-label="Fechar">✕</button>' + html;
  document.getElementById('modalBackdrop').classList.add('open');
}
function closeModal() {
  document.getElementById('modalBackdrop').classList.remove('open');
}
document.getElementById('modalBackdrop').addEventListener('click', (e) => {
  if (e.target.id === 'modalBackdrop' || e.target.id === 'modalCloseBtn') closeModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  closeModal();
  closeSidebar();
});

// --- Per-project UI state (collapsed sections), persisted via /api/ui-prefs ---
let uiPrefs = { collapsed: [] };
function applyUiPrefs() {
  document.querySelectorAll('h2[data-section]').forEach(h2 => {
    const section = h2.closest('.collapsible');
    if (!section) return;
    section.classList.toggle('collapsed', uiPrefs.collapsed.includes(h2.dataset.section));
  });
}
function saveUiPrefsDebounced() {
  if (!scopeProject) return;
  fetch('/api/ui-prefs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project: scopeProject, prefs: uiPrefs }),
  }).catch(() => {});
}
document.addEventListener('click', (e) => {
  const h2 = e.target.closest('h2[data-section]');
  if (!h2) return;
  const key = h2.dataset.section;
  const idx = uiPrefs.collapsed.indexOf(key);
  if (idx >= 0) uiPrefs.collapsed.splice(idx, 1); else uiPrefs.collapsed.push(key);
  applyUiPrefs();
  saveUiPrefsDebounced();
});

function renderLastOpened(projectState) {
  const el = document.getElementById('lastOpened');
  if (!projectState || !projectState.last_opened_at) { el.textContent = ''; return; }
  el.textContent = 'Última vez aberto aqui: ' + new Date(projectState.last_opened_at).toLocaleString();
}

function loadUpdateCheck() {
  fetch('/api/update-check').then(r => r.json()).then(data => {
    const el = document.getElementById('updateBanner');
    if (data.available) {
      el.style.display = '';
      el.innerHTML = 'Atualização disponível no base_project (' + data.commitsBehind + ' commit' + (data.commitsBehind === 1 ? '' : 's') + ' novo' + (data.commitsBehind === 1 ? '' : 's') + '). Rode <code>git pull</code> em <code>' + data.repoPath + '</code> e reinstale.';
    } else {
      el.style.display = 'none';
    }
  }).catch(() => {});
}

const TILE_EXPLANATIONS = {
  eventos: 'Cada vez que você usa uma ferramenta do Claude Code (ou opencode) neste projeto — rodar um comando, ler um arquivo, chamar um MCP server, etc. — isso conta como 1 evento. É o contador bruto de atividade que alimenta todos os outros números desta tela.',
  distintos: 'Quantos plugins diferentes (MCP servers, skills, etc. do catálogo abaixo) foram efetivamente usados nos eventos contados. Ferramentas nativas do Claude Code (Bash, Read, Edit...) não entram nessa contagem — só plugins opcionais do catálogo.',
  maisUsado: 'O plugin do catálogo com mais eventos registrados no período. Se aparecer "—", significa que nenhum plugin opcional foi usado ainda — só ferramentas nativas.',
};
function tileHtml(lbl, val, explKey) {
  const attr = explKey ? ' data-tile-expl="' + explKey + '"' : '';
  const cls = explKey ? 'tile clickable' : 'tile';
  return '<div class="' + cls + '"' + attr + '><div class="val">' + val + '</div><div class="lbl">' + lbl + (explKey ? ' <span style="color:var(--muted)">ⓘ</span>' : '') + '</div></div>';
}

function render() {
  const total = events.length;
  const plugins = {};
  for (const e of events) if (e.plugin) plugins[e.plugin] = (plugins[e.plugin]||0)+1;
  const topPlugin = Object.entries(plugins).sort((a,b)=>b[1]-a[1])[0];

  const tiles = [
    tileHtml('Eventos', total, 'eventos'),
    tileHtml('Plugins distintos', Object.keys(plugins).length, 'distintos'),
    tileHtml('Mais usado', topPlugin ? topPlugin[0] + ' (' + topPlugin[1] + ')' : '—', 'maisUsado'),
  ];

  const tilesEl = document.getElementById('tiles');
  tilesEl.innerHTML = tiles.join('');
  tilesEl.querySelectorAll('.tile.clickable').forEach(t => {
    t.addEventListener('click', () => {
      const key = t.dataset.tileExpl;
      const label = t.querySelector('.lbl').textContent.replace('ⓘ', '').trim();
      openModal('<h3>' + label + '</h3><div class="modal-body">' + (TILE_EXPLANATIONS[key] || 'Sem explicação disponível.') + '</div>');
    });
  });

  const recent = events.slice(-50).reverse();
  document.getElementById('feed').innerHTML = recent.length ? recent.map(e =>
    '<div class="feed-item"><span>' +
    (e.plugin ? '<span class="badge" style="border-color:'+colorOf(e.plugin)+'55;color:'+colorOf(e.plugin)+'">'+e.plugin+'</span> ' : '') +
    (e.tool||'?') + ' <span style="color:var(--muted)">('+e.engine+')</span></span>' +
    '<span class="t">'+fmtTime(e.ts)+'</span></div>'
  ).join('') : '<div class="empty">Aguardando atividade…</div>';

  renderSidebar();
}

let setupIdCounter = 0;
function renderSetupCheck(items) {
  const section = document.getElementById('setupSection');
  const pending = (items || []).filter(i => i.ok !== true);
  if (!pending.length) { section.style.display = 'none'; return; }
  section.style.display = '';
  document.getElementById('setupBody').innerHTML = pending.map(item => {
    const cbId = 'setupToggle' + (setupIdCounter++);
    const isManual = item.ok === null;
    const statusClass = isManual ? 's-manual' : 's-pending';
    const statusIcon = isManual ? '✎' : '!';
    const stepsHtml = item.steps && item.steps.length
      ? '<ol>' + item.steps.map(s => '<li>' + s.replace(/(https?:\\/\\/\\S+)/g, '<a href="$1" target="_blank" style="color:var(--series-1)">$1</a>').replace(/(claude mcp add[^<]*|\\/plugin[^<]*)/g, '<code>$1</code>') + '</li>').join('') + '</ol>'
      : '';
    return (
      '<div class="setup-item">' +
        '<label class="setup-head" for="' + cbId + '">' +
          '<span class="setup-status ' + statusClass + '">' + statusIcon + '</span>' +
          item.title +
        '</label>' +
        '<input type="checkbox" id="' + cbId + '" class="setup-toggle">' +
        '<div class="setup-reason">' + item.reason + '</div>' +
        (stepsHtml ? '<div class="setup-steps">' + stepsHtml + '</div>' : '') +
      '</div>'
    );
  }).join('');
}

let graphifyLoaded = false;
function renderGraphify(status) {
  const section = document.getElementById('graphifySection');
  section.style.display = '';
  const body = document.getElementById('graphifyBody');
  if (!status || !status.available) {
    body.innerHTML = '<div style="padding:14px 16px; font-size:13px; color:var(--muted)">Nenhum grafo gerado ainda. Rode <code>graphify update .</code> neste projeto.</div>';
    graphifyLoaded = false;
    return;
  }
  const stats = status.stats ? (status.stats.nodes + ' nós · ' + status.stats.edges + ' arestas · ') : '';
  const meta = '<div class="graph-frame-meta">' + stats + 'gerado em ' + new Date(status.generatedAt).toLocaleString() +
    ' · <a class="graph-link" target="_blank" href="/graph-file?project=' + encodeURIComponent(scopeProject) + '">abrir em tela cheia</a></div>';
  if (!graphifyLoaded) {
    body.innerHTML = meta + '<iframe class="graph-frame" src="/graph-file?project=' + encodeURIComponent(scopeProject) + '"></iframe>';
    graphifyLoaded = true;
  } else {
    body.querySelector('.graph-frame-meta').outerHTML = meta;
  }
}

function loadGraphify() {
  fetch('/api/graphify?project=' + encodeURIComponent(scopeProject)).then(r => r.json()).then(renderGraphify).catch(() => {});
}

function loadSetupCheck() {
  fetch('/api/setup-check').then(r => r.json()).then(data => renderSetupCheck(data.items)).catch(() => {});
}

renderScopeBar();
loadUpdateCheck();
loadSetupCheck();
setInterval(loadUpdateCheck, 5 * 60000);
fetch('/api/snapshot?project=' + encodeURIComponent(scopeProject)).then(r => r.json()).then(data => {
  events = data.events;
  catalog = data.catalog;
  if (data.projectState && data.projectState.ui_prefs && data.projectState.ui_prefs.collapsed) {
    uiPrefs = data.projectState.ui_prefs;
  }
  renderLastOpened(data.projectState);
  render();
  applyUiPrefs();
  loadGraphify();
  setInterval(loadGraphify, 60000);
  const es = new EventSource('/api/stream?project=' + encodeURIComponent(scopeProject));
  es.onmessage = (msg) => {
    const newEvents = JSON.parse(msg.data);
    events = events.concat(newEvents);
    render();
  };
});
</script>
</body>
</html>`;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  if (url.pathname === "/" || url.pathname === "/index.html") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    res.end(PAGE);
    return;
  }
  if (url.pathname === "/api/snapshot") {
    const projectParam = url.searchParams.get("project");
    const events = readEventsForProject(projectParam);
    const usedIds = new Set(events.map((e) => e.plugin).filter(Boolean));
    const catalog = [
      ...BUILTIN_COMMANDS.map((c) => ({ ...c, installed: true })),
      ...readCatalog().map((p) => ({ ...p, installed: usedIds.has(p.id) })),
    ];
    let projectState = null;
    if (projectParam) {
      const previous = getProjectState(projectParam);
      touchProjectOpened(projectParam);
      projectState = previous; // return what it was BEFORE this open, so the client can show "last opened X ago"
    }
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ events, catalog, corePluginIds: CORE_PLUGIN_IDS, projectState }));
    return;
  }
  if (url.pathname === "/api/ui-prefs" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const { project, prefs } = JSON.parse(body);
        if (project) saveUiPrefs(project, prefs || {});
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.writeHead(400);
        res.end("bad request");
      }
    });
    return;
  }
  if (url.pathname === "/api/update-check") {
    if (!updateCache.data || Date.now() - updateCache.fetchedAt > UPDATE_CHECK_TTL_MS) {
      checkForUpdates();
    }
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(updateCache.data || { available: false, reason: "checking..." }));
    return;
  }
  if (url.pathname === "/api/codeburn") {
    if (!codeburnCache.data || Date.now() - codeburnCache.fetchedAt > CODEBURN_TTL_MS) {
      fetchCodeburn();
    }
    const projectParam = url.searchParams.get("project");
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(
      JSON.stringify({
        project: projectParam ? codeburnForProject(projectParam) : null,
        daily: projectParam ? codeburnDailySeriesForProject(projectParam) : [],
      }),
    );
    return;
  }
  if (url.pathname === "/api/setup-check") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ items: runSetupCheck() }));
    return;
  }
  if (url.pathname === "/api/graphify") {
    const projectParam = url.searchParams.get("project");
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(graphifyStatusForProject(projectParam)));
    return;
  }
  if (url.pathname === "/graph-file") {
    const projectParam = url.searchParams.get("project");
    const status = graphifyStatusForProject(projectParam);
    if (!status.available) {
      res.writeHead(404);
      res.end("no graph for this project — run graphify update in it first");
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    fs.createReadStream(path.join(projectParam, "graphify-out", "graph.html")).pipe(res);
    return;
  }
  if (url.pathname === "/api/stream") {
    const projectParam = url.searchParams.get("project");
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.write("\n");
    res._scopedProject = normalizeProjectPath(projectParam);
    sseClients.add(res);
    req.on("close", () => sseClients.delete(res));
    return;
  }
  res.writeHead(404);
  res.end("not found");
});

watchLog();
fetchCodeburn();
checkForUpdates();
server.listen(PORT, "127.0.0.1", () => {
  console.log(`base_project dashboard: http://127.0.0.1:${PORT}`);
});
