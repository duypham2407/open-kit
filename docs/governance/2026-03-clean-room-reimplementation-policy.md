# Clean-Room Reimplementation Policy

## Purpose

OpenKit may adopt runtime ideas from external systems, but implementation must remain original.

## Required Rules

1. Do not copy external source code directly into OpenKit.
2. Do not copy external prompt text, command templates, or skill text verbatim.
3. Treat external systems as design references, not as patch sources.
4. Prefer behavior specs, acceptance criteria, and original implementations.
5. Record new capability behavior in OpenKit docs and tests as its own contract.

## Allowed Inputs

- high-level architecture comparisons
- behavior summaries
- capability inventories
- operator-visible workflows

## Disallowed Inputs

- direct code lifts
- direct prompt lifts
- direct template lifts
- bulk translation or near-copy rewrites of protected content

## Maintainer Checks

When a new runtime capability is added, maintainers should verify:

- the implementation has OpenKit-specific structure and naming
- the docs describe the feature in OpenKit's workflow-governed terms
- tests validate behavior without depending on external implementation details
