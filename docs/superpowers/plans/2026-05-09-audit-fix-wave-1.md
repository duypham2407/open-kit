# OpenKit Audit Fix — Wave 0 + Wave 1 (Critical) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 4 Critical findings from the v0.5.1 audit (D-1 version drift, 1-C-1 FSM divergence, 1-C-2 MCP contract mismatch, 4-C-1 ast-grep command injection) and establish a Wave 0 safety baseline so subsequent waves can verify regressions cleanly.

**Architecture:** Each Critical is fixed by the smallest correct change. The FSM merge ([1-C-1]) is the only structural one — it extracts a single canonical TRANSITIONS module that both `state-machine.js` and `transition-engine.js` import, which also lets us add the consistency test (`[X-2]` from the audit) as a side-effect of the same change. The other three fixes are localized: argv-array spawn for ast-grep, schema-cleanup for `tool.workflow-state`, and direct version field updates for the registry/install manifest.

**Tech Stack:** Node.js ≥ 18, ESM modules, `node:test` test runner, `node:assert/strict` assertions, `child_process.spawnSync`. No new dependencies.

**Spec reference:** `docs/superpowers/specs/2026-05-09-project-audit-fix-plan.md` (sections referenced as Wave 0, Wave 1, [D-1], [1-C-1], [1-C-2], [4-C-1]).

**Audit baseline commit:** `619b7c8` (the commit the audit ran against).

---

## File Structure

