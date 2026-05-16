# OpenKit Discovery Layer Fix — PR #3 (P2 Follow-up) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Final cosmetic cleanup of pre-reorg path references that don't block runtime or features. Lower priority than PR #1/#2; can ship in a later release cycle.

**Architecture:** No changes; same 3-layer model already merged.

**Tech Stack:** Same as PR #1.

**Spec reference:** `docs/superpowers/specs/2026-05-16-openkit-discovery-layer-fix-design.md` — Theme C P2 rows.

**Prerequisite:** PR #1 and PR #2 merged.

---

## File Structure (PR #3)

```text
MODIFY:
  src/audit/vietnamese-detection.js                     (HIGH_PRIORITY_PREFIXES)
  src/hooks/hooks.json                                  (session-start path in template)
```

---

## Task 1: Update Vietnamese-detection prefixes

**Files:**
- Modify: `src/audit/vietnamese-detection.js` (lines ~13-14)

**Context:** The audit scanner walks the repo looking for Vietnamese text in source files. `HIGH_PRIORITY_PREFIXES` listed `'skills/'`, `'agents/'`, `'commands/'` (pre-reorg). After v0.9.0 those paths are at `src/skills/`, `src/agents/`, `src/commands/`. Scanner misses the actual files.

- [ ] **Step 1: Read current constant**

```bash
sed -n '10,20p' src/audit/vietnamese-detection.js
```

- [ ] **Step 2: Update prefixes**

In `src/audit/vietnamese-detection.js`, change `HIGH_PRIORITY_PREFIXES`:

```js
// Before:
const HIGH_PRIORITY_PREFIXES = ['skills/', 'agents/', 'commands/'];

// After:
const HIGH_PRIORITY_PREFIXES = ['src/skills/', 'src/agents/', 'src/commands/'];
```

- [ ] **Step 3: Run vietnamese-detection scan**

```bash
node src/bin/openkit.js internal-audit-vietnamese 2>&1 | head -30
```

Expected: scanner now walks the actual source dirs; no errors. (Output may flag legitimately-Vietnamese content in `src/skills/dev-browser` or similar — verify it's intentional content, not a regression of the scan path.)

- [ ] **Step 4: Commit**

```bash
git add src/audit/vietnamese-detection.js
git commit -m "$(cat <<'COMMIT'
fix(audit/vietnamese): scan src/ prefixed paths post-reorg

HIGH_PRIORITY_PREFIXES listed skills/, agents/, commands/ (pre-reorg
roots). After v0.9.0 the actual sources moved under src/. Scanner
now walks src/skills, src/agents, src/commands.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
COMMIT
)"
```

---

## Task 2: Update `hooks/hooks.json` session-start template path

**Files:**
- Modify: `src/hooks/hooks.json` (line ~7)

**Context:** The hook config template uses `${OPENCODE_PLUGIN_ROOT:-$(pwd)}/hooks/session-start` (no `src/`, no `.js` extension). After PR #1, the materialized layout has `<kitRoot>/src/hooks/session-start.js`. The template should reflect this.

- [ ] **Step 1: Read current**

```bash
cat src/hooks/hooks.json
```

- [ ] **Step 2: Update path**

In `src/hooks/hooks.json`, change the session-start command:

```json
// Before (likely):
"${OPENCODE_PLUGIN_ROOT:-$(pwd)}/hooks/session-start"

// After:
"${OPENCODE_PLUGIN_ROOT:-$(pwd)}/src/hooks/session-start.js"
```

- [ ] **Step 3: Verify hook materialization still works**

```bash
rm -rf "$HOME/.config/opencode/kits/openkit"
node src/bin/openkit.js install --verify
cat "$HOME/.config/opencode/profiles/openkit/hooks.json" 2>/dev/null | head -10
```

Expected: materialized profile hooks reference `<kitRoot>/src/hooks/session-start.js` (this happens via `materialize.js:237` which writes the absolute path).

The template change is for any caller that copies the raw `src/hooks/hooks.json` without going through materialize. Verify by searching:

```bash
grep -rn "hooks/session-start" src/ --include="*.js"
```

Any consumer reading the raw template should now get the corrected path.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/hooks.json
git commit -m "$(cat <<'COMMIT'
fix(hooks/hooks.json): align template path with post-reorg layout

Template referenced `${OPENCODE_PLUGIN_ROOT}/hooks/session-start`
(missing src/ prefix and .js extension). Materialize.js writes the
absolute path explicitly so live launches are unaffected, but any
raw-template consumer (test fixtures, third-party tooling) saw the
stale path. Aligns with src/hooks/session-start.js.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
COMMIT
)"
```

---

## Task 3: Run `verify:all` + open PR

- [ ] **Step 1: Final verify**

```bash
npm run verify:all
```

Expected: PASS.

- [ ] **Step 2: Push + open PR**

```bash
git push -u origin HEAD:fix/discovery-layer-pr3-p2-followup
gh pr create --title "chore: P2 follow-up for discovery-layer fix" --body "$(cat <<'BODY'
## Summary

Cosmetic post-reorg cleanups deferred from PR #1/#2:
- `src/audit/vietnamese-detection.js` prefixes now match `src/`-rooted layout
- `src/hooks/hooks.json` template uses `src/hooks/session-start.js`

No runtime behavior change.

## Test plan

- [ ] `npm run verify:all` passes
- [ ] `openkit internal-audit-vietnamese` walks new prefixes without error

## Spec

`docs/superpowers/specs/2026-05-16-openkit-discovery-layer-fix-design.md` — P2 scope.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
BODY
)"
```

---

## Self-Review Checklist

Spec coverage:

| Spec section | Task |
|---|---|
| §4 Theme C row 6 (vietnamese-detection prefixes) | Task 1 |
| §4 Theme C row 7 (hooks.json template path) | Task 2 |

All P2 spec items covered. Plan is intentionally minimal — only 2 small file edits.
