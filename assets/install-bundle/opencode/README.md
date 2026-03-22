# OpenCode Phase 1 Managed Bundle

This directory is the explicit derived install bundle for the phase-1 `openkit-managed-wrapper` profile.

- Authoring sources of truth stay at the repository root: `agents/`, `commands/`, and `skills/`.
- Install-time consumers must use this bundle and `src/install/asset-manifest.js` instead of scraping arbitrary live repo paths.
- Asset ids are namespaced with the `opencode.` prefix and installed under the `openkit` namespace.
- If an install target already has a conflicting OpenCode-native asset name, the phase-1 policy is fail-closed and requires explicit mapping rather than silent overwrite.
- Included in phase 1: agents, commands, skills.
- The OpenCode-native bundle now lives under `assets/install-bundle/opencode/` to make its derived-install role explicit.
- Deferred in phase 1: plugins and `assets/install-bundle/opencode/package.json`.
