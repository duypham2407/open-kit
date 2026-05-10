# Error Codes Reference

This document catalogs all error codes used in OpenKit's defensive error handling system.

## Configuration Loading Errors

### CONFIG_NOT_FOUND
- **Cause:** Config file doesn't exist at expected path
- **Behavior:** Silent fallback to next config in chain or defaults
- **Diagnostic:** Not logged (expected case)
- **User action:** None required

### CONFIG_PERMISSION_DENIED
- **Cause:** Config file exists but isn't readable
- **Behavior:** Skip to next config in chain
- **Diagnostic:** Logged at debug level
- **User action:** Check file permissions

### CONFIG_PARSE_ERROR
- **Cause:** Invalid JSON/JSONC syntax in config file
- **Behavior:** Skip to next config in chain
- **Diagnostic:** Logged at debug level with error message
- **User action:** Fix JSON syntax errors

### CONFIG_SCHEMA_ERROR
- **Cause:** Valid JSON but violates config schema
- **Behavior:** Skip to next config in chain
- **Diagnostic:** Logged at debug level with validation errors
- **User action:** Fix schema violations

## Project Detection Errors

### PROJECT_NOT_FOUND
- **Cause:** No package.json in directory tree (up to 10 levels)
- **Behavior:** Fallback to start directory
- **Diagnostic:** Logged at warning level
- **User action:** Add package.json or accept fallback

### PROJECT_PERMISSION_DENIED
- **Cause:** Directory exists but isn't readable/writable
- **Behavior:** Try next detection strategy
- **Diagnostic:** Logged at debug level
- **User action:** Check directory permissions

### PROJECT_INVALID
- **Cause:** Directory exists but isn't a valid project (no package.json)
- **Behavior:** Try next detection strategy
- **Diagnostic:** Logged at debug level
- **User action:** Add package.json

### PROJECT_AMBIGUOUS
- **Cause:** Multiple project roots found (monorepo edge case)
- **Behavior:** Pick closest to start directory
- **Diagnostic:** Logged at info level
- **User action:** None required (handled automatically)

## Validation Result Structure

All validation functions return consistent structure:

```javascript
{
  success: boolean,
  data: any | null,
  source?: string,
  error: {
    code: string,
    message: string,
    diagnostic: object
  } | null
}
```

## Adding New Error Codes

When adding new error codes:

1. Use SCREAMING_SNAKE_CASE
2. Prefix with component (CONFIG_, PROJECT_, etc.)
3. Document in this file
4. Add to relevant test suite
5. Log diagnostic at appropriate level
