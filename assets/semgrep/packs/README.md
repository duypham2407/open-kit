# OpenKit Semgrep Rule Packs

Bundled rule packs for the `tool.rule-scan` and `tool.security-scan` runtime tools.

## Available Packs

| Pack | File | Purpose |
|------|------|---------|
| Quality Default | `quality-default.yml` | General code quality checks (console.log, debugger, empty catch, var, eval, TODO/FIXME) |
| Security Audit | `security-audit.yml` | Security-focused checks (eval, innerHTML, exec, hardcoded secrets, HTTP URLs, new Function) |

## Usage

### From the runtime tools

The rule-scan tool accepts a `config` parameter:

- `config: 'auto'` resolves to the bundled `quality-default.yml` pack
- `config: 'p/security-audit'` uses Semgrep's upstream security pack (requires network)
- `config: '/absolute/path/to/rules.yml'` uses a custom rule file

The security-scan tool defaults to `p/security-audit` but falls back gracefully.

### Direct Semgrep usage

```sh
semgrep scan --config assets/semgrep/packs/quality-default.yml .
semgrep scan --config assets/semgrep/packs/security-audit.yml .
```

## Adding custom rules

Create a new `.yml` file in this directory following the [Semgrep rule syntax](https://semgrep.dev/docs/writing-rules/rule-syntax/).

Register the pack in the runtime config or pass it directly to the rule-scan tool via `config`.
