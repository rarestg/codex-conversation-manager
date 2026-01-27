# Sharp UI Refactor Plan (No-Radius, Low-Fluff Theme)

## Context
We are shifting Codex Conversation Manager to a sharp, low-ornament interface that feels closer to a terminal/TUI aesthetic: no rounded corners, no translucent glass, minimal shadows, and a simpler visual hierarchy that prioritizes clarity and scanability. The current UI (see `src/index.css` and components like `SessionHeaderVariantB`, `SearchPanel`, `TurnCard`, `TurnList`) leans on rounded surfaces, soft shadows, translucent layers, and rich background gradients. These design choices look polished but read as “consumer UI,” which is misaligned with a devtool that should feel snappy, direct, and utilitarian.

We are not moving to TUI/INK yet, but we should treat this as a step toward that direction. The new design must avoid visual dependencies that don’t translate to terminal-like rendering (rounded corners, blur, layered transparency), and should rely on plain boxes, borders, and high-contrast text.

This document is a complete implementation handoff. It explains what to change, why, and how to verify each step.

## Relevant Codebase Areas
- Global styling and utilities live in `src/index.css`. This file defines color tokens, typography, background gradients, chip/pill utilities, and custom shadows. It is the single most impactful file for the theme change.
- Layout and component styling is Tailwind-heavy. Components embed styling with classNames, so visual changes require class refactors in several files.
- Priority components and patterns:
  - `src/features/conversation/components/SearchPanel.tsx` (glassy container, rounded input, rounded search results).
  - `src/features/conversation/components/TurnCard.tsx` and `TurnList.tsx` (rounded cards, shadows, and empty-state panels).
  - `src/features/conversation/components/SessionHeaderVariantB.tsx` (chip-based metadata and call-to-action styling).
  - Shared UI helpers like `CopyButton` and chip utilities defined in `src/index.css`.
- `VISUAL_STYLE_GUIDE.txt` codifies spacing rhythm and CopyButton rules. It must be updated to express the new sharp-only style while preserving spacing and interaction standards.

## Desired Outcome
- All UI surfaces are sharp (no radii). This includes cards, inputs, chips/tags, and inline code.
- Surfaces are opaque, no “glass” or translucency. Backdrop blur and gradients are removed.
- Shadows are removed or reduced to near-zero. Hierarchy is expressed via borders, typography, and spacing.
- The design should look clean and dense but not cramped—tight spacing is okay, inconsistent spacing is not.
- The visual language should be friendly to a future TUI port: simple boxes, plain lines, minimal decorative flourishes.

## The Plan (Execution Order)

### Step 1: Establish sharp theme tokens and base surfaces in `src/index.css`

What to do:
- Replace the current root color palette with a minimal, high-contrast palette suitable for sharp surfaces. Keep variables for inks and surfaces so component classes stay readable. Example: `--surface-0`, `--surface-1`, `--border-strong`, `--border-soft`, `--accent`.
- Remove background gradients and set a flat background on `body`.
- Set a neutral, low-ornament base font (a clean mono-forward or simple sans). If you keep Sora, make sure it doesn’t feel “brand-heavy.” For a TUI-leaning feel, prefer a mono or hybrid (e.g., mono for UI, sans for headings). This should be a deliberate decision documented in the style guide.

Why:
- A single, flat background eliminates “consumer app” gloss and avoids effects that won’t translate to TUI.
- Centralized variables prevent a whack-a-mole of per-component color changes.

Dependencies:
- None, but this will inform how component class refactors are structured.

### Step 2: Replace rounded and glassy utility classes with sharp, reusable “panel” utilities

What to do:
- In `src/index.css`, replace or redefine the following utilities:
  - `.chip` and related chip utilities should be squared (no `rounded-full`) and simplified to sharp “tags.”
  - `.meta-row` should be a sharp, bordered row (no `rounded-2xl`, no translucent backgrounds).
  - Inline code styling (`.markdown-body .inline-code`) should use sharp edges and minimal background tint.
  - Remove `shadow-card` and `shadow-soft` or reduce them to no-op utilities. If you retain a “shadow,” it should be barely visible and not used for hierarchy.
