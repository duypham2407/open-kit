# OpenKit Audit Fix — Wave 2a (Contract Drift) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve the three contract-drift findings from Wave 2 ([3-H-2] missing `/configure-embedding` registry entry; [3-H-3] agent reference to non-existent `tool.heuristic-lsp`; [1-H-3] `tool.bootstrap-workflow` missing from MCP schema), so the registry/agent/MCP layers stop disagreeing about what tools and commands exist.

**Architecture:** Three independent contract repairs. Each fix is small and narrow: insert one registry entry, replace two markdown table cells, add one MCP schema entry. Add two contract tests — one new (`tests/contract/agent-tool-references.test.js`) that scans every agent markdown for `tool.<id>` references and asserts they exist in `registry.json#runtimeTools`, and an extension to `tests/mcp-server/tool-schemas.test.js`-style coverage that confirms every runtime-registered tool has a matching MCP schema entry.

**Tech Stack:** Node.js ≥ 18, ESM, `node:test` test runner, `node:assert/strict`. No new dependencies.

**Spec reference:** `docs/superpowers/specs/2026-05-09-project-audit-fix-plan.md` Wave 2 (entries [3-H-2], [3-H-3], [1-H-3]).

**Audit baseline:** Wave 1 commits land at `35e7fa8` on `main`; tag `audit-wave-1-complete`.

---

## File Structure

| Path | Action | Responsibility |
|------|--------|----------------|
| `registry.json` | Modify | Add `command.configure-embedding` entry to `components.commands`. |
| `AGENTS.md` | Modify | Add `/configure-embedding` to the command enumeration on line 27. |
| `agents/solution-lead-agent.md` | Modify | Replace `tool.heuristic-lsp` (line 51) with `tool.lsp-symbols`. |
| `agents/code-reviewer.md` | Modify | Replace `tool.heuristic-lsp` (line 76) with `tool.lsp-symbols`. |
| `tests/contract/agent-tool-references.test.js` | **Create** | Scans `agents/*.md` for `tool.<id>` references and asserts each ID exists in `registry.json#runtimeTools`. |
| `src/mcp-server/tool-schemas.js` | Modify | Add `tool.bootstrap-workflow` schema entry matching the runtime tool's input contract. |
| `tests/mcp-server/tool-schema-runtime-parity.test.js` | **Create** | Asserts every runtime-registered tool ID exposed by `getMcpExposedToolIds()` has a matching `TOOL_SCHEMAS` entry, and conversely every schema entry maps to a registered tool (when the tool registry is constructed with a stub kernel). |

Tasks are ordered so each commit lands a complete, green change.

---

## Task 1: Fix [3-H-2] — Register /configure-embedding

**Files:**
- Modify: `registry.json` (insert one entry under `components.commands`)
- Modify: `AGENTS.md:27` (extend command enumeration)

The other 14 commands in `registry.json` already use this schema:
```json
{
  "id": "command.<name>",
  "name": "/<name>",
  "path": "commands/<name>.md",
  "audience": "operator",
  "surface": "in-session",
  "modes": ["quick"]   // or ["quick", "migration", "full"], etc.
}
```

`/configure-embedding` is operator-facing, runs both as a CLI subcommand (`openkit configure-embedding`) and as an in-session slash command. It is mode-agnostic.

- [ ] **Step 1: Run the registry-metadata test to capture current state**

