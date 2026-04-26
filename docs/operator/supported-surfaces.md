# Supported Surfaces

Use this document to understand which OpenKit surfaces are intended for end users, which remain maintainer/runtime compatibility layers, and which command path should be preferred.

## Supported Surface Matrix

| Surface | Capability state | Validation label | Primary audience | Use it for | Notes |
| --- | --- | --- | --- | --- |
| `npm install -g @duypham93/openkit` | available | `global_cli` | operators | installing the OpenKit CLI package | preferred install entrypoint |
| `openkit run` | available | `global_cli` | operators | launching OpenCode with the managed OpenKit profile | preferred first-run materialization path |
| `openkit doctor` | available | `global_cli` | operators | checking global install and workspace readiness | non-mutating global check |
| `openkit upgrade` | available | `global_cli` | operators | refreshing the managed global kit | use after package upgrades or drift |
| `openkit uninstall` | available | `global_cli` | operators | removing the managed global kit | optional workspace cleanup supported |
| `openkit configure-agent-models` | available | `global_cli` | operators | saving per-agent provider/model overrides | global to the current OpenCode home |
| `openkit onboard` | available | `global_cli` | operators | getting the safest first-run path without launching immediately | onboarding helper |
| `openkit install` / `openkit install-global` | compatibility_only | `global_cli` | maintainers/operators with manual setup needs | explicit provisioning or compatibility setup | not the preferred onboarding path |
| `openkit release ...` | available | `global_cli` | maintainers | preparing, verifying, and publishing OpenKit releases | maintainer-only workflow |
| `/task`, `/quick-task`, `/migrate`, `/delivery` | available | `in_session` | operators | lane selection and workflow entry | exactly three lanes: quick, migration, full |
| `/browser-verify` | preview | `runtime_tooling` | operators | planning browser verification and evidence capture | depends on runtime/browser provider availability and does not declare QA complete |
| `tool.rule-scan` / `tool.security-scan` | available when Semgrep is provisioned; otherwise `unavailable` or `degraded` with reason | `runtime_tooling` | review/QA/operators | OpenKit Semgrep quality and security scan evidence | direct scan evidence is separate from substitute scans, manual overrides, and target-project app validation |
| Supervisor dialogue runtime manager | `not_configured` by default; `available` when enabled with a configured transport | `runtime_tooling` | maintainers/reviewers/QA | OpenClaw/OpenKit supervisor bridge health and non-authoritative delivery configuration | disabled/unconfigured is valid and non-fatal |
| `node .opencode/workflow-state.js ...` | compatibility_only | `compatibility_runtime` | maintainers | lower-level runtime inspection and work-item/task-board operations | checked-in runtime path |
| `.opencode/workflow-state.json` | compatibility_only | `compatibility_runtime` | maintainers/runtime tooling | active work-item mirror state | external mirror over managed backing store |
| `.opencode/work-items/` | available | `compatibility_runtime` | maintainers/runtime tooling | per-item managed state and full-delivery task boards | not an operator onboarding surface |
| `registry.json` | available | `documentation` | maintainers | component and profile metadata | additive metadata, not an installer |
| `.opencode/install-manifest.json` | available | `documentation` | maintainers | local install-profile metadata | additive metadata, not destructive install logic |

## Default Operator Path

For everyday use, prefer this path:

1. `npm install -g @duypham93/openkit`
2. `openkit doctor`
3. `openkit onboard` if you want a dry onboarding summary first
4. `openkit run`
5. inside OpenCode, start with `/task`
6. use `/quick-task`, `/migrate`, or `/delivery` only when the lane is already obvious
7. use `openkit upgrade` or `openkit uninstall` later for global-kit lifecycle maintenance

If workflow state already exists and you need the next safe action, use `node .opencode/workflow-state.js resume-summary`.

## Boundary Rules

