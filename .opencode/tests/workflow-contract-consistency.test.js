const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("fs")
const os = require("os")
const path = require("path")

const { runDoctor, getContractConsistencyReport } = require("../lib/workflow-state-controller")

function makeTempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "openkit-contract-check-"))
}

function setupTempRuntime(projectRoot) {
  const opencodeDir = path.join(projectRoot, ".opencode")
  const hooksDir = path.join(projectRoot, "hooks")
  const skillsDir = path.join(projectRoot, "skills", "using-skills")
  const contextCoreDir = path.join(projectRoot, "context", "core")
  const commandsDir = path.join(projectRoot, "commands")
  const agentsDir = path.join(projectRoot, "agents")

  fs.mkdirSync(opencodeDir, { recursive: true })
  fs.mkdirSync(hooksDir, { recursive: true })
  fs.mkdirSync(skillsDir, { recursive: true })
  fs.mkdirSync(contextCoreDir, { recursive: true })
  fs.mkdirSync(commandsDir, { recursive: true })
  fs.mkdirSync(agentsDir, { recursive: true })

  const fixtureState = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "../workflow-state.json"), "utf8"),
  )

  fs.writeFileSync(
    path.join(opencodeDir, "workflow-state.json"),
    `${JSON.stringify(fixtureState, null, 2)}\n`,
    "utf8",
  )
  fs.writeFileSync(
    path.join(opencodeDir, "opencode.json"),
    `${JSON.stringify({
      kit: {
        name: "OpenKit AI Software Factory",
        version: "0.1.0",
        entryAgent: "MasterOrchestrator",
        registry: {
          path: "registry.json",
          schema: "openkit/component-registry@1",
        },
        installManifest: {
          path: ".opencode/install-manifest.json",
          schema: "openkit/install-manifest@1",
        },
        activeProfile: "openkit-core",
      },
      agents: {
        primary: "agents/master-orchestrator.md",
        teamRoles: [
          "agents/master-orchestrator.md",
          "agents/fullstack-agent.md",
          "agents/qa-agent.md",
        ],
      },
      commands: {
        available: [
          "commands/task.md",
          "commands/quick-task.md",
          "commands/delivery.md",
          "commands/write-plan.md",
        ],
      },
    }, null, 2)}\n`,
    "utf8",
  )
  fs.writeFileSync(
    path.join(projectRoot, "registry.json"),
    `${JSON.stringify({
      schema: "openkit/component-registry@1",
      registryVersion: 1,
      profiles: [
        {
          id: "profile.openkit-core",
          name: "openkit-core",
          description: "Core profile",
          componentRefs: ["agents", "runtime", "docs"],
          defaultForRepository: true,
        },
      ],
    }, null, 2)}\n`,
    "utf8",
  )
  fs.writeFileSync(
    path.join(opencodeDir, "install-manifest.json"),
    `${JSON.stringify({
      schema: "openkit/install-manifest@1",
      manifestVersion: 1,
      installation: {
        activeProfile: "openkit-core",
      },
    }, null, 2)}\n`,
    "utf8",
  )
  fs.writeFileSync(path.join(hooksDir, "hooks.json"), '{"hooks":{}}\n', "utf8")
  fs.writeFileSync(path.join(hooksDir, "session-start"), "#!/usr/bin/env bash\n", "utf8")
  fs.writeFileSync(path.join(skillsDir, "SKILL.md"), "# using-skills\n", "utf8")
  fs.writeFileSync(path.join(opencodeDir, "workflow-state.js"), "#!/usr/bin/env node\n", "utf8")

  fs.writeFileSync(
    path.join(contextCoreDir, "workflow.md"),
    [
      "# Workflow",
      "",
      "Quick Task+ is the live semantics of the quick lane, not a third lane.",
      "Mode enums remain `quick` and `full`.",
      "Commands remain `/task`, `/quick-task`, `/delivery`, and `/write-plan`.",
      "Quick stages: `quick_intake -> quick_plan -> quick_build -> quick_verify -> quick_done`.",
      "Full stages: `full_intake -> full_brief -> full_spec -> full_architecture -> full_plan -> full_implementation -> full_qa -> full_done`.",
      "Quick approvals: `quick_verified`.",
      "Full approvals: `pm_to_ba`, `ba_to_architect`, `architect_to_tech_lead`, `tech_lead_to_fullstack`, `fullstack_to_qa`, `qa_to_done`.",
      "Quick artifacts: `task_card`; full artifacts: `brief`, `spec`, `architecture`, `plan`, `qa_report`, `adr`.",
      "",
    ].join("\n"),
    "utf8",
  )
  fs.writeFileSync(
    path.join(contextCoreDir, "workflow-state-schema.md"),
    [
      "# Workflow State Schema",
      "",
      "Modes: `quick`, `full`.",
      "Quick stages: `quick_intake`, `quick_plan`, `quick_build`, `quick_verify`, `quick_done`.",
      "Full stages: `full_intake`, `full_brief`, `full_spec`, `full_architecture`, `full_plan`, `full_implementation`, `full_qa`, `full_done`.",
      "Artifact keys: `task_card`, `brief`, `spec`, `architecture`, `plan`, `qa_report`, `adr`.",
      "Quick approvals: `quick_verified`.",
      "Full approvals: `pm_to_ba`, `ba_to_architect`, `architect_to_tech_lead`, `tech_lead_to_fullstack`, `fullstack_to_qa`, `qa_to_done`.",
      "",
    ].join("\n"),
    "utf8",
  )

  for (const commandName of ["task", "quick-task", "delivery", "write-plan"]) {
    fs.writeFileSync(path.join(commandsDir, `${commandName}.md`), `# ${commandName}\n`, "utf8")
  }

  for (const agentName of ["master-orchestrator", "fullstack-agent", "qa-agent"]) {
    fs.writeFileSync(path.join(agentsDir, `${agentName}.md`), `# ${agentName}\n`, "utf8")
  }
}

