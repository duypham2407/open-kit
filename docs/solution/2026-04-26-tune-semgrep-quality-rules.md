---
artifact_type: solution_package
version: 1
status: ready
feature_id: FEATURE-942
feature_slug: tune-semgrep-quality-rules
source_scope_package: docs/scope/2026-04-26-tune-semgrep-quality-rules.md
owner: SolutionLead
approval_gate: solution_to_fullstack
handoff_rubric: pass
parallel_mode: none
---

# Solution Package: Tune Semgrep Quality Rules

## Source Scope And Approval Context

- Upstream scope: `docs/scope/2026-04-26-tune-semgrep-quality-rules.md`.
- Current lane/stage: `full` / `full_solution`.
- Approval context: `product_to_solution` is approved; this package is the `solution_to_fullstack` handoff artifact.
- Scope preservation: this solution only tunes bundled Semgrep quality-rule precision and regression coverage for FEATURE-942. It must not widen into direct tool exposure work from FEATURE-943 or syntax-outline path fixes from FEATURE-944.

## Chosen Approach

Use Semgrep's JavaScript-aware rule semantics to make `openkit.quality.no-var-declaration` match real `var` declarations only, then lock the behavior with direct Semgrep regression fixtures and JSON-output assertions.

This is enough because the noisy FEATURE-941 evidence points to the existing rule matching `const`/`let` declarations through Semgrep's JavaScript `let_is_var` equivalence, not to a missing scanner, missing gate, or need for a broad scan-pipeline redesign. The quality rule should stay AST/language-aware; it should not become a regex/text search and should not rely on bulk suppressions.

## Dependencies

- No new npm package dependency is required.
- Semgrep remains the existing local/managed external scanner documented in `docs/operator/semgrep.md`.
- The rule-specific validation requires a Semgrep executable. If `tool.rule-scan` is unavailable but `semgrep scan --json` can run as a substitute, record direct-tool unavailability and substitute-scan limits separately. If Semgrep itself is unavailable, implementation is blocked for rule-behavior acceptance until it is provisioned.
- No hosted Semgrep service, network-only upstream pack, target-project app command, or replacement scanner is required.
- Target-project application validation remains unavailable unless a real target project defines app-native build/lint/test commands. OpenKit Semgrep validation must not be reported as `target_project_app` evidence.

## Impacted Surfaces And Exact File Targets

### Primary rule pack

- `assets/semgrep/packs/quality-default.yml`
  - Primary edit: tune `openkit.quality.no-var-declaration`.
  - Expected approach: keep `languages: [javascript, typescript]`, keep the rule id and message stable, and add rule-level Semgrep options that disable `let`/`const` equivalence for `var` patterns.

### Regression fixtures and rule tests

- `tests/fixtures/semgrep/quality/no-var-positive.js` (create)
- `tests/fixtures/semgrep/quality/no-var-negative-modern.js` (create)
- `tests/fixtures/semgrep/quality/no-var-negative-text-metadata.js` (create)
- `tests/fixtures/semgrep/quality/no-var-mixed.js` (create)
- `tests/fixtures/semgrep/security/security-sanity.js` (create if security sanity uses a dedicated fixture)
- `tests/runtime/semgrep-quality-rules.test.js` (create) or, if the maintainer prefers a smaller surface, extend `tests/runtime/audit-tools.test.js` with a clearly separated Semgrep rule-pack regression section.

### Package/governance validation

- `package.json`
  - Likely edit: add a dedicated Semgrep rule-pack verification script such as `verify:semgrep-quality` and include it in `verify:all` once Semgrep availability is deterministic for CI/local validation.
- `.github/workflows/verify.yml`
  - Touch only if needed to provision Semgrep before `npm run verify:all` runs the new rule-pack regression script.
- `tests/runtime/governance-enforcement.test.js`
  - Touch only if docs/package governance assertions need to ensure bundled Semgrep packs and validation docs remain present.
- `tests/install/install-state.test.js`
  - Touch only if package/bundle validation changes the asset manifest expectations. Do not add Semgrep packs to the OpenCode-native install bundle unless implementation proves that the current `package.json` `files: ["assets/"]` path is insufficient.

### Documentation, only if behavior or command surfaces change

