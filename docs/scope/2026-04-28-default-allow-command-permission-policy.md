---
artifact_type: scope_package
version: 1
status: approval_ready
feature_id: FEATURE-960
feature_slug: default-allow-command-permission-policy
owner: ProductLead
approval_gate: product_to_solution
handoff_rubric: pass
source_context:
  - User-approved brainstorm outcome for FEATURE-960
  - Existing OpenKit permission policy in .opencode/opencode.json and global materialization surfaces
---

# Scope Package: Default-Allow Command Permission Policy

OpenKit should stop asking users to confirm routine, non-dangerous command execution while preserving explicit confirmation for commands that can delete data, discard work, publish externally, or cause privileged/system-impacting side effects; the default policy must be machine-readable, primarily applied through the globally installed OpenKit runtime, and honestly report any upstream OpenCode limitation that prevents OpenKit from enforcing default-allow plus confirm-required exception semantics.

## Goal

- Make routine agent work proceed without repeated confirmation prompts for normal/non-dangerous commands.
- Use a machine-readable default command permission policy as the product source of truth.
- Apply that policy to the global installed OpenKit runtime and the OpenCode config/profile materialized by `openkit run`, install, or upgrade flows.
- Keep dangerous command categories confirmation-required by default.
- Add doctor/verify visibility so operators and maintainers can tell whether the installed policy is present, synchronized, and actually supported by the current OpenCode permission model.

## Target Users And Stakeholders

- **OpenKit operator:** wants routine agent work such as git inspection, npm install/test, and validation commands to proceed without repeated prompts.
- **In-session delivery agents:** need normal non-destructive commands to be executable without unnecessary user interruption while staying inside OpenKit safety rules.
- **Security-conscious operator:** needs destructive, irreversible, publishing, privileged, or data-loss commands to keep an explicit human confirmation checkpoint.
- **OpenKit maintainer:** needs one inspectable policy source that can be packaged, materialized, synchronized, tested, and diagnosed.
- **Solution Lead, Code Reviewer, and QA Agent:** need testable policy boundaries and explicit risk handling for upstream OpenCode behavior.

## Problem Statement

OpenKit already documents that normal non-destructive commands should run without confirmation and delete-style commands should ask, but the behavior is still too tied to specific config snippets and may not cover the global installed runtime consistently. Users experience repeated confirmations for ordinary agent work, which slows the quick and full-delivery loops. At the same time, broad auto-allow behavior is unsafe unless dangerous commands remain explicitly confirm-required. OpenKit needs a simple first implementation path: a machine-readable default policy, global config materialization/sync, and doctor/verify reporting, without introducing a prompt broker or pretending to control OpenCode prompts that upstream does not support.

## In Scope

- Define one machine-readable default command permission policy for OpenKit-owned runtime/config surfaces.
- Represent the policy as default-allow for commands not listed as confirm-required, subject to what OpenCode can actually honor.
- Include an explicit confirm-required list or category map for dangerous commands.
- Apply or synchronize the policy to global OpenKit-managed OpenCode config/profile materialization used by `openkit run`.
- Keep repo-local `.opencode/opencode.json` as an authoring/compatibility surface, but do not make it the only target of this feature.
- Add doctor and maintainer verification expectations for:
  - policy file presence and schema/readability,
  - materialized global config/profile alignment,
  - dangerous-command confirm-required entries,
  - routine-command allow/default-allow behavior where OpenCode supports it,
  - explicit degraded/unsupported reporting where OpenCode cannot honor the desired semantics.
- Update user/operator/maintainer documentation that describes confirmation behavior, dangerous command categories, unsupported upstream limitations, and the unchanged agent git safety protocol.

## Non-Goals / Out Of Scope

- Do not fork, patch, or replace OpenCode core.
- Do not build a prompt broker, pseudo-terminal auto-confirm layer, or hidden prompt interceptor for this MVP.
- Do not auto-confirm unknown prompts or bypass OpenCode security prompts with hacks.
- Do not weaken or replace OpenKit's agent git safety protocol, including commit, amend, force-push, and destructive git rules.
- Do not make destructive commands safe by policy wording alone; dangerous operations still require explicit confirmation.
- Do not add a new workflow lane, approval gate, role, or runtime mode.
- Do not treat OpenKit CLI/runtime checks as target-project application build/lint/test evidence.
- Do not require users to hand-edit only repo-local `.opencode/opencode.json` to get the default behavior in global installs.

## Main User Journeys

