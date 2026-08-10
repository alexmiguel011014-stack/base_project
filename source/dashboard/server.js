#!/usr/bin/env node
// base_project:managed
// Local live dashboard: serves a single HTML page and pushes new usage events over
// SSE as they're appended to ~/.base_project/usage.jsonl. Never leaves this machine.
// Defaults to showing only the project it was opened from (?project=<path>) — pass
// ?project=__all__ to see every project.

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

function readAllEvents() {
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
      .filter(Boolean);
  } catch {
    return [];
  }
}

const sseClients = new Set();
let lastSize = 0;

function broadcast(events) {
  const payload = `data: ${JSON.stringify(events)}\n\n`;
  for (const res of sseClients) res.write(payload);
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

function normalizeProjectPath(p) {
  if (!p) return "";
  return p.replace(/\\/g, "/").toLowerCase().replace(/\/+$/, "");
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
<title>base_project — Plugin Usage</title>
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
    --good: #0ca30c;
    --series-1: #2a78d6; --series-2: #eb6834; --series-3: #1baf7a; --series-4: #eda100;
    --series-5: #e87ba4; --series-6: #008300; --series-7: #4a3aa7; --series-8: #e34948;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      color-scheme: dark;
      --surface-1: #1a1a19; --page: #0d0d0d; --text-primary: #ffffff; --text-secondary: #c3c2b7;
      --muted: #898781; --grid: #2c2c2a; --border: rgba(255,255,255,0.10); --good: #0ca30c;
      --series-1: #3987e5; --series-2: #d95926; --series-3: #199e70; --series-4: #c98500;
      --series-5: #d55181; --series-6: #008300; --series-7: #9085e9; --series-8: #e66767;
    }
  }
  :root[data-theme="dark"] {
    color-scheme: dark;
    --surface-1: #1a1a19; --page: #0d0d0d; --text-primary: #ffffff; --text-secondary: #c3c2b7;
    --muted: #898781; --grid: #2c2c2a; --border: rgba(255,255,255,0.10); --good: #0ca30c;
    --series-1: #3987e5; --series-2: #d95926; --series-3: #199e70; --series-4: #c98500;
    --series-5: #d55181; --series-6: #008300; --series-7: #9085e9; --series-8: #e66767;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--page); color: var(--text-primary);
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    padding: 24px;
  }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .sub { color: var(--text-secondary); font-size: 13px; margin: 0 0 6px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .live { display: inline-flex; align-items: center; gap: 6px; }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--good); box-shadow: 0 0 0 0 var(--good); animation: pulse 2s infinite; }
  @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(12,163,12,0.5);} 70% { box-shadow: 0 0 0 6px rgba(12,163,12,0);} 100% { box-shadow: 0 0 0 0 rgba(12,163,12,0);} }
  .scope { margin: 0 0 20px; font-size: 13px; }
  .scope .proj { font-family: ui-monospace, monospace; color: var(--text-primary); }
  .scope a { color: var(--series-1); text-decoration: none; }
  .scope a:hover { text-decoration: underline; }
  .update-banner { display:none; background: var(--surface-1); border: 1px solid var(--series-4); border-radius: 8px; padding: 10px 14px; font-size: 13px; margin-bottom: 16px; }
  .update-banner code { background: var(--page); padding: 1px 6px; border-radius: 4px; }
  .last-opened { color: var(--muted); font-size: 12px; margin: -14px 0 16px; }
  .collapsible h2 { cursor: pointer; user-select: none; }
  .collapsible h2::before { content: '▾ '; font-size: 10px; }
  .collapsible.collapsed h2::before { content: '▸ '; }
  .collapsible.collapsed > div { display: none; }
  .tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 24px; }
  .tile { background: var(--surface-1); border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; }
  .tile .val { font-size: 26px; font-weight: 600; font-variant-numeric: tabular-nums; }
  .tile .lbl { font-size: 12px; color: var(--text-secondary); margin-top: 2px; }
  .grid2 { display: grid; grid-template-columns: 1.4fr 1fr; gap: 16px; align-items: start; }
  @media (max-width: 860px) { .grid2 { grid-template-columns: 1fr; } }
  section { background: var(--surface-1); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
  section h2 { font-size: 13px; margin: 0; padding: 12px 16px; border-bottom: 1px solid var(--grid); color: var(--text-secondary); font-weight: 600; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; color: var(--muted); font-weight: 500; padding: 8px 16px; border-bottom: 1px solid var(--grid); }
  td { padding: 8px 16px; border-bottom: 1px solid var(--grid); vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  .proj { font-family: ui-monospace, monospace; font-size: 12px; color: var(--text-secondary); }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; margin: 2px 4px 2px 0; border: 1px solid var(--border); cursor: default; }
  .feed { max-height: 420px; overflow-y: auto; }
  .feed-item { padding: 8px 16px; border-bottom: 1px solid var(--grid); font-size: 12px; display: flex; justify-content: space-between; gap: 8px; }
  .feed-item .t { color: var(--muted); white-space: nowrap; font-variant-numeric: tabular-nums; }
  .empty { padding: 24px 16px; color: var(--muted); font-size: 13px; }
  .legend { padding: 12px 16px; font-size: 12px; color: var(--text-secondary); }
  .legend .badge { cursor: help; }
  .chart-wrap { padding: 14px 16px; }
  .bars { display: flex; align-items: flex-end; gap: 6px; height: 120px; }
  .bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 0; }
  .bar { width: 100%; max-width: 28px; background: var(--series-1); border-radius: 3px 3px 0 0; min-height: 2px; }
  .bar-lbl { font-size: 10px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 40px; }
  .bar-val { font-size: 10px; color: var(--text-secondary); }
  .cat-row { display: flex; align-items: center; gap: 10px; padding: 8px 16px; border-bottom: 1px solid var(--grid); font-size: 13px; }
  .cat-row:last-child { border-bottom: none; }
  .cat-check { width: 16px; height: 16px; flex: none; accent-color: var(--good); }
  .cat-name { font-weight: 600; min-width: 160px; }
  .cat-summary { color: var(--text-secondary); font-size: 12px; }
  .cat-kind { font-size: 10px; color: var(--muted); border: 1px solid var(--border); border-radius: 999px; padding: 1px 7px; flex: none; }
  a.graph-link { color: var(--series-1); }