- `docs/operator/semgrep.md`
  - Update only if adding a new verification script, fixture policy, or CI/provisioning note.
- `docs/maintainer/test-matrix.md`
  - Update only if the Semgrep rule-pack regression command becomes part of the maintainer verification matrix.
- `context/core/project-config.md` and `AGENTS.md`
  - Update only if a new current repository validation command is introduced. Keep the target-project app validation boundary explicit.

### Surfaces intentionally not targeted

- `assets/semgrep/packs/security-audit.yml` should not change for FEATURE-942 unless a narrow, explicitly documented packaging/governance issue is discovered.
- `src/runtime/tools/audit/rule-scan.js`, `src/mcp-server/tool-schemas.js`, MCP tool exposure, and scan evidence schemas should not change for this feature. Those belong to adjacent scan-tool exposure/evidence work, not the rule precision fix.
- `src/runtime/tools/syntax/*` and syntax-outline path handling are out of scope.

## Boundaries And Components

- The quality pack remains the source of truth for bundled quality scans; this feature changes rule precision, not gate policy.
- `tool.rule-scan` and substitute `semgrep scan --json` evidence are `runtime_tooling` scan evidence. Preserved workflow evidence is `compatibility_runtime`. Neither is target-project app build/lint/test validation.
- Security scan behavior stays unchanged by default. Security validation for this feature is a sanity check against drift, not a redesign of security rules.
- False-positive reduction must come from AST-aware rule behavior and regression coverage, not from removing the no-`var` rule, making all quality warnings non-blocking, excluding broad paths, or suppressing findings without tests.
- Code Reviewer and QA still need real scan evidence or explicitly caveated substitute/manual evidence. Cleaner output must make scan gates more trustworthy, not optional.

## Technical Approach

### Rule tuning decision

Prefer the smallest precise Semgrep rule change:

```yaml
  - id: openkit.quality.no-var-declaration
    options:
      let_is_var: false
    patterns:
      - pattern: var $X = ...;
    message: "Prefer const or let over var."
    languages: [javascript, typescript]
    severity: WARNING
```

Implementation details:

- `options.let_is_var: false` is the key precision control. It tells Semgrep's JavaScript matcher not to treat `let`/`const` declarations as equivalent to `var` for this rule.
- Keep the rule language-specific (`javascript`, `typescript`) so strings, comments, object keys, metadata, Markdown, JSON, and plain text are not searched as raw text.
- Do not replace the rule with `pattern-regex: "\\bvar\\b"`; that would reintroduce the docs/string/comment/object-key false positives this feature is meant to remove.
- Do not add broad `paths.exclude` or blanket suppressions to hide noisy areas. The acceptance target is rule precision, not target removal.
- If implementation chooses to expand coverage for uninitialized declarations (`var x;`) or `for (var i = 0; ...)`, it must do so with AST-aware `pattern-either` entries under the same `let_is_var: false` option and must add positive fixtures proving no new false positives were introduced. Do not broaden actual declaration coverage unless the regression suite remains clean.

### Fixture/test harness decision

Create focused fixture files and a Node test harness that executes the real Semgrep CLI, parses JSON, normalizes the rule id, and asserts rule-level finding counts.

The existing `tests/runtime/audit-tools.test.js` mostly fakes Semgrep output to validate OpenKit scan result shapes. FEATURE-942 needs at least one real Semgrep scan path because the acceptance hotspot is Semgrep rule behavior itself.

Recommended helper behavior in `tests/runtime/semgrep-quality-rules.test.js`:

- Resolve pack paths from the repository root:
  - `assets/semgrep/packs/quality-default.yml`
  - `assets/semgrep/packs/security-audit.yml`
- Use `getToolingEnv(process.env)` from `src/global/tooling.js` when invoking Semgrep so the managed tooling bin path is honored.
- Run Semgrep with JSON output:
  - `semgrep scan --json --config assets/semgrep/packs/quality-default.yml tests/fixtures/semgrep/quality/no-var-positive.js`
  - `semgrep scan --json --config assets/semgrep/packs/quality-default.yml tests/fixtures/semgrep/quality/no-var-negative-modern.js`
  - `semgrep scan --json --config assets/semgrep/packs/quality-default.yml tests/fixtures/semgrep/quality/no-var-negative-text-metadata.js`
  - `semgrep scan --json --config assets/semgrep/packs/quality-default.yml tests/fixtures/semgrep/quality/no-var-mixed.js`
  - `semgrep scan --json --config assets/semgrep/packs/security-audit.yml tests/fixtures/semgrep/security/security-sanity.js` if security sanity uses a fixture.
