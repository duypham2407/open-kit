# Runtime Surfaces

Use this file to keep the product path, in-session path, and compatibility runtime path distinct.

## Surface Summary

- product path (`global_cli`): `npm install -g @duypham93/openkit`, `openkit doctor`, `openkit run`, `openkit upgrade`, `openkit uninstall`
- in-session path (`in_session`): `/task`, `/quick-task`, `/migrate`, `/delivery`, and related workflow commands inside OpenCode
- compatibility runtime path (`compatibility_runtime`): `node .opencode/workflow-state.js ...` for lower-level state inspection and maintainer diagnostics
- runtime tooling path (`runtime_tooling`): OpenKit tools for workflow state, evidence, graph, semantic search, syntax, AST, codemod, audit, browser, MCP, background execution, and external-tool probes
- documentation path (`documentation`): roadmap, operator, maintainer, governance, and runbook artifacts
- target application path (`target_project_app`): app build, lint, and test commands only when the target project defines them

## Which Questions Each Surface Answers

- product path: is OpenKit installed, healthy, and ready to launch?
- in-session path: which lane should the work follow and what should the team do next?
- compatibility runtime path: what does the workflow state say right now, and is the runtime internally consistent?
- runtime tooling path: which OpenKit capabilities are available, degraded, preview-only, compatibility-only, unavailable, or not configured?
- documentation path: what is the current contract, command reality, artifact expectation, or validation policy?
- target application path: did the actual target application pass its own declared build, lint, test, smoke, or regression checks?

## Capability Status Vocabulary

Use this vocabulary consistently in runtime summaries, command docs, and handoff evidence:

| State | Meaning |
| --- | --- |
| `available` | Implemented and required dependencies/configuration are present. |
| `unavailable` | Not usable in the current environment. |
| `degraded` | Usable through fallback behavior or with reduced accuracy/scope. |
| `preview` | Implemented as an early or partial surface whose limitations must be visible. |
| `compatibility_only` | Available for repository-local compatibility or maintainer diagnostics, not the preferred operator product path. |
| `not_configured` | Implemented but disabled because required local config or provider settings are absent. |

Do not invent alternate labels for the same states. If a command or tool is documented as current, verify it exists in `package.json`, `bin/openkit.js`, `.opencode/workflow-state.js`, or checked-in runtime command surfaces. Future examples must be labeled illustrative or planned.

## Path Rule

- in globally installed sessions, OpenKit-owned compatibility files live under `.opencode/openkit/`
- in the checked-in authoring repository, the source files live at repo root and the checked-in runtime lives under `.opencode/`
- workflow-state storage may live under the OpenCode home workspace path while the compatibility surface is mirrored into the project-local `.opencode/openkit/` area
- the canonical managed work-item store remains `.opencode/work-items/`; any `.opencode/openkit/work-items/` path is a compatibility bridge, not a separate source of truth

## Doctor Split

- `openkit doctor` checks global install and workspace readiness
- `node .opencode/workflow-state.js doctor` checks runtime files, compatibility mirror alignment, state integrity, and task-board validity
- `openkit upgrade` and `openkit uninstall` are product lifecycle commands on the `global_cli` surface; workflow-state commands do not refresh or remove the global kit
- `openkit install` and `openkit install-global` remain manual or compatibility setup helpers when exposed by the CLI, not preferred onboarding commands

## Resume Split

- `openkit doctor` is the right answer before launch
- `node .opencode/workflow-state.js resume-summary` is the right answer once workflow state already exists and you need the next safe action
- `node .opencode/workflow-state.js resume-summary --json` exposes the same read model with explicit `validation_surfaces` labels, including `global_cli`, `compatibility_runtime`, `runtime_tooling`, and `target_project_app`
- session-start emits `<openkit_capability_guidance>` as a compact startup snapshot, and runtime resume/status surfaces may expose the same guidance as `capability_guidance` / `capabilityGuidanceLines`; it is advisory route guidance and can become stale until refreshed explicitly
- scan evidence read models expose compact `details.scan_evidence` summaries with direct/substitute/manual-override distinctions, finding/classification/false-positive counts, caveats, and artifact refs without dumping raw high-volume findings
- supervisor dialogue read models in `status` and `resume-summary --json` are `compatibility_runtime` surfaces; they expose OpenClaw/OpenKit supervisor health, pending/delivered/failed/skipped delivery counts, last adjudication, authority rejection counts, duplicate counts, and attention state, and report an absent store as unavailable rather than throwing
- FEATURE-940 review and QA reporting must use FEATURE-940 artifacts as delivery proof; FEATURE-937 may be cited only as historical risk context
- resume output should distinguish blocking state such as pending approvals, unresolved issues, invalid boards, or missing evidence from informational state such as linked artifacts, active work item id, and recommended read-next files

## Validation Split