- Introduce new shared classes for surfaces and states to replace repetitive Tailwind class strings:
  - `.panel` (primary container: solid background, solid border, sharp edges).
  - `.panel-muted` (subtle background for nested sections).
  - `.panel-dashed` (empty/placeholder state).
  - `.panel-header` or `.panel-row` (tight header rows with clear text hierarchy).
- Update `.chip` naming in the guide to “tag” or “label.” If the team prefers “chip,” keep the name but redefine the style to be sharp.

Why:
- Having one or two surface utilities reduces component class noise and makes the theme consistent.
- The old rounded/glassy styles were pervasive; replacing them centrally is faster and less error-prone.

Dependencies:
- After this step, components should migrate from ad-hoc Tailwind classes to the new utilities in Step 3.

### Step 3: Refactor key components to use sharp utilities

What to do:
- `SearchPanel.tsx`:
  - Replace the outer container with `.panel`.
  - Remove `backdrop-blur`, translucent backgrounds, and rounded classes.
  - Replace input styling with a sharp input style (boxed, no rounding, border emphasis on focus rather than glow).
  - Search result blocks should be flat rows or simple boxed sections (`panel-muted` or `panel`), not nested cards.
- `TurnCard.tsx`:
  - Replace rounded card with `.panel`.
  - Remove shadows.
  - Empty states become `.panel-dashed` and square.
- `TurnList.tsx`:
  - Loading/empty/error panels should use `.panel` or `.panel-dashed` and be square.
  - Reduce vertical gaps where appropriate to reinforce density (confirm with spacing guide).
- `SessionHeaderVariantB.tsx`:
  - Convert chips to sharp tags (same components, new styles).
  - The “Copy conversation” CTA should be a sharp button with border emphasis, not a soft pill.
  - Meta rows should use the updated `.meta-row` (sharp).
- Check other high-surface components even if not listed here: `Sidebar.tsx`, `SessionsPanel.tsx`, `WorkspacesPanel.tsx`, `MessageCard.tsx`, `SettingsModal.tsx`, `Toggle.tsx`.
  - Any `rounded-*`, `shadow-*`, `bg-white/XX`, or `backdrop-blur` should be replaced with sharp equivalents.

Why:
- The theme cannot be achieved only through utilities; per-component class cleanup is required.
- This also reduces repeated class strings and makes future changes easier.

Dependencies:
- Depends on Step 2. Do not refactor components before new utilities exist.

### Step 4: Update markdown and code presentation for sharpness

What to do:
- In `src/index.css`, simplify markdown block presentation:
  - Reduce padding and remove any rounding on code blocks.
  - Inline code should be minimal: plain background or subtle underline, no rounded pill.
- Ensure line-height and spacing in `.markdown-body` remain consistent, but tighten where it currently feels overly airy.

Why:
- Markdown is core content. If it retains soft styling, the overall look will still feel “rounded.”

Dependencies:
- None, but best after Step 1 so new color tokens can be applied.

### Step 5: Align `VISUAL_STYLE_GUIDE.txt` to the sharp theme

What to do:
- Add a new section at the top: “Sharp UI Rules” describing the new aesthetic, with explicit bans: no radii, no glass, no blur, no soft shadows.
- Update “Chip Utilities (Reusable Pills)” to “Tag Utilities (Sharp Labels)” and redefine their style rules.
- Update the “Meta rows” rule to emphasize square edges and border-based hierarchy.
- Preserve the spacing/copy button rules. The spacing system is still valid; only the visual skin changes.
- Add a note about future TUI portability: avoid designs that require translucency or complex visual stacking.

Why:
- The visual guide is the contract for future changes. If it doesn’t encode the new style, drift will occur.

Dependencies:
- Should happen after Step 2 so the guide reflects the new utilities.

### Step 6: Clean up Tailwind class usage and remove dead styles

What to do:
- Search for `rounded-`, `shadow-`, `bg-white/`, `backdrop-blur`, `ring-` and replace with sharp equivalents.
- Remove unused utilities from `src/index.css` (e.g., `shadow-card` or rounded-centric class names) once components no longer use them.
- Make sure any remaining `rounded-*` in 3rd-party components is intentional (e.g., if a library forces rounding). These should be consciously accepted exceptions and documented.

