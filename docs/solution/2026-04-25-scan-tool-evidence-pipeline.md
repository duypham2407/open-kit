---
artifact_type: solution_package
version: 1
status: ready
feature_id: FEATURE-939
feature_slug: scan-tool-evidence-pipeline
source_scope_package: docs/scope/2026-04-25-scan-tool-evidence-pipeline.md
owner: SolutionLead
approval_gate: solution_to_fullstack
---

# Solution Package: Scan Tool Evidence Pipeline

## Source Scope And Approval Context

- Upstream scope: `docs/scope/2026-04-25-scan-tool-evidence-pipeline.md`.
- Current lane/stage: `full` / `full_solution`.
- Approval context: `product_to_solution` is approved; this package is the `solution_to_fullstack` handoff artifact.
- Scope preservation: this solution does not add a new lane, stage, approval-gate family, hosted scanner, target-project app command, or replacement scanner. It designs the technical path for the approved scan/tool evidence pipeline only.

## Chosen Approach

Implement a sequential hardening pass over the existing Semgrep-backed audit tools, evidence capture/runtime read models, tool-evidence gates, role prompts, and operator/maintainer docs.

This is enough because the repository already has:

- Semgrep-backed runtime audit tools at `src/runtime/tools/audit/rule-scan.js` and `src/runtime/tools/audit/security-scan.js`.
- A runtime tool registry and MCP server path.
- Workflow-state verification evidence, invocation logs, Tier 2 tool evidence gates, and Tier 3 invocation policies.
- Existing repo-native OpenKit validation commands in `package.json` and `.opencode/workflow-state.js`.

The main gap is not scanner selection. The gap is an end-to-end evidence contract: direct tool exposure, structured availability states, evidence metadata, triage/classification, gate interpretation, manual-override caveats, and reporting surfaces.

## Dependencies

- No new npm package dependency is required.
- No new hosted service, network-only rule pack, CI service, or app-native command is required.
- Semgrep remains the existing local/managed external scanner. If Semgrep is missing, direct tools must return structured `unavailable` evidence rather than throwing, returning empty output, or pretending success.
- Existing environment variables remain sufficient: `OPENKIT_PROJECT_ROOT`, `OPENKIT_WORKFLOW_STATE`, `OPENKIT_KIT_ROOT`, `OPENCODE_HOME`, and the existing tooling PATH handling through `src/global/tooling.js`.
- Target-project app validation remains independent and unavailable unless a target project defines its own build/lint/test commands.

## Impacted Surfaces And Exact File Targets

### Runtime audit tools and MCP exposure

- `src/mcp-server/tool-schemas.js`
- `src/runtime/tools/audit/rule-scan.js`
- `src/runtime/tools/audit/security-scan.js`
- `src/runtime/tools/audit/scan-evidence.js` (create)
- `src/runtime/tools/wrap-tool-execution.js`
- `src/runtime/create-tools.js`
- `src/runtime/tools/tool-registry.js` (only if constructor inputs need to pass shared evidence/capability helpers)

### Evidence capture, runtime summaries, and gate policy

- `src/runtime/tools/workflow/evidence-capture.js`
- `src/runtime/tools/workflow/runtime-summary.js`
- `.opencode/lib/runtime-guidance.js`
- `.opencode/lib/workflow-state-controller.js`
- `.opencode/lib/policy-engine.js`
- `.opencode/lib/runtime-summary.js`
- `.opencode/workflow-state.js`
- `context/core/approval-gates.md`
- `context/core/workflow-state-schema.md`
- `context/core/project-config.md`
- `context/core/runtime-surfaces.md`

### Role/report surfaces and docs

- `agents/fullstack-agent.md`
- `agents/code-reviewer.md`
- `agents/qa-agent.md`
- `assets/install-bundle/opencode/agents/FullstackAgent.md` (derived via `npm run sync:install-bundle`)
- `assets/install-bundle/opencode/agents/CodeReviewer.md` (derived via `npm run sync:install-bundle`)
- `assets/install-bundle/opencode/agents/QAAgent.md` (derived via `npm run sync:install-bundle`)
- `docs/templates/qa-report-template.md`
- `docs/operator/semgrep.md`
- `docs/operator/supported-surfaces.md`
- `docs/maintainer/test-matrix.md`
- `docs/kit-internals/04-tools-hooks-skills-and-mcps.md`
- `context/core/tool-substitution-rules.md`
- `AGENTS.md` (only for changed current-state/tooling facts)

