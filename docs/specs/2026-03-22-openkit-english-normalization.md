---
artifact_type: specification
version: 1
status: draft
feature_id: FEATURE-007
feature_slug: openkit-english-normalization
owner: BAAgent
approval_gate: ba_to_architect
---

# OpenKit English Normalization Specification

## Summary

Normalize the repository language to naturalized English across the checked-in OpenKit kit.

This feature is not a narrow translation pass. It is a repository-wide language-consistency change whose goal is to make OpenKit readable and maintainable as one coherent English-language codebase and checked-in kit repository.

The change must:

1. translate Vietnamese content into natural, maintainable English
2. preserve behavior, requirements, workflow contracts, and warnings exactly in meaning
3. keep source-of-truth and derived bundle surfaces synchronized
4. avoid leaving the repository in a mixed-language state for live kit files

## Problem Statement

The repository currently contains substantial Vietnamese content across live kit surfaces such as:

- `skills/`
- `agents/`
- install-bundle copies under `assets/install-bundle/`
- live repository docs and support docs
- some archived or historical materials

That mixed-language state creates several problems:

- contributors must switch between languages within the same workflow or contract surface
- install-bundle copies and source-of-truth files risk semantic drift if translated inconsistently
- operator and maintainer docs are harder to use as product documentation for a broader audience
- future edits become more expensive because wording decisions are split across two languages

OpenKit needs one canonical repository language for its checked-in repository surfaces. That language should be English.

## User Stories

### US-001: Contributors can read the kit consistently in one language

As a contributor,
I want the checked-in OpenKit repository to use English consistently,
so that I can maintain it without switching between Vietnamese and English across core surfaces.

**Acceptance Criteria**
- Given live kit files, when I read them, then the content is written in English rather than a mix of English and Vietnamese.
- Given related source and derived files, when I compare them, then they convey the same content in English consistently.
- Given role docs, skills, and command docs, when I use them, then they read as one coherent English-language system.

**Edge Cases**
- files that intentionally preserve historical quotations or names
- examples where a quoted user string might originally be Vietnamese

### US-002: Product and workflow contracts keep their exact meaning

As a maintainer,
I want the language normalization to preserve requirements and workflow semantics,
so that the repository changes language without changing behavior.

**Acceptance Criteria**
- Given a workflow rule, when it is translated, then its meaning remains the same.
- Given a warning or prohibition, when it is translated, then its force and scope remain the same.
- Given acceptance criteria or examples, when they are translated, then they still describe the same behavior or constraint.

**Edge Cases**
- blunt or colloquial Vietnamese wording that needs smoother English but still carries the same severity
- historical docs that should remain historical in tone without becoming inaccurate

### US-003: Derived install-bundle content stays aligned with source content

As a maintainer,
I want source and derived bundle content to remain aligned during translation,
so that the install bundle does not silently diverge from the checked-in authoring source.

**Acceptance Criteria**
- Given a translated source file, when its bundle copy exists, then the bundle copy is updated to equivalent English content.
- Given the derived bundle, when verification runs, then no translated source/bundle mismatch remains in the checked-in repo.
- Given bundle-related tests or validators, when they run, then they still pass after the language normalization.

**Edge Cases**
- files that are intentionally source-of-truth only and not bundled
- files whose path moved recently and already have drift risk

### US-004: Historical materials are translated only if they still belong to the checked-in repository surface

As a maintainer,
I want a clear rule for historical and archived materials,
so that translation scope is explicit instead of ad hoc.

**Acceptance Criteria**
- Given archived or historical docs still checked into the repository, when the scope says "all files in the kit," then those files are included unless explicitly exempted by a later approved policy.
- Given those files, when translated, then they remain clearly historical and do not become accidentally more authoritative.

**Edge Cases**
- archived docs containing obsolete paths or deprecated behavior notes
- historical docs with old terminology that should remain visibly historical but still readable in English

## Scope

In scope for this feature:

- translate live checked-in kit content from Vietnamese to naturalized English
- translate source-of-truth and derived bundle content consistently
- translate live docs, support docs, and archived docs that remain checked into the repository as part of the checked-in repository surface
- normalize language in:
  - `skills/`
  - `agents/`
  - `commands/`
  - relevant `docs/`
  - `assets/install-bundle/`
  - any checked-in runtime/support surfaces that still contain Vietnamese
