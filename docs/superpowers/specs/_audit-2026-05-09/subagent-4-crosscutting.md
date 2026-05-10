## [Subagent 4] — Cross-cutting

### Critical

- [4-C-1] Command injection via shell-interpolated args in `ast-grep-search` — `src/runtime/tools/ast/ast-grep-search.js:63`
  - Description: `execSync` call joins entire args array into single shell string. Both `pattern` (arbitrary AST pattern from tool input) and `lang` (language choice) are user-supplied. A crafted pattern such as `"foo" --output /dev/null; rm -rf /tmp` will be executed because `args.join(' ')` produces a single unescaped command string passed to the system shell.
  - Evidence:
    ```js
    const args = [
      'ast-grep', 'run',
      '--pattern', pattern,   // user-controlled
      '--lang', lang,         // user-controlled
      '--json',
      targetPath || projectRoot,
    ];
    const result = execSync(args.join(' '), {   // L63 — shell-string construction
    ```
  - Suggested fix: replace `execSync(args.join(' '), ...)` with `spawnSync('ast-grep', args.slice(1), ...)` to pass argv array (no shell).

### High

- [4-H-1] Config-driven RCE via `supervisorDialogue.openclaw.command` — `src/runtime/supervisor/openclaw-adapter.js:40`
  - Description: openclaw supervisor reads `command` and `args` from user's runtime config (`src/openkit-runtime/openkit.json`). No whitelist or path validation on `settings.command`; any string is passed directly to `spawn`. Malicious or accidentally misconfigured target project repo with crafted `src/openkit-runtime/openkit.json` can execute arbitrary binaries.
  - Evidence: `const child = spawn(settings.command, settings.args, ...)` at L40. Schema validation (`src/runtime/config/schema.js:431`) only checks `typeof openclaw.command !== 'string'`.
  - Suggested fix: apply allowlist or path validation (absolute path only, no shell operators) mirroring `SHELL_OPERATORS`/`SHELL_LAUNCHERS` checks already in `custom-mcp-validation.js`.

- [4-H-2] Config-driven RCE via external MCP stdio `command` — `src/runtime/mcp/dispatch.js:183`
  - Description: `invokeStdioExternal` spawns `server.command` with `server.args`, both verbatim from `.mcp.json`/`src/openkit-runtime/mcp.json` in target project root. No validation. Attacker with write access to target project's `.mcp.json` can achieve RCE when operator runs `openkit run` against that project.
  - Evidence: `const child = spawn(server.command, server.args ?? [], ...)` at L183. `normalizeExternalServers` (L27-65) does no security check.
  - Suggested fix: apply same `SHELL_OPERATORS`/`SHELL_LAUNCHERS`/`SHELL_EXEC_FLAGS` checks from `custom-mcp-validation.js` to commands loaded from `.mcp.json`.

- [4-H-3] `OPENKIT_SECURITY_CLI` env var allows arbitrary binary as macOS security CLI — `src/global/mcp/secret-stores/keychain-adapter.js:26`
  - Description: `createKeychainAdapter` accepts security tool path from `env.OPENKIT_SECURITY_CLI` without validation. If attacker can inject this env var (e.g., via malicious `.env` from a worktree), they can substitute any binary for `/usr/bin/security`, which then receives the keychain password as CLI arg.
  - Evidence: `const run = normalizeRunner(runner, env.OPENKIT_SECURITY_CLI ?? '/usr/bin/security')` at L26. Then: `run(['add-generic-password', '-a', ..., '-w', value, '-U'])`.
  - Suggested fix: validate `OPENKIT_SECURITY_CLI` is an absolute path matching known safe pattern (e.g., `/usr/bin/security`).

- [4-H-4] Arbitrary file read outside project root via `file://` prompt references — `src/runtime/config/prompt-file-loader.js:16,24`
  - Description: `resolveFileUri` resolves `file:///etc/passwd` (absolute, L16) or `file://~/sensitive-file` (home-relative, L24) without boundary check against project root. Paths passed to `fs.readFileSync` — malicious runtime config can exfiltrate any process-readable file.
  - Evidence:
    ```js
    if (rawPath.startsWith('/')) { return path.resolve(rawPath); }   // L16
    if (rawPath.startsWith('~/')) { return path.join(homeDir, rawPath.slice(2)); }  // L24
    ```
    No `isInsideProjectRoot` call after.
  - Suggested fix: apply `isInsideProjectRoot` after resolving; reject paths escaping project root for relative/home-relative refs.

- [4-H-5] No E2E test for `src/hooks/graph-indexer.js` — `src/hooks/graph-indexer.js`
  - Description: graph-indexer hook is spawned detached/fire-and-forget on every session start. Builds and indexes in-memory project graph (critical path for graph-tool accuracy). No test in `src/tests/` or `src/openkit-runtime/tests/` exercises the hook entry-point binary; `src/tests/runtime/graph-db.test.js` tests DB layer only.
  - Evidence: `find .opencode/tests tests -name "*graph-index*"` returns nothing.
  - Suggested fix: add integration test spawning `graph-indexer.js` against fixture project; assert DB populated with expected nodes/edges.