</style>
</head>
<body>
  <h1>base_project — Plugin Usage</h1>
  <p class="sub"><span class="live"><span class="dot"></span> live</span> · atualiza sozinho conforme você usa MCP servers e skills</p>
  <p class="scope" id="scope"></p>
  <p class="last-opened" id="lastOpened"></p>

  <div class="update-banner" id="updateBanner"></div>

  <div class="tiles" id="tiles"></div>

  <section id="codeburnSection" class="collapsible" style="margin-bottom:16px; display:none">
    <h2 data-section="codeburn">Custo por dia (CodeBurn · este projeto)</h2>
    <div id="codeburnChart"></div>
  </section>

  <section id="graphifySection" class="collapsible" style="margin-bottom:16px; display:none">
    <h2 data-section="graphify">Mapa do código (graphify)</h2>
    <div id="graphifyBody" style="padding:14px 16px; font-size:13px;"></div>
  </section>

  <div class="grid2">
    <section class="collapsible">
      <h2 id="byProjectTitle" data-section="byProject">Plugins usados</h2>
      <div id="byProject"></div>
    </section>
    <section class="collapsible">
      <h2 data-section="feed">Atividade recente</h2>
      <div class="feed" id="feed"></div>
    </section>
  </div>

  <section class="collapsible" style="margin-top:16px">
    <h2 data-section="catalog">Catálogo de plugins</h2>
    <div id="catalogTable"></div>
  </section>

