# Bundled Codemods

Seed jscodeshift transforms shipped with OpenKit for demonstration and common tasks.

## Available transforms

| Transform | File | Description |
|-----------|------|-------------|
| var-to-const | `var-to-const.js` | Converts `var` declarations to `const` |
| console-to-logger | `console-to-logger.js` | Replaces `console.log(...)` with `logger.info(...)` |

## Usage

These transforms follow the preview-first workflow:

```
# Step 1: Preview changes
tool.codemod-preview.execute({
  transform: 'assets/codemods/var-to-const.js',
  files: ['src/app.js']
})

# Step 2: Review the diff output

# Step 3: Apply changes
tool.codemod-apply.execute({
  transform: 'assets/codemods/var-to-const.js',
  files: ['src/app.js']
})
```

## Writing your own transforms

A jscodeshift transform is a module that exports a function receiving `(fileInfo, api)`:

- `fileInfo.source` -- the file's source code as a string
- `fileInfo.path` -- the file's absolute path
- `api.jscodeshift` (also `api.j`) -- the jscodeshift API
- Return a string to indicate changes, or `undefined` to indicate no change

See the [jscodeshift documentation](https://github.com/facebook/jscodeshift) for the full API.

## Adding new transforms

1. Create a `.js` file in this directory (or anywhere in your project)
2. Export a default function with the `(fileInfo, api)` signature
3. Return `undefined` when the source is unchanged (avoids unnecessary writes)
4. Test with `codemod-preview` before applying