Run: `node --test tests/runtime/registry-metadata.test.js`
Expected: passes (current main is green; registry tests don't currently assert `configure-embedding` presence).

- [ ] **Step 2: Open `registry.json` and locate `components.commands`**

Find the array that starts with `command.quick-task`. The last entry in the array should be the closing brace before the next top-level component group.

- [ ] **Step 3: Add the `configure-embedding` entry**

Append (before the closing `]` of `components.commands`) — keep the array's existing comma separation; add a comma after the previous last entry if needed:

```json
{
  "id": "command.configure-embedding",
  "name": "/configure-embedding",
  "path": "commands/configure-embedding.md",
  "audience": "operator",
  "surface": "in-session",
  "modes": ["quick", "migration", "full"]
}
```

- [ ] **Step 4: Verify the JSON parses and the entry is reachable**

Run:
```
node -e "const r=require('./registry.json'); const c=r.components.commands.find(x=>x.id==='command.configure-embedding'); console.log(c ? JSON.stringify(c) : 'MISSING'); console.log('total commands:', r.components.commands.length)"
```
Expected: prints the new entry as JSON; `total commands` is `15` (was 14).

- [ ] **Step 5: Update `AGENTS.md` line 27 to include /configure-embedding**

Open `AGENTS.md`. Line 27 currently reads:
```
- `commands/`: User-facing triggers such as `/quick-task`, `/migrate`, `/delivery`, `/write-solution`, `/execute-solution`, `/configure-agent-models`, and `/switch-profiles`
```

Replace with:
```
- `commands/`: User-facing triggers such as `/quick-task`, `/migrate`, `/delivery`, `/write-solution`, `/execute-solution`, `/configure-agent-models`, `/configure-embedding`, and `/switch-profiles`
```

- [ ] **Step 6: Run registry-metadata test plus full suite (with one accepted failure)**

Run:
```
node --test tests/runtime/registry-metadata.test.js
npm run verify:all 2>&1 | grep "^✖ "
```

The registry-metadata test must pass. The verify:all output should show only the one known accepted backlog failure:
```
✖ openkit run creates CommonJS workflow wrappers without module-boundary warnings
```

If any other failure appears, STOP and report BLOCKED.

- [ ] **Step 7: Commit**

Run:
```
git add registry.json AGENTS.md
git commit -m "$(cat <<'EOF'
fix(registry): register /configure-embedding command [3-H-2]

The configure-embedding command file (commands/configure-embedding.md)
shipped without a registry.json entry, so any tooling discovering
commands via the registry could not surface it. AGENTS.md also
omitted it from the command enumeration on line 27 ([3-L-4]).

Add the registry entry under components.commands and extend the
AGENTS.md command list. modes is set to all three lanes because
embedding configuration is mode-agnostic.

Refs: docs/superpowers/specs/2026-05-09-project-audit-report.md
(3-H-2, 3-L-4)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

Expected: commit succeeds.

---

## Task 2: Fix [3-H-3] — Replace tool.heuristic-lsp with tool.lsp-symbols

**Files:**
- Modify: `agents/solution-lead-agent.md:51`
- Modify: `agents/code-reviewer.md:76`
- Create: `tests/contract/agent-tool-references.test.js`

Decision rationale: `tool.heuristic-lsp` does not exist in the registry. The two agent files use it for "Symbol references and rename impact" purposes. Of the registered tools, `tool.lsp-symbols` (already present in the registry as `Stage 2 LSP Symbols Surface`) most closely matches that description and is already cited by adjacent rows in the same agent files. Using a single replacement keeps the agent contracts internally consistent.

- [ ] **Step 1: Write the failing contract test**

Create `tests/contract/agent-tool-references.test.js`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');

const registry = JSON.parse(fs.readFileSync(path.join(projectRoot, 'registry.json'), 'utf8'));
const registeredTools = new Set(
  (registry.components?.runtimeTools ?? []).map((t) => t.id),
);

const agentDir = path.join(projectRoot, 'agents');
const agentFiles = fs.readdirSync(agentDir).filter((name) => name.endsWith('.md'));

const TOOL_REFERENCE_PATTERN = /`(tool\.[a-z][a-z0-9-]+)`/g;

for (const agentFile of agentFiles) {
  test(`agent ${agentFile} references only registered tool IDs`, () => {
    const content = fs.readFileSync(path.join(agentDir, agentFile), 'utf8');
    const referenced = new Set();
    for (const match of content.matchAll(TOOL_REFERENCE_PATTERN)) {
      referenced.add(match[1]);
    }

    const missing = [...referenced].filter((id) => !registeredTools.has(id));
    assert.deepEqual(
      missing,
      [],
      `${agentFile} references tool IDs that are not in registry.json#runtimeTools: ${missing.join(', ')}`,
    );
  });
}
```

- [ ] **Step 2: Confirm the test directory exists and run the test**

Run: `mkdir -p tests/contract && node --test tests/contract/agent-tool-references.test.js`

Expected: TWO tests fail — `solution-lead-agent.md` and `code-reviewer.md` both reference `tool.heuristic-lsp`, which is not in the registry. Other agent files pass.

- [ ] **Step 3: Update `agents/solution-lead-agent.md` line 51**

Open `agents/solution-lead-agent.md`. Locate the row in the "MAY — optional helpers" table:

```markdown
| `tool.heuristic-lsp` | Symbol references and rename impact | Tracing symbol references to assess impact surface |
```

Replace `` `tool.heuristic-lsp` `` (the first cell) with `` `tool.lsp-symbols` ``. The row becomes:

```markdown
| `tool.lsp-symbols` | Symbol references and rename impact | Tracing symbol references to assess impact surface |
```

The Purpose and "When to use" cells are unchanged.

- [ ] **Step 4: Update `agents/code-reviewer.md` line 76**

Open `agents/code-reviewer.md`. Locate the row in the "SHOULD — use when structurally verifying patterns" table:

```markdown
| `tool.heuristic-lsp` | Symbol references and rename impact | Tracing call sites or rename impact across files |
```

Replace `` `tool.heuristic-lsp` `` with `` `tool.lsp-symbols` ``. Row becomes:

```markdown
| `tool.lsp-symbols` | Symbol references and rename impact | Tracing call sites or rename impact across files |
```

- [ ] **Step 5: Run the contract test to verify it now passes**

Run: `node --test tests/contract/agent-tool-references.test.js`
Expected: all 7 tests (one per agent file) PASS.

- [ ] **Step 6: Run full verify suite**

Run: `npm run verify:all 2>&1 | grep "^✖ "`
Only acceptable: `✖ openkit run creates CommonJS workflow wrappers without module-boundary warnings`. Any other failure = STOP.

- [ ] **Step 7: Commit**

Run:
```
git add agents/solution-lead-agent.md agents/code-reviewer.md tests/contract/agent-tool-references.test.js
git commit -m "$(cat <<'EOF'
fix(contract): replace tool.heuristic-lsp with tool.lsp-symbols [3-H-3]

