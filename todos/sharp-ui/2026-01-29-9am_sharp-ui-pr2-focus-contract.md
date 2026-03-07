# PR 2 — Focus System + Interaction Contract

## Read first (required)
- `todos/2026-01-27-1pm_sharp-ui-implementation-plan.md`
- `todos/2026-01-27-1pm_sharp-ui-implementation-plan-mapping.md`
- `todos/2026-01-27-1pm_sharp-ui-implementation-plan-addendum.md`
- `src/index.css`
- `src/features/conversation/components/CopyButton.tsx`
- `src/features/conversation/components/Toggle.tsx`
- `src/features/conversation/components/SessionOverview.tsx` (compact toggles reference)

## Goal
Lock down a **single outline-based focus system** before we remove ring/shadow affordances from components.

## Scope
Small targeted changes only: focus primitives in CSS + minimal focus wiring in `CopyButton` and `Toggle`.

## Files to touch
- `src/index.css`
- `src/features/conversation/components/CopyButton.tsx`
- `src/features/conversation/components/Toggle.tsx`

## Implementation steps
1) Define the focus contract in CSS (outline-based)
   - `.focusable:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }`
   - `.focus-within:focus-within { outline: 2px solid var(--accent); outline-offset: -2px; }`
   - Ensure `:focus:not(:focus-visible)` does not force outlines.
2) Make `CopyButton` always focus-visible
   - Add `focusable` to the base class list so every CopyButton has a focus outline even if the passed className is neutral.
   - Do not alter label overlay mechanics (preserve width-reserve behavior).
3) Add `focus-within` to compound controls
   - `Toggle` uses an `sr-only` input; wrap the label/container with `.focus-within` so keyboard focus is visible.
   - Ensure focus styles are not clipped; avoid adding `overflow-hidden` to focusable ancestors.

## Acceptance criteria
- Tab navigation shows an obvious outline on CopyButtons and toggles.
- Focus outlines are not clipped by parent containers.
- No design changes beyond focus visibility.

## Verification
- Tab through Search input, selects, Copy buttons, toggle rows.
- Check focus visibility in Chrome and Safari (outline offsets differ).
