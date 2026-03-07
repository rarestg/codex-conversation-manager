# PR 6 — Conversation Content Surfaces (Turns + Messages + Tokens)

## Read first (required)
- `todos/sharp-ui/2026-01-27-1pm_sharp-ui-implementation-plan.md`
- `todos/sharp-ui/2026-01-27-1pm_sharp-ui-implementation-plan-mapping.md`
- `todos/sharp-ui/2026-01-27-1pm_sharp-ui-implementation-plan-addendum.md`
- `src/features/conversation/components/TurnList.tsx`
- `src/features/conversation/components/TurnCard.tsx`
- `src/features/conversation/components/MessageCard.tsx`
- `src/features/conversation/components/TokenCountCard.tsx`
- `src/features/conversation/markdown.tsx`
- `src/index.css`

## Goal
Remove the “floating pastel cards” feel from conversation content while keeping it **readable and scan-friendly**.

## Scope
Turn/Message/Token cards + markdown wrappers. No sidebar/list work in this PR.

## Files to touch
- `src/features/conversation/components/TurnList.tsx`
- `src/features/conversation/components/TurnCard.tsx`
- `src/features/conversation/components/MessageCard.tsx`
- `src/features/conversation/components/TokenCountCard.tsx`
- `src/features/conversation/markdown.tsx`
- `src/index.css` (code/mark classes if needed)

## Implementation steps
1) TurnList/TurnCard become section blocks (not floating cards)
   - Replace rounded + shadowed containers with `panel` or a border-based section divider.
   - Keep existing spacing rhythm (`p-6`, `space-y-4`) intact.
2) MessageCard tone shift
   - Remove tinted full-card backgrounds and alpha borders.
   - Use a neutral surface with **role accent** via:
     - left border color, and/or
     - a small role tag at the top.
   - Keep role labels (User/Assistant/Thought/etc.) but avoid pastel panels.
3) Tool output and pre blocks
   - Replace `rounded-xl bg-white/70` with `.code-block`.
   - Ensure monospace + line-height remain readable.
4) TokenCountCard cleanup
   - Replace `chip-segmented` usage with row/label pairs or inline tags.
   - Square off the meter bar (no `rounded-full`).
   - Empty state uses `.panel-dashed`.
5) Markdown highlights
   - In `markdown.tsx`, replace rounded highlight marks with `.mark` (no radius).
   - Update code block wrapper to use `.code-block`/`.panel` instead of rounded containers.

## Acceptance criteria
- No rounding or shadows on Turn/Message/Token cards.
- Message role differences are still obvious without pastel backgrounds.
- TokenCountCard reads clearly without segmented pills.
- Markdown snippets and code blocks look sharp and contained.

## Verification
- Open a session with user + assistant + tool output + token_count.
- Confirm role accents are visible and readable.
- Check code blocks and inline code styling are sharp (no rounded pills).
