---
artifact_type: scope_package
version: 1
status: approval_ready
feature_id: FEATURE-961
feature_slug: agent-model-profiles
owner: ProductLead
approval_gate: product_to_solution
---

# Scope Package: Agent Model Profiles

## Goal

- Let OpenKit users define reusable global model profiles for OpenKit agents and switch the active profile inside `openkit run` without exiting the session.
- Provide a short, memorable profile-management CLI for common create/edit/list/delete/default flows.
- Preserve session isolation: in-session profile switching affects only the current working session unless the user explicitly changes the global default before launch.

## Target Users

- OpenKit operators who configure agent model behavior before launching `openkit run`.
- OpenKit users who need to change agent model mix during a working session for different reasoning/cost/speed needs.
- Maintainers validating OpenKit global CLI and in-session behavior across sessions.

## Problem Statement

Changing OpenKit agent models currently requires the user to exit `openkit run`, reconfigure agent models, and start a new session. This interrupts delivery flow when a user wants to move between known model mixes, such as a high-reasoning profile for Product/Solution work and a cheaper/faster profile for routine work. Users need global, reusable agent model profiles that can be managed before launch and selected interactively during an active OpenKit session without changing other sessions or the global default unintentionally.

## Success Signal

- A user can create at least two global profiles with different role-to-model mappings, set one as the global default, start `openkit run` with that default active, switch to another profile from an interactive in-session list, and confirm that the switch affects only that current session.

## In Scope

- Global OpenKit agent model profiles, not project-local or workspace-local profiles.
- Short global CLI profile-management commands:
  - `openkit profiles --create`
  - `openkit profiles --edit`
  - `openkit profiles --list`
  - `openkit profiles --delete`
  - `openkit profiles --set-default`
- Interactive create/edit wizard behavior similar to `openkit configure agent models --interactive`.
- Profile model selection from the existing configured provider/model list using the same source and user experience as the current agent-model setup flow.
- A global default profile used as the initial profile when starting `openkit run`.
- In-session `/switch-profiles` command that opens an interactive list of existing profiles and applies the selected profile to the current `openkit run` session only.
- Partial profiles: a profile may define model selections for only some OpenKit roles/agents.
- Fallback behavior for unspecified roles: roles not declared by the active profile use the current/default model configuration.
- Delete-safety behavior that blocks deletion of profiles that are global default or active in a running `openkit run` session.
- Product validation expectations for OpenKit `global_cli`, `in_session`, and runtime behavior surfaces.

## Out of Scope

- Project-local or workspace-local profile storage/behavior.
- Direct config-file editing as the primary profile-management UX.
- Direct argument switching such as `/switch-profiles profile2`; the in-session switch command is interactive-list only for this scope.
- Arbitrary model-id entry in the main create/edit flow.
- Automatic model-provider discovery beyond the currently configured provider/model list used by `openkit configure agent models --interactive`.
- Changing global default from inside `/switch-profiles`; in-session switching must not mutate the global default.
- Forcing other running sessions to switch profiles when one session changes.
- Target-project application build, lint, or test validation.
- Internal storage design, runtime class design, command parsing architecture, or implementation sequencing.

## Main Flows

### Manage profiles before `openkit run`

- User runs `openkit profiles --create` to create a named global profile through an interactive wizard.
- User selects one or more OpenKit roles/agents to include in the profile and chooses a configured provider/model for each selected role.
- User runs `openkit profiles --edit` to choose an existing profile and update its role/model selections through the same interactive setup style.
- User runs `openkit profiles --list` to see existing profiles and identify the global default profile.
- User runs `openkit profiles --set-default` to choose which existing profile is used when a new `openkit run` session starts.
- User runs `openkit profiles --delete` to remove an existing profile when it is safe to remove.

### Start a session with the global default

- User starts `openkit run`.
- OpenKit uses the configured global default profile as the initial active profile for that session.
- Any role not specified by the default profile falls back to the current/default model configuration.

### Switch profile during `openkit run`

- User runs `/switch-profiles` inside an active `openkit run` session.
- OpenKit presents an interactive list of existing profiles.
- User selects one profile.
- Selected profile becomes active immediately for the current working session.
- The switch does not change the global default and does not affect any other running or future sessions.

### Delete a profile safely

- User runs `openkit profiles --delete`.
- If the selected profile is the global default, deletion is blocked and the user is told to choose a different default first.
- If the selected profile is active in a running `openkit run` session, deletion is blocked and the user is told to exit the affected session before deleting.
- If neither condition applies, the profile can be deleted through the CLI flow.

