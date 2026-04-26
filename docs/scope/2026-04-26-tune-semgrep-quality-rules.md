---
artifact_type: scope_package
version: 1
status: approval_ready
feature_id: FEATURE-942
feature_slug: tune-semgrep-quality-rules
owner: ProductLead
approval_gate: product_to_solution
handoff_rubric: pass
---

# Scope Package: Tune Semgrep Quality Rules

OpenKit should reduce noisy bundled Semgrep quality-scan output after FEATURE-941 by tightening rule behavior and adding regression coverage for the quality rule pack, especially `openkit.quality.no-var-declaration`, so Code Reviewer and QA can trust scan evidence without manual triage of modern JavaScript, ESM, documentation, fixture, metadata, or test-string false positives.

## Goal

- Make bundled OpenKit Semgrep quality scans precise enough that normal modern JavaScript patterns do not produce high-volume false-positive evidence.
- Add regression coverage that proves intended `var` declaration violations are still caught while known non-violations do not trigger `openkit.quality.no-var-declaration`.
- Preserve existing OpenKit workflow gates, scan evidence semantics, validation-surface labels, and security scan behavior.

## Target Users

- **Code Reviewer:** needs quality scan evidence that highlights real review concerns without hundreds of false positives drowning out the signal.
- **QA Agent:** needs scan output that can be classified and cited in QA evidence without excessive manual triage of irrelevant findings.
- **Maintainer:** needs a governed bundled rule pack with regression coverage before future rule changes are accepted.
- **Future developer:** needs clear examples of violating and non-violating code so rule intent is safe to modify without reintroducing noisy matches.

## Problem Statement

FEATURE-941 review and QA surfaced that the bundled Semgrep quality rule `openkit.quality.no-var-declaration` overmatched common non-violations, producing hundreds of false-positive findings against modern JavaScript/ESM syntax, tests, docs-like strings, metadata, and object-key/env-var text. That noise made scan evidence harder to trust and forced manual triage. OpenKit needs tighter quality-rule behavior and regression coverage so review and QA scan evidence remains useful, without weakening security scans or bypassing workflow gates.

## In Scope

- Tune bundled OpenKit Semgrep quality rules that are responsible for noisy false positives, with primary focus on `openkit.quality.no-var-declaration`.
- Preserve detection of actual JavaScript `var` declarations as violations.
- Add regression fixtures or equivalent coverage for intended violations and known non-violations.
- Cover non-violations including `const`, `let`, `import`, object keys, environment variable text, docs/test strings, metadata-like text, and ESM/test-file syntax where relevant.
- Validate that review/QA evidence from quality scans becomes lower-noise and easier to classify.
- Preserve scan evidence reporting expectations from FEATURE-939: direct/substitute distinction, finding counts, classification, false-positive rationale, artifact references, and validation-surface labels.
- Keep security scan behavior unchanged unless implementation uncovers an adjacent packaging/governance need that must be explicitly reported and routed.
- Preserve OpenKit Full Delivery gates and role boundaries; this work improves scan trustworthiness and does not bypass scan gates.

## Out of Scope

- Replacing Semgrep with another scanner or adding a hosted/external scanning service.
- Removing the no-`var` quality rule or making all quality warnings non-blocking by default.
- Broad redesign of the scan evidence pipeline, workflow-state schema, role gates, or lane/stage model.
- Changing security scan rules except for narrowly necessary packaging/governance follow-up discovered during validation.
- Adding or claiming target-project application build, lint, or test commands.
- Introducing unrelated MCP, supervisor dialogue, OpenClaw, or secret-handling changes.
- Bulk suppression of findings without regression tests that encode the intended rule behavior.

## Users And User Journeys

1. **As a Code Reviewer, I want `openkit.quality.no-var-declaration` findings to correspond to actual `var` declarations, so that quality evidence identifies real code-review concerns instead of normal JavaScript syntax.**
2. **As a QA Agent, I want quality scan results to have low false-positive volume, so that QA can cite scan evidence without manually triaging hundreds of irrelevant matches.**
3. **As a maintainer, I want rule-pack regression coverage for both violations and non-violations, so that future Semgrep rule edits cannot silently reintroduce FEATURE-941 noise.**
4. **As a future developer, I want the bundled rule-pack expectations to be visible in tests and docs where updated, so that I can safely extend quality rules without weakening gates or security scans.**

## Product And Business Rules

### Quality Rule Behavior

- `openkit.quality.no-var-declaration` must flag actual JavaScript `var` declarations in scanned source contexts.
- The no-`var` rule must not flag `const` declarations.
- The no-`var` rule must not flag `let` declarations.
- The no-`var` rule must not flag ESM `import` declarations.
- The no-`var` rule must not flag object keys, property names, metadata keys, environment variable names, or plain text that contains the substring `var` or the token-like text `var` when it is not a JavaScript `var` declaration.
- The no-`var` rule must not flag documentation text, test names, fixture strings, comments, or metadata descriptions that merely mention `var`.
- The rule-pack may still flag unsupported or syntactically invalid files only when the scanner can identify an actual rule violation; parse errors or unsupported-file behavior must be reported honestly rather than converted into noisy findings.

