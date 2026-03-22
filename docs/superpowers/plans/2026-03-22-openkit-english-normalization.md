# OpenKit English Normalization Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Translate the full checked-in OpenKit repository from Vietnamese or mixed-language content into naturalized English while preserving semantics, keeping source and derived bundle content aligned, and leaving runtime behavior unchanged.

**Architecture:** Execute this as a language-normalization refactor with strict source-versus-derived discipline. First, inventory and classify all Vietnamese-bearing checked-in surfaces, especially high-risk contract surfaces such as `skills/`, `agents/`, `commands/`, runtime/help docs, and bundle copies. Next, translate canonical/live source surfaces in coherent groups, then synchronize duplicated bundle content, then translate archived checked-in materials, and finally run repo-wide language detection plus wrapper and legacy runtime regression suites.

**Tech Stack:** Markdown docs, checked-in bundle assets, repository text search, wrapper test suite, legacy `.opencode` runtime regression suite

---

## Dependencies

- Source spec: `docs/specs/2026-03-22-openkit-english-normalization.md`
- Current high-risk source surfaces:
  - `skills/`
  - `agents/`
  - `commands/`
  - `README.md`
  - `AGENTS.md`
  - `context/`
  - `.opencode/README.md`
  - live docs under `docs/`
- Current derived bundle surface:
  - `assets/install-bundle/opencode/`
- Current regression commands that actually exist:
  - `node --test "tests/**/*.test.js"`
  - `node --test ".opencode/tests/*.test.js"`
- Current language-detection reality:
  - repo-wide grep for Vietnamese characters is useful but not sufficient on its own

## Scope Guardrails

- Do not change runtime semantics, workflow semantics, wrapper semantics, command names, enums, or machine-facing identifiers.
- Do not translate file paths, command names, workflow ids, runtime ids, or schema values that are part of a machine contract.
- Use naturalized English, but preserve severity, warnings, prohibitions, and acceptance-criteria meaning.
- Treat source-versus-derived duplication explicitly; do not translate only one side of a duplicated surface.
- Archived docs are in scope because they remain part of the checked-in repository surface, but they must remain clearly historical in framing.

## Source-Of-Truth And Synchronization Rule

- Where a checked-in source surface already has a corresponding derived bundle copy, the source file remains the canonical text to author and review.
- The bundle copy must be updated in the same task wave and remain semantically aligned.
- Byte-for-byte identity is not required if a bundle copy already has justified packaging-specific differences, but untranslated Vietnamese must not remain on only one side of a paired surface.
- If a duplicated surface has no obvious source/bundle pairing, the task implementing that translation must document the pairing before editing both copies.

## Planned File Groups

- **High-risk contract surfaces**
  - `skills/**/*.md`
  - `agents/**/*.md`
  - `commands/**/*.md`
  - `.opencode/README.md`
  - `README.md`, `AGENTS.md`, `context/**/*.md`

- **Derived bundle copies**
  - `assets/install-bundle/README.md`
  - `assets/install-bundle/opencode/skills/**/*.md`
  - `assets/install-bundle/opencode/agents/**/*.md`
  - `assets/install-bundle/opencode/commands/**/*.md`
  - `assets/install-bundle/opencode/**/*.md`

- **Live docs and support docs**
  - `docs/governance/**/*.md`
  - `docs/operator/**/*.md`
  - `docs/maintainer/**/*.md`
  - `docs/examples/**/*.md`
  - `docs/operations/**/*.md`
  - `docs/templates/**/*.md`
  - live dated docs under `docs/briefs/`, `docs/specs/`, `docs/architecture/`, `docs/plans/`, `docs/qa/`, `docs/adr/`

- **Archived docs**
  - `docs/archive/**/*.md`

## Delivery Strategy

- **Wave 0:** inventory and translation contract checks
- **Wave 1:** canonical live source surfaces
- **Wave 2:** derived bundle synchronization
- **Wave 3:** live docs and support docs
- **Wave 4:** archived docs and final language sweep
- **Wave 5:** full verification and cleanup

## Tasks

### Task 1: Build the translation inventory and pairing map

**Files:**
- Modify: `README.md` only if a tiny wording correction is needed for consistency after inventory work
- Create or Modify: a reusable detection helper and a temporary inventory artifact only if absolutely necessary; otherwise use task notes
- Reference: `skills/`, `agents/`, `commands/`, `assets/install-bundle/`, `docs/`, `.opencode/`

- [ ] **Step 1: Run failing repo-wide language detection checks**

