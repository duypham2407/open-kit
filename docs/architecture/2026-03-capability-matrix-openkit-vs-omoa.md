# Capability Matrix: OpenKit vs OMOA-Inspired Runtime

## Purpose

This document records the runtime capability gaps OpenKit is closing through the hybrid-runtime program.

## Matrix

| Capability Family | OpenKit Before | Hybrid Runtime Target |
| --- | --- | --- |
| Workflow kernel | strong | retain and extend |
| File-backed workflow state | strong | retain and extend |
| Runtime bootstrap pipeline | weak | strong |
| Runtime config layering | moderate | strong |
| Capability registry | absent | strong |
| Manager lifecycle | absent | strong |
| Tool registry | absent | strong |
| Hook composition | weak | strong |
| Background execution | absent | strong |
| MCP integration | absent | strong |
| Category routing | absent | strong |
| Specialist agents | limited | strong |
| Recovery and continuation | weak | strong |
| Diagnostics and doctor | moderate | strong |
| Productivity commands | moderate | strong |
| Operational skills | limited | strong |

## Current Implemented Delta

OpenKit has now materially improved several runtime families without replacing the workflow kernel:

- Diagnostics and doctor:
  - runtime and global doctor now surface task-board-aware orchestration health
  - blocked vs waiting vs dispatchable states are distinguished explicitly
  - doctor remains read-only and does not materialize workspace state in clean workspaces
- Recovery and continuation:
  - continuation risk includes missing verification evidence, open issues, and stalled boards
  - recovery now returns actionable recommendations rather than only a resumable flag
- Background execution and delegation:
  - delegated implementation runs round-trip task ownership and status through workflow state
  - QA handoff can be routed without spawning a background run
  - supervisor now distinguishes dependency-queued, parallel-cap-queued, integration-checkpoint wait, and stage-advance wait conditions

Remaining maturity work is still mostly about deeper heuristics and operator polish, not architectural replacement.

## Implementation Rule

Capability parity does not justify losing OpenKit's current strengths:

- explicit workflow law
- inspectable state
- approval and evidence discipline
- release and hotfix governance

Every new runtime feature must identify:

1. what workflow-state surface it reads
2. what workflow-state surface it writes
3. what doctor or diagnostics output makes it observable
