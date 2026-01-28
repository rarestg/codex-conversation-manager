# Sharp UI Refactor — Mapping + Minimal Tag/Panel Spec

## Purpose
This mapping document defines the minimum tag/panel utility spec and maps each
component to those utilities. It assumes a sharp, no-radius, no-glass, minimal
surface language and is meant to prevent ad-hoc class drift during refactors.

## Minimal Tag/Panel Spec (Proposed)
These are the only surface and label utilities needed for the refactor.
Names are placeholders: use `.chip` if we decide to preserve naming, or rename
to `.tag` consistently across the codebase.

Panels (containers)
- `.panel`: primary container (flat bg, solid border, no radius, no shadow)
- `.panel-muted`: nested section (subtle bg, solid border, no radius)
- `.panel-dashed`: empty/placeholder state (dashed border, no radius)
- `.panel-row`: tight header row (no padding bloat; used for headers/controls)

Tags (labels)
- `.tag` (or `.chip`): base label, sharp, border-only by default
- `.tag-muted`: low-emphasis label (subtle bg)
- `.tag-solid`: stronger emphasis (solid bg, usually for CTA or active)
- Sizes: `tag-xs`, `tag-sm`, `tag-md`, `tag-lg` (or keep chip sizes)
- `.tag-button`: interactive state (hover/disabled)
- Optional helper: `.tag-count` for compact numeric (only if needed; avoid special bubble)

Inputs / Controls
- `.input`: shared sharp input styling (bordered, no rounding, focus border)
- `.select`: shared sharp select styling
- `.button`: shared sharp button styling (bordered, no rounding, minimal hover)
- `.toggle`: if keeping a custom switch, make it square; otherwise use checkbox

Other
- `.code-inline`: sharp inline code (no rounding)
- `.code-block`: sharp block wrapper (no rounding)
- `.mark`: sharp snippet highlight (no rounding)

Notes
- Avoid multiple background opacities (`bg-white/70`, `bg-white/80`).
- Avoid `shadow-*` classes entirely.
- Avoid `rounded-*` in all native components; any remaining should be documented.

## Component Mapping (by file)
Below is a targeted mapping of existing classes to the new utilities. Use this
as a checklist while refactoring. Each item lists the primary surface(s) and
label/tag usage that should be replaced.

1. `src/index.css`
- Replace `.chip` and variants with sharp tag definitions.
- Remove `.chip-shadow`, `.shadow-card`, `.shadow-soft`.
- Replace `.meta-row`, `.chip-segmented`, `.chip-count`, `.search-result-chip`
  with tag/panel variants.
- Add `.panel`, `.panel-muted`, `.panel-dashed`, `.panel-row`.
- Update `.markdown-body .inline-code` and snippet marks.
- Update `.search-skeleton-*` styles for sharp look.
- Update `.os-theme-codex` handle radius to 0.

1. `src/features/conversation/components/SearchPanel.tsx`
- Outer container: `rounded-3xl ... shadow-card backdrop-blur` => `.panel`.
- Inputs/selects: `rounded-2xl ... shadow-sm` => `.input` / `.select`.
- Search result group container: `rounded-2xl ... bg-slate-50/80` => `.panel-muted`.
- Result rows: `rounded-2xl ... bg-white` => `.panel` or `.panel-row`.
- Result metrics chips: `.search-result-chip` => `.tag tag-xs` (or size).
- Empty/error/too-short panels: `rounded-2xl border-dashed` => `.panel-dashed`.

1. `src/features/conversation/components/TurnCard.tsx`
- Card container: `rounded-3xl ... shadow-card` => `.panel`.
- Turn metadata pills: `rounded-full bg-slate-100` => `.tag tag-xs`.
- Empty items state: `rounded-2xl border-dashed` => `.panel-dashed`.

1. `src/features/conversation/components/TurnList.tsx`
- Loading, warnings, empty state cards: `rounded-3xl` => `.panel` / `.panel-dashed`.

1. `src/features/conversation/components/SessionHeaderVariantB.tsx`
- Subtitle row chips: `.chip` => `.tag` (sharp).
- Stats row chips: `.chip chip-sm chip-filled` => `.tag tag-sm` (variant).
- Copy CTA: `chip-lg chip-filled chip-shadow` => `.button` or `.tag-solid`.
- Meta rows: `.meta-row` => `.panel-row` (sharp).

1. `src/features/conversation/components/SessionHeader.tsx`
- Same as VariantB: chips => tags, CTA => button/tag-solid, meta rows => panel-row.

1. `src/features/conversation/components/SessionsPanel.tsx`
- Panel container: `rounded-3xl ... shadow-card` => `.panel`.
- Filter badges + buttons: `rounded-full` => `.tag` or `.button`.
- Skeleton cards: `rounded-2xl` => `.panel` (no radius).
- Year/month/day summaries: `rounded-xl` => `.panel-row`.
- Session cards: `rounded-2xl` => `.panel`.
- Session metadata chips: `.chip` => `.tag` (no shadow).
- Copy session id chip: `.chip chip-muted` => `.tag tag-muted`.