### Medium

- [4-M-1] Shell-string construction in workspace shim scripts written to disk — `src/global/workspace-shim.js:161-284`
  - Description: Generator writes Node.js scripts containing `spawnSync(process.execPath, [...], ...)` with paths embedded via `JSON.stringify`. Paths come from `paths.kitRoot`/`paths.projectRoot` (resolved from env vars). JSON-stringify prevents shell injection but if path contained embedded newlines or `*/`, generated JS could be malformed.
  - Suggested fix: assert `paths.kitRoot` and `paths.projectRoot` are valid absolute paths without embedded newlines before writing generated scripts.

- [4-M-2] Caret-pinned dependencies allow unreviewed minor/patch upgrades — `package.json:9-16`
  - Description: All six direct deps use `^`. While `package-lock.json` pins exact versions, any `npm update` or fresh CI install ignoring lockfile pulls new versions unreviewed. `better-sqlite3` and `jscodeshift` have native add-on build steps at install.
  - Suggested fix: pin to exact versions (remove carets) for production deps, or enforce `npm ci` in all CI/deployment.

- [4-M-3] `tool.invocation-log` records full tool result objects without redaction — `src/openkit-runtime/lib/invocation-log.js:156`
  - Description: `createInvocationEntry` stores `result` (raw tool output). `tool.rule-scan`/`tool.security-scan` use `normalizeScanInvocationMetadata`. For other tools, entire `result` is passed via `invocationLogger.record({ ..., result })` in `wrap-tool-execution.js:84` with no redaction. Future tool returning sensitive data (e.g., secret loaded during diagnostics) would persist to `src/openkit-runtime/tool-invocations.json` on disk.
  - Suggested fix: scrub `result` through redaction pass before logging, or define and log only safe subset of fields per tool category.

- [4-M-4] Semgrep security rules lack command-injection and path-traversal patterns — `assets/semgrep/packs/security-audit.yml`
  - Description: 6 rules cover: eval, innerHTML, execSync/spawnSync (general), hardcoded secrets (regex), HTTP URLs, new Function. No rules for:
    - Shell-string construction via `.join(' ')` before `execSync` (4-C-1's exact pattern)
    - File reads with paths from config/user input without boundary check (4-H-4)
    - Spawn of config-supplied commands (4-H-1, 4-H-2)
  - Suggested fix: add semgrep rule matching `execSync($ARG.join(...))` and `execSync(... + ...)` to flag string-concatenated/joined shell commands; add rule flagging `fs.readFileSync` paths not prefixed by `path.join(projectRoot, ...)` or equivalent.

- [4-M-5] `quality-rules.test.js` security pack test is single-rule sanity check — `src/tests/semgrep/quality-rules.test.js:232`
  - Description: Only security pack test asserts `openkit.security.no-new-function` fires on one fixture. No tests verify injection-related rules (`no-exec-sync-untrusted`, `no-hardcoded-secret`) actually detect their targets.
  - Suggested fix: add fixtures and assertions for each security rule category following positive/negative pattern used for `no-var-declaration`.

### Low

- [4-L-1] `prebuild-install` is transitive dep of `better-sqlite3` and runs native binary downloads at install — transitive
  - Description: No active CVE; integrity checked by `node-gyp-build`, not SRI/hash. HTTPS fetch from GitHub Releases. Lockfile pins exact version.

- [4-L-2] `session-start.js` prints absolute paths (`project root`, `kit root`, `state file path`) on every session start — `src/hooks/session-start.js:271-283`
  - Description: Leaks operator's home directory layout to stdout. By design for debugging; worth documenting as privacy consideration.

- [4-L-3] No real-dir E2E for upgrade flow — `src/tests/cli/openkit-cli.test.js:1325`
  - Description: CLI test exercises `openkit upgrade` but uses mocked/injected `materializeGlobalInstall`. No fully-integrated test against real temp directory.

### Notes

- Directories read: src/, .opencode/lib/, hooks/, bin/, scripts/, package.json, package-lock.json (selected), tests/semgrep/, assets/semgrep/, src/runtime/tools/ast/, src/runtime/supervisor/, src/runtime/mcp/, src/global/mcp/secret-stores/, src/runtime/config/, src/global/workspace-shim.js, .opencode/lib/invocation-log.js
- Skipped: node_modules/, release-notes/
- Open questions: severity of [4-H-1]/[4-H-2] depends on threat model — does OpenKit assume target project repos are trusted? If yes, downgrade these to Medium; if no (e.g., reviewing untrusted repos), keep as High.
