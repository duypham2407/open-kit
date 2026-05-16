# OpenKit Discovery Layer Fix — PR #2 (P1 Cleanup) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tidy P1 cleanup items — fixture drift in install tests, `builtin-commands.js` paths, doctor surface checks for Layer A, and the new `verify:materialized-layout` script — that were intentionally left out of the urgent PR #1 to keep the critical fix minimal.

**Architecture:** No new architecture; this PR ships within the 3-layer model already merged in PR #1. All changes are normalization, fixture updates, or test additions consistent with that model.

**Tech Stack:** Same as PR #1.

**Spec reference:** `docs/superpowers/specs/2026-05-16-openkit-discovery-layer-fix-design.md` (commit `9803db4`) — Themes C (P1), E (P1), F.

**Prerequisite:** PR #1 (`fix/discovery-layer-pr1-p0-core`) merged to main. This plan assumes Layer A staging, drift detector, and consumer-path P0 fixes are already in place.

---

## File Structure (PR #2)

```text
MODIFY:
  src/runtime/commands/builtin-commands.js              (paths to Layer B)
  src/tests/install/materialize.test.js                 (fixture: bin/openkit-mcp.js → src/bin/openkit-mcp.js)
  src/tests/install/merge-policy.test.js                (same fixture drift)
  src/tests/install/doctor.test.js                      (same fixture drift)
  src/global/doctor.js  OR  src/runtime/doctor.js       (add Layer A presence checks)
  package.json                                          (add verify scripts; wire into verify:all)

CREATE:
  src/tests/runtime/doctor-discovery-layer.test.js      (asserts doctor catches missing Layer A)
  src/tests/cli/launcher-config-dir.test.js             (asserts OPENCODE_CONFIG_DIR has Layer A dirs)
  src/tests/install/workspace-shim-no-command-bridge.test.js (asserts shim does NOT bridge commands)
```

---

## Task 1: Normalize `builtin-commands.js` paths

**Files:**
- Modify: `src/runtime/commands/builtin-commands.js`

- [ ] **Step 1: Read current paths**

```bash
sed -n '1,30p' src/runtime/commands/builtin-commands.js
```

Current entries (lines 3-10) likely hardcode `path: 'commands/<name>.md'`.

- [ ] **Step 2: Prefix each `path` with `src/`**

In `src/runtime/commands/builtin-commands.js`, for every entry whose `path` starts with `commands/`, prefix `src/`:

```js
// Before:
{ name: 'browser-verify', path: 'commands/browser-verify.md', ... },
// After:
{ name: 'browser-verify', path: 'src/commands/browser-verify.md', ... },
```

Apply uniformly to all entries in the file.

- [ ] **Step 3: Run command-loader test**

```bash
node --test src/tests/runtime/*command*.test.js
```

Expected: PASS (or the test that previously asserted bare `commands/...` now needs update — search for that next).

- [ ] **Step 4: Search for assertions on the old path shape**

```bash
grep -rn "commands/browser-verify\.md\|commands/configure-embedding\.md" src/tests/
```

Update any test asserting the bare-prefix path to expect `src/commands/...`. Show diff context for each one.

- [ ] **Step 5: Commit**

```bash
git add src/runtime/commands/builtin-commands.js src/tests/
git commit -m "$(cat <<'COMMIT'
fix(builtin-commands): use src/ prefix for command paths post-reorg

Hardcoded paths in builtin-commands.js dropped the src/ prefix when
the source tree moved under src/ in v0.9.0. Aligns with the kit-root
Layer B layout where commands live at <kitRoot>/src/commands/.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
COMMIT
)"
```

---

## Task 2: Fix fixture drift in `materialize.test.js` / `merge-policy.test.js` / `doctor.test.js`

**Files:**
- Modify: `src/tests/install/materialize.test.js` (lines ~52, 108, 155)
- Modify: `src/tests/install/merge-policy.test.js` (lines ~110, 136)
- Modify: `src/tests/install/doctor.test.js` (lines ~48, 133, 1734)

**Context:** Real config from `createOpenCodeConfig` (in `src/global/materialize.js:161`) emits `[process.execPath, '<package>/src/bin/openkit-mcp.js']` (absolute path). Test fixtures still expect `["node", "bin/openkit-mcp.js"]`. After PR #1 these tests pass only because the assertion is on the fixture, not on real config.

- [ ] **Step 1: Inspect failing assertion patterns**

```bash
grep -n 'bin/openkit-mcp\.js' src/tests/install/*.test.js
```

- [ ] **Step 2: Decide assertion style**

For each fixture that builds a desired-config object, prefer matching the real-config shape with a helper:

```js
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const EXPECTED_MCP_COMMAND = [process.execPath, path.join(PROJECT_ROOT, 'src', 'bin', 'openkit-mcp.js')];
```