- Treat Semgrep exit code `0` as no findings and `1` as findings present; fail for parse errors or other non-success exit codes.
- Normalize local check ids because Semgrep can report path-prefixed ids such as `assets.semgrep.packs.openkit.quality.no-var-declaration`. The assertion should treat a finding as the no-`var` rule when `check_id === "openkit.quality.no-var-declaration"` or `check_id.endsWith(".openkit.quality.no-var-declaration")`.
- Persist raw JSON output only if the test harness or validation command intentionally writes artifacts; otherwise the parsed test failure should include fixture path, rule id, and finding count.

### Fixture categories

Positive cases:

- `no-var-positive.js`: one simple actual declaration such as `var legacyValue = 1;` with an assertion that exactly one no-`var` finding appears for that fixture.
- Optional additional positives, only if the rule is expanded: `var uninitialized;`, `for (var i = 0; i < 1; i += 1) { ... }`, or multiple declarators. Add these only with explicit expected counts.

Negative cases:

- `no-var-negative-modern.js`: `const`, `let`, ESM `import`, and test-style syntax that should produce zero no-`var` findings. Avoid `console.log`, `debugger`, `eval`, `TODO`, or empty `catch` so unrelated quality rules do not obscure the no-`var` assertion.
- `no-var-negative-text-metadata.js`: object keys/properties such as `var`, `variant`, `vars`, `MY_VAR_NAME`, metadata-like objects, comments, string literals, template literals, and test titles that mention `var`; expected no-`var` finding count is zero.
- `no-var-mixed.js`: one real `var` declaration plus multiple non-violation mentions; expected no-`var` finding count is exactly one and its line should be the real declaration line.

Security sanity:

- `security-sanity.js`: one known security rule trigger such as `eval(userInput)` or `new Function(source)` with JSON assertion that the corresponding `openkit.security.*` rule still reports. This protects against accidental security-pack drift while keeping `assets/semgrep/packs/security-audit.yml` unchanged.

## Interfaces And Data Contracts

### Rule result contract for tests/evidence

For rule-pack regression tests, assert a compact Semgrep JSON contract:

```js
{
  version: string,
  results: [
    {
      check_id: string,
      path: string,
      start: { line: number, col: number },
      end: { line: number, col: number },
      extra: { message: string, severity: string }
    }
  ]
}
```

Test helpers should derive:

- `noVarFindings`: findings whose normalized id is `openkit.quality.no-var-declaration`.
- `securityFindings`: findings whose normalized id begins with `openkit.security.` for the sanity fixture.
- `otherQualityFindings`: findings from other `openkit.quality.*` rules, reported separately and not counted as no-`var` evidence.

### Evidence labels

- Direct runtime tool scan: `runtime_tooling`, evidence type `direct_tool`.
- Substitute CLI scan: `runtime_tooling`, evidence type `substitute_scan`, with direct-tool unavailability or degradation recorded separately.
- Workflow-state evidence record/read model: `compatibility_runtime`.
- Package/script/docs verification: `global_cli/package verification`, `governance`, or `documentation` as applicable.
- Target-project app validation: explicitly `unavailable` for this work item unless a real target project declares app-native commands.

## Risks And Trade-offs

- Semgrep availability is an environmental dependency. Acceptance requires an actual Semgrep rule scan over fixtures; manual review alone is insufficient for the rule-behavior claim.
- Semgrep rule ids may be path-prefixed in JSON output. Tests that require exact bare ids will be brittle; normalize by suffix while still reporting the original `check_id` in failures.
- Adding the new Semgrep regression script to `verify:all` may require CI Semgrep provisioning. If provisioning is added, keep it limited to Semgrep and document that it validates OpenKit runtime/tooling governance, not target-project app behavior.
- Expanding the no-`var` rule beyond the current initialized-declaration pattern can improve coverage but increases false-positive risk. Keep the first implementation minimal unless fixtures prove additional actual declaration forms are needed.
- Security sanity should prove no accidental drift; it must not become a reason to edit `security-audit.yml` in this feature.

