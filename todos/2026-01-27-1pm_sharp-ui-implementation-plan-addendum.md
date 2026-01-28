# Sharp UI Refactor Plan Addendum (Context, Scope, Design-System Inventory)

## Purpose
This addendum captures the concrete code touchpoints, design-system inventory, and
critical UX decisions needed to implement the sharp/no-radius refactor described in
`todos/2026-01-27-1pm_sharp-ui-implementation-plan.md`. It is intentionally
context-rich so implementation can proceed without re-auditing the codebase.

This is NOT a new plan. It is a scoped, actionable mapping of the plan to the
existing code and UI primitives, with a UX-first simplification lens.

## UX/Design Decisions Required (Before Coding)
These choices affect multiple files and should be decided once, centrally:

1. Typography strategy
- Option A: Keep Sora as the primary UI font, keep mono for code only.
- Option B: Use a mono-forward UI (e.g., IBM Plex Mono) for the app shell
  while retaining a sans for headings. This better matches the TUI-adjacent
  direction but increases visual density and may feel less friendly.
- Decision impacts: `index.html` font imports, `src/index.css` base font-family.

1. Chip vs Tag naming
- Option A: Keep the name `.chip` but redefine it to a sharp label.
- Option B: Rename `.chip` to `.tag` and migrate all usage.
- Decision impacts: `src/index.css`, every component using chip classes.

1. Tag variants (keep minimal)
- Recommend: only 2-3 variants total. Example:
  - Base: `.tag` (bordered, sharp, neutral)
  - Muted: `.tag-muted` (subtle background for secondary info)
  - Solid: `.tag-solid` (for CTA or emphasis)
- Retire: `.chip-soft`, `.chip-white`, `.chip-shadow` (too many variants).

1. Toggle affordance
- Replace rounded pill switches with square toggles or checkbox-style control.
- Decision impacts: `Toggle.tsx`, compact toggles in `SessionOverview.tsx`.

1. Hierarchy approach
- Borders + typographic weight only. No shadows, blur, or glass.
- Focus state: border emphasis (avoid glow/ring if possible).

## Design-System Inventory: Pills/Chips (Current)
Current system is fragmented and should be consolidated.

Primary chip system (in `src/index.css`):
- `.chip` + sizes: `chip-xs`, `chip-sm`, `chip-md`, `chip-lg`
- Variants: `chip-filled`, `chip-soft`, `chip-muted`, `chip-white`
- Interaction: `chip-button`
- Extras: `chip-count`, `chip-segmented`, `chip-shadow`

Special chip system:
- `.search-result-chip` (SearchPanel only) with its own background/border/shadow.

Ad-hoc pill styles (not using `.chip`):
- `rounded-full` badges in `WorkspacesPanel`, `SessionsPanel`, `TurnCard`,
  `ConversationMain` match bar, `ConversationViewer` header buttons, etc.

Toggle pills:
- Rounded track/knob in `Toggle.tsx` and compact toggles in `SessionOverview.tsx`.

Summary of distinct pill styles in use:
- 1 primary chip system
- 1 search-specific chip system
- 1 segmented chip system
- 1 count bubble chip
- multiple ad-hoc rounded badges
- rounded toggle switches

This is effectively 6-7 styles that should compress into 2-3 sharp tags and
1 sharp toggle style.

## Outliers to Simplify or Merge
- `.search-result-chip` => merge into shared tag styles.
- `chip-soft` and `chip-white` => merge into 1 neutral/filled variant.
- `chip-shadow` => remove entirely.
- `chip-count` => replace with a tiny tag variant, not a special bubble.
- `chip-segmented` => evaluate replacing with a simple bordered row or
  a stack of tags; avoid segmented pill rounding.
- Ad-hoc rounded badges => replace with shared tag classes.

## Surface Utilities to Introduce (Recommended)
Add a minimal set of sharp, reusable surface helpers in `src/index.css`:

- `.panel`: primary container, solid background, solid border, square corners.
- `.panel-muted`: nested section, subtle background for grouping.
- `.panel-dashed`: empty states or placeholders, dashed border.
- `.panel-row`: tight header/row treatment for list headers.

These replace repeated Tailwind class strings across components.

## High-Impact Files to Update
These files must be refactored to remove rounded corners, glass, blur, and
shadows, and to adopt the new panel/tag utilities.

Global / utilities
- `src/index.css` (palette, panels, tags, inline code, search skeletons, shadows)
- `VISUAL_STYLE_GUIDE.txt` (update to sharp rules, tag utilities)
- `index.html` (font decision)

Primary UI components
- `src/features/conversation/components/SearchPanel.tsx`
- `src/features/conversation/components/TurnCard.tsx`
- `src/features/conversation/components/TurnList.tsx`
- `src/features/conversation/components/SessionHeaderVariantB.tsx`
- `src/features/conversation/components/SessionHeader.tsx`
- `src/features/conversation/components/SessionsPanel.tsx`
- `src/features/conversation/components/WorkspacesPanel.tsx`
- `src/features/conversation/components/MessageCard.tsx`
- `src/features/conversation/components/TokenCountCard.tsx`
- `src/features/conversation/components/Toggle.tsx`
- `src/features/conversation/components/SessionOverview.tsx`
- `src/features/conversation/components/SettingsModal.tsx`
- `src/features/conversation/components/TurnJumpModal.tsx`

App layout / status bars
- `src/features/conversation/ConversationViewer.tsx`
- `src/features/conversation/ConversationMain.tsx`

Markdown rendering / code blocks
- `src/features/conversation/markdown.tsx`
  - Remove rounded code block wrappers and inline-code rounding.
  - Update snippet highlight mark class (remove rounding).

Canvas/demo surfaces (optional but recommended to match new UI)
- `src/features/conversation/CanvasView.tsx`
- `src/features/conversation/canvas/tokenCountVariants.tsx`

## Rounded/Glassy/Shadows Audit (Examples)
These are representative, not exhaustive. Use ripgrep to find all instances:
- `rounded-*` classes throughout components
- `bg-white/70`, `bg-white/80`, `bg-slate-50/80`
- `shadow-card`, `shadow-soft`, `shadow-sm`
- `backdrop-blur`

Search:
- `rg -n "rounded-|bg-white/|backdrop-blur|shadow-" src src/index.css`

## Minimalist UX Guidance (Implementation Lens)
- Reduce decorative contrast: avoid gradients, blur, translucency.
- Use clear borders + text weight for hierarchy.
- Keep spacing consistent; do not compensate with extra margins.
- Favor fewer tag styles and fewer surface variants.
- Tighten dense panels but keep readability: consistent line-height and
  deliberate gaps are better than extra chrome.

## Open Questions to Resolve
- Are we keeping Sora for headings, or switching to mono-forward UI?
- Should tags be renamed or redefined in-place?
- What is the minimal accepted set of tag variants (2 vs 3)?
- Do we want square toggles or a minimal checkbox style?

## Notes
- The CopyButton UX rules stay intact; only surfaces change.
- The spacing rhythm (gap-3 cadence) remains the same; do not add margins
  to compensate for removed shadows.
- The scrollbars are currently rounded (`--os-handle-border-radius: 999px`).
  This should be set to `0` in the sharp theme.
