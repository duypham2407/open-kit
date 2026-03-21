# Reference Absorption Notes

This document records the last high-value ideas intentionally preserved from the former in-repo reference copies of `OpenAgentsControl/` and `superpowers/`.

OpenKit should treat this file as design guidance for future native features, not as proof that upstream plugin/runtime surfaces still exist in this repository.

## Preserved From OpenAgentsControl

### 1. Context discovery precedence

Useful future-state idea:

- check fast-path local metadata first
- then fall back through a deterministic discovery chain
- distinguish project-local paths from global fallback paths
- persist successful local discovery so the next lookup is cheap and explicit

OpenKit-native implication:

- future runtime setup or adopt commands should prefer explicit checked-in pointers over ad-hoc scanning
- context discovery should be deterministic, explainable, and cheap to re-run

### 2. Setup / adopt UX expectations

Useful future-state idea:

- one command should be able to inspect current runtime state, explain what is missing, and help bring the repository into a known-good kit shape
- setup should distinguish local repository adoption from global/shared installs
- setup should verify results immediately after making changes

OpenKit-native implication:

- future setup/adopt/repair commands should stay local-first and should not assume remote package installation unless a later feature explicitly adds that capability

### 3. Workflow evaluation patterns

Useful future-state idea:

- test observable workflow behavior, not only internal file utilities
- encode golden-path expectations for context loading, delegation, approval gates, and tool usage
- keep evaluation definitions explicit enough that drift can be detected early

OpenKit-native implication:

- future workflow evaluation should extend current `.opencode/tests/` and smoke-test guidance toward observable lane/routing/bootstrap behavior

## Preserved From superpowers

### 1. Verification-before-completion discipline

This has been absorbed directly into OpenKit as:

- `skills/verification-before-completion/SKILL.md`

### 2. Stronger debugging discipline

Key preserved ideas:

- no fixes before root cause investigation
- test one main hypothesis at a time
- if several fixes fail, question pattern or architecture instead of thrashing

This has been folded into:

- `skills/systematic-debugging/SKILL.md`

### 3. Stronger subagent execution discipline

Key preserved ideas:

- explicit implementer result states
- strict review ordering: spec compliance before code quality
- do not move to the next task while review issues remain open

This has been folded into:

- `skills/subagent-driven-development/SKILL.md`

### 4. Behavior-first testing mindset

Key preserved idea:

- evaluate the observable workflow contract, not just helper internals

OpenKit-native implication:

- smoke tests and future `.opencode/tests/` expansion should keep moving toward lane behavior, resume readiness, and command/bootstrap evidence

## De-reference Rule

After these ideas are absorbed, `OpenAgentsControl/` and `superpowers/` should no longer be treated as in-repo source-of-truth references.

OpenKit should evolve from its own checked-in:

- `AGENTS.md`
- `context/`
- `skills/`
- `commands/`
- `.opencode/`
- `docs/`

If future work borrows fresh ideas from upstream projects again, capture them as OpenKit-native docs or features instead of restoring full repo copies.
