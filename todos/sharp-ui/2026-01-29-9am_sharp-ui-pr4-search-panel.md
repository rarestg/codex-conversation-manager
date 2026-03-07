# PR 4 — SearchPanel: Sections + Row List

## Status
Re-scope required.

This file preserves the scan-first list rules from the old `SearchPanel` plan.
Do not open a PR just to polish the current `SearchPanel`.

The intended destination is the future session-catalog pane and its
filter/search surfaces. Only do legacy `SearchPanel` work if it is a reusable
primitive migration or a low-risk stopgap that clearly carries forward.

## Read first (required)
- `IMPLEMENTATION_GUIDE.md`
- `todos/sharp-ui/2026-01-27-1pm_sharp-ui-implementation-plan.md`
- `todos/sharp-ui/2026-01-27-1pm_sharp-ui-implementation-plan-mapping.md`
- `todos/sharp-ui/2026-01-27-1pm_sharp-ui-implementation-plan-addendum.md`
- `src/features/conversation/components/SearchPanel.tsx`
- `src/features/conversation/components/SessionLink.tsx`
- `src/index.css` (search-related utilities)

## Goal
Make search and filtering the first scan-first proof point:
**row-based results** with clear focus/hover states and no nested cards.

## Scope
Search/filter layout rules plus search-related CSS utilities that should carry
forward into the future session catalog pane.

## Files to touch
- Future session-catalog pane/filter surfaces once they exist
- `src/index.css` (search skeletons, search-result chips, list helpers)

Historical reference only:
- `src/features/conversation/components/SearchPanel.tsx`

## Implementation steps
1) Outer container becomes a sharp panel
   - Replace frosted card class string with `panel p-5`.
   - Remove `backdrop-blur`, alpha backgrounds, and `shadow-*`.
2) Inputs/selects use shared primitives
   - Apply `.input`, `.select`, and `.focusable`.
   - Remove `focus:ring-*` usage.
3) Group container becomes a section, not a card
   - Use `.panel-muted` for grouping background.
   - Prefer **no border** on nested group containers to avoid border fatigue.
4) Results become a single list with dividers
   - Wrap results in `.list` and use `divide-y` (or `.list` + `> * + * { border-top }`).
   - Each result row uses `.list-row row-button focusable`.
   - Remove per-row borders and rounded corners.
   - In the new shell, prefer one unified catalog list over grouped mini-cards.
5) Interaction states (non-optional)
   - Hover: subtle bg shift.
   - Focus-visible: outline (from `.focusable`).
   - Active/pressed: stronger bg shift.
6) GitHub action visibility
   - If icon actions are hidden on hover, ensure they also appear on `focus-within`.
7) Search skeletons
   - Update `.search-skeleton-*` to remove rounding and translucency.

## Acceptance criteria
- Search/filter results read as a single list, not nested cards.
- No rounded corners or shadows remain in the shared list/search primitives.
- Keyboard focus on result rows is clearly visible.

## Verification
- Search with a query; scan the group headers + results list.
- Tab into results and confirm outline visibility.
- Check container query layout still works (small viewport).
