#!/usr/bin/env node
// base_project:managed
// Isolated Chrome DevTools Protocol launch and cleanup smoke test.

const childProcess = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");

const PAGE_TITLE = "base_project CDP smoke";
const READY_TIMEOUT_MS = 20_000;
const LISTENER_READY_TIMEOUT_MS = 5_000;
const LISTENER_POLL_INTERVAL_MS = 100;
const CLEANUP_TIMEOUT_MS = 3_000;
const MAX_STARTUP_STDERR_CHARS = 8_000;

function isExecutable(file) {
  try {
    fs.accessSync(
      file,
      process.platform === "win32" ? fs.constants.F_OK : fs.constants.X_OK,
    );
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}

function findChrome(env = process.env, platform = process.platform) {
  const configured = [env.CHROME_BIN, env.CHROME_PATH].filter(Boolean);
  for (const candidate of configured) {
    const resolved = path.resolve(candidate);
    if (isExecutable(resolved)) return resolved;
    throw new Error(`Configured Chrome path is not executable: ${candidate}`);
  }

  let standardPaths = [];
  if (platform === "win32") {
    const roots = [
      env["PROGRAMFILES(X86)"],
      env.PROGRAMFILES || env.ProgramFiles,
      env.LOCALAPPDATA || env.LocalAppData,
    ].filter(Boolean);
    standardPaths = roots.map((root) =>
      path.join(root, "Google", "Chrome", "Application", "chrome.exe"),
    );
  } else if (platform === "darwin") {
    standardPaths = [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome",
    ];
  } else if (platform === "linux") {
    standardPaths = [
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
      "/snap/bin/chromium",
    ];
  }

  for (const candidate of standardPaths) {
    if (isExecutable(candidate)) return candidate;
  }

  const names =
    platform === "win32"
      ? [
          "chrome",
          ...String(env.PATHEXT || ".COM;.EXE;.BAT;.CMD")
            .split(";")
            .map((ext) => `chrome${ext.toLowerCase()}`),
        ]
      : platform === "darwin"
        ? ["google-chrome", "chromium", "chrome"]
        : [
            "google-chrome",
            "google-chrome-stable",
            "chromium",
            "chromium-browser",
          ];
  for (const directory of String(env.PATH || "")
    .split(path.delimiter)
    .filter(Boolean)) {
    for (const name of names) {
      const candidate = path.join(directory, name);
      if (isExecutable(candidate)) return candidate;
    }
  }
  return null;
}

function parsePort(value) {
  if (!/^\d+$/.test(value)) return null;
  const port = Number(value);
  return port > 0 && port <= 65_535 ? port : null;
}

function parseLinuxAddress(hex, ipv6) {
  if (ipv6) {
    if (!/^[0-9a-f]{32}$/i.test(hex)) return null;
    const bytes = [];
    for (let offset = 0; offset < 32; offset += 8) {
      const word = hex.slice(offset, offset + 8);
      bytes.push(
        ...word
          .match(/../g)
          .reverse()
          .map((part) => Number.parseInt(part, 16)),
      );
    }
    return { family: 6, bytes };
  }
  if (!/^[0-9a-f]{8}$/i.test(hex)) return null;
  return {
    family: 4,
    bytes: hex
      .match(/../g)
      .reverse()
      .map((part) => Number.parseInt(part, 16)),
  };
}

function parseProcListeners(output, port) {
  const listeners = [];
  for (const line of output.split(/\r?\n/)) {
    const fields = line.trim().split(/\s+/);
    if (fields.length < 4 || fields[0] === "sl") continue;
    const local = fields[1];
    const state = fields[3];
    if (state !== "0A" || !local?.includes(":")) continue;
    const separator = local.lastIndexOf(":");
    const localPort = Number.parseInt(local.slice(separator + 1), 16);
    if (localPort !== port) continue;
    const address = parseLinuxAddress(
      local.slice(0, separator),
      local.slice(0, separator).length === 32,
    );
    if (!address) {
      listeners.push({ address: null, malformed: true });
      continue;
    }
    listeners.push(address);
  }
  return listeners;
}

function parseSocketAddress(token, platform) {
  let address;
  let portText;
  const bracketed = token.match(/^\[([^\]]+)\]:(\d+)$/);
  if (bracketed) {
    [, address, portText] = bracketed;
  } else if (platform === "darwin") {
    const separator = token.lastIndexOf(".");
    if (separator < 0) return null;
    address = token.slice(0, separator);
    portText = token.slice(separator + 1);
  } else {
    const separator = token.lastIndexOf(":");
    if (separator < 0) return null;
    address = token.slice(0, separator);
    portText = token.slice(separator + 1);
  }
  const port = parsePort(portText);
  if (!port || !address) return null;
  if (address === "*" || address === "0.0.0.0" || address === "::") {
    return { address, family: address.includes(":") ? 6 : 4, port };
  }
  if (net.isIP(address) === 4) {
    return { address, family: 4, bytes: address.split(".").map(Number), port };
  }
  const bytes = parseIPv6(address);
  if (!bytes) return null;
  return { address, family: 6, bytes, port };
}