## Recommended Path

- Execute sequentially using a test-first flow.
- First add the regression harness and fixtures so the current false-positive behavior is visible.
- Then tune `quality-default.yml` with `options.let_is_var: false` and rerun the fixture scans.
- Finally wire package/governance validation and record workflow evidence with the correct validation surfaces.

## Implementation Slices

### [ ] TASK-F942-HARNESS: Add Semgrep no-var regression fixtures and JSON assertions

- **Files**:
  - `tests/fixtures/semgrep/quality/no-var-positive.js` (create)
  - `tests/fixtures/semgrep/quality/no-var-negative-modern.js` (create)
  - `tests/fixtures/semgrep/quality/no-var-negative-text-metadata.js` (create)
  - `tests/fixtures/semgrep/quality/no-var-mixed.js` (create)
  - `tests/runtime/semgrep-quality-rules.test.js` (create) or `tests/runtime/audit-tools.test.js` (extend in a clearly separated section)
- **Goal**: make the accepted no-`var` behavior executable and observable before tuning the rule.
- **Dependencies**: none.
- **Validation command**:
  - During TDD red step: `node --test tests/runtime/semgrep-quality-rules.test.js` should fail against the current `quality-default.yml` because `const`/`let` fixtures are expected to expose the existing false-positive behavior.
  - After TASK-F942-RULE: the same command must pass.
- **Details**:
  - Include positive, negative-modern, negative-text/metadata, and mixed fixtures.
  - Use JSON-output assertions filtered by normalized no-`var` rule id.
  - Negative fixtures must avoid unrelated quality-rule triggers where possible; if other quality findings appear, group them separately and ensure no-`var` count remains zero.

### [ ] TASK-F942-RULE: Tune `openkit.quality.no-var-declaration`

- **Files**:
  - `assets/semgrep/packs/quality-default.yml`
- **Goal**: eliminate false positives from `const`, `let`, imports, strings/comments, object keys, env-var/metadata text, and docs/test strings while preserving actual `var` declaration detection.
- **Dependencies**: `TASK-F942-HARNESS`.
- **Validation command**:
  - `node --test tests/runtime/semgrep-quality-rules.test.js`
  - Optional direct fixture smoke: `semgrep scan --json --config assets/semgrep/packs/quality-default.yml tests/fixtures/semgrep/quality/`
- **Details**:
  - Add rule-level `options.let_is_var: false` for the no-`var` rule.
  - Keep an AST/language-specific pattern; do not replace with regex.
  - Keep security pack untouched.
  - Only add `pattern-either` for additional real `var` declaration forms if the fixtures explicitly assert those forms and no negative fixture regresses.

### [ ] TASK-F942-GOVERNANCE: Wire package/governance validation without app-native claims

- **Files**:
  - `package.json`
  - `.github/workflows/verify.yml` (only if needed for Semgrep availability in CI)
  - `tests/runtime/governance-enforcement.test.js` (only if governance assertions need to cover the new command/docs)
  - `docs/operator/semgrep.md` and `docs/maintainer/test-matrix.md` (only if a new verification command or fixture policy is introduced)
  - `context/core/project-config.md` and `AGENTS.md` (only if a new current validation command is introduced)
- **Goal**: make the rule-pack regression suite easy to run and, if feasible, part of the package verification path while preserving validation-surface language.
- **Dependencies**: `TASK-F942-RULE`.
- **Validation command**:
  - `npm run verify:governance`
  - `npm run verify:install-bundle`
  - `npm run verify:all`
- **Details**:
  - Add a script such as `verify:semgrep-quality` if the test is not simply included in an existing targeted test command.
  - If `verify:semgrep-quality` is added to `verify:all`, ensure CI/local docs provision Semgrep so the command fails only for real regressions or explicit Semgrep unavailability, not because the executable is silently absent.
  - Confirm `package.json` still includes `assets/` in packaged files so tuned Semgrep packs ship through the global OpenKit package path.
  - Do not add target-project app build/lint/test claims.