<script>
const COLORS = ['var(--series-1)','var(--series-2)','var(--series-3)','var(--series-4)','var(--series-5)','var(--series-6)','var(--series-7)','var(--series-8)'];
let events = [];
let catalog = [];
let codeburn = null;
const params = new URLSearchParams(location.search);
const scopeProject = params.get('project'); // null / '__all__' / a real path
const colorOf = (() => {
  const map = new Map();
  return (id) => {
    if (!id) return 'var(--muted)';
    if (!map.has(id)) map.set(id, COLORS[map.size % COLORS.length]);
    return map.get(id);
  };
})();

function fmtTime(ts) { return new Date(ts).toLocaleTimeString(); }
function normPath(p) { return (p||'').replace(/\\\\/g,'/').toLowerCase().replace(/\\/+$/,''); }
function shortName(p) { return (p||'').split(/[\\\\/]/).pop(); }

function scopedEvents() {
  if (!scopeProject || scopeProject === '__all__') return events;
  const target = normPath(scopeProject);
  return events.filter(e => normPath(e.project) === target);
}

function renderScopeBar() {
  const el = document.getElementById('scope');
  if (!scopeProject || scopeProject === '__all__') {
    el.innerHTML = 'Mostrando <b>todos os projetos</b>. Abra com <code>/dashboard</code> de dentro de um projeto pra ver só ele.';
    return;
  }
  el.innerHTML = 'Projeto: <span class="proj">' + scopeProject + '</span> · <a href="?project=__all__">ver todos os projetos</a>';
}

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
  if (!scopeProject || scopeProject === '__all__') return;
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

function render() {
  const scoped = scopedEvents();
  const total = scoped.length;
  const projects = new Set(scoped.map(e => e.project));
  const plugins = {};
  for (const e of scoped) if (e.plugin) plugins[e.plugin] = (plugins[e.plugin]||0)+1;
  const topPlugin = Object.entries(plugins).sort((a,b)=>b[1]-a[1])[0];

  const tiles = [
    ['Eventos', total],
    !scopeProject || scopeProject === '__all__' ? ['Projetos ativos', projects.size] : null,
    ['Plugins distintos', Object.keys(plugins).length],
    ['Mais usado', topPlugin ? topPlugin[0] + ' (' + topPlugin[1] + ')' : '—'],
  ].filter(Boolean);

  if (scopeProject && scopeProject !== '__all__') {
    const cb = codeburn;
    if (cb) {
      tiles.push(['Custo (USD)', '$' + cb['Cost (USD)'].toFixed(2)]);
      tiles.push(['Sessões (codeburn)', cb['Sessions']]);
      tiles.push(['Chamadas de API', cb['API Calls']]);
    }
  } else if (codeburnAll && codeburnAll.length) {
    const totalCost = codeburnAll.reduce((s,p) => s + (p['Cost (USD)']||0), 0);
    tiles.push(['Custo total (USD)', '$' + totalCost.toFixed(2)]);
  }

  document.getElementById('tiles').innerHTML = tiles.map(([lbl,val]) =>
    '<div class="tile"><div class="val">'+val+'</div><div class="lbl">'+lbl+'</div></div>'
  ).join('');

  if (!scopeProject || scopeProject === '__all__') {
    document.getElementById('byProjectTitle').textContent = 'Por projeto';
    const byProject = {};
    for (const e of scoped) {
      byProject[e.project] = byProject[e.project] || {};
      const key = e.plugin || '(core tool)';
      byProject[e.project][key] = (byProject[e.project][key]||0)+1;
    }
    const rows = Object.entries(byProject).sort((a,b) => {
      const sa = Object.values(a[1]).reduce((x,y)=>x+y,0);
      const sb = Object.values(b[1]).reduce((x,y)=>x+y,0);
      return sb - sa;
    });
    document.getElementById('byProject').innerHTML = rows.length ? (
      '<table><tr><th>Projeto</th><th>Plugins usados</th></tr>' +
      rows.map(([proj, plugMap]) =>
        '<tr><td class="proj"><a href="?project='+encodeURIComponent(proj)+'" style="color:inherit">'+proj+'</a></td><td>' +
        Object.entries(plugMap).sort((a,b)=>b[1]-a[1]).map(([id,count]) =>
          '<span class="badge" style="border-color:'+colorOf(id)+'55;color:'+(id==='(core tool)'?'var(--muted)':colorOf(id))+'">'+id+' × '+count+'</span>'
        ).join('') + '</td></tr>'
      ).join('') + '</table>'
    ) : '<div class="empty">Nenhum evento ainda.</div>';
  } else {
    document.getElementById('byProjectTitle').textContent = 'Plugins usados neste projeto';
    const plugMap = {};
    for (const e of scoped) {
      const key = e.plugin || '(core tool)';
      plugMap[key] = (plugMap[key]||0)+1;
    }
    const rows = Object.entries(plugMap).sort((a,b)=>b[1]-a[1]);
    document.getElementById('byProject').innerHTML = rows.length ? (
      '<table><tr><th>Plugin</th><th>Usos</th></tr>' +
      rows.map(([id,count]) =>
        '<tr><td><span class="badge" style="border-color:'+colorOf(id)+'55;color:'+(id==='(core tool)'?'var(--muted)':colorOf(id))+'">'+id+'</span></td><td>'+count+'</td></tr>'
      ).join('') + '</table>'
    ) : '<div class="empty">Nenhum evento ainda neste projeto. Use qualquer ferramenta aqui e aparece.</div>';
  }

  const recent = scoped.slice(-50).reverse();
  document.getElementById('feed').innerHTML = recent.length ? recent.map(e =>
    '<div class="feed-item"><span>' +
    (e.plugin ? '<span class="badge" style="border-color:'+colorOf(e.plugin)+'55;color:'+colorOf(e.plugin)+'">'+e.plugin+'</span> ' : '') +
    (e.tool||'?') + (!scopeProject || scopeProject==='__all__' ? ' <span style="color:var(--muted)">— ' + shortName(e.project) + ' ('+e.engine+')</span>' : ' <span style="color:var(--muted)">('+e.engine+')</span>') + '</span>' +
    '<span class="t">'+fmtTime(e.ts)+'</span></div>'
  ).join('') : '<div class="empty">Aguardando atividade…</div>';

  renderCatalog();
}