function extractSocketPort(token, platform) {
  const bracketed = token.match(/^\[[^\]]+\]:(\d+)$/);
  if (bracketed) return parsePort(bracketed[1]);
  const separator =
    platform === "darwin" ? token.lastIndexOf(".") : token.lastIndexOf(":");
  return separator < 0 ? null : parsePort(token.slice(separator + 1));
}

function parseIPv6(address) {
  const zone = address.indexOf("%");
  const addressWithoutZone = zone < 0 ? address : address.slice(0, zone);
  if (net.isIP(addressWithoutZone) !== 6) return null;
  let normalized = addressWithoutZone.toLowerCase();
  if (normalized.includes(".")) {
    const separator = normalized.lastIndexOf(":");
    const ipv4 = normalized
      .slice(separator + 1)
      .split(".")
      .map(Number);
    if (
      ipv4.length !== 4 ||
      ipv4.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
    ) {
      return null;
    }
    const high = ((ipv4[0] << 8) | ipv4[1]).toString(16);
    const low = ((ipv4[2] << 8) | ipv4[3]).toString(16);
    normalized = `${normalized.slice(0, separator)}:${high}:${low}`;
  }
  const halves = normalized.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  if (
    (halves.length === 1 && missing !== 0) ||
    (halves.length === 2 && missing < 1)
  )
    return null;
  const groups = [...left, ...Array(missing).fill("0"), ...right];
  if (
    groups.length !== 8 ||
    groups.some((group) => !/^[0-9a-f]{1,4}$/.test(group))
  )
    return null;
  return groups.flatMap((group) => {
    const value = Number.parseInt(group, 16);
    return [value >> 8, value & 0xff];
  });
}

function parseNetstatListeners(output, platform) {
  const listeners = [];
  for (const line of output.split(/\r?\n/)) {
    let local;
    if (platform === "win32") {
      if (!/^\s*TCP\s+/i.test(line) || !/\bLISTENING\s*$/i.test(line)) continue;
      const match = line.match(/^\s*TCP\s+(\S+)\s+\S+\s+LISTENING\s*$/i);
      if (!match) {
        listeners.push({ malformed: true, port: null });
        continue;
      }
      local = match[1];
    } else if (platform === "darwin") {
      if (!/^\s*tcp[46]?\s+/i.test(line) || !/\bLISTEN\s*$/i.test(line))
        continue;
      const match = line.match(
        /^\s*tcp[46]?\s+\d+\s+\d+\s+(\S+)\s+\S+\s+LISTEN\s*$/i,
      );
      if (!match) {
        listeners.push({ malformed: true, port: null });
        continue;
      }
      local = match[1];
    } else {
      return [];
    }
    const parsed = parseSocketAddress(local, platform);
    listeners.push(
      parsed || { malformed: true, port: extractSocketPort(local, platform) },
    );
  }
  return listeners;
}

function isLoopback(listener) {
  if (listener.malformed || !listener.bytes) return false;
  if (listener.family === 4) return listener.bytes[0] === 127;
  if (listener.family !== 6) return false;
  const bytes = listener.bytes;
  if (bytes.slice(0, 15).every((byte) => byte === 0) && bytes[15] === 1)
    return true;
  const mapped =
    bytes.slice(0, 10).every((byte) => byte === 0) &&
    bytes[10] === 0xff &&
    bytes[11] === 0xff;
  return mapped && bytes[12] === 127;
}

