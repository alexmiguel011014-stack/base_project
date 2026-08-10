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

const HOME = os.homedir();
const LOG_PATH = path.join(HOME, ".base_project", "usage.jsonl");
const CATALOG_PATHS = [
  path.join(HOME, ".claude", "base_project", "plugins.json"),
  path.join(HOME, ".config", "opencode", "base_project", "plugins.json"),
];
const PORT = process.env.BASE_PROJECT_DASHBOARD_PORT || 4317;
const CODEBURN_TTL_MS = 60 * 1000;

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
</style>
</head>
<body>
  <h1>base_project — Plugin Usage</h1>
  <p class="sub"><span class="live"><span class="dot"></span> live</span> · atualiza sozinho conforme você usa MCP servers e skills</p>
  <p class="scope" id="scope"></p>

  <div class="tiles" id="tiles"></div>

  <div class="grid2">
    <section>
      <h2 id="byProjectTitle">Plugins usados</h2>
      <div id="byProject"></div>
    </section>
    <section>
      <h2>Atividade recente</h2>
      <div class="feed" id="feed"></div>
    </section>
  </div>

  <section style="margin-top:16px">
    <h2>Catálogo</h2>
    <div class="legend" id="legend"></div>
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

  document.getElementById('legend').innerHTML = catalog.map(p =>
    '<span class="badge" title="'+(p.summary||'').replace(/"/g,'&quot;')+'" style="border-color:'+colorOf(p.id)+'55;color:'+colorOf(p.id)+'">'+p.id+'</span>'
  ).join(' ') || '<span style="color:var(--muted)">Catálogo não encontrado — rode o instalador do base_project.</span>';
}

let codeburnAll = null;
function loadCodeburn() {
  const q = scopeProject && scopeProject !== '__all__' ? '?project=' + encodeURIComponent(scopeProject) : '';
  fetch('/api/codeburn' + q).then(r => r.json()).then(data => {
    codeburn = data.project || null;
    codeburnAll = data.all || null;
    render();
  }).catch(() => {});
}

renderScopeBar();
fetch('/api/snapshot').then(r => r.json()).then(data => {
  events = data.events;
  catalog = data.catalog;
  render();
  loadCodeburn();
  setInterval(loadCodeburn, 60000);
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
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ events: readAllEvents(), catalog: readCatalog() }));
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
        all: codeburnCache.data ? codeburnCache.data.projects : null,
      }),
    );
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
server.listen(PORT, "127.0.0.1", () => {
  console.log(`base_project dashboard: http://127.0.0.1:${PORT}`);
});
