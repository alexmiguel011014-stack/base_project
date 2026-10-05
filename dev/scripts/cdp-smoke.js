#!/usr/bin/env node
// base_project:managed
// @ts-check
// Launch-sequence smoke for the `cdp` modifier (GOALS 18, C18.8). It runs, on the machine it is
// started on, the sequence source/claude/references/cdp-verification.md tells a model to follow
// when it has to start its own browser — a fresh profile, a debug port chosen by Chrome, a
// loopback-only listener, cleanup on every outcome — and fails when a property does not hold:
//
//   1. GET /json/version answers on loopback            (the debug endpoint is up)
//   2. GET /json/list shows the page Chrome opened      (the endpoint is the live browser)
//   3. the debug port listens on loopback only          (nothing else on the network can drive it)
//   4. the temporary profile directory is gone          (cleanup removed it)
//   5. the debug port no longer answers                 (cleanup stopped the browser)
//   6. no browser process is left running           (cleanup killed the whole tree)
//
// Zero dependencies. Chrome comes from CHROME_BIN or CHROME_PATH, else the standard per-OS install
// paths and PATH names. With no Chrome it prints `skipped: no Chrome found` and exits 0 — except
// under CI, where a missing browser is a broken runner, not a skip, and it exits 1.
//
// Usage: node dev/scripts/cdp-smoke.js      (npm run smoke:cdp)

const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// Finding Chrome and building its command line
// ---------------------------------------------------------------------------

function candidatePaths(env, platform) {
  const fromEnv = [env.CHROME_BIN, env.CHROME_PATH].filter(Boolean);
  if (platform === "darwin") {
    return [
      ...fromEnv,
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
    ];
  }
  if (platform === "win32") {
    const roots = [
      env.ProgramFiles,
      env["ProgramFiles(x86)"],
      env.LOCALAPPDATA,
    ].filter(Boolean);
    return [
      ...fromEnv,
      ...roots.map((root) =>
        path.win32.join(root, "Google", "Chrome", "Application", "chrome.exe"),
      ),
    ];
  }
  const names = [
    "google-chrome",
    "google-chrome-stable",
    "chromium",
    "chromium-browser",
  ];
  const dirs = (env.PATH || "").split(":").filter(Boolean);
  return [
    ...fromEnv,
    ...dirs.flatMap((dir) => names.map((name) => path.posix.join(dir, name))),
  ];
}

function findChrome(
  env = process.env,
  platform = process.platform,
  exists = fs.existsSync,
) {
  return (
    candidatePaths(env, platform).find((candidate) => exists(candidate)) || null
  );
}

function chromeArgs({ profile, url, noSandbox }) {
  return [
    "--headless=new",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
    ...(noSandbox ? ["--no-sandbox"] : []),
    url,
  ];
}

// On Linux and macOS Chrome binds its single-instance socket in a directory under TMPDIR, and a
// socket path has a hard length limit (108 bytes on Linux, 104 on macOS). A longer TMPDIR makes it
// crash at startup — SIGTRAP, no message — before it writes DevToolsActivePort. Seen with a 62
// character TMPDIR on Linux; 52 worked. The reference tells the model to start the browser with
// TMPDIR=/tmp past this length, and so does the smoke.
const TMPDIR_LIMIT = 50;

function browserEnv(env = process.env, platform = process.platform) {
  if (platform === "win32") return env;
  if (!env.TMPDIR || env.TMPDIR.length <= TMPDIR_LIMIT) return env;
  return { ...env, TMPDIR: "/tmp" };
}

// ---------------------------------------------------------------------------
// Which addresses is a port listening on? Pure parsers, one per OS listing format.
// ---------------------------------------------------------------------------

// "127.0.0.1:9222" and "[::1]:9222" (Windows), "127.0.0.1.9222", "::1.9222" and "*.9222" (macOS).
function splitHostPort(token) {
  const index = Math.max(token.lastIndexOf(":"), token.lastIndexOf("."));
  if (index <= 0) return null;
  const port = token.slice(index + 1);
  if (!/^\d+$/.test(port)) return null;
  return {
    host: token.slice(0, index).replace(/^\[|\]$/g, ""),
    port: Number(port),
  };
}

