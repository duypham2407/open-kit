---
name: writing-plans
description: "Converts approved architecture and scope into bite-sized implementation plans with validation matched to the workflow mode."
---

# Skill: Writing Implementation Plans

## Context

This skill is used by the Tech Lead Agent. It turns design documents (spec and architecture) into concrete coding steps that the Fullstack Agent can execute.

Each plan should be detailed enough that the Fullstack Agent can execute it without guesswork.

## Core Rules of a Good Plan

1. **Bite-sized tasks**: each task should take roughly 2-5 minutes. If a task looks like more than 10 minutes, split it smaller.
2. **Atomic steps**: each step should be a complete, testable unit. Do not leave half-finished code behind.
3. **Exact file paths**: specify the exact absolute path or repository-relative path for every file to create or edit.
4. **Validation flow**: plan validation must match the active workflow mode. Full-delivery logic work should be TDD-first when the repository has suitable test tooling. Migration work should prioritize preserved invariants, blocker-decoupling steps, compatibility checks, staged verification, and targeted tests only where they are truly reliable and helpful. If the repo does not define a standard command yet, the plan must state the missing validation path instead of inventing one.

## Execution Process

### Step 1: Context Gathering
Make sure you have read:
- `docs/specs/YYYY-MM-DD-<feature>.md`
- `docs/architecture/YYYY-MM-DD-<feature>.md`
- `context/core/code-quality.md`

### Step 2: Write the Plan Document

Create `docs/plans/YYYY-MM-DD-<feature>.md` using this structure:

```markdown
# Implementation Plan: [Feature Name]

## Dependencies
- Are any additional packages required? (`npm install X`, `pip install Y`)
- Are any environment variables required?

## Implementation Steps

For each task, follow a validation-aware structure:

### [ ] Task 1: [Specific action name, e.g. Init Database Schema]
- **File**: `path/to/file.ext`
- **Goal**: [Brief description]
- **Validation Command**: `[test/build/typecheck/smoke/manual verification command for this step, or an explicit note that no repo-native validation command exists yet]`
- **Details**:
  - State the baseline or expected change for this step
  - State the implementation or upgrade action
  - State how the result will be verified honestly

### [ ] Task 2: [Next task]
...
```

### Step 3: Review and Refine
- Are the tasks small enough?
- Does any task require changing more than 3 files at once? -> If yes, split it.
- In full mode, does any logic task skip the "write test first" step without justification? -> Add the test requirement.
- In migration mode, does the plan mix rewrite work into the migration instead of isolating blockers and proving parity? -> Rewrite the sequence.
- In migration mode, does the plan rely on fake TDD instead of baseline, compatibility, and regression evidence? -> Rewrite the validation guidance.
- Does the plan cover all acceptance criteria from the spec?

## Anti-Patterns
- "Task 1: Build the frontend, Task 2: Build the backend." (Far too large.)
- No test guidance or test command, and no explicit note that the repo lacks a standard command.
- A plan that does not specify which files need to be edited.