function classifyLoopbackListeners({ platform, output, port }) {
  if (
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65_535 ||
    typeof output !== "string"
  ) {
    return { ok: false, reason: "invalid classifier input", listeners: [] };
  }
  let listeners;
  if (platform === "linux") {
    listeners = parseProcListeners(output, port);
  } else if (platform === "win32" || platform === "darwin") {
    const parsed = parseNetstatListeners(output, platform);
    const unknownMalformed = parsed.some(
      (listener) => listener.malformed && !listener.port,
    );
    if (unknownMalformed) {
      return {
        ok: false,
        reason: "unparseable listening socket",
        listeners: parsed.filter((listener) => listener.malformed),
      };
    }
    listeners = parsed.filter((listener) => listener.port === port);
    if (listeners.some((listener) => listener.malformed)) {
      return {
        ok: false,
        reason: "unparseable listening socket for the debug port",
        listeners,
      };
    }
  } else {
    return {
      ok: false,
      reason: `unsupported platform: ${platform}`,
      listeners: [],
    };
  }
  if (listeners.length === 0) {
    return {
      ok: false,
      reason: "no listening socket found for the debug port",
      listeners,
    };
  }
  const nonLoopback = listeners.filter((listener) => !isLoopback(listener));
  return {
    ok: nonLoopback.length === 0,
    reason:
      nonLoopback.length === 0
        ? "loopback only"
        : "non-loopback listener found",
    listeners,
  };
}

function readListenerOutput(platform) {
  if (platform === "linux") {
    const files = ["/proc/net/tcp", "/proc/net/tcp6"];
    return files
      .map((file) => {
        try {
          return fs.readFileSync(file, "utf8");
        } catch (error) {
          if (error.code === "ENOENT") return "";
          throw error;
        }
      })
      .join("\n");
  }
  return childProcess.execFileSync("netstat", ["-an"], {
    encoding: "utf8",
    timeout: 5_000,
    windowsHide: true,
  });
}

async function withWindowsLoopbackProbe(port, readSnapshot) {
  const probe = net.createConnection({ host: "127.0.0.1", port });
  probe.setTimeout(2_000, () =>
    probe.destroy(new Error("Timed out connecting to the loopback debug port")),
  );
  try {
    await new Promise((resolve, reject) => {
      probe.once("connect", resolve);
      probe.once("error", reject);
    });
    probe.setTimeout(0);
    return await readSnapshot();
  } finally {
    probe.destroy();
  }
}

function sanitizedMatchingRows(output, platform, port) {
  const rows = [];
  for (const line of output.split(/\r?\n/)) {
    const fields = line.trim().split(/\s+/);
    let local;
    let state;
    let protocol;
    if (platform === "linux") {
      if (fields.length < 4 || fields[0] === "sl") continue;
      local = fields[1];
      state = fields[3];
      const separator = local?.lastIndexOf(":") ?? -1;
      if (separator < 0) continue;
      if (Number.parseInt(local.slice(separator + 1), 16) !== port) continue;
      rows.push(`proc ${local} state=${state}`);
    } else if (platform === "win32") {
      if (!/^TCP$/i.test(fields[0] || "")) continue;
      [protocol, local] = fields;
      state = fields.at(-1);
      if (extractSocketPort(local, platform) !== port) continue;
      rows.push(`${protocol} ${local} ${state}`);
    } else if (platform === "darwin") {
      if (!/^tcp[46]?$/i.test(fields[0] || "") || fields.length < 6) continue;
      [protocol] = fields;
      local = fields[3];
      state = fields.at(-1);
      if (extractSocketPort(local, platform) !== port) continue;
      rows.push(`${protocol} ${local} ${state}`);
    }
  }
  return {
    containsPort: rows.length > 0,
    rows: rows.length > 0 ? rows.slice(0, 8).join(" | ") : "(none)",
  };
}

function describeMatchingRows(output, platform, port) {
  const diagnostic = sanitizedMatchingRows(output, platform, port);
  return `TCP row contains port: ${diagnostic.containsPort ? "yes" : "no"}; local/state: ${diagnostic.rows}`;
}