- The preferred product path is the managed global OpenKit install under the OpenCode home directory.
- The managed global kit root, the derived workspace runtime state root, and the project `.opencode/` compatibility shim are separate layers and should not be treated as interchangeable paths.
- The checked-in `.opencode/` runtime remains live and important, but it is primarily the authoring and compatibility surface.
- Quick work stays task-board free; migration has no full-delivery task board and uses only strategy-enabled migration slice coordination when present.
- Full-delivery work may carry task boards, but parallel support stays bounded by the runtime commands and validations that actually exist.
- `openkit doctor` answers product/workspace readiness questions; `node .opencode/workflow-state.js doctor` answers workflow-runtime integrity questions.
- continuation controls and richer inspection tools are additive runtime aids; they never replace workflow approvals, evidence gates, or explicit stage ownership.
- When a tool or command is not fully usable, describe it with the standard vocabulary: `available`, `unavailable`, `degraded`, `preview`, `compatibility_only`, or `not_configured`.
- Target-project build, lint, and test commands are `target_project_app` validation only when that project declares them. If absent, record app-native validation as unavailable instead of substituting OpenKit doctor/status checks.

## Runtime And Tooling Capability States

| State | Meaning |
| --- | --- |
| `available` | Implemented and required dependencies/configuration are present. |
| `unavailable` | Not usable in the current environment. |
| `degraded` | Usable through fallback behavior or with reduced scope or accuracy. |
| `preview` | Implemented as an early or partial surface whose limits must remain visible. |
| `compatibility_only` | Available for compatibility or maintainer diagnostics, not the preferred operator product path. |
| `not_configured` | Implemented but disabled because required local config or provider settings are absent. |

Current examples: supervisor dialogue is `not_configured` until enabled with an OpenClaw transport; semantic embeddings are `not_configured` until enabled in runtime config; semantic search may be `degraded` to keyword results when embeddings or indexes are missing; browser verification remains `preview` because it plans and captures evidence but does not replace QA closure; workflow-state commands are `compatibility_only` for normal operator onboarding.

Semgrep audit tools use the same availability states. A missing Semgrep dependency is `unavailable` with reason/fallback guidance; partial usable output is `degraded`; stored workflow-state evidence is `compatibility_runtime`, while the scan execution itself is `runtime_tooling`.

## Scan Evidence Reporting Surfaces

OpenKit scan/tool evidence is reported across Code Review, QA, runtime summaries, and closeout surfaces with a consistent split:

- `direct_tool`: `tool.rule-scan` or `tool.security-scan` ran through the OpenKit runtime and should report direct tool status, result state, finding counts, classification summary, validation-surface labels, and artifact refs.
- `substitute_scan`: direct tool invocation was unavailable or degraded and another allowed command/tool produced evidence; reports must name what actually ran, its validation surface, limitations, and the direct-tool unavailable/degraded reason.
- `manual_override`: an exceptional caveat for genuine tool unavailability, unusable output, or authorized operational exception; reports must keep target stage, unavailable tool, reason, actor if known, substitute evidence ids, substitute limitations, and caveat visible downstream.

High-volume finding triage belongs in the human report before gate decisions: group by rule, severity/category, affected area, and relevance; classify each group as `blocking`, `true_positive`, `non_blocking_noise`, `false_positive`, `follow_up`, or `unclassified`; link raw scan artifacts instead of dumping untriaged walls of findings.

False-positive requirements are strict: record rule/finding id, file or area, context, rationale, behavior/security impact, and follow-up decision. Test-fixture security placeholders must be distinguished from production/runtime code before being treated as non-blocking.

Manual override limits: overrides cannot be used to skip classification of noisy but usable scan results and do not substitute for target-project app build/lint/test validation. If app-native commands are absent, the `target_project_app` validation path remains unavailable even when OpenKit scan evidence exists.

Runtime read-model examples: `resume-summary --json` labels `openkit doctor` as `global_cli`, workflow-state diagnostics and persisted supervisor dialogue summaries as `compatibility_runtime`, browser verification as `preview` `runtime_tooling`, supervisor manager configuration health as `runtime_tooling`, and external build/lint/test probes as `target_project_app` only when project-local commands or config exist. If a work item has no supervisor store yet, the supervisor read model reports absent/unavailable instead of failing the resume surface.