### Tests

- `tests/mcp-server/mcp-server.test.js`
- `tests/runtime/audit-tools.test.js`
- `tests/runtime/runtime-bootstrap.test.js`
- `tests/runtime/runtime-platform.test.js`
- `tests/runtime/governance-enforcement.test.js`
- `tests/runtime/external-tools.test.js`
- `.opencode/tests/workflow-state-controller.test.js`
- `.opencode/tests/workflow-state-cli.test.js`
- `.opencode/tests/workflow-contract-consistency.test.js`

## Boundaries And Components

- Direct scan availability is solved by exposing the existing scan tools through MCP schema/namespace registration, not by adding another scanner.
- Tool invocation success is separate from evidence sufficiency. A successful `tool.rule-scan` invocation can still block the gate if findings remain unclassified or classified as blocking.
- Direct tool evidence, substitute scan evidence, and manual override evidence are separate evidence types and must remain distinguishable in state, reports, and closeout summaries.
- The Master Orchestrator may route and record gates, but it must not classify findings. Classification belongs to the stage owner producing review/QA evidence.
- OpenKit scan evidence validates `runtime_tooling` or, when recorded through workflow state, `compatibility_runtime`; it does not validate `target_project_app` build/lint/test behavior.
- Quality warnings do not need to be zero for a gate to pass; they need grouping, classification, rationale, and traceability.
- Security findings must not pass closure while unclassified or classified as true-positive unresolved findings.

## Interfaces And Data Contracts

### Direct scan result contract

Update direct scan tools to return a stable object that keeps availability, scan execution, triage, and evidence hints separate:

```js
{
  status: 'ok' | 'unavailable' | 'degraded' | 'not_configured' | 'scan_failed' | 'invalid_path',
  capabilityState: 'available' | 'unavailable' | 'degraded' | 'not_configured',
  validationSurface: 'runtime_tooling',
  toolId: 'tool.rule-scan' | 'tool.security-scan',
  scanKind: 'rule' | 'security',
  provider: 'semgrep',
  availability: {
    state: 'available' | 'unavailable' | 'degraded' | 'not_configured',
    reason: string | null,
    fallback: string | null
  },
  target: {
    requestedPath: string,
    targetPath: string,
    scopeSummary: string
  },
  ruleConfig: {
    requested: string,
    resolved: string,
    source: 'bundled' | 'custom' | 'external'
  },
  resultState: 'succeeded' | 'failed' | 'unavailable' | 'degraded',
  findingCount: number,
  severitySummary: Record<string, number>,
  findings: [/* normalized Semgrep findings */],
  triageSummary: {
    groupCount: number,
    blockingCount: number,
    nonBlockingNoiseCount: number,
    falsePositiveCount: number,
    followUpCount: number,
    unclassifiedCount: number,
    groups: [/* grouped by rule, severity/category, and relevance */]
  },
  evidenceHint: {
    evidenceType: 'direct_tool',
    source: 'tool.rule-scan' | 'tool.security-scan',
    kind: 'automated',
    validationSurface: 'runtime_tooling'
  }
}
```

Notes:

- `status: unavailable` replaces current ambiguous dependency status for missing Semgrep in outward tool results. Preserve the old reason in `availability.reason` if useful for debugging.
- `degraded` is for partial/usable output, such as parseable findings with missing metadata or bounded scan scope. A totally missing tool is `unavailable`, not `degraded`.
- `resultState` answers whether the scan ran. `capabilityState` answers whether the capability is usable in the environment.
- The raw finding list remains inspectable, but human-facing output should use `triageSummary` first.

### Evidence record extension

Extend workflow-state verification evidence with optional structured details while preserving existing required fields:

