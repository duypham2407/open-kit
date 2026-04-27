# Role And Skill Matrix

Use this matrix when deciding which skills each OpenKit role should invoke.

Canonical metadata for bundled skills lives in `src/capabilities/skill-catalog.js` and is governed by `docs/governance/skill-metadata.md`. This page is a human-oriented role view, not a duplicate catalog; keep role recommendations aligned with canonical metadata.

## Matrix

| Role | Typical skills | Use them when | Expected output |
| --- | --- | --- | --- |
| `MasterOrchestrator` | `brainstorming`, `find-skills` | routing-safe clarification is still needed before dispatch, or the user is asking about capabilities/skill discovery | clarified direction, lane-safe framing, or skill recommendations |
| `ProductLead` | `brainstorming`, `writing-scope` | product intent is still vague or needs explicit acceptance detail | scope package and compatibility requirements artifacts |
| `SolutionLead` | `brainstorming`, `writing-solution`, `vercel-react-best-practices`, `vercel-composition-patterns`, `vercel-react-native-skills`, `find-skills` | solution direction, sequencing, migration strategy, or frontend/mobile architecture needs domain-specific guidance | solution package and compatibility planning artifacts |
| `FullstackAgent` | `test-driven-development`, `subagent-driven-development`, `systematic-debugging`, `verification-before-completion`, `vercel-react-best-practices`, `vercel-composition-patterns`, `vercel-react-native-skills`, `find-skills` | implementing, debugging, delegating focused work, proving completion, or handling React/Next.js/React Native domains | code changes plus real verification evidence |
| `QAAgent` | `verification-before-completion`, `vercel-react-best-practices`, `vercel-react-native-skills` | validating evidence before approval or closure claims, especially for React, Next.js, or mobile performance-sensitive work | QA evidence and routing recommendation |
| `Code Reviewer` | `code-review`, `vercel-react-best-practices`, `vercel-composition-patterns`, `vercel-react-native-skills` | two-stage compliance and quality review is required, especially for React, Next.js, component-architecture, or React Native work | review findings only |

## Notes

- `test-driven-development` is the default for suitable full-delivery implementation slices when working test tooling exists
- migration work uses preserved-baseline and compatibility validation instead of forcing TDD-first behavior broadly
- `verification-before-completion` is a closure gate skill, not a replacement for QA ownership
- `using-skills` is the session-start meta-skill that teaches every agent how to discover and invoke the right skill at the right time
- `<openkit_capability_guidance>` is also emitted at session start as compact advisory routing: it may recommend `tool.capability-router`, `tool.skill-index`, `tool.mcp-doctor`, or explicit skill loading, but it must not load skill bodies, execute MCPs, or change role ownership on its own
- the Vercel React skills are bundled by default with OpenKit; they are not auto-loaded at session start, but agents should load them proactively when the task domain matches
- stable/preview/experimental skill maturity, support level, provenance, stage tags, triggers, and `recommended_mcps` come from the canonical metadata contract; runtime outputs should expose caveats instead of silently activating skills
