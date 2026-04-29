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
| `openkit profiles` | available | `global_cli` | operators | creating, editing, listing, deleting, and setting the launch default for reusable global agent model profiles | stores profiles under `<OPENCODE_HOME>/openkit`; delete is guarded for default or running-session use; use `openkit switch-profiles`, `openkit switch`, or `/switch-profiles` for current-session switching |
| `openkit switch-profiles` / `openkit switch` | available | `global_cli` | operators | directly opening the current-session profile picker inside an active OpenKit runtime session | requires valid `OPENKIT_RUNTIME_SESSION_ID`; fails closed outside an active runtime session; mutates only session/workspace runtime state |
| `openkit configure mcp ...` | available | `global_cli` | operators | guided interactive MCP setup, inspecting bundled/custom MCPs/skills, enabling/disabling MCPs, adding/importing/listing/disabling/removing custom MCPs, storing declared MCP keys, repairing secret-store permissions, and testing MCP readiness | `openkit configure mcp --interactive` is TTY-only and wraps the existing control plane; custom creation/import uses `openkit configure mcp custom ...`; see `docs/operator/mcp-configuration.md`; outputs and profiles must use placeholders/redaction only |
| `openkit onboard` | available | `global_cli` | operators | getting the safest first-run path without launching immediately | onboarding helper |
| `openkit install` / `openkit install-global` | compatibility_only | `global_cli` | maintainers/operators with manual setup needs | explicit provisioning or compatibility setup | not the preferred onboarding path |
| `openkit release ...` | available | `global_cli` | maintainers | preparing, verifying, and publishing OpenKit releases | maintainer-only workflow |
| `/task`, `/quick-task`, `/migrate`, `/delivery` | available | `in_session` | operators | lane selection and workflow entry | exactly three lanes: quick, migration, full |
| `/switch-profiles` | available | `in_session` | operators | prompt-template path for interactively switching the active global agent model profile for the current `openkit run` session only | OpenCode custom slash command files are prompt templates and true native executable slash command support is not currently documented; may be agent-mediated; does not mutate global profiles, the launch default, or other sessions |
| `/browser-verify` | preview | `runtime_tooling` | operators | planning browser verification and evidence capture | depends on runtime/browser provider availability and does not declare QA complete |
| Session-start capability guidance (`<openkit_capability_guidance>`) | available with degraded fallback | `global_cli` / `runtime_tooling` | operators/agents | compact role/stage-aware capability routes at startup | startup snapshot only; advisory; no skill body or MCP tool is auto-activated; refresh with explicit runtime/capability tools |
| `tool.rule-scan` / `tool.security-scan` | available when Semgrep is provisioned; otherwise `unavailable` or `degraded` with reason | `runtime_tooling` | review/QA/operators | OpenKit Semgrep quality and security scan evidence | direct scan evidence is separate from substitute scans, manual overrides, and target-project app validation |
| `tool.skill-index` / `tool.skill-mcp-bindings` / `tool.capability-router` skill routing | available | `runtime_tooling` | operators/agents/maintainers | inspecting bundled skill metadata, maturity status, support level, provenance, roles/stages/triggers, advisory MCP linkage, and compact capability summaries | skill `status` is `stable`/`preview`/`experimental`; runtime `capabilityState` is separate; routing recommends and explains, it does not silently activate skills or MCPs |
| `npm run verify:mcp-secret-package-readiness` | available | `package` | maintainers | proving `npm pack --dry-run --json` includes MCP secret backend files and excludes secret/generated/runtime artifacts | does not persist tarballs, does not mutate real Keychain, and does not prove `target_project_app` behavior |
| Install-bundle skill catalog sync | available | `package` | maintainers | proving source skill files, asset manifest entries, bundle skill files, and generated `skill-catalog.json` agree | run `npm run sync:install-bundle` then `npm run verify:install-bundle`; package evidence is not target-project app validation |
| Command permission policy | degraded until OpenCode defaultAction exception support is verified | `global_cli` / `package` | operators/maintainers | default-allow intent for routine commands plus confirm-required dangerous-command projection | canonical source is `assets/default-command-permission-policy.json`; `openkit doctor` reports policy source, global kit/profile drift, dangerous-entry coverage, and upstream caveats |
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
4. optionally use `openkit profiles --list`, `--create`, or `--set-default` when you want reusable global agent model profiles before launch
5. `openkit run`
6. inside OpenCode, start with `/task`
7. use `/quick-task`, `/migrate`, or `/delivery` only when the lane is already obvious; use `/switch-profiles` only to switch the current session to an existing global model profile
8. use `openkit upgrade` or `openkit uninstall` later for global-kit lifecycle maintenance

If workflow state already exists and you need the next safe action, use `node .opencode/workflow-state.js resume-summary`.

## Boundary Rules

- The preferred product path is the managed global OpenKit install under the OpenCode home directory.
- The managed global kit root, the derived workspace runtime state root, and the project `.opencode/` compatibility shim are separate layers and should not be treated as interchangeable paths.
- The checked-in `.opencode/` runtime remains live and important, but it is primarily the authoring and compatibility surface.
- Quick work stays task-board free; migration has no full-delivery task board and uses only strategy-enabled migration slice coordination when present.
- Full-delivery work may carry task boards, but parallel support stays bounded by the runtime commands and validations that actually exist.
- `openkit doctor` answers product/workspace readiness questions; `node .opencode/workflow-state.js doctor` answers workflow-runtime integrity questions.
- continuation controls and richer inspection tools are additive runtime aids; they never replace workflow approvals, evidence gates, or explicit stage ownership.
- Session-start capability guidance is a stale-able startup snapshot and a route hint, not proof that a skill, MCP, scan, browser check, or target app command ran.
- When a tool or command is not fully usable, describe it with the standard vocabulary: `available`, `unavailable`, `degraded`, `preview`, `compatibility_only`, or `not_configured`.
- Target-project build, lint, and test commands are `target_project_app` validation only when that project declares them. If absent, record app-native validation as unavailable instead of substituting OpenKit doctor/status checks.
- MCP secret backend release checks use fake keychain/structural validation only in CI; no real macOS Keychain mutation is valid release evidence.

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