```js
verification_evidence[] = {
  id,
  kind: 'automated' | 'manual' | 'runtime' | 'review',
  scope,
  summary,
  source,
  command,
  exit_status,
  artifact_refs,
  recorded_at,
  details: {
    validation_surface: 'runtime_tooling' | 'compatibility_runtime' | 'documentation' | 'target_project_app',
    scan_evidence: {
      evidence_type: 'direct_tool' | 'substitute_scan' | 'manual_override',
      direct_tool: {
        tool_id,
        availability_state,
        result_state,
        reason
      },
      substitute: {
        ran: boolean,
        command_or_tool,
        validation_surface,
        limitations
      } | null,
      scan_kind,
      target_scope_summary,
      rule_config_source,
      finding_counts,
      severity_summary,
      triage_summary,
      false_positive_summary,
      manual_override: {
        target_stage,
        unavailable_tool,
        reason,
        substitute_evidence_ids,
        substitute_limitations,
        actor,
        caveat
      } | null
    }
  }
}
```

Implementation guidance:

- `tool.evidence-capture` should accept and preserve the optional `details` object.
- `.opencode/workflow-state.js record-verification-evidence` may be extended with an optional `--details-json` or equivalent flag if CLI-based structured evidence is needed. Do not remove the existing positional command behavior.
- Runtime summaries should show a compact scan-evidence read model; they do not need to dump every raw finding in normal human output.

### Triage classification states

Use these states consistently for grouped findings:

- `blocking`: must be fixed before the stage can pass.
- `true_positive`: real security/quality issue; blocks when severity or policy says it blocks.
- `non_blocking_noise`: noisy or unrelated warning group with rationale and traceability.
- `false_positive`: finding is not a real issue; requires file/context/rationale/impact fields.
- `follow_up`: non-blocking but worth a maintenance item.
- `unclassified`: default for findings that have not been triaged; cannot pass a required gate when any required scan evidence still has unclassified groups.

False-positive records must include rule/finding identity, file or area, relevant context, rationale, behavior/security impact assessment, and follow-up recommendation.

## Recommended Path

- Execute all slices sequentially.
- Use test-first implementation for every runtime/tool/gate change.
- Start with direct tool availability because downstream evidence/gate behavior depends on the tools being callable or returning structured unavailable output.
- Add evidence metadata before tightening gates so the gate has real structured data to evaluate.
- Tighten gate logic before updating role/report docs so agent instructions match runtime behavior.
- Sync install-bundle agent assets after source agent prompt updates.

## Implementation Slices

### [ ] Slice 1: Direct scan tool availability and structured scan results

- **Files**:
  - `src/mcp-server/tool-schemas.js`
  - `src/runtime/tools/audit/rule-scan.js`
  - `src/runtime/tools/audit/security-scan.js`
  - `src/runtime/tools/audit/scan-evidence.js` (create)
  - `src/runtime/tools/wrap-tool-execution.js`
  - `src/runtime/create-tools.js`
  - `tests/mcp-server/mcp-server.test.js`
  - `tests/runtime/audit-tools.test.js`
  - `tests/runtime/runtime-bootstrap.test.js`
- **Goal**: make `tool.rule-scan` and `tool.security-scan` directly callable through the MCP namespace where agents receive tool surfaces, and make every direct scan response include a structured state.
- **Dependencies**: none.
- **Test-first expectations**:
  - Add failing MCP tests that `tools/list` includes `tool.rule-scan` and `tool.security-scan`.
  - Add a failing MCP call test showing missing Semgrep returns structured `unavailable` rather than unknown tool, empty output, or silent success.
  - Add audit-tool tests for `available`, `unavailable`, `invalid_path`, `scan_failed`, exit-code-1 findings, severity grouping, and evidence hints.
  - Add/update runtime bootstrap assertions that audit tools have `validationSurface: 'runtime_tooling'` and standard capability-state vocabulary.
- **Validation Command**:
  - `node --test "tests/mcp-server/mcp-server.test.js"`
  - `node --test "tests/runtime/audit-tools.test.js"`
  - `node --test "tests/runtime/runtime-bootstrap.test.js"`
  - `npm run verify:runtime-foundation`