## Supervisor Dialogue QA Evidence

For OpenClaw/OpenKit supervisor dialogue work such as FEATURE-940, QA reporting must use the current FEATURE-940 scope, solution, implementation, code-review, and QA artifacts as delivery proof. FEATURE-937 may be mentioned only as historical risk context.

The QA report must include supervisor dialogue evidence for:

- supervisor health, including disabled, unconfigured, degraded, offline, unavailable, or healthy states
- outbound event statuses, including pending, delivered, failed, and skipped where applicable
- inbound dispositions for acknowledgements, advisory proposals, concerns, attention requests, invalid messages, duplicates, and rejected authority-boundary attempts
- authority-boundary rejection for requests to execute commands, edit code, mutate workflow state, approve gates, update task boards, record evidence, close issues, or mark QA complete
- duplicate/repeated proposal outcomes that prevent duplicate actionable work while preserving audit records
- degraded/offline OpenClaw behavior that does not block normal OpenKit workflow progress
- proof that inbound OpenClaw messages caused no workflow mutation beyond supervisor dialogue records

Keep FEATURE-939 scan/tool evidence in its own section with the direct/substitute/manual fields above. Target-project app validation is unavailable unless an actual target project defines app-native build, lint, or test commands; OpenKit runtime, workflow-state, scan, governance, or CLI checks do not become target-project app validation.

## Task And Migration Inspectability

- Full-delivery task-board state should make task owner, task status, artifact refs, dependencies or sequential constraints, safe parallel zones when approved, QA owner, integration readiness, unresolved issues, and verification evidence inspectable.
- If `parallel_mode` is `none`, treat every task as sequential even when multiple board entries are ready.
- Migration coordination should make baseline evidence, preserved behavior, compatibility hotspots, staged sequencing, rollback checkpoints, parity evidence, and slice verification inspectable.
- Migration slice boards are strategy-driven and parity-oriented; they are not full-delivery task boards by default.

## Lane Artifact Expectations

| Lane | Required primary artifacts or records | Optional artifacts or coordination | What validation can honestly prove |
| --- | --- | --- | --- |
| `Quick Task` / `quick` | workflow communication for confirmed understanding, selected approach, execution plan, and verification evidence | `docs/tasks/YYYY-MM-DD-<task>.md` task card; no task board | closest real command or manual evidence available for the touched surface; app-native validation is unavailable when no target command exists |
| `Migration` / `migration` | migration solution package in `docs/solution/`, baseline evidence, preserved invariants, compatibility and parity notes | migration report in `docs/solution/*-report.md`; strategy-enabled migration slice board | baseline, parity, compatibility, rollback, build/test/smoke evidence only when those real commands exist |
| `Full Delivery` / `full` | Product Lead scope package in `docs/scope/` before Solution Lead solution package in `docs/solution/`, implementation evidence, code review, QA report in `docs/qa/` | ADRs in `docs/adr/`; full-only execution task board when approved | approved solution validation plus OpenKit surface checks where relevant; no invented app build/lint/test evidence |

Full-delivery `product_to_solution` requires the scope package before Solution Lead design. Quick task cards are optional. Migration coordination remains migration-specific and parity-oriented.

## Confirmation Policy

- Non-destructive commands should be auto-approved.
- Common auto-approved commands: `openkit doctor`, `openkit onboard`, `openkit configure-agent-models --list`, `/task`, `/quick-task`, `/migrate`, `/delivery`, `node .opencode/workflow-state.js status`, `resume-summary`, `show`, `doctor`, `validate`, `git log`, `git diff`, file edits, file writes, and normal non-delete `bash`/`npm` usage.
- Destructive delete-style commands must require explicit user confirmation before they run.
- This includes file deletion, directory removal, and other clearly destructive removal operations.
- If OpenCode remembers an `Always Allow` decision for a command, that remembered approval comes from OpenCode itself. OpenKit does not currently persist a second command-approval store.