| Path | Action | Responsibility |
|------|--------|----------------|
| `src/runtime/state/transitions.js` | **Create** | Canonical TRANSITIONS map (per-mode) and STAGE_OWNERS. Single source of truth for legal stage transitions. |
| `src/runtime/workflow/state-machine.js` | Modify | Import TRANSITIONS/STAGE_OWNERS instead of defining duplicates. Public exports `isValidTransition`, `getValidNextStages`, `getStageOwner`, `getStageOrder` keep their existing signatures. |
| `src/runtime/state/transition-engine.js` | Modify | Import TRANSITIONS instead of defining `TRANSITION_RULES`. Keep `STAGE_ORDER` here (it's used internally for backward-detection). |
| `src/tests/runtime/fsm-table-consistency.test.js` | **Create** | Asserts both modules read the same per-mode transitions; covers `[X-2]` from the audit. |
| `src/mcp-server/tool-schemas.js` | Modify | Replace the `command` enum on `tool.workflow-state` with the `workItemId` property the handler actually accepts. |
| `src/tests/mcp-server/workflow-state-contract.test.js` | **Create** | Contract test that the schema input shape and handler input shape agree. |
| `src/runtime/tools/ast/ast-grep-search.js` | Modify | Replace `execSync(args.join(' '), …)` with `spawnSync('ast-grep', args, …)` (argv form, no shell). |
| `src/tests/runtime/ast-grep-search-injection.test.js` | **Create** | Asserts shell metacharacters in `pattern` do not execute. |
| `src/tests/release/version-metadata-consistency.test.js` | **Create** | Asserts `package.json#version === registry.kit.version === install-manifest.kit.version`. |
| `registry.json` | Modify | Bump `kit.version` from `0.3.36` to `0.5.1`. |
| `src/openkit-runtime/install-manifest.json` | Modify | Bump `kit.version` from `0.3.36` to `0.5.1`. |
| `package.json` | Modify | Add `"verify:audit-wave-1"` script that runs the four new test files plus existing FSM/registry suites. |

Each task below corresponds to one Critical (or to the safety net). Tasks are ordered so each commit leaves the tree green.

---

## Wave 0 — Safety net

### Task 1: Capture baseline state and add a wave-scoped verify script

**Files:**
- Modify: `package.json` (add one new script entry)

- [ ] **Step 1: Verify the working tree is clean**

Run: `git status --short`
Expected: empty output.

If not clean, stop and ask the user; do not stash automatically.

- [ ] **Step 2: Confirm `npm run verify:all` passes on the audit baseline**

Run: `npm run verify:all`
Expected: all suites pass with exit code 0.

If any suite fails, stop and report — Wave 0 cannot baseline a broken main. Investigate the failure before proceeding.

- [ ] **Step 3: Tag the baseline**

Run: `git tag audit-baseline-2026-05-09 && git tag --list audit-baseline-2026-05-09`
Expected: tag listed.

- [ ] **Step 4: Snapshot the current `npm pack --dry-run` output**

Run: `npm pack --dry-run --json > /tmp/audit-pack-baseline.json && wc -l /tmp/audit-pack-baseline.json`
Expected: a non-empty JSON file. (This is for later comparison if [X-1] is fixed; not used in Wave 1.)

- [ ] **Step 5: Add the wave-1 verify script to `package.json`**

Open `package.json` and locate the `"scripts"` object. Add this entry alongside the other `verify:*` scripts (e.g., after `verify:semgrep-quality`):

```json
"verify:audit-wave-1": "node --test tests/release/version-metadata-consistency.test.js tests/runtime/fsm-table-consistency.test.js tests/runtime/ast-grep-search-injection.test.js tests/mcp-server/workflow-state-contract.test.js"
```

Note: the four referenced test files do not exist yet; this script will fail until Tasks 2–5 are complete. That is intentional — running it after each task gives a clear "all wave-1 tests now pass" signal.

- [ ] **Step 6: Commit the wave-0 setup**

Run:
```
git add package.json
git commit -m "$(cat <<'EOF'
chore(audit): wave-0 safety net — add verify:audit-wave-1 script

Adds an aggregator script for the four test files introduced in
Wave 1 (D-1, 1-C-1, 1-C-2, 4-C-1). The tests do not exist yet and
the script will fail until the wave is complete; this is intentional
so each wave-1 task can be validated by re-running it.

Baseline tagged: audit-baseline-2026-05-09 (commit 619b7c8 + audit
deliverables eb35e04).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

Expected: commit succeeds.

---

## Wave 1 — Critical

Topo order from the fix plan: D-1 → 1-C-1 → 1-C-2 → 4-C-1. D-1 first because it blocks publish; the rest are independent.

### Task 2: Fix [D-1] — resync version metadata across the three files

**Files:**
- Create: `src/tests/release/version-metadata-consistency.test.js`
- Modify: `registry.json:6`
- Modify: `src/openkit-runtime/install-manifest.json:6`

- [ ] **Step 1: Write the failing test**

Create `src/tests/release/version-metadata-consistency.test.js`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');

const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
const registry = JSON.parse(fs.readFileSync(path.join(projectRoot, 'registry.json'), 'utf8'));
const installManifest = JSON.parse(
  fs.readFileSync(path.join(projectRoot, '.opencode/install-manifest.json'), 'utf8'),
);

test('package.json version matches registry.json kit.version', () => {
  assert.equal(
    registry.kit?.version,
    pkg.version,
    `registry.json kit.version (${registry.kit?.version}) must equal package.json version (${pkg.version})`,
  );
});

test('package.json version matches install-manifest.json kit.version', () => {
  assert.equal(
    installManifest.kit?.version,
    pkg.version,
    `install-manifest.json kit.version (${installManifest.kit?.version}) must equal package.json version (${pkg.version})`,
  );
});
```

- [ ] **Step 2: Confirm the test directory exists and run the test to verify it fails**

Run: `mkdir -p tests/release && node --test tests/release/version-metadata-consistency.test.js`
Expected: both tests FAIL with messages showing `0.3.36` vs `0.5.1`.

- [ ] **Step 3: Fix `registry.json` kit.version**

Open `registry.json`. Locate the `kit` object near the top:

```json
"kit": {
  "name": "OpenKit AI Software Factory",
  "version": "0.3.36"
},
```

Change `"version": "0.3.36"` to `"version": "0.5.1"`. Do not change any other field.

- [ ] **Step 4: Fix `src/openkit-runtime/install-manifest.json` kit.version**

Open `src/openkit-runtime/install-manifest.json`. Locate:

```json
"kit": {
  "name": "OpenKit AI Software Factory",
  "version": "0.3.36"
},
```

Change `"version": "0.3.36"` to `"version": "0.5.1"`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `node --test tests/release/version-metadata-consistency.test.js`
Expected: both tests PASS.

- [ ] **Step 6: Confirm the rest of the suite still passes**

Run: `npm run verify:all`
Expected: all suites pass.

- [ ] **Step 7: Commit**

Run:
```
git add tests/release/version-metadata-consistency.test.js registry.json .opencode/install-manifest.json
git commit -m "$(cat <<'EOF'
fix(release): resync kit.version across registry and install-manifest [D-1]

package.json was bumped to 0.5.1 in v0.5.1 but registry.json and
.opencode/install-manifest.json were left at 0.3.36, which would
hard-fail openkit release verify and block npm publish.

Bump both files to 0.5.1 and add a regression test that asserts
all three sources agree.

Refs: docs/superpowers/specs/2026-05-09-project-audit-report.md (D-1)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

Expected: commit succeeds.

---

### Task 3: Fix [1-C-1] — extract canonical TRANSITIONS, add consistency test

**Files:**
- Create: `src/runtime/state/transitions.js`
- Modify: `src/runtime/workflow/state-machine.js:13-73`
- Modify: `src/runtime/state/transition-engine.js:37-65`
- Create: `src/tests/runtime/fsm-table-consistency.test.js`

The merged truth chosen per the fix plan:

- `quick`: identical between both files; no change needed semantically.
- `full`: take `state-machine.js` for `full_code_review` and `full_qa` (more permissive — adds back-rework to `full_solution`/`full_product`); take `transition-engine.js` for `full_solution` (adds back-rework to `full_product`). Final per-stage list documented below.
- `migration`: take `state-machine.js` for `migration_code_review` (adds back-rework to `migration_strategy`); take `transition-engine.js` for `migration_strategy` (adds back-rework to `migration_baseline`).

- [ ] **Step 1: Write the failing consistency test**

Create `src/tests/runtime/fsm-table-consistency.test.js`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';

import { TRANSITIONS as canonicalTransitions } from '../../src/runtime/state/transitions.js';
import { getValidNextStages, getStageOwner } from '../../src/runtime/workflow/state-machine.js';

test('TRANSITIONS module exports a per-mode map for quick/full/migration', () => {
  assert.ok(canonicalTransitions.quick, 'quick mode missing');
  assert.ok(canonicalTransitions.full, 'full mode missing');
  assert.ok(canonicalTransitions.migration, 'migration mode missing');
});

test('state-machine.getValidNextStages reads from canonical TRANSITIONS for every stage', () => {
  for (const mode of ['quick', 'full', 'migration']) {
    const stages = Object.keys(canonicalTransitions[mode]);
    for (const stage of stages) {
      const fromCanonical = canonicalTransitions[mode][stage];
      const fromStateMachine = getValidNextStages(mode, stage);
      assert.deepEqual(
        fromStateMachine,
        fromCanonical,
        `state-machine disagrees with canonical TRANSITIONS for ${mode}/${stage}`,
      );
    }
  }
});

test('state-machine.getStageOwner returns a defined owner for every stage in TRANSITIONS', () => {
  for (const mode of ['quick', 'full', 'migration']) {
    for (const stage of Object.keys(canonicalTransitions[mode])) {
      const owner = getStageOwner(mode, stage);
      assert.ok(typeof owner === 'string' && owner.length > 0, `${mode}/${stage} has no owner`);
    }
  }
});

test('migration_strategy can transition back to migration_baseline (merged truth)', () => {
  assert.ok(
    canonicalTransitions.migration.migration_strategy.includes('migration_baseline'),
    'merged truth requires backward rework to migration_baseline',
  );
});

test('full_code_review can transition back to full_solution and full_product (merged truth)', () => {
  const targets = canonicalTransitions.full.full_code_review;
  assert.ok(targets.includes('full_solution'), 'full_code_review must allow back-rework to full_solution');
  assert.ok(targets.includes('full_product'), 'full_code_review must allow back-rework to full_product');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/runtime/fsm-table-consistency.test.js`
Expected: FAIL because `src/runtime/state/transitions.js` does not exist yet (import error).

- [ ] **Step 3: Create the canonical TRANSITIONS module**

Create `src/runtime/state/transitions.js` with this exact content:

```javascript
/**
 * Canonical workflow transition rules.
 *
 * This module is the single source of truth for legal stage transitions
 * across the three OpenKit workflow modes (quick / full / migration) and
 * for the role that owns each stage. Both src/runtime/workflow/state-machine.js
 * (used by the advance-stage MCP tool and the openkit://available-actions
 * resource) and src/runtime/state/transition-engine.js (used by
 * WorkflowStateManager for persistence-time validation) import from here.
 *
 * Audit reference: 1-C-1 in docs/superpowers/specs/2026-05-09-project-audit-report.md
 *
 * Merge policy when the two prior tables disagreed: take the more permissive
 * entry, with the explicit goal of allowing backward rework so the model can
 * recover from a stuck stage. Forward-only transitions remain unchanged.
 */

export const TRANSITIONS = {
  quick: {
    quick_intake: ['quick_plan'],
    quick_plan: ['quick_implement'],
    quick_implement: ['quick_test', 'quick_plan'],
    quick_test: ['quick_done', 'quick_implement'],
    quick_done: [],
  },

  full: {
    full_intake: ['full_product'],
    full_product: ['full_solution'],
    full_solution: ['full_implementation', 'full_product'],
    full_implementation: ['full_code_review', 'full_solution'],
    full_code_review: ['full_qa', 'full_implementation', 'full_solution', 'full_product'],
    full_qa: ['full_done', 'full_implementation', 'full_solution', 'full_product'],
    full_done: [],
  },

  migration: {
    migration_intake: ['migration_baseline'],
    migration_baseline: ['migration_strategy'],
    migration_strategy: ['migration_upgrade', 'migration_baseline'],
    migration_upgrade: ['migration_code_review', 'migration_strategy'],
    migration_code_review: ['migration_verify', 'migration_upgrade', 'migration_strategy'],
    migration_verify: ['migration_done', 'migration_upgrade'],
    migration_done: [],
  },
};

export const STAGE_OWNERS = {
  quick: {
    quick_intake: 'MasterOrchestrator',
    quick_plan: 'QuickAgent',
    quick_implement: 'QuickAgent',
    quick_test: 'QuickAgent',
    quick_done: 'QuickAgent',
  },
  full: {
    full_intake: 'MasterOrchestrator',
    full_product: 'ProductLead',
    full_solution: 'SolutionLead',
    full_implementation: 'FullstackAgent',
    full_code_review: 'CodeReviewer',
    full_qa: 'QAAgent',
    full_done: 'MasterOrchestrator',
  },
  migration: {
    migration_intake: 'MasterOrchestrator',
    migration_baseline: 'SolutionLead',
    migration_strategy: 'SolutionLead',
    migration_upgrade: 'FullstackAgent',
    migration_code_review: 'CodeReviewer',
    migration_verify: 'QAAgent',
    migration_done: 'MasterOrchestrator',
  },
};
```

- [ ] **Step 4: Update `state-machine.js` to import from canonical module**

Replace lines 13-73 of `src/runtime/workflow/state-machine.js` with this block (keep lines 1-12 — the doc-comment header — and lines 75 onward — the exported functions — untouched):

```javascript
import { TRANSITIONS, STAGE_OWNERS } from '../state/transitions.js';

const MODE_CONFIG = {
  quick: { transitions: TRANSITIONS.quick, owners: STAGE_OWNERS.quick },
  full: { transitions: TRANSITIONS.full, owners: STAGE_OWNERS.full },
  migration: { transitions: TRANSITIONS.migration, owners: STAGE_OWNERS.migration },
};
```

The downstream functions (`isValidTransition`, `getValidNextStages`, `getStageOwner`, `getStageOrder`, etc.) continue to read from `MODE_CONFIG` and need no other changes.

- [ ] **Step 5: Update `transition-engine.js` to import from canonical module**

In `src/runtime/state/transition-engine.js`, make two edits:

1. **Add an import at the top of the file** (above the existing `// src/runtime/state/transition-engine.js` line-1 comment, or just below if you prefer to keep that comment first — JS allows imports anywhere at module scope, but convention is at top). Insert as line 1:

```javascript
import { TRANSITIONS as TRANSITION_RULES } from './transitions.js';
```

If line 1 was the file-path comment `// src/runtime/state/transition-engine.js`, keep it as a leading comment and put the import on line 2. The end result is: comment (optional), then the `import` line, then a blank line, then the existing `const STAGE_ORDER = { ... };` block.

2. **Delete the entire `const TRANSITION_RULES = { ... };` block** that previously lived at lines 37-65. Nothing else references this constant inside the file — `class TransitionEngine` reads it via `this.rules`, which is assigned `TRANSITION_RULES` in the constructor. The aliased import keeps that reference valid.

Keep the existing `const STAGE_ORDER = { ... };` block at lines 9-35 unchanged. `STAGE_ORDER` stays here because it expresses *ordering* (used for backward-detection) and is internal to this file; merging it into `transitions.js` is out of scope for Wave 1.

- [ ] **Step 6: Run the consistency test to verify it now passes**

Run: `node --test tests/runtime/fsm-table-consistency.test.js`
Expected: all 5 tests PASS.

- [ ] **Step 7: Run advance-stage and controller suites to confirm no regression**

Run:
```
node --test tests/runtime/advance-stage.test.js
node --test .opencode/tests/workflow-state-controller.test.js
```
Expected: both suites pass.

- [ ] **Step 8: Run the full verify suite**

Run: `npm run verify:all`
Expected: all suites pass.

- [ ] **Step 9: Commit**

Run:
```
git add src/runtime/state/transitions.js src/runtime/workflow/state-machine.js src/runtime/state/transition-engine.js tests/runtime/fsm-table-consistency.test.js
git commit -m "$(cat <<'EOF'
fix(runtime): merge FSM transition tables into canonical source [1-C-1]

state-machine.js (used by advance-stage and the MCP available-actions
resource) and transition-engine.js (used by WorkflowStateManager for
persistence-time validation) carried two divergent copies of the
per-mode transition rules. Five full/migration entries disagreed, so
a transition the first table accepted could be silently rejected by
the second.

Extract canonical TRANSITIONS and STAGE_OWNERS to
src/runtime/state/transitions.js. Both modules now import from it.
Merge policy: take the more permissive entry to preserve back-rework
paths the model relies on for recovery.

Adds tests/runtime/fsm-table-consistency.test.js, which also covers
the X-2 finding (no regression test for table agreement) from the
audit.

Refs: docs/superpowers/specs/2026-05-09-project-audit-report.md (1-C-1, X-2)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

Expected: commit succeeds.

---

### Task 4: Fix [1-C-2] — reconcile tool.workflow-state schema with handler

**Files:**
- Modify: `src/mcp-server/tool-schemas.js:297-310`
- Create: `src/tests/mcp-server/workflow-state-contract.test.js`

The handler at `src/runtime/tools/workflow/workflow-state.js:23-39` reads only `workItemId`. Per the fix plan we choose Option A — drop the `command` enum and document `workItemId` as the input. This is a low-risk surface change because no callsite was actually passing `command` (the audit confirmed this).

- [ ] **Step 1: Write the failing contract test**

Create `src/tests/mcp-server/workflow-state-contract.test.js`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';

import { TOOL_SCHEMAS } from '../../src/mcp-server/tool-schemas.js';

test('tool.workflow-state schema is registered', () => {
  assert.ok(TOOL_SCHEMAS['tool.workflow-state'], 'schema entry missing');
  assert.ok(TOOL_SCHEMAS['tool.workflow-state'].inputSchema, 'inputSchema missing');
});

test('tool.workflow-state schema documents workItemId, not command', () => {
  const schema = TOOL_SCHEMAS['tool.workflow-state'].inputSchema;
  const props = schema.properties ?? {};
  assert.ok(
    'workItemId' in props,
    'inputSchema must declare workItemId (the property the handler reads)',
  );
  assert.ok(
    !('command' in props),
    'inputSchema must not declare command — the handler does not read it',
  );
});

test('tool.workflow-state workItemId property is a string with a description', () => {
  const prop = TOOL_SCHEMAS['tool.workflow-state'].inputSchema.properties.workItemId;
  assert.equal(prop.type, 'string');
  assert.equal(typeof prop.description, 'string');
  assert.ok(prop.description.length > 0);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/mcp-server/workflow-state-contract.test.js`
Expected: FAIL — second test fails because `command` is in `properties`; third fails because `workItemId` is not declared.

- [ ] **Step 3: Update the schema**

Open `src/mcp-server/tool-schemas.js`. Replace lines 297-310 (the entire `'tool.workflow-state'` entry) with:

```javascript
  'tool.workflow-state': {
    description:
      'Read governed workflow runtime state. Returns the current workflow state when called without arguments, or a specific work item when workItemId is supplied.',
    inputSchema: {
      type: 'object',
      properties: {
        workItemId: {
          type: 'string',
          description:
            'Optional. Returns the state for a specific work item by ID; when omitted, returns the current top-level workflow state.',
        },
      },
    },
  },
```

- [ ] **Step 4: Run the contract test to verify it passes**

Run: `node --test tests/mcp-server/workflow-state-contract.test.js`
Expected: all 3 tests PASS.

- [ ] **Step 5: Run MCP server suite to confirm no regression**

Run: `node --test tests/mcp-server/mcp-server.test.js`
Expected: all tests pass.

- [ ] **Step 6: Run full verify**

Run: `npm run verify:all`
Expected: all suites pass.

- [ ] **Step 7: Commit**

Run:
```
git add src/mcp-server/tool-schemas.js tests/mcp-server/workflow-state-contract.test.js
git commit -m "$(cat <<'EOF'
fix(mcp): align tool.workflow-state schema with handler [1-C-2]

The MCP schema advertised a `command` enum that the handler in
src/runtime/tools/workflow/workflow-state.js never reads; any model
calling { command: "show" } received a silent null result.

Replace the schema input with the workItemId property the handler
actually accepts. Add a contract test that asserts the schema and
handler agree on input shape.

No callsite was passing `command`, so this is a documented surface
narrowing rather than a breaking change.

Refs: docs/superpowers/specs/2026-05-09-project-audit-report.md (1-C-2)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

Expected: commit succeeds.

---

### Task 5: Fix [4-C-1] — replace shell-string execSync with argv spawnSync

**Files:**
- Modify: `src/runtime/tools/ast/ast-grep-search.js:1, 54-69`
- Create: `src/tests/runtime/ast-grep-search-injection.test.js`

- [ ] **Step 1: Write the failing injection regression test**

Create `src/tests/runtime/ast-grep-search-injection.test.js`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { createAstGrepSearchTool } from '../../src/runtime/tools/ast/ast-grep-search.js';
import { isAstGrepAvailable } from '../../src/global/tooling.js';

const astGrepInstalled = isAstGrepAvailable({ env: process.env });

test('ast-grep-search does not execute shell metacharacters embedded in pattern', { skip: !astGrepInstalled }, () => {
  // Set up a temp project to scan, and a sentinel file the injection would create.
  const tempProject = fs.mkdtempSync(path.join(os.tmpdir(), 'ast-grep-injection-'));
  const sentinel = path.join(tempProject, 'INJECTED');

  try {
    fs.writeFileSync(path.join(tempProject, 'sample.js'), 'console.log("hello");\n');

    // A pattern that, if passed through a shell, would create the sentinel.
    // With argv-form spawn, the shell never sees this string; ast-grep treats
    // the whole thing as a (likely-invalid) pattern and returns no matches.
    const tool = createAstGrepSearchTool({ projectRoot: tempProject });
    const result = tool.execute({
      pattern: `"console.log($A)" --output /dev/null; touch ${sentinel}`,
      lang: 'javascript',
    });

    assert.ok(
      typeof result === 'object' && result !== null,
      'tool should return an object (not throw)',
    );
    assert.ok(
      !fs.existsSync(sentinel),
      'sentinel file MUST NOT exist — its presence proves shell metacharacters executed',
    );
  } finally {
    fs.rmSync(tempProject, { recursive: true, force: true });
  }
});

test('ast-grep-search rejects non-string pattern (input validation unchanged)', () => {
  const tool = createAstGrepSearchTool({ projectRoot: process.cwd() });
  const result = tool.execute({ pattern: 123, lang: 'javascript' });
  assert.equal(result.status, 'invalid-input');
});
```

- [ ] **Step 2: Run the test to verify it fails (or skips)**

Run: `node --test tests/runtime/ast-grep-search-injection.test.js`

Expected outcomes:
- If `ast-grep` is installed locally: the injection test FAILS — the sentinel file gets created because `args.join(' ')` lets the shell execute the `; touch …` payload.
- If `ast-grep` is not installed: the injection test is skipped, but the second (input-validation) test still runs and passes. This is acceptable; CI should have ast-grep available.

If the injection test is skipped on your machine, install ast-grep before proceeding: `npm install -g @ast-grep/cli`.

- [ ] **Step 3: Update the import to add spawnSync**

In `src/runtime/tools/ast/ast-grep-search.js`, change line 1 from:

```javascript
import { execSync } from 'node:child_process';
```

to:

```javascript
import { spawnSync } from 'node:child_process';
```

- [ ] **Step 4: Replace the spawn block**

Replace lines 54-69 of `src/runtime/tools/ast/ast-grep-search.js` (the existing `try { const args = […] const result = execSync(args.join(' '), …);` block, up to and including the closing `});` of the execSync call) with:

```javascript
      try {
        const spawnArgs = [
          'run',
          '--pattern', pattern,
          '--lang', lang,
          '--json',
          targetPath || projectRoot,
        ];

        const spawnResult = spawnSync('ast-grep', spawnArgs, {
          cwd: projectRoot,
          encoding: 'utf8',
          timeout: 30000,
          maxBuffer: 5 * 1024 * 1024,
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: false,
        });

        if (spawnResult.error) {
          throw spawnResult.error;
        }

        const result = spawnResult.stdout ?? '';
```

This change does three things:
1. `spawnSync('ast-grep', spawnArgs, …)` passes argv as an array, with `shell: false`, so the shell is never invoked. Shell metacharacters in `pattern` or `lang` are passed verbatim to ast-grep, which will treat them as (likely-invalid) AST patterns rather than executing them.
2. The first element of the args array (`'ast-grep'`) is no longer in `spawnArgs` because `spawnSync` takes the binary name as a separate argument.
3. Errors from `spawnSync` (binary not found, timeout) come back via `spawnResult.error`; we re-throw to preserve the existing `try/catch` behavior in the rest of the function.

The downstream code (lines 70 onward — `try { parsed = JSON.parse(result); } catch …` and the matches mapping) reads `result` and continues to work unchanged.

- [ ] **Step 5: Run the injection test to verify it passes**

Run: `node --test tests/runtime/ast-grep-search-injection.test.js`
Expected: both tests PASS (or the injection test passes if ast-grep is installed; the validation test always passes).

- [ ] **Step 6: Confirm existing ast-grep tests pass**

Run: `node --test tests/runtime/codemod-tools.test.js`
Expected: passes (this suite exercises ast-grep search through other code paths).

If there are direct ast-grep search tests under another path, run them too. Search:

Run: `grep -rl "ast-grep-search" tests/`
Expected: list of any test files; run each with `node --test <path>` to confirm green.

- [ ] **Step 7: Run full verify**

Run: `npm run verify:all`
Expected: all suites pass.

- [ ] **Step 8: Commit**

Run:
```
git add src/runtime/tools/ast/ast-grep-search.js tests/runtime/ast-grep-search-injection.test.js
git commit -m "$(cat <<'EOF'
fix(security): close shell-injection vector in ast-grep-search [4-C-1]

execSync(args.join(' '), …) collapsed user-supplied pattern and lang
into a single shell-interpreted string, allowing payloads like
'"foo" --output /dev/null; rm -rf …' to execute as separate shell
commands.

Replace with spawnSync('ast-grep', argv, { shell: false }). The
shell is no longer involved; pattern and lang are passed verbatim
to ast-grep as argv elements.

Adds a regression test that asserts shell metacharacters in pattern
do not create a sentinel file (skipped when ast-grep CLI is not on
PATH locally).

Refs: docs/superpowers/specs/2026-05-09-project-audit-report.md (4-C-1)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

Expected: commit succeeds.

---

## Wave 1 — Final verification

### Task 6: Run the wave-1 aggregate suite and full verify

**Files:** none (verification only).

- [ ] **Step 1: Run the wave-1 aggregate**

Run: `npm run verify:audit-wave-1`
Expected: all four test files (`version-metadata-consistency`, `fsm-table-consistency`, `ast-grep-search-injection`, `workflow-state-contract`) report PASS.

- [ ] **Step 2: Run the full verify suite**

Run: `npm run verify:all`
Expected: all suites pass.

- [ ] **Step 3: Manual smoke test of the 3 lanes on a fresh project**

In a separate temp directory (do not pollute the repo working tree):

```
TMP=$(mktemp -d) && cd "$TMP" && git init -q
node /Users/duypham/Code/open-kit/.opencode/workflow-state.js bootstrap quick "Smoke quick"
node /Users/duypham/Code/open-kit/.opencode/workflow-state.js status
```

Expected: bootstrap succeeds and `status` reports stage `quick_intake`.

Repeat for `delivery` (full mode) and `migrate` (migration mode):

```
TMP_FULL=$(mktemp -d) && cd "$TMP_FULL" && git init -q
node /Users/duypham/Code/open-kit/.opencode/workflow-state.js bootstrap full "Smoke full"
node /Users/duypham/Code/open-kit/.opencode/workflow-state.js status

TMP_MIGRATION=$(mktemp -d) && cd "$TMP_MIGRATION" && git init -q
node /Users/duypham/Code/open-kit/.opencode/workflow-state.js bootstrap migration "Smoke migration"
node /Users/duypham/Code/open-kit/.opencode/workflow-state.js status
```

Expected: each bootstrap succeeds; each `status` returns the expected initial stage.

If any smoke step fails, stop and investigate before declaring Wave 1 complete.

- [ ] **Step 4: Compare `npm pack --dry-run` to baseline**

Run:
```
npm pack --dry-run --json > /tmp/audit-pack-wave1.json
diff /tmp/audit-pack-baseline.json /tmp/audit-pack-wave1.json | head -30
```

Expected: differences are limited to the 6 files modified/added in this plan (`registry.json`, `src/openkit-runtime/install-manifest.json`, `package.json`, the 4 new test files, `src/runtime/state/transitions.js`, the two FSM modules, `src/mcp-server/tool-schemas.js`, `src/runtime/tools/ast/ast-grep-search.js`). New test files under `src/tests/` should NOT appear in the pack output (tests are not in `pkg.files`).

If unexpected files appear or expected files are missing, investigate before continuing.

- [ ] **Step 5: Tag the wave-1 completion point**

Run: `git tag audit-wave-1-complete`
Expected: tag created.

- [ ] **Step 6: Final commit (none required, just confirmation)**

Run: `git log --oneline -10`
Expected: see the 5 wave-1 commits in order: chore wave-0 setup, fix D-1, fix 1-C-1, fix 1-C-2, fix 4-C-1.

Run: `git status`
Expected: `nothing to commit, working tree clean`.

---

## Notes for the implementer

- **Read-only audit context:** The audit report and fix-plan documents under `docs/superpowers/specs/` are the spec for this work. Do not modify them.
- **Do not skip the failing-test step.** Each task's "verify the test fails" step is the proof that the test is checking the right thing. If a test passes before the fix, the test is wrong.
- **Commit cadence:** one commit per Critical, plus the wave-0 setup commit. Five commits total. Do not amend earlier commits — keep the history linear so reviewers can step through each Critical in isolation.
- **Worktree is not required.** This is a small, self-contained set of changes on `main`. The audit established baseline at `619b7c8`/`audit-baseline-2026-05-09`; if anything goes wrong, `git reset --hard audit-baseline-2026-05-09` recovers cleanly (after the user confirms).
- **What this plan does NOT do:** Wave 2 (High), Wave 3 (Medium/Low). Those are separate plans, written after Wave 1 lands so they reflect the post-merge codebase.

---

## Wave 1 completion checklist

When all tasks above are complete:

- [ ] 4 Critical findings resolved: [D-1], [1-C-1], [1-C-2], [4-C-1]
- [ ] Audit cross-layer finding [X-2] also resolved (consistency test added in Task 3)
- [ ] 4 new tests under `src/tests/release/`, `src/tests/runtime/`, `src/tests/mcp-server/`
- [ ] 1 new source module: `src/runtime/state/transitions.js`
- [ ] 5 commits on `main` (wave-0 setup + 4 Critical fixes)
- [ ] `npm run verify:all` and `npm run verify:audit-wave-1` both green
- [ ] Manual smoke of 3 lanes on fresh project successful
- [ ] Tag `audit-wave-1-complete` created

After this, invoke `superpowers:writing-plans` again with the same audit fix-plan as input to generate the Wave 2 (High) plan.