- **Details**:
  - Add schemas for `tool.rule-scan` and `tool.security-scan` in `src/mcp-server/tool-schemas.js`; this is the likely root of the FEATURE-938 direct namespace gap.
  - Keep both tools registered in `src/runtime/tools/tool-registry.js`; only change that file if passing shared helpers or metadata into the audit tool constructors is needed.
  - Convert dependency-missing outward behavior to the standard vocabulary: `status: 'unavailable'`, `capabilityState: 'unavailable'`, `availability.reason` explaining Semgrep/tooling path state, and `availability.fallback` pointing to substitute evidence/manual override policy.
  - Keep raw `findings` inspectable, but add grouped summaries so high-volume warning output is understandable without reading a wall of Semgrep JSON.
  - Update `wrap-tool-execution.js` so `unavailable` and `not_configured` results are not logged as successful invocations; `degraded` may be logged as non-success unless the gate logic explicitly accepts degraded evidence with limitations.

### [ ] Slice 2: Structured evidence capture and runtime read models

- **Files**:
  - `src/runtime/tools/workflow/evidence-capture.js`
  - `src/runtime/tools/workflow/runtime-summary.js`
  - `.opencode/lib/workflow-state-controller.js`
  - `.opencode/lib/runtime-summary.js`
  - `.opencode/workflow-state.js`
  - `context/core/workflow-state-schema.md`
  - `context/core/project-config.md`
  - `context/core/runtime-surfaces.md`
  - `tests/runtime/runtime-platform.test.js`
  - `.opencode/tests/workflow-state-cli.test.js`
- **Goal**: preserve direct scan, substitute scan, and manual override metadata in inspectable workflow evidence without blurring validation surfaces.
- **Dependencies**: Slice 1 scan result/evidence-hint contract.
- **Test-first expectations**:
  - Add failing `tool.evidence-capture` tests proving optional `details.scan_evidence` is preserved in workflow state.
  - Add failing workflow-state CLI/read-model tests showing direct evidence, substitute evidence, and manual override caveats are visible through `resume-summary --json`, `show`, runtime summary, or closeout surfaces.
  - Add tests showing `validation_surface` is preserved as `runtime_tooling` or `compatibility_runtime`, not `target_project_app`.
- **Validation Command**:
  - `node --test "tests/runtime/runtime-platform.test.js"`
  - `node --test ".opencode/tests/workflow-state-cli.test.js"`
  - `node .opencode/workflow-state.js validate`
  - `node .opencode/workflow-state.js resume-summary --json`
- **Details**:
  - Extend evidence records additively; do not break existing required fields or existing positional `record-verification-evidence` usage.
  - Runtime/human summaries should show compact scan evidence: direct tool status, substitute status, finding counts, classification summary, false-positive summary, manual override caveats, and artifact refs.
  - Raw scan output should be referenced through `artifact_refs` when available; normal summaries should not embed thousands of findings.
  - Keep target-project app validation explicit as unavailable when no app-native command/config exists.

### [ ] Slice 3: Finding triage, false-positive classification, and gate policy

- **Files**:
  - `src/runtime/tools/audit/scan-evidence.js`
  - `.opencode/lib/runtime-guidance.js`
  - `.opencode/lib/policy-engine.js`
  - `.opencode/lib/workflow-state-controller.js`
  - `.opencode/workflow-state.js`
  - `context/core/approval-gates.md`
  - `context/core/workflow-state-schema.md`
  - `tests/runtime/audit-tools.test.js`
  - `.opencode/tests/workflow-state-controller.test.js`
  - `.opencode/tests/workflow-state-cli.test.js`
- **Goal**: make gate behavior depend on classified scan outcomes rather than merely the existence of a source string or invocation entry.
- **Dependencies**: Slice 2 structured evidence must exist before the gate can evaluate classifications safely.
- **Test-first expectations**:
  - Add failing gate tests that `full_code_review` and `full_qa` stay blocked when required scan evidence is missing.
  - Add failing tests that a scan with unclassified findings blocks the relevant gate.
  - Add failing tests that classified non-blocking quality noise can pass while remaining traceable.
  - Add failing tests that a test-fixture security placeholder can pass only with false-positive details: rule, file/area, context, rationale, security impact, and follow-up decision.
  - Add failing tests that a production/runtime security finding or any true-positive unresolved security finding blocks.
  - Add failing tests that manual overrides missing target stage, unavailable tool, reason, substitute status/limitations, or actor/caveat are rejected.
  - Add failing tests that manual overrides cannot be used merely to avoid triaging noisy but available scan output.
