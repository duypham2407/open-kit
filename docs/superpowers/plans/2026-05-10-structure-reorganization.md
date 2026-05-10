# Project Structure Reorganization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate all OpenKit source code under `/src` and rename `src/openkit-runtime/` to `src/openkit-runtime/` to avoid naming conflicts with OpenCode runtime.

**Architecture:** Single atomic migration using `git mv` to preserve history, followed by systematic reference updates in package.json, registry.json, imports, tests, and documentation. Comprehensive validation before and after ensures no broken references.

**Tech Stack:** Git, Node.js, npm, grep/sed for bulk updates

---

## Task 1: Pre-Migration Validation

**Files:**
- None (validation only)

- [ ] **Step 1: Run full verification suite**

Run:
```bash
npm run verify:all
```

Expected: All tests pass, no failures

- [ ] **Step 2: Verify git working tree is clean**

Run:
```bash
git status
```

Expected output:
```
On branch main
nothing to commit, working tree clean
```

If not clean, commit or stash changes before proceeding.

- [ ] **Step 3: Create backup branch (optional safety net)**

Run:
```bash
git checkout -b backup/pre-restructure
git checkout main
```

Expected: Backup branch created, returned to main

---

## Task 2: Execute File Moves

**Files:**
- Move: `src/agents/` → `src/agents/`
- Move: `src/commands/` → `src/commands/`
- Move: `src/skills/` → `src/skills/`
- Move: `src/context/` → `src/context/`
- Move: `src/hooks/` → `src/hooks/`
- Move: `instructions/` → `src/instructions/`
- Move: `src/openkit-runtime/` → `src/openkit-runtime/`
- Move: `bin/` → `src/bin/`
- Move: `scripts/` → `src/scripts/`
- Move: `src/tests/` → `src/tests/`
- Move: `assets/` → `src/assets/`

- [ ] **Step 1: Move OpenCode content directories**

Run:
```bash
git mv agents src/agents
git mv commands src/commands
git mv skills src/skills
git mv context src/context
git mv hooks src/hooks
git mv instructions src/instructions
```

Expected: Directories moved, git staged

- [ ] **Step 2: Rename and move .opencode to src/openkit-runtime**

Run:
```bash
git mv .opencode src/openkit-runtime
```

Expected: `src/openkit-runtime/` renamed to `src/openkit-runtime/` and staged

- [ ] **Step 3: Move tooling directories**

Run:
```bash
git mv bin src/bin
git mv scripts src/scripts
git mv tests src/tests
git mv assets src/assets
```

Expected: All directories moved and staged

- [ ] **Step 4: Verify moves completed**

Run:
```bash
git status
```

Expected: Shows renamed files, no deleted files (git mv preserves history)

---

## Task 3: Update package.json

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Update files array**

Current `files` array references:
```json
"files": [
  ".opencode/install-manifest.json",
  ".opencode/lib/",
  ".opencode/opencode.json",
  ".opencode/package.json",
  ".opencode/plugins/",
  ".opencode/profile-switch.js",
  ".opencode/switch-profiles.js",
  ".opencode/README.md",
  ".opencode/workflow-state.js",
  "agents/",
  "assets/",
  "bin/",
  "commands/",
  "context/",
  "docs/governance/",
  "docs/operator/",
  "docs/operations/README.md",
  "docs/operations/runbooks/",
  "docs/templates/",
  "hooks/",
  "instructions/",
  "skills/",
  "src/",
  "AGENTS.md",
  "CHANGELOG.md",
  "README.md",
  "RELEASES.md",
  "registry.json",
  "scripts/verify-mcp-secret-package-readiness.mjs"
]
```

Replace with:
```json
"files": [
  "src/",
  "docs/governance/",
  "docs/operator/",
  "docs/operations/README.md",
  "docs/operations/runbooks/",
  "docs/templates/",
  "AGENTS.md",
  "CHANGELOG.md",
  "README.md",
  "RELEASES.md",
  "registry.json"
]
```

