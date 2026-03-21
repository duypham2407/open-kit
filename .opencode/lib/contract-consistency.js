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
  const workflowText = readTextIfExists(workflowPath)
  const schemaText = readTextIfExists(schemaPath)
  const surfacePaths = getManifestSurfacePaths(projectRoot, manifest)

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