- **Validation Command**:
  - `node --test ".opencode/tests/workflow-state-controller.test.js"`
  - `node --test ".opencode/tests/workflow-state-cli.test.js"`
  - `node --test "tests/runtime/audit-tools.test.js"`
  - `node .opencode/workflow-state.js show-policy-status`
  - `node .opencode/workflow-state.js show-dod`
- **Details**:
  - `checkToolEvidenceGate` should continue to enforce required source groups but also inspect structured scan details when present.
  - Tier 3 invocation policy should still require actual direct successful tool invocations unless structured substitute/manual override evidence legitimately bypasses the direct-invocation requirement.
  - Manual override bypass remains exceptional and must be visibly caveated downstream.
  - Keep existing policy enforcement modes (`enforce`, `warn`, `off`) but ensure `warn` records limitations rather than implying gate success.
  - Do not require all quality warnings to be fixed. Require all groups to be classified and any blocking/true-positive groups to be resolved or routed.

### [ ] Slice 4: Role prompts, report templates, and operator/maintainer documentation

- **Files**:
  - `agents/fullstack-agent.md`
  - `agents/code-reviewer.md`
  - `agents/qa-agent.md`
  - `assets/install-bundle/opencode/agents/FullstackAgent.md`
  - `assets/install-bundle/opencode/agents/CodeReviewer.md`
  - `assets/install-bundle/opencode/agents/QAAgent.md`
  - `docs/templates/qa-report-template.md`
  - `docs/operator/semgrep.md`
  - `docs/operator/supported-surfaces.md`
  - `docs/maintainer/test-matrix.md`
  - `docs/kit-internals/04-tools-hooks-skills-and-mcps.md`
  - `context/core/tool-substitution-rules.md`
  - `context/core/approval-gates.md`
  - `tests/runtime/governance-enforcement.test.js`
  - `.opencode/tests/workflow-contract-consistency.test.js`
- **Goal**: make Fullstack, Code Reviewer, and QA outputs consistently report direct status, substitute status, finding counts, classification summary, false positives, overrides, and artifact refs.
- **Dependencies**: Slices 1-3 contracts.
- **Test-first expectations**:
  - Update governance/contract tests first where they assert required prompt or documentation language.
  - Tests should require scan/tool evidence sections to include direct status, substitute/manual distinction, classification summary, false-positive rationale, manual-override caveats, and validation-surface labels.
- **Validation Command**:
  - `npm run sync:install-bundle`
  - `npm run verify:install-bundle`
  - `npm run verify:governance`
  - `node --test ".opencode/tests/workflow-contract-consistency.test.js"`
- **Details**:
  - Update source agent prompts first, then run `npm run sync:install-bundle` to refresh derived install-bundle agent files.
  - Code Reviewer must not output Stage 2 until scan evidence is direct, structured unavailable/degraded, substituted with explicit limitations, or manually overridden with caveats.
  - QA must include a dedicated scan/tool evidence section in the QA report and must preserve manual override caveats in closure recommendation.
  - Fullstack handoff must record implementation-time scan/evidence status before review.
  - `docs/operator/semgrep.md` should document bundled rule packs, standard availability states, result states, evidence types, high-volume finding triage, false-positive requirements, and manual override limits.

### [ ] Slice 5: Integration verification and evidence closeout

- **Files**:
  - `package.json` (read-only for command reality; do not edit unless scripts genuinely change)
  - `docs/solution/2026-04-25-scan-tool-evidence-pipeline.md`
  - `.opencode/work-items/<work_item_id>/tool-invocations.json` (runtime-produced, do not hand-edit)
  - `.opencode/workflow-state.json` / managed active work-item state (use CLI/tooling only; do not hand-edit)
  - `docs/qa/2026-04-25-scan-tool-evidence-pipeline.md` (created by QA later, not Fullstack)
