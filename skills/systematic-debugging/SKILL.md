---
name: systematic-debugging
description: "4-phase root cause process to debug scientifically instead of blindly guessing."
---

# Skill: Systematic Debugging

## Context

This skill is used by any developer agent (Fullstack, QA, Tech Lead) when it hits a bug, a build error, or an unexpected test failure. LLMs tend to guess and jump into random fixes. This skill forces an engineering-style debugging path.

## The Golden Rule
**Do NOT change or fix any line of code until the ROOT CAUSE is clear.**

## Additional Guardrails

- Test only 1 primary hypothesis at a time
- Do not stack multiple fixes into the same experiment
- If you have already tried 3 fixes and the original bug keeps returning, question the pattern or architecture instead of attempting a fourth fix

## 4-Phase Bug-Fix Process

### Phase 1: Context and Reproduction
Do not read code first. Go collect evidence.
1. Capture the exact error stack trace.
2. Identify the file and line that fails.
3. Reproduce the failure: which environment (dev/prod) and which input trigger it?
4. If the system has multiple boundaries (CLI -> controller -> rules, hook -> state file, command -> artifact), gather evidence at each boundary instead of jumping straight to the last layer.

### Phase 2: Hypothesis Generation
Based on the evidence, propose hypotheses for why it fails. Do NOT talk about fixes yet.

* Weak guess: "Variable X does not exist, so `.length` fails."
* Better hypothesis: "Function A expects an array, but the backend API returns `{ data: [] }` (an object), so calling `.map()` crashes."

List 2-3 hypotheses. Then narrow them down by grepping and reading code until you identify the most likely root cause.

⚠️ Test only 1 primary hypothesis. Do not fix three hypotheses at once and expect the tests to explain which one was correct.

### Phase 3: Propose Fix
Propose the Minimal Fix (the fewest lines changed across the fewest files).

⚠️ **RED ALERT: fixing many places usually means architecture surgery.** If you realize the solution package requires changing 3-4 separate logic files at once (scattered changes), stop. You are probably not fixing a bug anymore - you are papering over a broken system or bad architecture. Escalate back to the Master Orchestrator and bring in the Solution Lead to review the system.

### Phase 4: Implementation
Follow the active mode's validation model:
- In full-delivery implementation work, follow TDD (see `skills/test-driven-development/SKILL.md`): write a test, confirm it fails, apply the minimal fix, and confirm it passes.
- In migration work, capture the failing compatibility evidence first, apply the minimal fix, then rerun the strongest real regression or compatibility check available.
- In every mode, keep the fix minimal and evidence-based.

If the fix does not work:

1. STOP
2. go back to Phase 1 with the new evidence
3. if you have already tried 3 fixes and the core failure still remains, report to `MasterOrchestrator` that this may be an architecture or pattern problem rather than a local bug

## Rationalization Checklist
- [ ] Am I blindly spraying `console.log` everywhere instead of concentrating on the root cause? (If yes -> STOP)
- [ ] Am I about to wrap everything in `try...catch` and silently swallow errors? (If yes -> STOP)
- [ ] Have I already tried a third workaround and the same failure still looks unchanged? (The real problem may be cache or environment state. Re-check the environment instead of editing more code.)
- [ ] Am I changing many scattered files just to make the tests green again without proving the root cause? (If yes -> STOP)
