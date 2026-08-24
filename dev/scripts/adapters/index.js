// base_project:managed
const fs = require("node:fs");
const path = require("node:path");

const CATALOG_PATH = path.join(__dirname, "..", "..", "..", "source", "adapters.json");

function loadCatalog() {
  if (!fs.existsSync(CATALOG_PATH)) return { adapters: [] };
  return JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8"));
}

function list() {
  return loadCatalog().adapters;
}

function listDeep() {
  return list().filter((a) => a.kind === "deep");
}

function get(id) {
  return list().find((a) => a.id === id) || null;
}

function detectAll() {
  // naive: assume all detectable
  return list().map((a) => a.id);
}

module.exports = { loadCatalog, list, listDeep, get, detectAll, CATALOG_PATH };