- **Goal**: prove the whole pipeline works end-to-end and record the remaining validation split honestly.
- **Dependencies**: Slices 1-4.
- **Validation Command**:
  - `node --test "tests/mcp-server/mcp-server.test.js"`
  - `node --test "tests/runtime/audit-tools.test.js"`
  - `node --test "tests/runtime/runtime-platform.test.js"`
  - `node --test ".opencode/tests/workflow-state-controller.test.js" ".opencode/tests/workflow-state-cli.test.js"`
  - `npm run verify:runtime-foundation`
  - `npm run verify:governance`
  - `npm run verify:all`
  - `node .opencode/workflow-state.js validate`
  - `node .opencode/workflow-state.js show-invocations feature-939`
  - `node .opencode/workflow-state.js show-policy-status`
- **Details**:
  - Fullstack must record verification evidence through `tool.evidence-capture` or `.opencode/workflow-state.js record-verification-evidence` before requesting code review.
  - Code Reviewer must run/attempt direct `tool.rule-scan` and `tool.security-scan`; direct unavailable must be recorded as unavailable and not as a successful direct scan.
  - QA must verify that any substitute/manual override caveat remains visible in the QA report and closeout/readiness surfaces.
  - If `npm run verify:all` is environmentally blocked, record the exact blocker and run the strongest targeted commands above. Do not claim app-native validation.

## Dependency Graph

Observable dependency chain from current code:

- `src/runtime/tools/audit/security-scan.js` wraps `src/runtime/tools/audit/rule-scan.js`; shared scan-result/triage helpers must be stable before security scan behavior is considered done.
- `src/runtime/tools/tool-registry.js` registers both audit tools; MCP exposure additionally depends on `src/mcp-server/tool-schemas.js` listing those tool IDs.
- `src/runtime/tools/wrap-tool-execution.js` records invocation success/failure; Tier 3 policy in `.opencode/lib/policy-engine.js` depends on accurate invocation status.
- `tool.evidence-capture` records workflow evidence; Tier 2 gates in `.opencode/lib/runtime-guidance.js` and workflow-state readiness surfaces depend on that evidence shape.
- Agent prompts and QA templates depend on the runtime/evidence/gate contract; they should not be finalized before Slices 1-3 settle.

Slice sequencing:

1. `SCAN-TOOLS-AVAILABILITY`
2. `SCAN-EVIDENCE-CAPTURE`
3. `SCAN-GATE-POLICY`
4. `SCAN-REPORTING-DOCS`
5. `SCAN-FINAL-VALIDATION`

Critical path: `Slice 1 -> Slice 2 -> Slice 3 -> Slice 4 -> Slice 5`.

## Parallelization Assessment

- parallel_mode: `none`
- why: all slices share audit tool contracts, workflow-state evidence shape, gate semantics, and agent/reporting language. Parallel edits would risk incompatible evidence fields or docs claiming behavior before gates enforce it.
- safe_parallel_zones: []
- sequential_constraints:
  - `SCAN-TOOLS-AVAILABILITY -> SCAN-EVIDENCE-CAPTURE -> SCAN-GATE-POLICY -> SCAN-REPORTING-DOCS -> SCAN-FINAL-VALIDATION`
- integration_checkpoint: after each slice, run its targeted validation and inspect whether the next slice still matches the actual data contract.
- max_active_execution_tracks: 1

## Acceptance-To-Validation Matrix

