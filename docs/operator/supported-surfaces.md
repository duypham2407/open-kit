# Supported Surfaces

Use this document to understand which OpenKit surfaces are intended for end users, which remain maintainer/runtime compatibility layers, and which command path should be preferred.

## Supported Surface Matrix

| Surface | Status | Primary audience | Use it for | Notes |
| --- | --- | --- | --- | --- |
| `openkit run` | supported | operators | launching OpenCode with the managed OpenKit profile | preferred first-run path |
| `openkit doctor` | supported | operators | checking global install and workspace readiness | non-mutating global check |
| `openkit upgrade` | supported | operators | refreshing the managed global kit | use after package upgrades or drift |
| `openkit uninstall` | supported | operators | removing the managed global kit | optional workspace cleanup supported |
| `openkit configure-agent-models` | supported | operators | saving per-agent provider/model overrides | global to the current OpenCode home |
| `openkit onboard` | supported | operators | getting the safest first-run path without launching immediately | onboarding helper |
| `openkit release ...` | supported | maintainers | preparing, verifying, and publishing OpenKit releases | maintainer-only workflow |
| `/browser-verify` | supported in-session | operators | planning browser verification and evidence capture | depends on runtime/browser provider availability |
| `node .opencode/workflow-state.js ...` | supported compatibility surface | maintainers | lower-level runtime inspection and work-item/task-board operations | checked-in runtime path |
| `.opencode/workflow-state.json` | supported compatibility mirror | maintainers/runtime tooling | active work-item mirror state | external mirror over managed backing store |
| `.opencode/work-items/` | supported internal backing store | maintainers/runtime tooling | per-item managed state and full-delivery task boards | not an operator onboarding surface |
| `registry.json` | supported metadata surface | maintainers | component and profile metadata | additive metadata, not an installer |
| `.opencode/install-manifest.json` | supported metadata surface | maintainers | local install-profile metadata | additive metadata, not destructive install logic |

## Default Operator Path

For everyday use, prefer this path:

1. `npm install -g @duypham93/openkit`
2. `openkit doctor`
3. `openkit onboard` if you want a dry onboarding summary first
4. `openkit run`
5. inside OpenCode, start with `/task`
6. use `/quick-task`, `/migrate`, or `/delivery` only when the lane is already obvious

If workflow state already exists and you need the next safe action, use `node .opencode/workflow-state.js resume-summary`.

## Boundary Rules

- The preferred product path is the managed global OpenKit install under the OpenCode home directory.
- The managed global kit root, the derived workspace runtime state root, and the project `.opencode/` compatibility shim are separate layers and should not be treated as interchangeable paths.
- The checked-in `.opencode/` runtime remains live and important, but it is primarily the authoring and compatibility surface.
- Quick and migration work stay task-board free.
- Full-delivery work may carry task boards, but parallel support stays bounded by the runtime commands and validations that actually exist.
- `openkit doctor` answers product/workspace readiness questions; `node .opencode/workflow-state.js doctor` answers workflow-runtime integrity questions.
- continuation controls and richer inspection tools are additive runtime aids; they never replace workflow approvals, evidence gates, or explicit stage ownership.
