const fs = require("fs")
const path = require("path")

const {
  ARTIFACT_KINDS,
  MODE_VALUES,
  QUICK_STAGE_SEQUENCE,
  FULL_STAGE_SEQUENCE,
  MODE_APPROVAL_GATES,
} = require("./workflow-state-rules")

function listExistingMarkdownLiterals(markdown, values) {
  return values.filter((value) => markdown.includes(`\`${value}\``))
}

function matchesAnyPattern(text, patterns) {
  return patterns.some((pattern) => pattern.test(text))
}

function normalizeText(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ")
}

function includesAllTerms(text, terms) {
  const normalized = normalizeText(text)
  return terms.every((term) => normalized.includes(normalizeText(term).trim()))
}

function readTextIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null
  }

  return fs.readFileSync(filePath, "utf8")
}

function getManifestSurfacePaths(projectRoot, manifest) {
  const agents = manifest?.agents ?? {}
  const commands = manifest?.commands ?? {}

  return {
    primaryAgentPath: agents.primary ? path.resolve(projectRoot, agents.primary) : null,
    teamRolePaths: (agents.teamRoles ?? []).map((entry) => path.resolve(projectRoot, entry)),
    commandPaths: (commands.available ?? []).map((entry) => path.resolve(projectRoot, entry)),
  }
}

function makeCheck(label, ok) {
  return { label, ok }
}

function getContractConsistencyReport({ projectRoot, manifest }) {
  const workflowPath = path.join(projectRoot, "context", "core", "workflow.md")
  const schemaPath = path.join(projectRoot, "context", "core", "workflow-state-schema.md")
  const sessionResumePath = path.join(projectRoot, "context", "core", "session-resume.md")
  const fullDeliverySpecPath = path.join(
    projectRoot,
    "docs",
    "specs",
    "2026-03-21-openkit-full-delivery-multi-task-runtime.md",
  )
  const fullDeliveryPlanPath = path.join(
    projectRoot,
    "docs",
    "plans",
    "2026-03-21-openkit-full-delivery-multi-task-runtime.md",
  )
  const workflowText = readTextIfExists(workflowPath)
  const schemaText = readTextIfExists(schemaPath)
  const sessionResumeText = readTextIfExists(sessionResumePath) ?? ""
  const fullDeliverySpecText = readTextIfExists(fullDeliverySpecPath) ?? ""
  const fullDeliveryPlanText = readTextIfExists(fullDeliveryPlanPath) ?? ""
  const surfacePaths = getManifestSurfacePaths(projectRoot, manifest)
  const taskBoardContractText = [workflowText, sessionResumeText, fullDeliverySpecText, fullDeliveryPlanText]
    .filter(Boolean)
    .join("\n")
  const compatibilityText = [schemaText, fullDeliverySpecText, fullDeliveryPlanText].filter(Boolean).join("\n")

  const allStageNames = [...QUICK_STAGE_SEQUENCE, ...FULL_STAGE_SEQUENCE]
  const allApprovalGates = [...MODE_APPROVAL_GATES.quick, ...MODE_APPROVAL_GATES.full]

  const checks = [
    makeCheck("workflow contract doc found", Boolean(workflowText)),
    makeCheck("workflow schema doc found", Boolean(schemaText)),
    makeCheck(
      "declared primary agent exists",
      !surfacePaths.primaryAgentPath || fs.existsSync(surfacePaths.primaryAgentPath),
    ),
    makeCheck(
      "declared team role files exist",
      surfacePaths.teamRolePaths.every((entry) => fs.existsSync(entry)),
    ),
    makeCheck(
      "declared command files exist",
      surfacePaths.commandPaths.every((entry) => fs.existsSync(entry)),
    ),
  ]

  if (!workflowText || !schemaText) {
    return summarizeChecks(checks)
  }

  checks.push(
    makeCheck(
      "workflow contract keeps two runtime modes",
      MODE_VALUES.every((value) => workflowText.includes(`\`${value}\``)),
    ),
    makeCheck(
      "workflow contract states Quick Task+ is not a third lane",
      /`?Quick Task\+`?/i.test(workflowText) &&
        matchesAnyPattern(workflowText, [
          /not a third lane/i,
          /not a third operating mode/i,
          /not a third mode/i,
        ]),
    ),
    makeCheck(
      "workflow contract keeps quick lane free of task boards",
      includesAllTerms(taskBoardContractText, ["quick", "task", "board"]) &&
        matchesAnyPattern(taskBoardContractText, [
          /quick[^\n.]{0,120}(free of|without|must stay free of|must not carry|no) [^\n.]{0,80}task board/i,
          /task board[^\n.]{0,120}(not allowed|forbidden|disallowed|full[- ]delivery only)[^\n.]{0,80}quick/i,
          /quick[^\n.]{0,120}execution[- ]task[- ]board/i,
          /do not invent a quick task board/i,
        ]),
    ),
    makeCheck(
      "workflow contract states full delivery owns execution task boards",
      includesAllTerms(taskBoardContractText, ["full", "task", "board"]) &&
        matchesAnyPattern(taskBoardContractText, [
          /(full delivery|full mode|full work)[^\n.]{0,120}(owns|uses|carries|gains|has|contains|belong)[^\n.]{0,80}task board/i,
          /task board[^\n.]{0,120}(full delivery|full mode|full work)[^\n.]{0,80}(only|owns|belong)/i,
          /execution task boards? belong only to full delivery/i,
          /only `?full delivery`? work items gain an execution[- ]task board/i,
        ]),
    ),
    makeCheck(
      "workflow schema matches runtime mode enums",
      listExistingMarkdownLiterals(schemaText, MODE_VALUES).length === MODE_VALUES.length,
    ),
    makeCheck(
      "workflow schema matches runtime stage sequences",
      listExistingMarkdownLiterals(schemaText, allStageNames).length === allStageNames.length,
    ),
    makeCheck(
      "workflow schema matches runtime artifact slots",
      listExistingMarkdownLiterals(schemaText, ARTIFACT_KINDS).length === ARTIFACT_KINDS.length,
    ),
    makeCheck(
      "workflow schema matches runtime approval keys",
      listExistingMarkdownLiterals(schemaText, allApprovalGates).length === allApprovalGates.length,
    ),
    makeCheck(
      "workflow schema documents compatibility mirror behavior",
      includesAllTerms(compatibilityText, ["work item"]) &&
        matchesAnyPattern(compatibilityText, [
          /(compatibility|mirrored|mirror)[^\n.]{0,120}(state file|workflow state|repo root)/i,
          /(state file|workflow state|repo root)[^\n.]{0,120}(compatibility|mirrored|mirror)/i,
          /mirrored compatibility surface/i,
          /compatibility mirror/i,
          /compatibility rule/i,
        ]),
    ),
  )

  return summarizeChecks(checks)
}

function summarizeChecks(checks) {
  const summary = checks.reduce(
    (counts, check) => {
      if (check.ok) {
        counts.ok += 1
      } else {
        counts.error += 1
      }
      return counts
    },
    { ok: 0, warn: 0, error: 0 },
  )

  return { checks, summary }
}

module.exports = {
  getContractConsistencyReport,
}