Note: `src/` now includes all the previously listed directories

- [ ] **Step 2: Update bin paths**

Current:
```json
"bin": {
  "openkit": "bin/openkit.js",
  "openkit-mcp": "bin/openkit-mcp.js"
}
```

Replace with:
```json
"bin": {
  "openkit": "src/bin/openkit.js",
  "openkit-mcp": "src/bin/openkit-mcp.js"
}
```

- [ ] **Step 3: Update scripts paths**

Find and replace in `scripts` section:
- `scripts/` → `src/scripts/`
- `src/tests/` → `src/tests/`
- `src/openkit-runtime/tests/` → `src/openkit-runtime/tests/`

Current scripts that need updates:
```json
"sync:install-bundle": "node scripts/sync-install-bundle.mjs",
"sync:version": "node scripts/sync-version-metadata.mjs",
"verify:install-bundle": "node scripts/verify-install-bundle.mjs",
"verify:mcp-secret-package-readiness": "node scripts/verify-mcp-secret-package-readiness.mjs",
"verify:runtime-foundation": "node --test tests/runtime/runtime-config-loader.test.js && node --test tests/runtime/capability-registry.test.js && node --test tests/runtime/runtime-bootstrap.test.js",
"verify:governance": "node --test tests/runtime/governance-enforcement.test.js && node --test tests/runtime/registry-metadata.test.js && node --test \".opencode/tests/workflow-contract-consistency.test.js\"",
"verify:all": "npm run verify:install-bundle && npm run verify:mcp-secret-package-readiness && npm run verify:governance && npm run verify:semgrep-quality && node --test \".opencode/tests/workflow-state-cli.test.js\" && node --test \".opencode/tests/session-start-hook.test.js\" && node --test tests/runtime/*.test.js && node --test tests/runtime/sessions/*.test.js && node --test tests/runtime/state/*.test.js && node --test tests/runtime/tools/*.test.js && node --test tests/install/*.test.js && node --test tests/global/*.test.js && node --test tests/cli/*.test.js && node --test tests/hooks/*.test.js && node --test tests/assets/*.test.js && node --test tests/commands/*.test.js && node --test tests/release/*.test.js",
"verify:semgrep-quality": "node --test tests/semgrep/quality-rules.test.js",
"verify:audit-wave-1": "node --test tests/release/version-metadata-consistency.test.js tests/runtime/fsm-table-consistency.test.js tests/runtime/ast-grep-search-injection.test.js tests/mcp-server/workflow-state-contract.test.js",
"verify:sessions": "node --test tests/runtime/sessions/*.test.js && node --test tests/cli/sessions-cli.test.js && node --test tests/cli/dashboard.test.js && node --test tests/cli/finish.test.js && node --test tests/hooks/session-banner.test.js && node --test tests/assets/statusline-session.test.js"
```

