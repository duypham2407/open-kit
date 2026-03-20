# AI Software Factory - Agent Roles & Workflow

## Overview

This system is designed as a multi-agent software development pipeline
with feedback loops and clear responsibilities.

---

## Workflow

User → Master Agent → PM → BA → Architect → Tech Lead → Fullstack ↔ QA
(loop)

---

## 1. Master Agent (Orchestrator)

### Role

- Central brain of the system
- Route tasks between agents
- Handle retry & feedback loop

### Responsibilities

- Decide next step in workflow
- Classify errors from QA
- Redirect tasks:
  - Bug → Fullstack
  - Design issue → Architect / Tech Lead
  - Requirement issue → BA

---

## 2. PM Agent (Product Manager)

### Role

- Define product goals

### Responsibilities

- Understand user intent
- Define high-level features
- Set priorities

---

## 3. BA Agent (Business Analyst)

### Role

- Convert ideas into requirements

### Responsibilities

- Break down features into tasks
- Define acceptance criteria
- Clarify edge cases

---

## 4. Architect Agent

### Role

- Design system structure

### Responsibilities

- Define architecture
- Choose technologies
- Design APIs & data models

---

## 5. Tech Lead Agent

### Role

- Bridge between Architect and Fullstack

### Responsibilities

- Review architecture before coding
- Enforce coding standards
- Optimize implementation approach
- Reduce technical risk

---

## 6. Fullstack Agent

### Role

- Implement features

### Responsibilities

- Follow TDD: plan → test → code → refactor
- Write clean, maintainable code
- Fix bugs from QA

---

## 7. QA Agent

### Role

- Validate system quality

### Responsibilities

- Write and run test cases
- Detect bugs and issues
- Classify problems:
  - Bug
  - Design flaw
  - Requirement gap

---

## Feedback Loop

Fullstack → QA → (fail) → Fix → QA → (pass)

---

## Key Principles

- Always use feedback loops
- Never skip planning
- Enforce TDD
- Separate responsibilities clearly
- Use Master Agent for orchestration

---

## Goal

Build an AI system that mimics a real software development team with
high quality output and structured workflow.