### [ ] TASK-F942-EVIDENCE: Run final scans and record workflow evidence

- **Files/artifacts**:
  - `.openkit/artifacts/feature-942-semgrep-quality.json` or equivalent raw quality-scan artifact if the implementation captures raw Semgrep JSON.
  - `.openkit/artifacts/feature-942-semgrep-security-sanity.json` or equivalent security sanity artifact if captured.
  - Workflow-state verification evidence records for FEATURE-942.
- **Goal**: provide Code Reviewer and QA with concise, classified scan evidence and correct validation-surface labels.
- **Dependencies**: `TASK-F942-GOVERNANCE`.
- **Validation command**:
  - `node .opencode/workflow-state.js validate`
  - `node .opencode/workflow-state.js status --short`
  - `node .opencode/workflow-state.js resume-summary --json` if structured evidence read-model inspection is needed.
- **Details**:
  - Record quality rule regression evidence as `runtime_tooling` for the scan/test execution and `compatibility_runtime` when stored/read through workflow state.
  - Include direct-tool status if `tool.rule-scan` ran; otherwise include substitute-scan status for the Semgrep CLI command and the direct-tool limitation.
  - Security sanity evidence should state that `security-audit.yml` behavior is unchanged or report any narrow incidental packaging/governance issue separately.
  - Explicitly state target-project app validation is unavailable for FEATURE-942.

## Dependency Graph

```text
TASK-F942-HARNESS
  -> TASK-F942-RULE
  -> TASK-F942-GOVERNANCE
  -> TASK-F942-EVIDENCE
```

Critical path: regression harness first, rule tuning second, governance/package wiring third, evidence closeout last.

## Parallelization Assessment

- parallel_mode: `none`
- why: this work touches one shared rule pack, one fixture expectation set, package verification wiring, and scan-evidence interpretation. Parallel implementation would risk tests and rule semantics diverging or evidence being recorded before the final rule behavior is known.
- safe_parallel_zones: []
- sequential_constraints:
  - `TASK-F942-HARNESS -> TASK-F942-RULE -> TASK-F942-GOVERNANCE -> TASK-F942-EVIDENCE`
- integration_checkpoint: after `TASK-F942-RULE`, the no-`var` fixture suite must show the intended positive count and zero known non-violation findings before package/governance wiring or evidence closeout proceeds.
- max_active_execution_tracks: 1

## Fixture And Test Strategy

| Fixture category | Expected no-var result | Notes |
| --- | --- | --- |
| Actual `var` declaration | One no-`var` finding per expected declaration | Use one simple initialized declaration for the required positive. Add more positives only when rule support is intentionally expanded. |
| `const` / `let` declarations | Zero no-`var` findings | This is the primary FEATURE-941 false-positive guard. |
| ESM `import` declarations | Zero no-`var` findings | Include import syntax in `no-var-negative-modern.js`. |
| Object keys/properties and metadata keys containing `var` | Zero no-`var` findings | Include `var`, `variant`, `vars`, and `MY_VAR_NAME` in object/metadata-like contexts. |
| Strings, template literals, comments, test titles, docs-like text | Zero no-`var` findings | Keep these in JS fixtures so the language-specific parser is still exercised. |
| Mixed fixture with one real `var` and many mentions | Exactly one no-`var` finding | Assert the finding path/line maps to the real declaration, not text mentions. |
| Security sanity fixture | Expected `openkit.security.*` finding still appears | Proves quality rule tuning did not silently break the security pack path. |

## Validation Matrix

