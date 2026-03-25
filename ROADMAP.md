# Roadmap

## Vision

Codex Conversation Manager is a local Codex session workbench:

- a metadata-rich session catalog on the left
- a detailed conversation pane on the right
- strong filtering, sorting, and content search
- a backend that owns canonical session understanding

The current frontend stack:

- `@base-ui/react` for menus, popovers, selects, and checkboxes
- `@tanstack/react-table` for the session catalog row model
- `react-resizable-panels` for the split layout
- `@tanstack/react-virtual` is not yet installed; planned for large catalog datasets

The visual direction remains the sharp, scan-first system described in
`VISUAL_STYLE_GUIDE.txt`: border-driven hierarchy, dense but readable layout,
and minimal decorative gloss.

## Current State

The session-catalog rearchitecture has landed across three phases:

1. **Backend contracts** — the server owns a canonical JSONL parser
   (`server/sessionDetail/parser.ts`), exposes `GET /api/session-detail` and
   `GET /api/session-catalog`, and the frontend no longer parses raw JSONL.
2. **Frontend shell** — the root route is a persistent resizable split layout
   with `SessionCatalogPane` on the left and `ConversationMain` on the right.
3. **Facet filters** — Base UI `Popover`/`Checkbox` menus let users filter by
   workspace, repo, and branch using server-driven facet counts from
   `GET /api/session-catalog-facets`.

Legacy panel components (`SearchPanel`, `SessionsPanel`, `WorkspacesPanel`,
`Sidebar`) still exist on disk but are no longer mounted on the primary route.
Legacy endpoints (`/api/sessions`, `/api/workspaces`, `/api/search`,
`/api/session`) still exist for backward compatibility and debug/export use.

## Completed Rearchitecture Sequence

The session-catalog rearchitecture was implemented in three phases (archived in
`plans/_archived/`):

1. ~~Add shared session-catalog and session-detail contract types.~~
2. ~~Move canonical session-detail parsing ownership to the server.~~
3. ~~Extend the summary schema conservatively for new catalog filters and row metadata.~~
4. ~~Add `GET /api/session-detail` as the canonical session-detail contract.~~
5. ~~Migrate the viewer off raw `GET /api/session` for its primary data path.~~
6. ~~Add a minimal `session-catalog` endpoint with stable filtering, sorting, pagination,
   and `locatorQuery`.~~
7. ~~Keep `/api/resolve-session` as a thin migration adapter over the same
   locator-resolution service so Enter/UUID flows stay stable.~~
8. ~~Add facets once the catalog query shape is stable.~~
9. ~~Build the new split-pane UI on top of those contracts.~~
10. Re-scope the remaining sharp UI work onto the new layout rather than the old
    panel stack, then retire legacy adapters as the new shell takes over.

Items 1–9 are complete. Item 10 is the next focus area.

## Ready To Proceed

Now that the catalog foundation has shipped, these items can proceed:

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
  - Still relevant for the new shell.

## Lower Priority

These are no longer blocked by the catalog foundation but are not urgent:

- `todos/2026-01-22-4pm_virtualize-message-list-plan.txt`
  - Useful if the right pane remains slow with the new split-pane UI.
- `todos/2026-01-23-7pm_watch-sessions-sse-plan.txt`
  - The catalog now provides a clean target for auto-refresh.
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
- Implementation plans: `plans/`
- Original rearchitecture plan:
  `todos/2026-03-07-2pm_session-catalog-rearchitecture-plan.txt`
- Sharp UI tracking: `todos/sharp-ui/README.md`
- Completed history: `todos/_done/INDEX.txt`
- Superseded plans: `todos/_archive/`
