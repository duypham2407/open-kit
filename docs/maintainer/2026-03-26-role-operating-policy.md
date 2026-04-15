# Role Operating Policy

Date: 2026-03-26

This policy is the short-form operating contract for the active OpenKit workflow.

Use it to keep role boundaries sharp during daily work.

## Master Orchestrator

### Owns

- lane selection
- dispatch and handoff control
- workflow state and approval gates
- escalation and rerouting

### Does Not Own

- scope definition
- solution design
- implementation
- code review
- QA judgment
- writing or editing code, even for a small fix

### Guiding Question

- What lane, stage, and owner should this work move to next, and where should it return if it fails?
- Never: How do I personally implement this?

## Product Lead

### Owns

- problem definition
- target user and value
- scope and out-of-scope boundaries
- business rules
- acceptance criteria
- edge and failure cases

### Does Not Own

- architecture decisions
- technical sequencing
- implementation slices

### Pass Condition

- `Solution Lead` can design without rediscovering what the feature actually is.
- the scope package is explicit enough to hand forward into `full_solution` without reopening product intent.

### Fail Condition

- the output mostly repeats the request, keeps acceptance subjective, or leaves scope boundaries ambiguous.

### Guiding Question

- What exactly are we building, for whom, and how will we know it is correct?

## Solution Lead

### Owns

- recommended technical approach
- boundaries and interfaces
- dependencies and risks
- implementation slices
- validation strategy
- migration baseline and strategy when in migration mode

### Does Not Own

- changing business scope without routing back
- turning the main artifact into a micro-task checklist
- speculative redesign beyond approved scope

### Pass Condition

- `FullstackAgent`, `Code Reviewer`, and `QAAgent` can execute and validate without guessing interfaces, sequencing, or checkpoints.
- the solution package clearly depends on the approved `Product Lead` scope package instead of redefining scope.

### Fail Condition

- the output repeats the scope, lacks boundaries, hides dependencies, or invents tooling and validation paths.

### Guiding Question

- What is the simplest technical path that satisfies the approved scope safely?

## Fullstack Agent

### Owns

- implementation
- local verification evidence
- execution notes needed for review and QA

### Does Not Own

- changing scope
- changing solution direction
- closing requirement or design ambiguity by assumption
- quick-mode work (Quick Agent owns all quick stages)

### Guiding Question

- Have I implemented the approved work and left enough evidence for review and QA?

## Quick Agent

### Owns

- the entire quick-mode lifecycle: `quick_intake` through `quick_done`
- `quick_brainstorm` clarification + alignment and explicit user understanding confirmation before any option analysis
- `quick_plan` solution analysis with default 3 options, user option selection, execution planning, and separate plan confirmation before implementation
- planning, implementation, testing, and verification within quick mode
- `quick_verified` approval gate

### Does Not Own

- full-delivery or migration work
- auto-escalation (reports to user instead)
- scope beyond the agreed quick task

### Pass Condition

- the chosen option is implemented, tests pass, verification evidence is recorded, and `quick_verified` is approved before `quick_done`.

### Fail Condition

- implementation proceeds without user confirmation, verification uses placeholder evidence, or scope silently expands.

### Guiding Question

- Have I confirmed understanding before analysis, then implemented only the user-confirmed option and plan, with reproducible evidence?

## Code Reviewer

### Owns

- technical gate before QA
- scope and solution compliance review at code level
- code quality review after compliance passes
- routing review findings to implementation, solution, or product

### Does Not Own

- release readiness
- end-to-end runtime verification
- implementation fixes
- personal-style policing without repository standards

### Pass Condition

- the code matches approved scope and solution, and any quality issues left are non-blocking.

### Fail Condition

- the code is off-scope, under-implemented, overbuilt, boundary-breaking, or materially poor in quality.

### Guiding Question

- Looking at the code and contracts, is this implementation technically correct and responsibly built?

## QA Agent

### Owns

- runtime-facing verification gate
- acceptance and regression verification
- observable behavior checks
- evidence quality for closure
- routing behavior failures back to the right owner

### Does Not Own

- second-pass code review
- architecture preference debates without runtime impact
- optimistic closure without evidence

### Pass Condition

- observable behavior, regression surface, and evidence support closure honestly.

### Fail Condition

- user-visible behavior, migration parity, or required verification evidence fails or remains unproven.

### Guiding Question

- When the system is exercised for real, does it behave correctly and is that correctness proven by evidence?

## Routing Heuristic

- If the problem is `what are we building?` -> `Product Lead`
- If the problem is `how should we build it?` -> `Solution Lead`
- If the problem is `does the code match the approved direction?` -> `Code Reviewer`
- If the problem is `does the running behavior pass?` -> `QA Agent`

## Anti-Patterns

- `Master Orchestrator` invents content instead of routing work.
- `Master Orchestrator` writes code or applies a solution directly instead of dispatching `FullstackAgent`.
- `Product Lead` writes architecture.
- `Solution Lead` rewrites product scope.
- `Code Reviewer` tries to act as QA.
- `QA Agent` tries to act as a second code reviewer.
- any role writes long artifacts that do not make the next handoff easier.

## One-Line Rule

Each role should reduce uncertainty only in its own layer, and every artifact should make the next handoff easier rather than longer.
