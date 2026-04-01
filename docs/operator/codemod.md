# Codemod Integration

OpenKit integrates jscodeshift for AST-based code transformations, supporting automated refactoring, migrations, and code modernization.

## How it works

Two runtime tools are available, following the preview-first policy:

| Tool | ID | Purpose |
|------|----|---------|
| Codemod Preview | `tool.codemod-preview` | Runs a transform and returns diffs without writing to disk |
| Codemod Apply | `tool.codemod-apply` | Runs a transform and writes changed files to disk |

Both tools use jscodeshift under the hood. The preview tool is the safe first step; the apply tool is the mutating second step.

## Preview-first workflow

All codemod operations follow a strict preview-then-apply sequence:

1. **Preview** -- run `codemod-preview` to see what would change (diffs, hunks, line counts)
2. **Review** -- inspect the previewed diffs for correctness
3. **Apply** -- run `codemod-apply` to write changes (or use `dryRun: true` for a final dry run)

Never skip the preview step. The apply tool does not require a prior preview call (they are independent), but the workflow expectation is that you always preview first.

## Provisioning

jscodeshift is installed as an npm dependency of the OpenKit package. No separate system-level provisioning is needed.

### Verifying availability

```sh
openkit doctor
```

If jscodeshift cannot be imported at runtime, both tools return `dependency-missing` status. To fix:

```sh
npm install
```

from the OpenKit kit root (or reinstall the global kit via `openkit upgrade`).

## Transform formats

Transforms can be provided in two ways:

### File-path transform

Point to a jscodeshift transform module (CommonJS or ESM with a default export):

```js
// transforms/var-to-const.js
export default function transformer(fileInfo, api) {
  const j = api.jscodeshift;
  return j(fileInfo.source)
    .find(j.VariableDeclaration, { kind: 'var' })
    .forEach(path => { path.node.kind = 'const'; })
    .toSource();
}
```

Usage:

```
tool.codemod-preview.execute({
  transform: 'transforms/var-to-const.js',
  files: ['src/app.js', 'src/utils.js']
})
```

### Inline transform

Pass the transform body as a string (receives `fileInfo` and `api` as arguments):

```
tool.codemod-preview.execute({
  inlineTransform: 'const j = api.jscodeshift; return j(fileInfo.source).find(j.VariableDeclaration, { kind: "var" }).forEach(p => { p.node.kind = "const"; }).toSource();',
  files: ['src/app.js']
})
```

Inline transforms are compiled via `new Function()`. This is intentional for agent-driven workflows but carries the same security implications as `eval`. See the safety section below.

## Tool parameters

### codemod-preview

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `transform` | string | One of transform/inlineTransform | File path to a jscodeshift transform module |
| `inlineTransform` | string | One of transform/inlineTransform | Transform function body as a string |
| `files` | string[] | Yes | Target files to transform |
| `file` | string | - | Single target file (alternative to `files`) |

### codemod-apply

Same parameters as preview, plus:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `dryRun` | boolean | No | When `true`, computes the transform but does not write files |

## Return values

### Preview response

```json
{
  "status": "ok",
  "provider": "jscodeshift",
  "transform": "transforms/var-to-const.js",
  "previews": [
    {
      "filePath": "src/app.js",
      "status": "preview-ready",
      "diff": {
        "changed": true,
        "filePath": "src/app.js",
        "hunks": [{ "startLine": 3, "endLine": 3, "removed": ["var x = 1;"], "added": ["const x = 1;"] }],
        "linesBefore": 10,
        "linesAfter": 10
      }
    }
  ],
  "changedCount": 1,
  "totalCount": 1
}
```

### Apply response

```json
{
  "status": "ok",
  "provider": "jscodeshift",
  "transform": "transforms/var-to-const.js",
  "dryRun": false,
  "applied": [
    { "filePath": "src/app.js", "status": "applied", "written": true }
  ],
  "appliedCount": 1,
  "totalCount": 1
}
```

### Error statuses

| Status | Meaning |
|--------|---------|
| `dependency-missing` | jscodeshift is not installed |
| `invalid-input` | Missing transform or files |
| `transform-not-found` | Transform file path does not exist |
| `transform-error` | Transform failed to compile or threw at runtime |
| `file-not-found` | Target file does not exist (per-file status) |
| `no-change` | Transform ran but produced identical output |

## Capability and doctor integration

- Capability: `capability.codemod` -- registered and enabled by default
- Both tools return `dependency-missing` when jscodeshift cannot be imported
- No separate doctor check is currently implemented; tools self-report availability

## Safety guidance

- **Preview first.** Always run `codemod-preview` before `codemod-apply`. Review the diffs.
- **Project-scoped only.** Transform files and target files must stay inside the current project root. Codemod tools do not allow reads or writes outside the project.
- **Inline transforms are eval.** The `inlineTransform` parameter compiles arbitrary code via `new Function()`. Only run transforms you trust. In agent workflows, treat inline transforms the same way you would treat generated code: review before applying.
- **Version control.** Run codemods on a clean git working tree so you can `git diff` after apply and `git checkout` to revert.
- **Scope narrowly.** Target specific files rather than globbing entire directories. Narrow scope reduces blast radius.
- **Dry run.** Use `dryRun: true` on the apply tool as a final safety check before committing to writes.

## Limitations

- jscodeshift only supports JavaScript and TypeScript transforms (JSX/TSX included)
- Inline transforms use `new Function()` which does not support `import` statements inside the transform body
- Transform file paths are resolved relative to `projectRoot`; use absolute paths for transforms outside the project
- No built-in codemod pack is bundled yet; bring your own transforms or use inline transforms
- No scheduling, batching, or caching layer exists; codemods run synchronously per invocation
