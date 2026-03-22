# Decision Log Guidance

Use a decision log when a workflow change does not warrant a full ADR but still needs durable traceability.

This is the default record for smaller operational changes to the profile/install-manifest layer when the change stays within the current architecture and command contract.

Good fits for a decision log:

- adjusting profile descriptions or clarifying which existing component categories a profile should reference
- adding or removing registry entries for already-established component types such as a new agent file, skill file, command doc, or anchor doc
- tightening smoke-test expectations or operator guidance after the runtime behavior is already settled
- recording a local naming or rollout decision that affects documentation more than architecture

Escalate to an ADR instead when the change alters runtime behavior, command semantics, manifest meaning, registry schema, or long-term extension policy.

Recommended fields:

- date
- decision
- rationale
- impacted artifacts

Helpful optional fields for this repository:

- related profile or manifest change
- command surface affected
- follow-up validation performed