## Business Rules

- Profiles are global to OpenKit and reusable across projects/workspaces unless a future feature explicitly adds narrower scope.
- Profile names must be unique in the global OpenKit profile list.
- The main profile create/edit flow must only offer models from the existing configured provider/model list used by `openkit configure agent models --interactive`.
- A profile may specify any subset of supported OpenKit roles/agents.
- Unspecified roles always fall back to the current/default model configuration.
- `openkit run` starts with the global default profile when one is configured.
- In-session `/switch-profiles` selection is session-scoped and must not mutate the global default.
- In-session `/switch-profiles` selection must not affect other running `openkit run` sessions.
- Deleting a profile is blocked when the profile is the global default.
- Deleting a profile is blocked when the profile is active in any running `openkit run` session.
- If a user cancels a profile-management wizard or switch selection, no profile changes are applied.
- Profile behavior must remain distinct from target-project application behavior; OpenKit profile validation does not imply target app build/lint/test validation.

## User Stories And Acceptance Criteria

### Story 1 — Create and edit global profiles

As an OpenKit operator, I want to create and edit named global agent model profiles, so that I can reuse known role-to-model mappings without repeating manual setup.

- **Given** OpenKit has configured provider/model options available through the current agent-model setup source  
  **When** the user runs `openkit profiles --create`  
  **Then** OpenKit starts an interactive wizard similar to `openkit configure agent models --interactive`  
  **And** the user can create a named global profile by selecting roles/agents and choosing configured models for the selected roles.

- **Given** a profile already exists  
  **When** the user runs `openkit profiles --edit`  
  **Then** OpenKit lets the user choose an existing profile  
  **And** update its selected roles and configured model selections through the same interactive wizard style.

- **Given** the user is creating or editing a profile  
  **When** the user chooses models for roles  
  **Then** the main flow offers only models from the existing configured provider/model list  
  **And** does not require or promote arbitrary model-id entry.

- **Given** the user creates or edits a profile with only some roles selected  
  **When** that profile becomes active  
  **Then** selected roles use the profile's model choices  
  **And** unspecified roles use the current/default model configuration.

### Story 2 — List and set the global default profile

As an OpenKit operator, I want to list profiles and set one as the global default, so that new `openkit run` sessions start with the intended model mix.

- **Given** one or more profiles exist  
  **When** the user runs `openkit profiles --list`  
  **Then** OpenKit shows the existing global profiles  
  **And** identifies which profile is currently the global default when a default is set.

- **Given** one or more profiles exist  
  **When** the user runs `openkit profiles --set-default` and selects a profile  
  **Then** that profile becomes the global default for future `openkit run` starts.

- **Given** a global default profile is configured  
  **When** the user starts `openkit run`  
  **Then** the session starts with that profile as its initial active profile  
  **And** unspecified roles in that profile fall back to the current/default model configuration.

### Story 3 — Switch profiles inside `openkit run`

As an OpenKit user in a working session, I want to choose an existing profile from an interactive list, so that I can change the active model mix without exiting `openkit run`.

- **Given** the user is inside an active `openkit run` session  
  **And** one or more global profiles exist  
  **When** the user runs `/switch-profiles`  
  **Then** OpenKit shows an interactive list of existing profiles.

- **Given** the `/switch-profiles` list is shown  
  **When** the user selects a profile  
  **Then** the selected profile becomes active for the current working session  
  **And** the current session remains inside `openkit run`.

- **Given** the user switches profiles inside one `openkit run` session  
  **When** the switch completes  
  **Then** the global default profile remains unchanged  
  **And** other running sessions keep their own active profiles unchanged  
  **And** future sessions still start from the global default profile.

- **Given** the user wants to switch profiles inside `openkit run`  
  **When** they use `/switch-profiles`  
  **Then** the supported UX is interactive selection only  
  **And** direct argument switching such as `/switch-profiles profile2` is not required for this feature.

### Story 4 — Prevent unsafe deletion

As an OpenKit operator, I want deletion safeguards for default or active profiles, so that removing a profile does not unexpectedly disrupt configured or running sessions.

- **Given** a profile is the global default  
  **When** the user attempts to delete that profile with `openkit profiles --delete`  
  **Then** OpenKit blocks deletion  
  **And** tells the user to choose a different global default before deleting.

- **Given** a profile is active in a running `openkit run` session  
  **When** the user attempts to delete that profile with `openkit profiles --delete`  
  **Then** OpenKit blocks deletion  
  **And** tells the user to exit the affected session before deleting.

