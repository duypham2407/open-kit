## What's changed

- Adapt key UX and runtime-guidance ideas from OpenSpec without flattening OpenKit's lane-based architecture.
- Make `/task` a much clearer default entrypoint through stronger docs, transcript-style examples, and action-oriented wording across the operator surface.
- Add structured runtime guidance to OpenKit through:
  - command/lane instruction contracts
  - `next action` summaries
  - lane-aware artifact readiness summaries
- Add `openkit onboard` as a guided first-run explainer for operators who want a safer entrypoint before launching OpenCode.
- Add operator-facing supported-surface documentation so users can distinguish the preferred global product path from the checked-in compatibility runtime.
- Add full-delivery closeout ergonomics through runtime helpers such as `closeout-summary` and `reconcile-work-items`.
- Add adapter-friendly groundwork for future tool delivery while keeping OpenCode as the only first-class adapter today.

## Validation

- Ran focused tests for onboarding, doctor output, workflow-state guidance, and closeout helpers.
- Ran `NODE_OPTIONS=--trace-warnings node --test` and completed the full suite successfully before release.

## Published package

- npm: `@duypham93/openkit@0.2.14`

## Notes

- This release intentionally absorbs ideas from OpenSpec at the UX and guidance layer, not by replacing OpenKit's core workflow model.
- OpenKit still preserves its explicit `quick`, `migration`, and `full` lanes, migration-first semantics, and bounded full-delivery task-board runtime.
