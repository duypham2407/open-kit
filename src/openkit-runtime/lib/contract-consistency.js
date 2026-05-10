import fs from "node:fs"
import path from "node:path"

import {
  ARTIFACT_KINDS,
  MODE_VALUES,
  MODE_STAGE_SEQUENCES,
  MODE_APPROVAL_GATES,
} from "./workflow-state-rules.js"

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
  const runtimeSurfacesPath = path.join(projectRoot, "context", "core", "runtime-surfaces.md")
  const workflowText = readTextIfExists(workflowPath)
  const schemaText = readTextIfExists(schemaPath)
  const sessionResumeText = readTextIfExists(sessionResumePath) ?? ""
  const runtimeSurfacesText = readTextIfExists(runtimeSurfacesPath) ?? ""
  const surfacePaths = getManifestSurfacePaths(projectRoot, manifest)
  const taskBoardContractText = [workflowText, sessionResumeText]
    .filter(Boolean)
    .join("\n")
  const compatibilityText = [schemaText].filter(Boolean).join("\n")

  const allStageNames = Object.values(MODE_STAGE_SEQUENCES).flat()
  const allApprovalGates = Object.values(MODE_APPROVAL_GATES).flat()

  const checks = [
    makeCheck("workflow contract doc found", Boolean(workflowText)),
    makeCheck("workflow schema doc found", Boolean(schemaText)),
    makeCheck("runtime surfaces doc found", Boolean(runtimeSurfacesText)),
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
      "workflow contract documents runtime mode enums",
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
      "workflow contract keeps migration lane free of task boards",
      includesAllTerms(taskBoardContractText, ["migration", "task", "board"]) &&
        matchesAnyPattern(taskBoardContractText, [
          /migration[^\n.]{0,120}(free of|without|must stay free of|must not carry|no) [^\n.]{0,80}task board/i,
          /task board[^\n.]{0,120}(not allowed|forbidden|disallowed|full[- ]delivery only)[^\n.]{0,80}migration/i,
          /migration[^\n.]{0,120}execution[- ]task[- ]board/i,
          /migration[^\n.]{0,120}task[- ]board/i,
        ]),
    ),
    makeCheck(
      "workflow contract states migration lane is for upgrades",
      includesAllTerms(workflowText, ["migration", "upgrade"]),
    ),
    makeCheck(
      "workflow contract states migration preserves behavior and decouples blockers first",
      includesAllTerms(workflowText, ["migration", "behavior"]) &&
        matchesAnyPattern(workflowText, [
          /preserve[^\n.]{0,80}behavior/i,
          /freeze[^\n.]{0,80}invariant/i,
          /decouple[^\n.]{0,120}blocker/i,
          /seam/i,
        ]),
    ),
    makeCheck(
      "workflow contract documents lane tie-breakers and examples",
      includesAllTerms(workflowText, ["lane", "tie breaker"]) && includesAllTerms(workflowText, ["decision", "matrix"]),
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
          /task boards? belong only to full[- ]delivery work items/i,
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
      "workflow schema documents routing profile fields",
      includesAllTerms(schemaText, ["routing_profile", "dominant_uncertainty", "behavior_delta"]),
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
    makeCheck(
      "runtime surfaces doc distinguishes product and compatibility doctor commands",
      includesAllTerms(runtimeSurfacesText, ["openkit doctor"]) &&
        includesAllTerms(runtimeSurfacesText, ["workflow-state.js doctor"]),
    ),
    makeCheck(
      "session resume guidance mentions resume-summary",
      includesAllTerms(sessionResumeText, ["resume-summary"]),
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
    { ok: 0, error: 0 },
  )

  return { checks, summary }
}

export {
  getContractConsistencyReport,
}
