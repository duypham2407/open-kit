# OpenKit Discovery Layer Fix — PR #1 (P0 Core) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore OpenKit slash command discovery (`/delivery`, `/quick-task`, `/migrate`, `/finish`, ...) by staging `src/assets/install-bundle/opencode/*` into `<kitRoot>/{commands,agents,skills,context}/` during `materializeGlobalInstall`, normalize critical consumer references to Layer B (`<kitRoot>/src/...`), and add a drift detector that auto-repairs existing v0.9.0/.1/.2 installs.

**Architecture:** 3-layer kit model defined in `docs/superpowers/specs/2026-05-16-openkit-discovery-layer-fix-design.md` §3. Layer A (public OpenCode discovery — `<kitRoot>/commands/agents/skills/context/`) staged from the install-bundle. Layer B (kit-internal — `<kitRoot>/src/...`) preserved via 1-1 copy. Validation gate fails-closed if Layer A missing.

**Tech Stack:** Node.js ≥18, ES modules, `node --test` (built-in test runner), `node:fs/path`, `proper-lockfile`. No transpiler.

**Spec reference:** `docs/superpowers/specs/2026-05-16-openkit-discovery-layer-fix-design.md` (commit `9803db4`).

**Scope (PR #1, P0 only):**
- Theme A: materialize fix + stageOpenCodeDiscoveryLayer + validateMaterializedKitLayout + drift detector
- Theme B (P0 subset): asset-manifest expand for `/finish`, `/handoff`, `/start-work` + sync bundle + extend validator
- Theme C (P0 subset): `src/hooks/session-start.js` + `src/openkit-runtime/lib/workflow-state-controller.js`
- Theme E (P0 subset): `registry-metadata.test.js` assertion + new `materialize-global.test.js` + new `asset-manifest-coverage.test.js`

**Out of scope for PR #1 (see PR #2 and #3 plans):**
- Fixture drift in `materialize.test.js` / `merge-policy.test.js` / `doctor.test.js`
- `builtin-commands.js` paths
- `install-manifest.json` stale path keys
- Doctor surface checks for Layer A
- `vietnamese-detection.js`, `hooks/hooks.json` template

---

## File Structure (PR #1)

```text
MODIFY:
  src/global/materialize.js                              (refactor GLOBAL_KIT_ASSETS shape, add 2 new fns, wire calls)
  src/install/asset-manifest.js                          (+3 bundled commands, extend validateBundledAssetFiles)
  src/hooks/session-start.js                             (lines 238-242: normalize to Layer B)
  src/openkit-runtime/lib/workflow-state-controller.js   (lines 3842-3848, 3892-3902: normalize to Layer B)
  src/global/ensure-install.js                           (add detectKitLayoutDrift + repaired-layout action)
  src/cli/commands/run.js                                (lines 119-127: display block for repaired-layout)
  src/tests/runtime/registry-metadata.test.js            (line 71: update assertion)

CREATE:
  src/tests/install/materialize-global.test.js           (integration: Layer A presence)
  src/tests/install/asset-manifest-coverage.test.js      (invariant: every src/commands/*.md classified)

AUTO-GENERATED (by `npm run sync:install-bundle`):
  src/assets/install-bundle/opencode/commands/finish.md
  src/assets/install-bundle/opencode/commands/handoff.md
  src/assets/install-bundle/opencode/commands/start-work.md
```

---

## Phase 1: Install-bundle expansion (Theme B foundation)

These tasks come first because Phase 2's `stageOpenCodeDiscoveryLayer` reads from the install-bundle. The bundle must be complete before staging logic is wired.

### Task 1: Add `/finish`, `/handoff`, `/start-work` to bundled-asset manifest

**Files:**
- Modify: `src/install/asset-manifest.js` (insert into `OPENKIT_OPENCODE_BUNDLED_ASSETS` array, between existing command entries)

- [ ] **Step 1: Open `src/install/asset-manifest.js`** and locate the existing command entries (lines 66-112). Add three new entries immediately after the `opencode.command.write-solution` entry (around line 112):

```js
  {
    id: "opencode.command.finish",
    assetClass: "commands",
    sourcePath: "src/commands/finish.md",
    bundledPath: "src/assets/install-bundle/opencode/commands/finish.md",
  },
  {
    id: "opencode.command.handoff",
    assetClass: "commands",
    sourcePath: "src/commands/handoff.md",
    bundledPath: "src/assets/install-bundle/opencode/commands/handoff.md",
  },
  {
    id: "opencode.command.start-work",
    assetClass: "commands",
    sourcePath: "src/commands/start-work.md",
    bundledPath: "src/assets/install-bundle/opencode/commands/start-work.md",
  },
```

- [ ] **Step 2: Verify source files exist** before the bundle expects them.

```bash
ls -la src/commands/finish.md src/commands/handoff.md src/commands/start-work.md
```

Expected: all three files exist (they should — they're in `src/commands/` already).

- [ ] **Step 3: Do not commit yet** — Task 2 will materialize bundled copies and Task 3 will verify. Single atomic commit at end of Phase 1.

### Task 2: Mirror source commands into bundle via `sync:install-bundle`

**Files:**
- Create (auto): `src/assets/install-bundle/opencode/commands/finish.md`
- Create (auto): `src/assets/install-bundle/opencode/commands/handoff.md`
- Create (auto): `src/assets/install-bundle/opencode/commands/start-work.md`

- [ ] **Step 1: Run sync**

```bash
npm run sync:install-bundle
```

Expected: stdout reports mirroring of the 3 new entries; no errors.

- [ ] **Step 2: Verify bundled copies materialized**

```bash
ls -la src/assets/install-bundle/opencode/commands/finish.md \
       src/assets/install-bundle/opencode/commands/handoff.md \
       src/assets/install-bundle/opencode/commands/start-work.md
```

Expected: all three files exist and are identical to sources.

- [ ] **Step 3: Verify byte-for-byte match**

```bash
diff src/commands/finish.md src/assets/install-bundle/opencode/commands/finish.md
diff src/commands/handoff.md src/assets/install-bundle/opencode/commands/handoff.md
diff src/commands/start-work.md src/assets/install-bundle/opencode/commands/start-work.md
```

Expected: no output (files identical).

- [ ] **Step 4: Run existing bundle-validation test** to ensure no regression

```bash
node --test src/tests/install/skill-bundle-sync.test.js
```

Expected: PASS.

### Task 3: Extend `validateBundledAssetFiles` + new `asset-manifest-coverage.test.js`

**Files:**
- Modify: `src/install/asset-manifest.js` (extend `validateBundledAssetFiles` return shape, ~line 335 onwards)
- Create: `src/tests/install/asset-manifest-coverage.test.js`

- [ ] **Step 1: Write failing test for new validator field**

Create `src/tests/install/asset-manifest-coverage.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { OPENKIT_ASSET_MANIFEST, validateBundledAssetFiles } from '../../install/asset-manifest.js';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(MODULE_DIR, '../../..');

test('every src/commands/*.md is either bundled or has internalOnly metadata', () => {
  const commandsDir = path.join(PROJECT_ROOT, 'src', 'commands');
  const sourceCommands = fs.readdirSync(commandsDir)
    .filter((name) => name.endsWith('.md'))
    .map((name) => `src/commands/${name}`);

  const bundledSourcePaths = new Set(
    OPENKIT_ASSET_MANIFEST.bundle.assets
      .filter((asset) => asset.assetClass === 'commands')
      .map((asset) => asset.sourcePath)
  );

  const internalOnly = new Set(
    (OPENKIT_ASSET_MANIFEST.bundle.internalOnlyCommands ?? []).map((entry) => entry.sourcePath)
  );

  const unclassified = sourceCommands.filter(
    (sourcePath) => !bundledSourcePaths.has(sourcePath) && !internalOnly.has(sourcePath)
  );

  assert.deepEqual(
    unclassified,
    [],
    `Source commands missing classification (bundle or internalOnly): ${unclassified.join(', ')}`
  );
});

test('validateBundledAssetFiles returns sourceCommandsMissingFromBundle', () => {
  const result = validateBundledAssetFiles(PROJECT_ROOT);
  assert.ok('sourceCommandsMissingFromBundle' in result, 'validator must report missing-from-bundle field');
  assert.ok(Array.isArray(result.sourceCommandsMissingFromBundle));
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test src/tests/install/asset-manifest-coverage.test.js
```

Expected: FAIL with messages like "Source commands missing classification: src/commands/browser-verify.md, src/commands/configure-embedding.md, src/commands/init-deep.md, src/commands/refactor.md, src/commands/stop-continuation.md" AND "validator must report missing-from-bundle field".

- [ ] **Step 3: Add `internalOnlyCommands` metadata to manifest**

In `src/install/asset-manifest.js`, add a new field next to `bundle.assets`:

```js
export const OPENKIT_ASSET_MANIFEST = {
  schema: "openkit/asset-manifest@1",
  manifestVersion: 1,
  bundle: {
    namespace: "openkit",
    profile: "openkit-global-install",
    phase: 1,
    derivedFrom: ["src/agents/", "src/commands/", "src/skills/"],
    includedAssetClasses: ["agents", "commands", "context", "skills", "skill-catalog"],
    deferredAssetClasses: ["plugins", "package.json"],
    collisionPolicy: {
      installNamespace: "openkit",
      assetIdPrefix: "opencode",
      onCollision: "fail-closed-and-require-explicit-mapping",
      rationale:
        "Phase 1 ships an explicit namespaced bundle instead of overwriting unrelated OpenCode-native assets.",
    },
    assets: OPENKIT_OPENCODE_BUNDLED_ASSETS,
    internalOnlyCommands: [
      { sourcePath: "src/commands/browser-verify.md", reason: "Internal verification helper invoked by Quick/Migration lanes; not for direct user invocation." },
      { sourcePath: "src/commands/configure-embedding.md", reason: "Embedding config flow surfaced via `openkit configure-embedding` CLI; in-session counterpart is not yet curated for general use." },
      { sourcePath: "src/commands/init-deep.md", reason: "Maintainer-only deep-context init; gated to avoid accidental restructure." },
      { sourcePath: "src/commands/refactor.md", reason: "Experimental in-session refactor scaffolding; not yet contract-stable." },
      { sourcePath: "src/commands/stop-continuation.md", reason: "Continuation control surface; usually invoked indirectly by agents, not as a user-facing slash." },
    ],
  },
  // ...existing `assets` array stays unchanged
```

(Preserve the existing trailing `assets: [...]` array after the closing of `bundle`.)

- [ ] **Step 4: Extend `validateBundledAssetFiles` to return new field**

In `src/install/asset-manifest.js`, locate `validateBundledAssetFiles` (~line 335). Inside the function, after `const extraBundledFiles = ...`, before the final `return`, add:

```js
  const sourceCommandsDir = path.join(projectRoot, "src", "commands")
  const sourceCommandsOnDisk = fs.existsSync(sourceCommandsDir)
    ? fs.readdirSync(sourceCommandsDir)
        .filter((name) => name.endsWith(".md"))
        .map((name) => `src/commands/${name}`)
    : []

  const bundledCommandSourcePaths = new Set(
    OPENKIT_ASSET_MANIFEST.bundle.assets
      .filter((asset) => asset.assetClass === "commands")
      .map((asset) => asset.sourcePath)
  )

  const internalOnlyCommandSourcePaths = new Set(
    (OPENKIT_ASSET_MANIFEST.bundle.internalOnlyCommands ?? []).map((entry) => entry.sourcePath)
  )

  const sourceCommandsMissingFromBundle = sourceCommandsOnDisk.filter(
    (sourcePath) =>
      !bundledCommandSourcePaths.has(sourcePath) &&
      !internalOnlyCommandSourcePaths.has(sourcePath)
  )
```

Then add `sourceCommandsMissingFromBundle` to the return object.

- [ ] **Step 5: Run tests to verify PASS**

```bash
node --test src/tests/install/asset-manifest-coverage.test.js
```

Expected: 2 PASS, 0 FAIL.

- [ ] **Step 6: Commit Phase 1**

```bash
git add src/install/asset-manifest.js \
        src/assets/install-bundle/opencode/commands/finish.md \
        src/assets/install-bundle/opencode/commands/handoff.md \
        src/assets/install-bundle/opencode/commands/start-work.md \
        src/tests/install/asset-manifest-coverage.test.js
git commit -m "$(cat <<'COMMIT'
feat(install-bundle): expand bundled commands and add coverage invariant

Add /finish, /handoff, /start-work to OPENKIT_OPENCODE_BUNDLED_ASSETS
(public per CLAUDE.md/AGENTS.md). Mirror sources into the install-bundle
via sync:install-bundle. Classify browser-verify, configure-embedding,
init-deep, refactor, stop-continuation as internalOnly with explicit
rationale. Extend validateBundledAssetFiles with
sourceCommandsMissingFromBundle to guard future drift. Add
asset-manifest-coverage test that fails when a new src/commands/*.md
is neither bundled nor classified.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
COMMIT
)"
```

**Checkpoint #1 — Human review pause:** Confirm Phase 1 commit looks correct and tests pass before proceeding to Phase 2.

---

## Phase 2: Materialize core (Theme A)

### Task 4: Refactor `GLOBAL_KIT_ASSETS` to `{source, target}` shape

Why: explicit destination paths make the new staging step's intent obvious and prevent future regressions if source-tree layout changes again.

**Files:**
- Modify: `src/global/materialize.js` (lines 27-51, 212-214)

- [ ] **Step 1: Update `GLOBAL_KIT_ASSETS` constant**

In `src/global/materialize.js`, replace the existing string array (lines 27-51) with:

```js
const GLOBAL_KIT_ASSETS = [
  { source: 'src/openkit-runtime', target: 'src/openkit-runtime' },
  { source: 'src/bin',             target: 'src/bin' },
  { source: 'src/agents',          target: 'src/agents' },
  { source: 'src/assets',          target: 'src/assets' },
  { source: 'src/skills',          target: 'src/skills' },
  { source: 'src/commands',        target: 'src/commands' },
  { source: 'src/context',         target: 'src/context' },
  { source: 'src/hooks',           target: 'src/hooks' },
  { source: 'docs',                target: 'docs' },
  { source: 'registry.json',       target: 'registry.json' },
  { source: 'AGENTS.md',           target: 'AGENTS.md' },
  { source: 'README.md',           target: 'README.md' },
  { source: 'src/cli',             target: 'src/cli' },
  { source: 'src/capabilities',    target: 'src/capabilities' },
  { source: 'src/runtime',         target: 'src/runtime' },
  { source: 'src/mcp-server',      target: 'src/mcp-server' },
  { source: 'src/global',          target: 'src/global' },
  { source: 'src/install',         target: 'src/install' },
  { source: 'src/opencode',        target: 'src/opencode' },
  { source: 'src/permissions',     target: 'src/permissions' },
  { source: 'src/command-detection.js', target: 'src/command-detection.js' },
  { source: 'src/version.js',      target: 'src/version.js' },
  { source: 'package.json',        target: 'package.json' },
];
```

(All targets currently equal sources — staging functions in Tasks 5-6 add the Layer A overlay separately.)

- [ ] **Step 2: Update the copy loop**

In `src/global/materialize.js`, replace the existing loop (line 212-214):

```js
  for (const relativeAsset of GLOBAL_KIT_ASSETS) {
    copyAsset(path.join(PACKAGE_ROOT, relativeAsset), path.join(paths.kitRoot, relativeAsset));
  }
```

with:

```js
  for (const { source, target } of GLOBAL_KIT_ASSETS) {
    copyAsset(path.join(PACKAGE_ROOT, source), path.join(paths.kitRoot, target));
  }
```

- [ ] **Step 3: Run existing materialize tests to verify no regression**

```bash
node --test src/tests/install/materialize.test.js src/tests/install/merge-policy.test.js
```

Expected: PASS (these tests cover project-level materialize, not global; should be unaffected).

- [ ] **Step 4: Commit**

```bash
git add src/global/materialize.js
git commit -m "$(cat <<'COMMIT'
refactor(materialize): use {source,target} shape for GLOBAL_KIT_ASSETS

Explicit destinations make Layer A staging (introduced in following
commits) read naturally. Behaviour unchanged in this commit — all
targets equal sources today.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
COMMIT
)"
```

### Task 5: TDD `stageOpenCodeDiscoveryLayer`

**Files:**
- Modify: `src/global/materialize.js` (export new function)
- Create: `src/tests/install/stage-discovery-layer.test.js`

- [ ] **Step 1: Write failing test**

Create `src/tests/install/stage-discovery-layer.test.js`:

```js
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { stageOpenCodeDiscoveryLayer } from '../../global/materialize.js';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(MODULE_DIR, '../../..');

function makeTempKitRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-stage-layer-'));
}

describe('stageOpenCodeDiscoveryLayer', () => {
  test('copies install-bundle classes into kitRoot top-level', () => {
    const kitRoot = makeTempKitRoot();
    try {
      stageOpenCodeDiscoveryLayer({ kitRoot, packageRoot: PROJECT_ROOT });

      for (const cls of ['commands', 'agents', 'skills', 'context']) {
        const dir = path.join(kitRoot, cls);
        assert.ok(fs.existsSync(dir), `${cls} should exist at <kitRoot>/${cls}`);
        const entries = fs.readdirSync(dir);
        assert.ok(entries.length > 0, `${cls} should be non-empty`);
      }

      assert.ok(
        fs.existsSync(path.join(kitRoot, 'commands', 'delivery.md')),
        '<kitRoot>/commands/delivery.md should be staged from install-bundle'
      );
    } finally {
      fs.rmSync(kitRoot, { recursive: true, force: true });
    }
  });

  test('is idempotent — second call does not throw or duplicate', () => {
    const kitRoot = makeTempKitRoot();
    try {
      stageOpenCodeDiscoveryLayer({ kitRoot, packageRoot: PROJECT_ROOT });
      stageOpenCodeDiscoveryLayer({ kitRoot, packageRoot: PROJECT_ROOT });

      const commands = fs.readdirSync(path.join(kitRoot, 'commands'));
      const uniqueCount = new Set(commands).size;
      assert.equal(commands.length, uniqueCount, 'no duplicate command files');
    } finally {
      fs.rmSync(kitRoot, { recursive: true, force: true });
    }
  });

  test('skips classes when install-bundle source missing', () => {
    const kitRoot = makeTempKitRoot();
    const fakePackageRoot = makeTempKitRoot(); // empty package root
    try {
      stageOpenCodeDiscoveryLayer({ kitRoot, packageRoot: fakePackageRoot });
      // Nothing should be created since the install-bundle source doesn't exist
      assert.equal(fs.existsSync(path.join(kitRoot, 'commands')), false);
    } finally {
      fs.rmSync(kitRoot, { recursive: true, force: true });
      fs.rmSync(fakePackageRoot, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test src/tests/install/stage-discovery-layer.test.js
```

Expected: FAIL with "stageOpenCodeDiscoveryLayer is not a function" or import error.

- [ ] **Step 3: Implement `stageOpenCodeDiscoveryLayer`**

In `src/global/materialize.js`, add this function before `materializeGlobalInstall`:

```js
const OPENCODE_DISCOVERY_CLASSES = ['commands', 'agents', 'skills', 'context'];

export function stageOpenCodeDiscoveryLayer({ kitRoot, packageRoot }) {
  const bundleRoot = path.join(packageRoot, 'src', 'assets', 'install-bundle', 'opencode');
  if (!fs.existsSync(bundleRoot)) {
    return { staged: [], skipped: OPENCODE_DISCOVERY_CLASSES };
  }

  const staged = [];
  const skipped = [];

  for (const assetClass of OPENCODE_DISCOVERY_CLASSES) {
    const sourceDir = path.join(bundleRoot, assetClass);
    if (!fs.existsSync(sourceDir)) {
      skipped.push(assetClass);
      continue;
    }
    const targetDir = path.join(kitRoot, assetClass);
    fs.cpSync(sourceDir, targetDir, { recursive: true });
    staged.push(assetClass);
  }

  return { staged, skipped };
}
```

- [ ] **Step 4: Run test to verify PASS**

```bash
node --test src/tests/install/stage-discovery-layer.test.js
```

Expected: 3 PASS, 0 FAIL.

- [ ] **Step 5: Commit**

```bash
git add src/global/materialize.js src/tests/install/stage-discovery-layer.test.js
git commit -m "$(cat <<'COMMIT'
feat(materialize): add stageOpenCodeDiscoveryLayer for Layer A staging

Copy <packageRoot>/src/assets/install-bundle/opencode/{commands,agents,
skills,context}/ → <kitRoot>/{commands,agents,skills,context}/ so
OpenCode auto-discovers slash commands, agents, and skills at the
expected convention path. Idempotent, fail-soft when source dir
missing.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
COMMIT
)"
```

### Task 6: TDD `validateMaterializedKitLayout`

**Files:**
- Modify: `src/global/materialize.js` (export new function + new error class)
- Create: `src/tests/install/validate-materialized-kit-layout.test.js`

- [ ] **Step 1: Write failing tests**

Create `src/tests/install/validate-materialized-kit-layout.test.js`:

```js
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { validateMaterializedKitLayout, MaterializationError } from '../../global/materialize.js';

function makeTempKitRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-validate-'));
}

function writeFakeFile(filePath, content = 'fake') {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function makeValidKitRoot() {
  const kitRoot = makeTempKitRoot();
  // Layer A
  writeFakeFile(path.join(kitRoot, 'opencode.json'), '{}');
  for (const cmd of ['delivery', 'quick-task', 'migrate', 'finish', 'write-solution', 'execute-solution', 'switch-profiles', 'configure-agent-models']) {
    writeFakeFile(path.join(kitRoot, 'commands', `${cmd}.md`));
  }
  for (const agent of ['MasterOrchestrator', 'ProductLead', 'SolutionLead', 'FullstackAgent', 'CodeReviewer', 'QAAgent', 'QuickAgent']) {
    writeFakeFile(path.join(kitRoot, 'agents', `${agent}.md`));
  }
  writeFakeFile(path.join(kitRoot, 'skills', 'codebase-exploration', 'SKILL.md'));
  // Layer B
  writeFakeFile(path.join(kitRoot, 'src', 'openkit-runtime', 'workflow-state.js'));
  writeFakeFile(path.join(kitRoot, 'src', 'hooks', 'session-start.js'));
  return kitRoot;
}

describe('validateMaterializedKitLayout', () => {
  test('returns ok summary when Layer A and Layer B both present', () => {
    const kitRoot = makeValidKitRoot();
    try {
      const result = validateMaterializedKitLayout(kitRoot);
      assert.equal(result.ok, true);
      assert.ok(result.commandCount >= 8);
      assert.ok(result.agentCount >= 7);
      assert.ok(result.skillCount >= 1);
    } finally {
      fs.rmSync(kitRoot, { recursive: true, force: true });
    }
  });

  test('throws when <kitRoot>/commands missing', () => {
    const kitRoot = makeValidKitRoot();
    try {
      fs.rmSync(path.join(kitRoot, 'commands'), { recursive: true });
      assert.throws(
        () => validateMaterializedKitLayout(kitRoot),
        (err) => err instanceof MaterializationError && /commands/.test(err.message)
      );
    } finally {
      fs.rmSync(kitRoot, { recursive: true, force: true });
    }
  });

  test('throws when <kitRoot>/agents is empty', () => {
    const kitRoot = makeValidKitRoot();
    try {
      fs.rmSync(path.join(kitRoot, 'agents'), { recursive: true });
      fs.mkdirSync(path.join(kitRoot, 'agents'));
      assert.throws(
        () => validateMaterializedKitLayout(kitRoot),
        (err) => err instanceof MaterializationError && /agents/.test(err.message)
      );
    } finally {
      fs.rmSync(kitRoot, { recursive: true, force: true });
    }
  });

  test('throws when Layer B workflow-state.js missing', () => {
    const kitRoot = makeValidKitRoot();
    try {
      fs.rmSync(path.join(kitRoot, 'src', 'openkit-runtime', 'workflow-state.js'));
      assert.throws(
        () => validateMaterializedKitLayout(kitRoot),
        (err) => err instanceof MaterializationError && /workflow-state\.js/.test(err.message)
      );
    } finally {
      fs.rmSync(kitRoot, { recursive: true, force: true });
    }
  });

  test('error includes remediation hint', () => {
    const kitRoot = makeValidKitRoot();
    try {
      fs.rmSync(path.join(kitRoot, 'commands'), { recursive: true });
      try {
        validateMaterializedKitLayout(kitRoot);
        assert.fail('should have thrown');
      } catch (err) {
        assert.ok(err instanceof MaterializationError);
        assert.match(err.message, /sync:install-bundle|stageOpenCodeDiscoveryLayer/);
      }
    } finally {
      fs.rmSync(kitRoot, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test src/tests/install/validate-materialized-kit-layout.test.js
```

Expected: FAIL with "validateMaterializedKitLayout is not a function" or "MaterializationError is not defined".

- [ ] **Step 3: Implement the validator + error class**

In `src/global/materialize.js`, add near the top after imports:

```js
export class MaterializationError extends Error {
  constructor(message, { layer, missing, hint } = {}) {
    super(message);
    this.name = 'MaterializationError';
    this.layer = layer;
    this.missing = missing;
    this.hint = hint;
  }
}
```

Then add this function before `materializeGlobalInstall`:

```js
const REQUIRED_LAYER_A = [
  { kind: 'file',      path: 'opencode.json' },
  { kind: 'dir-non-empty', path: 'commands', minCount: 8 },
  { kind: 'dir-non-empty', path: 'agents',   minCount: 7 },
  { kind: 'dir-non-empty', path: 'skills',   minCount: 1 },
];

const REQUIRED_LAYER_B = [
  { kind: 'file', path: 'src/openkit-runtime/workflow-state.js' },
  { kind: 'file', path: 'src/hooks/session-start.js' },
];

export function validateMaterializedKitLayout(kitRoot) {
  const errors = [];

  function checkFile(rel) {
    const abs = path.join(kitRoot, rel);
    return fs.existsSync(abs) && fs.statSync(abs).isFile();
  }
  function checkDirNonEmpty(rel, minCount) {
    const abs = path.join(kitRoot, rel);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) return false;
    const entries = fs.readdirSync(abs).filter((name) => !name.startsWith('.'));
    return entries.length >= minCount;
  }

  for (const req of REQUIRED_LAYER_A) {
    const ok = req.kind === 'file' ? checkFile(req.path) : checkDirNonEmpty(req.path, req.minCount);
    if (!ok) errors.push({ layer: 'A', path: req.path });
  }
  for (const req of REQUIRED_LAYER_B) {
    if (!checkFile(req.path)) errors.push({ layer: 'B', path: req.path });
  }

  if (errors.length > 0) {
    const summary = errors.map((e) => `Layer ${e.layer}: ${e.path}`).join('; ');
    throw new MaterializationError(
      `Materialized kit layout invalid: ${summary}. Run \`npm run sync:install-bundle\` or call stageOpenCodeDiscoveryLayer before validation.`,
      { layer: errors[0].layer, missing: errors, hint: 'sync:install-bundle' }
    );
  }

  return {
    ok: true,
    commandCount: fs.readdirSync(path.join(kitRoot, 'commands')).filter((n) => n.endsWith('.md')).length,
    agentCount:   fs.readdirSync(path.join(kitRoot, 'agents')).filter((n) => n.endsWith('.md')).length,
    skillCount:   fs.readdirSync(path.join(kitRoot, 'skills')).filter((n) => !n.startsWith('.')).length,
  };
}
```

- [ ] **Step 4: Run tests to verify PASS**

```bash
node --test src/tests/install/validate-materialized-kit-layout.test.js
```

Expected: 5 PASS, 0 FAIL.

- [ ] **Step 5: Commit**

```bash
git add src/global/materialize.js src/tests/install/validate-materialized-kit-layout.test.js
git commit -m "$(cat <<'COMMIT'
feat(materialize): add validateMaterializedKitLayout fail-closed gate

