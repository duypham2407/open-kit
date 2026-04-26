---
artifact_type: solution_package
version: 1
status: ready
feature_id: FEATURE-943
feature_slug: normalize-direct-scan-tools
source_scope_package: docs/scope/2026-04-26-normalize-direct-scan-tools.md
owner: SolutionLead
approval_gate: solution_to_fullstack
handoff_rubric: pass
---

# Solution Package: Normalize Direct Scan Tools

## Source Scope And Approval Context

- Upstream scope: `docs/scope/2026-04-26-normalize-direct-scan-tools.md`.
- Current lane/stage: `full` / `full_solution` for work item `feature-943`.
- Approval context: `product_to_solution` is approved; this package is the `solution_to_fullstack` handoff artifact.
- Scope preservation: this solution normalizes direct scan-tool availability, invocation logging, evidence shape, stale-process caveats, and role-stage UX. It does **not** include FEATURE-942 no-var rule tuning, FEATURE-944 syntax path-resolution fixes, new workflow lanes/gates, hosted scanners, or target-project app-native validation claims.

## Chosen Approach

Use one sequential hardening path: make `tool.rule-scan` and `tool.security-scan` a first-class, inspectable runtime/MCP contract, then align invocation logs, workflow evidence/read models, policy gates, role prompts, docs, and tests around that same contract.

This is enough because the repository already has the core building blocks:

- Semgrep-backed audit tools: `src/runtime/tools/audit/rule-scan.js`, `src/runtime/tools/audit/security-scan.js`, and shared scan helpers in `src/runtime/tools/audit/scan-evidence.js`.
- Runtime tool wrapping and registration: `src/runtime/tools/wrap-tool-execution.js`, `src/runtime/tools/tool-registry.js`, and `src/runtime/create-tools.js`.
- MCP exposure path: `bin/openkit-mcp.js`, `src/mcp-server/index.js`, and `src/mcp-server/tool-schemas.js`.
- Invocation logs and policy gates: `.opencode/lib/invocation-log.js`, `.opencode/lib/policy-engine.js`, `.opencode/lib/runtime-guidance.js`, `.opencode/lib/workflow-state-controller.js`, and `.opencode/workflow-state.js`.
- Structured scan evidence read models from FEATURE-939: `.opencode/lib/scan-evidence-summary.js`, `record-verification-evidence --details-json`, `resume-summary --json`, and closeout summaries.

The work should extend and normalize those existing surfaces instead of adding rescue scripts or another scanner. Direct successful evidence, substitute scan evidence, and manual override evidence must remain visibly different all the way through Fullstack handoff, Code Review, QA, closeout, and workflow-state diagnostics.

## Root Cause Hypotheses From FEATURE-941 / FEATURE-942 / FEATURE-944 Friction

These hypotheses come from the approved scope plus inspected QA artifacts, scan/evidence implementation, MCP exposure, invocation logging, and policy/read-model files. Fullstack should validate or falsify them during Slice 1 before changing gate behavior.

1. **Role/API namespace skew despite checked-in MCP exposure**
   - Checked-in `src/mcp-server/tool-schemas.js` includes `tool.rule-scan` and `tool.security-scan`, and `tests/mcp-server/mcp-server.test.js` already asserts fresh MCP listing/call behavior.
   - FEATURE-941 QA still reported direct scan tools as unavailable/call-timed-out in the QA API namespace and used substitute Semgrep CLI evidence.
   - Likely cause: active role sessions can be attached to a stale MCP/OpenKit process or a tool namespace generated before the direct scan tools were exposed. A fresh MCP server may pass while the already-attached in-session tool set is stale.

2. **Direct runtime scans can run outside the policy-visible invocation path**
   - FEATURE-942 artifacts include direct/source-runtime scan probes and substitute evidence rationale that no successful in-session invocation log entry was available.
   - Likely cause: rescue scripts or direct `bootstrapRuntimeFoundation` harnesses can call scan implementations but bypass the same wrapper/log path that the policy engine reads, so evidence can be semantically direct but not Tier-3 policy-visible.

3. **Invocation log entries are too thin for scan triage and diagnosis**
   - `.opencode/lib/invocation-log.js` currently records `tool_id`, `status`, `stage`, `owner`, `duration_ms`, and `recorded_at`.
   - The log does not preserve scan kind, availability state, result state, target scope summary, finding counts, error/unavailability summary, artifact refs, or stale/namespace-miss status.
   - Policy can determine that a tool ran, but reviewers cannot diagnose whether the direct tool was missing, stale, failed, degraded, high-volume, or merely noisy without separate evidence.

4. **Evidence shape exists but needs stricter normalization at the scan-tool boundary**
   - FEATURE-939 added `details.scan_evidence` read models, classified scan gate behavior, substitute/manual distinctions, and compact summaries.
   - Scan tool results and role outputs still require stage owners to hand-assemble details, which encourages inconsistent fields, raw-output dumping, or backfilling substitute runs as direct evidence.

5. **Stale-process drift is real and must be reported rather than hidden**
   - FEATURE-944 QA showed an already-attached in-session MCP process returning stale path-resolution results while fresh runtime bootstrap and a newly spawned MCP passed.
   - FEATURE-943 should not try to solve every hot-reload scenario. It should make stale runtime/tool registration or package/global drift visible, preserve caveats downstream, and require refresh/restart validation before claiming the active process has the new direct tools.

