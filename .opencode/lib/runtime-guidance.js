import { FULL_STAGE_SEQUENCE, MIGRATION_STAGE_SEQUENCE, QUICK_STAGE_SEQUENCE } from "./workflow-state-rules.js"

const EVIDENCE_RULES = {
  quick: {
    quick_test: {
      requiredKinds: ["manual", "runtime", "automated"],
      summary: "Test and verification evidence proving each acceptance point was checked by the Quick Agent.",
    },
  },
  migration: {
    migration_verify: {
      requiredKinds: ["manual", "runtime", "automated", "review"],
      summary: "Parity, compatibility, and regression evidence for the migration.",
    },
  },
  full: {
    full_qa: {
      requiredKinds: ["manual", "runtime", "automated", "review"],
      summary: "Implementation, QA, or requirements evidence supporting feature closure.",
    },
  },
}

const NEXT_ACTION_BY_STAGE = {
  quick_intake: "Initialize workflow state and advance to brainstorm.",
  quick_brainstorm: "Read the codebase deeply, clarify and align understanding, and obtain explicit user confirmation before any option analysis.",
  quick_plan: "Analyze the solution space, present 3 options by default (or explain why fewer), wait for user option selection, create the selected-option execution plan, and wait for separate explicit plan confirmation.",
  quick_implement: "Execute the plan step by step, staying within the agreed scope.",
  quick_test: "Run tests, verify acceptance points with real evidence, check regression, and approve quick_verified.",
  quick_done: "Summarize changes, evidence, and notes, then close the quick task.",
  migration_intake: "Freeze preserved behavior and confirm the migration scope.",
  migration_baseline: "Capture the baseline, preserved invariants, and compatibility risks.",
  migration_strategy: "Create the migration solution package, then define staged upgrade slices, rollback checkpoints, and any required seams or adapters.",
  migration_upgrade: "Execute the current migration slice while preserving baseline behavior.",
  migration_code_review: "Review the upgrade for preserved-invariant drift, unsafe rewrites, and undocumented behavior changes.",
  migration_verify: "Verify parity with baseline evidence, smoke checks, and compatibility validation.",
  migration_done: "Close the migration or queue follow-up cleanup after parity is proven.",
  full_intake: "Open the work item, record routing context, and dispatch the first active role.",
  full_product: "Create the scope package with the problem, scope, business rules, and acceptance expectations.",
  full_solution: "Create the solution package with the technical approach, sequencing, and validation strategy.",
  full_implementation: "Execute the approved solution package and keep task-board state honest.",
  full_code_review: "Check scope-package and solution-package compliance first, then code quality before QA begins.",
  full_qa: "Validate implementation, classify issues, and approve closure when the work is ready.",
  full_done: "Close the feature and reconcile any remaining task-board state.",
}

const ARTIFACT_RULES = {
  quick: [
    {
      id: "task_card",
      availableFrom: "quick_brainstorm",
      requiredFrom: null,
      recommendedFrom: "quick_plan",
      optional: true,
      summary: "Optional quick-task traceability card.",
    },
  ],
  migration: [
    {
      id: "solution_package",
      availableFrom: "migration_strategy",
      requiredFrom: "migration_strategy",
      recommendedFrom: "migration_strategy",
      optional: false,
      summary: "Primary migration solution package for baseline, strategy, and staged upgrade slices.",
    },
    {
      id: "migration_report",
      availableFrom: "migration_baseline",
      requiredFrom: null,
      recommendedFrom: "migration_strategy",
      optional: true,
      summary: "Single living migration artifact for baseline, execution, and verification notes.",
    },
  ],
  full: [
    {
      id: "scope_package",
      availableFrom: "full_product",
      requiredFrom: "full_product",
      recommendedFrom: "full_product",
      optional: false,
      summary: "Primary scope package for product intent, rules, and acceptance.",
    },
    {
      id: "solution_package",
      availableFrom: "full_solution",
      requiredFrom: "full_solution",
      recommendedFrom: "full_solution",
      optional: false,
      summary: "Primary solution package for technical direction, slices, and validation.",
    },
    {
      id: "qa_report",
      availableFrom: "full_qa",
      requiredFrom: "full_qa",
      recommendedFrom: "full_qa",
      optional: false,
      summary: "QA evidence and closure recommendation.",
    },
    {
      id: "adr",
      availableFrom: "full_solution",
      requiredFrom: null,
      recommendedFrom: "full_solution",
      optional: true,
      summary: "Optional architecture decision records.",
    },
  ],
}

