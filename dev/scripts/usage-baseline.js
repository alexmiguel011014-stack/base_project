#!/usr/bin/env node
// base_project:managed
// Produces aggregate usage baselines from the local ledger and an optional
// normalized Claude `/usage` report. It never emits prompt/tool payloads and
// never writes an artifact unless the caller redirects stdout explicitly.

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { parseUsageReport } = require("./usage-envelope.js");

const ERROR_LIKE = /\b(?:error|failed|exception|timed out|timeout)\b/i;
const ERROR_CATEGORIES = [
  "expected_negative_test",
  "user_cancelled",
  "transient_infrastructure",
  "model_tool_retry",
  "genuine_task_failure",
  "needs_review",
];
const COMMAND_CLASSES = {
  newgoal: "planning",
  repertoire: "research",
  execgoals: "execution",
  fixproject: "short-fix",
  bootstrap: "maintenance",
  scanproject: "audit",
  cleanproject: "audit",
  ship: "delivery",
  pr: "delivery",
  undo: "recovery",
  uninstall: "administration",
  usagebp: "analysis",
  diario: "reporting",
};

function classifyPrompt(prompt) {
  if (typeof prompt !== "string") return "unclassified";
  const match = prompt.trim().match(/^[/$]([a-z][a-z0-9_-]*)\b/i);
  return match
    ? COMMAND_CLASSES[match[1].toLowerCase()] || "command-other"
    : "unclassified";
}

function commandName(prompt) {
  if (typeof prompt !== "string") return null;
  const match = prompt.trim().match(/^[/$]([a-z][a-z0-9_-]*)\b/i);
  return match ? match[1].toLowerCase() : null;
}

function classifyError(tool, prompt) {
  const response = typeof tool?.response === "string" ? tool.response : "";
  if (!ERROR_LIKE.test(response)) return null;
  const text = [prompt, tool?.input, tool?.response]
    .filter((value) => typeof value === "string")
    .join(" ");
  if (
    /expected\s+(?:failure|error)|negative\s+test|should\s+fail|assert(?:ion)?\s+.*\b(?:fail|error)|deliberate(?:ly)?\s+fail/i.test(
      text,
    )
  ) {
    return "expected_negative_test";
  }
  if (
    /cancelled|canceled|user\s+interrupt|interrupted\s+by\s+user/i.test(text)
  ) {
    return "user_cancelled";
  }
  if (
    /timed\s+out|timeout|econnreset|eai_again|network|\b429\b|\b529\b|overload|rate\s+limit/i.test(
      text,
    )
  ) {
    return "transient_infrastructure";
  }
  if (/retry(?:ing|ed)?|attempt\s+\d+|max\s+retries/i.test(text)) {
    return "model_tool_retry";
  }
  if (
    /(?:command|tool|task|request)\s+(?:has\s+)?failed|fatal|uncaught\s+exception/i.test(
      text,
    )
  ) {
    return "genuine_task_failure";
  }
  return "needs_review";
}

function parseLedgerText(text) {
  const events = [];
  let invalidLines = 0;
  for (const line of String(text || "").split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line);
      if (event && typeof event === "object" && !Array.isArray(event)) {
        events.push(event);
      } else {
        invalidLines += 1;
      }
    } catch {
      invalidLines += 1;
    }
  }
  return { events, invalidLines };
}

function readLedger(directory) {
  if (!fs.existsSync(directory)) {
    return { events: [], invalidLines: 0, files: 0 };
  }
  const files = fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".jsonl"))
    .map((entry) => entry.name)
    .sort();
  const events = [];
  let invalidLines = 0;
  for (const file of files) {
    const parsed = parseLedgerText(
      fs.readFileSync(path.join(directory, file), "utf8"),
    );
    events.push(...parsed.events);
    invalidLines += parsed.invalidLines;
  }
  return { events, invalidLines, files: files.length };
}

