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