1. `src/features/conversation/components/WorkspacesPanel.tsx`
- Panel container: `rounded-3xl ... shadow-card` => `.panel`.
- Loading badge + sort select: `rounded-full` => `.tag` / `.select`.
- Active workspace pills + clear button: `rounded-full` => `.tag` / `.button`.
- Workspace cards: `rounded-2xl` => `.panel`.
- GitHub badge: `rounded-full` => `.tag` (or simple icon + text without pill).
- Empty state: `rounded-2xl` => `.panel-dashed`.

1. `src/features/conversation/components/MessageCard.tsx`
- Card container: `rounded-2xl ... shadow-sm` => `.panel` (tone via border/bg).
- Copy buttons: `chip-lg chip-filled chip-shadow` => `.tag` / `.button`.
- Tool output pre: `rounded-xl bg-white/70` => `.code-block`.

1. `src/features/conversation/components/TokenCountCard.tsx`
- Card container: `rounded-2xl ... shadow-sm` => `.panel-muted` or `.panel`.
- Copy button: `chip-lg chip-filled chip-shadow` => `.tag` / `.button`.
- Meter bar: `rounded-full` => square bar or minimal progress line.
- `.chip-segmented` blocks => `.panel-row` or inline tag list.
- Empty state panel: `rounded-2xl border-dashed` => `.panel-dashed`.

1. `src/features/conversation/components/Toggle.tsx`
- Toggle container: `rounded-xl ... shadow-sm` => `.panel-row`.
- Toggle track/knob: replace rounded pill with square toggle or checkbox.

1. `src/features/conversation/components/SessionOverview.tsx`
- Container: `rounded-3xl ... shadow-card backdrop-blur` => `.panel`.
- Compact toggle pills: `chip` + `rounded-full` switch => new tag + square toggle.
- `chip-count` => tag variant or small count label (no bubble).

1. `src/features/conversation/components/SettingsModal.tsx`
- Modal container: `rounded-3xl ... shadow-soft` => `.panel`.
- Buttons: `rounded-full ... shadow-sm` => `.button`.
- Inputs: `rounded-2xl ...` => `.input`.
- Callouts: `rounded-2xl` => `.panel-muted` / `.panel-dashed`.

1. `src/features/conversation/components/TurnJumpModal.tsx`
- Modal container: `rounded-3xl ... shadow-soft` => `.panel`.
- Buttons + input: `rounded-*` => `.button` / `.input`.

1. `src/features/conversation/ConversationViewer.tsx`
- App header container: `rounded-3xl ... shadow-soft backdrop-blur` => `.panel`.
- Home/Jump/Settings buttons: `rounded-full ... shadow-sm` => `.button`.
- Error banner: `rounded-2xl` => `.panel-muted` or `.panel-dashed`.

1. `src/features/conversation/ConversationMain.tsx`
- Search match bar: `rounded-2xl ... shadow-sm` => `.panel-row`.
- Status pills inside match bar: `rounded-full` => `.tag`.
- Prev/Next buttons: `rounded-full ... shadow-sm` => `.button`.

1. `src/features/conversation/markdown.tsx`
- Code block wrapper: `rounded-xl bg-white/70` => `.code-block`.
- Inline code: `.inline-code` => `.code-inline` (no radius).
- Search snippet mark: `rounded` => `.mark` (no radius).

1. `src/features/conversation/CanvasView.tsx` (optional for consistency)
- All demo containers: `rounded-3xl ... shadow-card` => `.panel`.
- Empty/demo placeholders: `rounded-3xl border-dashed` => `.panel-dashed`.

1. `src/features/conversation/canvas/tokenCountVariants.tsx` (optional)
- All demo containers and panels => `.panel` / `.panel-muted`.
- Segmented meter blocks => `.panel-row` or inline tag lists.

## Replacement Examples (Class Patterns)
These are pattern-level replacements used repeatedly in components:

1. Container (glassy card)
- From: `rounded-3xl border border-white/70 bg-white/80 p-5 shadow-card backdrop-blur`
- To:   `panel` (with padding utility if panel does not bake in spacing)

1. Input/select
- From: `rounded-2xl border border-slate-200 bg-white ... shadow-sm focus:ring-2`
- To:   `input` / `select` (sharp borders, focus border accent)

1. Tag/label
- From: `chip chip-sm chip-filled gap-1`
- To:   `tag tag-sm tag-muted` (or base tag + variant)

1. Empty/dashed panels
- From: `rounded-2xl border border-dashed border-slate-200 ...`
- To:   `panel-dashed`

1. CTA buttons
- From: `chip chip-lg chip-filled chip-shadow chip-button ...`
- To:   `button` (sharp, border emphasis) or `tag-solid`

## Open Questions for Implementation
- Final naming: `.chip` vs `.tag`.
- Confirm the minimal set of tag variants (2 vs 3).
- Toggle redesign: square switch vs checkbox.
- Typography decision (Sora vs mono-forward).