| Acceptance / invariant | Implementation proof | Validation path |
| --- | --- | --- |
| Actual JavaScript `var` declarations are still caught | Positive fixture has expected no-`var` finding count and line | `node --test tests/runtime/semgrep-quality-rules.test.js`; optional raw `semgrep scan --json --config assets/semgrep/packs/quality-default.yml tests/fixtures/semgrep/quality/no-var-positive.js` |
| `const` and `let` declarations do not trigger no-`var` | Negative-modern fixture returns zero normalized no-`var` findings | `node --test tests/runtime/semgrep-quality-rules.test.js` |
| ESM imports do not trigger no-`var` | Negative-modern fixture includes ESM imports and returns zero no-`var` findings | `node --test tests/runtime/semgrep-quality-rules.test.js` |
| Object keys, env-var text, metadata-like text do not trigger no-`var` | Negative-text/metadata fixture returns zero no-`var` findings | `node --test tests/runtime/semgrep-quality-rules.test.js` |
| Docs/comments/test strings mentioning `var` do not trigger no-`var` | Text/comment/string fixture returns zero no-`var` findings | `node --test tests/runtime/semgrep-quality-rules.test.js` |
| Mixed actual declaration plus text mentions reports only declaration | Mixed fixture returns exactly one no-`var` finding on the declaration line | `node --test tests/runtime/semgrep-quality-rules.test.js` |
| Security scan behavior remains unchanged | Security sanity fixture reports expected `openkit.security.*` finding; `assets/semgrep/packs/security-audit.yml` is not edited unless explicitly justified | `node --test tests/runtime/semgrep-quality-rules.test.js` or dedicated security sanity command; Code Reviewer checks `git diff -- assets/semgrep/packs/security-audit.yml` |
| Package/global path receives tuned rule pack | Packaged `assets/` path still includes `assets/semgrep/packs/quality-default.yml`; install bundle drift remains absent | `npm run verify:install-bundle`; `npm run verify:all`; package/governance tests if added |
| Scan gates are not bypassed | Evidence records preserve direct/substitute/manual distinction and validation-surface labels | `node .opencode/workflow-state.js validate`; `node .opencode/workflow-state.js resume-summary --json` |
| No target-project app validation claim | Reports identify target-project app validation as unavailable for FEATURE-942 | Code Review/QA artifact inspection; governance/doc tests if docs changed |

## Integration Checkpoint

Before requesting Code Review, Fullstack must provide a concise evidence note showing:

- `openkit.quality.no-var-declaration` uses AST/language-specific matching with `options.let_is_var: false` or an equivalently precise Semgrep option-based solution.
- Positive no-`var` fixture reports the expected actual `var` declaration finding.
- Negative fixtures for `const`, `let`, imports, object keys, env-var/metadata text, comments, strings, test titles, and docs-like text report zero normalized no-`var` findings.
- Mixed fixture reports only the real declaration.
- Security sanity still reports the expected `openkit.security.*` finding and `security-audit.yml` is unchanged unless a narrow, documented packaging/governance need was discovered.
- Package/governance validation ran with real command outputs or blockers were recorded honestly.
- Workflow-state evidence uses `runtime_tooling` for scan/test execution, `compatibility_runtime` for stored/read evidence, and marks `target_project_app` validation unavailable.

## Task Board Recommendation

Create a full-delivery task board for `feature-942` only if the active runtime requires board-backed implementation coordination. Keep it sequential with `parallel_mode: none`.

Recommended tasks:

| Task id | Title | Kind | Depends on | Primary artifact refs | Validation |
| --- | --- | --- | --- | --- | --- |
| `TASK-F942-HARNESS` | Add no-var Semgrep regression harness | `implementation` | none | `tests/fixtures/semgrep/quality/`, `tests/runtime/semgrep-quality-rules.test.js` | `node --test tests/runtime/semgrep-quality-rules.test.js` red first, then green after rule tuning |
| `TASK-F942-RULE` | Tune bundled no-var quality rule | `implementation` | `TASK-F942-HARNESS` | `assets/semgrep/packs/quality-default.yml` | `node --test tests/runtime/semgrep-quality-rules.test.js` |
| `TASK-F942-GOVERNANCE` | Wire package and governance validation | `implementation` | `TASK-F942-RULE` | `package.json`, `.github/workflows/verify.yml` if needed, docs/tests if changed | `npm run verify:governance`; `npm run verify:install-bundle`; `npm run verify:all` |
| `TASK-F942-EVIDENCE` | Record scan and workflow-state evidence | `verification` | `TASK-F942-GOVERNANCE` | `.openkit/artifacts/`, `.opencode/workflow-state.json` via CLI/tool evidence records | `node .opencode/workflow-state.js validate`; `node .opencode/workflow-state.js status --short` |

Recommended task-board commands, if a board is created by the runtime owner:

