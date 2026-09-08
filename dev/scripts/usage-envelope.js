#!/usr/bin/env node
// base_project:managed
// Normalizes the text copied from Claude Code's `/usage` report without retaining
// the original report or any prompt/tool payload. This is deliberately a pure,
// small parser: attribution to the local ledger belongs to /usagebp (V.2).

const fs = require("node:fs");

const SECRET_PATTERNS = [
  /-----BEGIN [^-]*PRIVATE KEY-----/i,
  /\b(?:api[_-]?key|access[_-]?token|password|secret|authorization)\s*[:=]\s*\S+/i,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/i,
  /\b(?:sk|ghp|github_pat|xox[baprs]-)[A-Za-z0-9_-]{8,}/i,
];

function metric(value, unit, status = "reported") {
  return {
    value: Number.isFinite(value) ? value : null,
    unit,
    status: Number.isFinite(value) ? status : "unavailable",
  };
}

function parseCompactNumber(raw) {
  if (typeof raw !== "string") return null;
  const normalized = raw
    .trim()
    .replace(/,/g, "")
    .replace(/\btokens?\b/i, "");
  const match = normalized.match(/^([0-9]+(?:\.[0-9]+)?)\s*([kmb])?$/i);
  if (!match) return null;
  const multipliers = { k: 1e3, m: 1e6, b: 1e9 };
  const value = Number(match[1]) * (multipliers[match[2]?.toLowerCase()] || 1);
  return Number.isFinite(value) ? Math.round(value) : null;
}