function netstatAnoRows(port) {
  try {
    const output = childProcess.execFileSync("netstat", ["-ano"], {
      encoding: "utf8",
      timeout: 5_000,
      windowsHide: true,
    });
    const rows = [];
    for (const line of output.split(/\r?\n/)) {
      const fields = line.trim().split(/\s+/);
      if (!/^TCP$/i.test(fields[0] || "")) continue;
      const local = fields[1];
      if (extractSocketPort(local, "win32") !== port) continue;
      const state = fields.at(-2);
      const pid = fields.at(-1);
      rows.push(
        `TCP ${local} state=${/^[A-Za-z]+$/.test(state || "") ? state : "unknown"} pid=${/^\d+$/.test(pid || "") ? pid : "unknown"}`,
      );
    }
    return rows.length > 0 ? rows.slice(0, 8).join(" | ") : "(none)";
  } catch (error) {
    return `unavailable (${error.code || "command error"})`;
  }
}

function getNetTcpConnectionRows(port) {
  const command = `$rows = Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,RemoteAddress,RemotePort,State,OwningProcess; if ($null -eq $rows) { '[]' } else { ConvertTo-Json -InputObject @($rows) -Compress }`;
  try {
    const output = childProcess
      .execFileSync(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-Command", command],
        { encoding: "utf8", timeout: 5_000, windowsHide: true },
      )
      .trim();
    const parsed = JSON.parse(output || "[]");
    const entries = Array.isArray(parsed) ? parsed : [parsed];
    const rows = entries
      .filter((entry) => Number(entry.LocalPort) === port)
      .map((entry) => {
        const localAddress = String(entry.LocalAddress || "");
        const remoteAddress = String(entry.RemoteAddress || "");
        const safeLocal =
          net.isIP(localAddress.split("%")[0]) > 0 ? localAddress : "unknown";
        const safeRemote =
          net.isIP(remoteAddress.split("%")[0]) > 0 ? remoteAddress : "unknown";
        const remotePort = Number(entry.RemotePort);
        const safeRemotePort =
          Number.isInteger(remotePort) &&
          remotePort >= 0 &&
          remotePort <= 65_535
            ? remotePort
            : "unknown";
        const state = String(entry.State || "");
        const safeState = /^[A-Za-z]+$/.test(state) ? state : "unknown";
        const pid = Number(entry.OwningProcess);
        const safePid = Number.isInteger(pid) && pid > 0 ? pid : "unknown";
        return `LocalAddress=${safeLocal} LocalPort=${port} RemoteAddress=${safeRemote} RemotePort=${safeRemotePort} State=${safeState} PID=${safePid}`;
      });
    return rows.length > 0 ? rows.slice(0, 8).join(" | ") : "(none)";
  } catch (error) {
    return `unavailable (${error.code || "diagnostic error"})`;
  }
}

function windowsListenerDiagnostics(port) {
  return `netstat -ano local-port rows: ${netstatAnoRows(port)}; Get-NetTCPConnection rows: ${getNetTcpConnectionRows(port)}`;
}

async function waitForLoopbackListener(platform, port) {
  const deadline = Date.now() + LISTENER_READY_TIMEOUT_MS;
  let output = "";
  let result;
  do {
    output =
      platform === "win32"
        ? await withWindowsLoopbackProbe(port, () =>
            readListenerOutput(platform),
          )
        : readListenerOutput(platform);
    result = classifyLoopbackListeners({ platform, output, port });
    if (result.ok) return;
    if (result.reason !== "no listening socket found for the debug port") {
      const windowsDetails =
        platform === "win32" ? `; ${windowsListenerDiagnostics(port)}` : "";
      throw new Error(
        `Debug port is not loopback-only: ${result.reason}; ${describeMatchingRows(output, platform, port)}${windowsDetails}`,
      );
    }
    if (Date.now() >= deadline) break;
    await delay(LISTENER_POLL_INTERVAL_MS);
  } while (Date.now() < deadline);
  const windowsDetails =
    platform === "win32" ? `; ${windowsListenerDiagnostics(port)}` : "";
  throw new Error(
    `Timed out waiting for the exact-port loopback listener: ${result.reason}; ${describeMatchingRows(output, platform, port)}${windowsDetails}`,
  );
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function startServer() {
  const server = http.createServer((request, response) => {
    if (request.method !== "GET" || request.url !== "/") {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("not found");
      return;
    }
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(
      `<!doctype html><html><head><title>${PAGE_TITLE}</title></head><body>${PAGE_TITLE}</body></html>`,
    );
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.removeListener("error", reject);
      resolve(server);
    });
  });
}

