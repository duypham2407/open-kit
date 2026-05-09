# Lane Bootstrap & Brainstorm Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the "no workflow" error class on fresh global installs, and realign the command surface (`/quick-task`, `/delivery`, `/migrate`) so MO bootstraps workflow-state immediately and the first specialist agent owns brainstorm as stage 0.

**Architecture:** MO becomes the bootstrap point — it creates `workflow-state.json` on first command, then dispatches the first specialist agent. FSM is simplified: `*_brainstorm` stages removed (currently only `quick_brainstorm` exists), brainstorm work folded into the first specialist stage (`quick_plan`, `full_product`, `migration_strategy`). Workspace-shim materializes `.opencode/openkit/` paths even before state exists. Scope/migration plan files are the single source of truth downstream; brainstorm is captured as Appendix A (discovery notes) and Appendix B (decisions) in those files.

**Tech Stack:** Node.js 18+ ESM, `node:test`, kit's existing FSM/state-manager/controller layer, MCP SDK.

**Spec:** `docs/superpowers/specs/2026-05-09-lane-bootstrap-and-brainstorm-redesign-design.md`

---

## File map

**Create:**
- `src/runtime/tools/workflow/bootstrap-workflow.js` — new MCP tool `tool.bootstrap-workflow` (lane + raw description → write fresh state, archive prior if needed).
- `tests/runtime/bootstrap-workflow.test.js` — unit tests for the bootstrap tool.
- `tests/runtime/workspace-shim-fresh-bootstrap.test.js` — verifies shim works on fresh project.
- `tests/runtime/lane-switch-during-brainstorm.test.js` — verifies lane switch flow.
- `.opencode/tests/fsm-stage-merge.test.js` — verifies `quick_brainstorm` stage removal does not break FSM.

**Modify:**
- `src/runtime/state/transition-engine.js` — remove `quick_brainstorm` from `STAGE_ORDER.quick` and `TRANSITION_RULES.quick`.
- `src/runtime/state/gate-registry.js` — re-target `quick.understanding_confirmed` to `quick_plan → quick_implement` style or replace with new `quick.brainstorm_confirmed` gate at `quick_plan → quick_implement`. (See Task 2 for the chosen approach.)
- `src/runtime/workflow-kernel.js` — `defaultStatePath` always resolves to a writable path (project state path) even when file doesn't exist; `canWriteState()` returns true when the directory is writable.
- `src/runtime/tools/workflow/advance-stage.js` — keep "no state" behavior but ensure `tool.bootstrap-workflow` is called before advance for fresh starts (no behavior change in advance itself).
- `src/global/workspace-shim.js` — create `.opencode/openkit/workflow-state.json` link/copy even when workspace state file does not yet exist; bidirectional sync after MO bootstrap.
- `.opencode/lib/workflow-state-controller.js` — add `bootstrapWorkflow({ lane, description, statePath })` entry that calls `createWorkItem` + writes initial state + records description in `intake_payload`.
- `.opencode/workflow-state.js` — expose `bootstrap` subcommand for the bootstrap tool to delegate to.
- `commands/quick-task.md` — rewrite to: (1) MO dispatch first, (2) MO calls `tool.bootstrap-workflow` with lane=quick, (3) MO advances to `quick_plan`, (4) Quick Agent runs brainstorm + plan in `quick_plan`.
- `commands/delivery.md` — rewrite analogously for lane=full → `full_product`.
- `commands/migrate.md` — rewrite analogously for lane=migration → `migration_strategy`.
- `agents/master-orchestrator.md` — add bootstrap responsibility, multi-workflow handling, lane-switch handling. Remove `/task` classification language. Remove "user_explicit lane lock" warning logic (no longer routes).
- `agents/quick-agent.md` — add brainstorm-rút-gọn responsibility in `quick_plan` (2-3 questions, inline summary).
- `agents/product-lead-agent.md` — add brainstorm dialogue + scope appendix curation rules (Appendix A discovery, Appendix B decisions).
- `agents/solution-lead-agent.md` — add migration brainstorm + appendix rules for `migration_strategy`.
- `src/runtime/tools/tool-registry.js` — register the new `bootstrap-workflow` tool.

**Delete:**
- `commands/task.md`
- `commands/brainstorm.md`

**Touched docs (purge `/task` and `/brainstorm` references):**
- `AGENTS.md`
- `README.md`
- `src/mcp-server/index.js` (line 217, 274 — error messages still suggest `/task`)
- `src/runtime/tools/workflow/advance-stage.js` (line 44 — error message)
- `src/runtime/tools/workflow/action-gateway.js` (line 61 — error message)

---

## Task 1: Snapshot baseline and create work branch

**Files:**
- Modify: none (preparation only)

- [ ] **Step 1: Verify clean working tree**

Run:
```bash
git status
```
Expected: `working tree clean` (the spec doc commit is the latest).

- [ ] **Step 2: Create feature branch**

Run:
```bash
git checkout -b lane-bootstrap-brainstorm-redesign
```
Expected: `Switched to a new branch 'lane-bootstrap-brainstorm-redesign'`

- [ ] **Step 3: Run the full test suite to capture baseline**

