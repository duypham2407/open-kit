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

The doctor output will include a Semgrep availability check. If Semgrep is missing, the runtime reports the audit tools with standard OpenKit availability states such as `unavailable` and includes the known reason and fallback guidance.

## Bundled rule packs

Rule packs live in `assets/semgrep/packs/`:

| Pack | File | Rules |
|------|------|-------|
| Quality Default | `quality-default.yml` | no-console-log, no-debugger, no-todo-fixme, no-empty-catch, no-var-declaration, no-eval |
| Security Audit | `security-audit.yml` | no-eval, no-innerHTML, no-exec-untrusted, no-hardcoded-secret, no-http-url, no-new-function |

Bundled packs are enough for standard OpenKit gate evidence and do not require hosted Semgrep services or network-only upstream packs. Network-dependent configs such as `p/javascript` may still be used as explicit custom/operator choices, but they are not required for normal scan/tool evidence gates.

## Availability states

Audit tool availability uses the same vocabulary as other OpenKit runtime tools:

| State | Meaning for Semgrep scans |
| --- | --- |
| `available` | The OpenKit scan tool is registered and Semgrep can run with the requested config. |
| `unavailable` | Semgrep, the managed tooling path, or another required dependency is missing. The output must include the reason and fallback guidance. |
| `degraded` | Usable output exists but scope or metadata is limited; the limitation must be visible in evidence and reports. |
| `preview` | Reserved for partial/early scan surfaces whose limits must stay visible. |
| `compatibility_only` | The evidence comes from repository-local compatibility/runtime inspection rather than the preferred operator product path. |
| `not_configured` | The tool exists but a required local setting or provider is disabled or absent. |

Do not use legacy or ad-hoc labels such as `dependency-missing` in human gate reports when a standard state is available. Preserve dependency detail in the reason field instead.

## Result states

Availability answers whether the capability can be used; result state answers what happened for a scan attempt.

| Result state | Meaning |
| --- | --- |
| `succeeded` | The scan ran and produced parseable output. Findings may still block until classified. |
| `failed` / `scan_failed` | Semgrep ran but the scan command failed or output was unusable. Record the exit status and reason. |
| `unavailable` | The scan could not run because the capability was unavailable. |
| `degraded` | The scan produced usable but limited output. Report the limitation and classification confidence. |
| `invalid_path` | The requested target path is outside the allowed project scope or cannot be scanned. |

Successful execution is not the same as gate success: blocking, true-positive, or unclassified findings can still block review or QA.

## Evidence types

Reports and workflow evidence must distinguish these evidence types:

| Evidence type | Meaning | Reporting requirement |
| --- | --- | --- |
| `direct_tool` | `tool.rule-scan` or `tool.security-scan` ran through the OpenKit runtime tool surface. | Report direct tool status, result state, validation surface `runtime_tooling`, counts, classifications, and artifact refs. |
| `substitute_scan` | Direct tool invocation was unavailable/degraded and an allowed substitute command or tool ran instead. | Report the direct-tool unavailable/degraded status separately from what actually ran, plus substitute validation surface and limitations. |
| `manual_override` | An exceptional override was recorded because required scan output could not be obtained or an authorized operational exception applies. | Report target stage, unavailable tool, reason, actor if known, substitute evidence ids, substitute limitations, caveat, and downstream visibility. |

Persisted evidence may be read through workflow state as `compatibility_runtime`, but the scan itself remains OpenKit `runtime_tooling` evidence. It is not target-project app build/lint/test validation.

## High-volume finding triage

High-volume Semgrep output must be summarized before a gate decision. Human reports should not require operators to read an untriaged wall of raw findings.

- Group findings by rule, severity/category, affected area, and relevance to the changed work.
- Classify each group as `blocking`, `true_positive`, `non_blocking_noise`, `false_positive`, `follow_up`, or `unclassified`.
- Include finding counts and a short rationale for each non-blocking group.
- Link raw scan output through artifact refs when available instead of pasting thousands of findings into the review or QA report.
- Treat any remaining `unclassified`, unresolved `true_positive`, or `blocking` security group as a gate blocker unless the issue is explicitly routed as unresolved risk by the proper workflow owner.

## False-positive requirements

False positives require contextual rationale. A bare `false positive` label is not enough.

For each false-positive group, record:

- rule or finding identity
- affected file, area, or fixture path
- relevant context, including whether the code is production/runtime code, test fixture, example data, or generated material
- false-positive rationale
- behavior or security impact assessment
- follow-up decision or recommendation

Test-fixture security placeholders can be non-blocking only when the report explains why the value is not a real secret or exploitable issue and distinguishes fixture context from production/runtime code.

## Manual override limits

Manual overrides are exceptional and must remain visible in Code Review, QA, runtime summaries, and closeout reporting.

Overrides are allowed only for genuine tool unavailability, unusable direct scan output, or explicitly authorized operational exceptions. They must not be used to avoid triaging noisy but usable scan output.

A valid manual override must include:

- target stage
- unavailable or degraded tool
- reason for unavailability or unusable output
- substitute evidence ids when substitute evidence exists
- substitute limitations
- actor or owner when available
- caveat describing what the override does and does not prove

Manual overrides do not turn OpenKit scan/tool evidence into target-project app validation. If the target project has no app-native build, lint, or test command, report that validation path as unavailable.

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
