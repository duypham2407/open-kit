# Defensive Error Handling & Code Audit Design

**Date:** 2026-05-11  
**Version:** 0.9.x  
**Status:** Design Approved

## Background

### Problem Statement

Analysis of bug screenshots from previous OpenKit versions (pre-0.9.0) revealed two critical stability issues when running OpenKit in React/Next.js projects:

**Bug 2: Configuration Loading Failures**
- Symptom: Undefined property access, crashes when loading config
- Impact: Runtime fails to bootstrap, OpenKit cannot start
- Context: Occurs when `.opencode/openkit.runtime.jsonc` is missing, malformed, or has invalid schema

**Bug 3: Project Detection Failures**
- Symptom: "Project root is within, but the ensure command not found the project"
- Impact: OpenKit cannot auto-detect project root, asks user for manual input
- Context: Detection logic fails on nested structures, unusual layouts, or edge cases

### User Expectation

When running `openkit run` in a React/Next.js project:
- OpenKit should auto-detect project root reliably
- OpenKit should load all features smoothly without crashes
- Missing or invalid config should not cause failures
- System should "just work" without manual intervention

### Root Cause Analysis

Without reproduction steps (only screenshots available), root cause analysis focuses on:
1. **Missing defensive validation** - code assumes valid inputs
2. **No graceful degradation** - failures crash instead of falling back to defaults
3. **Insufficient diagnostics** - when things fail, no logging to debug

## Solution: Defensive Code Audit + Enhanced Error Handling

### Architecture Overview

**Scope:** Audit and harden 2 critical paths:

1. **Project Detection Path** (Bug 3)
   - Entry: `openkit run` → `src/global/ensure-install.js` → project root detection
   - Problem: Fails when cannot find project or detects wrong location
   
2. **Configuration Loading Path** (Bug 2)
   - Entry: Runtime bootstrap → `src/runtime/runtime-config-loader.js` → load `.opencode/openkit.runtime.jsonc`
   - Problem: Crashes when file missing, invalid JSON, or wrong structure

**Three-Layer Defense Strategy:**

```
Layer 1: Input Validation
└─> Validate all inputs (paths, JSON, config structure) BEFORE processing

Layer 2: Graceful Degradation  
└─> If validation fails, fallback to safe defaults instead of crash

Layer 3: Diagnostic Logging
└─> Log structured data for debugging (what failed, why, context)
```

**Success Criteria:**
- No crashes on missing/invalid config files
- No crashes on unusual project structures
- Clear error messages when things fail
- All failures log diagnostic info to `.opencode/diagnostics.json`
- User can run `openkit doctor` to see diagnostics

## Component Design

### Component 1: Project Detection Hardening

**File:** `src/global/ensure-install.js`

**Current Issues:**
- Auto-detection logic fails on edge cases
- No fallback when detection fails
- Asks user for manual input (breaks "just work" expectation)

**Hardening Plan:**

#### Input Validation

```javascript
function validateProjectRoot(candidatePath) {
  const checks = {
    exists: fs.existsSync(candidatePath),
    isDirectory: fs.statSync(candidatePath).isDirectory(),
    hasPackageJson: fs.existsSync(path.join(candidatePath, 'package.json')),
    isAccessible: canReadWrite(candidatePath)
  }
  
  return {
    valid: checks.exists && checks.isDirectory && checks.hasPackageJson && checks.isAccessible,
    checks,
    reason: getFailureReason(checks)
  }
}

function canReadWrite(dirPath) {
  try {
    fs.accessSync(dirPath, fs.constants.R_OK | fs.constants.W_OK)
    return true
  } catch {
    return false
  }
}

function getFailureReason(checks) {
  if (!checks.exists) return 'path_does_not_exist'
  if (!checks.isDirectory) return 'not_a_directory'
  if (!checks.hasPackageJson) return 'no_package_json'
  if (!checks.isAccessible) return 'permission_denied'
  return null
}
```

#### Detection Strategy

Multi-strategy approach with fallbacks:

1. **Strategy 1:** Try `process.cwd()` first
2. **Strategy 2:** Walk up directories looking for `package.json` (max 10 levels)
3. **Strategy 3:** Check for common project markers:
   - `tsconfig.json` (TypeScript projects)
   - `next.config.js` (Next.js projects)
   - `.git/` (Git repository root)
   - `pnpm-workspace.yaml` (pnpm monorepos)
   - `turbo.json` (Turborepo monorepos)
