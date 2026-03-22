---
name: code-review
description: "Pre-review checklist and quality gates. Uses a two-stage approach: spec compliance then code quality."
---

# Skill: Code Review

## Context

Used by the Code Reviewer subagent, the QA Agent, or the Tech Lead Agent.
The goal is to be the final gate that keeps bad code or off-spec code from reaching the main branch.

## Required Inputs

- What needs review? (files / commit / PR)
- Comparison documents: spec (requirements), architecture (design), code standards.

## Two-Stage Review Process

Strictly follow these two stages in order. Do not talk about formatting or clean code if the feature itself is off-spec.

### Stage 1: Spec Compliance
**Ask exactly one question: "Does this code meet the acceptance criteria in the spec exactly, and does it avoid inventing extra features?"**

- Inspect each acceptance criterion (Given - When - Then).
- Does the code handle the edge cases the BA documented?
- **Overscope Audit (Over-engineering)**: counter the developer instinct to "helpfully" add extra behavior. Has the code built convenience features that were never requested? (YAGNI)

=> **Record Pass / Fail for Stage 1. If it fails, stop the review there and send it back to the developer. Do not continue to Stage 2.**

### Stage 2: Code Quality
Only reach this step if Stage 1 has passed. Use `context/core/code-quality.md` as the review baseline.

Review by severity:
1. **Critical / Security (Must fix immediately)**: SQL injection, leaked environment variables, crash-level memory issues.
2. **Architecture (Needs consultation)**: wrong boundary ownership (for example, a controller doing database query logic). Escalate to Tech Lead.
3. **Important Quality (Should fix)**: meaningless variable names (`let a = 1`), functions longer than 50 lines, badly degraded test coverage.
4. **Minor**: brace and spacing debates. Follow the existing linter or formatter.

## Checklist for a Good Review Report
- [ ] Clearly state Stage 1 (Pass/Fail) and why.
- [ ] Cite the exact file path and failing line number.
- [ ] State severity clearly (Critical / Important / Minor).
- [ ] Do not just criticize - include a concrete fix suggestion or example snippet.

## Anti-Patterns to Avoid
- Superficial review: "LGTM" without actually reading the files.
- Fixing the code for the developer: "I'll just patch it quickly and approve." The reviewer must not touch the implementation. The developer stays responsible for the fix.