Identify Vietnamese-bearing checked-in files using:
- character-based search
- targeted searches in known high-risk directories
- manual sampling for likely unaccented or mixed-language surfaces in those same high-risk directories

- [ ] **Step 2: Build a source-versus-derived pairing map**

At minimum, map:
- `skills/` ↔ `assets/install-bundle/opencode/skills/`
- `agents/` ↔ `assets/install-bundle/opencode/agents/`
- `commands/` ↔ `assets/install-bundle/opencode/commands/`
- `.opencode/README.md` ↔ `assets/install-bundle/opencode/README.md`

- [ ] **Step 3: Classify files by translation priority**

Mark:
- high-risk contract surfaces
- derived bundle copies
- live docs/support docs
- archive/history docs

- [ ] **Step 4: Verify no machine-facing literals are accidentally in scope for translation**

Manual validation:
- command names, enums, runtime ids, file paths, and schema literals are identified as non-translated tokens

- [ ] **Step 5: Add a reusable detection path for remaining Vietnamese text**

Create or update a lightweight checked-in verification helper so maintainers can rerun Vietnamese-detection after this feature lands.

The helper may still rely partly on repo-wide grep and reviewed allowlists, but it must be a reusable repo artifact rather than only a one-off manual command sequence in the final report.

Validation: inventory/search only; no runtime change.

### Task 2: Translate core skill source files into naturalized English

**Files:**
- Modify: `skills/**/*.md`
- Modify: `assets/install-bundle/opencode/skills/**/*.md`

- [ ] **Step 1: Translate one or two representative skill files first and compare tone**

Use the translated samples to lock in:
- naturalized English tone
- preserved severity and warning strength
- unchanged machine-facing tokens

- [ ] **Step 2: Translate the remaining skill files in the source tree**

Keep:
- headings readable
- warnings forceful when originally forceful
- examples semantically equivalent

- [ ] **Step 3: Re-read translated skill files for consistency as a set**

Check for:
- mixed-language leftovers
- inconsistent terminology for core ideas like verification, review, orchestration, and debugging

- [ ] **Step 4: Synchronize derived skill bundle copies in the same wave**

Immediately update `assets/install-bundle/opencode/skills/**/*.md` after translating the source skill files.

Validation:
- targeted grep for Vietnamese in both `skills/**/*.md` and `assets/install-bundle/opencode/skills/**/*.md`
- manual review of high-risk skill files

### Task 3: Translate source agent and command surfaces into naturalized English

**Files:**
- Modify: `agents/**/*.md`
- Modify: `commands/**/*.md`
- Modify: `assets/install-bundle/opencode/agents/**/*.md`
- Modify: `assets/install-bundle/opencode/commands/**/*.md`

- [ ] **Step 1: Translate agent role docs without changing role boundaries**

Preserve:
- subagent roles
- review order
- no-edit or read-only constraints

- [ ] **Step 2: Translate command docs while preserving command names and semantics**

Do not translate machine-facing slash command names.

- [ ] **Step 3: Re-read agent and command sets together**

Ensure:
- terms line up with translated skill language
- no Vietnamese guidance remains in live agent/command docs

- [ ] **Step 4: Synchronize derived agent and command bundle copies in the same wave**

Immediately update:
- `assets/install-bundle/opencode/agents/**/*.md`
- `assets/install-bundle/opencode/commands/**/*.md`

Validation:
- targeted grep for Vietnamese in both source and bundle copies for these surfaces
- manual cross-read of a few key files such as `agents/code-reviewer.md`

### Task 4: Translate remaining bundle-facing docs and support copies

**Files:**
- Modify: `assets/install-bundle/README.md`
- Modify: `assets/install-bundle/opencode/**/*.md`
- Modify: any remaining derived/support bundle-facing files not already synchronized in Tasks 2-3

- [ ] **Step 1: Write the failing bundle-sync checklist**

Confirm where bundle-facing files still contain Vietnamese after Tasks 2-3.

- [ ] **Step 2: Update remaining bundle-facing files to semantically aligned English**

Preserve any justified packaging-specific framing, but remove untranslated Vietnamese.

- [ ] **Step 3: Compare source and bundle pairs for semantic alignment**

Do not require byte-for-byte identity, but do require equivalent meaning.

Validation:
- targeted grep for Vietnamese in remaining bundle-facing files after Tasks 2-3
- manual spot checks across representative pairs

### Task 5: Translate live top-level entrypoints and core runtime/support docs

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `context/**/*.md`
- Modify: `.opencode/README.md`

- [ ] **Step 1: Translate top-level entrypoints and core context docs**

Preserve:
- authority/source-of-truth rules
- current-vs-target migration language
- workflow semantics