| Acceptance | Implementation proof | Validation commands |
| --- | --- | --- |
| AC1.1 Required scan tools are available where gates require them | `tool.rule-scan` and `tool.security-scan` are in MCP `tools/list`; runtime registry metadata exposes them as audit/runtime-tooling tools; direct calls return inspectable objects | `node --test "tests/mcp-server/mcp-server.test.js"`; `node --test "tests/runtime/runtime-bootstrap.test.js"`; `node --test "tests/runtime/audit-tools.test.js"` |
| AC1.2 Unavailable scan tools fail visibly | Missing Semgrep/invalid path/parse failure cases return `unavailable`, `degraded`, `not_configured`, or `scan_failed` with reason and fallback guidance; invocation wrapper does not record unavailable as successful direct scan | `node --test "tests/runtime/audit-tools.test.js"`; `node --test "tests/mcp-server/mcp-server.test.js"`; `node --test ".opencode/tests/workflow-state-controller.test.js"` |
| AC2.1 Successful scan evidence is captured | Direct scan result includes evidence hint and evidence capture stores `details.scan_evidence` with surface/tool/kind/scope/config/counts/triage/artifacts | `node --test "tests/runtime/runtime-platform.test.js"`; `node --test ".opencode/tests/workflow-state-cli.test.js"`; `node .opencode/workflow-state.js resume-summary --json` |
| AC2.2 Substitute scan evidence is captured separately | Evidence records support `evidence_type: substitute_scan` and retain direct-tool unavailable state separately from what actually ran | `node --test ".opencode/tests/workflow-state-controller.test.js"`; `node --test ".opencode/tests/workflow-state-cli.test.js"` |
| AC3.1 High-volume warnings are summarized before gate decisions | Scan helper groups findings by rule, severity/category, and relevance; reports show group summaries and artifact refs instead of only raw output | `node --test "tests/runtime/audit-tools.test.js"`; `npm run verify:governance` |
| AC3.2 Non-blocking noise remains traceable | `non_blocking_noise` groups require rationale, retain rule/file/count metadata, and remain visible in evidence/read models | `node --test "tests/runtime/audit-tools.test.js"`; `node --test ".opencode/tests/workflow-state-cli.test.js"` |
| AC4.1 False positives require contextual rationale | Gate/report tests require false-positive entries to include rule/finding, file/area, context, rationale, impact, and follow-up decision | `node --test ".opencode/tests/workflow-state-controller.test.js"`; `npm run verify:governance` |
| AC4.2 Test-fixture security placeholders can be non-blocking only with evidence | Security finding fixture can pass only when classified as test-fixture false positive with non-production context and no remaining unclassified/true-positive security findings | `node --test ".opencode/tests/workflow-state-controller.test.js"`; `node --test "tests/runtime/audit-tools.test.js"` |
| AC5.1 Gate decisions use classified scan outcomes | Tier 2 and Tier 3 readiness distinguish direct success, substitutes, classified non-blockers, false positives, blockers, unclassified findings, and missing evidence | `node --test ".opencode/tests/workflow-state-controller.test.js"`; `node .opencode/workflow-state.js show-policy-status`; `node .opencode/workflow-state.js show-dod` |
| AC5.2 Manual overrides are visibly exceptional | Manual override evidence requires target stage, unavailable tool, reason, substitute evidence/limitations, actor/caveat; override cannot replace noisy-finding triage | `node --test ".opencode/tests/workflow-state-controller.test.js"`; `node --test ".opencode/tests/workflow-state-cli.test.js"`; `npm run verify:governance` |
| AC6.1 Code review and QA reports include a scan evidence section | Agent prompts and QA template require scan/tool evidence section with direct status, substitute status, counts, classifications, false positives, overrides, and artifacts | `npm run verify:governance`; `node --test ".opencode/tests/workflow-contract-consistency.test.js"`; `npm run verify:install-bundle` |
| AC6.2 Runtime and operator surfaces preserve validation-surface split | Evidence/read models and docs label OpenKit scans as `runtime_tooling`/`compatibility_runtime`; target-project app validation remains separate | `node --test "tests/runtime/runtime-platform.test.js"`; `node --test "tests/runtime/external-tools.test.js"`; `npm run verify:governance`; `node .opencode/workflow-state.js validate` |
| AC7.1 OpenKit scans do not replace app-native validation | Reports/docs keep OpenKit scan evidence separate from absent app-native build/lint/test commands | `node --test "tests/runtime/external-tools.test.js"`; `npm run verify:governance` |
| AC7.2 Future app-native commands remain independent | External validation tools remain `target_project_app`; scan evidence remains runtime/tooling or code-audit evidence, not replacement build/lint/test evidence | `node --test "tests/runtime/external-tools.test.js"`; `node --test "tests/runtime/runtime-bootstrap.test.js"`; `npm run verify:governance` |

## Integration Checkpoint

Before requesting Code Review, Fullstack should provide a concise evidence note showing:

- Direct MCP exposure for `tool.rule-scan` and `tool.security-scan` was validated.
- Missing/degraded scan tool behavior returns structured availability state and fallback guidance.
- Evidence capture preserves direct/substitute/manual distinction with validation-surface labels.
- Gate policy blocks missing, unclassified, or true-positive unresolved scan findings.
- Manual override tests prove overrides are exceptional and caveated.
- Role/report docs and install-bundle agent copies are synced.
- Targeted tests and `npm run verify:all` results are recorded, or exact environmental blockers are documented.