// ---------------------------------------------------------------------------
// Tool evidence gates (Tier 2)
//
// Each entry maps a target stage to the tool-sourced evidence that MUST exist
// in state.verification_evidence before advanceStage allows the transition.
//
// The `requiredSources` array is an array of groups.  Each group is an array of
// acceptable `source` field values.  At least one evidence entry whose `source`
// matches each group must be present.
//
// When `fallbackManualAllowed` is true, a single entry with source "manual" and
// the special scope `tool-evidence-override:<target_stage>` satisfies the entire
// gate.  This exists so human operators can unblock the pipeline when a tool is
// genuinely unavailable.
//
// Terminal `*_done` stages are NOT gated here because the existing EVIDENCE_RULES
// and assertStageExitReadiness already enforce kind-based evidence requirements
// at those stages.
// ---------------------------------------------------------------------------
const TOOL_EVIDENCE_GATES = {
  quick: {},
  migration: {
    migration_code_review: {
      requiredSources: [["rule-scan", "tool.rule-scan", "codemod-preview", "tool.codemod-preview"]],
      fallbackManualAllowed: true,
      summary: "Migration upgrade must record a rule-scan or codemod-preview before entering code review.",
    },
  },
  full: {
    full_code_review: {
      requiredSources: [["rule-scan", "tool.rule-scan"]],
      fallbackManualAllowed: true,
      summary: "Fullstack must run rule-scan on changed files before entering code review.",
    },
    full_qa: {
      requiredSources: [
        ["rule-scan", "tool.rule-scan"],
        ["security-scan", "tool.security-scan"],
      ],
      fallbackManualAllowed: true,
      summary: "Code Reviewer must run rule-scan and security-scan before QA begins.",
    },
  },
}

const SCAN_TOOL_IDS = new Set(["tool.rule-scan", "tool.security-scan"])

