---
name: using-skills
description: "Meta-skill: Teaches agents how to discover, evaluate, and invoke skills. Loaded at session start."
---

# Skill Usage Guide - Meta-Skill

## What Skills Mean

In the AI Software Factory, "Skills" are standard operating procedures that define how the system should work. When a situation matches a skill, you **must** follow that skill instead of improvising from raw LLM instinct.

## Instruction Priority

When instructions conflict, apply this order (1 is highest):

1. **Current user prompt**: direct instructions from the user in the current message
2. **Skill instructions**: guidance inside the active `SKILL.md`
3. **Agent role instructions**: the agent's role and constraints (for example, `QA Agent does not edit code`)
4. **General system prompt**: the base LLM behavior

## How to Use a Skill

When you identify a situation (for example: need to write a plan, fix a bug, or test code), follow these steps:

1. **Identify**: "I need to create an implementation plan"
2. **Discover**: "Let me use the tool to read `skills/writing-plans/SKILL.md`"
3. **Read**: use `view_file` (or the equivalent tool) to read the ENTIRE `SKILL.md`
4. **Execute**: apply the steps from that file

## Warning: Rationalization Prevention

LLM instinct often tries to short-circuit the process. Watch for these faulty thoughts:

| Bad thought (Rationalization) | Correct action |
|--------------------------------|----------------|
| "This file is easy, I'll just fix it without reporting to the Master Orchestrator." | Stop. Follow the role boundary. Report to the Master Orchestrator first. |
| "I already know how to write plans, I don't need to reread `skills/writing-plans/SKILL.md`." | No. Every time you write a plan, reread the skill so you are using the latest checklist. |
| "This bug is obvious, I can skip root-cause analysis and fix it directly." | No. Use `systematic-debugging`. Root cause analysis is mandatory first. |
| "The user said it's urgent, so I'll skip the test-writing step (TDD)." | TDD is an Iron Law. There is no exception unless the user **very explicitly** says "Skip TDD". |
