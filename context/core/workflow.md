# Team Workflow — Open Kit

Defines the 7-agent pipeline, feedback loops, approval gates, and error escalation paths.

Use this file together with `context/core/approval-gates.md`, `context/core/issue-routing.md`, `context/core/session-resume.md`, and `context/core/workflow-state-schema.md`.

## The Pipeline

```
User Request
    ↓
Master Orchestrator   ← Central brain, routes everything
    ↓
PM Agent              ← Define product goals & priorities
    ↓
BA Agent              ← Convert goals → detailed requirements + acceptance criteria
    ↓
Architect Agent       ← Design system structure, choose technologies, design APIs
    ↓
Tech Lead Agent       ← Review architecture, create implementation plan, set standards
    ↓
Fullstack Agent       ← Implement (TDD: plan → test → code → refactor)
    ↓
QA Agent              ← Validate, test, classify issues
    ↓
Master Orchestrator   ← Route QA result
```

## The Feedback Loop

```
Fullstack → QA → (pass) → Done ✅
                → (fail) → Master Orchestrator classifies:
                           - Bug           → Fullstack Agent
                           - Design flaw   → Architect / Tech Lead
                           - Requirement gap → BA Agent
```

## Approval Gates

Each stage transition requires approval before proceeding:

| Transition | What needs approval |
|-----------|---------------------|
| PM → BA | Product brief / feature goals |
| BA → Architect | Requirements & acceptance criteria |
| Architect → Tech Lead | System design & technology choices |
| Tech Lead → Fullstack | Implementation plan |
| Fullstack → QA | Completed implementation |
| QA → Done | All tests passed, no open issues |

Approval state should be recorded in `.opencode/workflow-state.json` before advancing stages.

## Key Principles

1. **Always use feedback loops** — Never mark work complete without QA validation
2. **Never skip planning** — Each agent must complete its deliverable before passing the baton
3. **Enforce TDD** — Fullstack agent follows RED-GREEN-REFACTOR strictly
4. **Separate responsibilities clearly** — Preserve role boundaries even if one worker must temporarily perform multiple roles in a minimal repository
5. **Use Master Orchestrator for routing** — All inter-agent delegation goes through Master
6. **Report before fixing** — On error: REPORT → PROPOSE fix → REQUEST APPROVAL → Fix

## Document Outputs by Agent

| Agent | Produces |
|-------|---------|
| PM | `docs/briefs/YYYY-MM-DD-<feature>.md` |
| BA | `docs/specs/YYYY-MM-DD-<feature>.md` |
| Architect | `docs/architecture/YYYY-MM-DD-<feature>.md` |
| Tech Lead | `docs/plans/YYYY-MM-DD-<feature>.md` |
| Fullstack | Source code, tests |
| QA | `docs/qa/YYYY-MM-DD-<feature>.md` |

## Workflow State

The canonical persisted runtime state lives in `.opencode/workflow-state.json`.

Field definitions and allowed enums live in `context/core/workflow-state-schema.md`.

At minimum it should track:

- current stage
- current owner
- linked artifacts
- gate approvals
- open issues
- retry count