- `openkit doctor` validates the `global_cli` surface.
- `openkit doctor` also reports OpenKit command permission policy health on the `global_cli` surface: canonical policy source readability, strict-schema-safe global kit/profile permission projection, confirm-required dangerous entry coverage, routine allow projection, legacy invalid OpenKit-only metadata drift, and degraded upstream support caveats when OpenCode cannot be proven to honor default-allow plus exception semantics.
- `node .opencode/workflow-state.js doctor`, `status`, `resume-summary`, `show`, and `validate` validate the `compatibility_runtime` surface.
- In-session tool results validate `runtime_tooling` only when the tool actually ran and reports its status honestly.
- Workflow-state runtime tools such as `tool.workflow-state`, `tool.runtime-summary`, and `tool.evidence-capture` are compatibility-runtime inspection and evidence surfaces even though they are exposed inside the runtime tool layer.
- Capability guidance generated by session-start, runtime-summary, or `tool.capability-router` summary calls validates OpenKit capability metadata/read models (`global_cli`, `runtime_tooling`, or stored `compatibility_runtime` depending on where it is observed). It does not load skills, execute MCPs, approve gates, or validate `target_project_app` behavior.
- Rule/security scan results are `runtime_tooling` evidence when the OpenKit runtime scan tool or substitute scanner actually ran; preserving or reading that evidence through workflow state is `compatibility_runtime` evidence. Neither is target-project app-native build/lint/test evidence.
- Supervisor dialogue manager/config health belongs to `runtime_tooling`; disabled or unconfigured supervisor dialogue is `not_configured` and non-fatal, while persisted supervisor read models remain `compatibility_runtime`.
- Supervisor dialogue QA evidence for FEATURE-940 must cover health, outbound statuses, inbound dispositions, authority-boundary rejection, duplicate/repeated proposal outcomes, degraded/offline scenarios, and proof that inbound OpenClaw messages caused no workflow mutation beyond supervisor dialogue records.
- FEATURE-939 scan/tool evidence remains required where applicable and must stay distinct from FEATURE-940 supervisor dialogue behavior evidence.
- Documentation checks and governance tests validate the `documentation` surface.
- Install-bundle/source synchronization, including derived bundled skill metadata, validates the `package` surface.
- Command permission policy package checks validate the `package` surface when they prove `assets/default-command-permission-policy.json` is shipped and synchronized with generated strict OpenCode config permission projections; these checks still do not prove target-project application behavior.
- Target-project build/lint/test validation belongs to `target_project_app` only when the target project defines those commands.
- If target-project app-native commands are absent, record that validation path as unavailable. Do not replace it with OpenKit runtime checks.

## Runtime Depth

- session tooling: runtime session history, targeted session search, and resumability analysis live in the additive runtime layer
- continuation tooling: start, handoff, stop, and status are runtime controls only; they do not approve gates or advance workflow stages
- browser verification: `/browser-verify` and browser-oriented runtime tools plan verification and evidence capture, but they do not declare QA complete
- LSP, AST, and safer-edit tooling are additive execution aids; they must stay honest about degraded or preview-only status when full external dependencies are unavailable
- AST tooling should prefer structural search semantics and expose whether execution is using AST-Grep-backed capability detection or a narrower JSON/JSONC fallback path
- Syntax tooling should expose supported languages, outline/context/locate semantics, and any unsupported-language fallback clearly rather than pretending all files are parseable
- Semantic search and graph tools should expose dependency/config/indexing limitations: no database or missing native module is `unavailable`, missing embeddings can be `degraded` to keyword behavior, and disabled embedding providers are `not_configured`.
- Browser and background execution surfaces are runtime aids. They may produce evidence or progress visibility, but they do not approve gates, declare QA complete, or imply unrestricted parallel safety.

## Capability Status Envelope

Hardened capability read models should align around these fields when reporting readiness, even when an older command keeps its existing output shape:

```text
CapabilityStatus {
  id
  label
  family: mcp | custom_mcp | code_intelligence | workflow | scan | browser | background | external_tool
  surface: global_cli | in_session | compatibility_runtime | runtime_tooling | documentation | package | target_project_app
  state: available | unavailable | degraded | preview | compatibility_only | not_configured
  source
  freshness: fresh | startup_snapshot | cached | stale | unknown
  evidenceRefs
  caveats
  nextActions
}
```

This envelope is an inspectability convention, not a new authority model. It must not serialize raw secrets, token values, headers, provider payloads, or full environment maps. Capability summaries may guide tool choice, diagnostics, routing recommendations, and evidence interpretation, but they do not load skills, execute MCP tools, approve gates, mutate workflow state, declare QA complete, or change the three-lane workflow contract.

FEATURE-950 phase completion evidence uses workflow verification evidence with `details.phase_completion` fields for completed slices, acceptance criteria, validation surfaces, commands/tools run, unavailable validation paths, unresolved blockers, and downstream unlock decision. These records document the approved phase order; they do not introduce new runtime stages or approval gates.