```sh
node .opencode/workflow-state.js set-parallelization none "FEATURE-942 is a shared rule-pack and evidence-quality change; execute sequentially to keep fixtures, rule behavior, package verification, and recorded evidence aligned." "After TASK-F942-RULE, verify the no-var fixture suite before governance wiring; after TASK-F942-EVIDENCE, run final package/governance/workflow-state validation before Code Review." 1
node .opencode/workflow-state.js create-task feature-942 TASK-F942-HARNESS "Add no-var Semgrep regression harness" implementation
node .opencode/workflow-state.js create-task feature-942 TASK-F942-RULE "Tune bundled no-var quality rule" implementation
node .opencode/workflow-state.js create-task feature-942 TASK-F942-GOVERNANCE "Wire package and governance validation" implementation
node .opencode/workflow-state.js create-task feature-942 TASK-F942-EVIDENCE "Record scan and workflow-state evidence" verification
```

Current `create-task` CLI support is minimal and may not encode every dependency or artifact ref above. With `parallel_mode: none`, runtime coordination should keep only one active task at a time, and this solution package remains the authoritative dependency/artifact plan unless a richer board mutation path is used.

## Rollback Notes

- Roll back `assets/semgrep/packs/quality-default.yml` together with the no-`var` fixtures/tests if the tuned rule proves incompatible with Semgrep versions in supported environments.
- If CI provisioning for Semgrep causes operational instability, roll back the CI/script wiring separately from the rule fix only if maintainers can still run the Semgrep fixture suite through an explicit required validation path.
- Do not roll back by disabling scan gates, removing the no-`var` rule, excluding broad directories, or converting findings to manual overrides.
- Do not hand-edit workflow-state JSON for evidence rollback; use `.opencode/workflow-state.js` or runtime evidence tools.
- Security-pack changes should not be part of normal rollback because security pack behavior is intended to remain unchanged.

## Reviewer Focus Points

- Confirm `openkit.quality.no-var-declaration` uses `options.let_is_var: false` or another Semgrep-native AST-aware precision control, not regex/text matching.
- Confirm negative fixtures include every scope-required false-positive category and produce zero no-`var` findings.
- Confirm positive and mixed fixtures still detect actual `var` declarations.
- Confirm rule id normalization in tests handles path-prefixed Semgrep `check_id` values without hiding unexpected rule ids.
- Confirm `assets/semgrep/packs/security-audit.yml` is unchanged or that any narrow incidental change is explicitly justified and separately validated.
- Confirm package/governance validation does not claim target-project app build/lint/test coverage.
- Confirm scan evidence, if recorded, preserves direct-tool/substitute/manual distinctions and validation-surface labels.

## QA Focus Points

- Re-run the Semgrep quality fixture command or inspect the recorded artifact to verify no-`var` counts by fixture category.
- Verify remaining quality findings, if any, are grouped by rule and not misclassified as no-`var` evidence.
- Verify security sanity evidence is present and security scan behavior was not weakened.
- Verify workflow-state evidence read models preserve `runtime_tooling` and `compatibility_runtime` labels and do not represent OpenKit scan tests as `target_project_app` validation.
- Verify no FEATURE-943 or FEATURE-944 work was smuggled into this implementation.

## Fullstack Handoff

- Implement only the approved rule precision and regression coverage work.
- Use the slice order above; write the regression harness before changing the rule.
- Prefer direct Semgrep fixture validation. If direct runtime scan tooling is unavailable but Semgrep CLI works, record substitute-scan evidence with the direct-tool limitation.
- Keep `security-audit.yml` unchanged unless an explicitly documented narrow packaging/governance issue is discovered.
- Do not add app-native build/lint/test commands or claim target-project app validation.
- Do not create commits unless explicitly requested by the user.

## Handoff Recommendation

- `solution_to_fullstack`: **PASS**.
- Reason: this package provides a single recommended AST-aware Semgrep rule approach, exact impacted file targets, fixture/test strategy with positive and negative categories, sequential task slices with validation hooks, conservative parallelization, package/workflow-state evidence expectations, rollback notes, and explicit out-of-scope boundaries for FEATURE-943, FEATURE-944, security-rule changes, scan-gate bypasses, and target-project app validation claims.