function checkToolEvidenceGate(state, targetStage) {
  const gate = TOOL_EVIDENCE_GATES[state?.mode]?.[targetStage]
  if (!gate) {
    return { passed: true, missingGroups: [], blockers: [], summary: null, runtimePolicySatisfiedToolIds: [] }
  }

  const evidence = getVerificationEvidence(state)
  const blockers = []
  const runtimePolicySatisfiedToolIds = new Set()
  const manualOverrideToolIds = new Set()

  if (gate.fallbackManualAllowed) {
    const overrides = getManualOverrideEntries(evidence, targetStage)
    for (const override of overrides) {
      const validation = validateManualOverrideEntry(override, targetStage, evidence)
      if (validation.valid) {
        manualOverrideToolIds.add(validation.toolId)
        runtimePolicySatisfiedToolIds.add(validation.toolId)
      } else {
        blockers.push(...validation.blockers)
      }
    }
  }

  const missingGroups = []
  for (const sourceGroup of gate.requiredSources) {
    const groupToolIds = sourceGroup.map(canonicalToolId).filter(Boolean)
    const overrideSatisfied = groupToolIds.some((toolId) => manualOverrideToolIds.has(toolId))
    if (overrideSatisfied) {
      continue
    }

    const candidates = evidence.filter((entry) => entryMatchesSourceGroup(entry, sourceGroup))
    if (candidates.length === 0) {
      missingGroups.push(sourceGroup)
      continue
    }

    const latestStructuredScan = getLatestEvidenceEntry(candidates.filter((entry) => entryHasStructuredScanForSourceGroup(entry, sourceGroup)))
    if (latestStructuredScan) {
      const scanResult = evaluateStructuredScanEvidence(latestStructuredScan, targetStage, sourceGroup)
      if (scanResult.runtimePolicySatisfiedToolId) {
        runtimePolicySatisfiedToolIds.add(scanResult.runtimePolicySatisfiedToolId)
      }
      if (!scanResult.passed) {
        blockers.push(...scanResult.blockers)
      }
      continue
    }

    const latestMalformedStructuredScan = getLatestEvidenceEntry(candidates.filter((entry) => readScanEvidence(entry) && !entryMatchesNonScanSource(entry, sourceGroup)))
    if (latestMalformedStructuredScan) {
      const scanResult = evaluateStructuredScanEvidence(latestMalformedStructuredScan, targetStage, sourceGroup)
      blockers.push(...scanResult.blockers)
      continue
    }

    const latestNonScan = getLatestEvidenceEntry(candidates.filter((entry) => entryMatchesNonScanSource(entry, sourceGroup)))
    if (latestNonScan) {
      continue
    }

    const latestSourceOnlyScan = getLatestEvidenceEntry(candidates.filter((entry) => entryMatchesSourceOnlyScan(entry, sourceGroup)))
    if (latestSourceOnlyScan) {
      const toolId = canonicalToolId(latestSourceOnlyScan.source) ?? sourceGroup.map(canonicalToolId).find(isScanToolId) ?? "required scan tool"
      blockers.push(`required scan evidence for ${toolId} before ${targetStage} must include structured details.scan_evidence or a valid manual_override`)
      continue
    }

    missingGroups.push(sourceGroup)
  }

  return {
    passed: missingGroups.length === 0 && blockers.length === 0,
    missingGroups,
    blockers,
    summary: gate.summary,
    fallbackManualAllowed: gate.fallbackManualAllowed,
    runtimePolicySatisfiedToolIds: [...runtimePolicySatisfiedToolIds],
  }
}

function readObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {}
}

function readScanEvidence(entry) {
  const details = readObject(entry?.details)
  const scanEvidence = readObject(details.scan_evidence)
  return Object.keys(scanEvidence).length > 0 ? { details, scanEvidence } : null
}

function canonicalToolId(source) {
  switch (source) {
    case "rule-scan":
    case "tool.rule-scan":
      return "tool.rule-scan"
    case "security-scan":
    case "tool.security-scan":
      return "tool.security-scan"
    case "codemod-preview":
    case "tool.codemod-preview":
      return "tool.codemod-preview"
    default:
      return typeof source === "string" && source.startsWith("tool.") ? source : null
  }
}

function isScanToolId(toolId) {
  return SCAN_TOOL_IDS.has(toolId)
}

function getScanEvidenceToolId(entry) {
  const payload = readScanEvidence(entry)
  const toolId = payload?.scanEvidence?.direct_tool?.tool_id
  return typeof toolId === "string" ? toolId : null
}

function scanEvidenceTargetsSourceGroup(entry, sourceGroup) {
  const scanToolId = getScanEvidenceToolId(entry)
  return isScanToolId(scanToolId) && sourceGroupContainsToolId(sourceGroup, scanToolId)
}

function sourceGroupContainsToolId(sourceGroup, toolId) {
  return sourceGroup.some((source) => canonicalToolId(source) === toolId)
}

function sourceGroupToolLabel(sourceGroup) {
  return sourceGroup.map(canonicalToolId).filter(Boolean).join(" or ") || "required scan tool"
}

function readSubstituteToolId(substitute) {
  const candidate = substitute?.tool_id ?? substitute?.toolId ?? substitute?.substitute_tool_id ?? substitute?.substituteToolId ?? substitute?.command_or_tool
  return canonicalToolId(candidate)
}

