# Code Quality Standards — Open Kit

All implementation agents MUST follow these standards before writing any code.

## Import Discipline
- Import only what a file uses
- Prefer explicit imports over wildcard imports
- Remove unused imports in the same change that introduces them

## Formatting
- Consistent indentation per language convention
- No unrelated file reformatting
- Follow the project's existing formatter if one exists

## Type Discipline
- Prefer explicit types, schemas, or contracts
- Avoid broad `any`-style escapes; document exceptions
- Make nullability, optional fields, and error cases explicit

## Naming
- Descriptive names that reflect domain intent
- No abbreviations unless ecosystem-standard
- Match existing naming patterns before introducing new ones

## Function & File Scope
- One primary responsibility per file
- Functions small enough that intent is obvious
- Split large mixed-responsibility units into smaller ones

## Error Handling
- Fail loudly so the next agent can diagnose the issue
- Do not swallow errors without recording why it is safe
- Return or raise structured errors when the stack supports it

## Tests
- Add or update tests when behavior changes
- Prefer tests that validate behavior, not implementation details
- If no test framework exists, describe the missing validation path in your report

## Documentation
- Update relevant docs when commands, workflows, or architecture change
- Do not leave future agents to infer decisions from code alone