## Rollback Notes

- Runtime scan changes should roll back together: audit helpers, direct scan tools, MCP schemas, and their tests.
- Evidence/gate changes should roll back together: evidence schema/read model, runtime-guidance gate logic, policy engine, workflow-state CLI output, and tests.
- Prompt/docs changes should roll back together with install-bundle copies. If source prompts are reverted, run `npm run sync:install-bundle` and `npm run verify:install-bundle`.
- Do not hand-edit invocation logs or workflow-state JSON to roll back behavior. Use workflow-state CLI/tool surfaces or revert code/docs changes.
- Do not disable policy enforcement globally to hide scan gate failures; use documented manual override only for genuine tool unavailability or authorized operational exception.

## Reviewer Focus Points

- Confirm direct scan tools are MCP-exposed and callable, not only present in the internal registry.
- Check that unavailable/degraded/not-configured states use the standard vocabulary and include reason/fallback guidance.
- Verify invocation logging does not treat unavailable direct tools as successful invocations.
- Verify the evidence model distinguishes `direct_tool`, `substitute_scan`, and `manual_override`.
- Verify gate logic blocks unclassified findings and true-positive unresolved security findings.
- Verify high-volume quality findings are grouped and triaged rather than dumped or suppressed.
- Verify false-positive security classifications include file/context/rationale/impact, especially for test fixtures.
- Verify manual overrides include target stage, unavailable tool, reason, substitute limitations, actor/caveat, and are not used to avoid noisy-finding triage.
- Verify docs do not claim OpenKit scans are target-project app build/lint/test validation.

## QA Focus Points

- Exercise the direct tool path if available; if unavailable, verify the structured unavailable response and substitute/manual evidence are recorded separately.
- Inspect workflow evidence/runtime summary/closeout surfaces to confirm scan evidence and override caveats survive handoff.
- Validate report sections include direct status, substitute status, finding counts, classification summary, false positives, manual overrides, and artifact references.
- Confirm FEATURE-938 residual risks are addressed: noisy Semgrep quality output is grouped and classified; the test-fixture security placeholder has false-positive rationale; direct tool namespace availability is resolved or structured; manual override caveats remain visible.
- Confirm target-project app-native validation remains unavailable unless real target app commands/configs exist.

## Task Board Recommendation

Create a full-delivery task board for FEATURE-939 because the work crosses runtime tools, workflow-state gates, agent prompts, docs, and tests. Keep `parallel_mode: none` and use the sequential task chain below:

1. `SCAN-TOOLS-AVAILABILITY` — direct MCP exposure and structured scan result contract.
2. `SCAN-EVIDENCE-CAPTURE` — structured evidence capture and runtime read models.
3. `SCAN-GATE-POLICY` — triage/classification and gate/manual override enforcement.
4. `SCAN-REPORTING-DOCS` — role prompts, QA template, operator/maintainer docs, install-bundle sync.
5. `SCAN-FINAL-VALIDATION` — integration validation and evidence closeout.

Recommended task-board settings:

- `parallel_mode`: `none`
- `safe_parallel_zones`: `[]`
- `sequential_constraints`: `SCAN-TOOLS-AVAILABILITY -> SCAN-EVIDENCE-CAPTURE -> SCAN-GATE-POLICY -> SCAN-REPORTING-DOCS -> SCAN-FINAL-VALIDATION`
- `max_active_execution_tracks`: `1`
- Use task `artifact_refs` matching the file lists in each slice.

## Fullstack Handoff

- Implement in the slice order above and use TDD for every runtime/tool/gate change.
- Do not change product scope, lane semantics, stage names, or gate families.
- Do not add hosted scanner dependencies or target-project app commands.
- Preserve raw scan inspectability while keeping human reports summarized.
- Record scan/evidence validation with surface labels before requesting Code Review.
- Do not create commits unless explicitly requested by the user.

## Handoff Recommendation

- `solution_to_fullstack`: **PASS**.
- Reason: the package gives a single recommended technical path, exact impacted file targets, sequential slices, validation commands that exist in this repository, acceptance-to-validation coverage for AC1.1-AC7.2, review/QA focus points, and conservative task-board guidance.