function renderCatalog() {
  const el = document.getElementById('catalogTable');
  if (!catalog.length) {
    el.innerHTML = '<div class="empty">Catálogo não encontrado — rode o instalador do base_project.</div>';
    return;
  }
  el.innerHTML = catalog.map(p =>
    '<div class="cat-row">' +
      '<input type="checkbox" class="cat-check" disabled' + (p.installed ? ' checked' : '') + '>' +
      '<span class="cat-name">' + p.name + '</span>' +
      '<span class="cat-kind">' + (p.kind || '') + '</span>' +
      '<span class="cat-summary">' + (p.summary || '') + '</span>' +
    '</div>'
  ).join('');
}

function renderCodeburnChart(daily) {
  const section = document.getElementById('codeburnSection');
  if (!scopeProject || scopeProject === '__all__' || !daily || !daily.length) {
    section.style.display = 'none';
    return;
  }
  section.style.display = '';
  const max = Math.max(...daily.map(d => d.cost), 0.01);
  document.getElementById('codeburnChart').innerHTML =
    '<div class="chart-wrap"><div class="bars">' +
    daily.map(d =>
      '<div class="bar-col">' +
        '<div class="bar-val">$' + d.cost.toFixed(2) + '</div>' +
        '<div class="bar" style="height:' + Math.max(4, Math.round((d.cost / max) * 100)) + 'px"></div>' +
        '<div class="bar-lbl">' + d.date.slice(5) + '</div>' +
      '</div>'
    ).join('') +
    '</div></div>';
}

