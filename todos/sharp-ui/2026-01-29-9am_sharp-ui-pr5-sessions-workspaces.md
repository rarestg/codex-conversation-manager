# PR 5 — SessionsPanel + WorkspacesPanel: Lists + Selection

## Read first (required)
- `todos/sharp-ui/2026-01-27-1pm_sharp-ui-implementation-plan.md`
- `todos/sharp-ui/2026-01-27-1pm_sharp-ui-implementation-plan-mapping.md`
- `todos/sharp-ui/2026-01-27-1pm_sharp-ui-implementation-plan-addendum.md`
- `src/features/conversation/components/SessionsPanel.tsx`
- `src/features/conversation/components/WorkspacesPanel.tsx`
- `src/features/conversation/components/SessionLink.tsx`
- `src/index.css` (list/row primitives)

## Goal
Convert the remaining “tile” UI to **true row lists** with clear selection and focus states.

## Scope
SessionsPanel tree + WorkspacesPanel list.

## Files to touch
- `src/features/conversation/components/SessionsPanel.tsx`
- `src/features/conversation/components/WorkspacesPanel.tsx`
- Optional: `src/index.css` (add `.disclosure-row` or list helpers if needed)

## Implementation steps
### SessionsPanel
1) Panel shell
   - Replace frosted container with `panel p-5`.
2) Tree structure
   - Replace `space-y-*` stacks + per-item borders with a **list container** and `divide-y`.
   - Each level (year/month/day) should behave like a row header, not a mini-card.
3) Disclosure rows
   - Style `<summary>` as `.list-row row-button focus-within`.
   - Provide a visible disclosure indicator (caret/chevron) that rotates on open.
4) Session rows
   - Convert session entries to `.list-row row-button` (no per-row border).
   - Add `.row-selected` (left accent + bg) for active session.
   - Ensure focus-visible styling is present (currently missing in this file).
5) Keep behavior intact
   - Do not break `details` open state logic or scroll-into-view.
   - Keep `activeRowRef` wiring unchanged.

### WorkspacesPanel
1) Panel shell to `panel p-5`.
2) Convert workspace cards into a `.list` with `.list-row row-button`.
3) Selected workspace uses `.row-selected` (left accent).
4) GitHub action
   - If hidden on hover, also show on `focus-within`.
   - Ensure keyboard users can discover it.

## Acceptance criteria
- Sessions and workspaces are now list-based, not card stacks.
- Selected rows are unmistakable (left accent + bg).
- Focus styles are visible on disclosure rows and session rows.

## Verification
- Expand/collapse year/month/day; check hover/focus states.
- Select a session; verify selected styling persists.
- Ensure active row scrolls into view as before.
