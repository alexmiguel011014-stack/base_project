#!/usr/bin/env node
// base_project:managed
// Validates source/plugins.json against dev/schemas/plugins.schema.json.
// Run manually (`node dev/scripts/validate-plugins.js`) or from CI/tests before
// trusting the catalog — catches malformed entries before they reach the
// dashboard or /plugins command.

const fs = require("node:fs");
const path = require("node:path");
const Ajv = require("ajv");
const addFormats = require("ajv-formats");

const DEV_ROOT = path.join(__dirname, "..");
const REPO_ROOT = path.join(DEV_ROOT, "..");
const SCHEMA_PATH = path.join(DEV_ROOT, "schemas", "plugins.schema.json");
const CATALOG_PATH = path.join(REPO_ROOT, "source", "plugins.json");

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function validate(catalogPath = CATALOG_PATH) {
  const schema = loadJson(SCHEMA_PATH);
  const catalog = loadJson(catalogPath);

  const ajv = new Ajv({ allErrors: true });
  addFormats(ajv);
  const validateFn = ajv.compile(schema);
  const valid = validateFn(catalog);

  if (!valid) {
    return { valid: false, errors: validateFn.errors };
  }

  // Beyond schema shape: dependsOn / profiles must reference real catalog ids.
  const ids = new Set(catalog.catalog.map((entry) => entry.id));
  const referenceErrors = [];

  for (const entry of catalog.catalog) {
    for (const dep of entry.dependsOn || []) {
      if (!ids.has(dep)) {
        referenceErrors.push(
          `catalog entry "${entry.id}" has dependsOn "${dep}", which is not a known catalog id`,
        );
      }
    }
  }
  for (const [profileName, profileIds] of Object.entries(
    catalog.profiles || {},
  )) {
    for (const id of profileIds) {
      if (!ids.has(id)) {
        referenceErrors.push(
          `profile "${profileName}" references "${id}", which is not a known catalog id`,
        );
      }
    }
  }

  if (referenceErrors.length) {
    return { valid: false, errors: referenceErrors };
  }

  return { valid: true, errors: null };
}

if (require.main === module) {
  const result = validate();
  if (result.valid) {
    console.log("plugins.json is valid.");
    process.exit(0);
  }
  console.error("plugins.json is INVALID:");
  for (const err of result.errors) {
    console.error(
      typeof err === "string"
        ? `  - ${err}`
        : `  - ${err.instancePath || "(root)"} ${err.message}`,
    );
  }
  process.exit(1);
}

module.exports = { validate };
