# Simplified Install UX

Date: 2026-03-24

## Change Summary

- the preferred onboarding flow is now `npm install -g openkit` followed by `openkit run`
- `openkit run` performs first-time global kit setup automatically when the install is missing
- `openkit doctor` now reports next-step guidance and recommended commands
- `openkit install-global`, `openkit install`, and `openkit init` remain available as manual or compatibility commands

## Why This Changed

- the previous onboarding path required users to remember `openkit install-global` before they could do useful work
- the new flow reduces friction for first-time users while keeping install behavior explicit and debuggable inside the OpenKit CLI
- the project intentionally avoids npm `postinstall` side effects so failures remain easier to explain and recover from

## Operator Impact

- new-user quickstart:

```bash
npm install -g openkit
openkit run
openkit doctor
```

- if the global install is invalid rather than missing, `openkit run` stops and points the user to `openkit upgrade`
- if `opencode` is missing from `PATH`, first-time setup can still complete, but launch fails with a clear launcher error

## Release Notes Draft

- Simplified onboarding so users can install the CLI with `npm install -g openkit` and start with `openkit run`
- Added automatic first-run global kit setup when the managed install is missing
- Added doctor guidance with `Next:` and `Recommended command:` output for missing, invalid, healthy, and workspace-issue states
- Kept `openkit install-global`, `openkit install`, and `openkit init` for manual and compatibility workflows