Then update each affected assertion to compare against `EXPECTED_MCP_COMMAND` (or match by regex `/src\/bin\/openkit-mcp\.js$/`).

- [ ] **Step 3: Apply updates in `materialize.test.js`**

For each instance of `command: ["node", "bin/openkit-mcp.js"]` in the test file, change to use `EXPECTED_MCP_COMMAND` reference.

- [ ] **Step 4: Apply same updates in `merge-policy.test.js` and `doctor.test.js`**

Mirror the same pattern.

- [ ] **Step 5: Run install tests**

```bash
node --test src/tests/install/materialize.test.js \
            src/tests/install/merge-policy.test.js \
            src/tests/install/doctor.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/tests/install/materialize.test.js \
        src/tests/install/merge-policy.test.js \
        src/tests/install/doctor.test.js
git commit -m "$(cat <<'COMMIT'
test(install): align mcp command fixtures with real-config absolute path

Post-reorg, createOpenCodeConfig emits an absolute path to
src/bin/openkit-mcp.js. Fixtures still asserted the legacy
['node', 'bin/openkit-mcp.js'] tuple, hiding the drift behind a
fixture-vs-fixture comparison rather than fixture-vs-truth.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
COMMIT
)"
```

---

## Task 3: Add doctor checks for Layer A presence

**Files:**
- Modify: `src/global/doctor.js` (or `src/runtime/doctor.js` — confirm which one feeds `openkit doctor` output)
- Create: `src/tests/runtime/doctor-discovery-layer.test.js`

- [ ] **Step 1: Locate where doctor reports tooling/install checks**

```bash
grep -n 'canRunCleanly\|workspace-ready' src/global/doctor.js
```

- [ ] **Step 2: Add Layer A checks**

In the relevant doctor module, add a new probe section:

```js
const LAYER_A_REQUIRED = [
  { id: 'kit-discovery-layer.commands', rel: 'commands', minCount: 8 },
  { id: 'kit-discovery-layer.agents',   rel: 'agents',   minCount: 7 },
  { id: 'kit-discovery-layer.skills',   rel: 'skills',   minCount: 1 },
];

function inspectLayerA(kitRoot) {
  const issues = [];
  for (const req of LAYER_A_REQUIRED) {
    const dir = path.join(kitRoot, req.rel);
    if (!fs.existsSync(dir)) {
      issues.push({ id: req.id, status: 'missing', surface: 'runtime_tooling', message: `<kitRoot>/${req.rel} is missing.` });
      continue;
    }
    const entries = fs.readdirSync(dir).filter((n) => !n.startsWith('.'));
    if (entries.length < req.minCount) {
      issues.push({ id: req.id, status: 'degraded', surface: 'runtime_tooling', message: `<kitRoot>/${req.rel} has ${entries.length} entries (expected ≥ ${req.minCount}).` });
    }
  }
  return issues;
}
```

Wire `inspectLayerA(kitRoot)` results into the doctor's `issues` array. When any issue present, set `nextStep: 'Run \`openkit upgrade\` to repair the OpenCode discovery layer.'`.

- [ ] **Step 3: Write test**

Create `src/tests/runtime/doctor-discovery-layer.test.js`:

```js
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { inspectGlobalDoctor } from '../../global/doctor.js';

function makeKit({ withLayerA } = { withLayerA: true }) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-doctor-'));
  const kitRoot = path.join(home, 'kits', 'openkit');
  fs.mkdirSync(kitRoot, { recursive: true });
  fs.writeFileSync(path.join(kitRoot, 'opencode.json'), '{}');
  fs.writeFileSync(path.join(kitRoot, 'install-state.json'), JSON.stringify({ schema: 'openkit/global-install-state@1', kitVersion: '0.9.3-test' }));
  if (withLayerA) {
    for (const cls of ['commands', 'agents', 'skills']) {
      fs.mkdirSync(path.join(kitRoot, cls), { recursive: true });
      for (let i = 0; i < 10; i++) fs.writeFileSync(path.join(kitRoot, cls, `f${i}.md`), 'stub');
    }
  }
  return { env: { OPENCODE_HOME: home }, kitRoot, cleanup: () => fs.rmSync(home, { recursive: true, force: true }) };
}

describe('doctor — Layer A', () => {
  test('reports kit-discovery-layer.* PASS when Layer A present', () => {
    const { env, cleanup } = makeKit({ withLayerA: true });
    try {
      const doctor = inspectGlobalDoctor({ projectRoot: '.', env });
      const ids = (doctor.issues ?? []).map((i) => i.id);
      assert.ok(!ids.includes('kit-discovery-layer.commands'));
      assert.ok(!ids.includes('kit-discovery-layer.agents'));
      assert.ok(!ids.includes('kit-discovery-layer.skills'));
    } finally { cleanup(); }
  });

  test('reports kit-discovery-layer.commands when commands missing', () => {
    const { env, kitRoot, cleanup } = makeKit({ withLayerA: true });
    try {
      fs.rmSync(path.join(kitRoot, 'commands'), { recursive: true });
      const doctor = inspectGlobalDoctor({ projectRoot: '.', env });
      const ids = (doctor.issues ?? []).map((i) => i.id);
      assert.ok(ids.includes('kit-discovery-layer.commands'));
      assert.match(doctor.nextStep ?? '', /openkit upgrade/);
    } finally { cleanup(); }
  });
});
```

