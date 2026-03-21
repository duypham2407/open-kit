const fs = require("fs")
const path = require("path")

const {
  ARTIFACT_KINDS,
  ESCALATION_RETRY_THRESHOLD,
  ISSUE_SEVERITIES,
  ISSUE_TYPES,
  MODE_VALUES,
  RECOMMENDED_OWNERS,
  ROOTED_IN_VALUES,
  STAGE_OWNERS,
  STAGE_SEQUENCE,
  STATUS_VALUES,
  createEmptyApprovals,
  createEmptyArtifacts,
  getApprovalGatesForMode,
  getInitialStageForMode,
  getModeForStage,
  getNextStage,
  getReworkRoute,
  getTransitionGate,
} = require("./workflow-state-rules")

function fail(message) {
  const error = new Error(message)
  error.isWorkflowStateError = true
  throw error
}

function resolveStatePath(customStatePath) {
  if (customStatePath) {
    return path.resolve(customStatePath)
  }

  if (process.env.OPENKIT_WORKFLOW_STATE) {
    return path.resolve(process.env.OPENKIT_WORKFLOW_STATE)
  }

  return path.resolve(process.cwd(), ".opencode/workflow-state.json")
}

function timestamp() {
  return new Date().toISOString()
}

function readState(customStatePath) {
  const statePath = resolveStatePath(customStatePath)

  let raw
  try {
    raw = fs.readFileSync(statePath, "utf8")
  } catch (error) {
    fail(`Unable to read workflow state file at '${statePath}': ${error.message}`)
  }

  try {
    return {
      statePath,
      state: JSON.parse(raw),
    }
  } catch (error) {
    fail(`Malformed workflow state JSON at '${statePath}': ${error.message}`)
  }
}

function writeState(statePath, state) {
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8")
}

function resolveProjectRoot(customStatePath) {
  const statePath = resolveStatePath(customStatePath)
  return path.dirname(path.dirname(statePath))
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"))
  } catch (error) {
    fail(`Malformed JSON at '${filePath}': ${error.message}`)
  }
}

function getManifestPaths(projectRoot, manifest) {
  const kit = manifest?.kit ?? {}
  const registryPath = kit.registry?.path
    ? path.resolve(projectRoot, kit.registry.path)
    : path.join(projectRoot, "registry.json")
  const installManifestPath = kit.installManifest?.path
    ? path.resolve(projectRoot, kit.installManifest.path)
    : path.join(projectRoot, ".opencode", "install-manifest.json")

  return {
    registryPath,
    installManifestPath,
  }
}

function tryReadJson(filePath) {
  if (!fs.existsSync(filePath)) {
    return { exists: false, readable: false, data: null }
  }

  try {
    return {
      exists: true,
      readable: true,
      data: JSON.parse(fs.readFileSync(filePath, "utf8")),
    }
  } catch (_error) {
    return {
      exists: true,
      readable: false,
      data: null,
    }
  }
}

function getRegistry(customStatePath) {
  const projectRoot = resolveProjectRoot(customStatePath)
  const manifestPath = path.join(projectRoot, ".opencode", "opencode.json")
  const manifest = readJsonIfExists(manifestPath)
  const { registryPath } = getManifestPaths(projectRoot, manifest)
  const registry = readJsonIfExists(registryPath)

  if (!registry) {
    fail(`Unable to read registry metadata at '${registryPath}'`)
  }

  return {
    projectRoot,
    manifestPath,
    registryPath,
    manifest,
    registry,
  }
}

function getInstallManifest(customStatePath) {
  const projectRoot = resolveProjectRoot(customStatePath)
  const manifestPath = path.join(projectRoot, ".opencode", "opencode.json")
  const manifest = readJsonIfExists(manifestPath)
  const { installManifestPath } = getManifestPaths(projectRoot, manifest)
  const installManifest = readJsonIfExists(installManifestPath)

  if (!installManifest) {
    fail(`Unable to read install manifest at '${installManifestPath}'`)
  }

  return {
    projectRoot,
    manifestPath,
    installManifestPath,
    manifest,
    installManifest,
  }
}

function listProfiles(customStatePath) {
  const { registry } = getRegistry(customStatePath)
  return registry.profiles ?? []
}

function getProfile(profileName, customStatePath) {
  ensureString(profileName, "profile name")
  const { registry } = getRegistry(customStatePath)
  const profiles = registry.profiles ?? []
  const profile = profiles.find((entry) => entry.name === profileName)

  if (!profile) {
    fail(`Unknown profile '${profileName}'`)
  }

  return profile
}

