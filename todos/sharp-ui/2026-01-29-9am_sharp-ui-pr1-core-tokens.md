# PR 1 — Theme Tokens + Sharp Core Utilities

## Read first (required)
- `todos/2026-01-27-1pm_sharp-ui-implementation-plan.md`
- `todos/2026-01-27-1pm_sharp-ui-implementation-plan-mapping.md`
- `todos/2026-01-27-1pm_sharp-ui-implementation-plan-addendum.md`
- `src/index.css`
- `VISUAL_STYLE_GUIDE.txt`
- `index.html` (font imports only)

## Goal
Introduce the sharp design system **centrally** (tokens + primitives) and remove global gloss without touching component classNames yet.

## Scope
Only `src/index.css` (plus optional minor notes in `VISUAL_STYLE_GUIDE.txt` if you want to flag that focus primitives exist). No component refactors in this PR.

## Files to touch
- `src/index.css`
- Optional: `VISUAL_STYLE_GUIDE.txt` (just a short note that focus + list primitives now exist)

## Implementation steps
1) Add sharp tokens in `:root` (mapped to current palette)
   - `--surface-0`, `--surface-1`, `--surface-2`
   - `--border`, `--border-muted`, `--border-strong`
   - `--text-0`, `--text-1`, `--text-2`
   - `--accent`, `--accent-muted`
   - `--overlay`
2) Remove gloss at the base layer
   - Replace body gradients with a single flat background (use `--surface-1` or mapped sand tone).
   - Keep body font as readable sans; do not change fonts here.
3) Introduce minimal primitives (not yet used by components)
   - `.panel`, `.panel-muted` (no border by default), `.panel-dashed`
   - `.list`, `.list-row`, `.row-button`, `.row-selected`
   - `.tag` (or alias `.tag` to existing `.chip`), `.tag-muted`, `.tag-solid`
   - `.input`, `.select`, `.button`
   - `.code-inline`, `.code-block`, `.mark`
   - `.focusable`, `.focus-within` (outline-based; no rings)
4) Neutralize shadow utilities without breaking builds
   - Make `.shadow-soft`, `.shadow-card`, `.chip-shadow` no-ops (or remove their effects).
   - Keep class names to avoid churn until later PRs remove usages.
5) Scrollbar sharpness
   - Set `--os-handle-border-radius: 0` in `.os-theme-codex`.
6) Motion guard (optional)
   - If you add `prefers-reduced-motion`, keep it minimal (no behavior changes yet).

## Acceptance criteria
- App loads with a flat background (no gradients).
- New tokens and primitives exist in `src/index.css`.
- Shadow utilities are neutralized, but no classnames removed yet.
- Scrollbar handle is square.

## Verification
- Open any page; confirm background is flat and scrollbars are squared.
- Quick visual scan: layout spacing should be unchanged (no component edits).
