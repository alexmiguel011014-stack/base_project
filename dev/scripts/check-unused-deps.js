#!/usr/bin/env node
// base_project:managed
// Checks for unused dependencies in package.json by analyzing imports in source files.

const fs = require("node:fs");
const path = require("node:path");

function findPackageJson(dir) {
  let current = dir;
  while (current !== path.dirname(current)) {
    const pkgPath = path.join(current, "package.json");
    if (fs.existsSync(pkgPath)) return pkgPath;
    current = path.dirname(current);
  }
  return null;
}

function getAllImports(
  dir,
  extensions = [".js", ".mjs", ".cjs", ".ts", ".mts", ".cts"],
) {
  const imports = new Set();

  function walk(d) {
    try {
      const entries = fs.readdirSync(d, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(d, entry.name);
        if (entry.isDirectory()) {
          if (
            ![
              ".git",
              "node_modules",
              ".venv",
              "__pycache__",
              "dist",
              "build",
            ].includes(entry.name)
          ) {
            walk(full);
          }
        } else if (
          entry.isFile() &&
          extensions.includes(path.extname(entry.name))
        ) {
          try {
            const content = fs.readFileSync(full, "utf8");
            const importRegex = /(?:import|require)\s*\(?\s*["']([^"']+)["']/g;
            let match = importRegex.exec(content);
            while (match !== null) {
              imports.add(match[1]);
              match = importRegex.exec(content);
            }
          } catch {}
        }
      }
    } catch {}
  }

  walk(dir);
  return imports;
}

function getPackageDeps(pkgPath) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const deps = new Set([
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ]);
  return deps;
}

const KNOWN_CLI_DEPS = new Set([
  "@biomejs/biome",
  "typescript",
  "tsc",
  "eslint",
  "prettier",
  "jest",
  "vitest",
  "mocha",
  "ava",
  "playwright",
  "cypress",
  "husky",
  "lint-staged",
  "commitlint",
  "standard-version",
  "semantic-release",
]);

function main() {
  const pkgPath = findPackageJson(process.cwd());
  if (!pkgPath) {
    console.error("No package.json found");
    process.exit(1);
  }

  const deps = getPackageDeps(pkgPath);
  const imports = getAllImports(path.dirname(pkgPath));

  const builtins = new Set([
    "fs",
    "path",
    "os",
    "crypto",
    "util",
    "events",
    "stream",
    "buffer",
    "http",
    "https",
    "url",
    "querystring",
    "child_process",
    "worker_threads",
    "perf_hooks",
    "inspector",
    "module",
    "vm",
    "assert",
    "console",
    "process",
    "timers",
    "tty",
    "readline",
    "repl",
    "string_decoder",
    "punycode",
    "domain",
    "dgram",
    "dns",
    "net",
    "tls",
    "zlib",
    "constants",
    "async_hooks",
    "trace_events",
    "node:fs",
    "node:path",
    "node:os",
    "node:crypto",
    "node:util",
    "node:events",
    "node:stream",
    "node:buffer",
    "node:http",
    "node:https",
    "node:url",
    "node:querystring",
    "node:child_process",
    "node:worker_threads",
    "node:perf_hooks",
    "node:inspector",
    "node:module",
    "node:vm",
    "node:assert",
    "node:console",
    "node:process",
    "node:timers",
    "node:tty",
    "node:readline",
    "node:repl",
    "node:string_decoder",
    "node:punycode",
    "node:domain",
    "node:dgram",
    "node:dns",
    "node:net",
    "node:tls",
    "node:zlib",
    "node:constants",
    "node:async_hooks",
    "node:trace_events",
  ]);

  let hasUnused = false;
  for (const dep of deps) {
    if (builtins.has(dep)) continue;
    if (KNOWN_CLI_DEPS.has(dep)) continue;

    let used = false;
    for (const imp of imports) {
      if (imp === dep || imp.startsWith(`${dep}/`)) {
        used = true;
        break;
      }
    }

    if (!used) {
      console.log(`UNUSED: ${dep}`);
      hasUnused = true;
    }
  }

  if (!hasUnused) {
    console.log("All dependencies are used.");
    process.exit(0);
  } else {
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { getAllImports, getPackageDeps };