Replace with:
```json
"sync:install-bundle": "node src/scripts/sync-install-bundle.mjs",
"sync:version": "node src/scripts/sync-version-metadata.mjs",
"verify:install-bundle": "node src/scripts/verify-install-bundle.mjs",
"verify:mcp-secret-package-readiness": "node src/scripts/verify-mcp-secret-package-readiness.mjs",
"verify:runtime-foundation": "node --test src/tests/runtime/runtime-config-loader.test.js && node --test src/tests/runtime/capability-registry.test.js && node --test src/tests/runtime/runtime-bootstrap.test.js",
"verify:governance": "node --test src/tests/runtime/governance-enforcement.test.js && node --test src/tests/runtime/registry-metadata.test.js && node --test \"src/openkit-runtime/tests/workflow-contract-consistency.test.js\"",
"verify:all": "npm run verify:install-bundle && npm run verify:mcp-secret-package-readiness && npm run verify:governance && npm run verify:semgrep-quality && node --test \"src/openkit-runtime/tests/workflow-state-cli.test.js\" && node --test \"src/openkit-runtime/tests/session-start-hook.test.js\" && node --test src/tests/runtime/*.test.js && node --test src/tests/runtime/sessions/*.test.js && node --test src/tests/runtime/state/*.test.js && node --test src/tests/runtime/tools/*.test.js && node --test src/tests/install/*.test.js && node --test src/tests/global/*.test.js && node --test src/tests/cli/*.test.js && node --test src/tests/hooks/*.test.js && node --test src/tests/assets/*.test.js && node --test src/tests/commands/*.test.js && node --test src/tests/release/*.test.js",
"verify:semgrep-quality": "node --test src/tests/semgrep/quality-rules.test.js",
"verify:audit-wave-1": "node --test src/tests/release/version-metadata-consistency.test.js src/tests/runtime/fsm-table-consistency.test.js src/tests/runtime/ast-grep-search-injection.test.js src/tests/mcp-server/workflow-state-contract.test.js",
"verify:sessions": "node --test src/tests/runtime/sessions/*.test.js && node --test src/tests/cli/sessions-cli.test.js && node --test src/tests/cli/dashboard.test.js && node --test src/tests/cli/finish.test.js && node --test src/tests/hooks/session-banner.test.js && node --test src/tests/assets/statusline-session.test.js"
```

- [ ] **Step 4: Save and verify package.json**

Run:
```bash
git add package.json
git status
```

Expected: package.json staged with changes

---

## Task 4: Update registry.json

**Files:**
- Modify: `registry.json`

- [ ] **Step 1: Update repositoryInternal paths**

Current paths in `repositoryInternal`:
```json
"repositoryInternal": [
  ".opencode/opencode.json",
  ".opencode/workflow-state.json",
  ".opencode/work-items/",
  ".opencode/workflow-state.js",
  "hooks/",
  "agents/",
  "skills/",
  "commands/",
  "context/",
  "docs/"
]
```

Replace with:
```json
"repositoryInternal": [
  "src/openkit-runtime/opencode.json",
  "src/openkit-runtime/workflow-state.json",
  "src/openkit-runtime/work-items/",
  "src/openkit-runtime/workflow-state.js",
  "src/hooks/",
  "src/agents/",
  "src/skills/",
  "src/commands/",
  "src/context/",
  "docs/"
]
```

- [ ] **Step 2: Scan for component file references**

Run:
```bash
grep -n '"file":' registry.json | head -20
```

This will show component file references that may need path updates.

- [ ] **Step 3: Update component file paths systematically**

Search and replace in registry.json:
- `"agents/` → `"src/agents/`
- `"skills/` → `"src/skills/`
- `"commands/` → `"src/commands/`
- `"hooks/` → `"src/hooks/`
- `"context/` → `"src/context/`
- `".opencode/` → `"src/openkit-runtime/`
- `"tests/` → `"src/tests/`
- `"assets/` → `"src/assets/`

Use editor's find/replace or sed:
```bash
sed -i '' 's|"agents/|"src/agents/|g' registry.json
sed -i '' 's|"skills/|"src/skills/|g' registry.json
sed -i '' 's|"commands/|"src/commands/|g' registry.json
sed -i '' 's|"hooks/|"src/hooks/|g' registry.json
sed -i '' 's|"context/|"src/context/|g' registry.json
sed -i '' 's|"\.opencode/|"src/openkit-runtime/|g' registry.json
sed -i '' 's|"tests/|"src/tests/|g' registry.json
sed -i '' 's|"assets/|"src/assets/|g' registry.json
```

- [ ] **Step 4: Verify registry.json validity**

Run:
```bash
node -e "JSON.parse(require('fs').readFileSync('registry.json', 'utf8'))"
```

Expected: No output (JSON is valid)

- [ ] **Step 5: Stage registry.json**

Run:
```bash
git add registry.json
```

Expected: registry.json staged

---

## Task 5: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update directory structure section**

Find the "Directory Structure" section and update paths:

