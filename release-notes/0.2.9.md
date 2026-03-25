## What's changed

- Fix `MODULE_TYPELESS_PACKAGE_JSON` warnings from generated workflow wrappers by switching workspace shims to CommonJS.
- Harden global runtime diagnostics so `openkit doctor` is non-mutating and no longer bootstraps workspace metadata as a side effect.
- Prevent global compatibility shims from overwriting repo-local `.opencode/workflow-state.json` when the project already owns that file.
- Refresh managed workflow wrappers safely when workspace paths change, reducing stale absolute-path issues.
- Centralize OpenKit version sourcing from `package.json` and keep runtime/install metadata in sync.
- Improve portability by:
  - detecting `opencode` more robustly across PATH variants
  - moving session-start runtime logic to `hooks/session-start.js`
  - removing the Python/sed dependency from the session-start hook
- Expand regression coverage for doctor behavior, shim safety, wrapper refresh, version metadata, and session-start output.

## Published package

- npm: `@duypham93/openkit@0.2.9`