- [ ] **Step 4: Run test**

```bash
node --test src/tests/runtime/doctor-discovery-layer.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/global/doctor.js src/tests/runtime/doctor-discovery-layer.test.js
git commit -m "$(cat <<'COMMIT'
feat(doctor): add Layer A presence checks

inspectGlobalDoctor now probes <kitRoot>/commands, /agents, /skills
and reports kit-discovery-layer.* issues under surface
'runtime_tooling' when any is missing or underpopulated. nextStep
guides the user to `openkit upgrade`.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
COMMIT
)"
```

---

## Task 4: Add `verify:materialized-layout` + `verify:install-bundle-coverage` scripts

**Files:**
- Modify: `package.json` (scripts section)

- [ ] **Step 1: Read current scripts**

```bash
sed -n '40,55p' package.json
```

- [ ] **Step 2: Add new verify scripts**

In `package.json` `scripts`:

```json
"verify:materialized-layout": "node --test src/tests/install/materialize-global.test.js src/tests/install/validate-materialized-kit-layout.test.js src/tests/install/stage-discovery-layer.test.js src/tests/install/drift-detector.test.js",
"verify:install-bundle-coverage": "node --test src/tests/install/asset-manifest-coverage.test.js",
"verify:discovery-layer": "npm run verify:materialized-layout && npm run verify:install-bundle-coverage"
```

And extend `verify:all`:

```json
"verify:all": "npm run verify:install-bundle && npm run verify:mcp-secret-package-readiness && npm run verify:governance && npm run verify:semgrep-quality && npm run verify:discovery-layer && node --test \"src/openkit-runtime/tests/workflow-state-cli.test.js\" && node --test \"src/openkit-runtime/tests/session-start-hook.test.js\" && node --test src/tests/runtime/*.test.js && node --test src/tests/runtime/sessions/*.test.js && node --test src/tests/runtime/state/*.test.js && node --test src/tests/runtime/tools/*.test.js && node --test src/tests/install/*.test.js && node --test src/tests/global/*.test.js && node --test src/tests/cli/*.test.js && node --test src/tests/hooks/*.test.js && node --test src/tests/assets/*.test.js && node --test src/tests/commands/*.test.js && node --test src/tests/release/*.test.js"
```

- [ ] **Step 3: Run individual then aggregated**

```bash
npm run verify:materialized-layout
npm run verify:install-bundle-coverage
npm run verify:discovery-layer
```

Expected: each PASS.

- [ ] **Step 4: Run full suite**

```bash
npm run verify:all
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json
git commit -m "$(cat <<'COMMIT'
chore(verify): add verify:discovery-layer aggregate + wire into verify:all

Bundle the Layer A regression tests under a named script so CI gates
the invariant explicitly. Aggregate scripts:
- verify:materialized-layout (4 test files)
- verify:install-bundle-coverage (manifest invariant)
- verify:discovery-layer (composite)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
COMMIT
)"
```

---

## Task 5: Add `launcher-config-dir.test.js`

**Files:**
- Create: `src/tests/cli/launcher-config-dir.test.js`

- [ ] **Step 1: Write the test**

```js
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { materializeGlobalInstall } from '../../global/materialize.js';
import { getGlobalPaths } from '../../global/paths.js';

describe('launcher OPENCODE_CONFIG_DIR contract', () => {
  test('kitRoot has commands/, agents/, skills/ at top level (not nested under src/)', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-config-dir-'));
    try {
      const env = { OPENCODE_HOME: home };
      materializeGlobalInstall({
        env,
        kitVersion: '0.9.3-test',
        ensureAstGrep: () => ({ action: 'noop' }),
        ensureSemgrep: () => ({ action: 'noop' }),
      });
      const { kitRoot } = getGlobalPaths({ env });
      // OpenCode reads commands/agents/skills from OPENCODE_CONFIG_DIR. Since launcher sets
      // OPENCODE_CONFIG_DIR=kitRoot, these dirs must be at kitRoot top-level.
      for (const cls of ['commands', 'agents', 'skills']) {
        assert.ok(
          fs.existsSync(path.join(kitRoot, cls)),
          `<kitRoot>/${cls}/ must exist for OpenCode discovery`
        );
        // Sanity: ensure the dir actually has files
        const entries = fs.readdirSync(path.join(kitRoot, cls)).filter((n) => !n.startsWith('.'));
        assert.ok(entries.length > 0, `<kitRoot>/${cls}/ must be non-empty`);
      }
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run**

```bash
node --test src/tests/cli/launcher-config-dir.test.js
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/tests/cli/launcher-config-dir.test.js
git commit -m "$(cat <<'COMMIT'
test(cli): assert OPENCODE_CONFIG_DIR contains discovery dirs at root