6. **Global/check-in version drift can confuse capability claims**
   - The active runtime status can report a managed kit version that differs from the checked-in `package.json` version. Treat this as a deployment/session diagnostic, not as proof that direct tools are absent everywhere.
   - Reports should identify the surface being validated: checked-in runtime, active in-session MCP namespace, compatibility runtime, or global installed kit.

## Dependencies

- No new npm package dependency is required.
- No hosted scanner, network-only rule pack, or new app-native build/lint/test command is required.
- Semgrep remains the local/managed scanner behind the direct tools. Missing or unusable Semgrep must produce structured `unavailable`, `degraded`, `not_configured`, or `scan_failed` results with fallback guidance.
- If global packaging surfaces are changed, validate them as `global_cli`; otherwise package/global checks are not required beyond install-bundle sync and documented stale-session caveats.
- Target-project application validation remains unavailable unless a target project defines real app-native commands. OpenKit runtime scans, workflow-state checks, CLI checks, and Semgrep rule-pack tests are not target-project app validation.

## Impacted Surfaces And File Targets

### Runtime audit tools and scan evidence helpers

- `src/runtime/tools/audit/rule-scan.js`
- `src/runtime/tools/audit/security-scan.js`
- `src/runtime/tools/audit/scan-evidence.js`
- `assets/semgrep/packs/quality-default.yml` — read-only for this feature except as scan input; do not tune no-var behavior here.
- `assets/semgrep/packs/security-audit.yml` — read-only for this feature except as scan input.

### Tool wrapper, registry, runtime metadata, and MCP exposure

- `src/runtime/tools/wrap-tool-execution.js`
- `src/runtime/tools/tool-registry.js`
- `src/runtime/create-tools.js`
- `src/runtime/create-runtime-interface.js`
- `src/runtime/capability-registry.js`
- `src/mcp-server/tool-schemas.js`
- `src/mcp-server/index.js`
- `bin/openkit-mcp.js` — likely read-only unless startup/diagnostic wiring needs a wrapper-safe entrypoint note.
- `src/capabilities/mcp-catalog.js` — only if the OpenKit MCP catalog needs explicit scan-tool health/limitations text.

### Invocation log, policy gates, evidence helpers, and read models

- `.opencode/lib/invocation-log.js`
- `.opencode/lib/policy-engine.js`
- `.opencode/lib/runtime-guidance.js`
- `.opencode/lib/workflow-state-controller.js`
- `.opencode/lib/scan-evidence-summary.js`
- `.opencode/lib/runtime-summary.js`
- `.opencode/workflow-state.js`
- `src/runtime/tools/workflow/evidence-capture.js`
- `src/runtime/tools/workflow/runtime-summary.js`
- `src/runtime/tools/workflow/workflow-state.js`

### Role prompts, templates, docs, and derived install bundle

- `agents/fullstack-agent.md`
- `agents/code-reviewer.md`
- `agents/qa-agent.md`
- `assets/install-bundle/opencode/agents/FullstackAgent.md`
- `assets/install-bundle/opencode/agents/CodeReviewer.md`
- `assets/install-bundle/opencode/agents/QAAgent.md`
- `context/core/approval-gates.md`
- `context/core/tool-substitution-rules.md`
- `context/core/runtime-surfaces.md`
- `context/core/project-config.md`
- `context/core/workflow-state-schema.md`
- `docs/templates/qa-report-template.md`
- `docs/operator/semgrep.md`
- `docs/operator/supported-surfaces.md`
- `docs/maintainer/test-matrix.md`
- `docs/kit-internals/04-tools-hooks-skills-and-mcps.md`
- `AGENTS.md` — only if current command/tooling facts change.

### Tests likely involved

- `tests/runtime/audit-tools.test.js`
- `tests/runtime/invocation-logging.test.js`
- `tests/runtime/runtime-bootstrap.test.js`
- `tests/runtime/runtime-platform.test.js`
- `tests/mcp-server/mcp-server.test.js`
- `tests/runtime/governance-enforcement.test.js`
- `tests/runtime/registry-metadata.test.js`
- `tests/semgrep/quality-rules.test.js` — run as regression; do not tune FEATURE-942 rules here.
- `.opencode/tests/workflow-state-controller.test.js`
- `.opencode/tests/workflow-state-cli.test.js`
- `.opencode/tests/workflow-contract-consistency.test.js`
- `tests/cli/openkit-cli.test.js`, `tests/global/doctor.test.js`, and `tests/install/*.test.js` only if package/global install or doctor surfaces are touched.

## Boundaries And Component Decisions

- **Direct scan contract lives at the runtime tool boundary.** `tool.rule-scan` and `tool.security-scan` should return stable structured scan results and a ready-to-record evidence summary. Do not require agents to infer evidence shape from raw Semgrep JSON.
- **MCP exposure must be tested fresh and reported separately from active-session availability.** A fresh spawned MCP server can prove checked-in/runtime exposure, while the active role namespace may still be stale. Both facts must be visible.
- **Invocation log is runtime policy evidence, not the full scan artifact.** Extend it with compact scan metadata and artifact refs, but keep raw high-volume findings out of the log.
- **Workflow evidence remains the gate-readable scan record.** `details.scan_evidence` carries direct/substitute/manual distinction, finding counts, triage groups, false-positive rationale, manual override caveats, validation-surface labels, and artifact refs.
- **Substitute/manual paths remain allowed only for genuine unavailability or unusable output.** This feature should reduce rescue-script reliance; it must not weaken scan gates or let agents avoid classifying noisy but usable findings.
- **No FEATURE-942/FEATURE-944 drift.** Do not tune Semgrep rules and do not modify syntax path-resolution behavior as part of this feature.
- **No target-app overclaim.** OpenKit scan/tool/workflow/package validation is `runtime_tooling`, `compatibility_runtime`, `documentation`, or `global_cli`; never `target_project_app` unless a real target project command exists.