function isValidDate(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function durationMs(events) {
  return events.reduce(
    (total, event) =>
      total + (typeof event.ms === "number" && event.ms >= 0 ? event.ms : 0),
    0,
  );
}

function emptyBucket(taskClass) {
  return {
    task_class: taskClass,
    sample_count: 0,
    first_sample_at: null,
    last_sample_at: null,
    prompt_events: 0,
    tool_events: 0,
    tool_calls_per_prompt: null,
    error_like_events: 0,
    error_like_rate: null,
    error_categories: Object.fromEntries(
      ERROR_CATEGORIES.map((category) => [category, 0]),
    ),
    duration_ms: {
      total: 0,
      average_per_prompt: null,
      maximum_tool_ms: null,
    },
    quality: {
      status: "unavailable",
      reason: "the local ledger does not capture correctness or user rework",
    },
    token_usage: {
      status: "unavailable",
      reason:
        "the local ledger does not capture input, output, or cache tokens",
    },
  };
}

function buildWorkflowAudit(events) {
  const prompts = events
    .filter((event) => event.event === "UserPromptSubmit")
    .sort((a, b) => Date.parse(a.ts || "") - Date.parse(b.ts || ""));
  const toolsByPrompt = new Map();
  for (const tool of events.filter((event) => event.event === "PostToolUse")) {
    const key = tool.prompt_id || "__orphan__";
    const group = toolsByPrompt.get(key) || [];
    group.push(tool);
    toolsByPrompt.set(key, group);
  }

  const commandCounts = {};
  const commandSequence = [];
  let emptyChains = 0;
  let repeatedToolCalls = 0;
  let repeatedReadCalls = 0;
  let repeatedValidationCalls = 0;
  let errorThenFollowupChains = 0;

  for (const prompt of prompts) {
    const name = commandName(prompt.prompt);
    const promptTools = toolsByPrompt.get(prompt.prompt_id) || [];
    if (!promptTools.length) emptyChains += 1;
    if (name) {
      commandCounts[name] = (commandCounts[name] || 0) + 1;
      commandSequence.push(name);
    }

    const signatures = new Map();
    for (const tool of promptTools) {
      const signature = `${tool.tool || "unknown"}|${tool.input || ""}`;
      const count = signatures.get(signature) || 0;
      if (count > 0) repeatedToolCalls += 1;
      signatures.set(signature, count + 1);
    }
    repeatedReadCalls += promptTools.filter((tool, index, all) => {
      if (tool.tool !== "Read" || !tool.input) return false;
      return (
        all.findIndex(
          (candidate) =>
            candidate.tool === "Read" && candidate.input === tool.input,
        ) < index
      );
    }).length;
    repeatedValidationCalls += promptTools.filter((tool, index, all) => {
      if (
        tool.tool !== "Bash" ||
        !/test|lint|check|validat/i.test(tool.input || "")
      ) {
        return false;
      }
      return (
        all.findIndex(
          (candidate) =>
            candidate.tool === "Bash" &&
            candidate.input === tool.input &&
            /test|lint|check|validat/i.test(candidate.input || ""),
        ) < index
      );
    }).length;
    if (
      promptTools.some(
        (tool, index) =>
          classifyError(tool, prompt.prompt) && index < promptTools.length - 1,
      )
    ) {
      errorThenFollowupChains += 1;
    }
  }

  let completePlanExecuteShipCycles = 0;
  let state = "newgoal";
  for (const command of commandSequence) {
    if (state === "newgoal" && command === "newgoal") continue;
    if (state === "newgoal" && command === "execgoals") {
      state = "execgoals";
    } else if (state === "execgoals" && command === "ship") {
      completePlanExecuteShipCycles += 1;
      state = "newgoal";
    } else if (command === "newgoal") {
      state = "newgoal";
    }
  }

  return {
    command_counts: commandCounts,
    complete_newgoal_execgoals_ship_cycles: completePlanExecuteShipCycles,
    empty_prompt_chains: emptyChains,
    repeated_tool_calls: repeatedToolCalls,
    repeated_read_calls: repeatedReadCalls,
    repeated_validation_calls: repeatedValidationCalls,
    error_then_followup_chains: errorThenFollowupChains,
    interpretation:
      "These are activity proxies. A repeated call or follow-up can be necessary; inspect the chain before changing a workflow.",
  };
}

function diagnosticItem({
  id,
  priority,
  status,
  severity,
  confidence,
  evidence,
  hypothesis,
  next_test,
}) {
  return {
    id,
    priority,
    status,
    severity,
    confidence,
    evidence,
    hypothesis,
    next_test,
  };
}

function buildDiagnostics({
  events = [],
  files = 0,
  invalidLines = 0,
  taskClasses = [],
  workflowAudit = buildWorkflowAudit(events),
} = {}) {
  const prompts = events.filter((event) => event.event === "UserPromptSubmit");
  const tools = events.filter((event) => event.event === "PostToolUse");
  const queue = [];
  const totalErrors = taskClasses.reduce(
    (total, bucket) => total + bucket.error_like_events,
    0,
  );
  const errorCount = (category) =>
    taskClasses.reduce(
      (total, bucket) => total + (bucket.error_categories?.[category] || 0),
      0,
    );
  const add = (item) => queue.push(diagnosticItem(item));

  if (!prompts.length && !tools.length) {
    add({
      id: "coverage-missing",
      priority: 1,
      status: "unavailable",
      severity: "high",
      confidence: "high",
      evidence: { ledger_files: files, prompt_events: 0, tool_events: 0 },
      hypothesis:
        "There is no covered activity from which to diagnose usage or waste.",
      next_test:
        "Register the usage-log hook and run a covered session before interpreting zeros.",
    });
  } else {
    if (invalidLines > 0) {
      add({
        id: "ledger-integrity",
        priority: 1,
        status: "needs_review",
        severity: "medium",
        confidence: "high",
        evidence: { invalid_lines: invalidLines, ledger_files: files },
        hypothesis:
          "Malformed ledger lines may reduce the reliability of aggregate counts.",
        next_test:
          "Inspect the affected files for recoverable boundaries without rewriting the ledger automatically.",
      });
    }

    const genuineFailures = errorCount("genuine_task_failure");
    if (genuineFailures > 0) {
      add({
        id: "genuine-task-failures",
        priority: 1,
        status: "confirmed",
        severity: "high",
        confidence: "medium",
        evidence: {
          genuine_task_failure: genuineFailures,
          error_like_events: totalErrors,
        },
        hypothesis:
          "Some tool responses contain signals consistent with a real task failure.",
        next_test:
          "Inspect those chains by prompt_id, identify the root cause, and add a regression check before changing workflow rules.",
      });
    }

    const transientFailures = errorCount("transient_infrastructure");
    if (transientFailures > 0) {
      add({
        id: "transient-failures",
        priority: 2,
        status: "candidate",
        severity: "medium",
        confidence: "medium",
        evidence: { transient_infrastructure: transientFailures },
        hypothesis:
          "Retries or unavailable services may be adding duration and follow-up work.",
        next_test:
          "Separate network, overload, and timeout events from logic failures, then measure controlled retry or fallback behavior.",
      });
    }

    const slowestTask = [...taskClasses]
      .filter((bucket) => bucket.duration_ms?.average_per_prompt >= 120000)
      .sort(
        (a, b) =>
          b.duration_ms.average_per_prompt - a.duration_ms.average_per_prompt,
      )[0];
    if (slowestTask) {
      add({
        id: "slow-task-class",
        priority: 2,
        status: "candidate",
        severity: "medium",
        confidence: "medium",
        evidence: {
          task_class: slowestTask.task_class,
          average_duration_ms: Math.round(
            slowestTask.duration_ms.average_per_prompt,
          ),
          maximum_tool_ms: slowestTask.duration_ms.maximum_tool_ms,
        },
        hypothesis:
          "A small number of long-running tools or waits may dominate wall time for this task class.",
        next_test:
          "Compare the same task class while separating interactive waits, retries, and implementation work.",
      });
    }

    if (workflowAudit.error_then_followup_chains > 0) {
      add({
        id: "error-followup-churn",
        priority: 3,
        status: "candidate",
        severity: "medium",
        confidence: "medium",
        evidence: {
          error_then_followup_chains: workflowAudit.error_then_followup_chains,
        },
        hypothesis:
          "Errors may be causing extra tool calls before the task converges.",
        next_test:
          "Review a sample of affected chains and measure whether clearer preflight checks or bounded retry changes reduce recovery work.",
      });
    }

    if (workflowAudit.repeated_tool_calls > 0) {
      add({
        id: "repeated-tool-calls",
        priority: 3,
        status: "candidate",
        severity: "medium",
        confidence: "low",
        evidence: { repeated_tool_calls: workflowAudit.repeated_tool_calls },
        hypothesis:
          "Identical calls may be repeated because of missing state, unclear completion, or valid verification.",
        next_test:
          "Inspect whether each repetition follows a state change; only batch or suppress repetitions with no new evidence.",
      });
    }

    if (workflowAudit.repeated_read_calls > 0) {
      add({
        id: "repeated-reads",
        priority: 4,
        status: "candidate",
        severity: "low",
        confidence: "low",
        evidence: { repeated_read_calls: workflowAudit.repeated_read_calls },
        hypothesis:
          "Some files may be read again without an intervening change or new requirement.",
        next_test:
          "Compare repeated reads with edits and verification checkpoints before introducing context caching.",
      });
    }

    if (workflowAudit.empty_prompt_chains > 0) {
      add({
        id: "empty-prompt-chains",
        priority: 4,
        status: "candidate",
        severity: "low",
        confidence: "low",
        evidence: { empty_prompt_chains: workflowAudit.empty_prompt_chains },
        hypothesis:
          "Some prompts may have ended without a tool because they were informational, planning-only, interrupted, or missed execution.",
        next_test:
          "Separate intentional no-op prompts from execution requests before changing command boundaries.",
      });
    }

    const unclassified =
      taskClasses.find((bucket) => bucket.task_class === "unclassified")
        ?.prompt_events || 0;
    if (prompts.length > 0 && unclassified / prompts.length >= 0.5) {
      add({
        id: "classification-coverage",
        priority: 5,
        status: "candidate",
        severity: "low",
        confidence: "high",
        evidence: {
          unclassified_prompt_events: unclassified,
          prompt_events: prompts.length,
          unclassified_ratio: Number(
            (unclassified / prompts.length).toFixed(3),
          ),
        },
        hypothesis:
          "Natural-language work is underrepresented in task-class comparisons.",
        next_test:
          "Add conservative read-time intent categories and compare them against explicit command prefixes without storing more payload.",
      });
    }

    if (workflowAudit.repeated_validation_calls > 0) {
      add({
        id: "repeated-validations",
        priority: 5,
        status: "candidate",
        severity: "low",
        confidence: "low",
        evidence: {
          repeated_validation_calls: workflowAudit.repeated_validation_calls,
        },
        hypothesis:
          "Some validation commands may be repeated without a new change to validate.",
        next_test:
          "Compare validation calls with intervening edits and keep checks that protect a delivery boundary.",
      });
    }

    const needsReview = errorCount("needs_review");
    if (needsReview > 0) {
      add({
        id: "ambiguous-error-signals",
        priority: 5,
        status: "needs_review",
        severity: "low",
        confidence: "low",
        evidence: { needs_review: needsReview },
        hypothesis:
          "Some error-like responses are ambiguous because the ledger stores bounded response summaries.",
        next_test:
          "Review representative chains manually; do not count this category as confirmed failure or waste.",
      });
    }
  }

  queue.sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
  const summary = {
    total: queue.length,
    confirmed: queue.filter((item) => item.status === "confirmed").length,
    candidate: queue.filter((item) => item.status === "candidate").length,
    needs_review: queue.filter((item) => item.status === "needs_review").length,
    unavailable: queue.filter((item) => item.status === "unavailable").length,
  };
  return {
    schema_version: "usage-diagnostics/v1",
    summary,
    queue,
    interpretation:
      "Priority is triage only. Proxies can identify candidates; they do not prove waste. Confirm a hypothesis with a comparable task before changing workflow, model, limits, or installed capabilities.",
  };
}

function buildBaseline({
  events = [],
  invalidLines = 0,
  files = 0,
  usageReport = null,
} = {}) {
  const prompts = events.filter((event) => event.event === "UserPromptSubmit");
  const tools = events.filter((event) => event.event === "PostToolUse");
  const toolsByPrompt = new Map();
  for (const tool of tools) {
    const key = tool.prompt_id || "__orphan__";
    const group = toolsByPrompt.get(key) || [];
    group.push(tool);
    toolsByPrompt.set(key, group);
  }

  const buckets = new Map();
  for (const prompt of prompts) {
    const taskClass = classifyPrompt(prompt.prompt);
    const bucket = buckets.get(taskClass) || emptyBucket(taskClass);
    const promptTools = toolsByPrompt.get(prompt.prompt_id) || [];
    const sampleDate = isValidDate(prompt.ts)
      ? new Date(prompt.ts).toISOString()
      : null;
    const errorCategories = promptTools
      .map((tool) => classifyError(tool, prompt.prompt))
      .filter(Boolean);

    bucket.sample_count += 1;
    bucket.prompt_events += 1;
    bucket.tool_events += promptTools.length;
    bucket.error_like_events += errorCategories.length;
    for (const category of errorCategories) {
      bucket.error_categories[category] += 1;
    }
    bucket.duration_ms.total += durationMs(promptTools);
    bucket.duration_ms.maximum_tool_ms =
      Math.max(
        bucket.duration_ms.maximum_tool_ms || 0,
        ...promptTools
          .map((tool) =>
            typeof tool.ms === "number" && tool.ms >= 0 ? tool.ms : 0,
          )
          .filter((ms) => ms > 0),
      ) || null;
    if (sampleDate) {
      bucket.first_sample_at = bucket.first_sample_at
        ? new Date(
            Math.min(
              Date.parse(bucket.first_sample_at),
              Date.parse(sampleDate),
            ),
          ).toISOString()
        : sampleDate;
      bucket.last_sample_at = bucket.last_sample_at
        ? new Date(
            Math.max(Date.parse(bucket.last_sample_at), Date.parse(sampleDate)),
          ).toISOString()
        : sampleDate;
    }
    buckets.set(taskClass, bucket);
  }

  for (const bucket of buckets.values()) {
    bucket.tool_calls_per_prompt = bucket.tool_events / bucket.prompt_events;
    bucket.error_like_rate = bucket.tool_events
      ? bucket.error_like_events / bucket.tool_events
      : null;
    bucket.duration_ms.average_per_prompt =
      bucket.duration_ms.total / bucket.prompt_events;
  }

  const dates = events
    .map((event) => event.ts)
    .filter(isValidDate)
    .map((value) => Date.parse(value));
  const sessions = new Set(
    events
      .map((event) => event.session)
      .filter((value) => typeof value === "string" && value),
  );

  const workflowAudit = buildWorkflowAudit(events);
  return {
    schema_version: "usage-baseline/v1",
    sources: {
      ledger: {
        type: "local-activity-ledger",
        files,
        invalid_lines: invalidLines,
        date_start: dates.length
          ? new Date(Math.min(...dates)).toISOString()
          : null,
        date_end: dates.length
          ? new Date(Math.max(...dates)).toISOString()
          : null,
        sessions: sessions.size,
        prompt_events: prompts.length,
        tool_events: tools.length,
      },
      usage_report: usageReport
        ? {
            type: usageReport.source?.type || "claude-usage-report",
            authority: usageReport.source?.authority || "user-provided",
            captured_at: usageReport.captured_at || null,
            plan_limits: usageReport.plan_limits || [],
            sessions: usageReport.sessions || [],
            local_activity: usageReport.local_activity || [],
            unknown_fields: usageReport.unknown_fields || [],
          }
        : {
            status: "unavailable",
            reason: "no --usage-report input was supplied",
          },
    },
    task_classes: [...buckets.values()].sort((a, b) =>
      a.task_class.localeCompare(b.task_class),
    ),
    workflow_audit: workflowAudit,
    diagnostics: buildDiagnostics({
      events,
      files,
      invalidLines,
      taskClasses: [...buckets.values()],
      workflowAudit,
    }),
    orphan_tool_events: toolsByPrompt.get("__orphan__")?.length || 0,
    limitations: [
      "Ledger metrics are activity proxies, not token accounting.",
      "The ledger does not capture correctness, user rework, model effort, or cache ratios.",
      "Task classes use exact slash/dollar command names; natural-language prompts remain unclassified.",
      "No prompt or tool payload is included in this output.",
    ],
  };
}

const COMPARISON_FIELDS = ["task_class", "repository", "model", "effort"];

function comparisonTaskClass(baseline, taskClass) {
  const classes = Array.isArray(baseline?.task_classes)
    ? baseline.task_classes
    : [];
  return (
    classes.find((item) => item?.task_class === taskClass) ||
    classes.find(
      (item) => item?.task_class === baseline?.comparison?.task_class,
    ) ||
    null
  );
}

function scalarMetric(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function usageReportMetric(report, sessionField) {
  const sessions = Array.isArray(report?.sessions) ? report.sessions : [];
  return scalarMetric(sessions[0]?.[sessionField]?.value);
}

function planLimitMetric(report) {
  const limits = Array.isArray(report?.plan_limits) ? report.plan_limits : [];
  return scalarMetric(limits[0]?.used_percent?.value);
}

function comparisonScorecard(baseline, intervention, taskClass) {
  const baseClass = comparisonTaskClass(baseline, taskClass);
  const interventionClass = comparisonTaskClass(intervention, taskClass);
  const delta = (selector) => {
    const before = scalarMetric(selector(baseClass));
    const after = scalarMetric(selector(interventionClass));
    return {
      baseline: before,
      intervention: after,
      delta: before !== null && after !== null ? after - before : null,
      status: before !== null && after !== null ? "observed" : "unavailable",
    };
  };
  const baselineReport = baseline?.sources?.usage_report;
  const interventionReport = intervention?.sources?.usage_report;
  const reportMetric = (field) => ({
    baseline: usageReportMetric(baselineReport, field),
    intervention: usageReportMetric(interventionReport, field),
    status:
      usageReportMetric(baselineReport, field) !== null &&
      usageReportMetric(interventionReport, field) !== null
        ? "observed"
        : "unavailable",
  });
  const limitBefore = planLimitMetric(baselineReport);
  const limitAfter = planLimitMetric(interventionReport);
  return {
    task_class: taskClass,
    tool_calls_per_prompt: delta((item) => item?.tool_calls_per_prompt),
    error_like_rate: delta((item) => item?.error_like_rate),
    duration_ms_per_prompt: delta(
      (item) => item?.duration_ms?.average_per_prompt,
    ),
    output_tokens: reportMetric("output_tokens"),
    cache_read_tokens: reportMetric("cache_read_tokens"),
    cache_write_tokens: reportMetric("cache_write_tokens"),
    plan_limit_used_percent: {
      baseline: limitBefore,
      intervention: limitAfter,
      delta:
        limitBefore !== null && limitAfter !== null
          ? limitAfter - limitBefore
          : null,
      status:
        limitBefore !== null && limitAfter !== null
          ? "observed"
          : "unavailable",
    },
  };
}

function qualityScorecard(baseline, intervention) {
  const before = baseline?.quality_outcome || {};
  const after = intervention?.quality_outcome || {};
  const fields = [
    "requested_behavior",
    "tests",
    "regressions",
    "unnecessary_changes",
    "user_rework",
  ];
  return Object.fromEntries(
    fields.map((field) => [
      field,
      {
        baseline: before[field] ?? null,
        intervention: after[field] ?? null,
        status:
          before[field] !== undefined && after[field] !== undefined
            ? "observed"
            : "unavailable",
      },
    ]),
  );
}

function compareBaselines(baseline, intervention) {
  if (
    baseline?.schema_version !== "usage-baseline/v1" ||
    intervention?.schema_version !== "usage-baseline/v1"
  ) {
    throw new Error("comparison requires usage-baseline/v1 inputs");
  }

  const baselineMeta = baseline.comparison || {};
  const interventionMeta = intervention.comparison || {};
  const fields = Object.fromEntries(
    COMPARISON_FIELDS.map((field) => [
      field,
      {
        baseline: baselineMeta[field] ?? null,
        intervention: interventionMeta[field] ?? null,
        status:
          baselineMeta[field] && interventionMeta[field]
            ? baselineMeta[field] === interventionMeta[field]
              ? "matched"
              : "mismatch"
            : "unavailable",
      },
    ]),
  );
  const comparable = COMPARISON_FIELDS.every(
    (field) => fields[field].status === "matched",
  );
  const taskClass =
    interventionMeta.task_class || baselineMeta.task_class || null;
  const quality = qualityScorecard(baseline, intervention);
  const qualityComplete = Object.values(quality).every(
    (item) => item.status === "observed",
  );
  const regression =
    quality.regressions.intervention !== null &&
    quality.regressions.intervention > 0;
  const failedVerification =
    quality.requested_behavior.intervention !== "pass" ||
    quality.tests.intervention !== "pass";
  const moreRework =
    quality.user_rework.baseline !== null &&
    quality.user_rework.intervention !== null &&
    quality.user_rework.intervention > quality.user_rework.baseline;
  const moreUnnecessaryChanges =
    quality.unnecessary_changes.baseline !== null &&
    quality.unnecessary_changes.intervention !== null &&
    quality.unnecessary_changes.intervention >
      quality.unnecessary_changes.baseline;
  const decision =
    !comparable || !qualityComplete
      ? "needs_review"
      : regression || failedVerification || moreRework || moreUnnecessaryChanges
        ? "revert_or_review"
        : "keep_intervention";

  return {
    schema_version: "usage-comparison/v1",
    comparability: {
      fields,
      status: comparable ? "comparable" : "not_comparable",
    },
    quality,
    metrics: comparisonScorecard(baseline, intervention, taskClass),
    decision,
    limitations: [
      "A comparison is not causal unless task, repository, model, and effort match.",
      "Missing quality outcomes keep the decision at needs_review.",
      "Unavailable token, cache, and plan-limit metrics are never treated as zero.",
      "Only selected aggregate metrics are emitted; prompt, input, and response payloads are excluded.",
    ],
  };
}

function argumentValue(args, flag) {
  const index = args.indexOf(flag);
  if (index === -1 || !args[index + 1] || args[index + 1].startsWith("--")) {
    return null;
  }
  return args[index + 1];
}

function help() {
  console.log(
    "Usage: node dev/scripts/usage-baseline.js [--ledger-dir <dir>] [--usage-report <report.txt>] | --compare <baseline.json> <intervention.json>",
  );
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    help();
    return;
  }

  const compareIndex = args.indexOf("--compare");
  if (compareIndex !== -1) {
    const baselinePath = args[compareIndex + 1];
    const interventionPath = args[compareIndex + 2];
    if (!baselinePath || !interventionPath) {
      throw new Error(
        "--compare requires baseline and intervention JSON paths",
      );
    }
    const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
    const intervention = JSON.parse(fs.readFileSync(interventionPath, "utf8"));
    console.log(
      JSON.stringify(compareBaselines(baseline, intervention), null, 2),
    );
    return;
  }

  const ledgerDir =
    argumentValue(args, "--ledger-dir") ||
    path.join(os.homedir(), ".claude", "base_project", "usage");
  const usagePath = argumentValue(args, "--usage-report");
  const usageReport = usagePath
    ? parseUsageReport(fs.readFileSync(usagePath, "utf8"))
    : null;
  const ledger = readLedger(ledgerDir);
  console.log(
    JSON.stringify(buildBaseline({ ...ledger, usageReport }), null, 2),
  );
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`usage baseline failed: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  buildDiagnostics,
  buildBaseline,
  buildWorkflowAudit,
  compareBaselines,
  classifyError,
  commandName,
  classifyPrompt,
  parseLedgerText,
  readLedger,
};
