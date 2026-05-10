# Project Structure Reorganization Design

**Date:** 2026-05-10  
**Status:** Approved  
**Author:** Brainstorming collaboration

## Background

OpenKit currently has source code distributed across multiple root-level directories (`src/agents/`, `src/commands/`, `src/skills/`, `src/context/`, `src/hooks/`, `bin/`, `scripts/`, `src/tests/`, `src/openkit-runtime/`, etc.). This creates two problems:

1. **Naming collision risk:** The `src/openkit-runtime/` directory conflicts with OpenCode's runtime when OpenCode runs inside the OpenKit project, potentially creating confusion or overwriting issues.

2. **Project organization:** Having source scattered at the root level makes the project harder to navigate and understand. Consolidating under `/src` provides clear separation between source code and project-level configuration/documentation.

## Goals

- Consolidate all OpenKit source code under `/src`
- Rename `src/openkit-runtime/` to avoid naming conflicts with OpenCode runtime
- Maintain git history through proper `git mv` operations
- Preserve all functionality and test coverage
- Single atomic migration with comprehensive validation

## Target Structure

### Directories Moving to /src

| Current Path | New Path | Notes |
|--------------|----------|-------|
| `src/agents/` | `/src/agents/` | Agent role definitions |
| `src/commands/` | `/src/commands/` | User-facing slash commands |
| `src/skills/` | `/src/skills/` | Composable workflow procedures |
| `src/context/` | `/src/context/` | Shared intelligence |
| `src/hooks/` | `/src/hooks/` | Session bootstrap integration |
| `instructions/` | `/src/instructions/` | Additional guidance |
| `src/openkit-runtime/` | `/src/openkit-runtime/` | **Renamed** - OpenCode compatibility runtime |
| `bin/` | `/src/bin/` | CLI executables |
| `scripts/` | `/src/scripts/` | Build/verification scripts |
| `src/tests/` | `/src/tests/` | Test suites |
| `assets/` | `/src/assets/` | Assets (permission policies, etc.) |

### Directories Staying at Root

- `docs/` - user-facing documentation remains easily discoverable
- Root markdown files (README.md, CLAUDE.md, AGENTS.md, CHANGELOG.md, RELEASES.md)
- Project configuration (package.json, registry.json, .gitignore)
- Git/GitHub (.git/, .github/)
- node_modules/
- release-notes/ (release artifacts)
- Temporary runtime folders (bugs/, .worktrees/, .claude/)

### Final Structure

```
/
├── src/                        # All source code
│   ├── agents/                 # Agent definitions
│   ├── assets/                 # Assets and policies
│   ├── audit/                  # (existing)
│   ├── bin/                    # CLI executables
│   ├── capabilities/           # (existing)
│   ├── cli/                    # (existing)
│   ├── commands/               # Slash commands
│   ├── context/                # Shared intelligence
│   ├── global/                 # (existing)
│   ├── hooks/                  # Session hooks
│   ├── install/                # (existing)
│   ├── instructions/           # Additional guidance
│   ├── integrations/           # (existing)
│   ├── mcp-server/             # (existing)
│   ├── opencode/               # (existing)
│   ├── openkit-runtime/        # Renamed from .opencode
│   ├── permissions/            # (existing)
│   ├── release/                # (existing)
│   ├── runtime/                # Runtime foundation
│   ├── scripts/                # Build/verification scripts
│   ├── skills/                 # Workflow procedures
│   └── tests/                  # Test suites
├── docs/                       # Documentation
├── README.md, CLAUDE.md, etc.  # Root documentation
├── package.json, registry.json # Project configuration
└── node_modules/               # Dependencies
```

## Migration Architecture

### Approach: Single Atomic Migration

Execute all moves and reference updates in one coordinated operation, committed atomically. This preserves git history, provides clean rollback capability, and avoids intermediate inconsistent states.

**Why this approach:**
- Test suite (`verify:all`) will catch broken references comprehensively
- Cleaner git history than phased migration
- Faster execution
- Clear "before" and "after" states

### Reference Update Categories

Files and configurations requiring path updates:

#### 1. package.json
- `files` array: update all moved directory paths
- `bin` entries: `src/bin/openkit.js` → `src/bin/openkit.js`
- `scripts`: update test paths and verification script paths

#### 2. registry.json
- `repositoryInternal` array: update component paths
- Component file references throughout the registry

#### 3. Import/Require Statements
- JavaScript imports referencing `src/openkit-runtime/` → `../openkit-runtime/`
- Relative imports between moved files (mostly unchanged)
- Imports from root-level files to moved directories

