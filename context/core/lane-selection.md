# Lane Selection

This file is the detailed routing reference for choosing between `Quick Task`, `Migration`, and `Full Delivery`.

Use `context/core/workflow.md` for the canonical live contract. Use this file when you need the stricter routing rubric, tie-breakers, anti-patterns, and examples.

## Core Rule

Choose the lane by the dominant uncertainty of the work, not by estimated size alone.

- `Quick Task`: low local uncertainty inside already-understood behavior
- `Migration`: compatibility uncertainty inside behavior-preserving modernization
- `Full Delivery`: product, requirements, acceptance, or cross-boundary solution uncertainty

## Routing Profile Dimensions

Record and reason with these dimensions:

- `work_intent`: `maintenance`, `modernization`, `feature`
- `behavior_delta`: `preserve`, `extend`, `redefine`
- `dominant_uncertainty`: `low_local`, `compatibility`, `product`
- `scope_shape`: `local`, `adjacent`, `cross_boundary`

Expected combinations:

- `Quick Task` -> `maintenance`, `preserve`, `low_local`, `local|adjacent`
- `Migration` -> `modernization`, `preserve`, `compatibility`, `local|adjacent|cross_boundary`
- `Full Delivery` -> usually `feature`, `extend|redefine`, `product`, often `cross_boundary`

## Tie-Breaker Priority

Apply these in order:

1. If `behavior_delta` is not `preserve`, choose `Full Delivery`.
2. If `dominant_uncertainty` is `product`, choose `Full Delivery`.
3. If `dominant_uncertainty` is `compatibility` and preserved behavior is known, choose `Migration`.
4. If `dominant_uncertainty` is `low_local` and scope stays bounded, choose `Quick Task`.
5. If uncertainty still cannot be classified honestly, choose `Full Delivery`.

## Anti-Patterns

- Do not choose `Quick Task` for a dependency or framework upgrade just because the code diff looks small.
- Do not choose `Migration` when acceptance criteria or business semantics are being redefined.
- Do not choose `Full Delivery` for straightforward modernization work only because internal architecture must change.
- Do not let file count or estimated duration override the dominant uncertainty rule.

## Fast Examples

- Upgrade React 16 to React 19 with preserved screens -> `Migration`
- Add a new billing workflow -> `Full Delivery`
- Fix a typo in one operator doc -> `Quick Task`
- Replace one deprecated helper with known equivalent behavior -> `Quick Task`
- Modernize fetching to React Query while preserving UX and rules -> `Migration`
- Upgrade framework and redesign onboarding flow -> `Full Delivery`