## Capability Platform Maturation Baseline

FEATURE-950 hardens current capability surfaces in strict order: MCP/extensibility first, code intelligence second, and capability-aware orchestration last. The baseline capability map is:

| Capability family | Current status expectation | Validation surface | Refresh / inspection path | Caveats |
| --- | --- | --- | --- | --- |
| Bundled MCP catalog and configured MCPs | `available`, `preview`, `not_configured`, or `unavailable` per key/dependency/setup state | `global_cli`, `runtime_tooling` | `openkit configure mcp doctor`, `tool.mcp-doctor`, `tool.capability-inventory` | keys are reported only as redacted presence/missing state; disabled or policy-gated entries are not hidden readiness |
| Custom MCP definitions | `available`, `degraded`, `not_configured`, or `unavailable` per enablement, origin, command, remote, and key state | `global_cli`, `runtime_tooling` | `openkit configure mcp custom doctor`, `tool.capability-inventory` | custom entries remain origin/ownership-labeled and separate from bundled defaults |
| Project graph and symbol/dependency tools | `available` when the graph DB is usable; `degraded` when empty/read-only/stale/error-limited; `unavailable` when native DB support is missing | `runtime_tooling` | `tool.import-graph`, `tool.find-symbol`, `tool.find-dependencies`, `tool.find-dependents` | graph results depend on indexing freshness and supported language parsing |
| Semantic search and embeddings | `available` for embedding/hybrid evidence; `degraded` for keyword-only fallback; `not_configured` when embedding providers are disabled | `runtime_tooling` | `tool.semantic-search`, `tool.embedding-index` | keyword fallback is useful but not full semantic coverage |
| Syntax, codemod, AST, and LSP helpers | `available`, `preview`, or `degraded` depending on language support, dry-run/preview mode, path safety, and dependencies | `runtime_tooling` | syntax/codemod/LSP tools with explicit status fields | codemod preview is non-mutating; apply requires prior preview evidence |
| External build/lint/test probes | `available` only when target project config/framework exists; otherwise `unavailable` | `target_project_app` | `tool.typecheck`, `tool.lint`, `tool.test-run` | OpenKit runtime checks never replace app-native target-project validation |
| Capability-aware startup/runtime guidance | advisory read model over current capability state | `in_session`, `runtime_tooling`, `compatibility_runtime` | session-start guidance, `tool.runtime-summary`, `tool.capability-router` | does not auto-load skills, execute MCPs, approve gates, or enable parallel execution |

Phase completion evidence for this maturation work uses `tool.evidence-capture` / workflow-state evidence with a `details.phase_completion` object containing phase id, completed slices, acceptance criteria covered, validation surfaces checked, commands or tools run, unavailable validation paths, unresolved blockers, and the downstream unlock decision. This is an evidence convention only; it does not add lanes, stages, approval gates, or task parallelism.

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

- OpenKit's product intent is default allow for routine non-dangerous commands, backed by the machine-readable policy at `assets/default-command-permission-policy.json`.
- Global install materialization projects that policy into the OpenKit-managed kit config and profile config used by `openkit run`; the checked-in `.opencode/opencode.json` is an authoring/compatibility mirror, not the only product target.
- OpenCode-validated `opencode.json` files contain only OpenCode schema-valid keys. OpenKit-only policy metadata such as `commandPermissionPolicy` stays in `assets/default-command-permission-policy.json` or OpenKit-owned sidecars rather than inline config.
- Common routine examples include `openkit doctor`, `openkit onboard`, `openkit configure-agent-models --list`, `openkit profiles --list`, `/task`, `/quick-task`, `/migrate`, `/delivery`, `/switch-profiles`, `node .opencode/workflow-state.js status`, `resume-summary`, `show`, `doctor`, `validate`, `git status`, `git log`, `git diff`, file edits, file writes, and normal non-delete `bash`/`npm` usage.
- Dangerous policy-listed commands must require explicit confirmation before they run. This includes deletion (`rm`, `rmdir`, `unlink`), destructive git (`git reset --hard`, `git clean`, discard-style checkout/restore, force pushes), package/release/deploy publishing, database drop/truncate/reset/wipe forms, and privileged/system-impacting commands such as `sudo`, `chmod`, and `chown` where represented.
- Current OpenCode support for true `defaultAction: allow` with confirm-required exceptions is not verified by OpenKit. OpenKit therefore writes a compatible explicit permission map and `openkit doctor` reports the policy as `degraded` rather than guaranteeing all routine commands will be prompt-free.
- Broad `bash` or `npm` allow behavior cannot prove safety for destructive commands hidden in `sh -c`, aliases, chained shell commands, or package scripts unless OpenCode upstream can inspect those forms. Doctor/docs surface this as an unsupported granularity caveat.
- If OpenCode remembers an `Always Allow` decision for a command, that remembered approval comes from OpenCode itself. OpenKit does not persist a second command-approval store, and this MVP does not include a prompt broker, pseudo-terminal auto-confirm, or hidden prompt interceptor.
- Agent git/release safety protocol is unchanged: command permissions do not authorize commits, amend, force-push, destructive git, release publish, or deploy work without explicit user intent and the existing safety checks.
