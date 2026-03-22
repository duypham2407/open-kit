# English Normalization Inventory

This checked-in inventory records the detection path, pairing rules, and latest completion state for the English-normalization effort.

Detection is heuristic-based. Maintainers must still review results for false positives and false negatives before using this inventory as a translation source of truth.

## Detection Path

- Reusable helper: `src/audit/vietnamese-detection.js`
- Internal command path: `openkit internal-audit-vietnamese`
- Command surface note: this is kept as a narrower maintainer audit helper, not a broad public product CLI command
- Scan scope: repo-wide checked-in files, with explicit exclusions for non-checked-in or generated areas such as `.git/`, `.worktrees/`, and `node_modules/`
- Machine-facing `.js` and `.json` files are scanned repo-wide to confirm they stay out of translation scope; translation priority applies only to human-facing markdown/text surfaces.
- Review note: heuristic detection may miss unaccented Vietnamese text and may occasionally flag non-Vietnamese content that uses overlapping Unicode ranges.

## Translation Priority

- `high`: authoring/runtime-facing instructional surfaces in `skills/`, `agents/`, `commands/`, and `.opencode/README.md`
- `medium`: human-facing derived or reference docs in `assets/install-bundle/opencode/` and `docs/`
- `low`: any remaining checked-in human-facing surfaces detected by the helper

## Current Vietnamese-Bearing Inventory

Latest checked-in audit result: no Vietnamese-bearing human-facing checked-in files remain in the tracked translation scope.

- Inventory status: `clear`
- High-priority checked-in markdown/text surfaces: `clear`
- Derived bundle copies paired from translated source surfaces: `clear`
- Re-run `openkit internal-audit-vietnamese` whenever new content lands instead of assuming this stays true forever.

## Source-Versus-Derived Pairing Map

- `skills/` -> `assets/install-bundle/opencode/skills/`
- `agents/` -> `assets/install-bundle/opencode/agents/`
- `commands/` -> `assets/install-bundle/opencode/commands/`
- `.opencode/README.md` -> `assets/install-bundle/opencode/README.md`

Current required pair coverage remains clear for the translated source and derived bundle surfaces:

- `agents/code-reviewer.md` -> `assets/install-bundle/opencode/agents/CodeReviewer.md`
- `skills/brainstorming/SKILL.md` -> `assets/install-bundle/opencode/skills/brainstorming/SKILL.md`
- `skills/code-review/SKILL.md` -> `assets/install-bundle/opencode/skills/code-review/SKILL.md`
- `skills/subagent-driven-development/SKILL.md` -> `assets/install-bundle/opencode/skills/subagent-driven-development/SKILL.md`
- `skills/systematic-debugging/SKILL.md` -> `assets/install-bundle/opencode/skills/systematic-debugging/SKILL.md`
- `skills/test-driven-development/SKILL.md` -> `assets/install-bundle/opencode/skills/test-driven-development/SKILL.md`
- `skills/using-skills/SKILL.md` -> `assets/install-bundle/opencode/skills/using-skills/SKILL.md`
- `skills/verification-before-completion/SKILL.md` -> `assets/install-bundle/opencode/skills/verification-before-completion/SKILL.md`
- `skills/writing-plans/SKILL.md` -> `assets/install-bundle/opencode/skills/writing-plans/SKILL.md`
- `skills/writing-specs/SKILL.md` -> `assets/install-bundle/opencode/skills/writing-specs/SKILL.md`
- `.opencode/README.md` -> `assets/install-bundle/opencode/README.md`

## Machine-Facing Literal Scope Check

- The reusable detector scans checked-in `.js` and `.json` files repo-wide, subject to the explicit exclusions above.
- Current result: no Vietnamese-bearing machine-facing `.js` or `.json` files were detected.
- Outcome: machine-facing literals remain out of translation scope and are currently confirmed clear by the heuristic audit.
