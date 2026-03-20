#!/usr/bin/env node

const {
  advanceStage,
  clearIssues,
  linkArtifact,
  recordIssue,
  routeRework,
  setApproval,
  showState,
  startFeature,
  validateState,
} = require("./lib/workflow-state-controller")

function printUsage() {
  console.log(`Usage:
  node .opencode/workflow-state.js [--state <path>] show
  node .opencode/workflow-state.js [--state <path>] validate
  node .opencode/workflow-state.js [--state <path>] start-feature <feature_id> <feature_slug>
  node .opencode/workflow-state.js [--state <path>] advance-stage <stage>
  node .opencode/workflow-state.js [--state <path>] set-approval <gate> <status> [approved_by] [approved_at] [notes]
  node .opencode/workflow-state.js [--state <path>] link-artifact <kind> <path>
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
  console.log(JSON.stringify(result.state, null, 2))
}

function toBoolean(value) {
  return value === "true"
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
      result = showState(statePath)
      printState("Workflow state:", result)
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
      if (result.state.retry_count >= 3) {
        console.log("Escalation threshold reached: retry_count is at or above 3")
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
