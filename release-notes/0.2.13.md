## What's changed

- Trim the published npm package contents by tightening the `package.json` `files` whitelist.
- Remove test suites, internal release-note scaffolding, and non-essential maintainer/internal docs from the npm tarball while preserving the OpenKit runtime surface.
- Keep the shipped package focused on the end-user product surface:
  - CLI runtime
  - managed `.opencode` runtime files
  - agents, commands, skills, context, assets, hooks, and required operator/runtime docs
- Reduce package size and file count substantially for cleaner installs and releases.

## Validation

- Ran `npm pack --dry-run` before and after the cleanup to confirm the tarball contents dropped from roughly `207.9 kB / 192 files` to `145.5 kB / 147 files`.
- Ran `NODE_OPTIONS=--trace-warnings node --test` before preparing the release workflow and kept the repository release metadata in sync through `openkit release prepare`.

## Published package

- npm: `@duypham93/openkit@0.2.13`

## Notes

- This release changes packaging only; it does not change the intended runtime behavior of OpenKit.
- The package now relies on the explicit `files` whitelist instead of `.npmignore` for publish control.
