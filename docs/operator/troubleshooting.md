# Troubleshooting Guide

## Diagnostic System

OpenKit includes a comprehensive diagnostic system that logs events during runtime. When things don't work as expected, diagnostics are your first tool for investigation.

### Viewing Diagnostics

```bash
openkit doctor --diagnostics
```

Output shows:
- Last 10 diagnostic events
- Event level (error, warning, info, debug)
- Event category (config_loading, project_detection, etc.)
- Event message and details

### Diagnostic Categories

- **config_loading** - Configuration file loading events
- **project_detection** - Project root detection events
- **runtime_bootstrap** - Runtime initialization events
- **mcp_init** - MCP server connection events
- **capability_registry** - Capability registration events

### Full Diagnostic Log

Full diagnostic history: `.opencode/diagnostics.json`

The file rotates automatically (keeps last 1000 events).

## Common Issues

### Configuration Not Loading

**Symptom:** OpenKit uses default configuration instead of your custom config.

**Diagnostic check:**
```bash
openkit doctor --diagnostics | grep config_loading
```

**Possible causes:**

1. **File not found**
   - Config file doesn't exist at `.opencode/openkit.runtime.jsonc`
   - Solution: Create config file or accept defaults

2. **Parse error**
   - Invalid JSON syntax in config file
   - Solution: Validate JSON syntax, check for trailing commas, unclosed braces

3. **Schema error**
   - Config has invalid structure (e.g., missing `profiles.default`)
   - Solution: Check config against schema, ensure required fields present

4. **Permission denied**
   - Config file exists but isn't readable
   - Solution: Check file permissions: `chmod 644 .opencode/openkit.runtime.jsonc`

### Project Detection Issues

**Symptom:** OpenKit asks for project root or uses wrong directory.

**Diagnostic check:**
```bash
openkit doctor --diagnostics | grep project_detection
```

**Possible causes:**

1. **No package.json**
   - Directory tree has no `package.json`
   - Solution: Add `package.json` at project root, or accept fallback to current directory

2. **Nested in subdirectory**
   - Running from deep subdirectory, package.json is 10+ levels up
   - Solution: Run from closer to project root, or add package.json at appropriate level

3. **Monorepo ambiguity**
   - Multiple package.json files in tree
   - Solution: OpenKit detects workspace root by markers (pnpm-workspace.yaml, turbo.json)

### Runtime Crashes

**If OpenKit crashes on startup:**

1. Check diagnostics: `openkit doctor --diagnostics`
2. Look for error-level events before crash
3. Check full log: `.opencode/diagnostics.json`
4. Report issue with diagnostic log attached

**Note:** With defensive hardening (v0.9.1+), crashes due to config or project detection issues should not occur. If you experience crashes, please report them.

## Reporting Issues

When reporting issues, include:
1. OpenKit version: `openkit --version`
2. Diagnostic output: `openkit doctor --diagnostics`
3. Full diagnostic log: `.opencode/diagnostics.json` (if relevant)
4. Steps to reproduce

Report at: https://github.com/duypham2407/open-kit/issues