### False-Positive Tolerance

- Known non-violation fixture categories listed in this scope must produce zero findings for `openkit.quality.no-var-declaration`.
- If any known non-violation category still triggers the no-`var` rule after implementation, the feature fails acceptance unless Solution Lead explicitly routes that category as an out-of-scope product gap.
- Existing unrelated quality rules may still report their own findings, but they must not be misclassified as no-`var` evidence.
- Raw scan output should remain inspectable, but human-facing review/QA evidence must not require triaging high-volume false-positive walls to understand the gate decision.

### Evidence Quality And Workflow Gates

- Quality scan evidence remains `runtime_tooling` evidence when a direct or substitute scan runs, and `compatibility_runtime` evidence when preserved or read through workflow state.
- Quality scan evidence must not be presented as target-project application build, lint, or test validation.
- Review/QA reports must preserve direct-tool, substitute-scan, and manual-override distinctions if those paths are used.
- This feature must not create a bypass around scan gates; cleaner rule output should make gates more trustworthy, not optional.
- Classification of any remaining quality findings must use the existing scan evidence categories: `blocking`, `true_positive`, `non_blocking_noise`, `false_positive`, `follow_up`, and `unclassified` where applicable.

### Bundled Rule-Pack Governance

- Bundled Semgrep quality rules must carry regression coverage for every high-risk false-positive category fixed by this work.
- Rule-pack tests must include at least one positive no-`var` example and multiple negative examples that cover modern JavaScript and text/metadata contexts.
- Future rule-pack changes should be blocked or visibly fail validation when they reintroduce known no-`var` false positives.
- Security rule behavior is preserved by default. If adjacent packaging or governance changes are required to test or ship quality rules safely, Solution Lead must keep them narrow and report the reason in the solution package.

## Acceptance Criteria Matrix

### No-`var` Rule Precision

- **Given** a scanned JavaScript fixture contains an actual `var` declaration, **when** the bundled OpenKit quality rule pack runs, **then** `openkit.quality.no-var-declaration` reports that declaration as a violation.
- **Given** scanned JavaScript fixtures contain `const` and `let` declarations only, **when** the quality rule pack runs, **then** `openkit.quality.no-var-declaration` reports zero findings for those declarations.
- **Given** scanned ESM fixtures contain `import` declarations, **when** the quality rule pack runs, **then** `openkit.quality.no-var-declaration` reports zero findings for those imports.
- **Given** scanned fixtures contain object keys, metadata keys, environment variable names, or property text containing `var`, **when** the quality rule pack runs, **then** `openkit.quality.no-var-declaration` reports zero findings for those non-declaration contexts.
- **Given** scanned docs, comments, tests, or fixture strings mention `var`, **when** the quality rule pack runs, **then** `openkit.quality.no-var-declaration` reports zero findings for those text-only mentions.

### Regression Coverage

- **Given** the bundled quality rule tests are run, **when** the no-`var` positive fixture is evaluated, **then** the expected violation is asserted by rule id.
- **Given** the bundled quality rule tests are run, **when** negative fixtures for `const`, `let`, `import`, object keys, env-var text, docs/test strings, and metadata are evaluated, **then** each category asserts zero `openkit.quality.no-var-declaration` findings.
- **Given** a future maintainer changes the no-`var` rule in a way that reintroduces a known false positive, **when** the regression suite runs, **then** validation fails with enough rule/fixture context to identify the broken category.

### Review And QA Evidence Quality

- **Given** Code Reviewer or QA runs the relevant quality scan against the OpenKit scope used for this feature, **when** scan evidence is summarized, **then** the no-`var` finding count reflects actual violations or zero findings rather than hundreds of false positives from modern JS/ESM/test/docs/metadata contexts.
- **Given** quality scan output contains remaining findings from other rules, **when** evidence is reported, **then** those findings are grouped by rule and classified separately from `openkit.quality.no-var-declaration`.
- **Given** a scan tool is unavailable or substituted, **when** review or QA records evidence, **then** the report states the direct-tool status, substitute status, validation surface, finding counts, limitations, and artifact references without claiming unavailable direct tooling succeeded.

### Security And Gate Preservation

- **Given** existing security scan behavior is unrelated to the noisy quality rule, **when** this feature is implemented, **then** security rule behavior and security evidence requirements remain unchanged unless an explicitly documented adjacent packaging/governance need is found.
- **Given** a full-delivery gate requires scan evidence, **when** quality scan output is cleaner, **then** the gate still requires real scan evidence or an explicit allowed substitute/override; the feature does not permit bypassing review or QA scan gates.
- **Given** no app-native build/lint/test command exists for a target project, **when** validation is reported, **then** target-project application validation is marked unavailable rather than replaced by OpenKit quality scan evidence.

