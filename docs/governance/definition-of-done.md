# Definition Of Done

A work item is only done when:

1. The required artifact for the current stage exists.
2. The relevant approval gate is recorded.
3. Implementation and QA evidence are attached when code changes exist.
4. Open critical and high issues are resolved.
5. Workflow state reflects the final stage accurately.

Current-state notes:

- In `Quick Task`, this means the quick-lane evidence and `quick_verified` approval are recorded honestly; it does not imply a full artifact chain.
- In `Full Delivery`, this means the required stage artifacts and approvals exist for the live full-delivery contract.
- If the repository has no build, lint, or test tooling for the work, done status requires explicit reporting of the real verification path rather than invented automation claims.
- Runtime or workflow maintenance work should leave the repository documentation aligned with any newly introduced commands or bootstrap behavior.
