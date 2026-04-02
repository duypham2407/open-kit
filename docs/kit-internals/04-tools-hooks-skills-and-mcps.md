# Tools, Hooks, Skills, Commands, MCPs, And Specialists

This document explains the runtime-facing surfaces that most directly shape how
OpenKit behaves inside OpenCode.

## 1. Tool Layer

The tool registry is assembled in:

- `src/runtime/tools/tool-registry.js`

Tools are wrapped by:

- `wrapToolExecution()`

They are then summarized in:

- `src/runtime/create-tools.js`

## 2. Tool Families

Current notable tool families include:

- workflow
- session
- continuation
- delegation
- mcp
- models
- interactive
- edit
- analysis
- audit
- codemod
- syntax
- browser
- lsp
- ast
- graph

## 3. Important Tool Groups

### Workflow tools

Examples:
- workflow state
- runtime summary
- evidence capture

### Session and continuation tools

Examples:
- session list/read/search
- continuation status/start/stop/handoff

### Audit and codemod tools

Examples:
- `tool.rule-scan`
- `tool.security-scan`
- `tool.codemod-preview`
- `tool.codemod-apply`

### Syntax, AST, and graph tools

Examples:
- syntax outline/context/locate
- AST search / AST replace / AST-grep search
- import graph / dependencies / dependents / symbol lookup
- graph goto definition / find references / call hierarchy / rename preview
- semantic search

### Semantic-search and embedding tools

Examples:
- `tool.semantic-search`
- `tool.embedding-index`

## 4. Hook Layer

Hooks are created in:

- `src/runtime/create-hooks.js`

Hook groups come from:

- session hooks
- tool guard hooks
- continuation hooks
- skill hooks

### Tool guard hooks

These are especially important because they constrain runtime behavior:

- stage readiness
- verification claim guard
- issue closure guard
- parallel safety guard
- write guard
- bash guard
- tool output truncation

Tool guard hooks are assembled in:

- `src/runtime/hooks/create-tool-guard-hooks.js`

## 5. Skills

Skills are loaded through:

- `src/runtime/skills/skill-loader.js`
- `src/runtime/skills/skill-registry.js`

Skill sources include:

- project-local skills
- project `.opencode` skill scope
- user-local skills

Each skill may also declare MCP references by mentioning `mcp.<name>` in its markdown.

## 6. Commands

Runtime commands are loaded through:

- `src/runtime/commands/command-loader.js`

Command sources include:

- builtin runtime commands
- project markdown commands under `commands/`

Builtin runtime commands currently include:

- `/browser-verify`
- `/switch`
- `/init-deep`
- `/refactor`
- `/start-work`
- `/handoff`
- `/stop-continuation`

Project command markdown also provides lane commands and workflow ergonomics such as:

- `/task`
- `/quick-task`
- `/migrate`
- `/delivery`
- `/brainstorm`
- `/write-solution`
- `/execute-solution`
- `/configure-agent-models`

## 7. MCP Platform

The MCP platform is created in:

- `src/runtime/mcp/index.js`

Built-in MCPs are currently:

- `mcp.websearch`
- `mcp.docs-search`
- `mcp.code-search`

The platform also loads configured external MCP servers via runtime config.

## 8. Specialists

Specialists are created in:

- `src/runtime/specialists/specialist-registry.js`

Default specialist set:

- oracle
- librarian
- explore
- multimodal-looker
- metis
- momus

These are support surfaces layered under workflow ownership, not replacements
for the lane/role contract.

## 9. Context Injection

Context injection is created in:

- `src/runtime/context/context-injector.js`

It currently provides:

- directory agent path discovery
- README path discovery
- workflow-state context
- injected rule fragments from hooks

## 10. Mental Model

The easiest way to think about these layers is:

```text
commands shape how work starts
skills shape how work should be done
hooks constrain unsafe behavior
tools provide direct capabilities
MCPs provide external/search-style surfaces
specialists provide focused support roles
```
