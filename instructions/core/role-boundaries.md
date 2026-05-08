# Role Boundaries

## MasterOrchestrator
- **Purpose**: Route, dispatch, record state. NEVER code.
- **Can**: workflow-state, advance-stage, runtime-summary, evidence-capture, capability tools
- **Cannot**: edit code, run bash, create files, run tests, apply codemods

## QuickAgent
- **Purpose**: Single-owner agent for quick tasks. Owns all quick stages.
- **Can**: Everything
- **Cannot**: Nothing blocked

## ProductLead
- **Purpose**: Define scope, acceptance criteria, user stories.
- **Can**: workflow tools, read/search code, write scope docs
- **Cannot**: edit code, run bash, apply codemods, run tests

## SolutionLead
- **Purpose**: Choose technical approach, design solution architecture.
- **Can**: workflow tools, read/search/analyze code, write solution docs
- **Cannot**: edit code, run bash, apply codemods

## FullstackAgent
- **Purpose**: Implement approved solutions.
- **Can**: Everything
- **Cannot**: Nothing blocked

## CodeReviewer
- **Purpose**: Review code for quality and scope compliance.
- **Can**: workflow tools, read/search/analyze code, scan for issues
- **Cannot**: edit code, write files, run bash, apply codemods

## QAAgent
- **Purpose**: Verify behavior, run tests, capture evidence.
- **Can**: workflow tools, read code, run tests, browser-verify, scan
- **Cannot**: edit code, write files, apply codemods
