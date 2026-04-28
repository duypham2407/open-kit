# MCP Secret Package Readiness

Use this runbook before publishing or globally installing a release candidate that touches MCP configuration, MCP capability routing, or MCP secret backends.

## Package Gate

Run the deterministic package-content gate from the repository root:

```sh
npm run verify:mcp-secret-package-readiness
```

The script shells out to `npm pack --dry-run --json`, parses npm's package file list, and does not create or persist a package tarball. Evidence from this command is `package` validation only.

The gate checks that the packed npm package includes the release-critical MCP secret backend surfaces, including:

- `src/global/mcp/secret-manager.js`
- `src/global/mcp/secret-stores/keychain-adapter.js`
- MCP redaction, config, health, profile materialization, custom MCP validation, launcher, CLI, runtime capability, and install materialization files
- packaged operator/release docs, install-bundle command and agent assets, `registry.json`, `.opencode/opencode.json`, `.opencode/install-manifest.json`, and `.opencode/workflow-state.js`

It also fails if generated or local runtime artifacts appear in the package list, including `secrets.env`, `.env` files, local MCP config state, workflow-state mirror data, work-item state, runtime databases, package tarballs, extracted package directories, or temporary OpenCode homes.

## Secret And Keychain Safety

- Do not put raw secrets in docs, package metadata, generated profiles, logs, workflow evidence, or release notes.
- Use placeholders such as `${CONTEXT7_API_KEY}` or `<CONTEXT7_API_KEY_VALUE>`.
- Package evidence may name paths and rule ids, but it must not print matched secret values.
- No real macOS Keychain mutation is valid CI evidence. Use the existing fake keychain runner/adapter tests or structural package checks instead.
- If a global install smoke test needs keychain behavior, inject fake keychain behavior through the existing test seams and use a temporary `OPENCODE_HOME`.

## Release Validation Surface Split

Use these labels in release evidence:

| Surface | What it can prove |
| --- | --- |
| `package` | `npm pack --dry-run --json` package contents, required MCP secret backend files, forbidden generated artifacts, and no raw secret-like packaged text. |
| `global_cli` | Installed or install-simulated `openkit` commands in isolated state, such as `openkit doctor`, `openkit run`, and `openkit configure mcp ...`. |
| `runtime_tooling` | Fake adapter/read-model/tool behavior, redaction, and capability inventory outputs. |
| `documentation` | Operator, governance, maintainer, and runbook guidance. |
| `compatibility_runtime` | Workflow-state validation and evidence integrity only. |
| `target_project_app` | Unavailable for this repository unless a separate target application declares real app-native build/lint/test/smoke commands. |

Do not report OpenKit package, CLI, workflow-state, governance, or MCP checks as `target_project_app` validation.

## Practical Release Sequence

```sh
npm run verify:mcp-secret-package-readiness
npm run verify:install-bundle
npm run verify:governance
node --test tests/global/mcp-keychain-adapter.test.js tests/global/mcp-secret-manager.test.js tests/cli/configure-mcp.test.js tests/runtime/launcher.test.js
node .opencode/workflow-state.js validate
```

For a broader maintainer pass, run `npm run verify:all` after the focused gates above. `npm run verify:all` is mixed OpenKit repository validation; it is still not target-project application validation.
