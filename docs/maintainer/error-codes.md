# Error Codes Reference

This document catalogs the structured failure reasons used in OpenKit's defensive error handling layer.

## How Codes Are Surfaced

OpenKit does not use SCREAMING_SNAKE_CASE error code constants. Instead, defensive code paths emit lowercase `snake_case` `reason` strings on two surfaces:

1. **Validation result objects** returned from internal validators (e.g. `validateConfigFile`, `validateProjectRoot`).
2. **Diagnostic events** appended to `.opencode/diagnostics.json` by `logDiagnostic`. Reasons appear inside `details.reason` on the event payload.

Inspect recent reasons via:

```bash
openkit doctor --diagnostics
```

or by reading `.opencode/diagnostics.json` directly.

## Configuration Loading Reasons

Category: `config_loading`. Emitted by `tryLoadConfigPath` and `loadRuntimeConfigWithDiagnostics` in `src/runtime/runtime-config-loader.js`.

### `file_not_found`
- **Cause:** Config file does not exist at the resolved path (or vanished between `existsSync` and read).
- **Behavior:** Silent fallback to next config in the chain (project → user → defaults).
- **Diagnostic level:** `debug` (expected case; not a failure).
- **User action:** None required. Create `.opencode/openkit.runtime.jsonc` if you want a custom project config.

### `permission_denied`
- **Cause:** Config file exists but is not readable (failing `fs.accessSync(... R_OK)`).
- **Behavior:** Skip to next config in the chain.
- **Diagnostic level:** `warning`.
- **User action:** Fix file permissions (`chmod 644 .opencode/openkit.runtime.jsonc`).

### `parse_error`
- **Cause:** Invalid JSON/JSONC syntax. The original `JSON.parse` error message is preserved on `details.error`.
- **Behavior:** Skip to next config in the chain.
- **Diagnostic level:** `warning`.
- **User action:** Fix JSON syntax (trailing commas, unclosed braces, etc.).

### `schema_invalid`
- **Cause:** Valid JSON but violates the runtime config schema. Per-field errors are preserved on `details.errors`.
- **Behavior:** Skip to next config in the chain.
- **Diagnostic level:** `warning`.
- **User action:** Fix the schema violations listed in the diagnostic event.

### `no_usable_config_found`
- **Cause:** No project, user, or explicit config could be loaded. The loader falls back to `getDefaultRuntimeConfig()`.
- **Behavior:** Returns built-in defaults — never throws.
- **Diagnostic level:** `warning`.
- **User action:** Usually none. Create a config file only if defaults are unsuitable.

## Project Detection Reasons

Category: `project_detection`. Emitted by `detectProjectRootWithDiagnostics` in `src/global/paths.js`.

The detector runs three strategies in order — `cwd`, `walk_up`, `project_markers` — and falls back to `startDir` when all fail.

### Successful detection
- `details.strategy` records which strategy matched (`cwd`, `walk_up`, or `project_markers`).
- **Diagnostic level:** `info`.

### Fallback to start directory
- **Cause:** No `package.json` was found at `startDir` or up to 10 parent levels, and none of the project markers (`next.config.js`, `tsconfig.json`, `.git`, `pnpm-workspace.yaml`, `turbo.json`) matched either.
- **Behavior:** Detector returns the resolved start directory with `confidence: 'fallback'`.
- **Diagnostic level:** `warning`.
- **User action:** Add a `package.json` (or a recognised marker) at your project root, or accept the fallback.

### Validation reasons from `validateProjectRoot`

`validateProjectRoot` (also in `src/global/paths.js`) returns one of these reasons on `result.reason` for invalid candidate paths:

| Reason | Meaning |
| --- | --- |
| `path_does_not_exist` | Candidate path does not exist on disk. |
| `not_a_directory` | Path exists but is not a directory. |
| `permission_denied` | Directory exists but is not readable/writable. |
| `no_package_json` | Directory is accessible but contains no `package.json`. |

These reasons are returned to callers, not emitted as diagnostic events automatically — callers decide whether and how to log them.

## Validation Result Shapes

### Config validation — `validateConfigFile`

Success:

```javascript
{ valid: true, data: { /* parsed config */ } }
```

Failure:

```javascript
{ valid: false, reason: 'file_not_found' | 'permission_denied' | 'parse_error' | 'schema_invalid',
  error?: string,         // parse_error: original JSON.parse message
  errors?: string[],      // schema_invalid: per-field validation errors
  data: null }
```

### Project validation — `validateProjectRoot`

```javascript
{
  valid: boolean,
  checks: { exists, isDirectory, hasPackageJson, isAccessible },
  reason: null | 'path_does_not_exist' | 'not_a_directory' | 'permission_denied' | 'no_package_json',
}
```

### Config loader — `loadRuntimeConfigWithDiagnostics`

Always returns a success-shaped object — the loader never throws and always produces usable data (falling back to built-in defaults when needed):

```javascript
{
  success: true,
  data: object,                              // resolved config
  source: 'project' | 'user' | 'defaults',
  error: null,
}
```

Failure details for individual config candidates (parse errors, schema errors, permission denials) are not returned in this shape. They are recorded as diagnostic events under the `config_loading` category via `logDiagnostic` and can be inspected with `openkit doctor --diagnostics` or by reading `.opencode/diagnostics.json`.

## Adding New Reasons

When introducing new defensive failure reasons:

1. Use lowercase `snake_case` (e.g. `permission_denied`, not `PERMISSION_DENIED`).
2. Keep the reason scoped to a single category — pick or add the appropriate diagnostic category (`config_loading`, `project_detection`, ...).
3. Document the reason in this file with cause, behavior, diagnostic level, and user action.
4. Add or extend a test that asserts the reason is emitted on both the validation result and the diagnostic event when applicable.
5. Log a diagnostic event at the appropriate level — `debug` for expected/silent cases, `warning` for recoverable failures, `error` for unrecoverable failures.