function parseCurrency(raw) {
  if (typeof raw !== "string") return null;
  const match = raw.trim().match(/^\$\s*([0-9]+(?:\.[0-9]+)?)$/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function parseDurationMinutes(raw) {
  if (typeof raw !== "string") return null;
  const match = raw.trim().match(/^([0-9]+(?:\.[0-9]+)?)\s*([smhd])$/i);
  if (!match) return null;
  const value = Number(match[1]);
  const factors = { s: 1 / 60, m: 1, h: 60, d: 1440 };
  const minutes = value * factors[match[2].toLowerCase()];
  return Number.isFinite(minutes) ? minutes : null;
}

function parseTimestamp(raw) {
  if (!raw) return null;
  const date = new Date(raw.trim());
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function assertSafeReport(text) {
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("usage report must be a non-empty text value");
  }
  if (SECRET_PATTERNS.some((pattern) => pattern.test(text))) {
    throw new Error(
      "usage report contains credential-like material; remove it before processing",
    );
  }
}

function parseSessionLine(line) {
  const match = line.match(/^\s*[-*]\s+([^:]+):\s+(.+)$/);
  if (!match) return null;

  const values = {
    input_tokens: null,
    output_tokens: null,
    cache_read_tokens: null,
    cache_write_tokens: null,
  };
  let foundMetric = false;

  for (const part of match[2].split(/\s*\/\s*/)) {
    const metricMatch = part.match(
      /^(.+?)\s+(in|out|cache\s+read|cache\s+write)\s*$/i,
    );
    if (!metricMatch) continue;
    foundMetric = true;
    const label = metricMatch[2].toLowerCase().replace(/\s+/g, " ");
    const key = {
      in: "input_tokens",
      out: "output_tokens",
      "cache read": "cache_read_tokens",
      "cache write": "cache_write_tokens",
    }[label];
    values[key] = metricMatch[1].trim();
  }

  if (!foundMetric) return null;
  return {
    model: match[1].trim(),
    input_tokens: metric(parseCompactNumber(values.input_tokens), "tokens"),
    output_tokens: metric(parseCompactNumber(values.output_tokens), "tokens"),
    cache_read_tokens: metric(
      parseCompactNumber(values.cache_read_tokens),
      "tokens",
    ),
    cache_write_tokens: metric(
      parseCompactNumber(values.cache_write_tokens),
      "tokens",
    ),
    cost_usd: metric(null, "USD", "estimated"),
    api_minutes: metric(null, "minutes"),
    wall_minutes: metric(null, "minutes"),
  };
}

function unknownFields(envelope) {
  const unknown = [];
  if (!envelope.captured_at) unknown.push("captured_at");
  if (!envelope.client) unknown.push("client");
  if (!envelope.plan_limits.length) unknown.push("plan_limits");
  if (!envelope.sessions.length) unknown.push("sessions");
  if (!envelope.local_activity.length) unknown.push("local_activity");
  for (const [index, session] of envelope.sessions.entries()) {
    for (const key of [
      "input_tokens",
      "output_tokens",
      "cache_read_tokens",
      "cache_write_tokens",
      "cost_usd",
      "api_minutes",
      "wall_minutes",
    ]) {
      if (session[key].status === "unavailable") {
        unknown.push(`sessions[${index}].${key}`);
      }
    }
  }
  return unknown;
}

function parseUsageReport(text) {
  assertSafeReport(text);
  const lines = text.split(/\r?\n/);
  let capturedAt = null;
  let client = null;
  let lastSession = null;
  const planLimits = [];
  const sessions = [];
  const localActivity = [];

  for (const line of lines) {
    const reportMatch = line.match(/^Claude Code usage report\s*\(([^)]+)\)/i);
    if (reportMatch) capturedAt = parseTimestamp(reportMatch[1]);

    const clientMatch = line.match(/^Client:\s*(.+)$/i);
    if (clientMatch) client = clientMatch[1].trim();

    const limitMatch = line.match(
      /^\s*[-*]\s+([A-Za-z0-9_-]+):\s*([0-9]+(?:\.[0-9]+)?)%\s*(?:\(resets\s+([^)]+)\))?/i,
    );
    if (limitMatch) {
      planLimits.push({
        id: limitMatch[1],
        used_percent: metric(Number(limitMatch[2]), "percent"),
        resets_at: {
          value: parseTimestamp(limitMatch[3]),
          unit: "timestamp",
          status: parseTimestamp(limitMatch[3]) ? "reported" : "unavailable",
        },
      });
    }

    const parsedSession = parseSessionLine(line);
    if (parsedSession) {
      sessions.push(parsedSession);
      lastSession = parsedSession;
    }

    const costMatch = line.match(
      /^\s*[-*]\s+Cost:\s*(\$\s*[0-9]+(?:\.[0-9]+)?)\s*\|\s*API\s+([^|]+)\s*\|\s*Wall\s+(.+)$/i,
    );
    if (costMatch && lastSession) {
      lastSession.cost_usd = metric(
        parseCurrency(costMatch[1]),
        "USD",
        "estimated",
      );
      lastSession.api_minutes = metric(
        parseDurationMinutes(costMatch[2]),
        "minutes",
      );
      lastSession.wall_minutes = metric(
        parseDurationMinutes(costMatch[3]),
        "minutes",
      );
    }

    const activityMatch = line.match(
      /^Local activity:\s*([0-9,]+)\s+requests\s*\(([^)]+)\)\s*\|\s*([0-9,]+)\s+requests\s*\(([^)]+)\)\s*$/i,
    );
    if (activityMatch) {
      localActivity.push(
        {
          window: activityMatch[2].trim(),
          requests: Number(activityMatch[1].replace(/,/g, "")),
        },
        {
          window: activityMatch[4].trim(),
          requests: Number(activityMatch[3].replace(/,/g, "")),
        },
      );
    }
  }

  const envelope = {
    schema_version: "usage-envelope/v1",
    source: {
      type: "claude-usage-report",
      authority: "user-provided",
    },
    captured_at: capturedAt,
    client,
    plan_limits: planLimits,
    sessions,
    local_activity: localActivity,
    unknown_fields: [],
  };
  envelope.unknown_fields = unknownFields(envelope);
  return envelope;
}

function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
  });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(
      "Usage: node dev/scripts/usage-envelope.js [--input <report.txt>] [--json]",
    );
    return;
  }
  const inputIndex = args.indexOf("--input");
  const text =
    inputIndex === -1
      ? await readStdin()
      : fs.readFileSync(args[inputIndex + 1], "utf8");
  console.log(JSON.stringify(parseUsageReport(text), null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`usage report rejected: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  parseCompactNumber,
  parseUsageReport,
};