1. **As an OpenKit operator, I want normal agent commands to run without repeated confirmation, so that routine development work is not interrupted.**
2. **As a security-conscious operator, I want dangerous commands to keep asking for confirmation, so that deletion, data loss, forced publishing, or privileged system changes cannot happen silently.**
3. **As a maintainer, I want one machine-readable default policy to drive materialized config, docs, and tests, so that OpenKit does not drift across checked-in and global install surfaces.**
4. **As a QA owner, I want doctor/verify output to state whether OpenCode actually honors the policy shape, so that unsupported prompt behavior is reported instead of hidden.**

## Business Rules

### Default-Allow Behavior

1. Commands not in the confirm-required policy list should be treated as allowed by default when OpenCode supports default-allow/exception semantics.
2. Routine non-dangerous commands must not require repeated confirmation under the supported policy path.
3. Routine allowed examples include normal file read/write/edit tooling, OpenKit workflow/status/doctor commands, non-delete shell usage, package install/test/verify commands, and non-destructive git inspection commands such as `git status`, `git log`, and `git diff`.
4. The policy must avoid requiring OpenKit maintainers to enumerate every possible safe command just to prevent prompts.
5. If OpenCode does not support a true default-allow with confirm-required exceptions, OpenKit must report the limitation and the effective behavior; it must not claim full control of OpenCode prompts.

### Confirm-Required Safety Floor

1. Dangerous commands in the policy must always be configured as confirmation-required in supported environments.
2. The confirm-required list must include delete/data-loss/irreversible command categories, at minimum:
   - `rm`, `rmdir`, `unlink`, and equivalent delete-style commands;
   - file or directory removal through common shell forms when policy matching can represent them;
   - `git reset --hard`;
   - `git clean`;
   - `git restore` or `git checkout` forms that discard local work;
   - `git push --force` and equivalent force-push forms;
   - `npm publish` and `npm unpublish`;
   - `openkit release publish`;
   - deploy/release publish commands that create external release, deployment, or publication side effects;
   - database drop/truncate/reset/wipe commands;
   - privileged or system-impacting commands such as `sudo`, `chmod`, and `chown` where the policy includes or can accurately represent them.
3. If exact matching for a dangerous category is not possible in the current OpenCode permission model, the policy and doctor/verify output must identify the unsupported granularity.
4. Dangerous-command confirmation must not be bypassed by adding broad `bash` allow behavior unless the confirm-required exceptions remain effective.
5. User-selected OpenCode `Always Allow` behavior, if present, remains OpenCode-owned; OpenKit must not invent a separate hidden approval-memory layer in this feature.

### Policy Source And Materialization

1. The default policy must be machine-readable and versioned or schema-identifiable enough for validation and future migration.
2. Global OpenKit-managed config/profile materialization is the primary product target.
3. Repo-local `.opencode/opencode.json` may mirror or consume the same policy for authoring and compatibility, but success cannot be limited to that file.
4. Install, run, upgrade, or sync behavior that materializes OpenKit-owned config must not silently drift from the policy file.
5. Existing user-managed OpenCode configuration must be handled non-destructively; conflicts or unsupported merge behavior must be reported instead of overwritten silently.

### Reporting And Documentation

1. Doctor output must tell the operator whether the policy source exists, can be parsed, and aligns with materialized OpenKit-managed config.
2. Verification output must distinguish supported enforcement, degraded enforcement, and upstream-unsupported policy semantics.
3. Documentation must explain default allow, confirm-required dangerous commands, global-install priority, repo-local compatibility, and upstream limitation handling.
4. Validation claims must identify their surface: `global_cli`, `package`, `compatibility_runtime`, `runtime_tooling`, `documentation`, or unavailable `target_project_app`.

## Acceptance Criteria Matrix

### AC1 — Machine-Readable Policy Exists And Is Canonical

- **Given** a maintainer inspects the OpenKit package/runtime source
- **When** they look for the command confirmation defaults
- **Then** there is one machine-readable default policy source for default-allow and confirm-required dangerous commands
- **And** the policy is schema-identifiable or versioned enough for automated validation
- **And** policy behavior is not duplicated as divergent hardcoded lists across global and repo-local config surfaces.

### AC2 — Global Installed Runtime Uses The Policy

- **Given** OpenKit is installed or refreshed through the global product path
- **When** OpenKit materializes the OpenCode config/profile used by `openkit run`
- **Then** the materialized global OpenKit-managed config reflects the default policy
- **And** routine non-dangerous commands are represented as allowed/default-allowed where supported
- **And** confirm-required dangerous commands are represented as `ask` or the closest supported confirmation-required equivalent.

### AC3 — Repo-Local Config Is Not The Only Target

- **Given** the checked-in repository-local `.opencode/opencode.json` carries compatibility config
- **When** FEATURE-960 is validated
- **Then** passing validation requires global OpenKit-managed config/profile coverage, not only a repo-local file update
- **And** repo-local config either aligns with the policy or explicitly documents why it is compatibility-only.