Validate <kitRoot> after materialize. Layer A: opencode.json,
commands/ (≥8), agents/ (≥7), skills/ (≥1). Layer B:
src/openkit-runtime/workflow-state.js, src/hooks/session-start.js.
Throw MaterializationError with remediation hint on any missing
asset; caller (materializeGlobalInstall) rollbacks the install.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
COMMIT
)"
```

### Task 7: Wire `stageOpenCodeDiscoveryLayer` + `validateMaterializedKitLayout` into `materializeGlobalInstall`

**Files:**
- Modify: `src/global/materialize.js` (inside `materializeGlobalInstall` body, after copy loop, before `commitBackup`)

- [ ] **Step 1: Update `materializeGlobalInstall` body**

In `src/global/materialize.js`, locate the section right after the copy loop (after `provisionManagedNodeModules`, around line 216). The structure should be:

```js
    for (const { source, target } of GLOBAL_KIT_ASSETS) {
      copyAsset(path.join(PACKAGE_ROOT, source), path.join(paths.kitRoot, target));
    }

    const runtimeDependencies = provisionManagedNodeModules(paths.kitRoot);

    // ← INSERT staging here, BEFORE config write
    stageOpenCodeDiscoveryLayer({ kitRoot: paths.kitRoot, packageRoot: PACKAGE_ROOT });

    const installState = createGlobalInstallState({ kitVersion, profile: 'openkit' });
    const openCodeConfig = createOpenCodeConfig(paths.kitRoot);
    // ... existing writes ...
