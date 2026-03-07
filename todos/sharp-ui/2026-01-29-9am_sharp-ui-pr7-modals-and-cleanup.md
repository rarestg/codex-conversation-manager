# PR 7 — Modals, Remaining Chrome, Cleanup + Guardrails

## Read first (required)
- `todos/sharp-ui/2026-01-27-1pm_sharp-ui-implementation-plan.md`
- `todos/sharp-ui/2026-01-27-1pm_sharp-ui-implementation-plan-mapping.md`
- `todos/sharp-ui/2026-01-27-1pm_sharp-ui-implementation-plan-addendum.md`
- `src/features/conversation/ConversationViewer.tsx`
- `src/features/conversation/ConversationMain.tsx`
- `src/features/conversation/components/SessionOverview.tsx`
- `src/features/conversation/components/SettingsModal.tsx`
- `src/features/conversation/components/TurnJumpModal.tsx`
- `src/features/conversation/components/Sidebar.tsx`
- `src/features/conversation/components/Toggle.tsx`
- `src/features/conversation/CanvasView.tsx` (optional cleanup)
- `VISUAL_STYLE_GUIDE.txt`
- `src/index.css`

## Goal
Finish the migration: modals, headers, toggles, remaining chrome, and cleanup. Document any intentional exceptions and prevent regressions.

## Scope
Modals, headers/controls, toggles, and final CSS cleanup + style guide updates.

## Files to touch
- `src/features/conversation/components/SettingsModal.tsx`
- `src/features/conversation/components/TurnJumpModal.tsx`
- `src/features/conversation/components/SessionOverview.tsx`
- `src/features/conversation/components/Toggle.tsx`
- `src/features/conversation/ConversationViewer.tsx`
- `src/features/conversation/ConversationMain.tsx`
- `src/features/conversation/components/Sidebar.tsx`
- `src/features/conversation/CanvasView.tsx` (optional)
- `VISUAL_STYLE_GUIDE.txt`
- `src/index.css` (cleanup + guardrails)

## Implementation steps
1) Modals (Settings + TurnJump)
   - Overlay uses the single `--overlay` token (opaque scrim).
   - Modal surfaces use `panel` (opaque, bordered, no blur, no shadow).
   - Buttons/inputs use `.button` / `.input` / `.focusable`.
2) Toggle decision (make the call)
   - Preferred: convert to checkbox row (sharp, standard, accessible).
   - If keeping a switch: ensure strong on/off styling and `focus-within`.
3) Remaining chrome
   - ConversationViewer header, ConversationMain match bar, SessionOverview container:
     - remove `rounded-*`, `bg-white/70`, `shadow-*`, `backdrop-blur`.
     - use `panel` + `panel-row` + `.button` + `.tag`.
4) Sidebar (if anything remains soft)
   - Ensure Search/Sessions inside sidebar inherit new panel/list styles (no extra work if PR4/5 done).
5) Cleanup
   - Remove unused CSS utilities (`shadow-*`, `chip-soft`, `search-result-chip`, etc.).
   - Replace lingering `ring-*`, `bg-white/80`, `bg-slate-50/80`, `rounded-*`, `backdrop-blur`.
   - Document any intentional exceptions in the style guide.
6) Guardrails
   - Add a simple grep-based check or npm script to flag reintroduction of:
     - `rounded-`, `backdrop-blur`, `bg-*/80`, `shadow-*`, `ring-*`

## Acceptance criteria
- All modals and chrome surfaces are sharp, opaque, and border-based.
- Toggle control matches the sharp theme and is keyboard-accessible.
- `rg "rounded-|backdrop-blur|bg-white/|shadow-|ring-" src` returns only documented exceptions (ideally none).
- Style guide matches the final UI and documents focus + list rules.

## Verification
- Open Settings + TurnJump; verify overlays and focus outlines.
- Tab through header buttons and match controls; focus is visible.
- Run grep checks and confirm cleanup.
