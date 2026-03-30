# Hybrid Runtime RFC

Status: accepted for implementation

## Summary

OpenKit keeps the workflow kernel it already has and adds a capability runtime beside it.

The workflow kernel remains the source of truth for:

- lane selection
- stage ownership
- approval gates
- artifact readiness
- issue routing
- verification evidence
- release and hotfix governance

The new capability runtime is responsible for:

- runtime configuration loading
- capability registration
- manager lifecycle
- tool registration
- hook composition
- MCP integration
- category and specialist runtime selection
- recovery and diagnostics

This RFC adopts a clean-room implementation strategy inspired by external systems with stronger runtime surfaces, while preserving OpenKit's explicit workflow law.

## Goals

- Preserve the current `quick`, `migration`, and `full` workflow contract.
- Add a runtime bootstrap pipeline that is explicit and testable.
- Make capability growth additive and config-gated.
- Keep `.opencode/workflow-state.js` and `.opencode/lib/*` as the workflow kernel.
- Allow future runtime features such as MCP, background execution, and specialist agents without flattening role boundaries.

## Non-goals

- Replacing the workflow kernel with a monolithic autonomous orchestrator.
- Hiding state transitions behind implicit runtime behavior.
- Treating execution categories as substitutes for workflow modes.
- Copying external runtime code or prompts directly into OpenKit.

## Architecture Layers

### 1. Workflow Kernel

Current sources:

- `context/core/workflow.md`
- `agents/*.md`
- `commands/*.md`
- `skills/*.md`
- `.opencode/workflow-state.js`
- `.opencode/lib/*`

Responsibilities:

- defines the delivery contract
- records state transitions
- validates approvals, artifacts, issues, and evidence

### 2. Capability Runtime

Current implementation starts under `src/runtime/`.

Responsibilities:

- bootstrap runtime configuration
- create managers, tools, and hooks
- expose runtime capability metadata
- provide runtime diagnostics
- layer runtime metadata into OpenCode launch environments

### 3. Product Surface

Current sources:

- `openkit run`
- `openkit doctor`
- `openkit install-global`
- global install metadata and materialization

Responsibilities:

- end-user installation and launch
- operator-facing diagnostics
- workspace bootstrap and compatibility surface management

## Runtime Bootstrap Contract

The capability runtime follows this bootstrap order:

1. load runtime config
2. resolve enabled capabilities
3. create managers
4. create tools
5. create hooks
6. publish runtime interface metadata

This pipeline must stay deterministic, testable, and free of hidden side effects.

## State Ownership Rule

No capability module may:

- advance workflow stage implicitly
- close issues implicitly
- approve gates implicitly
- mark work complete without evidence

All runtime automation must route through the explicit workflow-state surfaces.

## Rollout Plan

### Phase 0

- architecture RFC
- capability matrix
- clean-room policy

### Phase 1

- runtime bootstrap pipeline
- runtime config loader
- capability registry
- runtime foundation diagnostics

### Phase 2+

- tool registry
- manager layer
- hook composition
- MCP platform
- background execution
- categories and specialists
- recovery and continuation
- skills and command expansion

## Acceptance Criteria

- `openkit run` remains the preferred launch path.
- Runtime bootstrap can be tested in isolation.
- Runtime config is additive over the existing OpenCode layering.
- Workflow state remains the source of truth for delivery semantics.
- New capability surfaces are reflected in `registry.json` and maintainer docs.