- add or update verification so maintainers can detect remaining Vietnamese text in checked-in kit files

Out of scope for this feature:

- changing runtime semantics or workflow semantics
- rewriting product direction or restructuring the repository tree beyond what is necessary to keep translated files aligned
- renaming commands, runtime ids, or workflow enums simply because a translated phrase sounds nicer
- deleting historical files just to avoid translating them

## Design Principles

1. Meaning first: preserve behavior and contract semantics exactly.
2. Naturalized English: prefer readable English over literal word-for-word translation.
3. Consistency over patchiness: avoid leaving live kit surfaces half translated.
4. Source-first discipline: if a file has a derived copy, update the source and the derived copy together.
5. Archive honesty: historical docs may be translated, but they must remain historical in status.
6. Verification before completion: the repo should have a clear way to detect remaining Vietnamese in checked-in kit files.

## Selected Direction

Normalize the full checked-in OpenKit repository to English, using naturalized English rather than literal translation.

This includes live kit files and archived/historical docs that still belong to the repository surface.

The repository should end this feature in a state where the checked-in kit reads as one English-language codebase and documentation set, even if some examples or quoted strings still mention Vietnamese as historical context when necessary.

## Translation Policy

### Naturalized English

The repository should use natural, maintainable English rather than overly literal translation.

That means:

- awkward Vietnamese phrasing may be rewritten into clearer English
- colloquial wording may be smoothed into direct professional English
- structure may be adjusted slightly if needed for clarity

But:

- severity, warnings, prohibitions, and requirements must keep the same meaning
- examples should still demonstrate the same behavior
- role boundaries and workflow responsibilities must remain unchanged

### Stable identifiers and code-like tokens

Do not translate:

- command names
- workflow enums
- file paths
- code identifiers
- runtime ids
- artifact types that are part of a machine contract

Translate surrounding explanation, not machine-facing literals.

### Historical material rule

Archived docs may still be translated because they are part of the checked-in repository surface.

However, translation must preserve their historical framing and must not make them appear more authoritative than they are.

## Source And Derived Content Policy

OpenKit already contains authoring/source content and derived install-bundle content.

During this feature:

- authoring surfaces remain the semantic source of truth where that distinction already exists
- derived bundle copies must be updated in the same implementation cycle
- no translated source file should be left paired with an untranslated bundle copy, or vice versa

Operational synchronization rule:

- for duplicated surfaces that already exist in both source and bundle form, the source file remains the canonical text to author and review
- the bundle copy must remain semantically aligned with that source text after translation
- this feature does not require byte-for-byte wording identity if the bundle already has justified packaging-specific differences, but it does require no untranslated Vietnamese drift between the paired surfaces
- if a surface does not already have a clear source/bundle pairing, the implementation must document the pairing rule before translating both sides blindly

If a surface is currently duplicated in both source and bundle form, the translation pass must keep them aligned.

## Verification Requirements

At the end of this feature, maintainers need evidence that the checked-in kit no longer contains unintended Vietnamese text.

Minimum verification should include:

- repo-wide content search for Vietnamese characters in checked-in kit files
- targeted review of any remaining matches to confirm whether they are intentional literals or missed translations
- targeted file-level review of known high-risk surfaces such as `skills/`, `agents/`, `commands/`, `assets/install-bundle/`, and any touched runtime/help docs
- re-running the actually available repository validation paths that protect wrapper and legacy runtime behavior
- any bundle/source consistency checks that are already checked into the repository

For this repository today, validation claims must stay tied to explicit commands that actually exist, such as the wrapper and legacy runtime test commands already used in the repo, rather than to generic statements about a canonical application-code test toolchain.

## Non-Functional Requirements

- translated text must read naturally in English
- warning and policy language must keep the same strength as before
- operator docs, maintainer docs, and skill instructions must remain internally consistent after translation
- the repository must not regress in wrapper or legacy runtime tests because of the language change

## Out of Scope

- adopting a second canonical language
- preserving Vietnamese as a parallel duplicate doc set in phase 1
- re-architecting the repository only to make translation easier

## Open Questions

- whether repo-wide translation verification should be a one-off manual check in this feature or a reusable scripted guard in the repository
- whether any intentionally bilingual examples or historical quotes should remain as-is, and if so, how those exceptions should be marked
