# PR 3 — Tag/Chip Consolidation + Meta Rows

## Status
Re-scope this slice before implementation.

The tag/meta cleanup still matters, but the real target is shared sharp
primitives plus metadata surfaces that survive into the future catalog/detail
shell.

References below to `SessionsPanel` and `WorkspacesPanel` are historical
concentration points, not a reason to polish the legacy home panels. If work
starts before the catalog shell exists, keep it limited to shared CSS,
shared tag primitives, and detail-pane surfaces that clearly carry forward.

## Read first (required)
- `todos/sharp-ui/2026-01-27-1pm_sharp-ui-implementation-plan.md`
- `todos/sharp-ui/2026-01-27-1pm_sharp-ui-implementation-plan-mapping.md`
- `todos/sharp-ui/2026-01-27-1pm_sharp-ui-implementation-plan-addendum.md`
- `src/index.css`
- `src/features/conversation/components/SessionHeaderVariantB.tsx`
- `src/features/conversation/components/SessionHeader.tsx`
- `src/features/conversation/components/TokenCountCard.tsx`
- `src/features/conversation/components/SessionsPanel.tsx`
- `src/features/conversation/components/WorkspacesPanel.tsx`
- `src/features/conversation/components/SessionOverview.tsx` (compact toggles)

## Goal
Collapse the soft-pill ecosystem into **3 sharp tag variants** and standardize
meta rows without locking the repo further into the legacy panel shell.

## Scope
Shared CSS primitives plus low-risk usage updates in components that will
survive the rearchitecture or are the best current proxies for future metadata
surfaces.

## Files to touch
- `src/index.css`
- `src/features/conversation/components/SessionHeaderVariantB.tsx`
- `src/features/conversation/components/SessionHeader.tsx`
- `src/features/conversation/components/TokenCountCard.tsx`
- Future catalog row/cell metadata surfaces once they exist
- Optional: `src/features/conversation/components/SessionOverview.tsx` (CompactToggle)

Historical references only:
- `src/features/conversation/components/SessionsPanel.tsx`
- `src/features/conversation/components/WorkspacesPanel.tsx`

## Implementation steps
1) Keep `.chip` naming, redefine styling to sharp tags
   - Base: bordered, no radius, solid background.
   - Variants: `.chip-muted` (subtle bg), `.chip-filled` (solid).
   - Remove `.chip-shadow`, `.chip-soft`, `.chip-white` (or leave no-ops if still referenced).
   - Consider `.tag` as alias to `.chip` (optional, low churn).
2) Merge special cases
   - Replace `.search-result-chip` with standard `.chip` variants.
   - Replace `.chip-segmented` blocks in `TokenCountCard` with:
     - a simple row (`panel-row`) or
     - inline `.chip` list separated by dots (no segmented pill).
3) Standardize `.meta-row`
   - Convert to a sharp row style (bordered, opaque, no radius).
   - Ensure it remains CopyButton-friendly (left-aligned labels, reserved width).
4) Update component usages (mechanical swaps)
   - Session headers: chips -> new sharp variants.
   - Legacy Workspaces/Sessions surfaces: only update them if the change is a
     shared primitive migration or a cheap carry-forward cleanup.
   - Compact toggles: replace `chip-count` bubble with a small `.chip` or text counter.

## Acceptance criteria
- All chips/tags share the same base styling and 2–3 variants.
- No rounded pills or chip shadows remain in the shared tag system.
- Meta rows look like sharp rows, not soft pills.
- The tag/meta rules are usable in the future catalog rows and the right-hand
  detail pane without panel-specific assumptions.

## Verification
- Session header chips, stats, and meta rows look consistent.
- Token count usage blocks are no longer segmented rounded pills.
- CopyButton label sizing and hover/copy states still behave correctly.
