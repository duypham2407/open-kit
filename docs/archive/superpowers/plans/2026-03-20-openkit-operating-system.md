# OpenKit Operating System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make OpenKit operational with state, artifact contracts, golden-path examples, and consistent repo guidance.

**Architecture:** Keep orchestration file-backed and documentation-driven. Use `.opencode/` for runtime metadata and state, `docs/templates/` for durable handoff contracts, and `context/` for phase-specific operational guidance.

**Tech Stack:** Markdown, JSON, OpenCode hooks/config, repository conventions

---

### Task 1: Add runtime manifest and workflow state

**Files:**
- Create: `.opencode/opencode.json`
- Create: `.opencode/workflow-state.json`

- [ ] Define runtime manifest entries for agents, commands, skills, hooks, state, and artifact roots.
- [ ] Add a resumable workflow-state schema with stage, owner, approvals, issues, and artifacts.

### Task 2: Create artifact directories and templates

**Files:**
- Create: `docs/briefs/README.md`
- Create: `docs/specs/README.md`
- Create: `docs/architecture/README.md`
- Create: `docs/plans/README.md`
- Create: `docs/qa/README.md`
- Create: `docs/adr/README.md`
- Create: `docs/templates/*.md`

- [ ] Add durable directories for each workflow artifact type.
- [ ] Add frontmatter-based templates so handoffs are predictable.

### Task 3: Align repository guidance with current state

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `context/navigation.md`
- Modify: `context/core/project-config.md`

- [ ] Remove claims that rely on missing files or commands.
- [ ] Point readers to the new operational docs and templates.

### Task 4: Add orchestration contracts and reference docs

**Files:**
- Create: `context/core/approval-gates.md`
- Create: `context/core/issue-routing.md`
- Create: `context/core/session-resume.md`

- [ ] Define gate states and approval recording rules.
- [ ] Define issue classification schema and routing ownership.
- [ ] Define how new sessions resume safely.

### Task 5: Add golden-path example

**Files:**
- Create: `docs/examples/README.md`
- Create: `docs/examples/workflow-samples/2026-03-20-openkit-sample-workflow.md`

- [ ] Demonstrate the complete artifact chain from brief to QA report.

### Task 6: Add governance and observability docs

**Files:**
- Create: `docs/governance/*.md`
- Create: `docs/operations/*.md`

- [ ] Define naming, severity, ADR, and definition-of-done rules.
- [ ] Define execution log, decision log, and review history expectations.
