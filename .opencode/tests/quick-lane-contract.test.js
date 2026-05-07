import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, "../..")

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8")
}

test("canonical workflow quick-lane contract requires confirmation before options", () => {
  const workflow = readProjectFile("context/core/workflow.md")

  assert.match(workflow, /quick_intake\s*->\s*quick_brainstorm\s*->\s*quick_plan\s*->\s*quick_implement\s*->\s*quick_test\s*->\s*quick_done/i)
  assert.match(workflow, /quick_brainstorm[^\n]*clarify\s*\+\s*align/i)
  assert.match(workflow, /explicit user confirmation of understanding/i)
  assert.match(workflow, /no solution options[^\n]*before explicit understanding confirmation/i)
  assert.match(workflow, /including tiny or seemingly obvious tasks/i)
  assert.match(workflow, /`?quick_plan`? owns solution analysis and option comparison/i)
  assert.match(workflow, /default `quick_plan` behavior is 3 meaningfully different options/i)
  assert.match(workflow, /fewer than 3 options are allowed only when 3 meaningful options do not exist/i)
  assert.match(workflow, /options must be holistic and preserve project stability and consistency/i)
  assert.match(workflow, /user chooses the approach before execution plan creation/i)
  assert.match(workflow, /separate checkpoint before `quick_implement`/i)
})

test("Quick Agent stage guidance enforces two explicit user confirmations", () => {
  const quickAgent = readProjectFile("agents/quick-agent.md")

  assert.match(quickAgent, /quick_brainstorm[\s\S]*Clarify and align on task understanding/i)
  assert.match(quickAgent, /must get explicit confirmation of understanding before moving to `quick_plan`/i)
  assert.match(quickAgent, /applies even for tiny or seemingly obvious quick tasks/i)
  assert.match(quickAgent, /Do not present solution options[^\n]*before explicit understanding confirmation/i)
  assert.match(quickAgent, /quick_plan[\s\S]*Default behavior is to present 3 meaningfully different options/i)
  assert.match(quickAgent, /Fewer than 3 options are allowed only when 3 meaningful approaches truly do not exist; explain why explicitly/i)
  assert.match(quickAgent, /Options must be holistic and protect project stability\/consistency/i)
  assert.match(quickAgent, /Do not produce a final execution plan until the user selects an option/i)
  assert.match(quickAgent, /wait for explicit plan confirmation before implementing/i)
})

test("command and runtime guidance align to options-in-quick_plan contract", () => {
  const quickTaskCommand = readProjectFile("commands/quick-task.md")
  const taskCommand = readProjectFile("commands/task.md")
  const instructionContracts = readProjectFile("src/runtime/instruction-contracts.js")
  const runtimeGuidance = readProjectFile(".opencode/lib/runtime-guidance.js")

  assert.match(quickTaskCommand, /During `quick_brainstorm`:[^\n]*explicit user confirmation before any option analysis/i)
  assert.match(quickTaskCommand, /During `quick_plan`:[^\n]*present 3 options by default/i)
  assert.match(quickTaskCommand, /require separate plan confirmation before `quick_implement`/i)

  assert.match(taskCommand, /Quick Agent will first confirm understanding, then analyze options in quick_plan/i)

  assert.match(instructionContracts, /confirms understanding in quick_brainstorm, then analyzes options in quick_plan/i)
  assert.match(instructionContracts, /'understanding confirmation', 'solution options in quick_plan', 'selected-option execution plan', 'plan confirmation', 'test evidence'/i)

  assert.match(runtimeGuidance, /quick_brainstorm:[^\n]*explicit user confirmation before any option analysis/i)
  assert.match(runtimeGuidance, /quick_plan:[^\n]*present 3 options by default \(or explain why fewer\)/i)
  assert.match(runtimeGuidance, /wait for separate explicit plan confirmation/i)
})