Regression test pins the launcher contract: <kitRoot>/commands,
/agents, /skills must exist at kit-root top level (not nested under
src/) so OpenCode discovers them by convention.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
COMMIT
)"
```

---

## Task 6: Add `workspace-shim-no-command-bridge.test.js`

**Files:**
- Create: `src/tests/install/workspace-shim-no-command-bridge.test.js`

- [ ] **Step 1: Write test**

```js
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ensureWorkspaceBootstrap } from '../../global/workspace-state.js';

describe('workspace-shim does NOT bridge OpenCode discovery dirs', () => {
  test('no commands/, agents/, skills/ created under .opencode/openkit/', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-shim-'));
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-project-'));
    fs.writeFileSync(path.join(projectRoot, 'package.json'), '{}');
    try {
      ensureWorkspaceBootstrap({ projectRoot, env: { OPENCODE_HOME: home } });
      const shimRoot = path.join(projectRoot, '.opencode', 'openkit');
      // Bridges that SHOULD exist
      assert.ok(fs.existsSync(path.join(shimRoot, 'AGENTS.md')) || fs.lstatSync(path.join(shimRoot, 'AGENTS.md')).isSymbolicLink());
      // Bridges that MUST NOT exist
      assert.equal(fs.existsSync(path.join(shimRoot, 'commands')), false, 'workspace-shim must not bridge commands/');
      assert.equal(fs.existsSync(path.join(shimRoot, 'agents')), false, 'workspace-shim must not bridge agents/');
      assert.equal(fs.existsSync(path.join(shimRoot, 'skills')), false, 'workspace-shim must not bridge skills/');
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run**

```bash
node --test src/tests/install/workspace-shim-no-command-bridge.test.js
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/tests/install/workspace-shim-no-command-bridge.test.js
git commit -m "$(cat <<'COMMIT'
test(install): pin workspace-shim does not dual-list discovery dirs

OpenCode discovers slash commands at OPENCODE_CONFIG_DIR (kit root).
If workspace-shim also bridged commands/agents/skills into the
project's .opencode/openkit/, OpenCode would see them twice.
Regression test asserts the shim only bridges AGENTS.md/context/etc.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
COMMIT
)"
```

---

## Task 7: Run full `verify:all` + open PR

- [ ] **Step 1: Final verify**

```bash
npm run verify:all
```

Expected: PASS.

- [ ] **Step 2: Push + open PR**

```bash
git push -u origin HEAD:fix/discovery-layer-pr2-p1-cleanup
gh pr create --title "fix: P1 cleanup for discovery-layer fix" --body "$(cat <<'BODY'
## Summary

Follow-up to #PR1. Covers Theme C P1 (builtin-commands.js paths), Theme D residue (install-manifest cleanup that didn't ride along), Theme E P1 (fixture drift in materialize/merge-policy/doctor tests), Theme F (doctor checks for Layer A + new verify aggregates).

## Test plan

- [ ] `npm run verify:all` passes
- [ ] `npm run verify:discovery-layer` passes
- [ ] `openkit doctor` reports Layer A checks; failure case routes to `openkit upgrade`

## Spec

`docs/superpowers/specs/2026-05-16-openkit-discovery-layer-fix-design.md` — P1 scope.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
BODY
)"
```

---

## Self-Review Checklist

Spec coverage:

| Spec section | Task |
|---|---|
| §4 Theme C row 4 (builtin-commands.js) | Task 1 |
| §4 Theme E row 2 (materialize.test fixture) | Task 2 |
| §4 Theme E row 3 (merge-policy/doctor fixtures) | Task 2 |
| §4 Theme F row 1 (doctor Layer A checks) | Task 3 |
| §4 Theme F row 2 (verify scripts) | Task 4 |
| §4 Theme E NEW launcher-config-dir | Task 5 |
| §4 Theme E NEW workspace-shim-no-bridge | Task 6 |

Items already done in PR #1 (skipped here): install-manifest.json paths, registry-metadata test assertion (both promoted to P0 because they unblocked PR #1 CI).