4. **Strategy 4:** If multiple candidates found, pick closest to cwd
5. **Fallback:** If no valid candidate, use cwd with warning (don't crash or ask user)

```javascript
function detectProjectRoot() {
  const strategies = [
    detectFromCwd,
    detectByWalkingUp,
    detectByProjectMarkers
  ]
  
  for (const strategy of strategies) {
    const result = strategy()
    if (result.valid) {
      logDiagnostic('project_detection', 'info', 
        `Project detected using ${strategy.name}`,
        { path: result.path, confidence: result.confidence })
      return result
    }
  }
  
  // Fallback: use cwd
  const fallback = {
    path: process.cwd(),
    valid: true,
    confidence: 'fallback',
    diagnostic: 'No package.json found in tree, using current directory'
  }
  
  logDiagnostic('project_detection', 'warning',
    'Could not detect project root, using cwd as fallback',
    fallback.diagnostic)
  
  return fallback
}
```

#### Edge Cases Handled

- **Nested projects:** Walk up to find root package.json
- **Monorepos:** Detect workspace root vs package root
- **Symlinked directories:** Resolve symlinks before validation
- **Permission issues:** Detect and log unreadable directories
- **Self-hosting:** OpenKit running in its own repo (special case)
- **No package.json:** Use cwd with warning instead of failing

### Component 2: Config Loading Hardening

**File:** `src/runtime/runtime-config-loader.js`

**Current Issues:**
- No validation before parsing config files
- Crashes on missing or invalid files
- No fallback to defaults

**Hardening Plan:**

#### Input Validation

```javascript
function validateConfigFile(configPath) {
  // Check file exists
  if (!fs.existsSync(configPath)) {
    return { 
      valid: false, 
      reason: 'file_not_found', 
      data: null 
    }
  }
  
  // Check file is readable
  try {
    fs.accessSync(configPath, fs.constants.R_OK)
  } catch {
    return {
      valid: false,
      reason: 'permission_denied',
      data: null
    }
  }
  
  // Try parse JSONC
  let parsed
  try {
    const content = fs.readFileSync(configPath, 'utf8')
    parsed = parseJSONC(content) // handles comments
  } catch (err) {
    return { 
      valid: false, 
      reason: 'parse_error', 
      error: err.message,
      data: null
    }
  }
  
  // Validate schema
  const schemaCheck = validateConfigSchema(parsed)
  if (!schemaCheck.valid) {
    return { 
      valid: false, 
      reason: 'invalid_schema', 
      errors: schemaCheck.errors,
      data: null
    }
  }
  
  return { valid: true, data: parsed }
}
```

#### Loading Strategy

Fallback chain: project config → user config → defaults

```javascript
function loadRuntimeConfig(projectRoot) {
  const configPaths = [
    path.join(projectRoot, '.opencode', 'openkit.runtime.jsonc'),  // Project config
    path.join(os.homedir(), '.config', 'openkit', 'config.jsonc'), // User config
  ]
  
  for (const configPath of configPaths) {
    const result = validateConfigFile(configPath)
    
    if (result.valid) {
      logDiagnostic('config_loading', 'info',
        `Loaded config from ${configPath}`,
        { source: configPath })
      return {
        success: true,
        data: result.data,
        source: configPath,
        error: null
      }
    }
    
    // Log why this config failed
    logDiagnostic('config_loading', 'debug',
      `Config at ${configPath} not usable: ${result.reason}`,
      { reason: result.reason, errors: result.errors })
  }
  
  // All configs failed, use defaults
  const defaultConfig = getDefaultConfig()
  
  logDiagnostic('config_loading', 'warning',
    'No valid config found, using defaults',
    { attempted_paths: configPaths })
  
  return {
    success: true,
    data: defaultConfig,
    source: 'default',
    error: null
  }
}
```

#### Safe Defaults

Complete default configuration that is always safe:

```javascript
function getDefaultConfig() {
  return {
    codeIntelligence: {
      enabled: false,  // Safe: no external dependencies
      projectGraph: { enabled: false },
      semantic: { enabled: false },
      intent: { enabled: false }
    },
    profiles: {
      default: 'sonnet'
    },
    mcp: {
      servers: []  // Safe: no external connections
    },
    runtime: {
      diagnostics: true,
      logLevel: 'info'
    }
  }
}
```

#### Schema Validation

```javascript
function validateConfigSchema(config) {
  const errors = []
  
  // Required top-level fields
  const requiredFields = ['codeIntelligence', 'profiles', 'mcp', 'runtime']
  for (const field of requiredFields) {
    if (!(field in config)) {
      // Missing field is OK - will merge with defaults
      continue
    }
    
    // Field exists, validate its type
    if (typeof config[field] !== 'object') {
      errors.push(`Field '${field}' must be an object`)
    }
  }
  
  // Validate specific fields if present
  if (config.profiles && !config.profiles.default) {
    errors.push('profiles.default is required')
  }
  
  if (config.mcp && !Array.isArray(config.mcp.servers)) {
    errors.push('mcp.servers must be an array')
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}
```

#### Edge Cases Handled

- **Missing config file:** Use defaults, log diagnostic
- **Invalid JSON syntax:** Log parse error, use defaults
- **Invalid JSONC:** Handle comment syntax errors gracefully
- **Wrong schema:** Log validation errors, merge with defaults for missing fields
- **Partial config:** Merge with defaults for missing fields
- **Unknown fields:** Ignore (forward compatibility)
- **Corrupt file:** Catch read errors, use defaults
- **Permission denied:** Detect and log, try next config in chain

### Component 3: Diagnostic System

**New File:** `src/runtime/lib/diagnostics.js`

**Purpose:** Centralized diagnostic logging for debugging production issues

#### Diagnostic Event Structure

```javascript
{
  timestamp: "2026-05-11T10:30:45.123Z",
  level: "warning",          // error | warning | info | debug
  category: "config_loading", // Component category
  message: "User-friendly message",
  details: {
    // Category-specific details
    attempted_path: "/path/to/config.jsonc",
    reason: "file_not_found",
    fallback: "default_config"
  }
}
```

#### Diagnostic Categories

- `project_detection` - Project root detection events
- `config_loading` - Config file loading events
- `runtime_bootstrap` - Runtime initialization events
- `mcp_init` - MCP server connection events
- `capability_registry` - Capability registration events

#### Diagnostic File Management

**File:** `.opencode/diagnostics.json`

```javascript
function logDiagnostic(category, level, message, details) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    category,
    message,
    details: details || {}
  }
  
  appendToDiagnosticsFile(entry)
}

function appendToDiagnosticsFile(entry) {
  const diagnosticsPath = path.join(projectRoot, '.opencode', 'diagnostics.json')
  
  // Ensure directory exists
  fs.mkdirSync(path.dirname(diagnosticsPath), { recursive: true })
  
  // Read existing diagnostics
  let diagnostics = { version: '1.0', events: [] }
  if (fs.existsSync(diagnosticsPath)) {
    try {
      diagnostics = JSON.parse(fs.readFileSync(diagnosticsPath, 'utf8'))
    } catch {
      // Corrupt file, start fresh
    }
  }
  
  // Append new entry
  diagnostics.events.push(entry)
  
  // Rotate if too large (keep last 1000 events)
  if (diagnostics.events.length > 1000) {
    diagnostics.events = diagnostics.events.slice(-1000)
  }
  
  // Write back
  fs.writeFileSync(diagnosticsPath, JSON.stringify(diagnostics, null, 2), 'utf8')
}
```

#### Surfacing Diagnostics via `openkit doctor`

**File:** `src/global/doctor.js` (enhance existing)

```javascript
// Add new section to openkit doctor output
function showDiagnostics() {
  const diagnosticsPath = path.join(projectRoot, '.opencode', 'diagnostics.json')
  
  if (!fs.existsSync(diagnosticsPath)) {
    console.log('No diagnostics recorded yet')
    return
  }
  
  const diagnostics = JSON.parse(fs.readFileSync(diagnosticsPath, 'utf8'))
  const recentEvents = diagnostics.events.slice(-10) // Last 10 events
  
  console.log('\n## Recent Diagnostics\n')
  
  for (const event of recentEvents) {
    const icon = {
      error: '✗',
      warning: '⚠',
      info: '✓',
      debug: '○'
    }[event.level]
    
    console.log(`${icon} [${event.category}] ${event.message}`)
    
    if (event.level === 'error' || event.level === 'warning') {
      console.log(`  Details: ${JSON.stringify(event.details)}`)
    }
  }
  
  console.log(`\nFull diagnostic log: ${diagnosticsPath}`)
}
```

**Usage:**
```bash
$ openkit doctor --diagnostics

## Recent Diagnostics

⚠ [config_loading] Config file not found, using defaults
  Details: {"attempted_path":"/path/.opencode/openkit.runtime.jsonc","reason":"file_not_found"}
✓ [project_detection] Project root detected
○ [runtime_bootstrap] Capability registry initialized
✓ [mcp_init] Connected to MCP server 'github'

Full diagnostic log: .opencode/diagnostics.json
```

## Testing Strategy

### Edge Cases Test Matrix

#### Project Detection Tests

**File:** `src/tests/global/ensure-install.test.js`

```javascript
// Test 1: Normal project (has package.json at root)
test('detects project root with package.json at cwd', () => {
  const projectRoot = createTempProject({ packageJson: true })
  const result = detectProjectRoot()
  assert.equal(result.path, projectRoot)
  assert.equal(result.confidence, 'high')
})

// Test 2: Nested project (package.json 3 levels deep)
test('detects project root by walking up directory tree', () => {
  const projectRoot = createTempProject({ packageJson: true })
  const nestedDir = path.join(projectRoot, 'src', 'components', 'ui')
  fs.mkdirSync(nestedDir, { recursive: true })
  process.chdir(nestedDir)
  
  const result = detectProjectRoot()
  assert.equal(result.path, projectRoot)
  assert.equal(result.confidence, 'high')
})

// Test 3: No package.json (empty directory)
test('falls back to cwd when no package.json found', () => {
  const emptyDir = createTempDir()
  process.chdir(emptyDir)
  
  const result = detectProjectRoot()
  assert.equal(result.path, emptyDir)
  assert.equal(result.confidence, 'fallback')
})

// Test 4: Monorepo (multiple package.json files)
test('detects monorepo root by workspace markers', () => {
  const monorepoRoot = createTempProject({ 
    packageJson: true,
    workspaceMarker: 'pnpm-workspace.yaml'
  })
  const packageDir = path.join(monorepoRoot, 'packages', 'app')
  createPackageJson(packageDir)
  process.chdir(packageDir)
  
  const result = detectProjectRoot()
  assert.equal(result.path, monorepoRoot) // Should detect root, not package
  assert.equal(result.confidence, 'high')
})

// Test 5: Unreadable directory (permission denied)
test('handles permission denied gracefully', () => {
  const restrictedDir = createTempDir()
  fs.chmodSync(restrictedDir, 0o000)
  
  const result = validateProjectRoot(restrictedDir)
  assert.equal(result.valid, false)
  assert.equal(result.reason, 'permission_denied')
  
  // Cleanup
  fs.chmodSync(restrictedDir, 0o755)
})

// Test 6: Symlinked project root
test('resolves symlinks when detecting project', () => {
  const realProject = createTempProject({ packageJson: true })
  const symlinkPath = path.join(os.tmpdir(), 'symlink-project')
  fs.symlinkSync(realProject, symlinkPath)
  
  process.chdir(symlinkPath)
  const result = detectProjectRoot()
  
  assert.equal(fs.realpathSync(result.path), fs.realpathSync(realProject))
  
  // Cleanup
  fs.unlinkSync(symlinkPath)
})

// Test 7: Project in OpenKit's own repo (self-hosting case)
test('detects OpenKit repo when running in itself', () => {
  const openkitRepo = path.resolve(__dirname, '../../../')
  process.chdir(openkitRepo)
  
  const result = detectProjectRoot()
  assert.equal(result.path, openkitRepo)
  assert.equal(result.confidence, 'high')
})
```

#### Config Loading Tests

**File:** `src/tests/runtime/config-loader.test.js`

```javascript
// Test 1: Valid config file (happy path)
test('loads valid config successfully', () => {
  const projectRoot = createTempProject({
    config: {
      codeIntelligence: { enabled: true },
      profiles: { default: 'opus' }
    }
  })
  
  const result = loadRuntimeConfig(projectRoot)
  assert.equal(result.success, true)
  assert.equal(result.data.profiles.default, 'opus')
  assert.equal(result.source.includes('openkit.runtime.jsonc'), true)
})

// Test 2: Missing config file
test('falls back to defaults when config missing', () => {
  const projectRoot = createTempDir() // No config file
  
  const result = loadRuntimeConfig(projectRoot)
  assert.equal(result.success, true)
  assert.equal(result.source, 'default')
  assert.equal(result.data.profiles.default, 'sonnet') // Default value
})

// Test 3: Invalid JSON (syntax error)
test('handles JSON syntax errors gracefully', () => {
  const projectRoot = createTempProject({
    configContent: '{ invalid json syntax }'
  })
  
  const result = loadRuntimeConfig(projectRoot)
  assert.equal(result.success, true) // Falls back to default
  assert.equal(result.source, 'default')
})

// Test 4: Invalid JSONC (bad comment syntax)
test('handles JSONC comment errors gracefully', () => {
  const projectRoot = createTempProject({
    configContent: '{ "profiles": { "default": "sonnet" } /* unclosed comment }'
  })
  
  const result = loadRuntimeConfig(projectRoot)
  assert.equal(result.success, true)
  assert.equal(result.source, 'default')
})

// Test 5: Valid JSON but wrong schema
test('handles schema validation errors', () => {
  const projectRoot = createTempProject({
    config: {
      // Missing required 'profiles.default'
      codeIntelligence: { enabled: true }
    }
  })
  
  const result = loadRuntimeConfig(projectRoot)
  assert.equal(result.success, true)
  // Should merge with defaults for missing fields
  assert.equal(result.data.profiles.default, 'sonnet')
})

// Test 6: Partial config (some fields missing)
test('merges partial config with defaults', () => {
  const projectRoot = createTempProject({
    config: {
      profiles: { default: 'opus' }
      // Missing codeIntelligence, mcp, runtime
    }
  })
  
  const result = loadRuntimeConfig(projectRoot)
  assert.equal(result.success, true)
  assert.equal(result.data.profiles.default, 'opus') // From config
  assert.equal(result.data.codeIntelligence.enabled, false) // From default
})

// Test 7: Config with unknown fields
test('ignores unknown fields for forward compatibility', () => {
  const projectRoot = createTempProject({
    config: {
      profiles: { default: 'sonnet' },
      futureFeature: { enabled: true } // Unknown field
    }
  })
  
  const result = loadRuntimeConfig(projectRoot)
  assert.equal(result.success, true)
  assert.equal(result.data.profiles.default, 'sonnet')
  // Unknown field should be preserved
  assert.equal(result.data.futureFeature.enabled, true)
})

// Test 8: Corrupt file (unreadable)
test('handles file read errors gracefully', () => {
  const projectRoot = createTempProject()
  const configPath = path.join(projectRoot, '.opencode', 'openkit.runtime.jsonc')
  fs.writeFileSync(configPath, 'valid json')
  fs.chmodSync(configPath, 0o000) // Make unreadable
  
  const result = loadRuntimeConfig(projectRoot)
  assert.equal(result.success, true)
  assert.equal(result.source, 'default')
  
  // Cleanup
  fs.chmodSync(configPath, 0o644)
})

// Test 9: Config fallback chain (project → user → default)
test('tries project config first, then user config, then default', () => {
  // Setup user config
  const userConfigDir = path.join(os.homedir(), '.config', 'openkit')
  fs.mkdirSync(userConfigDir, { recursive: true })
  fs.writeFileSync(
    path.join(userConfigDir, 'config.jsonc'),
    JSON.stringify({ profiles: { default: 'haiku' } })
  )
  
  // Project with no config
  const projectRoot = createTempDir()
  
  const result = loadRuntimeConfig(projectRoot)
  assert.equal(result.success, true)
  assert.equal(result.source.includes('config.jsonc'), true)
  assert.equal(result.data.profiles.default, 'haiku') // From user config
  
  // Cleanup
  fs.rmSync(userConfigDir, { recursive: true })
})
```

### Test Implementation Pattern

Consistent pattern for all tests:

```javascript
test('descriptive test name', () => {
  // 1. Setup: Create test environment
  const testEnv = createTestEnvironment()
  
  // 2. Execute: Run the function under test
  const result = functionUnderTest(testEnv)
  
  // 3. Assert: Verify behavior
  assert.equal(result.success, true)
  assert.equal(result.expectedField, expectedValue)
  
  // 4. Cleanup: Remove temp files
  cleanupTestEnvironment(testEnv)
})
```

## Error Handling Patterns

### Consistent Error Response Format

All functions return structured results:

```javascript
{
  success: boolean,
  data: any | null,
  source?: string,           // Optional: where data came from
  error: {
    code: string,            // Machine-readable: 'CONFIG_NOT_FOUND', 'INVALID_JSON'
    message: string,         // User-friendly: "Config file not found"
    diagnostic: object       // Technical details for logging
  } | null
}
```

### Error Code Taxonomy

**Config Loading Errors:**
- `CONFIG_NOT_FOUND` - Config file doesn't exist
- `CONFIG_PERMISSION_DENIED` - Cannot read config file
- `CONFIG_PARSE_ERROR` - Invalid JSON/JSONC syntax
- `CONFIG_SCHEMA_ERROR` - Valid JSON but wrong structure

**Project Detection Errors:**
- `PROJECT_NOT_FOUND` - No package.json in tree
- `PROJECT_PERMISSION_DENIED` - Cannot access directory
- `PROJECT_INVALID` - Directory is not a valid project
- `PROJECT_AMBIGUOUS` - Multiple project roots found

### Usage Example

```javascript
// In runtime bootstrap
const configResult = loadRuntimeConfig(projectRoot)

if (!configResult.success) {
  // Log diagnostic
  logDiagnostic('config_loading', 'warning', 
    configResult.error.message, 
    configResult.error.diagnostic)
  
  // Use fallback (already returned in configResult.data)
  config = configResult.data
  
  // Optionally notify user (only for errors, not warnings)
  if (configResult.error.code !== 'CONFIG_NOT_FOUND') {
    console.warn(`⚠ ${configResult.error.message}`)
  }
} else {
  config = configResult.data
}

// Continue bootstrap - never crashes
initializeRuntime(config)
```

## Implementation Phases

### Phase 1: Foundation - Diagnostic Infrastructure

**Deliverable:** Working diagnostic system

**Tasks:**
1. Create `src/runtime/lib/diagnostics.js`
2. Implement `logDiagnostic(category, level, message, details)`
3. Implement `appendToDiagnosticsFile(entry)` with rotation
4. Add `.opencode/diagnostics.json` to `.gitignore`
5. Update `src/global/doctor.js` to show diagnostics
6. Write unit tests for diagnostics module
7. Manual test: verify diagnostics are written correctly

**Files Created:**
- `src/runtime/lib/diagnostics.js`

**Files Modified:**
- `src/global/doctor.js`
- `.gitignore`

**Tests Added:**
- `src/tests/runtime/diagnostics.test.js`

### Phase 2: Config Loading Hardening

**Deliverable:** Bulletproof config loader

**Tasks:**
1. Audit `src/runtime/runtime-config-loader.js`
2. Implement `validateConfigFile(configPath)`
3. Implement `validateConfigSchema(config)`
4. Implement `getDefaultConfig()`
5. Update `loadRuntimeConfig()` to use validation and fallbacks
6. Add diagnostic logging to all failure paths
7. Write edge case tests (9 tests from matrix)
8. Manual test in React/Next.js project with various config states

**Files Modified:**
- `src/runtime/runtime-config-loader.js`

**Tests Added:**
- `src/tests/runtime/config-loader.test.js` (9 edge case tests)

### Phase 3: Project Detection Hardening

**Deliverable:** Reliable project detection

**Tasks:**
1. Audit `src/global/ensure-install.js`
2. Implement `validateProjectRoot(candidatePath)`
3. Implement `detectFromCwd()`, `detectByWalkingUp()`, `detectByProjectMarkers()`
4. Implement multi-strategy `detectProjectRoot()` with fallbacks
5. Add diagnostic logging to all detection paths
6. Handle edge cases: nested, symlinks, monorepo, permissions
7. Write edge case tests (7 tests from matrix)
8. Manual test in various project layouts

**Files Modified:**
- `src/global/ensure-install.js`

**Tests Added:**
- `src/tests/global/ensure-install.test.js` (7 edge case tests)

### Phase 4: Integration & Validation

**Deliverable:** Production-ready hardening

**Tasks:**
1. Write integration test (end-to-end flow: detect project → load config → bootstrap runtime)
2. Test in real React project (create-react-app)
3. Test in real Next.js project (create-next-app)
4. Performance regression check (should not slow down startup)
5. Update documentation:
   - Add "Troubleshooting" section to README
   - Document diagnostic system in operator docs
   - Document error codes in maintainer docs
6. Update RELEASES.md with hardening notes
7. Manual verification: `openkit doctor --diagnostics` shows useful info

**Files Modified:**
- `README.md`
- `docs/operator/troubleshooting.md` (new)
- `docs/maintainer/error-codes.md` (new)

**Tests Added:**
- `src/tests/integration/bootstrap-hardening.test.js`

## Backward Compatibility

### No Breaking Changes

**Existing Code Paths:**
- All existing valid configs continue to work exactly as before
- No API changes to public functions
- No changes to CLI command interface
- No changes to workflow behavior

**New Validation:**
- Validation is additive (adds safety, doesn't restrict)
- Invalid configs now work with defaults (previously crashed)
- Missing configs now work with defaults (previously crashed)
- All failures are graceful (no crashes)

**Diagnostics:**
- Opt-in via `openkit doctor --diagnostics`
- Diagnostic file is auto-created, gitignored
- Does not clutter normal output
- Can be disabled via config if desired

### Migration Path

**Version 0.9.0 → 0.9.x:**
- Automatic upgrade (no user action needed)
- Existing configs continue to work
- Invalid/missing configs now work (previously crashed)
- New diagnostic file appears in `.opencode/diagnostics.json` (gitignored)

**User-Facing Changes:**
- Fewer crashes when configs are missing/invalid
- Better error messages when things fail
- New `openkit doctor --diagnostics` command
- No action required from users

## Success Metrics

### Before Hardening (0.9.0 and earlier)

❌ Crashes on missing config file  
❌ Crashes on invalid JSON in config  
❌ Crashes on unusual project structures  
❌ No diagnostic info when things fail  
❌ User must manually intervene when detection fails  

### After Hardening (0.9.x)

✅ Never crashes on config issues  
✅ Never crashes on project detection issues  
✅ Handles all edge cases gracefully  
✅ Rich diagnostics for debugging  
✅ 100% test coverage for edge cases  
✅ Clear error messages when things fail  
✅ "Just works" experience - no manual intervention  

### Verification Checklist

**Unit Tests:**
- [ ] All 9 config loading tests passing
- [ ] All 7 project detection tests passing
- [ ] All diagnostic tests passing

**Integration Tests:**
- [ ] End-to-end bootstrap test passing
- [ ] Manual test in React project: no crashes
- [ ] Manual test in Next.js project: no crashes
- [ ] Manual test with missing config: uses defaults
- [ ] Manual test with invalid config: uses defaults

**Regression Tests:**
- [ ] All existing tests still passing
- [ ] No performance regression (startup time)
- [ ] Valid configs still work exactly as before

**Diagnostics:**
- [ ] `openkit doctor --diagnostics` shows useful info
- [ ] Diagnostic file is gitignored
- [ ] Diagnostic file rotates correctly (stays under limit)

**Documentation:**
- [ ] README updated with troubleshooting section
- [ ] Operator docs updated with diagnostic guide
- [ ] Maintainer docs updated with error code reference

## Future Enhancements

**Out of Scope for This Design (but noted for future):**

1. **Telemetry Integration**
   - Send anonymized diagnostic events to telemetry service
   - Aggregate common error patterns across users
   - Proactive issue detection

2. **Interactive Recovery**
   - When config invalid, offer to fix it interactively
   - When project detection fails, offer guided setup
   - `openkit doctor --fix` command to auto-repair issues

3. **Config Validation Schema**
   - JSON Schema for `openkit.runtime.jsonc`
   - IDE integration (autocomplete, validation in editor)
   - Schema versioning for evolution

4. **Advanced Project Detection**
   - Support more monorepo tools (Lerna, Rush, Bazel)
   - Detect project type (React, Next, Vue, Angular)
   - Auto-configure based on project type

5. **Diagnostic Dashboard**
   - Web UI for browsing diagnostics
   - Timeline view of events
   - Filter by category, level, time range

---

## Summary

This design provides a comprehensive hardening of OpenKit's critical paths (project detection and config loading) through:

1. **Three-layer defense:** Input validation → Graceful degradation → Diagnostic logging
2. **Extensive edge case handling:** 16+ edge cases tested
3. **No breaking changes:** Fully backward compatible
4. **Rich diagnostics:** Structured logging for debugging
5. **"Just works" experience:** No manual intervention required

The implementation is phased to deliver incremental value, with comprehensive testing at each phase to ensure robustness.
