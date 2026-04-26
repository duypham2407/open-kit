// ---------------------------------------------------------------------------
// Tool Invocation Log (Tier 3)
//
// Records every tool execution in the runtime, persisted to disk so the
// policy engine can check whether required tools were actually invoked
// before allowing stage transitions.
//
// Log entries are written automatically by the tool-execution wrapper and
// are separate from verification_evidence.  Verification evidence is written
// by agents voluntarily; invocation log entries are written by the runtime
// and cannot be faked by agents.
//
// Storage: .opencode/work-items/<work_item_id>/tool-invocations.json
// Fallback for non-work-item contexts: .opencode/tool-invocations.json
// ---------------------------------------------------------------------------

import fs from "node:fs"
import path from "node:path"

const MAX_LOG_ENTRIES = 500

export function resolveLogPath(runtimeRoot, workItemId) {
  if (workItemId) {
    return path.join(runtimeRoot, ".opencode", "work-items", workItemId, "tool-invocations.json")
  }

  return path.join(runtimeRoot, ".opencode", "tool-invocations.json")
}

function readLog(logPath) {
  if (!fs.existsSync(logPath)) {
    return { entries: [] }
  }

  try {
    return JSON.parse(fs.readFileSync(logPath, "utf8"))
  } catch {
    return { entries: [] }
  }
}

function writeLog(logPath, log) {
  fs.mkdirSync(path.dirname(logPath), { recursive: true })
  fs.writeFileSync(logPath, `${JSON.stringify(log, null, 2)}\n`, "utf8")
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : []
}

function readObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {}
}

function summarizeError(result) {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return null
  }

  return result.message ?? result.reason ?? result.availability?.reason ?? result.error ?? null
}

function normalizeScanInvocationMetadata(result) {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return {}
  }

  const toolId = result.toolId ?? result.details?.scan_evidence?.direct_tool?.tool_id
  if (toolId !== "tool.rule-scan" && toolId !== "tool.security-scan") {
    return {}
  }

  const directTool = readObject(result.details?.scan_evidence?.direct_tool)
  const target = readObject(result.target)
  const findingCounts = readObject(result.details?.scan_evidence?.finding_counts)

  return {
    scan_kind: result.scanKind ?? result.details?.scan_evidence?.scan_kind ?? null,
    availability_state: result.availability?.state ?? result.capabilityState ?? directTool.availability_state ?? null,
    result_state: result.resultState ?? directTool.result_state ?? null,
    target_scope_summary: target.scopeSummary ?? result.details?.scan_evidence?.target_scope_summary ?? null,
    finding_counts: {
      ...findingCounts,
      total: result.findingCount ?? findingCounts.total ?? 0,
    },
    error_summary: summarizeError(result),
    artifact_refs: normalizeArray(result.artifactRefs ?? result.details?.scan_evidence?.artifact_refs),
    evidence_type: result.evidenceHint?.evidenceType ?? result.details?.scan_evidence?.evidence_type ?? "direct_tool",
  }
}

function createInvocationEntry({ toolId, status, durationMs = null, stage = null, owner = null, result = null, metadata = null }) {
  return {
    tool_id: toolId,
    status,
    stage: stage ?? null,
    owner: owner ?? null,
    duration_ms: durationMs ?? null,
    recorded_at: new Date().toISOString(),
    ...normalizeScanInvocationMetadata(result),
    ...(metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : {}),
  }
}

// ---------------------------------------------------------------------------
// In-memory invocation logger
//
// Created once per runtime session.  The `record` method is called by the
// tool-execution wrapper after every tool invocation.  The log is flushed
// to disk after each write so it survives crashes.
//
// The logger supports two modes:
//   1. Static: a fixed workItemId is provided at creation time (original API)
//   2. Dynamic: a `getWorkItemId` function is provided that resolves the
//      active work item at record time.  This allows the same logger to
//      write to per-work-item logs as the active work item changes during a
//      session, and ensures runtime invocations land in the correct
//      per-work-item log that the policy engine reads.
//
// When both `workItemId` and `getWorkItemId` are provided, `getWorkItemId`
// takes precedence.  When the getter returns null/undefined, the logger
// falls back to `workItemId` (or the global log if both are null).
// ---------------------------------------------------------------------------

export function createInvocationLogger({ runtimeRoot, workItemId = null, getWorkItemId = null } = {}) {
  if (!runtimeRoot) {
    return {
      record() {},
      getEntries() { return [] },
      getEntriesForTool() { return [] },
      getSuccessfulEntries() { return [] },
      hasSuccessfulInvocation() { return false },
      clear() {},
      logPath: null,
    }
  }

  // Resolve the effective log path.  When a dynamic getter is provided,
  // resolve at call time; otherwise use the static path.
  function resolveEffectiveLogPath() {
    const effectiveWorkItemId = typeof getWorkItemId === "function"
      ? (getWorkItemId() ?? workItemId)
      : workItemId
    return resolveLogPath(runtimeRoot, effectiveWorkItemId)
  }

  // Static logPath exposed for backward compatibility (reflects the
  // creation-time value; runtime recording uses resolveEffectiveLogPath).
  const staticLogPath = resolveLogPath(runtimeRoot, workItemId)

  return {
    record({ toolId, status, durationMs = null, stage = null, owner = null, result = null, metadata = null }) {
      const logPath = resolveEffectiveLogPath()

      const log = readLog(logPath)
      const entry = createInvocationEntry({ toolId, status, durationMs, stage, owner, result, metadata })
      log.entries.push(entry)

      // Trim oldest entries when over the cap
      if (log.entries.length > MAX_LOG_ENTRIES) {
        log.entries = log.entries.slice(log.entries.length - MAX_LOG_ENTRIES)
      }

      writeLog(logPath, log)
    },

    getEntries() {
      const logPath = resolveEffectiveLogPath()
      return readLog(logPath).entries
    },

    getEntriesForTool(toolId) {
      return this.getEntries().filter((entry) => entry.tool_id === toolId)
    },

    getSuccessfulEntries() {
      return this.getEntries().filter((entry) => entry.status === "success")
    },

    hasSuccessfulInvocation(toolId) {
      return this.getEntries().some(
        (entry) => entry.tool_id === toolId && entry.status === "success",
      )
    },

    clear() {
      const logPath = resolveEffectiveLogPath()
      if (fs.existsSync(logPath)) {
        writeLog(logPath, { entries: [] })
      }
    },

    get logPath() {
      return resolveEffectiveLogPath()
    },

    // Expose static path for tests that need the creation-time value
    staticLogPath,
  }
}

// ---------------------------------------------------------------------------
// Static query helpers for reading the log from the workflow-state-controller
// side (CJS, no runtime session).
// ---------------------------------------------------------------------------

export function readInvocationLog(runtimeRoot, workItemId) {
  const logPath = resolveLogPath(runtimeRoot, workItemId)
  return readLog(logPath).entries
}

export function hasSuccessfulToolInvocation(runtimeRoot, workItemId, toolId) {
  return readInvocationLog(runtimeRoot, workItemId).some(
    (entry) => entry.tool_id === toolId && entry.status === "success",
  )
}
