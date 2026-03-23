#!/usr/bin/env node

const fs = require("fs")
const path = require("path")

const {
  ESCALATION_RETRY_THRESHOLD,
  advanceStage,
  clearIssues,
  claimTask,
  createTask,
  createWorkItem,
  getProfile,
  getRuntimeStatus,
  getVersionInfo,
  linkArtifact,
  listTasks,
  listWorkItems,
  listProfiles,
  reassignTask,
  recordIssue,
  releaseTask,
  resolveStatePath,
  routeRework,
  runDoctor,
  scaffoldAndLinkArtifact,
  selectActiveWorkItem,
  assignQaOwner,
  setRoutingProfile,
  setTaskStatus,
  setApproval,
  showState,
  showWorkItemState,
  syncInstallManifest,
  startFeature,
  startTask,
  validateWorkItemBoard,
  validateState,
} = require("./lib/workflow-state-controller")
const { resolveWorkItemPaths, validateActiveMirror } = require("./lib/work-item-store")
const { getRuntimeContext } = require("./lib/runtime-summary")

function printUsage() {
  console.log(`Usage:
  node .opencode/workflow-state.js [--state <path>] show
  node .opencode/workflow-state.js [--state <path>] status
  node .opencode/workflow-state.js [--state <path>] doctor
  node .opencode/workflow-state.js [--state <path>] version
  node .opencode/workflow-state.js [--state <path>] profiles
  node .opencode/workflow-state.js [--state <path>] show-profile <name>
  node .opencode/workflow-state.js [--state <path>] sync-install-manifest <name>
  node .opencode/workflow-state.js [--state <path>] validate
  node .opencode/workflow-state.js [--state <path>] start-feature <feature_id> <feature_slug>
  node .opencode/workflow-state.js [--state <path>] start-task <mode> <feature_id> <feature_slug> <mode_reason>
  node .opencode/workflow-state.js [--state <path>] create-work-item <mode> <feature_id> <feature_slug> <mode_reason>
  node .opencode/workflow-state.js [--state <path>] list-work-items
  node .opencode/workflow-state.js [--state <path>] show-work-item <work_item_id>
  node .opencode/workflow-state.js [--state <path>] activate-work-item <work_item_id>
  node .opencode/workflow-state.js [--state <path>] advance-stage <stage>
  node .opencode/workflow-state.js [--state <path>] set-approval <gate> <status> [approved_by] [approved_at] [notes]
  node .opencode/workflow-state.js [--state <path>] link-artifact <kind> <path>
  node .opencode/workflow-state.js [--state <path>] scaffold-artifact <task_card|plan|migration_report> <slug>
  node .opencode/workflow-state.js [--state <path>] set-routing-profile <work_intent> <behavior_delta> <dominant_uncertainty> <scope_shape> <selection_reason>
  node .opencode/workflow-state.js [--state <path>] list-tasks <work_item_id>
  node .opencode/workflow-state.js [--state <path>] create-task <work_item_id> <task_id> <title> <kind> [branch] [worktree_path]
  node .opencode/workflow-state.js [--state <path>] claim-task <work_item_id> <task_id> <owner> <requested_by>
  node .opencode/workflow-state.js [--state <path>] release-task <work_item_id> <task_id> <requested_by>
  node .opencode/workflow-state.js [--state <path>] reassign-task <work_item_id> <task_id> <owner> <requested_by>
  node .opencode/workflow-state.js [--state <path>] assign-qa-owner <work_item_id> <task_id> <qa_owner> <requested_by>
  node .opencode/workflow-state.js [--state <path>] set-task-status <work_item_id> <task_id> <status>
  node .opencode/workflow-state.js [--state <path>] validate-work-item-board <work_item_id>
  node .opencode/workflow-state.js [--state <path>] record-issue <issue_id> <title> <type> <severity> <rooted_in> <recommended_owner> <evidence> <artifact_refs>
  node .opencode/workflow-state.js [--state <path>] clear-issues
  node .opencode/workflow-state.js [--state <path>] route-rework <issue_type> [repeat_failed_fix=true|false]`)
}

function parseGlobalFlags(argv) {
  const args = [...argv]
  let statePath = null

  while (args[0] === "--state") {
    args.shift()
    if (!args[0]) {
      throw new Error("Missing value for --state")
    }
    statePath = args.shift()
  }

  return { args, statePath }
}

function printState(prefix, result) {
  console.log(prefix)
  console.log(`State file: ${result.statePath}`)
  printRuntimeTaskContext(result.runtimeContext)
  console.log(JSON.stringify(result.state, null, 2))
}

