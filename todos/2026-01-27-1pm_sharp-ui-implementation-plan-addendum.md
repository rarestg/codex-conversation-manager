# Sharp UI Refactor Plan Addendum (Context, Scope, Design-System Inventory)

## Purpose
This addendum captures the concrete code touchpoints, design-system inventory, and
critical UX decisions needed to implement the sharp/no-radius refactor described in
`todos/2026-01-28-1pm_sharp-ui-implementation-plan.md`. It is intentionally
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
     - Caveat: a system UI + mono-forward shell improves scanability, but if Sora is a
       brand anchor we should keep it and achieve sharpness via surfaces instead.

2. Chip vs Tag naming
   - Option A: Keep the name `.chip` but redefine it to a sharp label.
   - Option B: Rename `.chip` to `.tag` and migrate all usage.
   - Decision impacts: `src/index.css`, every component using chip classes.
     - Caveat: renaming is churn; redefining `.chip` is cheaper and can be revisited later.

3. Tag variants (keep minimal)
   - Recommend: only 2-3 variants total. Example:
     - Base: `.tag` (bordered, sharp, neutral)
     - Muted: `.tag-muted` (subtle background for secondary info)
     - Solid: `.tag-solid` (for CTA or emphasis)
   - Retire: `.chip-soft`, `.chip-white`, `.chip-shadow` (too many variants).

4. Toggle affordance
   - Replace rounded pill switches with square toggles or checkbox-style control.
   - Decision impacts: `Toggle.tsx`, compact toggles in `SessionOverview.tsx`.

5. Hierarchy approach
   - Borders + typographic weight only. No shadows, blur, or glass.
   - Focus state: border emphasis (avoid glow/ring if possible).
     - Must not regress: keyboard focus needs to be obvious (sharp outline or border bump).

6. Primitives strategy
   - Option A: start with CSS utilities + CVA recipes to reduce class drift.
   - Option B: introduce `<Panel/>`, `<Tag/>`, `<Button/>`, `<Input/>` wrappers immediately.
   - Caveat: wrappers are higher churn. Prefer recipes first; promote to components only if
     class drift persists after refactor.

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

## Interaction + Density Rules (Add to Style Guide)
These are required to keep “sharp” from becoming “harsh,” and to preserve usability.

Focus visibility (must not regress)
- Use a strong, sharp focus indicator (e.g., `outline: 2px solid var(--accent)` or
  border swap to accent + 1px thickness bump).
- Avoid glow-only focus states; focus must be visible on light backgrounds.

Row/list interaction states
- Hover: subtle background shift (surface-0 → surface-1) and/or left border accent.
- Selected: persistent accent border (left bar) + slightly stronger bg.
- Active/focused row: same as selected, keyed off keyboard focus.
- Clickable affordance: cursor + hover + state; avoid shadow-only affordance.

Modal overlay exception
- Allow one controlled overlay token (e.g., `--overlay: rgba(0,0,0,0.6)`), used only
  for modal backdrops. Modals remain opaque and bordered.

Density contract (minimum viable guidance)
- Define standard paddings (e.g., `--panel-pad: 12px`, `--row-pad-x: 10px`, `--row-pad-y: 6px`).
- Favor rows for list content; reserve cards for multi-paragraph/narrative content.
- Use tabular numerals (`tabular-nums`) in numeric-heavy areas.

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

## UX Feedback Notes (Pushback/Exceptions)
These are proposals raised during UX review that we are not adopting as-is.

- TurnList as grid/table rows: rejected for narrative content. Turns are multi-paragraph,
  so table columns reduce readability. Keep TurnList as content blocks, but align
  metadata rows and tags to the row-based system.
- Sticky headers for turn lists: not necessary for narrative scrolling; better suited for
  Search/Sessions/Workspaces lists.
- Zebra striping: optional only for dense lists; avoid in conversation content to reduce
  distraction. If used, keep it extremely subtle.

## Verification Additions (Objective Done Criteria)
- No `rounded-*` or `backdrop-blur` in application components (document exceptions if any).
- No `shadow-*` used for hierarchy (visual separation must be border + type).
- Focus states are visible on all interactive elements (keyboard navigation).
- List rows have hover/selected/active states.
- Modal overlays use the single approved overlay token.

## Guardrails (Post-Cleanup)
- Add a lint/CI check to flag `rounded-` and `backdrop-blur` usage outside
  explicitly documented exceptions.
