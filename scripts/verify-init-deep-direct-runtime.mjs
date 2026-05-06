import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function readText(relativePath) {
  const absolutePath = path.join(projectRoot, relativePath);
  return fs.readFileSync(absolutePath, 'utf8');
}

function expectIncludes(haystack, needle, context) {
  if (!haystack.includes(needle)) {
    fail(`Missing expected text in ${context}: ${needle}`);
  }
}

const builtinCommands = readText('src/runtime/commands/builtin-commands.js');
const handler = readText('src/runtime/commands/handlers/init-deep.js');
const instructionContracts = readText('src/runtime/instruction-contracts.js');
const masterRole = readText('agents/master-orchestrator.md');
const bundledMasterRole = readText('assets/install-bundle/opencode/agents/MasterOrchestrator.md');
const sourceCommand = readText('commands/init-deep.md');
const bundledCommand = readText('assets/install-bundle/opencode/commands/init-deep.md');
const assetManifest = readText('src/install/asset-manifest.js');
const laneSelection = readText('context/core/lane-selection.md');
const bundledLaneSelection = readText('assets/install-bundle/opencode/context/core/lane-selection.md');

expectIncludes(builtinCommands, "executionPriority: 'direct-runtime'", 'src/runtime/commands/builtin-commands.js');
expectIncludes(builtinCommands, 'bypassLaneSelection: true', 'src/runtime/commands/builtin-commands.js');
expectIncludes(handler, "executionPriority: 'direct-runtime'", 'src/runtime/commands/handlers/init-deep.js');
expectIncludes(handler, 'bypassLaneSelection: true', 'src/runtime/commands/handlers/init-deep.js');
expectIncludes(instructionContracts, "command: '/init-deep'", 'src/runtime/instruction-contracts.js');
expectIncludes(instructionContracts, 'do not send this through Master Orchestrator lane selection', 'src/runtime/instruction-contracts.js');
expectIncludes(masterRole, 'do not classify lanes, reinterpret intent, or ask workflow-mode questions', 'agents/master-orchestrator.md');
expectIncludes(masterRole, 'Treat direct-runtime commands as owned by their runtime handlers', 'agents/master-orchestrator.md');
expectIncludes(bundledMasterRole, 'do not classify lanes, reinterpret intent, or ask workflow-mode questions', 'assets/install-bundle/opencode/agents/MasterOrchestrator.md');
expectIncludes(sourceCommand, 'Do not ask the user to choose between `Quick Task`, `Migration`, or `Full Delivery`', 'commands/init-deep.md');
expectIncludes(bundledCommand, 'Do not ask the user to choose between `Quick Task`, `Migration`, or `Full Delivery`', 'assets/install-bundle/opencode/commands/init-deep.md');
expectIncludes(assetManifest, 'opencode.command.init-deep', 'src/install/asset-manifest.js');
expectIncludes(assetManifest, 'assets/install-bundle/opencode/commands/init-deep.md', 'src/install/asset-manifest.js');
expectIncludes(laneSelection, 'Direct-runtime commands such as `/init-deep` are outside this rubric.', 'context/core/lane-selection.md');
expectIncludes(bundledLaneSelection, 'Direct-runtime commands such as `/init-deep` are outside this rubric.', 'assets/install-bundle/opencode/context/core/lane-selection.md');

if (!process.exitCode) {
  console.log('verify-init-deep-direct-runtime: ok');
}