function entryHasStructuredScanForSourceGroup(entry, sourceGroup) {
  return readScanEvidence(entry) && scanEvidenceTargetsSourceGroup(entry, sourceGroup)
}

function entryMatchesSourceOnlyScan(entry, sourceGroup) {
  const sourceToolId = canonicalToolId(entry?.source)
  return isScanToolId(sourceToolId) && sourceGroupContainsToolId(sourceGroup, sourceToolId) && !readScanEvidence(entry)
}

function entryMatchesNonScanSource(entry, sourceGroup) {
  if (!sourceGroup.includes(entry?.source)) {
    return false
  }

  return !isScanToolId(canonicalToolId(entry.source))
}

function entryMatchesSourceGroup(entry, sourceGroup) {
  if (sourceGroup.includes(entry.source)) {
    return true
  }

  return scanEvidenceTargetsSourceGroup(entry, sourceGroup)
}

function getManualOverrideEntries(evidence, targetStage) {
  const overrideScope = `tool-evidence-override:${targetStage}`
  return evidence.filter((entry) => entry.source === "manual" && entry.scope === overrideScope)
}

function getLatestEvidenceEntry(entries) {
  return [...entries].sort((left, right) => {
    const leftTime = Date.parse(left.recorded_at ?? "")
    const rightTime = Date.parse(right.recorded_at ?? "")
    if (Number.isNaN(leftTime) && Number.isNaN(rightTime)) return 0
    if (Number.isNaN(leftTime)) return 1
    if (Number.isNaN(rightTime)) return -1
    return rightTime - leftTime
  })[0]
}

function normalizeClassificationSummary(scanEvidence) {
  const triage = readObject(scanEvidence.triage_summary)
  const groups = Array.isArray(triage.groups) ? triage.groups : []
  return {
    groupCount: triage.groupCount ?? triage.group_count ?? groups.length,
    blockingCount: triage.blockingCount ?? triage.blocking_count ?? countGroupsByClassification(groups, "blocking") + countGroupsByClassification(groups, "true_positive"),
    nonBlockingNoiseCount: triage.nonBlockingNoiseCount ?? triage.non_blocking_noise_count ?? countGroupsByClassification(groups, "non_blocking_noise"),
    falsePositiveCount: triage.falsePositiveCount ?? triage.false_positive_count ?? countGroupsByClassification(groups, "false_positive"),
    followUpCount: triage.followUpCount ?? triage.follow_up_count ?? countGroupsByClassification(groups, "follow_up"),
    unclassifiedCount: triage.unclassifiedCount ?? triage.unclassified_count ?? countGroupsByClassification(groups, "unclassified"),
    groups,
  }
}

function countGroupsByClassification(groups, classification) {
  return groups.filter((group) => group.classification === classification).length
}

function normalizeFindingCounts(scanEvidence) {
  const counts = readObject(scanEvidence.finding_counts)
  return {
    ...counts,
    total: scanEvidence.finding_count ?? scanEvidence.findingCount ?? counts.total ?? 0,
  }
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0
}

function isResolvedGroup(group) {
  return ["resolved", "fixed", "closed", "remediated"].includes(String(group.resolution ?? group.status ?? "").toLowerCase())
}

function hasTraceability(group, entry) {
  return isNonEmptyString(group.trace_ref) ||
    isNonEmptyString(group.traceRef) ||
    (Array.isArray(group.sampleLocations) && group.sampleLocations.length > 0) ||
    (Array.isArray(entry.artifact_refs) && entry.artifact_refs.length > 0)
}

function findFalsePositiveItem(group, scanEvidence) {
  const summary = readObject(scanEvidence.false_positive_summary)
  const items = Array.isArray(summary.items)
    ? summary.items
    : Array.isArray(summary.false_positives)
      ? summary.false_positives
      : []
  return items.find((item) => {
    const rule = item.rule_id ?? item.ruleId ?? item.check_id ?? item.checkId
    return rule === group.ruleId || rule === group.rule_id || rule === group.checkId
  }) ?? null
}

