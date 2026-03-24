# OpenKit 0.2.3 Release Checklist

Date: 2026-03-24

## Scope

- simplified onboarding with `npm install -g @duypham93/openkit` followed by `openkit run`
- automatic first-run global kit setup when the install is missing
- doctor guidance with `Next:` and `Recommended command:` output
- manual and compatibility retention for `openkit install-global`, `openkit install`, and `openkit init`

## Pre-Publish

- confirm `package.json` version is `0.2.3`
- confirm docs describe `npm install -g @duypham93/openkit` and `openkit run` as the preferred path
- confirm release note draft is up to date in `docs/operations/internal-records/2026-03-24-simplified-install-ux.md`
- run:

```bash
node --test tests/cli/openkit-cli.test.js tests/global/*.test.js tests/runtime/*.test.js tests/install/*.test.js
```

- run:

```bash
npm pack
```

- verify the tarball name is `duypham93-openkit-0.2.3.tgz`

## Local Smoke Test

- install the tarball into a temporary prefix
- verify `openkit --help` shows the new quickstart
- verify `openkit run` performs first-time setup and hands off to `opencode`
- verify the materialized kit can load the `master-orchestrator` agent and OpenKit commands through the OpenCode config directory

## Publish

- authenticate to npm if needed
- publish the package from the repository root:

```bash
npm publish --access public
```

- if using the packed tarball path explicitly, publish the generated archive instead

## Post-Publish

- verify the published version:

```bash
npm view @duypham93/openkit version
```

- install globally on a clean machine or temporary prefix:

```bash
npm install -g @duypham93/openkit
```

- verify:

```bash
openkit --help
openkit run
openkit doctor
```

- confirm `openkit run` auto-installs the managed kit when the global install is missing
- confirm invalid-install guidance points users to `openkit upgrade`

## Suggested Commit Message

```text
simplify global OpenKit onboarding

Make `openkit run` perform first-time global setup automatically so users can start with `npm install -g @duypham93/openkit` and launch immediately. Update doctor guidance, command help, docs, and tests to support the new onboarding flow while keeping manual install commands for compatibility.
```
