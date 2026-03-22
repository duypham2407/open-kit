# Workflow State Controller Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a lightweight CLI controller that safely reads, validates, and updates `.opencode/workflow-state.json` according to OpenKit workflow rules.

**Architecture:** Keep the implementation file-backed and explicit. Use a small CLI entry point in `.opencode/`, centralize canonical stage/gate/owner constants in a rules module, and isolate read/validate/write behavior in a controller module so command wrappers and future hooks can reuse the same logic.

**Tech Stack:** Node.js, CommonJS JavaScript, JSON, the existing `.opencode/` runtime area

---

### Task 1: Add canonical workflow-state rules module

**Files:**
- Create: `.opencode/lib/workflow-state-rules.js`
- Reference: `context/core/workflow-state-schema.md`
- Reference: `context/core/approval-gates.md`
- Reference: `context/core/issue-routing.md`
- Reference: `context/core/workflow.md`

- [ ] **Step 1: Write the rules file scaffold**

Create constants for:
- ordered stage sequence
- stage-to-owner mapping
- transition-to-gate mapping
- allowed status values
- allowed artifact kinds including `adr`
- allowed issue types and severities
- allowed recommended owners by issue type

- [ ] **Step 2: Encode QA rework routing rules**

Add constants or helpers for:
- `bug -> implementation -> FullstackAgent`
- `design_flaw -> architecture -> ArchitectAgent`
- `requirement_gap -> spec -> BAAgent`

- [ ] **Step 3: Review the rules file against the docs**

Validation path:
- Compare each exported rule with `context/core/workflow-state-schema.md`, `context/core/approval-gates.md`, `context/core/issue-routing.md`, and `context/core/workflow.md`.

Expected result:
- No undocumented enum or mapping appears in code.

### Task 2: Implement state file read/write helpers

**Files:**
- Create: `.opencode/lib/workflow-state-controller.js`
- Reference: `.opencode/workflow-state.json`

- [ ] **Step 1: Implement safe state loading**

Add helpers to:
- resolve the workflow-state file path
- read JSON from disk
- throw a clear error when JSON is malformed or missing
- accept an alternate state path for verification via `--state <path>` and optionally via environment variable

Use `--state <path>` as the required documented mechanism. Support for `OPENKIT_WORKFLOW_STATE` is optional in v1, and `--state` must win if both are present.

- [ ] **Step 2: Implement formatted state writing**

Add a helper that writes back pretty-printed JSON with trailing newline.

- [ ] **Step 3: Implement timestamp update helper**

Add a helper that refreshes `updated_at` whenever a mutating command succeeds.

- [ ] **Step 4: Verify JSON round-trip behavior**

Run:
```bash
node -e "const fs=require('fs'); const p='.opencode/workflow-state.json'; JSON.parse(fs.readFileSync(p,'utf8')); console.log('ok')"
```

Expected:
- Prints `ok`

- [ ] **Step 5: Verify malformed-state failure path**

Test against a temporary invalid state file and confirm the controller surfaces a clear error instead of corrupting the real repository state.

Expected:
- Malformed JSON produces a specific failure message and non-zero exit.

### Task 3: Implement validation logic

**Files:**
- Modify: `.opencode/lib/workflow-state-controller.js`
- Reference: `context/core/workflow-state-schema.md`
- Reference: `context/core/issue-routing.md`

- [ ] **Step 1: Implement top-level schema checks**

Validate presence and basic shape of:
- `feature_id`
- `feature_slug`
- `current_stage`
- `status`
- `current_owner`
- `artifacts`
- `approvals`
- `issues`
- `retry_count`
- `updated_at`

- [ ] **Step 2: Implement stage and owner validation**

Validate that:
- `current_stage` is known
- `status` is known
- `current_owner` matches the expected owner for the stage when strict validation is requested

- [ ] **Step 3: Implement approval gate validation**

Validate each gate entry has:
- `status`
- `approved_by`
- `approved_at`
- `notes`

- [ ] **Step 4: Implement issue schema validation**

Validate each issue includes:
- `issue_id`
- `title`
- `type`
- `severity`
- `rooted_in`
- `recommended_owner`
- `evidence`
- `artifact_refs`

- [ ] **Step 5: Verify validation behavior on current state**

Run:
```bash
node .opencode/workflow-state.js validate
```

Expected:
- Exit success with a readable validation message.

- [ ] **Step 6: Verify validation failures are explicit**

Test with intentionally invalid in-memory or temporary scenarios so the controller proves it catches:
- unknown stage values
- missing required top-level fields
- malformed approval-gate objects
- malformed issue objects

Expected:
- Each failure exits non-zero with a specific error message.

### Task 4: Implement feature lifecycle commands

**Files:**
- Modify: `.opencode/lib/workflow-state-controller.js`

- [ ] **Step 1: Implement `start-feature`**

Behavior:
- set stage to `intake`
- set status to `in_progress`
- set owner to `MasterOrchestrator`
- reset artifacts, issues, approvals, retry count, updated_at
- recreate every documented approval gate with the canonical pending/null shape

- [ ] **Step 2: Implement `advance-stage`**

Behavior:
- allow only the immediate next stage in canonical forward order
- enforce approval gate when required
- update owner and status accordingly

- [ ] **Step 3: Implement `set-approval`**

Behavior:
- update one gate only
- preserve all other gates
- refresh `updated_at`

- [ ] **Step 4: Implement `link-artifact`**

Behavior:
- require file existence before linking
- support `brief`, `spec`, `architecture`, `plan`, `qa_report`, and `adr`
- append `adr` entries instead of overwriting the array

- [ ] **Step 5: Verify happy-path lifecycle commands**

