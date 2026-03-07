# PR 4 — SearchPanel: Sections + Row List

## Read first (required)
- `todos/sharp-ui/2026-01-27-1pm_sharp-ui-implementation-plan.md`
- `todos/sharp-ui/2026-01-27-1pm_sharp-ui-implementation-plan-mapping.md`
- `todos/sharp-ui/2026-01-27-1pm_sharp-ui-implementation-plan-addendum.md`
- `src/features/conversation/components/SearchPanel.tsx`
- `src/features/conversation/components/SessionLink.tsx`
- `src/index.css` (search-related utilities)

## Goal
Make Search the first “scan-first” proof point: **row-based results** with clear focus/hover states and no nested cards.

## Scope
SearchPanel layout + search-related CSS utilities (if needed).

## Files to touch
- `src/features/conversation/components/SearchPanel.tsx`
- `src/index.css` (search skeletons, search-result chips, list helpers)

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
5) Interaction states (non-optional)
   - Hover: subtle bg shift.
   - Focus-visible: outline (from `.focusable`).
   - Active/pressed: stronger bg shift.
6) GitHub action visibility
   - If icon actions are hidden on hover, ensure they also appear on `focus-within`.
7) Search skeletons
   - Update `.search-skeleton-*` to remove rounding and translucency.

## Acceptance criteria
- Search results read as a single list, not nested cards.
- No rounded corners or shadows in SearchPanel or result rows.
- Keyboard focus on result rows is clearly visible.

## Verification
- Search with a query; scan the group headers + results list.
- Tab into results and confirm outline visibility.
- Check container query layout still works (small viewport).