Current:
```markdown
agents/                    # Agent role definitions
commands/                  # User-facing slash commands
skills/                    # Composable workflow procedures
context/                   # Shared intelligence
hooks/                     # Session bootstrap integration
.opencode/                 # OpenCode runtime environment
  workflow-state.js        # *** Workflow state CLI (mode-aware contract) ***
  workflow-state.json      # Active external compatibility mirror
  work-items/              # Per-item workflow backing store
  lib/                     # Workflow kernel implementation
src/runtime/               # *** Capability runtime foundation ***
```

Replace with:
```markdown
src/
  agents/                  # Agent role definitions
  commands/                # User-facing slash commands
  skills/                  # Composable workflow procedures
  context/                 # Shared intelligence
  hooks/                   # Session bootstrap integration
  openkit-runtime/         # OpenCode compatibility runtime
    workflow-state.js      # *** Workflow state CLI (mode-aware contract) ***
    workflow-state.json    # Active external compatibility mirror
    work-items/            # Per-item workflow backing store
    lib/                   # Workflow kernel implementation
  runtime/                 # *** Capability runtime foundation ***
```

- [ ] **Step 2: Update command examples**

Find and replace command examples:
- `src/openkit-runtime/workflow-state.js` → `src/openkit-runtime/workflow-state.js`
- `src/tests/` → `src/tests/`
- `scripts/` → `src/scripts/`
- `src/bin/openkit.js` → `src/bin/openkit.js`

Example commands to update:
```bash
node .opencode/workflow-state.js ops-summary
node .opencode/workflow-state.js resume-summary
```

Replace with:
```bash
node src/openkit-runtime/workflow-state.js ops-summary
node src/openkit-runtime/workflow-state.js resume-summary
```

- [ ] **Step 3: Update architecture references**

Find sections referencing:
- `src/agents/` → `src/agents/`
- `src/commands/` → `src/commands/`
- `src/skills/` → `src/skills/`
- `src/context/core/workflow.md` → `src/context/core/workflow.md`

Update all references to point to src/ paths.

- [ ] **Step 4: Stage CLAUDE.md**

Run:
```bash
git add CLAUDE.md
```

Expected: CLAUDE.md staged

---

## Task 6: Scan and Update Import Statements

**Files:**
- Modify: Various `.js` files with imports

- [ ] **Step 1: Find all .opencode/ references**

Run:
```bash
grep -r "\.opencode/" --include="*.js" --include="*.mjs" src/ | tee /tmp/opencode-refs.txt
```

Expected: List of files with `src/openkit-runtime/` imports

