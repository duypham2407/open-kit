# Runtime Capabilities And Managers

This document maps the capability layer and the manager layer that power the
OpenKit runtime.

## 1. Capability Layer

Capability metadata is defined in:

- `src/runtime/capability-registry.js`

Capabilities are grouped broadly into:

- foundation capabilities
- runtime capabilities

Notable active or foundational capabilities include:

- runtime bootstrap
- runtime config layering
- capability registry
- runtime diagnostics
- manager layer
- tool registry
- hook registry
- MCP platform
- background execution
- category routing
- specialist agents
- recovery stack
- session tooling
- continuation control
- browser automation
- safer editing
- AST tooling
- syntax parsing
- rule audit
- codemod
- LSP tooling

## 2. Why Capabilities Exist

Capabilities are not the same thing as tools. They describe runtime surfaces at
a higher level, so diagnostics and docs can talk about what the runtime can do
even before individual tools are invoked.

## 3. Manager Layer Overview

Managers are created in:

- `src/runtime/create-managers.js`

Manager metadata is exposed through `createManagerList()`.

Current major managers include:

- config handler
- background manager
- skill MCP manager
- syntax index manager
- project graph manager
- session memory manager
- embedding indexer
- delegation supervisor
- continuation state manager
- notification manager
- tmux session manager
- session state manager
- action model state manager
- agent profile switch manager

## 4. Important Managers

### Syntax Index Manager

Purpose:
- tree-sitter-backed parsing cache
- structure-aware analysis support

Used by:
- syntax tools
- AST search flows
- project graph building

### Project Graph Manager

Purpose:
- maintain the SQLite-backed project graph
- index imports, symbols, references, and calls
- serve graph queries to tools

Related runtime surfaces:
- import graph
- dependency tracing
- symbol lookup
- navigation tools
- semantic search backing store

### Session Memory Manager

Purpose:
- track file touches during sessions
- expose semantic search over indexed embeddings
- build result and workflow context around code locations

### Embedding Indexer

Purpose:
- generate semantic chunks
- enrich embedding input text
- embed through the configured provider
- store vectors and chunk metadata in the graph DB

### Background Manager

Purpose:
- manage background task execution
- bridge workflow state and long-running work

### Delegation Supervisor

Purpose:
- coordinate delegated execution and specialist usage

### Action Model State Manager

Purpose:
- track model execution state and fallback-relevant signals

### Agent Profile Switch Manager

Purpose:
- persist and apply manual profile/model switching

## 5. Manager Relationships

```text
SyntaxIndexManager
    -> ProjectGraphManager
          -> SessionMemoryManager
          -> EmbeddingIndexer

ActionModelStateManager + AgentProfileSwitchManager
    -> Model runtime

BackgroundManager + DelegationSupervisor
    -> task execution and specialist orchestration
```

## 6. Semantic Search Subsystem

The semantic-search path specifically depends on:

- `SyntaxIndexManager`
- `ProjectGraphManager`
- `EmbeddingIndexer`
- `SessionMemoryManager`

The current implementation is:

- SQLite-backed
- chunk-aware
- incrementally indexed
- keyword-degradable when embeddings are missing

## 7. Diagnostics And Summary

Manager summaries flow into:

- `runtimeInterface.managers`
- `runtimeInterface.runtimeState`

This is how the runtime exposes health and state for maintainers and future diagnostics.