Solution Lead and Code Reviewer agent specs cited tool.heuristic-lsp
in their tool tables, but no such tool exists in registry.json or
under src/runtime/tools/. Models directing to invoke this tool would
either error out or be silently ignored.

Replace both references with tool.lsp-symbols, which is registered,
implemented under src/runtime/tools/lsp/, and serves the documented
"symbol references and rename impact" purpose.

Add tests/contract/agent-tool-references.test.js as a regression
harness: it scans every agents/*.md for tool.<id> references and
asserts each one exists in registry.json#runtimeTools.

Refs: docs/superpowers/specs/2026-05-09-project-audit-report.md (3-H-3)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Fix [1-H-3] — Add tool.bootstrap-workflow to MCP schema

**Files:**
- Modify: `src/mcp-server/tool-schemas.js` (add new entry to `TOOL_SCHEMAS`)
- Create: `tests/mcp-server/tool-schema-runtime-parity.test.js`

The runtime tool at `src/runtime/tools/workflow/bootstrap-workflow.js:25` accepts:
```
{ lane: 'quick' | 'full' | 'migration', description: string, featureSlug?: string, archivePrior?: boolean }
```

The MCP server filters out tools without `TOOL_SCHEMAS` entries (`src/mcp-server/index.js:149`), so MasterOrchestrator currently cannot reach this tool via MCP. Add the schema.

- [ ] **Step 1: Write the failing parity test**

Create `tests/mcp-server/tool-schema-runtime-parity.test.js`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';

import { TOOL_SCHEMAS } from '../../src/mcp-server/tool-schemas.js';

test('TOOL_SCHEMAS includes tool.bootstrap-workflow', () => {
  assert.ok(
    TOOL_SCHEMAS['tool.bootstrap-workflow'],
    'tool.bootstrap-workflow must have an MCP schema entry — without it, src/mcp-server/index.js filters the tool out of mcpTools',
  );
});

test('tool.bootstrap-workflow schema declares lane, description, featureSlug, archivePrior', () => {
  const schema = TOOL_SCHEMAS['tool.bootstrap-workflow'].inputSchema;
  assert.equal(schema.type, 'object');
  const props = schema.properties ?? {};
  assert.ok('lane' in props, 'lane property required');
  assert.ok('description' in props, 'description property required');
  assert.ok('featureSlug' in props, 'featureSlug property required (optional input)');
  assert.ok('archivePrior' in props, 'archivePrior property required (optional input)');
});

test('tool.bootstrap-workflow lane is enum [quick, full, migration]', () => {
  const lane = TOOL_SCHEMAS['tool.bootstrap-workflow'].inputSchema.properties.lane;
  assert.equal(lane.type, 'string');
  assert.deepEqual(lane.enum, ['quick', 'full', 'migration']);
});

test('tool.bootstrap-workflow required array lists lane and description', () => {
  const schema = TOOL_SCHEMAS['tool.bootstrap-workflow'].inputSchema;
  assert.ok(Array.isArray(schema.required), 'required array must be declared');
  assert.ok(schema.required.includes('lane'));
  assert.ok(schema.required.includes('description'));
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/mcp-server/tool-schema-runtime-parity.test.js`
Expected: all 4 tests FAIL — `tool.bootstrap-workflow` is not in `TOOL_SCHEMAS`.

- [ ] **Step 3: Add the schema entry**

Open `src/mcp-server/tool-schemas.js`. Locate the `// ── Workflow tools ───` comment block (around line 296). The order doesn't strictly matter, but for readability place the new entry directly after `'tool.workflow-state'` (around line 311 after the recent edit).

Insert:

```javascript
  'tool.bootstrap-workflow': {
    description:
      'Bootstrap workflow-state.json for a fresh lane. MasterOrchestrator must call this on the first command in a project to initialize state.',
    inputSchema: {
      type: 'object',
      properties: {
        lane: {
          type: 'string',
          enum: ['quick', 'full', 'migration'],
          description: 'The lane to bootstrap (quick / full / migration).',
        },
        description: {
          type: 'string',
          description: 'The user\'s raw task request text.',
        },
        featureSlug: {
          type: 'string',
          description: 'Optional. Stable slug used in feature_id; auto-generated when omitted.',
        },
        archivePrior: {
          type: 'boolean',
          description: 'Optional. When true, archives any existing in-progress workflow before bootstrapping the new one.',
        },
      },
      required: ['lane', 'description'],
    },
  },
```

- [ ] **Step 4: Run the parity test to verify it now passes**

Run: `node --test tests/mcp-server/tool-schema-runtime-parity.test.js`
Expected: all 4 tests PASS.

- [ ] **Step 5: Run MCP server suite to confirm no regression**

Run: `node --test tests/mcp-server/mcp-server.test.js`
Expected: passes.

- [ ] **Step 6: Run full verify**

Run: `npm run verify:all 2>&1 | grep "^✖ "`
Only acceptable: the known backlog failure.

- [ ] **Step 7: Commit**

Run:
```
git add src/mcp-server/tool-schemas.js tests/mcp-server/tool-schema-runtime-parity.test.js
git commit -m "$(cat <<'EOF'
fix(mcp): expose tool.bootstrap-workflow via MCP schema [1-H-3]

createBootstrapWorkflowTool was registered in the runtime tool
registry (src/runtime/tools/tool-registry.js:68) but had no
TOOL_SCHEMAS entry, so src/mcp-server/index.js:149 filtered it
out of mcpTools. MasterOrchestrator — which depends on this tool
to start any lane — could not reach it via MCP at all.

Add the schema entry matching the runtime handler's input
contract: lane (enum), description, optional featureSlug and
archivePrior. Add a parity regression test asserting the schema
exposes the same 4 properties and the required array lists the
two mandatory inputs.

Refs: docs/superpowers/specs/2026-05-09-project-audit-report.md (1-H-3)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Wave 2a — Final verification

### Task 4: Confirm Wave 2a is complete and tests are green

**Files:** none (verification only).

- [ ] **Step 1: Run all the new tests together**

Run:
```
node --test tests/contract/agent-tool-references.test.js tests/mcp-server/tool-schema-runtime-parity.test.js
```

Expected: 11 tests pass total (7 agent files + 4 schema parity tests). 0 failures.

- [ ] **Step 2: Run full verify**

Run: `npm run verify:all 2>&1 | grep "^✖ "`
Only acceptable: the known backlog failure.

- [ ] **Step 3: Confirm linear commit history**

Run: `git log --oneline -5`
Expected (most recent first):
- Task 3 commit: `fix(mcp): expose tool.bootstrap-workflow via MCP schema [1-H-3]`
- Task 2 commit: `fix(contract): replace tool.heuristic-lsp with tool.lsp-symbols [3-H-3]`
- Task 1 commit: `fix(registry): register /configure-embedding command [3-H-2]`
- Plus prior commits from Wave 1 / [N-1] doc.

Run: `git status`
Expected: clean working tree (untracked plan files in `docs/superpowers/plans/` are fine).

---

## Wave 2a completion checklist

When this plan is fully executed:

- [ ] [3-H-2] resolved — `/configure-embedding` registered, AGENTS.md updated (also covers [3-L-4])
- [ ] [3-H-3] resolved — both agent files reference `tool.lsp-symbols`; new contract test prevents regression
- [ ] [1-H-3] resolved — `tool.bootstrap-workflow` reachable via MCP; new parity test prevents regression
- [ ] 3 commits on `main` (one per High finding)
- [ ] 2 new test files: `tests/contract/agent-tool-references.test.js`, `tests/mcp-server/tool-schema-runtime-parity.test.js`
- [ ] `npm run verify:all` shows only the known accepted backlog failure (`tests/cli/openkit-cli.test.js:709`)

After Wave 2a lands, proceed to Wave 2b (runtime correctness): [1-H-1], [1-H-2], [2-H-2], [2-H-3].