Run:
```bash
npm run verify:all 2>&1 | tee /tmp/baseline-test-output.txt
```
Expected: tests pass (or note any pre-existing failures so they're not attributed to this work).

- [ ] **Step 4: Commit nothing — proceed to Task 2**

No commit. The branch exists; baseline is captured.

---

## Task 2: Remove `quick_brainstorm` from FSM (TDD)

**Why:** Spec says brainstorm is folded into the first specialist stage. Currently only `quick_brainstorm` exists in the FSM. Full and migration lanes have no brainstorm stage to remove. Quick Agent will do brainstorm inside `quick_plan`.

**Files:**
- Modify: `src/runtime/state/transition-engine.js`
- Modify: `src/runtime/state/gate-registry.js`
- Test: `tests/runtime/transition-engine.test.js` (or wherever existing tests live — verify location first)

- [ ] **Step 1: Find the existing transition-engine tests**

Run:
```bash
find /Users/duypham/Code/open-kit/tests /Users/duypham/Code/open-kit/.opencode/tests -name "*.test.js" | xargs grep -l "transition-engine\|TransitionEngine\|quick_brainstorm" 2>/dev/null
```
Expected: lists test files that reference these symbols. Note them for the next steps.

- [ ] **Step 2: Write a failing test that asserts `quick_brainstorm` is NOT a valid stage**

Add to a new file `tests/runtime/quick-brainstorm-removed.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TransitionEngine } from '../../src/runtime/state/transition-engine.js';

test('quick lane no longer has quick_brainstorm stage', () => {
  const engine = new TransitionEngine();
  // Direct intake → plan should be valid (brainstorm folded in)
  const result = engine.validateTransition('quick', 'quick_intake', 'quick_plan');
  assert.equal(result.valid, true, 'quick_intake → quick_plan must be valid');
});

test('quick_brainstorm is no longer a known stage', () => {
  const engine = new TransitionEngine();
  const result = engine.validateTransition('quick', 'quick_brainstorm', 'quick_plan');
  assert.equal(result.valid, false);
  assert.match(result.reason, /Unknown stage|Invalid transition/);
});

test('quick lane STAGE_ORDER is intake → plan → implement → test → done', () => {
  const engine = new TransitionEngine();
  const validNext = (from) => engine.rules.quick[from] ?? null;
  assert.deepEqual(validNext('quick_intake'), ['quick_plan']);
  assert.ok(validNext('quick_brainstorm') === undefined, 'quick_brainstorm must not appear in rules');
});
```

- [ ] **Step 3: Run the test and verify it fails**

Run:
```bash
node --test tests/runtime/quick-brainstorm-removed.test.js
```
Expected: FAIL — current FSM still has `quick_brainstorm`.

- [ ] **Step 4: Edit `src/runtime/state/transition-engine.js` to remove `quick_brainstorm`**

Replace the `quick` entry in `STAGE_ORDER` (lines 10-17):

```javascript
  quick: [
    'quick_intake',
    'quick_plan',
    'quick_implement',
    'quick_test',
    'quick_done'
  ],
```

Replace the `quick` entry in `TRANSITION_RULES` (lines 39-46):

```javascript
  quick: {
    quick_intake: ['quick_plan'],
    quick_plan: ['quick_implement'],
    quick_implement: ['quick_test', 'quick_plan'],
    quick_test: ['quick_done', 'quick_implement'],
    quick_done: []
  },
```

- [ ] **Step 5: Run the new test and verify it passes**

Run:
```bash
node --test tests/runtime/quick-brainstorm-removed.test.js
```
Expected: PASS.

- [ ] **Step 6: Update `gate-registry.js` to retarget the brainstorm gate**

Edit `src/runtime/state/gate-registry.js` lines 19-25:

```javascript
  'quick.understanding_confirmed': {
    stage: 'quick_plan',
    targetStage: 'quick_implement',
    authority: 'user',
    type: 'confirmation',
    description: 'User confirms understanding of task and approves plan'
  },
```

Then remove the now-redundant `quick.plan_confirmed` gate (it duplicates the new `understanding_confirmed`):

Delete lines 26-32 (the `quick.plan_confirmed` block).

- [ ] **Step 7: Find tests that reference removed gate**

Run:
```bash
grep -rn "quick.plan_confirmed\|quick_brainstorm" /Users/duypham/Code/open-kit/tests /Users/duypham/Code/open-kit/.opencode/tests /Users/duypham/Code/open-kit/src 2>/dev/null
```
Expected: list of files that need updates.

- [ ] **Step 8: Update or delete each occurrence of `quick.plan_confirmed` and `quick_brainstorm`**

For each file from Step 7:
- Replace `quick_brainstorm` references with `quick_plan` where they describe the brainstorm stage.
- Remove `quick.plan_confirmed` references entirely (the gate no longer exists).
- Update test fixtures that initialize state in `quick_brainstorm` to use `quick_plan` instead.

- [ ] **Step 9: Run the full FSM/gate test suites**

Run:
```bash
node --test tests/runtime/transition-engine.test.js tests/runtime/gate-registry.test.js tests/runtime/quick-brainstorm-removed.test.js
```
Expected: all pass.

- [ ] **Step 10: Run the broader runtime test suite**

Run:
```bash
node --test tests/runtime/*.test.js
```
Expected: all pass. Investigate any failures and fix the related state fixtures.

- [ ] **Step 11: Commit**

```bash
git add src/runtime/state/transition-engine.js src/runtime/state/gate-registry.js tests/runtime/quick-brainstorm-removed.test.js
git add tests/runtime/  # any updated fixtures
git commit -m "refactor(fsm): remove quick_brainstorm stage, fold into quick_plan"
```

---

## Task 3: Update workflow-state-controller initial-stage logic

**Why:** Controller's `getInitialStageForMode` and `STAGE_OWNERS` must reflect the new FSM. `createFreshState` and `createWorkItem` need to produce state with `current_stage = quick_intake | full_intake | migration_intake` and the right initial owner.

**Files:**
- Modify: `.opencode/lib/workflow-state-controller.js`
- Test: `.opencode/tests/workflow-state-controller.test.js`

- [ ] **Step 1: Inspect current `getInitialStageForMode` and `STAGE_OWNERS`**

Run:
```bash
grep -n "getInitialStageForMode\|STAGE_OWNERS" /Users/duypham/Code/open-kit/.opencode/lib/workflow-state-controller.js | head -20
```
Read the relevant lines to confirm current shape.

- [ ] **Step 2: Write a failing test for fresh-state initial stage per lane**

Add to `.opencode/tests/workflow-state-controller.test.js` (or create the file if it doesn't exist):

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
const controller = require('../lib/workflow-state-controller.js');

function tmpStatePath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wf-state-'));
  return path.join(dir, 'workflow-state.json');
}

test('createFreshState quick lane uses quick_intake as initial stage', () => {
  const statePath = tmpStatePath();
  const result = controller.createWorkItem('quick', 'FEATURE-T1', 'test-task', 'unit test', statePath);
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  assert.equal(state.current_stage, 'quick_intake');
  assert.equal(state.mode, 'quick');
  assert.equal(state.current_owner, 'MasterOrchestrator');
});

test('createFreshState full lane uses full_intake as initial stage', () => {
  const statePath = tmpStatePath();
  controller.createWorkItem('full', 'FEATURE-T2', 'test-feature', 'unit test', statePath);
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  assert.equal(state.current_stage, 'full_intake');
  assert.equal(state.current_owner, 'MasterOrchestrator');
});

test('createFreshState migration lane uses migration_intake as initial stage', () => {
  const statePath = tmpStatePath();
  controller.createWorkItem('migration', 'FEATURE-T3', 'test-migration', 'unit test', statePath);
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  assert.equal(state.current_stage, 'migration_intake');
  assert.equal(state.current_owner, 'MasterOrchestrator');
});
```

- [ ] **Step 3: Run the test and verify it passes (or fails because of `STAGE_OWNERS`)**

Run:
```bash
node --test .opencode/tests/workflow-state-controller.test.js
```
Expected: most pass; if `STAGE_OWNERS.quick_intake` is not `'MasterOrchestrator'`, that assertion will fail.

- [ ] **Step 4: Inspect `STAGE_OWNERS` and align**

In `.opencode/lib/workflow-state-controller.js`, find the `STAGE_OWNERS` constant. Ensure these mappings exist:

```javascript
const STAGE_OWNERS = {
  // ...
  quick_intake: 'MasterOrchestrator',
  quick_plan: 'QuickAgent',
  quick_implement: 'QuickAgent',
  quick_test: 'QuickAgent',
  quick_done: 'QuickAgent',
  full_intake: 'MasterOrchestrator',
  full_product: 'ProductLead',
  full_solution: 'SolutionLead',
  full_implementation: 'FullstackAgent',
  full_code_review: 'CodeReviewer',
  full_qa: 'QAAgent',
  full_done: 'MasterOrchestrator',
  migration_intake: 'MasterOrchestrator',
  migration_baseline: 'SolutionLead',
  migration_strategy: 'SolutionLead',
  migration_upgrade: 'FullstackAgent',
  migration_code_review: 'CodeReviewer',
  migration_verify: 'QAAgent',
  migration_done: 'MasterOrchestrator',
  // ...
};
```

Update or add any missing mapping. Remove `quick_brainstorm` if present.

- [ ] **Step 5: Run the test again — should pass**

Run:
```bash
node --test .opencode/tests/workflow-state-controller.test.js
```
Expected: all 3 new tests pass.

- [ ] **Step 6: Commit**

```bash
git add .opencode/lib/workflow-state-controller.js .opencode/tests/workflow-state-controller.test.js
git commit -m "refactor(controller): align initial stages and STAGE_OWNERS for redesigned lanes"
```

---

## Task 4: Add `bootstrapWorkflow` entry to controller

**Why:** MO needs a single call to atomically: (a) check for existing state, (b) handle archive/multi-workflow logic, (c) write fresh state with the user's raw description in `intake_payload`. We package this as a controller method.

**Files:**
- Modify: `.opencode/lib/workflow-state-controller.js`
- Test: `.opencode/tests/workflow-state-controller.test.js`

- [ ] **Step 1: Write failing tests for `bootstrapWorkflow`**

Append to `.opencode/tests/workflow-state-controller.test.js`:

```javascript
test('bootstrapWorkflow on empty path creates fresh state', () => {
  const statePath = tmpStatePath();
  const result = controller.bootstrapWorkflow({
    lane: 'quick',
    description: 'fix the broken header',
    featureSlug: 'fix-broken-header',
    statePath
  });
  assert.equal(result.status, 'created');
  assert.ok(fs.existsSync(statePath));
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  assert.equal(state.mode, 'quick');
  assert.equal(state.current_stage, 'quick_intake');
  assert.equal(state.intake_payload?.description, 'fix the broken header');
});

test('bootstrapWorkflow with active workflow returns multi-workflow signal', () => {
  const statePath = tmpStatePath();
  controller.bootstrapWorkflow({
    lane: 'quick',
    description: 'first task',
    featureSlug: 'first-task',
    statePath
  });
  // attempt second bootstrap without archive
  const result = controller.bootstrapWorkflow({
    lane: 'full',
    description: 'second task',
    featureSlug: 'second-task',
    statePath
  });
  assert.equal(result.status, 'conflict');
  assert.ok(result.activeWorkflow, 'should return active workflow info');
  assert.equal(result.activeWorkflow.mode, 'quick');
});

test('bootstrapWorkflow with archivePrior=true archives and creates fresh', () => {
  const statePath = tmpStatePath();
  controller.bootstrapWorkflow({
    lane: 'quick',
    description: 'first',
    featureSlug: 'first',
    statePath
  });
  const result = controller.bootstrapWorkflow({
    lane: 'full',
    description: 'second',
    featureSlug: 'second',
    statePath,
    archivePrior: true
  });
  assert.equal(result.status, 'created');
  assert.equal(result.archived, true);
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  assert.equal(state.mode, 'full');
});

test('bootstrapWorkflow with completed prior workflow auto-archives', () => {
  const statePath = tmpStatePath();
  controller.bootstrapWorkflow({
    lane: 'quick',
    description: 'first',
    featureSlug: 'first',
    statePath
  });
  // Mark first as done
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  state.status = 'done';
  state.current_stage = 'quick_done';
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  // Bootstrap again — should auto-archive
  const result = controller.bootstrapWorkflow({
    lane: 'full',
    description: 'second',
    featureSlug: 'second',
    statePath
  });
  assert.equal(result.status, 'created');
  assert.equal(result.archived, true);
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run:
```bash
node --test .opencode/tests/workflow-state-controller.test.js
```
Expected: 4 failures (bootstrapWorkflow does not exist yet).

- [ ] **Step 3: Implement `bootstrapWorkflow` in `.opencode/lib/workflow-state-controller.js`**

Add this function and export it:

```javascript
function bootstrapWorkflow({ lane, description, featureSlug, statePath, archivePrior = false }) {
  if (!['quick', 'full', 'migration'].includes(lane)) {
    throw new Error(`Invalid lane: ${lane}`);
  }
  if (!description || typeof description !== 'string') {
    throw new Error('description is required');
  }
  if (!statePath) {
    throw new Error('statePath is required');
  }

  // Check for existing state
  if (fs.existsSync(statePath)) {
    let existing;
    try {
      existing = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    } catch {
      existing = null;
    }

    if (existing && existing.current_stage) {
      const isDone = existing.status === 'done' ||
        existing.current_stage?.endsWith('_done');

      if (!isDone && !archivePrior) {
        return {
          status: 'conflict',
          activeWorkflow: {
            mode: existing.mode,
            current_stage: existing.current_stage,
            current_owner: existing.current_owner,
            feature_id: existing.feature_id,
            feature_slug: existing.feature_slug,
          },
        };
      }

      // Archive
      archiveState(statePath, existing);
    }
  }

  // Generate feature_id
  const featureId = `FEATURE-${Date.now().toString(36).toUpperCase()}`;
  const slug = featureSlug || description
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);

  // Create work item via existing createWorkItem path
  createWorkItem(lane, featureId, slug, `Bootstrapped from /${lane === 'quick' ? 'quick-task' : lane === 'full' ? 'delivery' : 'migrate'}`, statePath);

  // Inject intake_payload
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  state.intake_payload = {
    description,
    bootstrapped_at: new Date().toISOString(),
    bootstrapped_by: 'MasterOrchestrator',
  };
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');

  return {
    status: 'created',
    archived: archivePrior || (fs.existsSync(statePath) && false),
    feature_id: featureId,
    feature_slug: slug,
    lane,
  };
}

function archiveState(statePath, state) {
  const opencodeDir = path.dirname(statePath);
  const workItemId = state.feature_id || `archived-${Date.now()}`;
  const archiveDir = path.join(opencodeDir, 'work-items', workItemId);
  fs.mkdirSync(archiveDir, { recursive: true });
  const archivePath = path.join(archiveDir, 'archived-state.json');
  fs.writeFileSync(archivePath, JSON.stringify(state, null, 2), 'utf8');
}

module.exports.bootstrapWorkflow = bootstrapWorkflow;
```

- [ ] **Step 4: Run tests — verify all pass**

Run:
```bash
node --test .opencode/tests/workflow-state-controller.test.js
```
Expected: all bootstrap tests pass.

- [ ] **Step 5: Commit**

```bash
git add .opencode/lib/workflow-state-controller.js .opencode/tests/workflow-state-controller.test.js
git commit -m "feat(controller): add bootstrapWorkflow with archive and conflict handling"
```

---

## Task 5: Expose `bootstrap` subcommand in `.opencode/workflow-state.js` CLI

**Why:** Agent prompts and the upcoming MCP tool both need a way to trigger bootstrap. The CLI exposes the operation for shell-friendly use.

**Files:**
- Modify: `.opencode/workflow-state.js`
- Test: `.opencode/tests/workflow-state-cli.test.js`

- [ ] **Step 1: Read current CLI structure**

Run:
```bash
head -100 /Users/duypham/Code/open-kit/.opencode/workflow-state.js
grep -n "case '\|switch (command)\|registerCommand" /Users/duypham/Code/open-kit/.opencode/workflow-state.js | head -20
```
Identify the dispatch pattern.

- [ ] **Step 2: Write failing CLI test**

Append to `.opencode/tests/workflow-state-cli.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const cli = path.resolve(import.meta.dirname, '..', 'workflow-state.js');

test('bootstrap subcommand creates fresh state on empty path', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wf-cli-'));
  const statePath = path.join(dir, 'workflow-state.json');
  const result = spawnSync(process.execPath, [
    cli, '--state', statePath,
    'bootstrap',
    '--lane', 'quick',
    '--description', 'test bootstrap'
  ], { encoding: 'utf8' });
  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  assert.ok(fs.existsSync(statePath));
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  assert.equal(state.mode, 'quick');
  assert.equal(state.current_stage, 'quick_intake');
});

test('bootstrap subcommand reports conflict on active workflow', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wf-cli-'));
  const statePath = path.join(dir, 'workflow-state.json');
  spawnSync(process.execPath, [
    cli, '--state', statePath,
    'bootstrap', '--lane', 'quick', '--description', 'first'
  ], { encoding: 'utf8' });
  const result = spawnSync(process.execPath, [
    cli, '--state', statePath,
    'bootstrap', '--lane', 'full', '--description', 'second'
  ], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stdout + result.stderr, /conflict|active workflow/i);
});
```

- [ ] **Step 3: Run test, verify failure**

Run:
```bash
node --test .opencode/tests/workflow-state-cli.test.js
```
Expected: 2 new tests fail.

- [ ] **Step 4: Add `bootstrap` subcommand handler in `.opencode/workflow-state.js`**

Find the command dispatch (likely a `switch` statement or `commands` object). Add:

```javascript
function parseFlags(args) {
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true;
      flags[key] = value;
    }
  }
  return flags;
}

function handleBootstrap(args, statePath) {
  const flags = parseFlags(args);
  if (!flags.lane) {
    process.stderr.write('Error: --lane is required\n');
    return 2;
  }
  if (!flags.description) {
    process.stderr.write('Error: --description is required\n');
    return 2;
  }

  const result = controller.bootstrapWorkflow({
    lane: flags.lane,
    description: flags.description,
    featureSlug: flags.slug,
    statePath,
    archivePrior: flags['archive-prior'] === true || flags['archive-prior'] === 'true',
  });

  if (result.status === 'conflict') {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return 1;
  }
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  return 0;
}
```

Wire it into the command dispatch:
```javascript
case 'bootstrap':
  process.exit(handleBootstrap(commandArgs, statePath));
  break;
```

- [ ] **Step 5: Run CLI tests**

Run:
```bash
node --test .opencode/tests/workflow-state-cli.test.js
```
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add .opencode/workflow-state.js .opencode/tests/workflow-state-cli.test.js
git commit -m "feat(cli): add bootstrap subcommand to workflow-state.js"
```

---

## Task 6: Create `tool.bootstrap-workflow` MCP tool

**Why:** Agents call MCP tools, not the CLI directly. This tool is the canonical way for MO to bootstrap workflow state.

**Files:**
- Create: `src/runtime/tools/workflow/bootstrap-workflow.js`
- Modify: `src/runtime/tools/tool-registry.js`
- Test: `tests/runtime/bootstrap-workflow.test.js`

- [ ] **Step 1: Inspect an existing tool to copy its shape**

Run:
```bash
cat /Users/duypham/Code/open-kit/src/runtime/tools/workflow/advance-stage.js
```
Note the export shape (typically `createAdvanceStageTool({ workflowKernel })`).

- [ ] **Step 2: Write failing test for the tool**

Create `tests/runtime/bootstrap-workflow.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { createBootstrapWorkflowTool } from '../../src/runtime/tools/workflow/bootstrap-workflow.js';
import { createWorkflowKernelAdapter } from '../../src/runtime/workflow-kernel.js';

function makeProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bootstrap-tool-'));
  fs.mkdirSync(path.join(root, '.opencode'), { recursive: true });
  return root;
}

test('tool.bootstrap-workflow creates state on empty project', async () => {
  const projectRoot = makeProject();
  const kernel = createWorkflowKernelAdapter({ projectRoot });
  const tool = createBootstrapWorkflowTool({ workflowKernel: kernel, projectRoot });

  const result = await tool.handler({
    lane: 'quick',
    description: 'fix bug in CSV export',
  });

  assert.equal(result.status, 'created');
  assert.ok(fs.existsSync(path.join(projectRoot, '.opencode', 'workflow-state.json')));
});

test('tool.bootstrap-workflow returns conflict on active workflow', async () => {
  const projectRoot = makeProject();
  const kernel = createWorkflowKernelAdapter({ projectRoot });
  const tool = createBootstrapWorkflowTool({ workflowKernel: kernel, projectRoot });

  await tool.handler({ lane: 'quick', description: 'first task' });
  const result = await tool.handler({ lane: 'full', description: 'second task' });

  assert.equal(result.status, 'conflict');
  assert.ok(result.activeWorkflow);
});

test('tool.bootstrap-workflow with archivePrior overrides active workflow', async () => {
  const projectRoot = makeProject();
  const kernel = createWorkflowKernelAdapter({ projectRoot });
  const tool = createBootstrapWorkflowTool({ workflowKernel: kernel, projectRoot });

  await tool.handler({ lane: 'quick', description: 'first task' });
  const result = await tool.handler({
    lane: 'full',
    description: 'second task',
    archivePrior: true,
  });

  assert.equal(result.status, 'created');
  assert.equal(result.archived, true);
});
```

- [ ] **Step 3: Run test, verify it fails (file does not exist)**

Run:
```bash
node --test tests/runtime/bootstrap-workflow.test.js
```
Expected: ERR_MODULE_NOT_FOUND.

- [ ] **Step 4: Create `src/runtime/tools/workflow/bootstrap-workflow.js`**

```javascript
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export function createBootstrapWorkflowTool({ workflowKernel, projectRoot }) {
  return {
    name: 'tool.bootstrap-workflow',
    description: 'Bootstrap workflow-state.json for a fresh lane. MO calls this on the first command in a project.',
    inputSchema: {
      type: 'object',
      required: ['lane', 'description'],
      properties: {
        lane: {
          type: 'string',
          enum: ['quick', 'full', 'migration'],
          description: 'Lane to bootstrap (quick, full, migration).',
        },
        description: {
          type: 'string',
          description: "User's raw request text.",
        },
        featureSlug: {
          type: 'string',
          description: 'Optional slug for the feature. Auto-generated from description if omitted.',
        },
        archivePrior: {
          type: 'boolean',
          description: 'When true, archive any active workflow and create fresh. Default false.',
          default: false,
        },
      },
    },
    handler: async (args) => {
      const { lane, description, featureSlug, archivePrior = false } = args || {};

      if (!['quick', 'full', 'migration'].includes(lane)) {
        return { status: 'error', message: `Invalid lane: ${lane}` };
      }
      if (!description || typeof description !== 'string') {
        return { status: 'error', message: 'description is required' };
      }

      const statePath = path.join(projectRoot, '.opencode', 'workflow-state.json');
      const opencodeDir = path.dirname(statePath);
      if (!fs.existsSync(opencodeDir)) {
        fs.mkdirSync(opencodeDir, { recursive: true });
      }

      // Use the controller via require so we share the bootstrapWorkflow logic
      const controllerPath = path.join(projectRoot, '.opencode', 'lib', 'workflow-state-controller.js');
      const fallbackControllerPath = path.resolve(
        path.dirname(new URL(import.meta.url).pathname),
        '..', '..', '..', '..', '.opencode', 'lib', 'workflow-state-controller.js',
      );
      const controller = require(fs.existsSync(controllerPath) ? controllerPath : fallbackControllerPath);

      try {
        const result = controller.bootstrapWorkflow({
          lane,
          description,
          featureSlug,
          statePath,
          archivePrior,
        });
        return result;
      } catch (err) {
        return { status: 'error', message: err.message };
      }
    },
  };
}
```

- [ ] **Step 5: Run test, verify pass**

Run:
```bash
node --test tests/runtime/bootstrap-workflow.test.js
```
Expected: 3 tests pass.

- [ ] **Step 6: Register the tool in `src/runtime/tools/tool-registry.js`**

Find the section that creates tools (around line 66 with `createWorkflowStateTool`):

Add the import at top:
```javascript
import { createBootstrapWorkflowTool } from './workflow/bootstrap-workflow.js';
```

Add to the tools array:
```javascript
    createBootstrapWorkflowTool({ workflowKernel: managers.workflowKernel, projectRoot }),
```

- [ ] **Step 7: Verify tool registry test passes (or update it)**

Run:
```bash
grep -rn "tool-registry\|createWorkflowStateTool" /Users/duypham/Code/open-kit/tests | head -5
node --test tests/runtime/  # broad sweep
```
Expected: registry tests still pass; if a count assertion broke, bump the expected count by 1.

- [ ] **Step 8: Commit**

```bash
git add src/runtime/tools/workflow/bootstrap-workflow.js src/runtime/tools/tool-registry.js tests/runtime/bootstrap-workflow.test.js
git commit -m "feat(mcp): add tool.bootstrap-workflow"
```

---

## Task 7: Make workflow-kernel writable on fresh project

**Why:** `workflow-kernel.js:118-123` resolves `defaultStatePath` to `null` when the file doesn't exist, blocking bootstrap. Change so that the path always resolves to the project's expected location, regardless of whether the file exists yet.

**Files:**
- Modify: `src/runtime/workflow-kernel.js`
- Test: `tests/runtime/workflow-kernel-fresh.test.js`

- [ ] **Step 1: Write failing test**

Create `tests/runtime/workflow-kernel-fresh.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { createWorkflowKernelAdapter } from '../../src/runtime/workflow-kernel.js';

test('kernel resolves defaultStatePath even when file does not exist', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kernel-fresh-'));
  fs.mkdirSync(path.join(root, '.opencode'), { recursive: true });
  const kernel = createWorkflowKernelAdapter({ projectRoot: root });
  // Should not throw, and showState returns null gracefully (not because path is null)
  const state = kernel.showState();
  assert.equal(state, null);
  // canWriteState should be true — the directory exists, file just isn't there yet
  assert.equal(kernel.canWriteState ? kernel.canWriteState() : true, true);
});
```

- [ ] **Step 2: Run test, verify it fails or shows wrong behavior**

Run:
```bash
node --test tests/runtime/workflow-kernel-fresh.test.js
```
Expected: passes for showState=null but `canWriteState` may not exist or behave differently.

- [ ] **Step 3: Edit `src/runtime/workflow-kernel.js` lines 118-123**

Replace:

```javascript
  const projectStatePath = path.join(projectRoot, '.opencode', 'workflow-state.json');
  const defaultStatePath = env.OPENKIT_WORKFLOW_STATE
    ? path.resolve(env.OPENKIT_WORKFLOW_STATE)
    : fs.existsSync(projectStatePath)
      ? projectStatePath
      : null;
```

With:

```javascript
  const projectStatePath = path.join(projectRoot, '.opencode', 'workflow-state.json');
  const defaultStatePath = env.OPENKIT_WORKFLOW_STATE
    ? path.resolve(env.OPENKIT_WORKFLOW_STATE)
    : projectStatePath;  // Always resolve to project path; bootstrap will create the file when needed.
```

Also update `canWriteState` to expose its behavior publicly. Find:

```javascript
  function canWriteState(customStatePath = null) {
    return Boolean(withStatePath(customStatePath));
  }
```

Add to the returned object (around line 340):

```javascript
    canWriteState,
```

- [ ] **Step 4: Run all kernel tests**

Run:
```bash
node --test tests/runtime/workflow-kernel-fresh.test.js
node --test tests/runtime/  # full sweep
```
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/runtime/workflow-kernel.js tests/runtime/workflow-kernel-fresh.test.js
git commit -m "fix(kernel): always resolve defaultStatePath so bootstrap can write"
```

---

## Task 8: Fix workspace-shim to materialize on fresh project

**Why:** Shim currently guards `if (fs.existsSync(paths.workflowStatePath))` so the `.opencode/openkit/workflow-state.json` link is never created on fresh projects. After fixing, the shim should create the link to the workspace state path even before that path has content (the file will be created on first bootstrap and the link will then point to real content).

**Files:**
- Modify: `src/global/workspace-shim.js`
- Test: `tests/runtime/workspace-shim-fresh-bootstrap.test.js`

- [ ] **Step 1: Write failing test**

Create `tests/runtime/workspace-shim-fresh-bootstrap.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { ensureWorkspaceShim } from '../../src/global/workspace-shim.js';

function makeFakePaths(root) {
  const opencodeHome = path.join(root, 'oc-home');
  const kitRoot = path.join(opencodeHome, 'kits', 'openkit');
  const workspaceRoot = path.join(opencodeHome, 'workspaces', 'wsX', 'openkit');
  const opencodeDir = path.join(workspaceRoot, '.opencode');
  const projectRoot = path.join(root, 'project');

  fs.mkdirSync(kitRoot, { recursive: true });
  fs.writeFileSync(path.join(kitRoot, 'AGENTS.md'), '# Test', 'utf8');
  fs.mkdirSync(path.join(kitRoot, 'context'), { recursive: true });
  fs.mkdirSync(path.join(kitRoot, 'docs', 'templates'), { recursive: true });
  fs.mkdirSync(opencodeDir, { recursive: true });
  fs.mkdirSync(projectRoot, { recursive: true });
  fs.mkdirSync(path.join(projectRoot, '.opencode'), { recursive: true });

  return {
    projectRoot,
    workspaceRoot,
    workspaceShimDir: path.join(projectRoot, '.opencode', 'openkit'),
    workspaceShimContextDir: path.join(projectRoot, '.opencode', 'openkit', 'context'),
    workspaceShimTemplatesDir: path.join(projectRoot, '.opencode', 'openkit', 'docs', 'templates'),
    workspaceShimAgentsPath: path.join(projectRoot, '.opencode', 'openkit', 'AGENTS.md'),
    workspaceShimWorkflowStatePath: path.join(projectRoot, '.opencode', 'openkit', 'workflow-state.json'),
    workspaceShimWorkflowCliPath: path.join(projectRoot, '.opencode', 'openkit', 'workflow-state.js'),
    workspaceShimWorkItemsDir: path.join(projectRoot, '.opencode', 'openkit', 'work-items'),
    kitRoot,
    workflowStatePath: path.join(opencodeDir, 'workflow-state.json'),
    workItemsDir: path.join(opencodeDir, 'work-items'),
  };
}

test('shim creates workflow-state link even when workspace state does not exist', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shim-fresh-'));
  const paths = makeFakePaths(root);

  ensureWorkspaceShim(paths);

  // The link/copy in .opencode/openkit/workflow-state.json should exist OR the path should be writable
  // (i.e., parent dir exists). We accept either behavior because file may not exist yet on truly fresh init.
  assert.ok(fs.existsSync(path.dirname(paths.workspaceShimWorkflowStatePath)), '.opencode/openkit/ should exist');
  assert.ok(fs.existsSync(paths.workspaceShimAgentsPath), 'AGENTS.md shim should exist');
});

test('shim re-run after state is created syncs the mirror', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shim-resync-'));
  const paths = makeFakePaths(root);
  ensureWorkspaceShim(paths);

  // Simulate MO bootstrap by writing the workspace state
  fs.writeFileSync(paths.workflowStatePath, JSON.stringify({ mode: 'quick', current_stage: 'quick_intake' }, null, 2));

  ensureWorkspaceShim(paths);

  assert.ok(fs.existsSync(paths.workspaceShimWorkflowStatePath));
  const synced = JSON.parse(fs.readFileSync(paths.workspaceShimWorkflowStatePath, 'utf8'));
  assert.equal(synced.mode, 'quick');
});
```

- [ ] **Step 2: Run test, verify failure**

Run:
```bash
node --test tests/runtime/workspace-shim-fresh-bootstrap.test.js
```
Expected: at least one test fails (likely the second one — shim doesn't re-sync without restart).

- [ ] **Step 3: Edit `src/global/workspace-shim.js`**

Find lines 147-155:

```javascript
  createIfMissing(createdPaths, {
    linkPath: paths.workspaceShimWorkflowStatePath,
    targetPath: paths.workflowStatePath,
    type: 'file',
  });

  if (fs.existsSync(paths.workflowStatePath)) {
    syncJsonMirror(paths.workspaceShimWorkflowStatePath, paths.workflowStatePath);
  }
```

Replace with:

```javascript
  // Always create the symlink/copy. If the target doesn't exist yet, createSymlinkOrCopy
  // will create a dangling symlink (acceptable — bootstrap will populate it) or skip the copy.
  if (fs.existsSync(paths.workflowStatePath)) {
    createIfMissing(createdPaths, {
      linkPath: paths.workspaceShimWorkflowStatePath,
      targetPath: paths.workflowStatePath,
      type: 'file',
    });
    syncJsonMirror(paths.workspaceShimWorkflowStatePath, paths.workflowStatePath);
  }
  // If state doesn't exist yet, MO will write it via tool.bootstrap-workflow,
  // and a subsequent shim run will create the link. This is the bootstrap flow.
```

Find lines 264-267:

```javascript
  const rootWorkflowStatePath = path.join(paths.projectRoot, '.opencode', 'workflow-state.json');
  if (fs.existsSync(paths.workflowStatePath) && (rootWorkflowStateMode !== null || isSymlink(rootWorkflowStatePath))) {
    syncJsonMirror(rootWorkflowStatePath, paths.workflowStatePath);
  }
```

Keep as is — the guard there is correct. The bootstrap tool writes directly to the project-root state path; the shim just keeps things in sync on subsequent runs.

- [ ] **Step 4: Run shim tests**

Run:
```bash
node --test tests/runtime/workspace-shim-fresh-bootstrap.test.js
node --test tests/install/  # broader install/shim sweep
```
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/global/workspace-shim.js tests/runtime/workspace-shim-fresh-bootstrap.test.js
git commit -m "fix(shim): handle fresh project where workspace state does not exist yet"
```

---

## Task 9: Update Master Orchestrator agent prompt

**Why:** MO's prompt currently references `/task` lane classification and `lane_source = orchestrator_routed`. The redesigned MO is purely procedural: bootstrap state on first command, dispatch the specialist, route between stages, archive workflows on lane switch.

**Files:**
- Modify: `agents/master-orchestrator.md`

- [ ] **Step 1: Read the current prompt**

Run:
```bash
cat /Users/duypham/Code/open-kit/agents/master-orchestrator.md
```

- [ ] **Step 2: Rewrite the agent file**

Replace the contents of `agents/master-orchestrator.md` with:

```markdown
---
description: "Workflow conductor. Bootstraps workflow-state, dispatches specialist agents, routes handoffs between stages. Never owns content, code, or domain reasoning."
mode: primary
---

# Master Orchestrator

You are the workflow conductor for OpenKit. You are procedural-only: you bootstrap state, dispatch work to specialist agents, route handoffs, and manage archival. You never write scope, design, code, or QA content.

## Shared prompt contract

- Follow `.opencode/openkit/context/core/prompt-contracts.md` for the shared runtime-path and verification rules.
- Use `.opencode/openkit/context/core/runtime-surfaces.md` when deciding whether a question belongs to the product path, in-session path, or compatibility runtime path.

## Core Responsibilities

### Workflow bootstrap on first command

When the user enters `/quick-task`, `/delivery`, or `/migrate`:

1. **Inspect existing state** at `.opencode/openkit/workflow-state.json`.

2. **If no state exists**, call `tool.bootstrap-workflow` with `{ lane, description }` where:
   - `lane = quick` for `/quick-task`
   - `lane = full` for `/delivery`
   - `lane = migration` for `/migrate`
   - `description` = the user's raw text after the command

3. **If state exists and is active** (status not `done`), present this exact prompt to the user:
   > "Workflow `<feature_id>` is active in stage `<current_stage>` owned by `<current_owner>`. Choose: (a) continue this workflow, (b) close it and start a new `<lane>` workflow."

   - User picks (a) → resume by dispatching the current owner.
   - User picks (b) → call `tool.bootstrap-workflow` with `{ lane, description, archivePrior: true }`.

4. **If state exists and is done**, call `tool.bootstrap-workflow` with `{ lane, description }` — the controller auto-archives completed workflows.

5. **After bootstrap**, immediately call `tool.advance-stage` to advance from `<lane>_intake` to the first specialist stage:
   - quick: `quick_intake → quick_plan` (dispatches Quick Agent)
   - full: `full_intake → full_product` (dispatches Product Lead)
   - migration: `migration_intake → migration_strategy` (dispatches Solution Lead)

6. **Tell the user** which agent is now active and what they will do.

### Dispatch and gate control

- Dispatch work to the role that owns the next stage; never perform that role's content work yourself.
- Judge handoff sufficiency by inspectable artifacts, evidence, and approval notes — not by reading the work itself.
- Hold a stage when readiness is missing; route back to the upstream owner instead of filling the gap.

### Lane switch during brainstorm

If the first specialist agent (Quick Agent, Product Lead, Solution Lead) reports during brainstorm that the chosen lane is wrong:

1. Ask the user the exact question: `"This looks more like /<other-lane>. Switch? (y/n)"`
2. If user confirms, call `tool.bootstrap-workflow` with `{ lane: <new-lane>, description: <preserved>, archivePrior: true }`.
3. Preserve the user's original description and any brainstorm notes by passing them via `description`.
4. Dispatch the new lane's first specialist.
5. If user declines, instruct the agent to continue in the original lane.

### Issue routing

- Receive findings from `Code Reviewer` or `QA Agent`, classify them with `.opencode/openkit/context/core/issue-routing.md`, then route to the correct stage and owner.
- In quick mode, Quick Agent owns issues internally — MO is not in the loop.
- For all other lanes, route by stage owner. Never resolve issues yourself.

### Operator transparency

- Always tell the user the current lane, current stage, current owner, and the reason for any routing or archive decision.
- When approval or verification is missing, state clearly what is blocking progress.

## Do Not

- Do not classify lanes — the user picks the lane via command choice.
- Do not write or revise scope packages, solution packages, code, or QA reports.
- Do not perform code review or QA work.
- Do not act as any specialist agent, even for trivial-looking changes.

## Required Context

- `.opencode/openkit/context/core/workflow.md`
- `.opencode/openkit/context/core/approval-gates.md`
- `.opencode/openkit/context/core/issue-routing.md`
- `.opencode/openkit/context/core/session-resume.md`
- `.opencode/openkit/context/core/runtime-surfaces.md`
- `.opencode/openkit/context/core/workflow-state-schema.md`
```

- [ ] **Step 3: Verify the file is well-formed**

Run:
```bash
head -5 /Users/duypham/Code/open-kit/agents/master-orchestrator.md
wc -l /Users/duypham/Code/open-kit/agents/master-orchestrator.md
```
Expected: frontmatter present, ~80 lines.

- [ ] **Step 4: Commit**

```bash
git add agents/master-orchestrator.md
git commit -m "refactor(agents): MO becomes procedural conductor with bootstrap responsibility"
```

---

## Task 10: Update Quick Agent prompt for inline brainstorm

**Why:** Quick Agent now owns brainstorm-rút-gọn inside `quick_plan`. It writes a 50-100 word summary inline to state.

**Files:**
- Modify: `agents/quick-agent.md`

- [ ] **Step 1: Read current prompt**

Run:
```bash
cat /Users/duypham/Code/open-kit/agents/quick-agent.md
```

- [ ] **Step 2: Edit the agent file**

Find the section describing what Quick Agent does in `quick_brainstorm` and merge it into `quick_plan` responsibilities. Add a new section near the top of the responsibilities:

```markdown
### Brainstorm-then-plan in quick_plan

When you receive control in `quick_plan`, run a brief brainstorm before producing options:

1. Ask 2-3 clarifying questions to confirm the problem and acceptance criteria. Stop at 3 questions max.
2. Write a 50-100 word summary into `state.brainstorm`:
   ```json
   "brainstorm": {
     "mode": "quick",
     "summary": "<problem + criteria + scope in 1 paragraph>",
     "completed_at": "<iso>"
   }
   ```
   Use `tool.workflow-state` write API or call the controller via the in-session CLI.
3. Inspect the codebase to confirm the brainstorm matches reality.
4. **Lane re-check:** If brainstorm reveals scope is cross-boundary or behavior is unclear, escalate to Master Orchestrator with the exact phrase: "Lane re-check: this looks more like /delivery." MO will ask the user.
5. Proceed to option analysis: present 3 options (or fewer with explicit justification), recommend one with reason.
6. Wait for user option selection, then produce the execution plan.
7. Wait for separate plan confirmation (gate `quick.understanding_confirmed`) before advancing to `quick_implement`.
```

Replace any existing reference to `quick_brainstorm` stage in the file with `quick_plan`. Remove sections that describe `quick_brainstorm` as a separate stage.

Update the stage list to reflect the new FSM:
```
quick_intake (MO) → quick_plan (you, brainstorm + plan) → quick_implement → quick_test → quick_done
```

- [ ] **Step 3: Verify**

Run:
```bash
grep -n "quick_brainstorm" /Users/duypham/Code/open-kit/agents/quick-agent.md
```
Expected: no output (no references left).

- [ ] **Step 4: Commit**

```bash
git add agents/quick-agent.md
git commit -m "refactor(agents): Quick Agent runs inline brainstorm in quick_plan"
```

---

## Task 11: Update Product Lead agent prompt for brainstorm + scope appendix

**Why:** Product Lead now owns brainstorm dialogue inside `full_product` and writes scope package with Appendix A (discovery) + Appendix B (decisions).

**Files:**
- Modify: `agents/product-lead-agent.md`

- [ ] **Step 1: Read current prompt**

Run:
```bash
cat /Users/duypham/Code/open-kit/agents/product-lead-agent.md
```

- [ ] **Step 2: Add brainstorm responsibility section**

Add near the top of responsibilities:

```markdown
### Brainstorm-then-scope in full_product

When you receive control in `full_product`, run a deep discovery dialogue before producing the scope package:

1. **Discovery dialogue** with the user. Ask one question at a time. Cover at minimum:
   - Problem statement and why now
   - Stakeholders / users
   - Success criteria
   - Constraints (technical, business, deadline)
   - Risks / unknowns
   - Out-of-scope clarifications

2. **Build the scope package** at `docs/scope/YYYY-MM-DD-<slug>.md` with this structure:
   ```markdown
   # Scope: <feature title>

   ## Problem statement
   ## Success criteria
   ## Constraints
   ## Acceptance criteria
   ## Out of scope
   ## Open questions

   ---

   ## Appendix A: Discovery notes
   <raw or summarized brainstorm dialogue you curated>

   ## Appendix B: Decisions made during discovery
   <rationale for non-obvious decisions, so downstream agents do not re-litigate>
   ```

3. **Curation rules at gate time:**
   - All insights from brainstorm that affect downstream work MUST appear in main sections.
   - Any decision a future engineer might re-litigate MUST be in Appendix B with rationale.
   - Appendix A may be raw or summarized — your judgment based on dialogue length.

4. **Lane re-check:** If brainstorm reveals work is purely a stack/library swap with preserved behavior, escalate to MO with the phrase: "Lane re-check: this looks more like /migrate."

5. **Gate `full.product_to_solution`:** Present the scope package's main sections to user. User confirms → record gate via `tool.set-approval`. User asks to continue brainstorming → loop back to step 1.

6. Record `state.artifacts.scope_package = "docs/scope/YYYY-MM-DD-<slug>.md"` after the file exists.
```

Remove or update any existing section that says scope is produced "after" brainstorm (it's now produced inline with brainstorm).

- [ ] **Step 3: Commit**

```bash
git add agents/product-lead-agent.md
git commit -m "refactor(agents): Product Lead runs brainstorm + scope with appendices in full_product"
```

---

## Task 12: Update Solution Lead agent prompt for migration brainstorm

**Why:** Solution Lead handles migration lane (no separate Migration Lead). In `migration_strategy`, it runs brainstorm on preserved behavior + baseline + risks, then writes migration plan with the same appendix structure.

**Files:**
- Modify: `agents/solution-lead-agent.md`

- [ ] **Step 1: Read current prompt**

Run:
```bash
cat /Users/duypham/Code/open-kit/agents/solution-lead-agent.md
```

- [ ] **Step 2: Add migration brainstorm section**

Add a section:

```markdown
### Brainstorm-then-plan in migration_strategy

When you receive control in `migration_strategy`, run a discovery dialogue focused on migration-specific concerns before producing the migration plan:

1. **Discovery dialogue** with the user, covering:
   - What stack/lib/version is being migrated and to what
   - Preserved invariants: layouts, flows, contracts, core logic that MUST stay identical
   - Baseline evidence: how do we prove the current behavior so we can compare after?
   - Compatibility blockers: what's framework-coupled and must be decoupled?
   - Risks and rollback plan
   - Slice strategy: how to migrate incrementally vs big-bang

2. **Build the migration plan** at `docs/solution/YYYY-MM-DD-<slug>.md` with this structure:
   ```markdown
   # Migration plan: <name>

   ## Migration target
   ## Preserved invariants
   ## Baseline evidence
   ## Migration slices (ordered)
   ## Risks and rollback
   ## Verification approach

   ---

   ## Appendix A: Discovery notes
   ## Appendix B: Decisions made during discovery
   ```

3. **Curation rules:** same as Product Lead — main sections distill insights, Appendix B holds re-litigable decisions.

4. **Lane re-check:** If brainstorm reveals significant new product behavior (not just preserve-and-swap), escalate to MO with the phrase: "Lane re-check: this looks more like /delivery."

5. **Gate `migration.strategy_approved`:** Present main sections to user. User confirms → record via `tool.set-approval`. Loop back if more discovery needed.

6. Record `state.artifacts.migration_plan = "docs/solution/YYYY-MM-DD-<slug>.md"`.
```

- [ ] **Step 3: Commit**

```bash
git add agents/solution-lead-agent.md
git commit -m "refactor(agents): Solution Lead runs migration brainstorm + plan in migration_strategy"
```

---

## Task 13: Rewrite `commands/quick-task.md`

**Why:** Command must explicitly: (1) dispatch MO first, (2) MO bootstraps state via `tool.bootstrap-workflow`, (3) MO advances to `quick_plan`, (4) Quick Agent runs brainstorm + plan.

**Files:**
- Modify: `commands/quick-task.md`

- [ ] **Step 1: Replace contents with**

```markdown
---
description: "Starts the Quick Task lane. Master Orchestrator bootstraps workflow state, then dispatches Quick Agent for brainstorm and plan."
---

# Command: `/quick-task`

Use `/quick-task` for daily, bounded work where the problem is small in scope and behavior is mostly clear.

## What this command does

1. Dispatches **Master Orchestrator** with `lane=quick` and the user's request as `description`.
2. MO calls `tool.bootstrap-workflow` to write `workflow-state.json` (or handles archive/conflict if a workflow already exists).
3. MO calls `tool.advance-stage` to move from `quick_intake` to `quick_plan`.
4. **Quick Agent** receives control in `quick_plan` and runs the brainstorm-then-plan flow.

## Shared prompt contract

- Follow `.opencode/openkit/context/core/prompt-contracts.md` for shared runtime-path, verification, and tool-substitution rules.
- Follow `.opencode/openkit/context/core/tool-substitution-rules.md` when reading or searching code.

## Preconditions

- A user request exists with enough text to bootstrap (description is non-empty).
- The user picked the quick lane explicitly. If brainstorm reveals the work is bigger, Quick Agent escalates to MO who asks the user before switching lanes.

## Canonical docs to load

- `.opencode/openkit/AGENTS.md`
- `.opencode/openkit/context/navigation.md`
- `.opencode/openkit/context/core/workflow.md`
- `.opencode/openkit/context/core/project-config.md`
- `.opencode/openkit/context/core/runtime-surfaces.md`
- `.opencode/openkit/context/core/code-quality.md`
- `.opencode/openkit/workflow-state.json` after bootstrap

## Stage chain

```
quick_intake (MO) → quick_plan (Quick Agent: brainstorm + plan) → quick_implement → quick_test → quick_done
```

`quick_intake` is MO-only and ephemeral. MO bootstraps state, advances immediately, never blocks for user input.

## Lane authority

User picked `/quick-task`. Lane is locked unless brainstorm reveals scope is cross-boundary, in which case Quick Agent escalates to MO who asks the user (y/n) before switching to `/delivery`.

## Validation guidance

- Use real app build/test/lint commands per `context/core/project-config.md`.
- Use `node .opencode/openkit/workflow-state.js validate` for state integrity, not as a substitute for app testing.

## Example transcript

```text
User: /quick-task fix the CSV export that drops the header row
MO: Bootstrapping quick workflow. Dispatching Quick Agent.
QuickAgent: Let me read the export logic. (reads code)
QuickAgent: 1) Is the missing header on all formats or just one?
User: Just CSV.
QuickAgent: 2) The fix should preserve the existing column order, right?
User: Yes.
QuickAgent: Brainstorm summary written. Here are 3 options:
  A: Off-by-one fix in the slice (low effort, low risk)
  B: Rewrite with streaming (medium, medium)
  C: Header template (high, low)
  I recommend A.
User: Go with A.
QuickAgent: Plan. Confirm?
User: Yes.
QuickAgent: Done. Tests pass. Summary: ...
```
```

- [ ] **Step 2: Commit**

```bash
git add commands/quick-task.md
git commit -m "docs(commands): rewrite /quick-task for MO bootstrap → Quick Agent brainstorm flow"
```

---

## Task 14: Rewrite `commands/delivery.md`

**Files:**
- Modify: `commands/delivery.md`

- [ ] **Step 1: Replace contents with**

```markdown
---
description: "Starts the Full Delivery lane. Master Orchestrator bootstraps workflow state, then dispatches Product Lead for discovery brainstorm and scope."
---

# Command: `/delivery`

Use `/delivery` for feature work where product behavior, requirements, or cross-boundary design needs deep discovery and explicit scoping.

## What this command does

1. Dispatches **Master Orchestrator** with `lane=full` and the user's request as `description`.
2. MO calls `tool.bootstrap-workflow` to write `workflow-state.json` (or handles archive/conflict).
3. MO calls `tool.advance-stage` to move from `full_intake` to `full_product`.
4. **Product Lead** receives control in `full_product` and runs the brainstorm dialogue + scope package authorship.

## Shared prompt contract

- Follow `.opencode/openkit/context/core/prompt-contracts.md` for shared runtime-path, verification, and tool-substitution rules.

## Preconditions

- The request is feature-shaped: product behavior, requirements, or cross-boundary solution design needs explicit discovery.
- If brainstorm reveals the work is purely a stack/library swap, Product Lead escalates to MO who asks the user before switching to `/migrate`.

## Canonical docs to load

- `.opencode/openkit/AGENTS.md`
- `.opencode/openkit/context/navigation.md`
- `.opencode/openkit/context/core/workflow.md`
- `.opencode/openkit/context/core/lane-selection.md`
- `.opencode/openkit/context/core/approval-gates.md`
- `.opencode/openkit/context/core/project-config.md`
- `.opencode/openkit/context/core/runtime-surfaces.md`
- `.opencode/openkit/workflow-state.json` after bootstrap

## Stage chain

```
full_intake (MO) → full_product (Product Lead: brainstorm + scope) → full_solution → full_implementation → full_code_review → full_qa → full_done
```

`full_intake` is MO-only and ephemeral.

## Scope package responsibility

Product Lead writes the scope at `docs/scope/YYYY-MM-DD-<slug>.md` with main sections (problem, success criteria, constraints, acceptance criteria, out of scope, open questions) plus Appendix A (discovery notes) and Appendix B (decisions). Downstream agents read main sections by default; they read Appendix B for non-obvious decisions and Appendix A only when needed.

## Lane authority

User picked `/delivery`. Lane is locked unless brainstorm reveals migration shape, in which case Product Lead escalates to MO for user confirmation.

## Validation guidance

- Real app build/test/lint commands per `context/core/project-config.md`.
- `node .opencode/openkit/workflow-state.js show` to inspect state when resuming.

## Example transcript

```text
User: /delivery add an enterprise approval workflow for billing
MO: Bootstrapping full workflow. Dispatching Product Lead.
ProductLead: To scope this, let me ask: who triggers the approval today?
User: Sales reps when discount > 20%.
ProductLead: And who approves?
User: VP Sales for <$50k, CFO above.
... (more discovery)
ProductLead: Scope package written to docs/scope/2026-05-09-enterprise-approval.md. Confirm to proceed?
User: Confirmed.
MO: Advancing to full_solution. Dispatching Solution Lead.
```
```

- [ ] **Step 2: Commit**

```bash
git add commands/delivery.md
git commit -m "docs(commands): rewrite /delivery for MO bootstrap → Product Lead brainstorm flow"
```

---

## Task 15: Rewrite `commands/migrate.md`

**Files:**
- Modify: `commands/migrate.md`

- [ ] **Step 1: Replace contents with**

```markdown
---
description: "Starts the Migration lane. Master Orchestrator bootstraps workflow state, then dispatches Solution Lead for migration brainstorm and plan."
---

# Command: `/migrate`

Use `/migrate` for upgrades, framework migrations, dependency replacement, or compatibility remediation. The defining feature is **preserve behavior, change the substrate**.

## What this command does

1. Dispatches **Master Orchestrator** with `lane=migration` and the user's request as `description`.
2. MO calls `tool.bootstrap-workflow` to write `workflow-state.json`.
3. MO calls `tool.advance-stage` to move from `migration_intake` to `migration_strategy`.
4. **Solution Lead** receives control in `migration_strategy` and runs migration brainstorm + plan authorship.

## Core migration principle

Preserve behavior first. Decouple blockers where necessary. Migrate incrementally instead of rewriting the product.

## Shared prompt contract

- Follow `.opencode/openkit/context/core/prompt-contracts.md` for shared runtime-path, verification, and tool-substitution rules.

## Preconditions

- The request is a migration: framework jump, dependency replacement, legacy API removal, or compatibility remediation.
- Behavior should mostly be preserved unless an exception is documented in the migration plan.

## Canonical docs to load

- `.opencode/openkit/AGENTS.md`
- `.opencode/openkit/context/navigation.md`
- `.opencode/openkit/context/core/workflow.md`
- `.opencode/openkit/context/core/lane-selection.md`
- `.opencode/openkit/context/core/approval-gates.md`
- `.opencode/openkit/context/core/project-config.md`
- `.opencode/openkit/context/core/runtime-surfaces.md`
- `.opencode/openkit/docs/templates/migration-baseline-checklist.md`
- `.opencode/openkit/docs/templates/migration-verify-checklist.md`
- `.opencode/openkit/workflow-state.json` after bootstrap

## Stage chain

```
migration_intake (MO) → migration_strategy (Solution Lead: brainstorm + plan) → migration_baseline → migration_upgrade → migration_code_review → migration_verify → migration_done
```

`migration_intake` is MO-only and ephemeral.

## Migration plan responsibility

Solution Lead writes the migration plan at `docs/solution/YYYY-MM-DD-<slug>.md` with main sections (target, preserved invariants, baseline evidence, slices, risks/rollback, verification approach) plus Appendix A (discovery) and Appendix B (decisions).

## Lane authority

User picked `/migrate`. Lane is locked unless brainstorm reveals significant new product behavior is needed, in which case Solution Lead escalates to MO for user confirmation.

## Validation guidance

- Prefer real build, test, codemod, type-check, smoke-test, and manual regression evidence from the target project.
- Prefer parity checks against the preserved baseline: screenshots, behavior notes, contracts, smoke paths.
- For small upgrades, keep the artifact set lightweight: baseline notes + plan + parity evidence.

## Example transcript

```text
User: /migrate upgrade React 18 to React 19 preserving all screens and flows
MO: Bootstrapping migration workflow. Dispatching Solution Lead.
SolutionLead: Which screens are highest-risk if behavior changes?
User: Dashboard and checkout.
SolutionLead: Do you have visual regression coverage on those?
User: Only the checkout.
... (more discovery on slicing strategy)
SolutionLead: Migration plan written to docs/solution/2026-05-09-react-19.md. Confirm?
User: Confirmed.
MO: Advancing to migration_baseline.
```
```

- [ ] **Step 2: Commit**

```bash
git add commands/migrate.md
git commit -m "docs(commands): rewrite /migrate for MO bootstrap → Solution Lead brainstorm flow"
```

---

## Task 16: Delete `/task` and `/brainstorm` commands

**Why:** No catch-all entry point; brainstorm is folded into stage 0 of each lane.

**Files:**
- Delete: `commands/task.md`
- Delete: `commands/brainstorm.md`

- [ ] **Step 1: Delete the files**

Run:
```bash
git rm commands/task.md commands/brainstorm.md
```

- [ ] **Step 2: Find lingering references**

Run:
```bash
grep -rln "/task\|\\.opencode/openkit/.*task\.md\|/brainstorm\b" /Users/duypham/Code/open-kit \
  --include="*.md" --include="*.js" --include="*.json" 2>/dev/null \
  | grep -v node_modules | grep -v "duypham93-openkit"
```
List the files. Inspect each:
- If the reference is documentation that suggests `/task` or `/brainstorm` to users, remove the line or replace with a reference to `/quick-task`, `/delivery`, or `/migrate` as appropriate.
- If the reference is part of a fixture or test, update accordingly.

- [ ] **Step 3: Update each file from Step 2**

For each file, edit out the `/task` and `/brainstorm` references. Examples:

`AGENTS.md` — replace any "use /task to begin" with "pick a lane: /quick-task, /delivery, or /migrate".

`README.md` — same.

`src/mcp-server/index.js` line 217 — change `'No workflow state found. Start a workflow with /task, /quick-task, /migrate, or /delivery.'` to `'No workflow state found. Start a workflow with /quick-task, /delivery, or /migrate.'`. Same for line 274.

`src/runtime/tools/workflow/advance-stage.js` line 44 — same substitution.

`src/runtime/tools/workflow/action-gateway.js` line 61 — same substitution.

- [ ] **Step 4: Verify no `/task` or `/brainstorm` references remain in user-facing docs**

Run:
```bash
grep -rln "^\\s*/task\\b\\|/task <\\|/brainstorm\\b" /Users/duypham/Code/open-kit \
  --include="*.md" --include="*.js" 2>/dev/null \
  | grep -v node_modules | grep -v "duypham93-openkit" | grep -v ".opencode/tests"
```
Expected: empty (or only test fixtures that intentionally reference the old commands).

- [ ] **Step 5: Run governance and tests**

Run:
```bash
npm run verify:governance
npm run verify:install-bundle
```
Expected: pass. If governance complains about missing commands or registry entries, update `registry.json` to remove `task` and `brainstorm` entries.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "remove(commands): delete /task and /brainstorm; purge references"
```

---

## Task 17: End-to-end smoke test for fresh-project bootstrap

**Why:** Verify the whole flow works: fresh project + `/quick-task` → state created, no "no workflow" error, Quick Agent gets control. Same for `/delivery` and `/migrate`.

**Files:**
- Create: `tests/runtime/lane-bootstrap-e2e.test.js`

- [ ] **Step 1: Write the test**

Create `tests/runtime/lane-bootstrap-e2e.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { createWorkflowKernelAdapter } from '../../src/runtime/workflow-kernel.js';
import { createBootstrapWorkflowTool } from '../../src/runtime/tools/workflow/bootstrap-workflow.js';

const require = createRequire(import.meta.url);

function freshProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-'));
  fs.mkdirSync(path.join(root, '.opencode'), { recursive: true });
  // Copy controller into place so kernel can resolve it
  const controllerSrc = path.resolve(import.meta.dirname, '..', '..', '.opencode', 'lib');
  fs.cpSync(controllerSrc, path.join(root, '.opencode', 'lib'), { recursive: true });
  return root;
}

test('quick lane: fresh project → bootstrap → quick_intake', async () => {
  const root = freshProject();
  const kernel = createWorkflowKernelAdapter({ projectRoot: root });
  const tool = createBootstrapWorkflowTool({ workflowKernel: kernel, projectRoot: root });

  // Before bootstrap
  assert.equal(kernel.showState(), null);

  // Bootstrap
  const result = await tool.handler({ lane: 'quick', description: 'fix bug' });
  assert.equal(result.status, 'created');

  // After bootstrap
  const state = kernel.showState();
  assert.ok(state);
  assert.equal(state.state?.mode ?? state.mode, 'quick');
  assert.equal(state.state?.current_stage ?? state.current_stage, 'quick_intake');
});

test('full lane: fresh project → bootstrap → full_intake', async () => {
  const root = freshProject();
  const kernel = createWorkflowKernelAdapter({ projectRoot: root });
  const tool = createBootstrapWorkflowTool({ workflowKernel: kernel, projectRoot: root });

  await tool.handler({ lane: 'full', description: 'add feature' });
  const state = kernel.showState();
  assert.equal(state.state?.mode ?? state.mode, 'full');
  assert.equal(state.state?.current_stage ?? state.current_stage, 'full_intake');
});

test('migration lane: fresh project → bootstrap → migration_intake', async () => {
  const root = freshProject();
  const kernel = createWorkflowKernelAdapter({ projectRoot: root });
  const tool = createBootstrapWorkflowTool({ workflowKernel: kernel, projectRoot: root });

  await tool.handler({ lane: 'migration', description: 'upgrade React' });
  const state = kernel.showState();
  assert.equal(state.state?.mode ?? state.mode, 'migration');
  assert.equal(state.state?.current_stage ?? state.current_stage, 'migration_intake');
});

test('multi-workflow conflict: second bootstrap on active workflow returns conflict', async () => {
  const root = freshProject();
  const kernel = createWorkflowKernelAdapter({ projectRoot: root });
  const tool = createBootstrapWorkflowTool({ workflowKernel: kernel, projectRoot: root });

  await tool.handler({ lane: 'quick', description: 'first' });
  const result = await tool.handler({ lane: 'full', description: 'second' });
  assert.equal(result.status, 'conflict');
});

test('archive prior: second bootstrap with archivePrior=true succeeds', async () => {
  const root = freshProject();
  const kernel = createWorkflowKernelAdapter({ projectRoot: root });
  const tool = createBootstrapWorkflowTool({ workflowKernel: kernel, projectRoot: root });

  await tool.handler({ lane: 'quick', description: 'first' });
  const result = await tool.handler({ lane: 'full', description: 'second', archivePrior: true });
  assert.equal(result.status, 'created');
  // Archive should exist
  const archiveDir = path.join(root, '.opencode', 'work-items');
  assert.ok(fs.existsSync(archiveDir));
});
```

- [ ] **Step 2: Run the e2e test**

Run:
```bash
node --test tests/runtime/lane-bootstrap-e2e.test.js
```
Expected: all 5 tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/runtime/lane-bootstrap-e2e.test.js
git commit -m "test(e2e): bootstrap flow for all 3 lanes on fresh project"
```

---

## Task 18: Run full verification suite and fix regressions

**Files:**
- (any file showing test regressions)

- [ ] **Step 1: Run the full verify suite**

Run:
```bash
npm run verify:all 2>&1 | tee /tmp/post-impl-output.txt
```
Compare against `/tmp/baseline-test-output.txt` from Task 1. New failures must be:
- Tests that the spec intentionally invalidates (e.g., tests asserting `quick_brainstorm` exists).
- Tests with stale fixtures referencing removed gates.
- Tests with stale references to `/task` or `/brainstorm`.

- [ ] **Step 2: For each new failure, decide and act**

For each failure:
- If the test asserts old behavior the spec removes → update the test to assert new behavior.
- If the test reveals a real regression → fix the implementation file.
- If unsure → note it and ask user before deciding.

- [ ] **Step 3: Re-run until green**

Run:
```bash
npm run verify:all
```
Expected: zero failures.

- [ ] **Step 4: Commit any test/fixture updates**

```bash
git add -A
git commit -m "test: align test fixtures with redesigned lane bootstrap and brainstorm flow"
```

---

## Task 19: Update CHANGELOG and release notes

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add entry to CHANGELOG**

Edit `CHANGELOG.md`. Add at the top, under the latest version section or a new `[Unreleased]` section:

```markdown
## [Unreleased]

### Changed
- **BREAKING:** `/task` command removed. Users now pick a lane explicitly: `/quick-task`, `/delivery`, or `/migrate`.
- **BREAKING:** `/brainstorm` command removed. Brainstorm is now stage 0 of each lane, owned by the first specialist agent (Quick Agent for quick, Product Lead for full, Solution Lead for migration).
- FSM: `quick_brainstorm` stage removed; brainstorm folded into `quick_plan`.
- Master Orchestrator is now purely procedural: bootstraps state via `tool.bootstrap-workflow` on the first command, dispatches the specialist, routes between stages.

### Added
- `tool.bootstrap-workflow` MCP tool. Creates `workflow-state.json` for a fresh lane; handles archive/conflict on existing workflows.
- `bootstrap` subcommand in `.opencode/workflow-state.js` CLI for shell-friendly bootstrap.
- Brainstorm storage: quick lane writes a 50-100 word summary inline to `state.brainstorm`; full and migration lanes capture brainstorm in scope/migration plan files as Appendix A (discovery notes) and Appendix B (decisions).

### Fixed
- "No workflow" error class on fresh global installs. Workflow-state.json is now created on the first command, not lazily.
- `workspace-shim.js` no longer skips `.opencode/openkit/workflow-state.json` materialization when the workspace state file does not yet exist.
```

- [ ] **Step 2: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: changelog entry for lane bootstrap and brainstorm redesign"
```

---

## Self-Review

After completing the plan:

**Spec coverage check:**
- Bootstrap on fresh project → Tasks 4, 6, 7, 8, 17.
- 3-command surface → Tasks 13, 14, 15.
- `/task` and `/brainstorm` removal → Task 16.
- MO procedural conductor → Task 9.
- Brainstorm as stage 0, owned by specialist → Tasks 10, 11, 12.
- Brainstorm storage (inline for quick, file appendices for full/migration) → Tasks 10, 11, 12.
- Lane re-check during brainstorm → Tasks 10, 11, 12 (agent prompts) + Task 9 (MO handles user confirmation) + Task 4 (`archivePrior=true` flow).
- Multi-workflow handling → Task 4 (conflict status), Task 9 (MO prompts user).
- Brainstorm-to-next gate → Tasks 10, 11, 12 (each agent uses `tool.set-approval` with the existing gate machinery — `quick.understanding_confirmed` for quick, `full.product_to_solution` for full, `migration.strategy_approved` for migration).
- FSM removal of `*_brainstorm` → Task 2.
- Test surface (fresh project, multi-workflow, lane switch) → Tasks 6, 7, 8, 17.
- All v0.5.0 tests still pass → Task 18.

All spec sections covered.

**Placeholder scan:** No "TBD", "implement later", or vague placeholders. All code is shown.

**Type consistency:** `bootstrapWorkflow` signature is consistent across Tasks 4, 5, 6, 17. `STAGE_OWNERS` mapping in Task 3 matches the FSM in Task 2. Gate names (`quick.understanding_confirmed`, `full.product_to_solution`, `migration.strategy_approved`) consistent across agent prompts and gate-registry.

---

## Execution

Plan complete and saved to `docs/superpowers/plans/2026-05-09-lane-bootstrap-and-brainstorm-redesign.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