function printRuntimeTaskContext(context) {
  if (!context) {
    return
  }

  if (context.activeWorkItemId) {
    console.log(`active work item id: ${context.activeWorkItemId}`)
  }

  if (typeof context.workItemCount === "number") {
    console.log(`work items tracked: ${context.workItemCount}`)
  }

  if (context.taskBoardSummary) {
    console.log(
      `task board: ${context.taskBoardSummary.total} tasks | ready ${context.taskBoardSummary.ready} | active ${context.taskBoardSummary.active}`,
    )
    if (context.taskBoardSummary.activeTasks.length > 0) {
      console.log(`active tasks: ${context.taskBoardSummary.activeTasks.join("; ")}`)
    }
  }
}

function printRuntimeStatus(runtime) {
  console.log("OpenKit runtime status:")
  console.log(`project root: ${runtime.projectRoot}`)
  console.log(`kit: ${runtime.kitName} v${runtime.kitVersion}`)
  console.log(`entry agent: ${runtime.entryAgent}`)
  console.log(`active profile: ${runtime.activeProfile}`)
  console.log(`registry: ${runtime.registryPath}`)
  console.log(`install manifest: ${runtime.installManifestPath}`)
  console.log(`state file: ${runtime.statePath}`)
  console.log(`mode: ${runtime.state.mode}`)
  console.log(`stage: ${runtime.state.current_stage}`)
  console.log(`status: ${runtime.state.status}`)
  console.log(`owner: ${runtime.state.current_owner}`)
  if (runtime.state.feature_id && runtime.state.feature_slug) {
    console.log(`work item: ${runtime.state.feature_id} (${runtime.state.feature_slug})`)
  }
  printRuntimeTaskContext(runtime.runtimeContext)
}

function printDoctorReport(report) {
  console.log("OpenKit doctor:")
  console.log(`active profile: ${report.runtime.activeProfile}`)
  console.log(`registry: ${report.runtime.registryPath}`)
  console.log(`install manifest: ${report.runtime.installManifestPath}`)
  printRuntimeTaskContext(report.runtime.runtimeContext)
  for (const check of report.checks) {
    console.log(`[${check.ok ? "ok" : "error"}] ${check.label}`)
  }
  console.log(
    `Summary: ${report.summary.ok} ok, ${report.summary.warn} warn, ${report.summary.error} error`,
  )
}

function printProfiles(profiles) {
  console.log("OpenKit profiles:")
  for (const profile of profiles) {
    const marker = profile.defaultForRepository ? "*" : " "
    console.log(`${marker} ${profile.name} - ${profile.description}`)
  }
}

function printProfile(profile) {
  console.log(`Profile: ${profile.name}`)
  console.log(`default: ${profile.defaultForRepository ? "yes" : "no"}`)
  console.log(`components: ${profile.componentRefs.join(", ")}`)
}

function printVersion(info) {
  console.log(`OpenKit version: ${info.kitVersion}`)
  console.log(`active profile: ${info.activeProfile}`)
}

function printWorkItems(result) {
  console.log(`Active work item: ${result.index.active_work_item_id ?? "none"}`)
  for (const item of result.workItems) {
    const marker = item.work_item_id === result.index.active_work_item_id ? "*" : " "
    console.log(`${marker} ${item.work_item_id} | ${item.feature_id} | ${item.mode} | ${item.status}`)
  }
}

function printWorkItem(result) {
  console.log(`Work item: ${result.state.work_item_id}`)
  console.log(`feature: ${result.state.feature_id} (${result.state.feature_slug})`)
  console.log(`mode: ${result.state.mode}`)
  console.log(`stage: ${result.state.current_stage}`)
  console.log(`status: ${result.state.status}`)
}

function printTasks(result) {
  console.log(`Tasks for ${result.workItemId}:`)
  for (const task of result.tasks) {
    console.log(`${task.task_id} | ${task.status} | ${task.kind} | ${task.title}`)
  }
}

function toBoolean(value) {
  return value === "true"
}