- [ ] **Step 2: Update .opencode/ to openkit-runtime/**

For each file found, update imports:
- `from '../.opencode/` → `from '../openkit-runtime/`
- `from '../../.opencode/` → `from '../../openkit-runtime/`
- `require('.opencode/` → `require('openkit-runtime/`
- `'.opencode/` → `'openkit-runtime/` (string paths)

Use sed for bulk update:
```bash
find src -name "*.js" -o -name "*.mjs" | xargs sed -i '' "s|'\\.opencode/|'openkit-runtime/|g"
find src -name "*.js" -o -name "*.mjs" | xargs sed -i '' 's|"\\.opencode/|"openkit-runtime/|g'
find src -name "*.js" -o -name "*.mjs" | xargs sed -i '' "s|from '\\.\\./\\.opencode/|from '../openkit-runtime/|g"
find src -name "*.js" -o -name "*.mjs" | xargs sed -i '' "s|from '\\.\\./\\.\\./\\.opencode/|from '../../openkit-runtime/|g"
```

- [ ] **Step 3: Find references to moved directories in imports**

Run:
```bash
grep -r "from '\\.\\./agents/" --include="*.js" src/ | tee /tmp/agents-refs.txt
grep -r "from '\\.\\./commands/" --include="*.js" src/ | tee /tmp/commands-refs.txt
grep -r "from '\\.\\./skills/" --include="*.js" src/ | tee /tmp/skills-refs.txt
grep -r "from '\\.\\./hooks/" --include="*.js" src/ | tee /tmp/hooks-refs.txt
grep -r "from '\\.\\./context/" --include="*.js" src/ | tee /tmp/context-refs.txt
```

Expected: Very few or no results (most imports are now within src/)

- [ ] **Step 4: Update any root-to-src imports**

If files at root level (like registry.json scripts) import from moved directories:

Find:
```bash
grep -r "from './agents/" --include="*.js" --include="*.mjs" . --max-depth=1
grep -r "from './commands/" --include="*.js" --include="*.mjs" . --max-depth=1
```

Update to:
- `from './agents/` → `from './src/agents/`
- `from './commands/` → `from './src/commands/`
- etc.

- [ ] **Step 5: Stage all modified import files**

Run:
```bash
git add -A
```

Expected: All modified files staged

---

## Task 7: Update Test Files

**Files:**
- Modify: Test files in `src/tests/` and `src/openkit-runtime/tests/`

- [ ] **Step 1: Find hardcoded paths in test assertions**

Run:
```bash
grep -r "'agents/" --include="*.test.js" src/tests/ | tee /tmp/test-paths-1.txt
grep -r '"agents/' --include="*.test.js" src/tests/ | tee /tmp/test-paths-2.txt
grep -r "'.opencode/" --include="*.test.js" src/ | tee /tmp/test-paths-3.txt
grep -r '".opencode/' --include="*.test.js" src/ | tee /tmp/test-paths-4.txt
```

Expected: List of test files with hardcoded paths

- [ ] **Step 2: Update test file path assertions**

Common patterns to replace:
- `'agents/` → `'src/agents/`
- `"agents/` → `"src/agents/`
- `'.opencode/` → `'src/openkit-runtime/`
- `".opencode/` → `"src/openkit-runtime/`
- `'commands/` → `'src/commands/`
- `'skills/` → `'src/skills/`
- `'hooks/` → `'src/hooks/`
- `'context/` → `'src/context/`
- `'assets/` → `'src/assets/`
- `'bin/` → `'src/bin/`
- `'scripts/` → `'src/scripts/`

Use bulk replace:
```bash
find src/tests -name "*.test.js" | xargs sed -i '' "s|'agents/|'src/agents/|g"
find src/tests -name "*.test.js" | xargs sed -i '' 's|"agents/|"src/agents/|g'
find src/tests -name "*.test.js" | xargs sed -i '' "s|'commands/|'src/commands/|g"
find src/tests -name "*.test.js" | xargs sed -i '' 's|"commands/|"src/commands/|g'
find src/tests -name "*.test.js" | xargs sed -i '' "s|'skills/|'src/skills/|g"
find src/tests -name "*.test.js" | xargs sed -i '' 's|"skills/|"src/skills/|g'
find src/tests -name "*.test.js" | xargs sed -i '' "s|'hooks/|'src/hooks/|g"
find src/tests -name "*.test.js" | xargs sed -i '' 's|"hooks/|"src/hooks/|g'
find src/tests -name "*.test.js" | xargs sed -i '' "s|'context/|'src/context/|g"
find src/tests -name "*.test.js" | xargs sed -i '' 's|"context/|"src/context/|g'
find src/tests -name "*.test.js" | xargs sed -i '' "s|'assets/|'src/assets/|g"
find src/tests -name "*.test.js" | xargs sed -i '' 's|"assets/|"src/assets/|g'
find src/tests -name "*.test.js" | xargs sed -i '' "s|'bin/|'src/bin/|g"
find src/tests -name "*.test.js" | xargs sed -i '' 's|"bin/|"src/bin/|g'
find src/tests -name "*.test.js" | xargs sed -i '' "s|'scripts/|'src/scripts/|g"
find src/tests -name "*.test.js" | xargs sed -i '' 's|"scripts/|"src/scripts/|g'
find src/tests -name "*.test.js" | xargs sed -i '' "s|'\\.opencode/|'src/openkit-runtime/|g"
find src/tests -name "*.test.js" | xargs sed -i '' 's|"\\.opencode/|"src/openkit-runtime/|g'
```

Also update in openkit-runtime tests:
```bash
find src/openkit-runtime/tests -name "*.test.js" | xargs sed -i '' "s|'\\.opencode/|'openkit-runtime/|g"
find src/openkit-runtime/tests -name "*.test.js" | xargs sed -i '' 's|"\\.opencode/|"openkit-runtime/|g'
```

- [ ] **Step 3: Stage test files**

Run:
```bash
git add -A
```

Expected: Modified test files staged

---

## Task 8: Update Runtime Configuration

**Files:**
- Modify: `src/openkit-runtime/workflow-state.js`
- Modify: `src/openkit-runtime/opencode.json`
- Modify: Other runtime files with path references

- [ ] **Step 1: Update workflow-state.js path constants**

Find hardcoded `src/openkit-runtime/` paths in workflow-state.js:

Run:
```bash
grep -n "\.opencode/" src/openkit-runtime/workflow-state.js
```

Update any hardcoded paths from `src/openkit-runtime/` to relative paths or use `__dirname`:
- If using `'.opencode/workflow-state.json'`, might need to adjust based on where it's called from
- Check if there are any path.join() calls that assume `src/openkit-runtime/` directory name

Common pattern might be:
```javascript
const stateFile = path.join(process.cwd(), '.opencode', 'workflow-state.json')
```

Should stay as-is if it references runtime state, but if it references the source location:
```javascript
const stateFile = path.join(__dirname, 'workflow-state.json')
```

Review and update as needed.

- [ ] **Step 2: Update opencode.json references**

Check if opencode.json has self-referential paths:

Run:
```bash
cat src/openkit-runtime/opencode.json
```

Update any paths that reference `src/openkit-runtime/` to `openkit-runtime/` or use relative paths.

- [ ] **Step 3: Search for .opencode/ in lib/ directory**

Run:
```bash
grep -r "\.opencode/" src/openkit-runtime/lib/
```

Update any hardcoded paths found.

- [ ] **Step 4: Stage runtime files**

Run:
```bash
git add src/openkit-runtime/
```

Expected: Runtime files staged

---

## Task 9: Update Documentation

**Files:**
- Modify: Various files in `docs/`

- [ ] **Step 1: Find code examples with paths**

Run:
```bash
grep -r "\.opencode/" docs/ | tee /tmp/docs-opencode.txt
grep -r "agents/" docs/ | tee /tmp/docs-agents.txt
grep -r "commands/" docs/ | tee /tmp/docs-commands.txt
grep -r "skills/" docs/ | tee /tmp/docs-skills.txt
grep -r "bin/openkit" docs/ | tee /tmp/docs-bin.txt
```

Expected: List of doc files with path references

- [ ] **Step 2: Update documentation paths**

For each file found, update:
- `src/openkit-runtime/` → `src/openkit-runtime/`
- `src/agents/` → `src/agents/` (in code examples)
- `src/commands/` → `src/commands/` (in code examples)
- `src/skills/` → `src/skills/` (in code examples)
- `src/hooks/` → `src/hooks/` (in code examples)
- `src/context/` → `src/context/` (in code examples)
- `src/bin/openkit.js` → `src/bin/openkit.js` (in examples)
- `src/tests/` → `src/tests/` (in examples)

Use sed or manual editing:
```bash
find docs -name "*.md" | xargs sed -i '' "s|\`\\.opencode/|\`src/openkit-runtime/|g"
find docs -name "*.md" | xargs sed -i '' 's|`src/agents/|`src/agents/|g'
find docs -name "*.md" | xargs sed -i '' 's|`src/commands/|`src/commands/|g'
find docs -name "*.md" | xargs sed -i '' 's|`src/skills/|`src/skills/|g'
find docs -name "*.md" | xargs sed -i '' 's|`src/hooks/|`src/hooks/|g'
find docs -name "*.md" | xargs sed -i '' 's|`src/context/|`src/context/|g'
find docs -name "*.md" | xargs sed -i '' 's|`src/bin/openkit|`src/bin/openkit|g'
find docs -name "*.md" | xargs sed -i '' 's|`src/tests/|`src/tests/|g'
```

- [ ] **Step 3: Update AGENTS.md if needed**

Run:
```bash
grep -n "agents/\|commands/\|skills/\|\.opencode/" AGENTS.md
```

Update any path references found.

- [ ] **Step 4: Stage documentation files**

Run:
```bash
git add docs/ AGENTS.md
```

Expected: Documentation files staged

---

## Task 10: Post-Migration Validation

**Files:**
- None (validation only)

- [ ] **Step 1: Run full verification suite**

Run:
```bash
npm run verify:all
```

Expected: All tests pass

If failures occur:
1. Check the error message for path-related issues
2. Fix the path reference
3. Re-run verification

- [ ] **Step 2: Test CLI executables**

Run:
```bash
node src/bin/openkit.js --help
node src/bin/openkit-mcp.js --help
```

Expected: Help text displays correctly

- [ ] **Step 3: Test workflow state operations**

Run:
```bash
node src/openkit-runtime/workflow-state.js status --short
```

Expected: Status output (or error if no active workflow, which is OK)

- [ ] **Step 4: Verify git history preservation**

Run:
```bash
git log --follow src/agents/master-orchestrator.md | head -20
```

Expected: Shows commit history including commits from when it was `src/agents/master-orchestrator.md`

- [ ] **Step 5: Review all staged changes**

Run:
```bash
git status
git diff --staged --stat
```

Expected: Shows all moved files and modified files, reasonable change count

---

## Task 11: Commit Migration

**Files:**
- None (commit only)

- [ ] **Step 1: Final review of staged changes**

Run:
```bash
git status
```

Verify all expected files are staged:
- Renamed directories (agents → src/agents, etc.)
- Modified package.json
- Modified registry.json
- Modified CLAUDE.md
- Modified imports and test files
- Modified documentation

- [ ] **Step 2: Commit with comprehensive message**

Run:
```bash
git commit -m "$(cat <<'EOF'
refactor: consolidate all source under /src

- Move agents/, commands/, skills/, context/, hooks/, instructions/ to src/
- Move bin/, scripts/, tests/, assets/ to src/
- Rename .opencode/ to src/openkit-runtime/ to avoid naming conflicts
- Update all path references in package.json, registry.json, imports
- Update documentation and test paths
- Preserve git history with git mv

This consolidation:
1. Eliminates .opencode/ naming collision with OpenCode runtime
2. Provides clear separation of source code from project config
3. Improves project navigability and organization

Verified with full test suite (verify:all)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

Expected: Commit created successfully

- [ ] **Step 3: Verify commit**

Run:
```bash
git log -1 --stat
git show --stat
```

Expected: Shows the commit with all changes

- [ ] **Step 4: Final validation after commit**

Run:
```bash
npm run verify:all
```

Expected: All tests still pass after commit

---

## Success Criteria Checklist

After completing all tasks, verify:

- [ ] All tests pass (`npm run verify:all`)
- [ ] No broken import references
- [ ] CLI executables work (`node src/bin/openkit.js --help`)
- [ ] Workflow state operations functional
- [ ] Git history preserved (verifiable with `git log --follow`)
- [ ] Documentation updated and accurate
- [ ] package.json files array correct
- [ ] registry.json paths updated
- [ ] All moved directories in src/
- [ ] .opencode/ renamed to src/openkit-runtime/

## Rollback Instructions

If issues discovered after migration:

```bash
# Rollback the commit
git revert HEAD

# Or hard reset (if not pushed)
git reset --hard HEAD~1

# Validate rollback
npm run verify:all
git status
```

## Notes

- This is a structure-only refactoring; no functional code changes
- All paths are internal to OpenKit; minimal external impact
- The .opencode/ → openkit-runtime/ rename is permanent
- docs/ intentionally stays at root for discoverability
- Git history is fully preserved with git mv