function renderGraphify(status) {
  const section = document.getElementById('graphifySection');
  if (!scopeProject || scopeProject === '__all__') { section.style.display = 'none'; return; }
  section.style.display = '';
  const body = document.getElementById('graphifyBody');
  if (!status || !status.available) {
    body.innerHTML = '<span style="color:var(--muted)">Nenhum grafo gerado ainda. Rode <code>graphify update .</code> neste projeto.</span>';
    return;
  }
  const stats = status.stats ? (status.stats.nodes + ' nós · ' + status.stats.edges + ' arestas · ') : '';
  body.innerHTML = stats + 'gerado em ' + new Date(status.generatedAt).toLocaleString() +
    ' · <a class="graph-link" target="_blank" href="/graph-file?project=' + encodeURIComponent(scopeProject) + '">abrir mapa</a>';
}

let codeburnAll = null;
function loadCodeburn() {
  const q = scopeProject && scopeProject !== '__all__' ? '?project=' + encodeURIComponent(scopeProject) : '';
  fetch('/api/codeburn' + q).then(r => r.json()).then(data => {
    codeburn = data.project || null;
    codeburnAll = data.all || null;
    renderCodeburnChart(data.daily || []);
    render();
  }).catch(() => {});
}

function loadGraphify() {
  if (!scopeProject || scopeProject === '__all__') return;
  fetch('/api/graphify?project=' + encodeURIComponent(scopeProject)).then(r => r.json()).then(renderGraphify).catch(() => {});
}

renderScopeBar();
loadUpdateCheck();
setInterval(loadUpdateCheck, 5 * 60000);
const snapshotQ = scopeProject && scopeProject !== '__all__' ? '?project=' + encodeURIComponent(scopeProject) : '';
fetch('/api/snapshot' + snapshotQ).then(r => r.json()).then(data => {
  events = data.events;
  catalog = data.catalog;
  if (data.projectState && data.projectState.ui_prefs && data.projectState.ui_prefs.collapsed) {
    uiPrefs = data.projectState.ui_prefs;
  }
  renderLastOpened(data.projectState);
  render();
  applyUiPrefs();
  loadCodeburn();
  loadGraphify();
  setInterval(loadCodeburn, 60000);
  setInterval(loadGraphify, 60000);
  const es = new EventSource('/api/stream');
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
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(PAGE);
    return;
  }
  if (url.pathname === "/api/snapshot") {
    const events = readAllEvents();
    const usedIds = new Set(events.map((e) => e.plugin).filter(Boolean));
    const catalog = [
      ...BUILTIN_COMMANDS.map((c) => ({ ...c, installed: true })),
      ...readCatalog().map((p) => ({ ...p, installed: usedIds.has(p.id) })),
    ];
    const projectParam = url.searchParams.get("project");
    let projectState = null;
    if (projectParam && projectParam !== "__all__") {
      const previous = getProjectState(projectParam);
      touchProjectOpened(projectParam);
      projectState = previous; // return what it was BEFORE this open, so the client can show "last opened X ago"
    }
    res.writeHead(200, { "Content-Type": "application/json" });
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
        res.writeHead(200, { "Content-Type": "application/json" });
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
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(updateCache.data || { available: false, reason: "checking..." }));
    return;
  }
  if (url.pathname === "/api/codeburn") {
    if (!codeburnCache.data || Date.now() - codeburnCache.fetchedAt > CODEBURN_TTL_MS) {
      fetchCodeburn();
    }
    const projectParam = url.searchParams.get("project");
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        project: projectParam ? codeburnForProject(projectParam) : null,
        daily: projectParam ? codeburnDailySeriesForProject(projectParam) : [],
        all: codeburnCache.data ? codeburnCache.data.projects : null,
      }),
    );
    return;
  }
  if (url.pathname === "/api/graphify") {
    const projectParam = url.searchParams.get("project");
    res.writeHead(200, { "Content-Type": "application/json" });
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
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.write("\n");
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