function requestText(port, requestPath, timeoutMs = 2_000) {
  return new Promise((resolve, reject) => {
    const request = http.get(
      { host: "127.0.0.1", port, path: requestPath, timeout: timeoutMs },
      (response) => {
        const chunks = [];
        response.setEncoding("utf8");
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          const text = chunks.join("");
          if (response.statusCode !== 200) {
            reject(
              new Error(`${requestPath} returned HTTP ${response.statusCode}`),
            );
          } else {
            resolve(text);
          }
        });
      },
    );
    request.on("timeout", () =>
      request.destroy(new Error(`${requestPath} timed out`)),
    );
    request.on("error", reject);
  });
}

async function readDebugPort(profile, browser, getSpawnError, getExitDetails) {
  const activePortFile = path.join(profile, "DevToolsActivePort");
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const spawnError = getSpawnError();
    if (spawnError) throw spawnError;
    if (browser.exitCode !== null || browser.signalCode !== null) {
      const { code, signal, stderr } = await getExitDetails();
      throw new Error(
        `Chrome exited before DevToolsActivePort was ready (exit code: ${code ?? "unknown"}, signal: ${signal ?? "none"}); stderr: ${stderr || "(empty)"}`,
      );
    }
    try {
      const port = parsePort(
        fs.readFileSync(activePortFile, "utf8").split(/\r?\n/, 1)[0],
      );
      if (port) return port;
      throw new Error("DevToolsActivePort contains an invalid port");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    await delay(100);
  }
  throw new Error("Timed out waiting for DevToolsActivePort");
}

async function waitForPage(port) {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const versionText = await requestText(port, "/json/version");
      JSON.parse(versionText);
      const targetsText = await requestText(port, "/json/list");
      const targets = JSON.parse(targetsText);
      if (
        Array.isArray(targets) &&
        targets.some(
          (target) => target.type === "page" && target.title === PAGE_TITLE,
        )
      ) {
        return;
      }
      lastError = new Error("Chrome has not exposed the smoke page target yet");
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }
  throw new Error(
    `Timed out waiting for the CDP page target: ${lastError?.message || "no response"}`,
  );
}

function portAnswers(host, port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(500, () => finish(false));
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
  });
}

async function assertPortClosed(port) {
  const deadline = Date.now() + CLEANUP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const [ipv4Open, ipv6Open] = await Promise.all([
      portAnswers("127.0.0.1", port),
      portAnswers("::1", port),
    ]);
    if (!ipv4Open && !ipv6Open) return;
    await delay(100);
  }
  throw new Error(
    `Debug port ${port} still accepts connections on 127.0.0.1 or ::1 after cleanup`,
  );
}

function groupExists(pid) {
  try {
    process.kill(-pid, 0);
    return true;
  } catch (error) {
    if (error.code === "ESRCH") return false;
    if (error.code === "EPERM") return true;
    throw error;
  }
}

function childHasExited(child) {
  return child.exitCode !== null || child.signalCode !== null;
}

async function waitUntil(predicate, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await delay(50);
  }
  return predicate();
}