#### 4. Documentation
- `CLAUDE.md`: directory structure documentation, command examples
- `AGENTS.md`: any path references
- Code examples in `docs/` with hardcoded paths

#### 5. Test Files
- Import statements in test files
- File path assertions and fixtures
- Test descriptions with embedded paths

#### 6. Configuration Files
- `src/openkit-runtime/opencode.json` → `src/openkit-runtime/opencode.json` references
- Runtime config internal paths
- Workflow state path constants

#### 7. Special: .opencode → openkit-runtime Rename
- Update `opencode.json` if it has self-referential paths
- Update `workflow-state.js` path constants
- Update any runtime code assuming `src/openkit-runtime/` location
- Document rename rationale in migration notes

### Validation Strategy

**Pre-migration baseline:**
- Run `npm run verify:all` to ensure clean starting state
- Confirm git working tree is clean
- Optional: create backup branch for safety

**Post-migration validation:**
- Run `npm run verify:all` to catch any broken references
- Verify all imports resolve correctly
- Test bin executables (`openkit`, `openkit-mcp`)
- Test workflow state operations
- Spot-check key functionality (install, runtime bootstrap, CLI commands)

## Execution Plan

### Step 1: Pre-Migration Validation
```bash
npm run verify:all          # Ensure clean baseline
git status                  # Confirm clean working tree
git checkout -b backup/pre-restructure  # Optional safety branch
git checkout main           # Return to main for actual work
```

### Step 2: Execute File Moves (preserve git history)
```bash
git mv agents src/agents
git mv commands src/commands
git mv skills src/skills
git mv context src/context
git mv hooks src/hooks
git mv instructions src/instructions
git mv .opencode src/openkit-runtime
git mv bin src/bin
git mv scripts src/scripts
git mv tests src/tests
git mv assets src/assets
```

### Step 3: Update References

**Systematic update process:**

1. **package.json**
   - Update `files` array paths
   - Update `bin` paths
   - Update `scripts` test paths

2. **registry.json**
   - Update `repositoryInternal` paths
   - Scan for component file references

3. **CLAUDE.md**
   - Update directory structure documentation
   - Update command examples
   - Update architecture references

4. **AGENTS.md** (if applicable)
   - Check for path references and update

5. **Import statements**
   - Scan all `.js` files: `grep -r "\.opencode/" src/`
   - Scan for other moved directory imports
   - Update systematically

6. **Test files**
   - Update import paths
   - Update path assertions
   - Update fixture references

7. **Runtime configuration**
   - Update `src/openkit-runtime/opencode.json`
   - Update `src/openkit-runtime/workflow-state.js`
   - Update any hardcoded `src/openkit-runtime/` references

8. **Documentation**
   - Scan `docs/` for code examples with paths
   - Update as needed

### Step 4: Post-Migration Validation
```bash
npm run verify:all          # Comprehensive validation
npm test                    # Run all tests
node src/bin/openkit.js --help  # Test CLI executable
```

### Step 5: Commit
```bash
git add -A
git commit -m "refactor: consolidate all source under /src

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

Verified with full test suite (verify:all)"
```

## Risk Mitigation

### Identified Risks

1. **Broken import references**
   - Mitigation: Comprehensive grep scanning + test suite validation
   - Rollback: Git revert if issues found

2. **npm package files misconfiguration**
   - Mitigation: Verify `package.json` files array carefully
   - Validation: Test local npm pack/install before publishing

3. **Runtime path assumptions**
   - Mitigation: Search for hardcoded `src/openkit-runtime/` strings
   - Testing: Run workflow state operations post-migration

4. **External tools depending on paths**
   - Mitigation: Document breaking changes in CHANGELOG
   - Note: Most paths are internal; minimal external impact expected

### Rollback Strategy

If critical issues discovered post-migration:
```bash
git revert <commit-hash>    # Clean rollback
npm run verify:all          # Validate rollback
```

## Success Criteria

- All tests pass (`npm run verify:all`)
- No broken import references
- CLI executables work (`openkit`, `openkit-mcp`)
- Workflow state operations functional
- Git history preserved (verifiable with `git log --follow`)
- Documentation updated and accurate

## Future Considerations

- Update global install documentation if paths referenced
- Consider similar consolidation for other scattered files
- Monitor for any external tooling that referenced old paths
- Update CI/CD if it has hardcoded path assumptions

## Notes

- The `src/openkit-runtime/` → `openkit-runtime/` rename is permanent; no compatibility shim needed since this is internal structure
- `docs/` intentionally stays at root for discoverability
- Root-level markdown files stay for ecosystem conventions (README at root)
- This is a structure-only change; no functional changes to code