function validateFalsePositiveItem(item) {
  const hasRule = isNonEmptyString(item?.rule_id) || isNonEmptyString(item?.ruleId) || isNonEmptyString(item?.check_id) || isNonEmptyString(item?.checkId)
  const hasFileOrArea = isNonEmptyString(item?.file) || isNonEmptyString(item?.area) || isNonEmptyString(item?.path)
  const hasImpact = isNonEmptyString(item?.security_impact) || isNonEmptyString(item?.impact)
  const hasFollowUp = isNonEmptyString(item?.follow_up) || isNonEmptyString(item?.followUp) || isNonEmptyString(item?.follow_up_decision) || isNonEmptyString(item?.followUpDecision)
  return hasRule && hasFileOrArea && isNonEmptyString(item?.context) && isNonEmptyString(item?.rationale) && hasImpact && hasFollowUp
}

function evaluateStructuredScanEvidence(entry, targetStage, sourceGroup = null) {
  const payload = readScanEvidence(entry)
  if (!payload) {
    const toolId = canonicalToolId(entry?.source) ?? entry?.source ?? "required scan tool"
    return {
      passed: false,
      blockers: [`required scan evidence for ${toolId} before ${targetStage} must include structured details.scan_evidence`],
      runtimePolicySatisfiedToolId: null,
    }
  }

  const { scanEvidence } = payload
  const blockers = []
  const directTool = readObject(scanEvidence.direct_tool)
  const substitute = scanEvidence.substitute === null ? null : readObject(scanEvidence.substitute)
  const toolId = directTool.tool_id
  const evidenceType = scanEvidence.evidence_type ?? "direct_tool"
  if (!isNonEmptyString(toolId)) {
    blockers.push(`scan evidence before ${targetStage} must identify tool.rule-scan or tool.security-scan in details.scan_evidence.direct_tool.tool_id`)
  }
  if (!["direct_tool", "substitute_scan", "manual_override"].includes(evidenceType)) {
    blockers.push(`scan evidence for ${toolId ?? "required scan tool"} has unsupported evidence_type '${evidenceType}' before ${targetStage}`)
  }
  if (!isScanToolId(toolId)) {
    blockers.push(`scan evidence before ${targetStage} must identify tool.rule-scan or tool.security-scan in details.scan_evidence.direct_tool.tool_id`)
  }
  const directAvailable = directTool.availability_state === "available"
  const directSucceeded = ["succeeded", "degraded"].includes(directTool.result_state)
  let runtimePolicySatisfiedToolId = null

  if (sourceGroup && isNonEmptyString(toolId) && !sourceGroupContainsToolId(sourceGroup, toolId)) {
    blockers.push(`scan evidence before ${targetStage} identifies ${toolId}, but the gate requires ${sourceGroupToolLabel(sourceGroup)}`)
  }

  if (evidenceType === "direct_tool" && (!directAvailable || !directSucceeded)) {
    blockers.push(`required scan evidence for ${toolId} did not run successfully for ${targetStage}`)
  }

  if (evidenceType === "substitute_scan") {
    const substituteToolId = readSubstituteToolId(substitute)
    if (sourceGroup && substituteToolId && !sourceGroupContainsToolId(sourceGroup, substituteToolId)) {
      blockers.push(`substitute scan evidence before ${targetStage} identifies ${substituteToolId}, but the gate requires ${sourceGroupToolLabel(sourceGroup)}`)
    }
    if (substitute?.ran !== true || !isNonEmptyString(substitute.command_or_tool) || !isNonEmptyString(substitute.limitations)) {
      blockers.push(`substitute scan evidence for ${toolId} is missing command/status limitations for ${targetStage}`)
    } else {
      runtimePolicySatisfiedToolId = toolId
    }
  }

  const findingCounts = normalizeFindingCounts(scanEvidence)
  const triage = normalizeClassificationSummary(scanEvidence)
  if (findingCounts.total > 0 && triage.groupCount === 0) {
    blockers.push(`scan findings for ${toolId} are missing grouped triage before ${targetStage}`)
  }
  if (triage.unclassifiedCount > 0 || triage.groups.some((group) => !group.classification || group.classification === "unclassified")) {
    blockers.push(`unclassified scan findings remain for ${toolId} before ${targetStage}`)
  }

  for (const group of triage.groups) {
    if ((group.classification === "blocking" || group.classification === "true_positive") && !isResolvedGroup(group)) {
      const securityLabel = scanEvidence.scan_kind === "security" || group.category === "security"
        ? " security"
        : ""
      blockers.push(`${group.classification.replace("_", "-")}${securityLabel} scan finding remains unresolved for ${group.ruleId ?? "unknown-rule"}`)
    }

    if (group.classification === "non_blocking_noise") {
      if (!isNonEmptyString(group.rationale)) {
        blockers.push(`non-blocking noise scan group for ${group.ruleId ?? "unknown-rule"} requires rationale`)
      }
      if (!hasTraceability(group, entry)) {
        blockers.push(`non-blocking noise scan group for ${group.ruleId ?? "unknown-rule"} requires traceability`)
      }
    }

    if (group.classification === "false_positive") {
      const item = findFalsePositiveItem(group, scanEvidence)
      if (!validateFalsePositiveItem(item)) {
        blockers.push(`false-positive scan finding for ${group.ruleId ?? "unknown-rule"} requires rule, file/area, context, rationale, security impact, and follow-up decision`)
      }
    }
  }

  return {
    passed: blockers.length === 0,
    blockers,
    runtimePolicySatisfiedToolId,
  }
}

