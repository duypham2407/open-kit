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

test('workflow command prompts reference shared prompt contracts except model configuration helper', () => {
  for (const file of listMarkdownFiles('commands')) {
    if (file.endsWith('configure-agent-models.md')) {
      continue;
    }
    const contents = read(file);
    assert.match(contents, /prompt-contracts\.md/);
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
    'commands/write-plan.md',
    'commands/execute-plan.md',
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

test('package scripts expose governance and install-bundle verification gates', () => {
  const packageJson = JSON.parse(read('package.json'));

  assert.equal(typeof packageJson.scripts['sync:install-bundle'], 'string');
  assert.equal(typeof packageJson.scripts['verify:install-bundle'], 'string');
  assert.equal(typeof packageJson.scripts['verify:governance'], 'string');
  assert.equal(typeof packageJson.scripts['verify:all'], 'string');
});

test('repository defines CI workflow for verification gates', () => {
  const workflow = read('.github/workflows/verify.yml');

  assert.match(workflow, /name: Verify/);
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /npm run verify:all/);
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

  assert.match(workflow, /scope package/i);
  assert.match(workflow, /solution package/i);
  assert.match(schema, /scope_package/);
  assert.match(schema, /solution_package/);
  assert.match(policy, /Code Reviewer/);
  assert.match(policy, /QA Agent/);
});
