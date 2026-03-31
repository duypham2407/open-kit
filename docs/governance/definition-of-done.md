# Definition Of Done

A work item is only done when:

1. The required artifact for the current stage exists.
2. The relevant approval gate is recorded.
3. Implementation and QA evidence are attached when code changes exist.
4. Open critical and high issues are resolved.
5. Workflow state reflects the final stage accurately.
6. Handoff and closure notes are inspectable enough for a later session to understand why the item was allowed to advance or close.

Current-state notes:

- In `Quick Task`, this means the `quick_plan` checklist, acceptance bullets, verification path, QA Lite evidence, and `quick_verified` approval are recorded honestly; it does not imply the full-delivery `Product Lead -> scope package -> Solution Lead -> solution package` handoff.
- In `Full Delivery`, this means the required stage artifacts, handoff readiness, and approvals exist for the live full-delivery contract.
- If the repository has no build, lint, or test tooling for the work, done status requires explicit reporting of the real verification path rather than invented automation claims.
- Runtime or workflow maintenance work should leave the repository documentation aligned with any newly introduced commands or bootstrap behavior.