async function terminateTree(child, platform) {
  if (!child?.pid) return;
  if (platform === "win32") {
    const result = childProcess.spawnSync(
      "taskkill",
      ["/PID", String(child.pid), "/T", "/F"],
      {
        encoding: "utf8",
        timeout: CLEANUP_TIMEOUT_MS,
        windowsHide: true,
      },
    );
    if (result.error) throw result.error;
    if (result.status !== 0 && !childHasExited(child)) {
      throw new Error(
        `taskkill failed: ${String(result.stderr || result.stdout).trim()}`,
      );
    }
    if (!(await waitUntil(() => childHasExited(child), CLEANUP_TIMEOUT_MS))) {
      throw new Error("Chrome process did not exit after taskkill");
    }
    return;
  }

  try {
    process.kill(-child.pid, "SIGTERM");
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
  if (await waitUntil(() => !groupExists(child.pid), 1_500)) return;
  try {
    process.kill(-child.pid, "SIGKILL");
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
  if (!(await waitUntil(() => !groupExists(child.pid), CLEANUP_TIMEOUT_MS))) {
    throw new Error("Chrome process group did not exit after SIGKILL");
  }
}

async function closeServer(server) {
  if (!server?.listening) return;
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function makeChromeArgs(profile, url) {
  const args = [
    "--headless",
    "--no-first-run",
    "--no-default-browser-check",
    `--user-data-dir=${profile}`,
    "--remote-debugging-port=0",
    url,
  ];
  if (typeof process.getuid === "function" && process.getuid() === 0) {
    args.splice(1, 0, "--no-sandbox");
  }
  return args;
}

async function runSmoke(chrome, platform = process.platform) {
  let server;
  let profile;
  let browser;
  let browserSpawnError;
  let browserStderr = "";
  let browserClosed;
  let browserCloseDetails;
  let debugPort;
  let primaryError;
  let versionProbeError;
  let listenerCheckError;
  const cleanupErrors = [];

  try {
    server = await startServer();
    const serverAddress = server.address();
    profile = fs.mkdtempSync(path.join(os.tmpdir(), "base-project-cdp-"));
    const url = `http://127.0.0.1:${serverAddress.port}/`;
    browser = childProcess.spawn(chrome, makeChromeArgs(profile, url), {
      detached: platform !== "win32",
      stdio: ["ignore", "ignore", "pipe"],
      windowsHide: true,
    });
    browser.stderr.setEncoding("utf8");
    browser.stderr.on("data", (chunk) => {
      browserStderr = `${browserStderr}${chunk}`.slice(
        -MAX_STARTUP_STDERR_CHARS,
      );
    });
    browserClosed = new Promise((resolve) => {
      browser.once("close", (code, signal) => {
        browserCloseDetails = { code, signal };
        resolve(browserCloseDetails);
      });
    });
    browser.once("error", (error) => {
      browserSpawnError = error;
      primaryError ||= error;
    });

    debugPort = await readDebugPort(
      profile,
      browser,
      () => browserSpawnError,
      async () => ({ ...(await browserClosed), stderr: browserStderr.trim() }),
    );
    try {
      await requestText(debugPort, "/json/version");
    } catch (error) {
      versionProbeError = error;
      throw new Error(`GET /json/version failed: ${error.message}`);
    }
    try {
      await waitForLoopbackListener(platform, debugPort);
    } catch (error) {
      listenerCheckError = error;
      throw error;
    }
    await waitForPage(debugPort);
  } catch (error) {
    primaryError ||= error;
  } finally {
    try {
      await terminateTree(browser, platform);
    } catch (error) {
      cleanupErrors.push(`process-tree cleanup: ${error.message}`);
    }
    try {
      await closeServer(server);
    } catch (error) {
      cleanupErrors.push(`server cleanup: ${error.message}`);
    }
    if (profile) {
      try {
        fs.rmSync(profile, { recursive: true, force: true });
      } catch (error) {
        cleanupErrors.push(`profile cleanup: ${error.message}`);
      }
      if (fs.existsSync(profile)) {
        cleanupErrors.push("profile cleanup: temporary profile still exists");
      }
    }
    if (debugPort) {
      try {
        await assertPortClosed(debugPort);
      } catch (error) {
        cleanupErrors.push(`port cleanup: ${error.message}`);
      }
    }
  }

  if (primaryError || cleanupErrors.length > 0) {
    if (
      (versionProbeError || listenerCheckError) &&
      browserClosed &&
      browser &&
      childHasExited(browser)
    ) {
      await Promise.race([browserClosed, delay(500)]);
    }
    const details = [primaryError?.message];
    if (versionProbeError || listenerCheckError) {
      const closeDetails =
        browserCloseDetails ||
        (browser ? { code: browser.exitCode, signal: browser.signalCode } : {});
      details.push(
        `Chrome close after cleanup: exit code ${closeDetails.code ?? "unknown"}, signal ${closeDetails.signal ?? "none"}; stderr: ${browserStderr.trim() || "(empty)"}`,
      );
    }
    details.push(...cleanupErrors);
    const message = details.filter(Boolean).join("; ");
    throw new Error(message || "CDP smoke failed");
  }
}

async function main() {
  const chrome = findChrome();
  if (!chrome) {
    console.log("skipped: no Chrome found");
    if (process.env.CI) process.exitCode = 1;
    return;
  }
  console.log(`Selected Chrome: ${chrome}`);
  await runSmoke(chrome);
  console.log("CDP smoke passed.");
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { classifyLoopbackListeners, withWindowsLoopbackProbe };
