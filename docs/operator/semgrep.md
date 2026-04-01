# Semgrep Integration

OpenKit integrates Semgrep for rule-based code scanning, covering both code quality and security auditing.

## How it works

Two runtime tools are available:

| Tool | ID | Default config | Purpose |
|------|----|---------------|---------|
| Rule Scan | `tool.rule-scan` | `quality-default.yml` (bundled) | General code quality checks |
| Security Scan | `tool.security-scan` | `security-audit.yml` (bundled) | Security-focused checks |

Both tools use the same underlying Semgrep engine. The security scan is a convenience wrapper that defaults to security rules.

## Semgrep provisioning

OpenKit provisions Semgrep through the managed tooling path:

1. **System Semgrep** — if `semgrep` is already on your PATH, OpenKit links it into the managed tooling bin
2. **pip fallback** — if no system Semgrep is found, OpenKit attempts `python3 -m pip install --target <toolingRoot> semgrep` and writes a shim script

Provisioning happens during `openkit run` (first-time setup) or `openkit upgrade`.

### Prerequisites

- Python 3 with pip (only needed if Semgrep is not already installed system-wide)
- No npm/node dependency — Semgrep is a Python-based tool

### Verifying installation

```sh
openkit doctor
```

The doctor output will include a Semgrep availability check. If Semgrep is missing, the runtime reports `dependency-missing` status for audit tools.

## Bundled rule packs

Rule packs live in `assets/semgrep/packs/`:

| Pack | File | Rules |
|------|------|-------|
| Quality Default | `quality-default.yml` | no-console-log, no-debugger, no-todo-fixme, no-empty-catch, no-var-declaration, no-eval |
| Security Audit | `security-audit.yml` | no-eval, no-innerHTML, no-exec-untrusted, no-hardcoded-secret, no-http-url, no-new-function |

## Config resolution

When you invoke a scan tool, the `config` parameter is resolved as follows:

| Input | Resolved to |
|-------|------------|
| `'auto'` (or omitted) | Bundled `quality-default.yml` |
| `'p/security-audit'` | Bundled `security-audit.yml` |
| Any absolute path | Passed through to Semgrep as-is |
| Any other string | Passed through to Semgrep as-is (e.g., `p/javascript` for upstream packs) |

## Adding custom rule packs

1. Create a `.yml` file following [Semgrep rule syntax](https://semgrep.dev/docs/writing-rules/rule-syntax/)
2. Place it in `assets/semgrep/packs/` for bundled distribution, or anywhere in your project
3. Pass the path to the tool via `config`:
   ```
   tool.rule-scan.execute({ config: '/path/to/custom-rules.yml' })
   ```

## Capability and doctor integration

- Capability: `capability.rule-audit` — registered and enabled by default
- Runtime doctor: checks `isSemgrepAvailable()` and reports if missing
- Global doctor: checks Semgrep availability and includes it in the workspace health report

## Limitations

- Semgrep is an external system dependency — it requires Python 3 to install
- CI environments must have Python 3/pip available if Semgrep is not pre-installed
- The bundled rule packs are intentionally small seed sets; expand them for your project's needs
- Network-dependent Semgrep configs (e.g., `p/javascript`) require internet access
