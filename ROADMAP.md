# Roadmap

## Vision

Codex Conversation Manager should evolve from a panel-based browser into a local
Codex session workbench:

- a metadata-rich session catalog on the left
- a detailed conversation pane on the right
- strong filtering, sorting, and content search
- a backend that owns canonical session understanding instead of exposing
  widget-shaped API responses

The target frontend stack for that direction is:

- `@base-ui/react` for menus, popovers, dialogs, and related headless primitives
- `@tanstack/react-table` for the session catalog row model
- `@tanstack/react-virtual` for large catalog datasets
- `react-resizable-panels` for the split layout

The target visual direction remains the sharp, scan-first system described in
`VISUAL_STYLE_GUIDE.txt`: border-driven hierarchy, dense but readable layout,
and minimal decorative gloss.

## Current State

The current app is stable and usable, but the home view is still split across
legacy panels:

- search groups in `SearchPanel`
- session browsing in `SessionsPanel`
- workspace browsing in `WorkspacesPanel`

The backend is already strong at indexing and SQLite-backed search, but its
public contracts still reflect those panels:

- `/api/sessions` returns a tree
- `/api/workspaces` returns a panel feed
- `/api/search` returns grouped search-panel results
- `/api/session` returns raw JSONL that the browser reparses

That means we should avoid spending major effort polishing the old home-screen
structure unless the work clearly carries forward into the catalog/detail-pane
architecture.

## Primary Initiative

The active architecture plan is:

- `todos/2026-03-07-2pm_session-catalog-rearchitecture-plan.txt`

That plan is now the main delivery track for the repo.

Immediate sequence:

1. Add shared session-catalog and session-detail contract types.
2. Move canonical session-detail parsing ownership to the server.
3. Extend the summary schema conservatively for new catalog filters and row metadata.
4. Add `GET /api/session-detail` as the canonical session-detail contract.
5. Migrate the viewer off raw `GET /api/session` for its primary data path.
6. Add a minimal `session-catalog` endpoint with stable filtering, sorting, pagination,
   and `locatorQuery`.
7. Keep `/api/resolve-session` as a thin migration adapter over the same
   locator-resolution service so Enter/UUID flows stay stable during the transition.
8. Add facets once the catalog query shape is stable.
9. Build the new split-pane UI on top of those contracts.
10. Re-scope the remaining sharp UI work onto the new layout rather than the old
    panel stack, then retire legacy adapters as the new shell takes over.

## Useful Before Or During The Rearchitecture

These items still carry forward cleanly:

- `todos/2026-01-28-search-highlight-effective-tokens-plan.txt`
  - Small UX fix for in-session highlighting.
- `todos/sharp-ui/README.md`
  - Status tracker for the sharp UI slices.
- `todos/sharp-ui/2026-01-29-9am_sharp-ui-pr1-core-tokens.md`
  - Shared visual primitives and token layer.
- `todos/sharp-ui/2026-01-29-9am_sharp-ui-pr2-focus-contract.md`
  - Cross-cutting focus system.
- `todos/sharp-ui/2026-01-29-9am_sharp-ui-pr6-conversation-content.md`
  - Still relevant for the right-hand detail pane.
- `todos/sharp-ui/2026-01-29-9am_sharp-ui-pr7-modals-and-cleanup.md`
  - Still relevant once the new shell exists.

## Useful But Should Wait

These plans are still valid, but they should not pre-empt the session-catalog
foundation:

- `todos/2026-01-22-4pm_virtualize-message-list-plan.txt`
  - Useful if the right pane remains slow after the new split-pane UI lands.
- `todos/2026-01-23-7pm_watch-sessions-sse-plan.txt`
  - Better after the catalog exists so auto-refresh has a cleaner target.
- `todos/2026-01-23-7pm_watch-sessions-sse-plan_addendum-index-jobs.md`
  - Same dependency as the watcher/SSE plan; richer job state can wait.
- `todos/2026-01-26-11pm_turn-gap-summary-plan.txt`
  - Nice right-pane affordance, not foundational.
- `todos/nits/2026-01-29-messagecard-renderer-options-plan.txt`
  - Optional cleanup, not structural.
- `todos/2026-01-22-7pm_electron-packaging-plan.txt`
  - Separate packaging track, definitely later.

## Decisions Already Made

- The workspace-detail-page idea is superseded.
  - Workspace should become a filter or saved scope within the unified session
    catalog, not a separate primary page.
- Sharp UI work that specifically targets the current `SearchPanel`,
  `SessionsPanel`, and `WorkspacesPanel` should be re-scoped onto the new
  catalog pane.
- The duplicate early-morning session-catalog draft is archived in favor of the
  later consolidated plan.

## Where To Look

- Product and implementation direction: `ROADMAP.md`
- Active rearchitecture plan:
  `todos/2026-03-07-2pm_session-catalog-rearchitecture-plan.txt`
- Sharp UI tracking: `todos/sharp-ui/README.md`
- Completed history: `todos/_done/INDEX.txt`
- Superseded plans: `todos/_archive/`
