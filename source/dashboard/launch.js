#!/usr/bin/env node
// base_project:managed
// Starts the local usage dashboard server if it isn't already running, then opens
// it in the default browser. Safe to run repeatedly.

const http = require("http");
const { spawn } = require("child_process");
const path = require("path");

const PORT = process.env.BASE_PROJECT_DASHBOARD_PORT || 4317;
// Scoped to the project this was launched from by default — pass
// BASE_PROJECT_DASHBOARD_ALL=1 to open the all-projects view instead.
const SCOPE = process.env.BASE_PROJECT_DASHBOARD_ALL ? "__all__" : process.cwd();
const URL = `http://127.0.0.1:${PORT}/?project=${encodeURIComponent(SCOPE)}`;
const SERVER_PATH = path.join(__dirname, "server.js");

function isRunning() {
  return new Promise((resolve) => {
    const req = http.get(URL, () => resolve(true));
    req.on("error", () => resolve(false));
    req.setTimeout(800, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function openBrowser() {
  const cmd =
    process.platform === "win32"
      ? ["cmd", ["/c", "start", "", URL]]
      : process.platform === "darwin"
        ? ["open", [URL]]
        : ["xdg-open", [URL]];
  spawn(cmd[0], cmd[1], { detached: true, stdio: "ignore" }).unref();
}

async function main() {
  if (!(await isRunning())) {
    spawn(process.execPath, [SERVER_PATH], { detached: true, stdio: "ignore" }).unref();
    await new Promise((r) => setTimeout(r, 600));
  }
  console.log(`base_project dashboard: ${URL}`);
  openBrowser();
}

main();
