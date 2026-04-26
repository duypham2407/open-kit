import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');

function read(filePath) {
  return fs.readFileSync(path.join(projectRoot, filePath), 'utf8');
}

function listMarkdownFiles(relativeDir) {
  return fs.readdirSync(path.join(projectRoot, relativeDir))
    .filter((entry) => entry.endsWith('.md'))
    .map((entry) => `${relativeDir}/${entry}`);
}

test('agent prompts reference shared prompt contracts', () => {
  for (const file of listMarkdownFiles('agents')) {
    const contents = read(file);
    assert.match(contents, /prompt-contracts\.md/);
  }
});

test('agents explicitly reference tooling-first substitution rules', () => {
  for (const file of listMarkdownFiles('agents')) {
    const contents = read(file);
    assert.match(contents, /tool-substitution-rules\.md/);
  }
});

test('workflow command prompts reference shared prompt contracts except model configuration helper', () => {
  for (const file of listMarkdownFiles('commands')) {
    if (file.endsWith('configure-agent-models.md')) {
      continue;
    }
    if (file.endsWith('configure-embedding.md')) {
      continue;
    }
    const contents = read(file);
    assert.match(contents, /prompt-contracts\.md/);
  }
});

test('workflow command prompts explicitly reference tooling-first substitution rules', () => {
  for (const file of listMarkdownFiles('commands')) {
    const contents = read(file);
    assert.match(contents, /tool-substitution-rules\.md/);
  }
});

test('high-risk skills reference tooling-first substitution rules', () => {
  const files = [
    'skills/code-review/SKILL.md',
    'skills/systematic-debugging/SKILL.md',
    'skills/test-driven-development/SKILL.md',
    'skills/verification-before-completion/SKILL.md',
    'skills/writing-solution/SKILL.md',
    'skills/brainstorming/SKILL.md',
    'skills/subagent-driven-development/SKILL.md',
    'skills/using-skills/SKILL.md',
  ];

  for (const file of files) {
    const contents = read(file);
    assert.match(contents, /tool-substitution-rules\.md/);
  }
});

test('workflow-facing prompts reference runtime surface boundaries where relevant', () => {
  const files = [
    'agents/master-orchestrator.md',
    'agents/fullstack-agent.md',
    'agents/qa-agent.md',
    'commands/task.md',
    'commands/quick-task.md',
    'commands/migrate.md',
    'commands/delivery.md',
    'commands/write-solution.md',
    'commands/execute-solution.md',
    'commands/brainstorm.md',
  ];

  for (const file of files) {
    const contents = read(file);
    assert.match(contents, /runtime-surfaces\.md/);
  }
});

test('core docs expose the anti-hallucination validation split', () => {
  const readme = read('README.md');
  const projectConfig = read('context/core/project-config.md');

  assert.match(readme, /OpenKit is an AI software factory for OpenCode/);
  assert.match(readme, /reduce hallucinated completion claims through runtime checks and verification gates/);
  assert.match(projectConfig, /OpenKit does have repo-native validation for its own runtime, CLI, install, and launch surfaces/);
  assert.match(projectConfig, /record-verification-evidence/);
  assert.match(projectConfig, /issue-aging-report/);
});

test('Fullstack and QA roles explicitly call the verification-before-completion skill', () => {
  const fullstack = read('agents/fullstack-agent.md');
  const qa = read('agents/qa-agent.md');

  assert.match(fullstack, /verification-before-completion/);
  assert.match(qa, /verification-before-completion/);
});

