# PR 3 — Tag/Chip Consolidation + Meta Rows

## Read first (required)
- `todos/2026-01-27-1pm_sharp-ui-implementation-plan.md`
- `todos/2026-01-27-1pm_sharp-ui-implementation-plan-mapping.md`
- `todos/2026-01-27-1pm_sharp-ui-implementation-plan-addendum.md`
- `src/index.css`
- `src/features/conversation/components/SessionHeaderVariantB.tsx`
- `src/features/conversation/components/SessionHeader.tsx`
- `src/features/conversation/components/TokenCountCard.tsx`
- `src/features/conversation/components/SessionsPanel.tsx`
- `src/features/conversation/components/WorkspacesPanel.tsx`
- `src/features/conversation/components/SessionOverview.tsx` (compact toggles)

## Goal
Collapse the “soft pill” ecosystem into **3 sharp tag variants** and standardize meta rows, without changing layouts.

## Scope
CSS + low-risk class swaps in a few components where chips are concentrated.

## Files to touch
- `src/index.css`
- `src/features/conversation/components/SessionHeaderVariantB.tsx`
- `src/features/conversation/components/SessionHeader.tsx`
- `src/features/conversation/components/TokenCountCard.tsx`
- `src/features/conversation/components/SessionsPanel.tsx`
- `src/features/conversation/components/WorkspacesPanel.tsx`
- Optional: `src/features/conversation/components/SessionOverview.tsx` (CompactToggle)

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
   - Workspaces/Sessions: remove `chip-shadow`, `rounded-full` badges, use chip variants.
   - Compact toggles: replace `chip-count` bubble with a small `.chip` or text counter.

## Acceptance criteria
- All chips/tags share the same base styling and 2–3 variants.
- No rounded pills or chip shadows remain in headers/tags.
- Meta rows look like sharp rows, not soft pills.

## Verification
- Session header chips, stats, and meta rows look consistent.
- Token count usage blocks are no longer segmented rounded pills.
- CopyButton label sizing and hover/copy states still behave correctly.