// `netstat -an` output of Windows (state LISTENING) and macOS (state LISTEN).
function parseNetstat(text, port) {
  const addresses = [];
  for (const line of text.split(/\r?\n/)) {
    if (!/\bLISTEN(ING)?\b/i.test(line)) continue;
    for (const token of line.trim().split(/\s+/)) {
      const parsed = splitHostPort(token);
      if (parsed && parsed.port === port) {
        if (!addresses.includes(parsed.host)) addresses.push(parsed.host);
        break;
      }
    }
  }
  return addresses;
}

// One address column of /proc/net/tcp (8 hex digits) or /proc/net/tcp6 (32): each 4-byte word is
// stored little-endian.
function decodeProcAddress(hex) {
  const bytes = (hex.match(/../g) || []).map((byte) =>
    Number.parseInt(byte, 16),
  );
  const flat = [];
  for (let i = 0; i < bytes.length; i += 4)
    flat.push(...bytes.slice(i, i + 4).reverse());
  if (flat.length === 4) return flat.join(".");
  const mapped =
    flat.slice(0, 10).every((byte) => byte === 0) &&
    flat[10] === 0xff &&
    flat[11] === 0xff;
  if (mapped) return flat.slice(12).join(".");
  if (flat.every((byte) => byte === 0)) return "::";
  if (flat.slice(0, 15).every((byte) => byte === 0) && flat[15] === 1)
    return "::1";
  return `ipv6:${flat.map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

// /proc/net/tcp and /proc/net/tcp6, where state 0A is LISTEN. Needs no `ss` or `netstat`.
function parseProcNet(text, port) {
  const addresses = [];
  for (const line of text.split("\n").slice(1)) {
    const columns = line.trim().split(/\s+/);
    if (columns.length < 4 || columns[3] !== "0A") continue;
    const [hexAddress, hexPort] = columns[1].split(":");
    if (!hexAddress || Number.parseInt(hexPort, 16) !== port) continue;
    addresses.push(decodeProcAddress(hexAddress));
  }
  return addresses;
}

function classifyAddress(address) {
  const value = address.toLowerCase();
  if (["*", "0.0.0.0", "::", "[::]"].includes(value)) return "wildcard";
  if (
    value === "::1" ||
    value === "localhost" ||
    value.startsWith("127.") ||
    value.startsWith("::ffff:127.")
  ) {
    return "loopback";
  }
  return "other";
}

// A port nobody listens on proves nothing, so it is not "loopback only".
function isLoopbackOnly(addresses) {
  return (
    addresses.length > 0 &&
    addresses.every((address) => classifyAddress(address) === "loopback")
  );
}

// Windows needs plain `-an`: `-p TCP` lists IPv4 sockets only and would hide a wildcard IPv6
// listener; the UDP rows carry no LISTENING state, so the parser skips them. On macOS `-p tcp`
// lists tcp4, tcp6 and tcp46 together.
function netstatArgs(platform) {
  return platform === "win32" ? ["-an"] : ["-an", "-p", "tcp"];
}

function listenAddresses(port, platform = process.platform) {
  if (platform === "linux") {
    return ["/proc/net/tcp", "/proc/net/tcp6"].flatMap((file) => {
      try {
        return parseProcNet(fs.readFileSync(file, "utf8"), port);
      } catch {
        return [];
      }
    });
  }
  const result = spawnSync("netstat", netstatArgs(platform), {
    encoding: "utf8",
  });
  return parseNetstat(result.stdout || "", port);
}

// ---------------------------------------------------------------------------
// Running the browser
// ---------------------------------------------------------------------------

function isRoot() {
  return typeof process.getuid === "function" && process.getuid() === 0;
}

function removeProfile(profile) {
  try {
    fs.rmSync(profile, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 300,
    });
  } catch {
    // Reported by the "profile is gone" check.
  }
}

// What launch() hands to spawn, kept pure so a test can read it without starting a browser.
function spawnSpec(
  { chrome, profile, url, noSandbox },
  env = process.env,
  platform = process.platform,
) {
  /** @type {import("node:child_process").SpawnOptions} */
  const options = {
    env: browserEnv(env, platform),
    // stderr is kept (its tail) so a run that never opens a port can say why.
    stdio: ["ignore", "ignore", "pipe"],
    // POSIX: its own process group, so the whole browser tree can be killed at once.
    detached: platform !== "win32",
    windowsHide: true,
  };
  return {
    command: chrome,
    args: chromeArgs({ profile, url, noSandbox }),
    options,
  };
}

function launch(chrome, profile, url, noSandbox) {
  const spec = spawnSpec({ chrome, profile, url, noSandbox });
  const child = spawn(spec.command, spec.args, spec.options);
  const state = { child, exited: false, stderr: "", status: "" };
  child.stderr?.setEncoding("utf8");
  child.stderr?.on("data", (chunk) => {
    state.stderr = (state.stderr + chunk).slice(-2000);
  });
  child.stderr?.on("error", () => {});
  child.once("exit", (code, signal) => {
    state.exited = true;
    state.status = signal ? `signal ${signal}` : `exit code ${code}`;
  });
  child.once("error", (error) => {
    state.exited = true;
    state.status = String(error);
  });
  return state;
}

// The last few lines Chrome wrote to stderr, for the note about a run that opened no port.
function stderrTail(state, lines = 4) {
  return state.stderr
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-lines)
    .join(" | ")
    .slice(-400);
}

// Kills the whole tree — Chrome starts renderer and GPU children — and waits for the parent.
async function stop(state) {
  const { child } = state;
  if (child.pid) {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
      });
    } else {
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {
        // The group is already gone.
      }
    }
  }
  for (let i = 0; i < 50 && !state.exited; i += 1) await sleep(100);
  // A survivor of the tree would hold the pipe open and keep this process alive.
  child.stderr?.destroy();
}

// How many processes of the browser are still alive; null when that cannot be told. POSIX lists
// every process whose command line carries this run's unique profile path — renderers, GPU and the
// crashpad handler all do, although crashpad lives in a process group of its own — and ignores
// zombies (state Z: dead, just not reaped yet). Windows can only look up the parent through
// tasklist, which does not show children.
function aliveInTree(pid, profile) {
  if (process.platform === "win32") {
    const listing = spawnSync("tasklist", ["/FI", `PID eq ${pid}`, "/NH"], {
      encoding: "utf8",
    });
    if (listing.error) return null;
    return String(listing.stdout).includes(String(pid)) ? 1 : 0;
  }
  const listing = spawnSync("ps", ["ax", "-o", "stat=,args="], {
    encoding: "utf8",
  });
  if (listing.error || listing.status !== 0) return null;
  return listing.stdout
    .split("\n")
    .filter((line) => line.includes(profile) && !/^\s*Z/.test(line)).length;
}

async function treeGone(pid, profile, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let alive = aliveInTree(pid, profile);
  while (alive !== null && alive > 0 && Date.now() < deadline) {
    await sleep(200);
    alive = aliveInTree(pid, profile);
  }
  return alive;
}

// Chrome writes the port it chose on the first line of <profile>/DevToolsActivePort.
async function waitForPort(profile, state, timeoutMs) {
  const file = path.join(profile, "DevToolsActivePort");
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const first = fs.readFileSync(file, "utf8").split("\n")[0].trim();
      if (/^\d+$/.test(first)) return Number(first);
    } catch {
      // Not written yet.
    }
    if (state.exited) return null;
    await sleep(200);
  }
  return null;
}

function getJson(port, route, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const request = http.get(
      { host: "127.0.0.1", port, path: route, timeout: timeoutMs },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(error);
          }
        });
      },
    );
    request.on("timeout", () => request.destroy(new Error("timeout")));
    request.on("error", reject);
  });
}

async function waitForTarget(port, title, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const targets = await getJson(port, "/json/list");
      if (targets.some((t) => t.type === "page" && t.title === title))
        return true;
    } catch {
      // Not ready yet.
    }
    await sleep(250);
  }
  return false;
}

async function portClosed(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await getJson(port, "/json/version", 1000);
    } catch {
      return true;
    }
    await sleep(250);
  }
  return false;
}

// Starts Chrome with a fresh profile. The sandbox stays on unless the platform forces it off:
// running as root always does; on Linux CI a second attempt without it is made only after the first
// one opened no port, and says so.
async function startBrowser(chrome, url, profiles) {
  const attempts = [{ noSandbox: isRoot(), reason: "running as root" }];
  if (process.platform === "linux" && process.env.CI && !isRoot()) {
    attempts.push({
      noSandbox: true,
      reason: "the sandboxed start opened no port",
    });
  }
  for (const attempt of attempts) {
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), "cdp-smoke-"));
    profiles.push(profile);
    const state = launch(chrome, profile, url, attempt.noSandbox);
    const port = await waitForPort(profile, state, 20000);
    if (port) return { state, profile, port, ...attempt };
    const why = [
      state.exited ? `Chrome ended with ${state.status}` : "",
      stderrTail(state) ? `stderr: ${stderrTail(state)}` : "",
    ].filter(Boolean);
    console.log(
      `  note: Chrome opened no debug port${attempt.noSandbox ? "" : " with its sandbox on"}${why.length ? ` — ${why.join("; ")}` : ""}`,
    );
    await stop(state);
    removeProfile(profile);
  }
  return null;
}

// ---------------------------------------------------------------------------
// The smoke
// ---------------------------------------------------------------------------

async function main() {
  const chrome = findChrome();
  if (!chrome) {
    const message = "no Chrome found (set CHROME_BIN or install Google Chrome)";
    if (process.env.CI) {
      console.error(`cdp-smoke: ${message} — failing because CI is set`);
      return 1;
    }
    console.log(`skipped: ${message}`);
    return 0;
  }
  console.log(`cdp-smoke: using ${chrome}`);

  const results = [];
  const check = (name, ok, detail = "") => {
    results.push({ name, ok });
    console.log(
      `  ${ok ? "ok  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`,
    );
  };

  const title = `cdp-smoke-${process.pid}-${Date.now()}`;
  const server = http.createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/html" });
    response.end(`<!doctype html><title>${title}</title><p>cdp smoke</p>`);
  });
  await new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve(undefined)),
  );
  const { port: appPort } = /** @type {import("node:net").AddressInfo} */ (
    server.address()
  );

  const profiles = [];
  /** @type {Awaited<ReturnType<typeof startBrowser>>} */
  let started = null;
  try {
    started = await startBrowser(
      chrome,
      `http://127.0.0.1:${appPort}/`,
      profiles,
    );
    if (!started) {
      check(
        "Chrome opens a debug port",
        false,
        "no attempt produced a DevToolsActivePort",
      );
    } else {
      const { port } = started;
      check(
        "Chrome opens a debug port",
        true,
        `port ${port}${started.noSandbox ? `, --no-sandbox because ${started.reason}` : ""}`,
      );
      try {
        const version = await getJson(port, "/json/version");
        check(
          "/json/version answers on loopback",
          typeof version.Browser === "string",
          version.Browser,
        );
      } catch (error) {
        check("/json/version answers on loopback", false, String(error));
      }
      check(
        "/json/list shows the page Chrome opened",
        await waitForTarget(port, title, 15000),
      );
      const addresses = listenAddresses(port);
      check(
        "the debug port listens on loopback only",
        isLoopbackOnly(addresses),
        addresses.join(", ") || "no listener found",
      );
    }
  } finally {
    if (started) await stop(started.state);
    for (const profile of profiles) removeProfile(profile);
    server.closeAllConnections();
    server.close();
  }

  if (started) {
    check(
      "the temporary profile is gone",
      profiles.every((profile) => !fs.existsSync(profile)),
    );
    check(
      "the debug port no longer answers",
      await portClosed(started.port, 8000),
    );
    const pid = started.state.child.pid;
    const alive = pid ? await treeGone(pid, started.profile, 8000) : 0;
    if (alive === null) {
      console.log(
        "  note: could not list processes, so 'none left running' is unchecked",
      );
    } else {
      check(
        "no browser process is left running",
        alive === 0,
        alive
          ? `${alive} still alive`
          : process.platform === "win32"
            ? "parent only"
            : "",
      );
    }
  }
  const failed = results.filter((result) => !result.ok).length;
  console.log(
    failed
      ? `cdp-smoke: ${failed} check(s) failed`
      : "cdp-smoke: all checks passed",
  );
  return failed ? 1 : 0;
}

if (require.main === module) {
  // A browser that survived its cleanup keeps this process alive; fail instead of hanging a CI job.
  const finish = (code) => {
    process.exitCode = code;
    setTimeout(() => process.exit(code), 2000).unref();
  };
  main().then(finish, (error) => {
    console.error(error);
    finish(1);
  });
}

module.exports = {
  TMPDIR_LIMIT,
  browserEnv,
  candidatePaths,
  chromeArgs,
  classifyAddress,
  findChrome,
  isLoopbackOnly,
  netstatArgs,
  parseNetstat,
  parseProcNet,
  spawnSpec,
  splitHostPort,
};