function validateManualOverrideEntry(entry, targetStage, evidence) {
  const payload = readScanEvidence(entry)
  const baseMessage = `manual override for ${targetStage} must include target stage, unavailable tool, reason, substitute evidence/limitations, actor, and caveat`
  if (!payload || payload.scanEvidence.evidence_type !== "manual_override") {
    return { valid: false, toolId: null, blockers: [baseMessage] }
  }

  const { scanEvidence } = payload
  const directTool = readObject(scanEvidence.direct_tool)
  const manualOverride = readObject(scanEvidence.manual_override)
  const substituteEvidenceIdsPresent = Array.isArray(manualOverride.substitute_evidence_ids)
  const requiredFieldsPresent = manualOverride.target_stage === targetStage &&
    isNonEmptyString(manualOverride.unavailable_tool) &&
    isNonEmptyString(manualOverride.reason) &&
    substituteEvidenceIdsPresent &&
    isNonEmptyString(manualOverride.substitute_limitations) &&
    isNonEmptyString(manualOverride.actor) &&
    isNonEmptyString(manualOverride.caveat)

  if (!requiredFieldsPresent) {
    return { valid: false, toolId: manualOverride.unavailable_tool ?? directTool.tool_id ?? null, blockers: [baseMessage] }
  }

  const toolId = manualOverride.unavailable_tool
  if (directTool.availability_state === "available" && ["succeeded", "degraded"].includes(directTool.result_state)) {
    return {
      valid: false,
      toolId,
      blockers: [`manual override for ${targetStage} cannot be used while ${toolId} has available scan output; triage the available scan output instead`],
    }
  }

  const availableScanForSameTool = evidence.find((candidate) => {
    if (candidate === entry) return false
    const candidatePayload = readScanEvidence(candidate)
    if (!candidatePayload || candidatePayload.scanEvidence.evidence_type === "manual_override") return false
    const candidateDirectTool = readObject(candidatePayload.scanEvidence.direct_tool)
    return candidateDirectTool.tool_id === toolId &&
      candidateDirectTool.availability_state === "available" &&
      ["succeeded", "degraded"].includes(candidateDirectTool.result_state)
  })

  if (availableScanForSameTool) {
    const scanResult = evaluateStructuredScanEvidence(availableScanForSameTool, targetStage)
    if (!scanResult.passed) {
      return {
        valid: false,
        toolId,
        blockers: [`manual override for ${targetStage} cannot bypass available scan output for ${toolId}; triage noisy or blocking scan findings instead`],
      }
    }
  }

  return { valid: true, toolId, blockers: [] }
}