- **Given** a profile is not the global default and is not active in any running `openkit run` session  
  **When** the user completes the delete flow  
  **Then** the profile is removed from the global profile list  
  **And** it no longer appears in `/switch-profiles` selections for new in-session switch attempts.

## Acceptance Criteria Matrix

| ID | Requirement | Acceptance |
| --- | --- | --- |
| AC-01 | Global profile scope | Profiles created through `openkit profiles` are global to OpenKit and not tied to a target project/workspace. |
| AC-02 | Short management CLI | `openkit profiles --create`, `--edit`, `--list`, `--delete`, and `--set-default` are the product-facing profile-management commands. |
| AC-03 | Interactive create/edit UX | Create/edit use an interactive wizard style matching the current agent-model setup experience. |
| AC-04 | Valid model choices | Create/edit model selection uses existing configured provider/model choices and does not accept arbitrary model ids in the main flow. |
| AC-05 | Partial profile fallback | Profiles can specify only some roles; unspecified roles use current/default model configuration. |
| AC-06 | Global default startup | Starting `openkit run` uses the configured global default profile as the initial active profile. |
| AC-07 | In-session interactive switch | `/switch-profiles` opens an interactive list of existing profiles and lets the user select one. |
| AC-08 | Session-only switch | A `/switch-profiles` selection becomes active for the current session only and does not change global default or other sessions. |
| AC-09 | No direct switch argument | Direct invocation such as `/switch-profiles profile2` is not required in this scope. |
| AC-10 | Delete blocks default | Deleting the global default profile is blocked with actionable guidance. |
| AC-11 | Delete blocks active sessions | Deleting a profile active in a running `openkit run` session is blocked with actionable guidance. |
| AC-12 | Empty/cancel-safe flows | Empty profile lists, unavailable model choices, and user cancellation do not silently change profile/default/session state. |
| AC-13 | Validation surface clarity | Delivery evidence labels OpenKit `global_cli`, `in_session`, and runtime behavior separately from unavailable target-project app validation. |

## Edge Cases

- No profiles exist: `openkit profiles --list` reports that there are no profiles; `/switch-profiles` reports that no profiles are available and leaves the current session unchanged.
- No global default profile is configured yet: existing model configuration remains the fallback behavior until the user sets a global default profile.
- User cancels create/edit/delete/default/switch selection: no profile, default, or active-session change is applied.
- Duplicate profile name: creation is blocked and the user is asked to choose a unique name.
- Profile references a model that is no longer available because provider/model configuration changed after profile creation: OpenKit must surface the mismatch before relying on that profile and avoid silently switching to an invalid model.
- OpenKit roles/agents change over time: create/edit should present the current role/agent list; partial profile fallback continues to protect unspecified roles.
- Multiple `openkit run` sessions exist: switching in one session must not affect active profile selection in another session.

## Error And Failure Cases

- Provider/model list unavailable during create/edit: the wizard cannot complete a valid model selection and must leave the profile unchanged or uncreated.
- Attempt to set default to a missing or invalid profile: the default remains unchanged and the user receives a clear failure message.
- Attempt to delete the global default profile: deletion is blocked until the user chooses another default.
- Attempt to delete a profile active in a running session: deletion is blocked until the affected session exits.
- Attempt to switch when the selected profile becomes unavailable between list display and selection: the active session profile remains unchanged and the user is told to retry from the refreshed list.
- Session-scoped switch cannot be applied safely: the current session remains on its previous active profile and the user receives a clear failure message.

## Open Questions

- No blocking product questions remain for Solution Lead review.
- Product assumption to preserve unless contradicted later: switching profiles does not require interrupting or restarting already-running agent execution; the selected profile is the active profile for the current session after selection completes.

## Validation Surface Constraints

- This feature is OpenKit `global_cli`, `in_session`, and runtime behavior.
- Evidence for this scope should not be described as target-project application build/lint/test evidence.
- Target-project app validation is unavailable unless a specific target project defines its own app-native commands.
- Existing OpenKit runtime/CLI validation may be relevant for downstream delivery, but it must be labeled by the surface it actually validates.

## Handoff Notes For Solution Lead

- Preserve the global-vs-session boundary: global CLI manages stored profiles and default; `/switch-profiles` changes only the current active session.
- Preserve the current agent-model setup UX for create/edit rather than inventing a separate model-selection concept.
- Treat direct `/switch-profiles <name>` as out of scope for this feature.
- Design should account for delete safety across default and running-session usage without weakening the product rule.
- Solution planning should define validation on OpenKit CLI/in-session/runtime surfaces and explicitly mark target-project app validation as unavailable.
