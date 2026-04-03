// ---------------------------------------------------------------------------
// Runtime Policy Engine (Tier 3)
//
// Checks tool invocation records from the invocation log before allowing
// stage transitions.  Unlike Tier 2 (which checks agent-written evidence),
// this layer checks runtime-recorded invocation entries that agents cannot
// forge.
//
// The policy engine is additive to Tier 2 — both layers must pass.
//
// Enforcement mode:
//   "enforce"  — block the transition (default)
//   "warn"     — allow the transition but return warnings
//   "off"      — skip the policy check entirely
//
// The enforcement mode is read from the workflow state field
// `policy_enforcement` (string), defaulting to "enforce".
// ---------------------------------------------------------------------------

import { readInvocationLog } from "./invocation-log.js"

// ---------------------------------------------------------------------------
// Policy definitions
//
// Each policy maps a target stage to the tool invocations that MUST have
// succeeded before the transition is allowed.
//
// `requiredTools` is an array of groups.  Each group is an array of tool IDs
// that satisfy that requirement (OR semantics within a group).  All groups
// must be satisfied (AND across groups).
// ---------------------------------------------------------------------------

const TOOL_INVOCATION_POLICIES = {
  quick: {},
  migration: {
    migration_code_review: {
      requiredTools: [["tool.rule-scan", "tool.codemod-preview"]],
      summary: "The runtime must have recorded a successful rule-scan or codemod-preview invocation before entering migration code review.",
    },
  },
  full: {
    full_code_review: {
      requiredTools: [["tool.rule-scan"]],
      summary: "The runtime must have recorded a successful rule-scan invocation before entering code review.",
    },
    full_qa: {
      requiredTools: [
        ["tool.rule-scan"],
        ["tool.security-scan"],
      ],
      summary: "The runtime must have recorded successful rule-scan and security-scan invocations before entering QA.",
    },
  },
}

// ---------------------------------------------------------------------------
// Policy check
// ---------------------------------------------------------------------------

function checkPolicy({ mode, targetStage, runtimeRoot, workItemId }) {
  const policy = TOOL_INVOCATION_POLICIES[mode]?.[targetStage]
  if (!policy) {
    return { passed: true, violations: [], summary: null }
  }

  const entries = readInvocationLog(runtimeRoot, workItemId)
  const successfulToolIds = new Set(
    entries
      .filter((entry) => entry.status === "success")
      .map((entry) => entry.tool_id),
  )

  const violations = []
  for (const toolGroup of policy.requiredTools) {
    const satisfied = toolGroup.some((toolId) => successfulToolIds.has(toolId))
    if (!satisfied) {
      violations.push({
        requiredTools: toolGroup,
        message: `No successful invocation of [${toolGroup.join(" or ")}] found in the runtime invocation log.`,
      })
    }
  }

  return {
    passed: violations.length === 0,
    violations,
    summary: policy.summary,
  }
}

// ---------------------------------------------------------------------------
// Enforcement wrapper
//
// Returns { allowed, mode, violations, warnings } where:
//   - allowed: whether the transition should proceed
//   - mode: the enforcement mode used
//   - violations: blocking policy failures (only when mode is "enforce")
//   - warnings: non-blocking policy failures (only when mode is "warn")
// ---------------------------------------------------------------------------

function enforcePolicy({ mode, targetStage, runtimeRoot, workItemId, enforcementMode = "enforce" }) {
  if (enforcementMode === "off") {
    return { allowed: true, mode: "off", violations: [], warnings: [] }
  }

  const result = checkPolicy({ mode, targetStage, runtimeRoot, workItemId })

  if (result.passed) {
    return { allowed: true, mode: enforcementMode, violations: [], warnings: [] }
  }

  if (enforcementMode === "warn") {
    return {
      allowed: true,
      mode: "warn",
      violations: [],
      warnings: result.violations,
    }
  }

  // enforce mode
  return {
    allowed: false,
    mode: "enforce",
    violations: result.violations,
    warnings: [],
  }
}

// ---------------------------------------------------------------------------
// Summarize all policies for diagnostic/trace output
// ---------------------------------------------------------------------------

function listPolicies() {
  const policies = []
  for (const [mode, stages] of Object.entries(TOOL_INVOCATION_POLICIES)) {
    for (const [stage, policy] of Object.entries(stages)) {
      policies.push({
        mode,
        stage,
        requiredTools: policy.requiredTools,
        summary: policy.summary,
      })
    }
  }

  return policies
}

export {
  TOOL_INVOCATION_POLICIES,
  checkPolicy,
  enforcePolicy,
  listPolicies,
}