Why:
- This step prevents regressions and leaves the codebase clean and aligned with the new aesthetic.

Dependencies:
- Must happen after all component refactors to avoid breaking UI.

## Simplifications Expected
- Fewer bespoke class strings in components because `panel`, `panel-muted`, and `panel-dashed` replace long Tailwind chains.
- A smaller, clearer palette: fewer bespoke translucent backgrounds and fewer decorative gradients.
- Visual hierarchy is enforced by borders and text weight, which is easier to reason about than stacked shadows and translucent layers.
- Fewer custom shadow or blur utilities; most visual structure is handled in one place.

## Decisions & Tradeoffs

### Decision: Full sharp-only replacement (no hybrid mode)
- Alternative: keep a toggle or preserve rounded pills. We are explicitly not doing this. The goal is a consistent, no-radius language.
- Tradeoff: the UI may feel less “friendly” or “premium,” but it will feel more like a professional devtool.

### Decision: Remove translucency and blur entirely
- Alternative: keep subtle translucency for depth. Rejected because it creates a dependency on layered rendering that doesn’t map to TUI/INK.
- Tradeoff: less perceived depth; hierarchy must be built with borders and typography.

### Decision: Use borders over shadows
- Alternative: keep micro-shadows. Rejected because even small shadows reintroduce “softness.”
- Tradeoff: less visual separation at a glance. Counteract by raising contrast and tightening spacing.

### Decision: Maintain existing spacing system
- Alternative: redesign spacing entirely. Rejected because the spacing guide is strong and already tested.
- Tradeoff: some spacing may feel “roomier” than a strict TUI, but this is acceptable in the web app context.

## Landmines and Non-Obvious Risks
- The CopyButton UX relies on specific structure. Avoid changing layout or alignment behavior; only change surface styles.
- The spacing system uses `gap-*` and avoids mixing with `mt-*`. If you add margins to compensate for removed shadows, you may accidentally break rhythm.
- Search panel uses container queries (`search-panel`), so layout changes must preserve the container and class names unless you rework those rules.
- Inline markdown styles are applied via `markdown-body` and could be overridden by Tailwind classes in components. Keep changes in CSS to avoid per-component divergence.
- `os-theme-codex` defines scrollbar handle rounding. This should be updated to a sharp handle (radius 0) or it will look inconsistent.
- `MessageCard` is not shown above but likely contains rounded elements. It must be audited; it is easy to miss.

## Verification

Step-by-step checks:
1) After Step 1 (base theme): open the app and confirm the body background is flat, no gradients, and typography is as intended.
2) After Step 2 (utilities): verify that `.panel` and `.chip` styles produce sharp edges and that no element uses `rounded-*` by default.
3) After Step 3 (components): navigate to Search, Session view, and empty states; visually confirm all surfaces are square, opaque, and no shadows/blur remain.
4) After Step 4 (markdown): open a session with code blocks and inline code; confirm sharp edges and consistent line spacing.
5) After Step 5 (style guide): ensure the guide reads clearly and matches the new UI; it should be possible to build a new component using only that guide.

Technical checks:
- Run `npm run typecheck` to catch any TS issues from refactors.
- Run `npm run check` to ensure lint/format rules are satisfied.

## Interpreting VISUAL_STYLE_GUIDE.txt in the Sharp Era
The style guide remains the source of truth for spacing, rhythm, and CopyButton behavior. The only thing that changes is the “skin.” When the guide says “chip” or “pill,” it now means a sharp label with border and solid background. When it references “outline matches other pill borders,” it refers to the standardized sharp border tokens. “Meta rows” remain stacked and consistent, but are now square and opaque. All spacing rules still apply; the sharp theme does not change rhythm, only surface treatment.

## Note on Future TUI/INK Transition
We are not moving to TUI now, but this refactor should avoid any dependency on visual effects that do not translate to terminal rendering. This means: no rounded corners, no blur, no translucent overlays, minimal reliance on color gradients, and no need for box shadows to separate layers. If we later move to INK, the UI should map cleanly to boxed sections and text-based hierarchy without rethinking the entire information structure.