function requireArgument(value, placeholder, command) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${command} requires ${placeholder}`)
  }

  return value
}

function enrichStateResult(result, statePath) {
  const runtimeRoot = path.dirname(path.dirname(statePath ?? result.statePath))
  return {
    ...result,
    runtimeContext: getRuntimeContext(runtimeRoot, result.state),
  }
}

function extendDoctorReport(report, statePath) {
  const runtimeRoot = path.dirname(path.dirname(statePath))
  const checks = [...report.checks]
  const runtimeContext = getRuntimeContext(runtimeRoot, report.runtime.state)
  const activeWorkItemId = runtimeContext.activeWorkItemId
  const indexPath = path.join(runtimeRoot, ".opencode", "work-items", "index.json")
  const index = fs.existsSync(indexPath) ? JSON.parse(fs.readFileSync(indexPath, "utf8")) : null
  const activeWorkItem = index?.work_items?.find((entry) => entry.work_item_id === activeWorkItemId) ?? null
  let activePointerOk = !index || !activeWorkItemId
  let mirrorOk = !index || !activeWorkItemId
  let boardOk = true

  if (index && activeWorkItemId) {
    const activeStatePath = resolveWorkItemPaths(runtimeRoot, activeWorkItemId).statePath
    activePointerOk = fs.existsSync(activeStatePath)

    try {
      validateActiveMirror(runtimeRoot)
      mirrorOk = true
    } catch (_error) {
      mirrorOk = false
    }
  }

  if (report.runtime.state?.mode === "full" && report.runtime.state?.work_item_id) {
    boardOk = report.runtime.state.current_stage === "full_implementation" || report.runtime.state.current_stage === "full_qa"
      ? runtimeContext.taskBoardPresent
      : true
  } else if (!report.runtime.state && activeWorkItem?.mode === "full") {
    try {
      validateWorkItemBoard(activeWorkItemId, statePath)
      boardOk = true
    } catch (_error) {
      boardOk = false
    }
  }

  checks.push(
    { label: "active work item pointer resolves to stored state", ok: activePointerOk },
    { label: "compatibility mirror matches active work item state", ok: mirrorOk },
    { label: "active work item task board is valid", ok: boardOk },
  )

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
    ...report,
    runtime: {
      ...report.runtime,
      runtimeContext,
    },
    checks,
    summary,
  }
}

async function main() {
  const { args, statePath } = parseGlobalFlags(process.argv.slice(2))
  const [command, ...rest] = args

  if (!command) {
    printUsage()
    process.exit(1)
  }

  let result
  switch (command) {
    case "show":
      result = enrichStateResult(showState(statePath), statePath)
      printState("Workflow state:", result)
      return
    case "status":
      result = getRuntimeStatus(statePath)
      result.runtimeContext = getRuntimeContext(result.runtimeRoot, result.state)
      printRuntimeStatus(result)
      return
    case "doctor":
      result = extendDoctorReport(runDoctor(statePath), resolveStatePath(statePath))
      printDoctorReport(result)
      process.exit(result.summary.error > 0 ? 1 : 0)
      return
    case "version":
      result = getVersionInfo(statePath)
      printVersion(result)
      return
    case "profiles":
      result = listProfiles(statePath)
      printProfiles(result)
      return
    case "show-profile":
      result = getProfile(rest[0], statePath)
      printProfile(result)
      return
    case "sync-install-manifest":
      result = syncInstallManifest(rest[0], statePath)
      console.log(`Updated install manifest profile to '${result.profile.name}'`)
      console.log(`Install manifest: ${result.installManifestPath}`)
      return
    case "validate":
      result = validateState(statePath)
      console.log(`Workflow state is valid: ${result.statePath}`)
      return
    case "start-feature":
      result = startFeature(rest[0], rest[1], statePath)
      console.log(`Started feature ${rest[0]} (${rest[1]})`)
      console.log(`State file: ${result.statePath}`)
      return
    case "start-task":
      result = startTask(rest[0], rest[1], rest[2], rest.slice(3).join(" "), statePath)
      console.log(`Started ${result.state.mode} task ${rest[1]} (${rest[2]})`)
      console.log(`State file: ${result.statePath}`)
      return
    case "create-work-item":
      result = createWorkItem(rest[0], rest[1], rest[2], rest.slice(3).join(" "), statePath)
      console.log(`Created ${result.state.mode} work item ${rest[1]} (${rest[2]})`)
      console.log(`State file: ${result.statePath}`)
      return
    case "list-work-items":
      result = listWorkItems(statePath)
      printWorkItems(result)
      return
    case "show-work-item":
      result = showWorkItemState(rest[0], statePath)
      printWorkItem(result)
      return
    case "activate-work-item":
      result = selectActiveWorkItem(rest[0], statePath)
      console.log(`Activated work item '${result.state.work_item_id}'`)
      console.log(`State file: ${result.statePath}`)
      return
    case "advance-stage":
      result = advanceStage(rest[0], statePath)
      console.log(`Advanced workflow to stage '${result.state.current_stage}'`)
      console.log(`State file: ${result.statePath}`)
      return
    case "set-approval":
      result = setApproval(rest[0], rest[1], rest[2], rest[3], rest[4], statePath)
      console.log(`Updated approval gate '${rest[0]}' to '${rest[1]}'`)
      console.log(`State file: ${result.statePath}`)
      return
    case "link-artifact":
      result = linkArtifact(rest[0], rest[1], statePath)
      console.log(`Linked artifact '${rest[0]}' -> '${rest[1]}'`)
      console.log(`State file: ${result.statePath}`)
      return
    case "scaffold-artifact":
      result = scaffoldAndLinkArtifact(rest[0], rest[1], statePath)
      console.log(`Created artifact '${rest[0]}' at '${result.artifactPath}'`)
      console.log(`State file: ${result.statePath}`)
      return
    case "set-routing-profile":
      result = setRoutingProfile(rest[0], rest[1], rest[2], rest[3], rest.slice(4).join(" "), statePath)
      console.log(`Updated routing profile for mode '${result.state.mode}'`)
      console.log(`State file: ${result.statePath}`)
      return
    case "list-tasks":
      result = listTasks(rest[0], statePath)
      printTasks(result)
      return
    case "create-task":
      result = createTask(
        rest[0],
        {
          task_id: rest[1],
          title: rest[2],
          kind: rest[3],
          ...(rest[4] && rest[5]
            ? {
                worktree_metadata: {
                  task_id: rest[1],
                  branch: rest[4],
                  worktree_path: rest[5],
                },
              }
            : {}),
        },
        statePath,
      )
      console.log(`Created task '${rest[1]}' on work item '${rest[0]}'`)
      console.log(`State file: ${result.statePath}`)
      return
    case "claim-task":
      result = claimTask(rest[0], rest[1], rest[2], statePath, {
        requestedBy: requireArgument(rest[3], "<requested_by>", "claim-task"),
      })
      console.log(`Claimed task '${rest[1]}' for '${rest[2]}'`)
      console.log(`State file: ${result.statePath}`)
      return
    case "release-task":
      result = releaseTask(rest[0], rest[1], statePath, {
        requestedBy: requireArgument(rest[2], "<requested_by>", "release-task"),
      })
      console.log(`Released task '${rest[1]}'`)
      console.log(`State file: ${result.statePath}`)
      return
    case "reassign-task":
      result = reassignTask(rest[0], rest[1], rest[2], statePath, {
        requestedBy: requireArgument(rest[3], "<requested_by>", "reassign-task"),
      })
      console.log(`Reassigned task '${rest[1]}' to '${rest[2]}'`)
      console.log(`State file: ${result.statePath}`)
      return
    case "assign-qa-owner":
      result = assignQaOwner(rest[0], rest[1], rest[2], statePath, {
        requestedBy: requireArgument(rest[3], "<requested_by>", "assign-qa-owner"),
      })
      console.log(`Assigned QA owner '${rest[2]}' to task '${rest[1]}'`)
      console.log(`State file: ${result.statePath}`)
      return
    case "set-task-status":
      result = setTaskStatus(rest[0], rest[1], rest[2], statePath)
      console.log(`Updated task '${rest[1]}' to '${rest[2]}'`)
      console.log(`State file: ${result.statePath}`)
      return
    case "validate-work-item-board":
      result = validateWorkItemBoard(rest[0], statePath)
      console.log(`Task board is valid for work item '${result.workItemId}'`)
      console.log(`State file: ${result.statePath}`)
      return
    case "record-issue":
      result = recordIssue(
        {
          issue_id: rest[0],
          title: rest[1],
          type: rest[2],
          severity: rest[3],
          rooted_in: rest[4],
          recommended_owner: rest[5],
          evidence: rest[6],
          artifact_refs: rest[7],
        },
        statePath,
      )
      console.log(`Recorded issue '${rest[0]}'`)
      console.log(`State file: ${result.statePath}`)
      return
    case "clear-issues":
      result = clearIssues(statePath)
      console.log("Cleared workflow issues")
      console.log(`State file: ${result.statePath}`)
      return
    case "route-rework":
      result = routeRework(rest[0], toBoolean(rest[1] ?? "false"), statePath)
      console.log(`Routed rework for '${rest[0]}' to stage '${result.state.current_stage}'`)
      if (result.state.retry_count >= ESCALATION_RETRY_THRESHOLD) {
        console.log(
          `Escalation threshold reached: retry_count is at or above ${ESCALATION_RETRY_THRESHOLD}`,
        )
      }
      console.log(`State file: ${result.statePath}`)
      return
    case "help":
      printUsage()
      return
    default:
      throw new Error(`Unknown command '${command}'`)
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