function syncInstallManifest(profileName, customStatePath) {
  const profile = getProfile(profileName, customStatePath)
  const { installManifestPath, installManifest } = getInstallManifest(customStatePath)

  const nextManifest = JSON.parse(JSON.stringify(installManifest))
  nextManifest.installation = nextManifest.installation ?? {}
  nextManifest.installation.activeProfile = profile.name
  writeState(installManifestPath, nextManifest)

  return {
    installManifestPath,
    installManifest: nextManifest,
    profile,
  }
}

function ensureObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label} must be an object`)
  }
}

function ensureArray(value, label) {
  if (!Array.isArray(value)) {
    fail(`${label} must be an array`)
  }
}

function ensureString(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    fail(`${label} must be a non-empty string`)
  }
}

function ensureNullableString(value, label) {
  if (value !== null && typeof value !== "string") {
    fail(`${label} must be a string or null`)
  }
}

function ensureKnown(value, allowedValues, label) {
  if (!allowedValues.includes(value)) {
    fail(`${label} must be one of: ${allowedValues.join(", ")}`)
  }
}

function ensureGateShape(gateName, gateValue) {
  ensureObject(gateValue, `approvals.${gateName}`)
  for (const key of ["status", "approved_by", "approved_at", "notes"]) {
    if (!(key in gateValue)) {
      fail(`approvals.${gateName}.${key} is required`)
    }
  }

  ensureKnown(gateValue.status, ["pending", "approved", "rejected"], `approvals.${gateName}.status`)
  ensureNullableString(gateValue.approved_by, `approvals.${gateName}.approved_by`)
  ensureNullableString(gateValue.approved_at, `approvals.${gateName}.approved_at`)
  ensureNullableString(gateValue.notes, `approvals.${gateName}.notes`)
}

function ensureIssueShape(issue, index) {
  ensureObject(issue, `issues[${index}]`)

  for (const key of [
    "issue_id",
    "title",
    "type",
    "severity",
    "rooted_in",
    "recommended_owner",
    "evidence",
    "artifact_refs",
  ]) {
    if (!(key in issue)) {
      fail(`issues[${index}].${key} is required`)
    }
  }

  ensureString(issue.issue_id, `issues[${index}].issue_id`)
  ensureString(issue.title, `issues[${index}].title`)
  ensureKnown(issue.type, ISSUE_TYPES, `issues[${index}].type`)
  ensureKnown(issue.severity, ISSUE_SEVERITIES, `issues[${index}].severity`)
  ensureKnown(issue.rooted_in, ROOTED_IN_VALUES, `issues[${index}].rooted_in`)
  ensureString(issue.recommended_owner, `issues[${index}].recommended_owner`)
  ensureString(issue.evidence, `issues[${index}].evidence`)

  const allowedOwners = RECOMMENDED_OWNERS[issue.type] ?? []
  if (!allowedOwners.includes(issue.recommended_owner)) {
    fail(`issues[${index}].recommended_owner must be one of: ${allowedOwners.join(", ")}`)
  }

  if (typeof issue.artifact_refs === "string") {
    issue.artifact_refs = [issue.artifact_refs]
  }

  ensureArray(issue.artifact_refs, `issues[${index}].artifact_refs`)
}

function validateArtifacts(artifacts) {
  ensureObject(artifacts, "artifacts")
  for (const key of ["task_card", "brief", "spec", "architecture", "plan", "qa_report", "adr"]) {
    if (!(key in artifacts)) {
      fail(`artifacts.${key} is required`)
    }
  }

  ensureNullableString(artifacts.task_card, "artifacts.task_card")
  ensureNullableString(artifacts.brief, "artifacts.brief")
  ensureNullableString(artifacts.spec, "artifacts.spec")
  ensureNullableString(artifacts.architecture, "artifacts.architecture")
  ensureNullableString(artifacts.plan, "artifacts.plan")
  ensureNullableString(artifacts.qa_report, "artifacts.qa_report")
  ensureArray(artifacts.adr, "artifacts.adr")
}

function validateApprovals(mode, approvals) {
  ensureObject(approvals, "approvals")

  const requiredGates = getApprovalGatesForMode(mode)
  const approvalKeys = Object.keys(approvals)

  for (const gate of requiredGates) {
    if (!(gate in approvals)) {
      fail(`approvals.${gate} is required for mode '${mode}'`)
    }
    ensureGateShape(gate, approvals[gate])
  }

  for (const gate of approvalKeys) {
    if (!requiredGates.includes(gate)) {
      fail(`approvals.${gate} is not valid for mode '${mode}'`)
    }
  }
}

function validateStateObject(state, options = {}) {
  ensureObject(state, "workflow state")

  for (const key of [
    "feature_id",
    "feature_slug",
    "mode",
    "mode_reason",
    "current_stage",
    "status",
    "current_owner",
    "artifacts",
    "approvals",
    "issues",
    "retry_count",
    "escalated_from",
    "escalation_reason",
    "updated_at",
  ]) {
    if (!(key in state)) {
      fail(`${key} is required`)
    }
  }

  if (state.feature_id !== null) {
    ensureString(state.feature_id, "feature_id")
  }

  if (state.feature_slug !== null) {
    ensureString(state.feature_slug, "feature_slug")
  }

  ensureKnown(state.mode, MODE_VALUES, "mode")
  ensureString(state.mode_reason, "mode_reason")
  ensureKnown(state.current_stage, STAGE_SEQUENCE, "current_stage")
  ensureKnown(state.status, STATUS_VALUES, "status")

  const stageMode = getModeForStage(state.current_stage)
  if (stageMode !== state.mode) {
    fail(`current_stage '${state.current_stage}' does not belong to mode '${state.mode}'`)
  }

  if (options.strictOwner !== false) {
    const expectedOwner = STAGE_OWNERS[state.current_stage]
    if (state.current_owner !== expectedOwner) {
      fail(`current_owner must be '${expectedOwner}' for stage '${state.current_stage}'`)
    }
  }

  validateArtifacts(state.artifacts)
  validateApprovals(state.mode, state.approvals)

  ensureArray(state.issues, "issues")
  state.issues.forEach((issue, index) => ensureIssueShape(issue, index))

  if (typeof state.retry_count !== "number" || Number.isNaN(state.retry_count) || state.retry_count < 0) {
    fail("retry_count must be a non-negative number")
  }

  if (state.escalated_from !== null) {
    ensureKnown(state.escalated_from, ["quick"], "escalated_from")
  }

  ensureNullableString(state.escalation_reason, "escalation_reason")
  ensureNullableString(state.updated_at, "updated_at")

  if (state.escalated_from === null && state.escalation_reason !== null) {
    fail("escalation_reason must be null when escalated_from is null")
  }

  if (state.escalated_from === "quick" && state.mode !== "full") {
    fail("mode must be 'full' when escalated_from is 'quick'")
  }

  return state
}

function mutate(customStatePath, mutator) {
  const { statePath, state } = readState(customStatePath)
  validateStateObject(state)
  const nextState = mutator(JSON.parse(JSON.stringify(state)))
  nextState.updated_at = timestamp()
  validateStateObject(nextState)
  writeState(statePath, nextState)
  return { statePath, state: nextState }
}

function showState(customStatePath) {
  const { statePath, state } = readState(customStatePath)
  validateStateObject(state)
  return { statePath, state }
}

function getRuntimeStatus(customStatePath) {
  const { statePath, state } = readState(customStatePath)
  validateStateObject(state)

  const projectRoot = resolveProjectRoot(customStatePath)
  const manifestPath = path.join(projectRoot, ".opencode", "opencode.json")
  const manifest = readJsonIfExists(manifestPath)
  const { registryPath, installManifestPath } = getManifestPaths(projectRoot, manifest)
  const installManifest = readJsonIfExists(installManifestPath)
  const hooksConfigPath = path.join(projectRoot, "hooks", "hooks.json")
  const sessionStartPath = path.join(projectRoot, "hooks", "session-start")
  const metaSkillPath = path.join(projectRoot, "skills", "using-skills", "SKILL.md")
  const kit = manifest?.kit ?? {}

  return {
    projectRoot,
    statePath,
    manifestPath,
    registryPath,
    installManifestPath,
    hooksConfigPath,
    sessionStartPath,
    metaSkillPath,
    kitName: kit.name ?? "Unknown kit",
    kitVersion: kit.version ?? "unknown",
    entryAgent: kit.entryAgent ?? "unknown",
    activeProfile: installManifest?.installation?.activeProfile ?? kit.activeProfile ?? "unknown",
    installManifest,
    state,
  }
}

function getVersionInfo(customStatePath) {
  const runtime = getRuntimeStatus(customStatePath)
  return {
    kitName: runtime.kitName,
    kitVersion: runtime.kitVersion,
    activeProfile: runtime.activeProfile,
  }
}

function runDoctor(customStatePath) {
  const statePath = resolveStatePath(customStatePath)
  const projectRoot = resolveProjectRoot(customStatePath)
  const manifestPath = path.join(projectRoot, ".opencode", "opencode.json")
  const manifestInfo = tryReadJson(manifestPath)
  const manifest = manifestInfo.data
  const { registryPath, installManifestPath } = getManifestPaths(projectRoot, manifest)
  const registryInfo = tryReadJson(registryPath)
  const installManifestInfo = tryReadJson(installManifestPath)
  const installManifest = installManifestInfo.data
  const hooksConfigPath = path.join(projectRoot, "hooks", "hooks.json")
  const sessionStartPath = path.join(projectRoot, "hooks", "session-start")
  const metaSkillPath = path.join(projectRoot, "skills", "using-skills", "SKILL.md")
  const workflowStateCliPath = path.join(projectRoot, ".opencode", "workflow-state.js")

  let stateValid = false
  let state = null
  let kitName = "Unknown kit"
  let kitVersion = "unknown"
  let entryAgent = "unknown"

  if (manifest?.kit) {
    kitName = manifest.kit.name ?? kitName
    kitVersion = manifest.kit.version ?? kitVersion
    entryAgent = manifest.kit.entryAgent ?? entryAgent
  }

  if (fs.existsSync(statePath)) {
    try {
      const result = showState(customStatePath)
      state = result.state
      stateValid = true
    } catch (_error) {
      stateValid = false
    }
  }

  const runtime = {
    projectRoot,
    statePath,
    manifestPath,
    registryPath,
    installManifestPath,
    workflowStateCliPath,
    hooksConfigPath,
    sessionStartPath,
    metaSkillPath,
    kitName,
    kitVersion,
    entryAgent,
    activeProfile: installManifest?.installation?.activeProfile ?? manifest?.kit?.activeProfile ?? "unknown",
    installManifest,
    state,
  }

  const checks = [
    { label: "manifest file found", ok: fs.existsSync(manifestPath) },
    { label: "workflow state file found", ok: fs.existsSync(statePath) },
    { label: "workflow state is valid", ok: stateValid },
    { label: "registry file found", ok: fs.existsSync(registryPath) },
    { label: "registry metadata is readable", ok: !registryInfo.exists || registryInfo.readable },
    { label: "install manifest found", ok: fs.existsSync(installManifestPath) },
    {
      label: "install manifest is readable",
      ok: !installManifestInfo.exists || installManifestInfo.readable,
    },
    { label: "workflow state CLI found", ok: fs.existsSync(workflowStateCliPath) },
    { label: "hooks config found", ok: fs.existsSync(hooksConfigPath) },
    { label: "session-start hook found", ok: fs.existsSync(sessionStartPath) },
    { label: "meta-skill found", ok: fs.existsSync(metaSkillPath) },
    {
      label: "active profile exists in registry",
      ok:
        !installManifestInfo.readable ||
        !registryInfo.readable ||
        (registryInfo.data?.profiles ?? []).some(
          (profile) => profile.name === (installManifest?.installation?.activeProfile ?? manifest?.kit?.activeProfile),
        ),
    },
    {
      label: "manifest and install manifest profiles agree",
      ok:
        !installManifestInfo.readable ||
        !manifest?.kit?.activeProfile ||
        manifest.kit.activeProfile === installManifest?.installation?.activeProfile,
    },
  ]

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

  return {
    runtime,
    checks,
    summary,
  }
}

function validateState(customStatePath) {
  const { statePath, state } = readState(customStatePath)
  validateStateObject(state)
  return { statePath, state }
}

function startTask(mode, featureId, featureSlug, modeReason, customStatePath) {
  ensureKnown(mode, MODE_VALUES, "mode")
  ensureString(featureId, "feature_id")
  ensureString(featureSlug, "feature_slug")
  ensureString(modeReason, "mode_reason")

  return mutate(customStatePath, (state) => {
    const initialStage = getInitialStageForMode(mode)
    state.feature_id = featureId
    state.feature_slug = featureSlug
    state.mode = mode
    state.mode_reason = modeReason
    state.current_stage = initialStage
    state.status = "in_progress"
    state.current_owner = STAGE_OWNERS[initialStage]
    state.artifacts = createEmptyArtifacts()
    state.approvals = createEmptyApprovals(mode)
    state.issues = []
    state.retry_count = 0
    state.escalated_from = null
    state.escalation_reason = null
    return state
  })
}

function startFeature(featureId, featureSlug, customStatePath) {
  return startTask(
    "full",
    featureId,
    featureSlug,
    "Started with legacy start-feature command; defaulting to Full Delivery mode",
    customStatePath,
  )
}

function setApproval(gate, status, approvedBy, approvedAt, notes, customStatePath) {
  ensureKnown(status, ["pending", "approved", "rejected"], "status")

  return mutate(customStatePath, (state) => {
    const allowedGates = getApprovalGatesForMode(state.mode)
    ensureKnown(gate, allowedGates, `gate for mode '${state.mode}'`)

    state.approvals[gate] = {
      status,
      approved_by: approvedBy ?? null,
      approved_at: approvedAt ?? null,
      notes: notes ?? null,
    }
    return state
  })
}

function advanceStage(targetStage, customStatePath) {
  ensureKnown(targetStage, STAGE_SEQUENCE, "target stage")

  return mutate(customStatePath, (state) => {
    if (getModeForStage(targetStage) !== state.mode) {
      fail(`target stage '${targetStage}' does not belong to mode '${state.mode}'`)
    }

    const nextStage = getNextStage(state.mode, state.current_stage)
    if (!nextStage) {
      fail(`Stage '${state.current_stage}' cannot advance further`)
    }

    if (targetStage !== nextStage) {
      fail(`advance-stage only allows the immediate next stage '${nextStage}', not '${targetStage}'`)
    }

    const requiredGate = getTransitionGate(state.mode, state.current_stage, targetStage)
    if (requiredGate && state.approvals[requiredGate].status !== "approved") {
      fail(`Cannot advance from '${state.current_stage}' to '${targetStage}' until gate '${requiredGate}' is approved`)
    }

    state.current_stage = targetStage
    state.current_owner = STAGE_OWNERS[targetStage]
    state.status = targetStage.endsWith("_done") ? "done" : "in_progress"
    return state
  })
}

function linkArtifact(kind, artifactPath, customStatePath) {
  ensureKnown(kind, ARTIFACT_KINDS, "artifact kind")
  ensureString(artifactPath, "artifact path")

  const resolvedArtifactPath = path.resolve(artifactPath)
  if (!fs.existsSync(resolvedArtifactPath)) {
    fail(`Artifact path does not exist: '${artifactPath}'`)
  }

  return mutate(customStatePath, (state) => {
    if (kind === "adr") {
      if (!state.artifacts.adr.includes(artifactPath)) {
        state.artifacts.adr.push(artifactPath)
      }
      return state
    }

    state.artifacts[kind] = artifactPath
    return state
  })
}

function recordIssue(issue, customStatePath) {
  return mutate(customStatePath, (state) => {
    const nextIssue = { ...issue }
    if (typeof nextIssue.artifact_refs === "string") {
      nextIssue.artifact_refs = [nextIssue.artifact_refs]
    }
    ensureIssueShape(nextIssue, state.issues.length)
    state.issues.push(nextIssue)
    state.status = "blocked"
    return state
  })
}

function clearIssues(customStatePath) {
  return mutate(customStatePath, (state) => {
    state.issues = []
    if (!state.current_stage.endsWith("_done")) {
      state.status = "in_progress"
    }
    return state
  })
}

function routeRework(issueType, repeatFailedFix, customStatePath) {
  ensureKnown(issueType, ISSUE_TYPES, "issue_type")

  return mutate(customStatePath, (state) => {
    const route = getReworkRoute(state.mode, issueType)
    if (!route) {
      fail(`No rework route exists for issue type '${issueType}' in mode '${state.mode}'`)
    }

    if (route.escalate) {
      state.mode = route.mode
      state.mode_reason = `Promoted from quick mode after '${issueType}' QA finding`
      state.current_stage = route.stage
      state.current_owner = route.owner
      state.status = "in_progress"
      state.approvals = createEmptyApprovals("full")
      state.escalated_from = "quick"
      state.escalation_reason = `Quick task escalated to Full Delivery because QA reported '${issueType}'`
    } else {
      state.current_stage = route.stage
      state.current_owner = route.owner
      state.status = "in_progress"
    }

    if (repeatFailedFix) {
      state.retry_count += 1
      if (state.retry_count >= ESCALATION_RETRY_THRESHOLD) {
        state.status = "blocked"
      }
    }

    return state
  })
}

module.exports = {
  advanceStage,
  clearIssues,
  ESCALATION_RETRY_THRESHOLD,
  getInstallManifest,
  getProfile,
  getRegistry,
  getRuntimeStatus,
  getVersionInfo,
  linkArtifact,
  listProfiles,
  readState,
  recordIssue,
  resolveStatePath,
  routeRework,
  runDoctor,
  setApproval,
  showState,
  syncInstallManifest,
  startFeature,
  startTask,
  validateState,
  validateStateObject,
  writeState,
}