- [ ] **Step 2: Translate `.opencode/README.md` and other core runtime/support entrypoints**

Keep runtime-support boundaries and current-vs-target migration language intact.

- [ ] **Step 3: Re-read entrypoint docs together**

Check consistency across:
- `README.md`
- `AGENTS.md`
- `context/navigation.md`
- `.opencode/README.md`

Validation:
- targeted grep for Vietnamese across these live docs
- manual cross-read for terminology consistency

### Task 6: Translate governance, operator, maintainer, examples, operations, and templates docs

**Files:**
- Modify: `docs/governance/**/*.md`
- Modify: `docs/operator/**/*.md`
- Modify: `docs/maintainer/**/*.md`
- Modify: `docs/examples/**/*.md`
- Modify: `docs/operations/**/*.md`
- Modify: `docs/templates/**/*.md`

- [ ] **Step 1: Translate governance and audience-layer docs**

Keep policy strength and audience separation intact.

- [ ] **Step 2: Translate examples, operations, and templates docs**

Keep:
- example non-authority framing
- runbook vs internal-record separation
- template guardrail language

- [ ] **Step 3: Re-read these live doc clusters for terminology consistency**

Validation:
- targeted grep for Vietnamese across these directories
- manual cross-read of representative files from each cluster

### Task 7: Translate dated live docs and archive/history docs

**Files:**
- Modify: `docs/briefs/**/*.md`
- Modify: `docs/specs/**/*.md`
- Modify: `docs/architecture/**/*.md`
- Modify: `docs/plans/**/*.md`
- Modify: `docs/qa/**/*.md`
- Modify: `docs/adr/**/*.md`
- Modify: `docs/archive/**/*.md`
- Modify: `docs/ai_software_factory_agents.md`

- [ ] **Step 1: Translate dated live docs without changing status or authority**

Keep dates, file names, and artifact roles intact.

- [ ] **Step 2: Translate archived docs while preserving historical framing**

Do not make archive docs sound more current than they are.

- [ ] **Step 3: Review archived docs for historical honesty after translation**

Ensure they still read as historical/background material.

Validation:
- targeted grep for Vietnamese across `docs/archive/**/*.md` and dated doc directories
- manual spot checks for historical framing

### Task 8: Final language sweep and verification

**Files:**
- Modify: any touched file that fails final verification

- [ ] **Step 1: Run full repo-wide Vietnamese detection**

Run the reusable detection helper from Task 1, plus repo-wide character search for Vietnamese text across checked-in kit files.

- [ ] **Step 2: Review any remaining matches manually**

Classify each remaining match as:
- intentional literal/historical quote
- missed translation
- machine-facing token that should remain

- [ ] **Step 3: Run wrapper regression tests**

Run:
```bash
node --test "tests/**/*.test.js"
```

Expected: PASS.

- [ ] **Step 4: Run legacy runtime regression tests**

Run:
```bash
node --test ".opencode/tests/*.test.js"
```

Expected: PASS.

- [ ] **Step 5: Perform final cross-surface read**

Read representative files from:
- `skills/`
- `agents/`
- `commands/`
- `assets/install-bundle/`
- `README.md`
- `AGENTS.md`
- `context/`
- `docs/`
- `docs/archive/`

Confirm:
- naturalized English tone
- preserved semantics
- no obvious source/bundle drift
- no mixed-language live kit surfaces remain unintentionally

- [ ] **Step 6: Perform explicit manual review of high-risk surfaces that may evade diacritic search**

Review at minimum:
- `skills/`
- `agents/`
- `commands/`
- `assets/install-bundle/`
- touched runtime/help docs

Look for:
- untranslated Vietnamese without diacritics
- mixed-language sentences
- naturalized-English regressions that changed meaning

- [ ] **Step 7: Prepare the handoff summary**

Document:
- what was translated
- what exceptions remain, if any
- how source-vs-derived alignment was preserved

## Risks

- Literal machine-contract tokens may be accidentally translated if translation scope is not tightly controlled.
- Source and bundle copies may drift if tasks do not follow the pairing rule strictly.
- Historical docs may lose their historical framing if translation over-modernizes them.
- Repo-wide grep may miss Vietnamese without diacritics, so manual high-risk review is required in addition to character search.

## Rollback Notes

- If a translated bundle copy diverges from its source meaning, revert the bundle change together with the paired source translation and redo the pair.
- If live docs become semantically ambiguous after translation, revert the affected doc cluster rather than blending old and new language styles.
- If archived docs lose historical framing, revert only those archive files and retranslate them with stronger historical guardrails.