const DOD_RULES = {
  quick: {
    requiredArtifacts: [],
    requiredApprovals: ["quick_verified"],
    requiredEvidenceStages: ["quick_test"],
    summary: "Quick work is done when the Quick Agent provides real test evidence, quick_verified is approved, and no unresolved issues remain.",
  },
  migration: {
    requiredArtifacts: ["solution_package"],
    requiredApprovals: ["migration_verified"],
    requiredEvidenceStages: ["migration_verify"],
    summary: "Migration work is done when parity or compatibility evidence exists, migration approval is explicit, and unresolved issues are closed.",
  },
  full: {
    requiredArtifacts: ["scope_package", "solution_package", "qa_report"],
    requiredApprovals: ["product_to_solution", "solution_to_fullstack", "fullstack_to_code_review", "code_review_to_qa", "qa_to_done"],
    requiredEvidenceStages: ["full_qa"],
    summary: "Full delivery is done when required artifacts, approvals, QA evidence, and issue closure all exist together.",
  },
}

const SEQUENCES = {
  quick: QUICK_STAGE_SEQUENCE,
  migration: MIGRATION_STAGE_SEQUENCE,
  full: FULL_STAGE_SEQUENCE,
}

function stageIndex(mode, stage) {
  return (SEQUENCES[mode] ?? []).indexOf(stage)
}

function getArtifactValue(state, artifactId) {
  if (!state?.artifacts) {
    return null
  }

  if (artifactId === "adr") {
    return Array.isArray(state.artifacts.adr) && state.artifacts.adr.length > 0 ? state.artifacts.adr : null
  }

  return state.artifacts[artifactId] ?? null
}

function summarizeArtifactState(rule, state) {
  const currentIndex = stageIndex(state.mode, state.current_stage)
  const value = getArtifactValue(state, rule.id)
  const availableIndex = rule.availableFrom ? stageIndex(state.mode, rule.availableFrom) : -1
  const requiredIndex = rule.requiredFrom ? stageIndex(state.mode, rule.requiredFrom) : -1
  const recommendedIndex = rule.recommendedFrom ? stageIndex(state.mode, rule.recommendedFrom) : -1

  if (value) {
    return {
      artifact: rule.id,
      status: "present",
      summary: rule.summary,
      value,
    }
  }

  if (requiredIndex !== -1 && currentIndex >= requiredIndex) {
    return {
      artifact: rule.id,
      status: "missing-required",
      summary: rule.summary,
      value: null,
    }
  }

  if (recommendedIndex !== -1 && currentIndex >= recommendedIndex) {
    return {
      artifact: rule.id,
      status: "recommended-now",
      summary: rule.summary,
      value: null,
    }
  }

  if (availableIndex !== -1 && currentIndex >= availableIndex) {
    return {
      artifact: rule.id,
      status: "available-now",
      summary: rule.summary,
      value: null,
    }
  }

  return {
    artifact: rule.id,
    status: "not-yet-needed",
    summary: rule.summary,
    value: null,
  }
}

function getArtifactRulesForMode(mode) {
  return ARTIFACT_RULES[mode] ?? []
}

function getArtifactReadiness(state) {
  if (!state?.mode) {
    return []
  }

  return getArtifactRulesForMode(state.mode).map((rule) => summarizeArtifactState(rule, state))
}

function getParallelizationSummary(state) {
  return state?.parallelization ?? null
}

