# Role And Skill Matrix

Use this matrix when deciding which skills each OpenKit role should invoke.

## Matrix

| Role | Typical skills | Use them when | Expected output |
| --- | --- | --- | --- |
| `MasterOrchestrator` | `brainstorming` | design or migration direction needs clarification before planning | clarified direction, lane-safe framing |
| `PMAgent` | `brainstorming` | product intent is still vague before brief completion | clearer brief-ready scope |
| `BAAgent` | `writing-specs` | approved brief exists and a behavioral spec is needed | `docs/specs/...` |
| `ArchitectAgent` | `brainstorming` | architecture or migration boundary needs exploration | architecture-ready approach |
| `TechLeadAgent` | `writing-plans` | approved architecture needs to become executable work | `docs/plans/...` |
| `FullstackAgent` | `test-driven-development`, `subagent-driven-development`, `systematic-debugging`, `verification-before-completion` | implementing, debugging, delegating focused work, and proving completion | code changes plus real verification evidence |
| `QAAgent` | `verification-before-completion` | validating evidence before approval or closure claims | QA evidence and routing recommendation |
| `Code Reviewer` | `code-review` | two-stage compliance and quality review is required | review findings only |

## Notes

- `test-driven-development` is the default for suitable full-delivery implementation slices when working test tooling exists
- migration work uses preserved-baseline and compatibility validation instead of forcing TDD-first behavior broadly
- `verification-before-completion` is a closure gate skill, not a replacement for QA ownership
- `using-skills` is the session-start meta-skill that teaches every agent how to discover and invoke the right skill at the right time