### AC4 — Routine Commands Avoid Repeated Confirmation

- **Given** a supported OpenKit/OpenCode environment with the default policy applied
- **When** an agent runs routine non-dangerous commands such as OpenKit status/doctor/verify, package install/test/verify, non-delete bash usage, or non-destructive git inspection
- **Then** the command should not trigger repeated confirmation prompts because it is not in the confirm-required list
- **And** any prompt still shown by OpenCode is reported as an upstream/effective-behavior limitation rather than hidden.

### AC5 — Dangerous Delete/Data-Loss Commands Ask

- **Given** the default policy is applied in a supported environment
- **When** an agent attempts `rm`, `rmdir`, `unlink`, or equivalent delete-style commands covered by the policy
- **Then** OpenKit-managed config requires explicit user confirmation before execution
- **And** doctor/verify can show that delete-style entries remain confirmation-required.

### AC6 — Dangerous Git Discard Or Force Commands Ask

- **Given** the default policy is applied in a supported environment
- **When** an agent attempts `git reset --hard`, `git clean`, `git restore`/`git checkout` forms that discard work, or `git push --force`
- **Then** those commands require explicit user confirmation
- **And** this does not change the existing agent git safety protocol or make destructive git acceptable without user intent.

### AC7 — Publish, Deploy, Release, And Database-Destructive Commands Ask

- **Given** the default policy is applied in a supported environment
- **When** an agent attempts package publish/unpublish, OpenKit release publish, deploy/release publish, or database drop/truncate/reset/wipe commands represented in the policy
- **Then** those commands require explicit user confirmation
- **And** unsupported matching granularity is reported if OpenCode cannot distinguish the dangerous form from safer neighboring commands.

### AC8 — Privileged/System-Impacting Commands Are Explicitly Handled

- **Given** the policy includes privileged or system-impacting commands such as `sudo`, `chmod`, or `chown`
- **When** those commands are materialized or verified
- **Then** they are confirmation-required
- **And** if the final MVP excludes or cannot accurately represent any of them, the exclusion or limitation is documented and visible in doctor/verify output.

### AC9 — Doctor Reports Policy Health And Drift

- **Given** an operator runs OpenKit doctor on an installed OpenKit runtime
- **When** the policy file is missing, malformed, unsupported by the current OpenCode config shape, or out of sync with materialized config
- **Then** doctor reports a non-healthy/degraded status with a clear issue and recommended next action
- **And** doctor does not claim routine commands are prompt-free or dangerous commands are protected when that cannot be verified.

### AC10 — Verification Covers Effective Policy Behavior Or Limitations

- **Given** maintainers run the selected verification path for this feature
- **When** policy validation executes
- **Then** it checks the policy source, global materialization/sync, dangerous-command confirmation entries, routine-command allow/default-allow representation, and docs alignment
- **And** it records unsupported upstream semantics as explicit limitations rather than failing silently or overclaiming success.

### AC11 — No Prompt Broker Or Auto-Confirm MVP

- **Given** OpenCode presents a prompt that the policy cannot suppress or classify
- **When** OpenKit encounters that prompt during this MVP
- **Then** OpenKit does not auto-confirm it through a pseudo-terminal, prompt broker, or hidden bypass
- **And** the limitation is reported to the user or maintainer with the effective behavior.

### AC12 — Documentation Matches The Product Contract

- **Given** an operator reads OpenKit docs after FEATURE-960
- **When** they look for command confirmation behavior
- **Then** docs state that normal/non-dangerous commands default to allow, dangerous policy-listed commands require confirmation, global install is the primary product surface, repo-local config is compatibility/authoring context, and upstream OpenCode limitations may affect effective prompt behavior
- **And** docs state that the agent git safety protocol is unchanged.

## Edge Cases

- OpenCode does not support a default allow with confirm-required exception list.
- OpenCode supports exact command names but not argument-sensitive rules such as distinguishing `git checkout <file>` discards from other checkout usage.
- A dangerous command is wrapped through shell forms such as `sh -c`, command chaining, aliases, scripts, or package scripts.
- A command is safe in one context but dangerous in another, such as `npm` install/test versus publish/unpublish.
- User-managed global OpenCode config already has conflicting permission settings.
- The policy file is present but stale relative to generated global profile/config output.
- The checked-in repo-local config and global installed config drift from one another.
- OpenCode persists an `Always Allow` choice that changes effective prompts outside OpenKit's policy file.
- The user intentionally requests a dangerous command; OpenKit should still require confirmation where configured and preserve agent safety rules.
- Platform-specific command variants differ between POSIX and Windows environments.

## Error And Failure Cases

