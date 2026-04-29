# Cross-Platform Validation Checklist

Use this checklist together with `cross-platform-validation.md` when you want a simple pass/fail sheet for Linux, macOS, and Windows.

## Environment Summary

| Field | Linux | macOS | Windows |
| --- | --- | --- | --- |
| OpenKit version |  |  |  |
| Node version |  |  |  |
| OpenCode version |  |  |  |
| Shell used |  |  |  |
| `OPENCODE_HOME` path |  |  |  |

## Command Checklist

Mark each step as `pass`, `soft fail`, or `hard fail`.

| Step | Linux | macOS | Windows | Notes |
| --- | --- | --- | --- | --- |
| `openkit --help` |  |  |  |  |
| `openkit doctor` before install |  |  |  |  |
| `openkit install-global` |  |  |  |  |
| `openkit doctor` after install |  |  |  |  |
| `openkit run` first launch |  |  |  |  |
| `openkit run` second launch |  |  |  |  |
| `node .opencode/openkit/workflow-state.js help` |  |  |  |  |
| `node .opencode/workflow-state.js help` |  |  |  |  |
| `openkit configure-agent-models --list` |  |  |  |  |
| `openkit configure-agent-models --models` |  |  |  |  |
| `openkit configure-agent-models --interactive` |  |  |  |  |
| `openkit profiles --list` |  |  |  |  |
| `openkit profiles --help` |  |  |  |  |
| `/switch-profiles` current-session switch |  |  |  | requires an active `openkit run` session and at least one profile |
| interactive provider picker |  |  |  |  |
| interactive model picker |  |  |  |  |
| interactive variant picker or fallback mode |  |  |  |  |
| `openkit upgrade` |  |  |  |  |
| `openkit uninstall` |  |  |  |  |
| `openkit uninstall --remove-workspaces` |  |  |  | optional |

## Final Status Summary

| Area | Linux | macOS | Windows |
| --- | --- | --- | --- |
| Install |  |  |  |
| Doctor |  |  |  |
| Run |  |  |  |
| Configure models |  |  |  |
| Model profiles |  |  |  |
| Target-project app validation |  |  |  | mark unavailable unless the disposable project declares build/lint/test/smoke commands |
| Upgrade |  |  |  |
| Uninstall |  |  |  |
| Overall |  |  |  |

## Notes And Follow-Ups

- Linux:
  - 
- macOS:
  - 
- Windows:
  - 

## Severity Legend

- `pass`: expected flow works cleanly
- `soft fail`: flow works but has warnings, rough UX, or recoverable issues
- `hard fail`: supported flow is blocked