## Edge Cases

- A file contains `var` inside a string literal, template literal, comment, test title, Markdown/code fence, JSON metadata, YAML-like metadata, or package metadata field.
- A file contains variable names, object keys, or environment variable names with `var` as a substring, such as `variant`, `vars`, or `MY_VAR_NAME`.
- A fixture contains both one real `var` declaration and multiple non-violation mentions; the rule should report only the actual declaration.
- A scanned file uses ESM syntax, CommonJS syntax, test framework syntax, or mixed fixture syntax.
- A scan target includes generated files, unsupported extensions, malformed samples, or docs-only files.
- Semgrep exits non-zero, times out, returns partial output, or cannot parse a fixture.
- Direct runtime scan tooling is unavailable and a substitute Semgrep command is used for evidence.
- Global-package and checked-in authoring rule packs diverge in a way that could produce different scan behavior.
- A broad rule-pack change accidentally modifies security scan output while tuning quality rules.

## Error And Failure Cases

- `openkit.quality.no-var-declaration` reports findings for `const`, `let`, `import`, object keys, env-var text, docs/test strings, or metadata-only contexts.
- Actual JavaScript `var` declarations are no longer detected.
- Regression coverage only checks positive examples and does not protect known false-positive categories.
- Review/QA evidence reports high-volume raw scan output without a rule-level summary or classification.
- A substituted scan is reported as successful direct `tool.rule-scan` evidence.
- OpenKit quality scan evidence is described as target-project application lint/test/build validation.
- Security scan behavior changes without an explicit, scoped rationale and validation.
- Workflow gates are weakened, skipped, or described as optional because quality scan noise was reduced.

## Validation Expectations By Surface

| Surface label | Expected validation |
| --- | --- |
| `runtime_tooling` | Validate bundled Semgrep quality rule behavior and regression fixtures; show direct or substitute scan status, rule ids, finding counts, non-violation coverage, and any remaining classified quality findings. |
| `governance` | Validate the bundled rule pack now has regression expectations for noisy quality rules and that future rule changes have an inspectable pass/fail guard. Treat this as rule-pack governance, not a workflow-gate bypass. |
| `global_cli/package verification` | If packaging surfaces are touched, validate the shipped/global OpenKit package path includes the tuned quality rule pack and related tests/fixtures or metadata needed to avoid checked-in vs packaged behavior drift. |
| `documentation` | If docs are updated, validate they accurately describe current scan-rule behavior, evidence labels, and target-project validation boundaries without claiming new app-native commands. |
| `compatibility_runtime` | Validate any preserved scan evidence or workflow-state evidence records keep the correct validation-surface labels and direct/substitute/manual distinction. |
| `target_project_app` | Unavailable unless a target project defines real app-native build, lint, test, smoke, or regression commands; OpenKit Semgrep/rule-pack validation must not be reported as target application validation. |

## Open Questions And Assumptions

- Assumption: FEATURE-941 evidence is used only as factual motivation that the no-`var` rule generated high-volume false positives; this scope does not depend on hidden FEATURE-941 artifacts to be valid.
- Assumption: the primary noisy rule is `openkit.quality.no-var-declaration`; Solution Lead may include adjacent quality-rule tuning only when scan/regression evidence shows it is part of the same false-positive problem.
- Assumption: security scan behavior should remain unchanged; any adjacent security packaging/governance issue must be surfaced as a narrow implementation risk or separate follow-up.
- Open question for Solution Lead: decide the exact test harness, fixture organization, and direct-vs-substitute scan command strategy that best proves the acceptance criteria without inventing target-project app validation.

## Handoff Notes For Solution Lead

- Keep the solution focused on Semgrep quality-rule precision and regression coverage, not broad scan-pipeline redesign.
- Treat `openkit.quality.no-var-declaration` as the acceptance hotspot: it must still catch real `var` declarations and must not match the listed non-violation categories.
- Preserve FEATURE-939 scan evidence semantics and validation-surface labeling in any review/QA evidence produced downstream.
- Do not claim app-native build, lint, or test validation unless a real target project command exists.
- If implementation touches package/global install surfaces, include package-drift validation so the tuned rule pack is what operators receive through OpenKit.
- Keep security scan behavior unchanged unless a narrow, documented governance or packaging dependency is necessary to validate or ship the quality-rule fix.

## Success Signal

- Code Reviewer and QA can run or cite OpenKit quality scan evidence for the tuned rule pack with `openkit.quality.no-var-declaration` producing findings only for actual `var` declarations in covered contexts, while known modern JS/ESM/test/docs/metadata non-violations produce zero no-`var` findings and remain protected by regression coverage.

## Product Lead Handoff Decision

- **Pass:** this scope package defines the problem, target users, in-scope and out-of-scope boundaries, business rules, acceptance criteria, edge/failure cases, validation surfaces, assumptions/risks, and Solution Lead handoff notes for `product_to_solution` review.