- Missing policy file: doctor/verify reports a policy-source failure and does not treat hardcoded config as sufficient.
- Malformed policy file: doctor/verify reports parse/schema failure and identifies the affected surface.
- Unsupported upstream semantics: doctor/verify reports degraded or unsupported enforcement instead of claiming full default-allow behavior.
- Materialization/sync failure: global OpenKit-managed config/profile is not updated, and the user receives a clear remediation path.
- Merge conflict with user-managed config: OpenKit preserves user configuration and reports the conflict instead of overwriting silently.
- Dangerous entry omitted from materialized config: verification fails or reports the missing confirm-required coverage.
- Routine command still prompts despite policy: OpenKit reports the effective upstream behavior rather than hiding it behind an auto-confirm workaround.
- Prompt broker behavior appears in proposed implementation: route back to Product Lead as out of scope for this MVP.

## Validation Expectations By Surface

| Surface label | Expected validation |
| --- | --- |
| `global_cli` | Validate global install/run/upgrade or sync path materializes the policy into OpenKit-managed OpenCode config/profile; validate `openkit doctor` reports policy health, drift, and upstream support limitations. |
| `package` | Validate the machine-readable policy file is shipped with the package and remains synchronized with generated install-bundle or profile assets. |
| `compatibility_runtime` | Validate workflow/evidence records and repo-local compatibility surfaces can report policy validation without confusing them for the global product source of truth. |
| `runtime_tooling` | Validate any runtime read model or helper that reports policy status uses honest supported/degraded/unsupported language and does not auto-confirm prompts. |
| `documentation` | Validate operator/maintainer docs describe default allow, confirm-required dangerous categories, global-install priority, repo-local compatibility, upstream limitations, and unchanged git safety rules. |
| `target_project_app` | Unavailable unless a separate target project defines its own app-native build/lint/test/smoke commands; OpenKit policy checks are not target-project application validation. |

## Risks And Constraints

- The largest product risk is upstream OpenCode not honoring the desired default-allow plus confirm-required exception semantics; OpenKit must surface this clearly.
- Broad `bash` allow behavior may conflict with argument-sensitive dangerous-command confirmation if upstream matching is too coarse.
- A simple policy file can drift from generated config unless materialization and verification use it as the canonical source.
- Over-scoping into prompt interception would increase safety risk and implementation complexity; it is explicitly excluded from this MVP.
- Dangerous command matching can be imperfect for wrappers, aliases, scripts, and platform-specific command forms.
- Existing users may have local OpenCode permission settings that override or conflict with OpenKit-managed defaults.

## Open Questions And Assumptions

- Assumption: a machine-readable default policy file can be packaged and consumed by global OpenKit materialization/sync without changing the three-lane workflow contract.
- Assumption: OpenKit can at minimum verify that its own materialized config expresses the intended policy, even if OpenCode cannot prove effective prompt behavior end-to-end.
- Open question for Solution Lead: determine the exact machine-readable format and schema fields while preserving default-allow plus confirm-required semantics.
- Open question for Solution Lead: determine how much argument-sensitive matching OpenCode supports for dangerous git, publish/deploy, database, and privileged command categories.
- Open question for Solution Lead: decide whether privileged/system-impacting commands are mandatory MVP confirm-required entries or documented limitations when upstream matching is insufficient.

## Success Signal

- A user running globally installed OpenKit can perform normal routine agent work without repeated confirmation prompts, while policy-listed dangerous commands still require confirmation in supported environments; `openkit doctor` and maintainer verification can prove the policy is present, synchronized, and honestly report any upstream OpenCode limitation that prevents full enforcement.

## Handoff Notes For Solution Lead

- Keep the solution simple: policy file, global config/profile materialization or sync, doctor reporting, verification, and docs.
- Treat global installed OpenKit runtime as the primary product target; repo-local `.opencode/opencode.json` is not enough.
- Preserve the no-broker MVP boundary: no pseudo-terminal auto-confirm, no hidden prompt interception, no unknown prompt bypass.
- Preserve the existing agent git safety protocol exactly; command permission defaults do not authorize unsafe git behavior.
- Design validation around both intended policy representation and effective upstream support; if OpenCode cannot honor a rule, report the limitation explicitly.
- Make the dangerous-command list inspectable and reviewable so future additions do not require rediscovering the product intent.
- Keep validation-surface labels honest, especially the distinction between OpenKit policy/runtime checks and unavailable `target_project_app` evidence.

## Product Lead Handoff Decision

- **Pass:** this scope package is approval-ready for `product_to_solution` because it defines the problem, users/stakeholders, goals, non-goals, in-scope/out-of-scope boundaries, business rules, acceptance criteria, edge/failure cases, validation expectations, risks, and Solution Lead handoff notes without specifying implementation architecture beyond the user-approved policy-file/materialization/doctor-verify MVP boundary.