test('scan evidence reporting requirements stay explicit in role prompts and QA template', () => {
  const roleFiles = [
    'agents/fullstack-agent.md',
    'agents/code-reviewer.md',
    'agents/qa-agent.md',
  ];

  for (const file of roleFiles) {
    const contents = read(file);
    assert.match(contents, /Scan\/Tool Evidence Reporting/);
    assert.match(contents, /direct tool status/);
    assert.match(contents, /substitute status/);
    assert.match(contents, /manual override caveats/);
    assert.match(contents, /classification summary/);
    assert.match(contents, /false-positive rationale/);
    assert.match(contents, /validation-surface labels/);
    assert.match(contents, /artifact refs/);
  }

  const qaTemplate = read('docs/templates/qa-report-template.md');
  assert.match(qaTemplate, /## Scan\/Tool Evidence/);
  assert.match(qaTemplate, /Direct Tool Status/);
  assert.match(qaTemplate, /Substitute\/Manual Evidence/);
  assert.match(qaTemplate, /Classification Summary/);
  assert.match(qaTemplate, /False-Positive Rationale/);
  assert.match(qaTemplate, /Manual Override Caveats/);
  assert.match(qaTemplate, /Validation Surface/);
  assert.match(qaTemplate, /Artifact Refs/);
});

test('QA reporting contract requires FEATURE-940 supervisor dialogue evidence', () => {
  const qaTemplate = read('docs/templates/qa-report-template.md');
  const projectConfig = read('context/core/project-config.md');
  const runtimeSurfaces = read('context/core/runtime-surfaces.md');
  const supportedSurfaces = read('docs/operator/supported-surfaces.md');
  const kitInternals = read('docs/kit-internals/04-tools-hooks-skills-and-mcps.md');
  const docs = [qaTemplate, projectConfig, runtimeSurfaces, supportedSurfaces, kitInternals].join('\n');

  assert.match(qaTemplate, /## Supervisor Dialogue Evidence/);
  assert.match(qaTemplate, /supervisor health/i);
  assert.match(qaTemplate, /outbound event statuses/i);
  assert.match(qaTemplate, /inbound dispositions/i);
  assert.match(qaTemplate, /authority[- ]boundary rejection/i);
  assert.match(qaTemplate, /duplicate\/repeated proposal/i);
  assert.match(qaTemplate, /degraded\/offline/i);
  assert.match(qaTemplate, /proof.*no workflow mutation.*inbound/i);

  assert.match(docs, /FEATURE-940/);
  assert.match(docs, /FEATURE-937[^\n]*historical risk/i);
  assert.match(docs, /FEATURE-939 scan\/tool evidence/i);
  assert.match(docs, /target-project app validation.*unavailable/i);
});

test('operator and maintainer docs describe scan evidence states and triage policy', () => {
  const docs = [
    read('docs/operator/semgrep.md'),
    read('docs/operator/supported-surfaces.md'),
    read('docs/maintainer/test-matrix.md'),
    read('docs/kit-internals/04-tools-hooks-skills-and-mcps.md'),
    read('context/core/tool-substitution-rules.md'),
    read('context/core/approval-gates.md'),
  ].join('\n');

  assert.match(docs, /bundled rule packs/);
  assert.match(docs, /Availability states/);
  assert.match(docs, /Result states/);
  assert.match(docs, /Evidence types/);
  assert.match(docs, /High-volume finding triage/);
  assert.match(docs, /False-positive requirements/);
  assert.match(docs, /Manual override limits/);
  assert.match(docs, /direct_tool/);
  assert.match(docs, /substitute_scan/);
  assert.match(docs, /manual_override/);
  assert.match(docs, /runtime_tooling/);
  assert.match(docs, /target_project_app/);
});

test('operator docs describe MCP configuration and secret-safe boundaries', () => {
  const mcpDocs = read('docs/operator/mcp-configuration.md');
  const operatorIndex = read('docs/operator/README.md');
  const supportedSurfaces = read('docs/operator/supported-surfaces.md');
  const surfaceContract = read('docs/operator/surface-contract.md');
  const docs = [mcpDocs, operatorIndex, supportedSurfaces, surfaceContract].join('\n');

  assert.match(mcpDocs, /Default Bundled MCP Catalog/);
  assert.match(mcpDocs, /Default Bundled Skill Catalog Overview/);
  assert.match(mcpDocs, /openkit configure mcp <list\|doctor\|enable\|disable\|set-key\|unset-key\|test>/);
  assert.match(mcpDocs, /set-key.*automatically enables/s);
  assert.match(mcpDocs, /Scope Semantics/);
  assert.match(mcpDocs, /`openkit`/);
  assert.match(mcpDocs, /`global`/);
  assert.match(mcpDocs, /`both`/);
  assert.match(mcpDocs, /<OPENCODE_HOME>\/openkit\/secrets\.env/);
  assert.match(mcpDocs, /0700/);
  assert.match(mcpDocs, /0600/);
  assert.match(mcpDocs, /No Raw Secret Rule/);
  assert.match(mcpDocs, /Direct OpenCode Caveat/);
  assert.match(mcpDocs, /disable.*keeps any stored key/s);
  assert.match(mcpDocs, /unset-key.*does not.*disable/s);
  assert.match(mcpDocs, /openkit configure mcp doctor/);
  assert.match(mcpDocs, /openkit configure mcp test/);
  assert.match(mcpDocs, /target_project_app/);
  assert.match(mcpDocs, /Target-project application validation is `target_project_app` only when the target project declares real app/);

  assert.match(docs, /docs\/operator\/mcp-configuration\.md/);
  assert.doesNotMatch(mcpDocs, /sk-[A-Za-z0-9_-]{8,}/);
});

test('package scripts expose governance and install-bundle verification gates', () => {
  const packageJson = JSON.parse(read('package.json'));

  assert.equal(typeof packageJson.scripts['sync:install-bundle'], 'string');
  assert.equal(typeof packageJson.scripts['verify:install-bundle'], 'string');
  assert.equal(typeof packageJson.scripts['verify:governance'], 'string');
  assert.equal(typeof packageJson.scripts['verify:semgrep-quality'], 'string');
  assert.equal(typeof packageJson.scripts['verify:all'], 'string');
  assert.match(packageJson.scripts['verify:all'], /verify:semgrep-quality/);
});

test('repository defines CI workflow for verification gates', () => {
  const workflow = read('.github/workflows/verify.yml');

  assert.match(workflow, /name: Verify/);
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /Install Semgrep for bundled rule-pack regression tests/);
  assert.match(workflow, /npm run verify:all/);
});

test('semgrep quality regression docs keep unavailability fail-closed', () => {
  const semgrepTest = read('tests/semgrep/quality-rules.test.js');
  const semgrepDocs = read('docs/operator/semgrep.md');
  const projectConfig = read('context/core/project-config.md');
  const agentGuide = read('AGENTS.md');
  const testMatrix = read('docs/maintainer/test-matrix.md');

  assert.match(semgrepTest, /OPENKIT_ALLOW_SEMGREP_QUALITY_SKIP/);
  assert.match(semgrepTest, /isCiEnvironment/);
  assert.match(semgrepTest, /process\.env\.CI/);
  assert.match(semgrepTest, /process\.env\.GITHUB_ACTIONS/);
  assert.match(semgrepTest, /!isCiEnvironment/);
  assert.match(semgrepTest, /assert\.fail\(`\$\{semgrepUnavailableReason\}/);
  assert.match(semgrepDocs, /Semgrep availability is required gate evidence/);
  assert.match(semgrepDocs, /fails by default, including in CI/);
  assert.match(semgrepDocs, /OPENKIT_ALLOW_SEMGREP_QUALITY_SKIP=1/);
  assert.match(projectConfig, /Semgrep unavailability fails this gate by default/);
  assert.match(agentGuide, /Semgrep unavailability fails this gate by default/);
  assert.match(testMatrix, /Semgrep unavailability fails the gate by default/);
});

test('maintainer docs advertise one-command verification and workflow telemetry', () => {
  const maintainer = read('docs/maintainer/README.md');
  const commandMatrix = read('docs/maintainer/command-matrix.md');
  const traceability = read('docs/maintainer/policy-execution-traceability.md');
  const releaseRunbook = read('docs/operations/runbooks/release-workflow-smoke-tests.md');

  assert.match(maintainer, /npm run verify:all/);
  assert.match(commandMatrix, /workflow-metrics/);
  assert.match(commandMatrix, /check-stage-readiness/);
  assert.match(commandMatrix, /release-readiness/);
  assert.match(commandMatrix, /workflow-analytics/);
  assert.match(traceability, /Verification Before Completion/);
  assert.match(traceability, /Release Candidate Governance/);
  assert.match(releaseRunbook, /create-release-candidate/);
});

test('canonical docs expose role policy and package-first artifacts', () => {
  const workflow = read('context/core/workflow.md');
  const schema = read('context/core/workflow-state-schema.md');
  const policy = read('docs/maintainer/2026-03-26-role-operating-policy.md');
  const activeContract = read('context/core/active-contract.json');
  const reviewSchema = read('context/core/code-review-output-schema.json');
  const qaSchema = read('context/core/qa-output-schema.json');

  assert.match(workflow, /scope package/i);
  assert.match(workflow, /solution package/i);
  assert.match(schema, /scope_package/);
  assert.match(schema, /solution_package/);
  assert.match(policy, /Code Reviewer/);
  assert.match(policy, /QA Agent/);
  assert.match(activeContract, /code-review-output-schema\.json/);
  assert.match(activeContract, /qa-output-schema\.json/);
  assert.match(reviewSchema, /required_finding_fields/);
  assert.match(qaSchema, /required_verification_fields/);
});

test('canonical docs keep the managed path model and environment anchors explicit', () => {
  const agentsGuide = read('AGENTS.md');
  const readme = read('README.md');
  const operationsIndex = read('docs/operations/README.md');
  const dailyUsage = read('docs/operations/runbooks/openkit-daily-usage.md');
  const supportedSurfaces = read('docs/operator/supported-surfaces.md');
  const surfaceContract = read('docs/operator/surface-contract.md');

  assert.match(agentsGuide, /OPENKIT_KIT_ROOT/);
  assert.match(agentsGuide, /OPENKIT_WORKFLOW_STATE/);
  assert.match(agentsGuide, /OPENKIT_PROJECT_ROOT/);
  assert.match(agentsGuide, /Path-model anti-confusion rule:/);
  assert.match(agentsGuide, /OPENCODE_HOME\/kits\/openkit/);
  assert.match(agentsGuide, /OPENCODE_HOME\/workspaces\/<workspace-id>\/openkit\/\.opencode/);
  assert.match(agentsGuide, /projectRoot\/\.opencode/);

  assert.match(readme, /Path model during managed launch:/);
  assert.match(readme, /compatibility surface, not the default source of truth for managed runtime state/);

  assert.match(operationsIndex, /Keep the path model explicit during operations work:/);
  assert.match(operationsIndex, /compatibility-wrapper drift/);
  assert.match(operationsIndex, /managed runtime-state problem/);

  assert.match(dailyUsage, /## Path Model/);
  assert.match(dailyUsage, /OPENKIT_KIT_ROOT/);
  assert.match(dailyUsage, /OPENKIT_WORKFLOW_STATE/);
  assert.match(dailyUsage, /OPENKIT_PROJECT_ROOT/);
  assert.match(dailyUsage, /missing under `OPENCODE_HOME\/kits\/openkit` usually means a global install or upgrade problem/);
  assert.match(dailyUsage, /missing under `projectRoot\/\.opencode` may only mean the compatibility shim is stale or incomplete/);

  assert.match(supportedSurfaces, /separate layers and should not be treated as interchangeable paths/);
  assert.match(surfaceContract, /keep the path model explicit: global kit root for managed kit\/config, workspace state root for active runtime state, project `\.opencode\/` for compatibility shim behavior/);
});

test('operator and runtime docs expose command reality, validation surfaces, and orchestration boundaries', () => {
  const readme = read('README.md');
  const operator = read('docs/operator/README.md');
  const surfaceContract = read('docs/operator/surface-contract.md');
  const supportedSurfaces = read('docs/operator/supported-surfaces.md');
  const runtimeSurfaces = read('context/core/runtime-surfaces.md');
  const projectConfig = read('context/core/project-config.md');
  const workflow = read('context/core/workflow.md');
  const parallelMatrix = read('docs/maintainer/parallel-execution-matrix.md');

  assert.match(readme, /npm install -g @duypham93\/openkit/);
  assert.match(readme, /openkit doctor/);
  assert.match(readme, /openkit run/);
  assert.match(readme, /openkit upgrade/);
  assert.match(readme, /openkit uninstall/);
  assert.match(readme, /manual\/compatibility helper/);

  assert.match(operator, /Lane And Artifact Expectations/);
  assert.match(operator, /Product Lead scope package in `docs\/scope\/` before Solution Lead package/);
  assert.match(surfaceContract, /global_cli/);
  assert.match(surfaceContract, /target_project_app/);

  for (const doc of [supportedSurfaces, runtimeSurfaces, projectConfig]) {
    assert.match(doc, /available/);
    assert.match(doc, /unavailable/);
    assert.match(doc, /degraded/);
    assert.match(doc, /preview/);
    assert.match(doc, /compatibility_only/);
    assert.match(doc, /not_configured/);
    assert.match(doc, /target_project_app/);
  }

  assert.match(workflow, /parallel_mode = none/);
  assert.match(workflow, /full-delivery task-board semantics are not applied to migration by default/);
  assert.match(parallelMatrix, /parallel_mode: none/);
  assert.match(parallelMatrix, /Master Orchestrator remains route\/state\/gate control only/);
});