test("contract consistency report passes for aligned runtime surfaces", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  const report = getContractConsistencyReport(path.join(projectRoot, ".opencode", "workflow-state.json"))

  assert.equal(report.summary.error, 0)
  assert.ok(report.checks.length > 0)
  assert.ok(report.checks.every((check) => check.ok))
})

test("doctor reports contract consistency failures for missing command files", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)
  fs.rmSync(path.join(projectRoot, "commands", "quick-task.md"))

  const report = runDoctor(path.join(projectRoot, ".opencode", "workflow-state.json"))

  assert.ok(report.summary.error > 0)
  assert.ok(
    report.checks.some(
      (check) => check.label === "declared command files exist" && check.ok === false,
    ),
  )
})

test("doctor reports contract consistency failures for schema/runtime parity mismatches", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)
  fs.writeFileSync(
    path.join(projectRoot, "context", "core", "workflow-state-schema.md"),
    [
      "# Workflow State Schema",
      "",
      "Modes: `quick`, `full`.",
      "Quick stages: `quick_intake`, `quick_build`, `quick_verify`, `quick_done`.",
      "Full stages: `full_intake`, `full_brief`, `full_spec`, `full_architecture`, `full_plan`, `full_implementation`, `full_qa`, `full_done`.",
      "Artifact keys: `task_card`, `brief`, `spec`, `architecture`, `plan`, `qa_report`, `adr`.",
      "Quick approvals: `quick_verified`.",
      "Full approvals: `pm_to_ba`, `ba_to_architect`, `architect_to_tech_lead`, `tech_lead_to_fullstack`, `fullstack_to_qa`, `qa_to_done`.",
      "",
    ].join("\n"),
    "utf8",
  )

  const report = runDoctor(path.join(projectRoot, ".opencode", "workflow-state.json"))

  assert.ok(report.summary.error > 0)
  assert.ok(
    report.checks.some(
      (check) => check.label === "workflow schema matches runtime stage sequences" && check.ok === false,
    ),
  )
})
