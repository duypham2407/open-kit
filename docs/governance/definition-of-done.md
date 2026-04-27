# Definition Of Done

A work item is only done when:

1. The required artifact for the current stage exists.
2. The relevant approval gate is recorded.
3. Implementation and QA evidence are attached when code changes exist.
4. Open critical and high issues are resolved.
5. Workflow state reflects the final stage accurately.
6. Handoff and closure notes are inspectable enough for a later session to understand why the item was allowed to advance or close.

Current-state notes:

- In `Quick Task`, this means the Quick Agent has completed brainstorm (with codebase analysis and 3 options presented to the user), execution plan confirmed by user, implementation, and testing with real evidence; `quick_verified` approval is self-recorded by the Quick Agent based on concrete test output. Quick mode does not involve Master Orchestrator, QA Agent, or the full-delivery handoff chain.
- In `Migration`, this means preserved invariants, baseline evidence, compatibility hotspots, rollback checkpoints, and the migration solution package remain inspectable; parity evidence is real; any migration slice board is complete enough for closure; and `migration_verified` is approved honestly.
- In `Full Delivery`, this means the required stage artifacts, handoff readiness, and approvals exist for the live full-delivery contract.
- If the repository has no build, lint, or test tooling for the work, done status requires explicit reporting of the real verification path rather than invented automation claims.
- Runtime or workflow maintenance work should leave the repository documentation aligned with any newly introduced commands or bootstrap behavior.
- MCP configuration changes are not done until bundled and custom ownership boundaries are verified, generated profiles contain placeholders only, raw secrets appear only in the approved local secret/process paths, unsafe custom local command or remote URL shapes fail closed, and import/global conflict behavior preserves user-managed OpenCode entries.