function summarizeArtifactReadinessLines(state) {
  return getArtifactReadiness(state).map((entry) => `${entry.artifact}: ${entry.status}`)
}

function getNextAction(state) {
  if (!state?.current_stage) {
    return null
  }

  return NEXT_ACTION_BY_STAGE[state.current_stage] ?? null
}

function flattenArtifactRefs(state) {
  if (!state?.artifacts) {
    return []
  }

  const refs = []
  for (const [artifact, value] of Object.entries(state.artifacts)) {
    if (artifact === "adr") {
      for (const entry of Array.isArray(value) ? value : []) {
        if (typeof entry === "string" && entry.length > 0) {
          refs.push({ artifact, path: entry })
        }
      }
      continue
    }

    if (typeof value === "string" && value.length > 0) {
      refs.push({ artifact, path: value })
    }
  }
  return refs
}

function getVerificationEvidence(state) {
  return Array.isArray(state?.verification_evidence) ? state.verification_evidence : []
}

function summarizeVerificationEvidence(state) {
  return getVerificationEvidence(state).map((entry) => {
    const label = `${entry.kind}:${entry.scope}`
    return entry.exit_status === null || entry.exit_status === undefined
      ? `${label}`
      : `${label}:${entry.exit_status}`
  })
}

function getEvidenceRequirement(state) {
  if (!state?.mode || !state?.current_stage) {
    return null
  }

  return EVIDENCE_RULES[state.mode]?.[state.current_stage] ?? null
}

function getVerificationReadiness(state) {
  const requirement = getEvidenceRequirement(state)
  const evidence = getVerificationEvidence(state)

  if (!requirement) {
    return {
      status: "not-required-yet",
      requiredKinds: [],
      evidenceCount: evidence.length,
      missingKinds: [],
      summary: "No explicit verification evidence requirement at the current stage.",
    }
  }

  const availableKinds = new Set(evidence.map((entry) => entry.kind))
  const missingKinds = requirement.requiredKinds.filter((kind) => !availableKinds.has(kind))

  return {
    status: missingKinds.length === 0 && evidence.length > 0 ? "ready" : "missing-evidence",
    requiredKinds: requirement.requiredKinds,
    evidenceCount: evidence.length,
    missingKinds,
    summary: requirement.summary,
  }
}

function summarizeVerificationReadinessLine(state) {
  const readiness = getVerificationReadiness(state)
  if (readiness.status === "not-required-yet") {
    return "verification: not-required-yet"
  }

  if (readiness.status === "ready") {
    return `verification: ready (${readiness.evidenceCount} evidence item${readiness.evidenceCount === 1 ? "" : "s"})`
  }

  return `verification: missing-evidence${readiness.missingKinds.length > 0 ? ` (${readiness.missingKinds.join(", ")})` : ""}`
}

function getIssueTelemetry(state) {
  const issues = Array.isArray(state?.issues) ? state.issues : []
  const openIssues = issues.filter((issue) => issue.current_status !== "closed" && issue.current_status !== "resolved")
  const repeatedIssues = issues.filter((issue) => (issue.repeat_count ?? 0) > 0)
  const staleIssues = issues.filter((issue) => typeof issue.blocked_since === "string" || (issue.reopen_count ?? 0) > 0)

  return {
    total: issues.length,
    open: openIssues.length,
    repeated: repeatedIssues.length,
    staleSignals: staleIssues.length,
  }
}

function getDodRule(mode) {
  return DOD_RULES[mode] ?? null
}

export {
  checkToolEvidenceGate,
  getDodRule,
  flattenArtifactRefs,
  getArtifactReadiness,
  getEvidenceRequirement,
  getIssueTelemetry,
  getNextAction,
  getParallelizationSummary,
  getVerificationEvidence,
  getVerificationReadiness,
  summarizeArtifactReadinessLines,
  summarizeVerificationEvidence,
  summarizeVerificationReadinessLine,
  TOOL_EVIDENCE_GATES,
}