```

Then after `materializeMcpProfiles(...)` and before `commitBackup(...)`:

```js
    // Validate fail-closed before committing backups
    validateMaterializedKitLayout(paths.kitRoot);

    // Materialize succeeded — discard backups.
    commitBackup(kitRootBackup);
    commitBackup(profilesRootBackup);
```

- [ ] **Step 2: Write integration test for the wired flow**

Create `src/tests/install/materialize-global.test.js`:

```js
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { materializeGlobalInstall } from '../../global/materialize.js';

function setupEnv() {
  const openCodeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-e2e-'));
  return {
    env: { OPENCODE_HOME: openCodeHome },
    cleanup: () => fs.rmSync(openCodeHome, { recursive: true, force: true }),
  };
}

describe('materializeGlobalInstall — Layer A discovery', () => {
  test('creates <kitRoot>/commands with curated commands', () => {
    const { env, cleanup } = setupEnv();
    try {
      const result = materializeGlobalInstall({
        env,
        kitVersion: '0.9.3-test',
        ensureAstGrep: () => ({ action: 'noop' }),
        ensureSemgrep: () => ({ action: 'noop' }),
      });
      for (const cmd of ['delivery', 'quick-task', 'migrate', 'finish', 'write-solution', 'execute-solution', 'switch-profiles', 'configure-agent-models']) {
        assert.ok(
          fs.existsSync(path.join(result.kitRoot, 'commands', `${cmd}.md`)),
          `<kitRoot>/commands/${cmd}.md should exist`
        );
      }
    } finally {
      cleanup();
    }
  });

  test('creates <kitRoot>/agents with PascalCase files', () => {
    const { env, cleanup } = setupEnv();
    try {
      const result = materializeGlobalInstall({
        env,
        kitVersion: '0.9.3-test',
        ensureAstGrep: () => ({ action: 'noop' }),
        ensureSemgrep: () => ({ action: 'noop' }),
      });
      for (const agent of ['MasterOrchestrator', 'QuickAgent']) {
        assert.ok(
          fs.existsSync(path.join(result.kitRoot, 'agents', `${agent}.md`)),
          `<kitRoot>/agents/${agent}.md should exist`
        );
      }
    } finally {
      cleanup();
    }
  });

  test('creates <kitRoot>/skills with SKILL.md entries', () => {
    const { env, cleanup } = setupEnv();
    try {
      const result = materializeGlobalInstall({
        env,
        kitVersion: '0.9.3-test',
        ensureAstGrep: () => ({ action: 'noop' }),
        ensureSemgrep: () => ({ action: 'noop' }),
      });
      const skillsDir = path.join(result.kitRoot, 'skills');
      assert.ok(fs.existsSync(skillsDir));
      const skills = fs.readdirSync(skillsDir).filter((n) => !n.startsWith('.'));
      assert.ok(skills.length >= 1);
    } finally {
      cleanup();
    }
  });

  test('keeps Layer B at <kitRoot>/src/openkit-runtime/workflow-state.js', () => {
    const { env, cleanup } = setupEnv();
    try {
      const result = materializeGlobalInstall({
        env,
        kitVersion: '0.9.3-test',
        ensureAstGrep: () => ({ action: 'noop' }),
        ensureSemgrep: () => ({ action: 'noop' }),
      });
      assert.ok(fs.existsSync(path.join(result.kitRoot, 'src', 'openkit-runtime', 'workflow-state.js')));
    } finally {
      cleanup();
    }
  });
});
```

- [ ] **Step 3: Run integration test**

```bash
node --test src/tests/install/materialize-global.test.js
```

Expected: 4 PASS, 0 FAIL.

- [ ] **Step 4: Run full install + runtime test surface**

```bash
node --test src/tests/install/*.test.js src/tests/runtime/runtime-config-loader.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/global/materialize.js src/tests/install/materialize-global.test.js
git commit -m "$(cat <<'COMMIT'
fix(materialize): wire Layer A staging + validation into install flow

After GLOBAL_KIT_ASSETS copy, call stageOpenCodeDiscoveryLayer to
materialize <kitRoot>/{commands,agents,skills,context}/ from the
install-bundle. Before commitBackup, call
validateMaterializedKitLayout — throws (and triggers rollback) when
Layer A or Layer B is incomplete.

This restores OpenCode slash command discovery broken by the v0.9.0
source-tree reorganization. Add materialize-global integration test
asserting Layer A presence after a real materialize.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
COMMIT
)"
```

**Checkpoint #2 — Human review pause:** Confirm Phase 2 is clean. Optionally run a manual smoke now: `rm -rf "$HOME/.config/opencode/kits/openkit" && node src/bin/openkit.js install --verify && ls "$HOME/.config/opencode/kits/openkit/commands/"`.

---

## Phase 3: Consumer paths (Theme C P0)

### Task 8: Fix `src/hooks/session-start.js` paths to Layer B

**Files:**
- Modify: `src/hooks/session-start.js` (lines 238-242)

**Note:** Audit revealed lines 240-241 also reference `kitRoot/.opencode/...` (pre-reorg `.opencode/` not just under-`src/` drift). Fix all five lines together.

- [ ] **Step 1: Locate the current path declarations**

Read lines 238-242 of `src/hooks/session-start.js`:

```js
const metaSkillPath = path.join(kitRoot, 'skills', 'using-skills', 'SKILL.md');
const toolSubstitutionRulesPath = path.join(kitRoot, 'context', 'core', 'tool-substitution-rules.md');
const manifestPath = path.join(kitRoot, '.opencode', 'opencode.json');
const runtimeSummaryModulePath = path.join(kitRoot, '.opencode', 'lib', 'runtime-summary.js');
const graphIndexerPath = path.join(kitRoot, 'hooks', 'graph-indexer.js');
```

- [ ] **Step 2: Replace with Layer B references**

Update lines 238-242 to:

```js
const metaSkillPath = path.join(kitRoot, 'src', 'skills', 'using-skills', 'SKILL.md');
const toolSubstitutionRulesPath = path.join(kitRoot, 'src', 'context', 'core', 'tool-substitution-rules.md');
const manifestPath = path.join(kitRoot, 'opencode.json');
const runtimeSummaryModulePath = path.join(kitRoot, 'src', 'openkit-runtime', 'lib', 'runtime-summary.js');
const graphIndexerPath = path.join(kitRoot, 'src', 'hooks', 'graph-indexer.js');
```

Rationale:
- `metaSkillPath`, `toolSubstitutionRulesPath`, `runtimeSummaryModulePath`, `graphIndexerPath` → Layer B (`<kitRoot>/src/...`)
- `manifestPath` → Layer A top-level (`<kitRoot>/opencode.json`, no `.opencode/` segment — that was incorrect pre-existing path)

- [ ] **Step 3: Run hook test suite**

```bash
node --test src/tests/hooks/*.test.js
```

Expected: PASS (no test currently asserts these specific path values; tests verify rendered output).

- [ ] **Step 4: Smoke test by directly running the hook**

```bash
OPENKIT_PROJECT_ROOT=. OPENKIT_WORKFLOW_STATE=src/openkit-runtime/workflow-state.json \
  node src/hooks/session-start.js | head -20
```

Expected: Banner renders without "MISSING" warnings for skill / context / runtime-summary.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/session-start.js
git commit -m "$(cat <<'COMMIT'
fix(hooks/session-start): normalize paths to post-reorg layout

Move metaSkillPath, toolSubstitutionRulesPath, runtimeSummaryModulePath,
graphIndexerPath to Layer B (<kitRoot>/src/...). Fix manifestPath to
top-level <kitRoot>/opencode.json (was incorrectly nested under
.opencode/). Resolves session-start banner reporting "missing" for
files that exist but were sought at pre-reorg paths.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
COMMIT
)"
```

### Task 9: Fix `src/openkit-runtime/lib/workflow-state-controller.js` paths

**Files:**
- Modify: `src/openkit-runtime/lib/workflow-state-controller.js` (lines 3842-3848, 3892-3902)

**Note:** Lines 3842 and 3892 also reference `kitRoot/.opencode/opencode.json` — same `.opencode/` drift as session-start.js. Fix here too.

- [ ] **Step 1: Locate `resolvePathContext` block (around line 3842)**

Read lines 3842-3848. Current code:

```js
const manifestPath = path.join(kitRoot, ".opencode", "opencode.json")
const manifest = readJsonIfExists(manifestPath)
const { registryPath, installManifestPath } = getManifestPaths(kitRoot, manifest)
const installManifest = readJsonIfExists(installManifestPath)
const hooksConfigPath = path.join(kitRoot, "hooks", "hooks.json")
const sessionStartPath = path.join(kitRoot, "hooks", "session-start")
const metaSkillPath = path.join(kitRoot, "skills", "using-skills", "SKILL.md")
```

- [ ] **Step 2: Replace with Layer A / Layer B refs**

```js
const manifestPath = path.join(kitRoot, "opencode.json")
const manifest = readJsonIfExists(manifestPath)
const { registryPath, installManifestPath } = getManifestPaths(kitRoot, manifest)
const installManifest = readJsonIfExists(installManifestPath)
const hooksConfigPath = path.join(kitRoot, "src", "hooks", "hooks.json")
const sessionStartPath = path.join(kitRoot, "src", "hooks", "session-start.js")
const metaSkillPath = path.join(kitRoot, "src", "skills", "using-skills", "SKILL.md")
```

Rationale:
- `manifestPath` → Layer A `<kitRoot>/opencode.json`
- `hooksConfigPath`, `sessionStartPath` → Layer B (`<kitRoot>/src/hooks/...`); also fixed missing `.js` extension on `sessionStartPath`
- `metaSkillPath` → Layer B

- [ ] **Step 3: Locate `runDoctor` block (around line 3892)**

Read lines 3892-3902. Current code:

```js
const manifestPath = path.join(kitRoot, ".opencode", "opencode.json")
const manifestInfo = tryReadJson(manifestPath)
const manifest = manifestInfo.data
const { registryPath, installManifestPath } = getManifestPaths(kitRoot, manifest)
const registryInfo = tryReadJson(registryPath)
const installManifestInfo = tryReadJson(installManifestPath)
const installManifest = installManifestInfo.data
const hooksConfigPath = path.join(kitRoot, "hooks", "hooks.json")
const sessionStartPath = path.join(kitRoot, "hooks", "session-start")
const metaSkillPath = path.join(kitRoot, "skills", "using-skills", "SKILL.md")
const workflowStateCliPath = path.join(kitRoot, ".opencode", "workflow-state.js")
```

- [ ] **Step 4: Replace with normalized refs**

```js
const manifestPath = path.join(kitRoot, "opencode.json")
const manifestInfo = tryReadJson(manifestPath)
const manifest = manifestInfo.data
const { registryPath, installManifestPath } = getManifestPaths(kitRoot, manifest)
const registryInfo = tryReadJson(registryPath)
const installManifestInfo = tryReadJson(installManifestPath)
const installManifest = installManifestInfo.data
const hooksConfigPath = path.join(kitRoot, "src", "hooks", "hooks.json")
const sessionStartPath = path.join(kitRoot, "src", "hooks", "session-start.js")
const metaSkillPath = path.join(kitRoot, "src", "skills", "using-skills", "SKILL.md")
const workflowStateCliPath = path.join(kitRoot, "src", "openkit-runtime", "workflow-state.js")
```

- [ ] **Step 5: Run workflow-state CLI doctor smoke**

```bash
node src/openkit-runtime/workflow-state.js doctor 2>&1 | head -30
```

Expected: No "file not found" for hooks-config, session-start, meta-skill, workflow-state-cli paths.

- [ ] **Step 6: Run workflow contract + runtime tests**

```bash
node --test src/openkit-runtime/tests/workflow-contract-consistency.test.js \
            src/openkit-runtime/tests/workflow-state-cli.test.js \
            src/tests/runtime/runtime-bootstrap.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/openkit-runtime/lib/workflow-state-controller.js
git commit -m "$(cat <<'COMMIT'
fix(workflow-state-controller): normalize kit-root paths post-reorg

resolvePathContext and runDoctor both reference kit-internal files
that moved under src/ in v0.9.0:

- manifestPath: <kitRoot>/.opencode/opencode.json → <kitRoot>/opencode.json
- hooksConfigPath: <kitRoot>/hooks/hooks.json → <kitRoot>/src/hooks/hooks.json
- sessionStartPath: <kitRoot>/hooks/session-start → <kitRoot>/src/hooks/session-start.js
- metaSkillPath: <kitRoot>/skills/.../SKILL.md → <kitRoot>/src/skills/.../SKILL.md
- workflowStateCliPath: <kitRoot>/.opencode/workflow-state.js → <kitRoot>/src/openkit-runtime/workflow-state.js

Doctor surface now accurately reports kit-internal file presence.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
COMMIT
)"
```

**Checkpoint #3 — Human review pause:** Confirm `openkit doctor` / `node src/openkit-runtime/workflow-state.js doctor` no longer report false-missing files.

---

## Phase 4: Drift detector (Theme A new rows)

### Task 10: Add `detectKitLayoutDrift` + `repaired-layout` action in `ensure-install.js`

**Files:**
- Modify: `src/global/ensure-install.js`
- Modify: `src/global/materialize.js` (export a re-staging entry point)
- Create: `src/tests/install/drift-detector.test.js`

- [ ] **Step 1: Add a public `repairKitLayout` entry point to `materialize.js`**

In `src/global/materialize.js`, add after `validateMaterializedKitLayout`:

```js
export function repairKitLayout({ kitRoot, packageRoot = PACKAGE_ROOT } = {}) {
  const stageSummary = stageOpenCodeDiscoveryLayer({ kitRoot, packageRoot });
  const validation = validateMaterializedKitLayout(kitRoot);
  return { stageSummary, validation };
}
```

- [ ] **Step 2: Write failing test**

Create `src/tests/install/drift-detector.test.js`:

```js
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { detectKitLayoutDrift } from '../../global/ensure-install.js';

function makeKitRootWithLayerB() {
  const kitRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-drift-'));
  fs.mkdirSync(path.join(kitRoot, 'src', 'openkit-runtime'), { recursive: true });
  fs.writeFileSync(path.join(kitRoot, 'src', 'openkit-runtime', 'workflow-state.js'), 'stub');
  return kitRoot;
}

describe('detectKitLayoutDrift', () => {
  test('returns true when <kitRoot>/commands missing', () => {
    const kitRoot = makeKitRootWithLayerB();
    try {
      assert.equal(detectKitLayoutDrift(kitRoot), true);
    } finally {
      fs.rmSync(kitRoot, { recursive: true, force: true });
    }
  });

  test('returns false when commands+agents+skills all present', () => {
    const kitRoot = makeKitRootWithLayerB();
    try {
      for (const cls of ['commands', 'agents', 'skills']) {
        fs.mkdirSync(path.join(kitRoot, cls), { recursive: true });
        fs.writeFileSync(path.join(kitRoot, cls, 'stub.md'), 'stub');
      }
      assert.equal(detectKitLayoutDrift(kitRoot), false);
    } finally {
      fs.rmSync(kitRoot, { recursive: true, force: true });
    }
  });

  test('returns true when commands dir exists but empty', () => {
    const kitRoot = makeKitRootWithLayerB();
    try {
      fs.mkdirSync(path.join(kitRoot, 'commands'), { recursive: true });
      fs.mkdirSync(path.join(kitRoot, 'agents'), { recursive: true });
      fs.writeFileSync(path.join(kitRoot, 'agents', 'A.md'), 'stub');
      fs.mkdirSync(path.join(kitRoot, 'skills'), { recursive: true });
      fs.writeFileSync(path.join(kitRoot, 'skills', 's', 'SKILL.md'), 'stub');
      assert.equal(detectKitLayoutDrift(kitRoot), true);
    } finally {
      fs.rmSync(kitRoot, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
node --test src/tests/install/drift-detector.test.js
```

Expected: FAIL with "detectKitLayoutDrift is not a function".

- [ ] **Step 4: Implement `detectKitLayoutDrift` and wire `repaired-layout` action**

In `src/global/ensure-install.js`, add:

```js
import { materializeGlobalInstall, repairKitLayout } from './materialize.js';
// (existing imports unchanged)

const LAYER_A_REQUIRED_DIRS = ['commands', 'agents', 'skills'];

export function detectKitLayoutDrift(kitRoot) {
  for (const cls of LAYER_A_REQUIRED_DIRS) {
    const dir = path.join(kitRoot, cls);
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return true;
    const entries = fs.readdirSync(dir).filter((name) => !name.startsWith('.'));
    if (entries.length === 0) return true;
  }
  return false;
}
```

Then modify `ensureGlobalInstall` body to insert drift handling. After the tooling repair block (around line 53), before the `return { action: ..., installed: false }`:

```js
    // Existing tooling-only path returned here.
    // Before returning, check for Layer A drift even if doctor is happy.
    const { kitRoot } = getGlobalPaths({ env });
    if (detectKitLayoutDrift(kitRoot)) {
      const repair = repairKitLayout({ kitRoot });
      const doctorAfterRepair = inspectGlobalDoctor({ projectRoot, env });
      return {
        action: 'repaired-layout',
        installed: false,
        doctor: doctorAfterRepair,
        repair,
        tooling,
      };
    }

    return {
      action: doctor.canRunCleanly || doctor.status === 'workspace-ready-with-issues'
        ? 'repaired-tooling'
        : 'blocked',
      installed: false,
      doctor,
      tooling,
    };
```

Also at top of the function (before the early tooling-OK return), add drift handling:

```js
  if (initialDoctor.status !== 'install-missing') {
    const { kitRoot } = getGlobalPaths({ env });
    const layoutDrifted = detectKitLayoutDrift(kitRoot);

    const astGrepMissing = !hasManagedAstGrepShims(env) || !isAstGrepAvailable({ env });
    const semgrepMissing = !isSemgrepAvailable({ env });

    if (!astGrepMissing && !semgrepMissing && !layoutDrifted) {
      return {
        action: 'none',
        installed: false,
        doctor: initialDoctor,
      };
    }

    if (layoutDrifted && !astGrepMissing && !semgrepMissing) {
      const repair = repairKitLayout({ kitRoot });
      const doctorAfterRepair = inspectGlobalDoctor({ projectRoot, env });
      return {
        action: 'repaired-layout',
        installed: false,
        doctor: doctorAfterRepair,
        repair,
      };
    }

    // Otherwise fall through to existing tooling repair logic...
    // (rest of function unchanged)
```

Adjust the existing logic block accordingly. The shape of the final function must:
- Return `{ action: 'none' }` only when tooling AND layout are both healthy
- Return `{ action: 'repaired-layout', repair }` when only layout was drifted
- Return `{ action: 'repaired-tooling', tooling }` when only tooling repaired
- Return both repair + tooling when both happened (combined as `'repaired-tooling-and-layout'` OR keep as two passes — prefer two passes for simplicity: layout drift first, then tooling repair on top).

For clarity, here is the full rewrite of `ensureGlobalInstall`:

```js
export function ensureGlobalInstall({
  projectRoot = process.cwd(),
  env = process.env,
  ensureAstGrep = ensureAstGrepInstalled,
  ensureSemgrep = ensureSemgrepInstalled,
} = {}) {
  const initialDoctor = inspectGlobalDoctor({ projectRoot, env });

  if (initialDoctor.status === 'install-invalid') {
    return { action: 'blocked', installed: false, doctor: initialDoctor };
  }

  if (initialDoctor.status === 'install-missing') {
    const install = materializeGlobalInstall({ env, ensureAstGrep, ensureSemgrep });
    const doctor = inspectGlobalDoctor({ projectRoot, env });
    return {
      action: doctor.canRunCleanly || doctor.status === 'workspace-ready-with-issues' ? 'installed' : 'blocked',
      installed: true,
      install,
      doctor,
    };
  }

  const { kitRoot } = getGlobalPaths({ env });
  const layoutDrifted = detectKitLayoutDrift(kitRoot);
  const astGrepMissing = !hasManagedAstGrepShims(env) || !isAstGrepAvailable({ env });
  const semgrepMissing = !isSemgrepAvailable({ env });

  let repair = null;
  if (layoutDrifted) {
    repair = repairKitLayout({ kitRoot });
  }

  let tooling = null;
  if (astGrepMissing || semgrepMissing) {
    tooling = {
      astGrep: astGrepMissing ? ensureAstGrep({ env }) : null,
      semgrep: semgrepMissing ? ensureSemgrep({ env }) : null,
    };
  }

  if (!layoutDrifted && !astGrepMissing && !semgrepMissing) {
    return { action: 'none', installed: false, doctor: initialDoctor };
  }

  const doctor = inspectGlobalDoctor({ projectRoot, env });
  let action;
  if (repair && tooling) action = 'repaired-tooling-and-layout';
  else if (repair)       action = 'repaired-layout';
  else                   action = doctor.canRunCleanly || doctor.status === 'workspace-ready-with-issues' ? 'repaired-tooling' : 'blocked';

  return { action, installed: false, doctor, ...(repair ? { repair } : {}), ...(tooling ? { tooling } : {}) };
}
```

- [ ] **Step 5: Run drift test + ensure-install tests**

```bash
node --test src/tests/install/drift-detector.test.js src/tests/install/*.test.js
```

Expected: PASS for drift-detector + no regression in existing install tests.

- [ ] **Step 6: Commit**

```bash
git add src/global/ensure-install.js src/global/materialize.js src/tests/install/drift-detector.test.js
git commit -m "$(cat <<'COMMIT'
feat(ensure-install): add Layer A drift detector with auto-repair

detectKitLayoutDrift checks if <kitRoot>/{commands,agents,skills}/
exist and are non-empty. When drift is detected (e.g. existing
v0.9.0/.1/.2 installs upgrading to v0.9.3+), ensureGlobalInstall now
auto-runs stageOpenCodeDiscoveryLayer + validateMaterializedKitLayout
via repairKitLayout, returning action 'repaired-layout'. Users avoid
having to run `openkit upgrade` to fix slash command discovery.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
COMMIT
)"
```

### Task 11: Display block in `run.js` for `repaired-layout` action

**Files:**
- Modify: `src/cli/commands/run.js` (after line 127 `repaired-tooling` block)

- [ ] **Step 1: Locate existing `repaired-tooling` block**

Around line 119-127:

```js
if (ensured.action === 'repaired-tooling') {
  io.stdout.write('OpenKit detected missing runtime tooling and repaired it automatically.\n');
  if (ensured.tooling?.astGrep?.installed) {
    io.stdout.write(`Installed ast-grep tooling into ${ensured.tooling.astGrep.toolingRoot}\n`);
  }
  if (ensured.tooling?.semgrep?.installed) {
    io.stdout.write(`Installed semgrep tooling into ${ensured.tooling.semgrep.toolingRoot}\n`);
  }
}
```

- [ ] **Step 2: Add a new display block immediately after**

```js
if (ensured.action === 'repaired-layout' || ensured.action === 'repaired-tooling-and-layout') {
  io.stdout.write('OpenKit detected missing OpenCode discovery layer and repaired it automatically.\n');
  const staged = ensured.repair?.stageSummary?.staged ?? [];
  if (staged.length > 0) {
    io.stdout.write(`Staged: ${staged.join(', ')}\n`);
  }
  const v = ensured.repair?.validation;
  if (v?.ok) {
    io.stdout.write(`Layout: ${v.commandCount} commands, ${v.agentCount} agents, ${v.skillCount} skills.\n`);
  }
}
```

- [ ] **Step 3: Manual smoke test**

```bash
# Simulate drift: remove Layer A from existing materialized kit
rm -rf "$HOME/.config/opencode/kits/openkit/commands" \
       "$HOME/.config/opencode/kits/openkit/agents" \
       "$HOME/.config/opencode/kits/openkit/skills"

# Run; should auto-repair
node src/bin/openkit.js run --worktree-mode=none --help
```

Expected: stdout includes "OpenKit detected missing OpenCode discovery layer and repaired it automatically." and "Layout: N commands, M agents, K skills."

Then verify Layer A is back:

```bash
ls "$HOME/.config/opencode/kits/openkit/commands/" | head -5
```

Expected: at least 8 .md files.

- [ ] **Step 4: Commit**

```bash
git add src/cli/commands/run.js
git commit -m "$(cat <<'COMMIT'
feat(cli/run): surface repaired-layout action to user

Mirror the repaired-tooling display block. When ensureGlobalInstall
auto-heals Layer A drift, surface a one-line notice plus a count
summary so the operator sees what happened.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
COMMIT
)"
```

**Checkpoint #4 — Human review pause:** Confirm drift simulation triggers auto-repair end-to-end.

---

## Phase 5: Existing test updates + final verification

### Task 12: Update `registry-metadata.test.js` assertion

**Files:**
- Modify: `src/tests/runtime/registry-metadata.test.js` (line 71)

- [ ] **Step 1: Read current assertion**

```bash
sed -n '65,80p' src/tests/runtime/registry-metadata.test.js
```

Current assertion (line 71):
```js
assert.ok(installManifest.installation.wrapperFacingMetadata.includes('assets/install-bundle/opencode/skill-catalog.json'));
```

- [ ] **Step 2: Update to post-reorg path**

In `src/tests/runtime/registry-metadata.test.js`, change line 71 to:

```js
assert.ok(installManifest.installation.wrapperFacingMetadata.includes('src/assets/install-bundle/opencode/skill-catalog.json'));
```

If line 70 also references `.opencode/install-manifest.json`, update it too:

```js
assert.ok(installManifest.installation.wrapperFacingMetadata.includes('src/openkit-runtime/install-manifest.json'));
```

(Update only the ones still using stale paths; preserve any already-correct assertions.)

- [ ] **Step 3: Run test (expect FAIL until manifest is fixed in PR #2)**

```bash
node --test src/tests/runtime/registry-metadata.test.js
```

Expected: FAIL because `install-manifest.json` still has stale path values. **This is expected** — the test is now correct; the manifest fix is in PR #2 (Theme D).

To unblock PR #1 CI, also update `src/openkit-runtime/install-manifest.json` lines 21-29 (P1 in spec, but moved to P0 here to unblock test):

```json
{
  ...
  "installation": {
    ...
    "repositoryInternalRuntime": "src/openkit-runtime/opencode.json",
    "wrapperFacingMetadata": [
      "registry.json",
      "src/openkit-runtime/install-manifest.json",
      "src/assets/install-bundle/opencode/skill-catalog.json"
    ]
  },
  "migration": {
    "currentRuntimeManifest": "src/openkit-runtime/opencode.json",
    ...
  },
  ...
}
```

- [ ] **Step 4: Re-run test (expect PASS)**

```bash
node --test src/tests/runtime/registry-metadata.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tests/runtime/registry-metadata.test.js src/openkit-runtime/install-manifest.json
git commit -m "$(cat <<'COMMIT'
fix(install-manifest): align metadata paths with post-reorg layout

repositoryInternalRuntime, wrapperFacingMetadata, and migration.
currentRuntimeManifest all referenced pre-reorg paths
(.opencode/opencode.json, assets/install-bundle/...). After v0.9.0
the truth is src/openkit-runtime/opencode.json and
src/assets/install-bundle/...

Updated registry-metadata.test.js assertion that was previously
asserting the stale value (masking this drift).

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
COMMIT
)"
```

### Task 13: Run full `verify:all` suite + manual smoke

- [ ] **Step 1: Run full verify suite**

```bash
npm run verify:all
```

Expected: all suites PASS (including the new tests added in this PR).

- [ ] **Step 2: Fresh-install smoke**

```bash
rm -rf "$HOME/.config/opencode/kits/openkit"
node src/bin/openkit.js install --verify
```

Expected: "Installed OpenKit globally." with kit root and tooling paths.

- [ ] **Step 3: Verify Layer A presence**

```bash
ls "$HOME/.config/opencode/kits/openkit/commands/" | grep -E '(delivery|quick-task|migrate|finish|handoff|start-work)\.md'
ls "$HOME/.config/opencode/kits/openkit/agents/"   | grep -E '(MasterOrchestrator|QuickAgent|ProductLead)\.md'
ls "$HOME/.config/opencode/kits/openkit/skills/"
```

Expected: all listed files present.

- [ ] **Step 4: Drift-repair smoke**

```bash
rm -rf "$HOME/.config/opencode/kits/openkit/commands"
node src/bin/openkit.js install --verify 2>&1 | head -10
ls "$HOME/.config/opencode/kits/openkit/commands/" | head -3
```

Expected: notice "OpenKit detected missing OpenCode discovery layer and repaired it automatically." AND commands directory is recreated.

- [ ] **Step 5: End-to-end in OpenCode (manual)**

```bash
node src/bin/openkit.js run
```

Inside the OpenCode session, type `/` and verify autocomplete shows:

- `/delivery`
- `/quick-task`
- `/migrate`
- `/finish`
- `/handoff`
- `/start-work`
- `/write-solution`
- `/execute-solution`
- `/switch-profiles`
- `/configure-agent-models`

Acceptance criterion: at least 8 of the 10 above appear.

### Task 14: Open PR

- [ ] **Step 1: Push branch**

```bash
git push -u origin HEAD:fix/discovery-layer-pr1-p0-core
```

- [ ] **Step 2: Open PR via `gh`**

```bash
gh pr create --title "fix: restore OpenKit slash command discovery (P0 core)" --body "$(cat <<'BODY'
## Summary

- Adds `stageOpenCodeDiscoveryLayer` and `validateMaterializedKitLayout` to `materializeGlobalInstall` so OpenCode auto-discovers `/delivery`, `/quick-task`, `/migrate`, `/finish`, ... at `<kitRoot>/commands/` after v0.9.0 reorg.
- Expands install-bundle to cover `/finish`, `/handoff`, `/start-work`; classifies remaining `src/commands/*.md` as `internalOnly` with rationale.
- Adds `detectKitLayoutDrift` + `repaired-layout` auto-repair so existing v0.9.0/.1/.2 installs heal on next `openkit run`.
- Normalizes consumer paths in `session-start.js` and `workflow-state-controller.js` to Layer B (`<kitRoot>/src/...`).
- Updates `install-manifest.json` and `registry-metadata.test.js` to drop pre-reorg `.opencode/` and `assets/` prefixes.

## Test plan

- [ ] `npm run verify:all` passes
- [ ] Fresh install smoke: `rm -rf "$HOME/.config/opencode/kits/openkit"; node src/bin/openkit.js install --verify; ls "$HOME/.config/opencode/kits/openkit/commands/"` shows ≥ 8 .md files
- [ ] Drift-repair smoke: remove `<kitRoot>/commands/`, run `openkit install --verify`, observe `repaired-layout` notice and restored directory
- [ ] Inside `openkit run`, typing `/` shows the curated OpenKit slash commands

## Spec

`docs/superpowers/specs/2026-05-16-openkit-discovery-layer-fix-design.md` (commit 9803db4) — PR #1 scope (P0 only).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
BODY
)"
```

- [ ] **Step 3: Output PR URL** to user for review.

---

## Self-Review Checklist (run after writing plan)

Spec coverage map (each spec section → task):

| Spec section | Task |
|---|---|
| §4 Theme A row 1 (GLOBAL_KIT_ASSETS shape) | Task 4 |
| §4 Theme A row 2 (stageOpenCodeDiscoveryLayer) | Task 5 |
| §4 Theme A row 3 (validateMaterializedKitLayout) | Task 6 |
| §4 Theme A row 4 (SessionStart hook path) | Verified preserved in Task 7 wiring |
| §4 Theme A row 5 (detectKitLayoutDrift) | Task 10 |
| §4 Theme A row 6 (run.js display block) | Task 11 |
| §4 Theme B P0 (asset-manifest expand) | Task 1, 2 |
| §4 Theme B P0 (sourceCommandsMissingFromBundle) | Task 3 |
| §4 Theme C P0 (session-start.js) | Task 8 |
| §4 Theme C P0 (workflow-state-controller.js) | Task 9 |
| §4 Theme E P0 (registry-metadata test) | Task 12 |
| §4 Theme E P0 (materialize-global.test.js) | Task 7 |
| §4 Theme E P0 (asset-manifest-coverage.test.js) | Task 3 |
| §5 Materialize flow | Task 7 implements |
| §7 Error handling | Task 6 (MaterializationError) |
| §8 Backward compat (drift detector) | Task 10 |
| §14 Acceptance criteria 1-2 | Task 13 |
| §14 Acceptance criteria 4 | Task 14 |
| §14 Acceptance criteria 6 (release notes) | Out of scope PR #1 — handled in v0.9.3 release prep |

**Items intentionally promoted from P1 to P0 in this plan** (deviation from spec, justified):
- `install-manifest.json` path fixes (Theme D): promoted because `registry-metadata.test.js` would otherwise fail. Better to fix together.

**Open question handling:** Spec §15 lists `/handoff`, `/start-work` as candidates for public surface. Plan bundles them (Task 1). `/init-deep`, `/refactor`, `/stop-continuation` marked `internalOnly` (Task 3). If user wants `/init-deep` etc public, swap rows in Task 1 + Task 3.