## Interfaces And Data Contracts

### Direct scan result contract

Keep existing direct scan result fields, but normalize the values and add enough compact metadata for evidence generation and invocation logging:

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
    fallback: string | null,
    staleProcessHint?: {
      suspected: boolean,
      surface: 'in_session' | 'runtime_tooling' | 'compatibility_runtime' | 'global_cli' | 'unknown',
      refresh: string
    }
  },
  target: {
    requestedPath: string,
    targetPath: string | null,
    scopeSummary: string,
    targetCount?: number,
    changedFileCount?: number
  },
  ruleConfig: {
    requested: string,
    resolved: string,
    source: 'bundled' | 'custom' | 'external'
  },
  resultState: 'succeeded' | 'failed' | 'unavailable' | 'degraded',
  findingCount: number,
  severitySummary: Record<string, number>,
  triageSummary: {
    groupCount: number,
    blockingCount: number,
    truePositiveCount?: number,
    nonBlockingNoiseCount: number,
    falsePositiveCount: number,
    followUpCount: number,
    unclassifiedCount: number,
    groups: [/* grouped by rule, severity/category, relevance, and classification */]
  },
  falsePositiveSummary: { count: number, items: [] },
  artifactRefs: string[],
  limitations: string[],
  evidenceHint: {
    evidenceType: 'direct_tool',
    source: 'tool.rule-scan' | 'tool.security-scan',
    kind: 'automated',
    validationSurface: 'runtime_tooling'
  }
}
```

Implementation notes:

- Preserve raw `findings` in direct tool result when manageable, but human reports and workflow-state summaries should prefer counts/groups/artifact refs.
- For high-volume output, keep the existing artifact-writing behavior and make the tool result `degraded` or `scan_failed` with artifact refs and limitations, not a silent success.
- `tool.security-scan` should continue wrapping `createRuleScanTool`; changes to shared scan evidence helpers must be covered for both tools.

### Invocation log contract

Extend `.opencode/lib/invocation-log.js` additively. Existing log readers must continue to accept older entries.

Each reached direct scan invocation should write compact metadata such as:

```js
{
  tool_id: 'tool.rule-scan',
  status: 'success' | 'failure' | 'error' | 'unavailable' | 'degraded' | 'unregistered',
  stage: 'full_implementation' | 'full_code_review' | 'full_qa' | null,
  owner: 'FullstackAgent' | 'CodeReviewer' | 'QAAgent' | null,
  duration_ms: number | null,
  recorded_at: string,
  scan_kind: 'rule' | 'security',
  availability_state: 'available' | 'unavailable' | 'degraded' | 'not_configured',
  result_state: 'succeeded' | 'failed' | 'unavailable' | 'degraded',
  target_scope_summary: string,
  finding_counts: { total: number },
  error_summary: string | null,
  artifact_refs: string[],
  evidence_type: 'direct_tool'
}
```

Rules:

- A registered tool that runs and returns `unavailable`, `not_configured`, `invalid_path`, `scan_failed`, or malformed output must be logged as a reached direct-tool attempt, but not as a successful direct scan unless the result is actually usable and classified enough for the gate.
- A tool missing from the role namespace may be recorded only as evidence (`direct_tool.availability_state: unavailable`, reason `not exposed in role/session namespace`) unless the call reaches the OpenKit MCP server as an unknown tool. If the MCP server receives an unknown direct scan tool call, record an `unregistered`/namespace failure where possible.
- Do not store raw high-volume Semgrep output in invocation logs. Store summaries and artifact refs only.

### Workflow evidence schema and triage plan

Use `details.scan_evidence` as the canonical gate-readable scan evidence. Normalize both direct and fallback evidence into this shape:

```js
details: {
  validation_surface: 'runtime_tooling' | 'compatibility_runtime' | 'documentation' | 'global_cli',
  scan_evidence: {
    evidence_type: 'direct_tool' | 'substitute_scan' | 'manual_override',
    direct_tool: {
      tool_id: 'tool.rule-scan' | 'tool.security-scan',
      availability_state: 'available' | 'unavailable' | 'degraded' | 'not_configured',
      result_state: 'succeeded' | 'failed' | 'unavailable' | 'degraded',
      reason: string | null,
      invocation_ref?: {
        work_item_id: string | null,
        entry_id?: string,
        log_path?: string
      },
      namespace_status?: 'callable' | 'not_exposed' | 'unknown_tool' | 'stale_process' | 'not_checked',
      stale_process?: {
        suspected: boolean,
        affected_surface: 'in_session' | 'runtime_tooling' | 'compatibility_runtime' | 'global_cli' | 'unknown',
        caveat: string
      }
    },
    substitute: null | {
      ran: boolean,
      command_or_tool: string,
      validation_surface: 'runtime_tooling',
      limitations: string
    },
    scan_kind: 'rule' | 'security',
    target_scope_summary: string,
    rule_config_source: 'bundled' | 'custom' | 'external',
    finding_counts: {
      total: number,
      blocking: number,
      true_positive: number,
      non_blocking_noise: number,
      false_positive: number,
      follow_up: number,
      unclassified: number
    },
    severity_summary: Record<string, number>,
    triage_summary: {
      groupCount: number,
      blockingCount: number,
      truePositiveCount: number,
      nonBlockingNoiseCount: number,
      falsePositiveCount: number,
      followUpCount: number,
      unclassifiedCount: number,
      groups: [
        {
          groupId: string,
          ruleId: string,
          severity: string,
          category: string,
          relevance: string,
          classification: 'blocking' | 'true_positive' | 'non_blocking_noise' | 'false_positive' | 'follow_up' | 'unclassified',
          count: number,
          sampleLocations: [],
          rationale: string | null,
          trace_ref: string | null,
          resolution: string | null
        }
      ]
    },
    false_positive_summary: {
      count: number,
      items: [
        {
          rule_id: string,
          file: string,
          area?: string,
          context: string,
          rationale: string,
          impact: string,
          security_impact?: string,
          follow_up: string
        }
      ]
    },
    manual_override: null | {
      target_stage: string,
      unavailable_tool: 'tool.rule-scan' | 'tool.security-scan',
      reason: string,
      substitute_evidence_ids: string[],
      substitute_limitations: string,
      actor: string,
      caveat: string
    }
  }
}
```

Triage rules:

- Findings must be grouped by rule, severity/category, relevance to changed work, and affected area before gate decisions.
- Remaining `unclassified`, unresolved `true_positive`, or `blocking` groups block the relevant gate unless explicitly routed as unresolved risk by the proper owner.
- `non_blocking_noise` requires rationale and traceability (`trace_ref`, sample locations, or artifact refs).
- `false_positive` requires rule/finding id, file or area, context, rationale, behavior/security impact, and follow-up decision.
- High-volume raw findings must be stored in artifact refs such as `.openkit/artifacts/...`; reports and read models must summarize counts/groups only.

## Role And Stage UX

### Fullstack pre-review behavior (`full_implementation -> full_code_review`)

- Run/attempt direct `tool.rule-scan` on the changed-file scope before claiming implementation complete.
- Run/attempt direct `tool.security-scan` when the implementation touches auth, input validation, secrets, network, MCP transport, CLI command execution, evidence/policy enforcement, or other security-relevant surfaces.
- Record at least one workflow evidence entry with `details.scan_evidence` before requesting Code Review.
- If direct scan is missing from the role namespace, stale, unavailable, or degraded beyond usable evidence, record that direct status first, then use substitute Semgrep CLI evidence or manual override only with limitations and caveat.
- Do not claim OpenKit scan/tool evidence as `target_project_app` validation.

### Code Reviewer behavior (`full_code_review -> full_qa`)

- Run/attempt direct `tool.rule-scan` and `tool.security-scan` on all changed files before Stage 2 code-quality result.
- Compare Code Reviewer direct results with Fullstack evidence. If Fullstack used substitute/manual evidence because of a stale namespace, Code Reviewer should prefer fresh direct tools when callable and keep the earlier caveat visible.
- Do not approve Stage 2 when any scan evidence has unclassified findings that could affect blocking/security disposition, unresolved `true_positive`, or unresolved `blocking` groups.
- If direct tools are unavailable in Code Reviewer context but substitute evidence is used, preserve direct-tool unavailable/stale status and substitute limitations; do not rewrite the substitute as direct success.

### QA behavior (`full_qa -> full_done`)

- Recheck direct `tool.rule-scan` and `tool.security-scan` where feasible, especially after rework, policy/evidence changes, or stale-process caveats.
- QA may rely on recent direct Code Reviewer evidence only when artifacts, target scope, invocation refs, and caveats are still current; otherwise rerun/reattempt and record fresh evidence.
- Preserve substitute/manual override caveats in the QA report and closeout recommendation.
- Verify workflow-state read models still expose direct/substitute/manual distinctions, grouped triage, false positives, validation-surface labels, artifact refs, and stale-process caveats.
- QA must keep `target_project_app` validation unavailable unless a real target project command exists.

## Recommended Path

- Execute all slices sequentially.
- Use test-first implementation for runtime/tool/wrapper/policy/read-model changes.
- Start with the direct tool contract and fresh MCP exposure tests, because evidence and policy behavior depends on knowing whether direct tools are callable.
- Extend invocation logging before tightening policy so policy failures are diagnosable.
- Update role/docs only after runtime/evidence contracts are stable, then run install-bundle sync.

## Implementation Slices

### [ ] Slice 1: Direct scan contract and capability status

- **Files**:
  - `src/runtime/tools/audit/rule-scan.js`
  - `src/runtime/tools/audit/security-scan.js`
  - `src/runtime/tools/audit/scan-evidence.js`
  - `src/runtime/tools/tool-registry.js`
  - `src/runtime/create-tools.js`
  - `src/runtime/create-runtime-interface.js`
  - `src/runtime/capability-registry.js`
  - `tests/runtime/audit-tools.test.js`
  - `tests/runtime/runtime-bootstrap.test.js`
  - `tests/runtime/runtime-platform.test.js`
- **Goal**: make direct rule/security scan results self-describing enough to produce consistent evidence and capability/status reports without rescue scripts.
- **Dependencies**: none.
- **Test-first expectations**:
  - Add/adjust tests for direct `available`, `unavailable`, `degraded` high-volume, `not_configured`, `invalid_path`, `scan_failed`, exit-code-1-with-findings, malformed JSON, and security-wrapper default config behavior.
  - Assert scan results include `validationSurface: runtime_tooling`, `direct_tool` evidence hints, finding counts, grouped `triageSummary.groups`, false-positive summary, artifact refs, and limitations without raw high-volume dumping.
  - Assert runtime/tool metadata identifies both tools with standard capability states.
- **Validation Commands**:
  - `node --test "tests/runtime/audit-tools.test.js"`
  - `node --test "tests/runtime/runtime-bootstrap.test.js"`
  - `node --test "tests/runtime/runtime-platform.test.js"`
  - `npm run verify:runtime-foundation`
- **Reviewer focus**:
  - Confirm no FEATURE-942 no-var rule tuning is included.
  - Confirm missing Semgrep returns structured unavailability and does not masquerade as success.

### [ ] Slice 2: MCP exposure and role/session namespace diagnostics

- **Files**:
  - `src/mcp-server/tool-schemas.js`
  - `src/mcp-server/index.js`
  - `bin/openkit-mcp.js` (likely read-only)
  - `src/capabilities/mcp-catalog.js` (only if docs/status text must be machine-readable)
  - `tests/mcp-server/mcp-server.test.js`
  - `tests/runtime/mcp-catalog.test.js` (only if catalog metadata changes)
- **Goal**: prove fresh OpenKit MCP exposes and calls both direct scan tools, and make unknown/stale namespace failures diagnosable instead of hidden behind substitute evidence.
- **Dependencies**: Slice 1 direct scan contract.
- **Test-first expectations**:
  - Keep/strengthen `tools/list` assertions that both scan tools are exposed.
  - Add call tests for both `tool.rule-scan` and `tool.security-scan` with missing Semgrep producing structured unavailable results.
  - Add a spawned-MCP smoke that proves a fresh server can call scan tools and returns JSON with direct-tool evidence hints.
  - If MCP unknown direct scan calls can reach `src/mcp-server/index.js`, add a test that the server returns an `unregistered`/unknown status and logs or surfaces the namespace miss distinctly.
- **Validation Commands**:
  - `node --test "tests/mcp-server/mcp-server.test.js"`
  - `node --test "tests/runtime/mcp-catalog.test.js"` only if `src/capabilities/mcp-catalog.js` changes.
- **Reviewer focus**:
  - Distinguish fresh MCP exposure from already-attached role namespace staleness.
  - Do not add a separate scanner or CLI-first path as the primary contract.

### [ ] Slice 3: Invocation logging normalization

- **Files**:
  - `src/runtime/tools/wrap-tool-execution.js`
  - `.opencode/lib/invocation-log.js`
  - `.opencode/lib/policy-engine.js`
  - `.opencode/lib/workflow-state-controller.js`
  - `.opencode/workflow-state.js`
  - `tests/runtime/invocation-logging.test.js`
  - `.opencode/tests/workflow-state-controller.test.js`
  - `.opencode/tests/workflow-state-cli.test.js`
- **Goal**: every reached direct scan invocation leaves an inspectable log entry with enough scan metadata for policy diagnostics, while missing role namespace remains recorded as evidence/status rather than a fake direct invocation.
- **Dependencies**: Slices 1-2.
- **Test-first expectations**:
  - Add wrapper/log tests for successful direct scans, direct unavailable, direct degraded, direct scan failure, thrown errors, async errors, stage/owner tracking, and dynamic work-item log paths.
  - Add tests that invocation entries include compact `scan_kind`, `availability_state`, `result_state`, `target_scope_summary`, `finding_counts`, `error_summary`, and `artifact_refs` for scan tools.
  - Add tests that unavailability/failure attempts are logged as attempts but are not counted as successful direct invocations for Tier 3 unless structured substitute/manual evidence legitimately satisfies policy.
  - Add `show-invocations` output/read-model tests that show status, stage/owner, result state, and target summary without dumping raw findings.
- **Validation Commands**:
  - `node --test "tests/runtime/invocation-logging.test.js"`
  - `node --test ".opencode/tests/workflow-state-controller.test.js"`
  - `node --test ".opencode/tests/workflow-state-cli.test.js"`
  - `node .opencode/workflow-state.js show-invocations feature-943` after implementation evidence exists.
- **Reviewer focus**:
  - Invocation logging must stay best-effort for tool execution resilience, but policy/readiness must expose missing logs clearly.
  - Do not hand-edit invocation logs as implementation evidence.

### [ ] Slice 4: Evidence read models and policy gate integration

- **Files**:
  - `src/runtime/tools/audit/scan-evidence.js`
  - `src/runtime/tools/workflow/evidence-capture.js`
  - `src/runtime/tools/workflow/runtime-summary.js`
  - `src/runtime/tools/workflow/workflow-state.js`
  - `.opencode/lib/scan-evidence-summary.js`
  - `.opencode/lib/runtime-guidance.js`
  - `.opencode/lib/policy-engine.js`
  - `.opencode/lib/workflow-state-controller.js`
  - `.opencode/lib/runtime-summary.js`
  - `.opencode/workflow-state.js`
  - `context/core/workflow-state-schema.md`
  - `context/core/approval-gates.md`
  - `context/core/runtime-surfaces.md`
  - `context/core/project-config.md`
  - `.opencode/tests/workflow-state-controller.test.js`
  - `.opencode/tests/workflow-state-cli.test.js`
- **Goal**: make workflow evidence and gate checks consume normalized `details.scan_evidence` consistently across direct, substitute, manual, stale, and high-volume cases.
- **Dependencies**: Slice 3 invocation metadata and Slice 1 scan result contract.
- **Test-first expectations**:
  - Add read-model tests for direct scan evidence with invocation refs and artifact refs.
  - Add substitute evidence tests where direct status is unavailable/stale and substitute limitations remain visible.
  - Add manual override tests requiring target stage, unavailable tool, reason, substitute evidence ids/limitations, actor, and caveat.
  - Add stale-process caveat tests showing caveat survives `resume-summary --json`, `show`, closeout summary, and QA report guidance.
  - Add gate tests that block unclassified findings, unresolved true-positive/security findings, malformed false positives, and manual overrides that try to bypass usable noisy findings.
- **Validation Commands**:
  - `node --test ".opencode/tests/workflow-state-controller.test.js"`
  - `node --test ".opencode/tests/workflow-state-cli.test.js"`
  - `node .opencode/workflow-state.js show-policy-status`
  - `node .opencode/workflow-state.js validate`
- **Reviewer focus**:
  - Keep old evidence records backward-compatible.
  - Preserve `direct_tool`, `substitute_scan`, and `manual_override` distinctions in all summaries.
  - Do not weaken existing classified scan gates.

### [ ] Slice 5: Role prompts, templates, docs, and install-bundle sync

- **Files**:
  - `agents/fullstack-agent.md`
  - `agents/code-reviewer.md`
  - `agents/qa-agent.md`
  - `assets/install-bundle/opencode/agents/FullstackAgent.md`
  - `assets/install-bundle/opencode/agents/CodeReviewer.md`
  - `assets/install-bundle/opencode/agents/QAAgent.md`
  - `context/core/tool-substitution-rules.md`
  - `docs/templates/qa-report-template.md`
  - `docs/operator/semgrep.md`
  - `docs/operator/supported-surfaces.md`
  - `docs/maintainer/test-matrix.md`
  - `docs/kit-internals/04-tools-hooks-skills-and-mcps.md`
  - `AGENTS.md` only if command reality/current state changes.
  - `tests/runtime/governance-enforcement.test.js`
  - `.opencode/tests/workflow-contract-consistency.test.js`
- **Goal**: make Fullstack, Code Reviewer, and QA role outputs use the same direct/substitute/manual/stale scan evidence language and target-project validation boundary.
- **Dependencies**: Slices 1-4.
- **Test-first expectations**:
  - Governance tests should require direct scan path, substitute/manual limits, stale-process caveat language, grouped triage, false-positive requirements, validation-surface labels, artifact refs, and target-project validation boundary.
  - Contract tests should keep docs/runtime expectations aligned.
  - Install-bundle verification should prove derived agent prompts match source prompts.
- **Validation Commands**:
  - `npm run sync:install-bundle`
  - `npm run verify:install-bundle`
  - `npm run verify:governance`
  - `node --test ".opencode/tests/workflow-contract-consistency.test.js"`
- **Reviewer focus**:
  - Role docs should not tell agents to use substitute/manual evidence when direct tools are available and usable.
  - QA template should preserve caveats rather than turning them into closure success claims.

### [ ] Slice 6: Integration validation and closeout evidence

- **Files**:
  - `package.json` — read-only for command reality unless validation scripts genuinely change.
  - `.opencode/work-items/feature-943/tool-invocations.json` — runtime-produced only; do not hand-edit.
  - Managed workflow state / compatibility mirror — use workflow-state CLI or `tool.evidence-capture`, not manual JSON edits.
  - `docs/qa/2026-04-26-normalize-direct-scan-tools.md` — QA-created later, not Fullstack-created.
- **Goal**: prove the full path from direct scan invocation to invocation log, structured evidence, gate policy, role output, and QA-readable summaries.
- **Dependencies**: Slices 1-5.
- **Validation Commands**:
  - `node --test "tests/runtime/audit-tools.test.js"`
  - `node --test "tests/runtime/invocation-logging.test.js"`
  - `node --test "tests/mcp-server/mcp-server.test.js"`
  - `node --test "tests/runtime/runtime-bootstrap.test.js"`
  - `node --test "tests/runtime/runtime-platform.test.js"`
  - `node --test ".opencode/tests/workflow-state-controller.test.js"`
  - `node --test ".opencode/tests/workflow-state-cli.test.js"`
  - `npm run verify:semgrep-quality`
  - `npm run verify:governance`
  - `npm run verify:runtime-foundation`
  - `npm run verify:install-bundle`
  - `npm run verify:all`
  - `node .opencode/workflow-state.js validate`
  - `node .opencode/workflow-state.js show-invocations feature-943`
  - `node .opencode/workflow-state.js show-policy-status`
  - `openkit doctor` only if global/package surfaces were changed or if validating stale global install drift as `global_cli`.
- **Reviewer focus**:
  - If `npm run verify:all` or Semgrep-dependent validation is environmentally blocked, record exact blocker and strongest targeted passing checks. Do not convert skipped Semgrep or OpenKit runtime checks into target-app validation.
  - Fullstack handoff must include direct scan evidence or explicit direct-tool unavailability/stale caveat with substitute/manual details.

## Dependency Graph

- `src/runtime/tools/audit/security-scan.js` depends on `createRuleScanTool`; shared scan evidence changes must be validated for both tools.
- `src/runtime/tools/tool-registry.js` registers audit tools; MCP exposure additionally depends on `src/mcp-server/tool-schemas.js` and `src/mcp-server/index.js` filtering to exposed IDs.
- `src/runtime/tools/wrap-tool-execution.js` and `.opencode/lib/invocation-log.js` determine whether direct calls are policy-visible.
- `.opencode/lib/policy-engine.js` consumes invocation logs; `.opencode/lib/runtime-guidance.js` consumes structured evidence; both must agree on what can satisfy a gate.
- `.opencode/lib/scan-evidence-summary.js`, `.opencode/workflow-state.js`, and runtime workflow tools expose evidence to Code Review, QA, and closeout.
- Role prompts/docs depend on the final runtime/evidence contract; update them after Slices 1-4.

Critical path:

`DIRECT-SCAN-CONTRACT -> MCP-ROLE-DIAGNOSTICS -> INVOCATION-LOG-NORMALIZATION -> EVIDENCE-POLICY-READMODELS -> ROLE-DOCS-SYNC -> INTEGRATION-VALIDATION`

## Parallelization Assessment

- parallel_mode: `none`
- why: all slices share the same audit result contract, invocation log metadata, `details.scan_evidence` schema, gate policy semantics, and role/reporting language. Parallel implementation would risk incompatible fields or docs claiming behavior before runtime/policy supports it.
- safe_parallel_zones: []
- sequential_constraints:
  - `DIRECT-SCAN-CONTRACT -> MCP-ROLE-DIAGNOSTICS -> INVOCATION-LOG-NORMALIZATION -> EVIDENCE-POLICY-READMODELS -> ROLE-DOCS-SYNC -> INTEGRATION-VALIDATION`
- integration_checkpoint: after Slice 4, run runtime audit, invocation logging, MCP, workflow-state controller, and workflow-state CLI tests together before touching role/docs language.
- max_active_execution_tracks: 1

## Validation Matrix

| Acceptance target | Proof path | Commands / checks |
| --- | --- | --- |
| Direct `tool.rule-scan` callable or structured unavailable in required contexts | Runtime tool result contract, fresh MCP list/call, role evidence status | `node --test "tests/runtime/audit-tools.test.js"`; `node --test "tests/mcp-server/mcp-server.test.js"`; role handoff evidence |
| Direct `tool.security-scan` callable or structured unavailable in required contexts | Security wrapper result contract, fresh MCP list/call, Code Review/QA evidence | `node --test "tests/runtime/audit-tools.test.js"`; `node --test "tests/mcp-server/mcp-server.test.js"` |
| Missing namespace distinguished from execution failure | MCP unknown/missing tests where reachable; evidence schema `namespace_status`; stale caveats | `node --test "tests/mcp-server/mcp-server.test.js"`; `node --test ".opencode/tests/workflow-state-cli.test.js"` |
| Direct reached invocations are logged | Wrapper and invocation-log tests include compact scan metadata | `node --test "tests/runtime/invocation-logging.test.js"`; `node .opencode/workflow-state.js show-invocations feature-943` |
| Substitute scans remain separate | `details.scan_evidence.evidence_type: substitute_scan`; read-model and gate tests | `node --test ".opencode/tests/workflow-state-cli.test.js"`; `node --test ".opencode/tests/workflow-state-controller.test.js"` |
| Manual overrides remain exceptional | Manual override schema/policy tests; docs/governance language | `node --test ".opencode/tests/workflow-state-controller.test.js"`; `npm run verify:governance` |
| Grouped triage required | Gate blocks unclassified findings; summaries expose `triage_summary.groups` | `node --test "tests/runtime/audit-tools.test.js"`; `node --test ".opencode/tests/workflow-state-controller.test.js"` |
| False-positive rationale required | False-positive gate/read-model tests include rule/file/context/impact/rationale/follow-up | `node --test ".opencode/tests/workflow-state-controller.test.js"`; `npm run verify:governance` |
| Stale process caveats persist | Evidence/read-model tests and QA template preserve stale caveat | `node --test ".opencode/tests/workflow-state-cli.test.js"`; `npm run verify:governance` |
| Role/stage UX aligned | Agent prompts and install bundle synced | `npm run sync:install-bundle`; `npm run verify:install-bundle`; `npm run verify:governance` |
| Surface labels remain honest | Runtime/workflow/doc/global labels separated; no target app overclaim | `node .opencode/workflow-state.js validate`; `npm run verify:governance`; QA report review |

## Task Board Recommendation

Create a full-delivery task board for FEATURE-943 after `solution_to_fullstack` approval because implementation crosses runtime tools, MCP, workflow-state policy, docs, prompts, and tests. Keep `parallel_mode: none`.

Recommended tasks:

1. `DIRECT-SCAN-CONTRACT` — normalize direct scan result/evidence helper contract.
2. `MCP-ROLE-DIAGNOSTICS` — prove fresh MCP exposure and namespace/stale diagnostics.
3. `INVOCATION-LOG-NORMALIZATION` — extend wrapper/log entries and policy-visible scan metadata.
4. `EVIDENCE-POLICY-READMODELS` — normalize `details.scan_evidence`, read models, and gate behavior.
5. `ROLE-DOCS-SYNC` — update Fullstack/Code Reviewer/QA prompts, templates, docs, and install bundle.
6. `INTEGRATION-VALIDATION` — run targeted and full OpenKit validation, record evidence, and prepare Code Review handoff.

Recommended commands to create the board rows when the implementation owner is ready:

```bash
node .opencode/workflow-state.js create-task feature-943 DIRECT-SCAN-CONTRACT "Normalize direct scan result and evidence helper contract" implementation
node .opencode/workflow-state.js create-task feature-943 MCP-ROLE-DIAGNOSTICS "Verify MCP scan exposure and stale namespace diagnostics" implementation
node .opencode/workflow-state.js create-task feature-943 INVOCATION-LOG-NORMALIZATION "Normalize direct scan invocation log metadata" implementation
node .opencode/workflow-state.js create-task feature-943 EVIDENCE-POLICY-READMODELS "Normalize scan evidence read models and policy gates" implementation
node .opencode/workflow-state.js create-task feature-943 ROLE-DOCS-SYNC "Align role prompts docs templates and install bundle" documentation
node .opencode/workflow-state.js create-task feature-943 INTEGRATION-VALIDATION "Run integration validation and record handoff evidence" verification
node .opencode/workflow-state.js validate-work-item-board feature-943
```

Recommended task-board settings to mirror this package:

- `parallel_mode`: `none`
- `safe_parallel_zones`: `[]`
- `sequential_constraints`: `DIRECT-SCAN-CONTRACT -> MCP-ROLE-DIAGNOSTICS -> INVOCATION-LOG-NORMALIZATION -> EVIDENCE-POLICY-READMODELS -> ROLE-DOCS-SYNC -> INTEGRATION-VALIDATION`
- `max_active_execution_tracks`: `1`
- Attach task artifact refs according to the file lists in each slice during implementation handoff.

## Integration Checkpoint

Before requesting Code Review, Fullstack should provide one concise evidence bundle showing:

- Fresh runtime and fresh MCP direct calls for `tool.rule-scan` and `tool.security-scan`, or structured unavailable/stale status with limitations.
- Per-work-item invocation log entries for reached direct scan attempts with scan kind, result state, target summary, counts, and artifact refs.
- Workflow evidence records using `details.scan_evidence` for direct/substitute/manual cases, including grouped `triage_summary.groups`.
- `show-invocations`, `show-policy-status`, `resume-summary --json`, and closeout/readiness surfaces preserve direct/substitute/manual/stale distinctions.
- Role prompts and QA template are synced into `assets/install-bundle/...`.
- Targeted tests and full package validation results are recorded, with any environmental blockers stated exactly.
- `target_project_app` validation remains unavailable for this OpenKit feature unless a real target project command exists.

## Rollback Notes

- Roll back audit result/evidence helper changes together with `tests/runtime/audit-tools.test.js`.
- Roll back wrapper/invocation-log/policy changes together with `tests/runtime/invocation-logging.test.js`, `.opencode/tests/workflow-state-controller.test.js`, and `.opencode/tests/workflow-state-cli.test.js`.
- Roll back MCP exposure/diagnostic changes together with `tests/mcp-server/mcp-server.test.js`.
- Roll back role prompt/docs changes together, then rerun `npm run sync:install-bundle` and `npm run verify:install-bundle` so derived install-bundle files do not drift.
- Do not roll back by disabling scan gates, setting policy enforcement to `off`, hand-editing invocation logs, or converting substitute evidence into direct successes.
- If global install/package surfaces are changed and must be rolled back, validate both checked-in runtime and `global_cli` surfaces separately and document restart/reinstall requirements.

## Risks And Mitigations

- **Stale active sessions may still lack new tools after implementation.** Mitigation: validate fresh MCP/runtime behavior and require role reports to label active-session staleness with affected surface and restart/refresh action.
- **Invocation log schema changes could break existing logs.** Mitigation: add fields additively and keep readers tolerant of older entries.
- **Policy could become too permissive if substitute/manual evidence satisfies Tier 3 too broadly.** Mitigation: only structured substitute/manual evidence with direct-tool unavailable/degraded/stale status, limitations, and classified findings may satisfy policy; available noisy findings must be triaged.
- **High-volume Semgrep output could bloat state/logs.** Mitigation: summaries and artifact refs only in logs/read models; raw output stays under `.openkit/artifacts/...`.
- **Role docs could overstate direct availability.** Mitigation: wording must say direct tools are required when available and must record structured unavailable/stale status when not callable.
- **Feature drift into FEATURE-942 or FEATURE-944.** Mitigation: review diff for rule-pack tuning and syntax path-resolution changes; reject unless separately approved.

## Reviewer Focus Points

- Confirm `tool.rule-scan` and `tool.security-scan` remain direct OpenKit runtime/MCP tools, not rescue scripts.
- Confirm fresh MCP exposure and active role namespace caveats are reported separately.
- Confirm invocation logs distinguish successful direct runs from unavailable/degraded/failed attempts and include compact scan metadata.
- Confirm `details.scan_evidence` is the gate-readable schema and includes direct tool status, counts, `triage_summary.groups`, false positives, overrides, validation surfaces, and artifact refs.
- Confirm unclassified, unresolved true-positive, and blocking scan groups still block required gates.
- Confirm substitute/manual evidence is allowed only for genuine direct-tool unavailability, stale registration, unusable output, or explicit operational exception.
- Confirm docs and reports do not claim OpenKit validation as target-project application build/lint/test proof.

## QA Focus Points

- Attempt direct scan tools in QA context; if stale/unavailable, verify the caveat and substitute/manual evidence stay visible.
- Recheck workflow-state read models: `resume-summary --json`, `show`, `closeout-summary`, `show-invocations`, and `show-policy-status`.
- Confirm QA report includes grouped scan triage, false-positive rationale, manual override caveats, validation-surface labels, and artifact refs without raw high-volume dumping.
- Confirm no FEATURE-942 no-var tuning or FEATURE-944 syntax path fix is included.
- Confirm target-project app validation remains unavailable for this OpenKit repository feature.

## Handoff Recommendation

- `solution_to_fullstack`: **PASS**.
- Reason: this package gives one recommended technical path, exact affected surfaces, sequential slices, validation commands that exist in the repository, task-board guidance, evidence schema/triage rules, role/stage UX, risks, rollback notes, and explicit non-goals for FEATURE-942, FEATURE-944, weakened gates, and target-project validation overclaims.