Run these commands against a temporary copy or backup-restored workflow-state file and confirm the state changes are narrow and valid:
```bash
node .opencode/workflow-state.js start-feature FEATURE-002 login-flow
node .opencode/workflow-state.js link-artifact brief docs/briefs/2026-03-20-task-intake-dashboard.md
node .opencode/workflow-state.js set-approval pm_to_ba approved user 2026-03-20 "Brief approved"
node .opencode/workflow-state.js advance-stage brief
node .opencode/workflow-state.js validate
node .opencode/workflow-state.js show
```

Expected:
- Lifecycle commands mutate only the intended state fields and leave JSON valid.

- [ ] **Step 6: Verify lifecycle negative paths**

Test that the controller rejects:
- skipping stages
- advancing without the required approval gate
- linking a missing artifact file

Expected:
- Each invalid command exits non-zero with a precise error message.

### Task 5: Implement issue and rework commands

**Files:**
- Modify: `.opencode/lib/workflow-state-controller.js`

- [ ] **Step 1: Implement `record-issue`**

Behavior:
- append a validated issue object
- set state `status` to `blocked` when appropriate
- refresh `updated_at`

- [ ] **Step 2: Implement `clear-issues`**

Behavior:
- empty the issue array
- set status back to `in_progress` unless the workflow is already `done`

- [ ] **Step 3: Implement `route-rework`**

Behavior:
- route from QA failure to the correct working stage
- set owner to mapped owner
- accept an explicit repeat-failed-fix signal so retry tracking stays deterministic
- increment `retry_count` only when that signal is true
- report the escalation threshold explicitly when the caller-provided retry context reaches the documented limit; do not infer issue-family history from cleared issues

Treat the documented limit as `3`, and return a warning/escalation message rather than hard-blocking routing in v1.
- refresh `updated_at`

- [ ] **Step 4: Verify rework behavior**

Run targeted manual scenarios and confirm:
- `bug` routes to `implementation`
- `design_flaw` routes to `architecture`
- `requirement_gap` routes to `spec`

Expected:
- Stage, owner, status, and retry count reflect the documented routing rules.

- [ ] **Step 5: Verify retry-count rules**

Test that:
- first-time routing with `repeat_failed_fix=false` does not increment retry count
- repeated failed-fix routing with `repeat_failed_fix=true` increments retry count

Expected:
- Retry behavior matches the explicit CLI contract.

- [ ] **Step 6: Verify escalation threshold signaling**

Test that when caller-provided retry context reaches the documented threshold of `3`, the controller returns a clear escalation signal or message rather than silently continuing.

Expected:
- The CLI makes the escalation condition explicit for the caller.

### Task 6: Add CLI entry point

**Files:**
- Create: `.opencode/workflow-state.js`

- [ ] **Step 1: Implement command parsing**

Support commands:
- `show`
- `validate`
- `start-feature`
- `advance-stage`
- `set-approval`
- `link-artifact`
- `record-issue`
- `clear-issues`
- `route-rework`

Also support the global `--state <path>` flag and pass it through to every command.

- [ ] **Step 2: Implement readable success/error output**

Output should:
- print plain-text success summaries
- print specific error messages
- exit non-zero on invalid operations

- [ ] **Step 3: Verify entry point behavior**

Run:
```bash
node .opencode/workflow-state.js show
node .opencode/workflow-state.js validate
```

Expected:
- Both commands succeed against the current repository state.

- [ ] **Step 4: Verify alternate state path support**

Run the CLI against a temporary state file using `--state <path>` and confirm commands read and write the alternate file instead of the repository default.

Expected:
- Verification scenarios can run without mutating the canonical `.opencode/workflow-state.json`.

### Task 7: Document controller usage

**Files:**
- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `context/core/project-config.md`
- Modify: `commands/brainstorm.md`
- Modify: `commands/write-plan.md`
- Modify: `commands/execute-plan.md`
- Modify: `agents/master-orchestrator.md`

- [ ] **Step 1: Document the CLI as an existing repo command surface**

Add references showing when to use:
- `show`
- `validate`
- `advance-stage`
- `set-approval`
- `route-rework`

Also document Node.js as the runtime dependency for this workflow-state utility, distinct from any future application stack.

- [ ] **Step 2: Clarify that this is workflow-state tooling, not application build/test tooling**

Make sure docs do not blur the distinction, especially in `AGENTS.md` and `context/core/project-config.md`.

- [ ] **Step 3: Verify docs reference real files and commands only**

Validation path:
- read updated docs and confirm every referenced controller command exists in `.opencode/workflow-state.js`

### Task 8: Final verification

**Files:**
- Review: `.opencode/workflow-state.js`
- Review: `.opencode/lib/workflow-state-controller.js`
- Review: `.opencode/lib/workflow-state-rules.js`
- Review: updated docs

- [ ] **Step 1: Run full controller verification set**

Run:
```bash
node .opencode/workflow-state.js validate && node .opencode/workflow-state.js show
```

Expected:
- State validates successfully.
- Current state is printed in readable form.

- [ ] **Step 2: Re-parse JSON files**

Run:
```bash
node -e "JSON.parse(require('fs').readFileSync('.opencode/workflow-state.json','utf8')); JSON.parse(require('fs').readFileSync('.opencode/opencode.json','utf8')); console.log('json-ok')"
```

Expected:
- Prints `json-ok` and both JSON files remain valid.

- [ ] **Step 3: Review diffs for scope control**

Run:
```bash
git diff -- .opencode README.md AGENTS.md commands context docs
```

Expected:
- Changes stay focused on the controller and its documentation surface.
