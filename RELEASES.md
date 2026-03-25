# Releases

Historical release notes tracked in-repo:

- [`0.2.12`](RELEASE_NOTES_0.2.12.md) - soft fallback for interactive model discovery when verbose metadata is unavailable
- [`0.2.11`](RELEASE_NOTES_0.2.11.md) - dynamic model variant discovery from `opencode models --verbose`
- [`0.2.10`](RELEASE_NOTES_0.2.10.md) - interactive per-agent model setup and persisted overrides
- [`0.2.9`](RELEASE_NOTES_0.2.9.md) - runtime hardening, non-mutating doctor checks, and wrapper warning fixes
- [`0.2.8`](RELEASE_NOTES_0.2.8.md) - historical baseline summary for the early global-kit operator flow

Recommended workflow for future releases:

1. Copy `RELEASE_NOTES_TEMPLATE.md` to `RELEASE_NOTES_<version>.md`.
2. Fill in the release-specific changes, validation notes, and npm package version.
3. Commit the release notes file before or alongside the related tag/release work.
