<div align="center">
  <img src="codex-convo-manager.png" alt="Codex Conversation Manager" style="max-width: 500px; width: 100%; height: auto;" />
</div>

# Codex Conversation Manager

A local web app for parsing, visualizing, and searching Codex JSONL sessions. It reads local session logs, groups conversations by user turn, renders messages with markdown, and surfaces tools/actions inline.

## Implementation Guide
For a comprehensive, up-to-date overview of the current architecture and invariants, see `IMPLEMENTATION_GUIDE.md`.

## Features
- Browse Codex sessions stored on disk and keep sessions separate.
- View conversations grouped by user turn with inline tools/actions.
- Full-text search across user and assistant messages via SQLite FTS5.
- Session-level search results with match counts, snippets, and per-session metadata pills.
- Match highlighting in-session with Next/Prev match navigation and `?q=` deep links.
- Markdown rendering with sanitized output and code highlighting.
- Per-message and conversation-wide copy actions with inline feedback.
- Session settings modal (set root, reindex, clear/rebuild index).
- Workspace summary panel for filtering sessions by working directory.
- URL deep links to sessions and turns (`?session=...&turn=...`).

## Getting Started
```bash
npm install
npm run dev
```

## Pre-commit Hooks
We use pre-commit to run Biome and markdownlint before commits.
```bash
brew install pre-commit
pre-commit install
```
Run all hooks manually:
```bash
pre-commit run --all-files
```

## Configuration
- Default sessions root: `~/.codex/sessions` (override with `CODEX_SESSIONS_ROOT`).
- Optional config file: `~/.codex-formatter/config.json`.
- SQLite index: `~/.codex-formatter/codex_index.db`.
- Debug logging: set `CODEX_DEBUG=1`.
- Search debug logging: set `CODEX_SEARCH_DEBUG=1`.
- Render debug logging (dev only): `VITE_RENDER_DEBUG=1`.
- Search UI debug logging (dev only): `VITE_SEARCH_DEBUG=1`.
- Turn navigation debug logging (dev only): `VITE_TURN_NAV_DEBUG=1`.

## Code Tour
- `src/main.tsx` wires up the app and imports the feature entry.
- `src/features/conversation/ConversationViewer.tsx` lays out the page and data hooks.
- `src/features/conversation/ConversationMain.tsx` renders the active session view (header + filters + turns).
- `src/features/conversation/components/` holds the UI building blocks:
  - `Sidebar.tsx` (search + session browser)
  - `SearchPanel.tsx` (FTS search + results)
  - `SessionsPanel.tsx` (session tree + session ID copy)
  - `WorkspacesPanel.tsx` (workspace summaries + filters)
  - `CopyButton.tsx` (shared copy UX + feedback)
  - `SessionHeader.tsx` (session metadata + copy controls)
  - `TurnList.tsx` / `TurnCard.tsx` / `MessageCard.tsx` (conversation rendering)
  - `SettingsModal.tsx` (session root + indexing actions)
  - `Toggle.tsx` (feature toggles)
- `src/features/conversation/hooks/` manages data flow:
  - `useSessions.ts` (config, sessions tree, reindex)
  - `useSession.ts` (load/parse a session)
  - `useSearch.ts` (FTS search + resolve session IDs)
  - `useUrlSync.ts` (deep-link sync)
  - `useWorkspaces.ts` (workspace summaries)
  - `useCopyFeedback.ts` (clipboard feedback state + status)
- `src/features/conversation/parsing.ts` implements JSONL parsing rules and turn grouping.
- `src/features/conversation/markdown.tsx` handles sanitized markdown + snippet highlighting.
- `src/features/conversation/api.ts` wraps API fetches; `copy.ts` formats exports; `url.ts` handles deep links.
- `shared/apiTypes.ts` shares API response types between client + server.
- `server/apiPlugin.ts` is a thin Vite middleware adapter.
- `server/routes/index.ts` maps API routes to handlers.
- `server/http.ts` provides JSON/body helpers.
- `server/config.ts` handles sessions root config + path safety.
- `server/db/index.ts` owns SQLite connection + schema.
- `server/indexing/` contains JSONL parsing + indexing + sessions tree.
- `server/search/` owns FTS normalization + SQL queries.
- `server/workspaces.ts` builds workspace summaries.
- `server/logging.ts` centralizes debug logging.
- `vite.config.ts` wires Vite + API plugin.

## API Endpoints (dev middleware)
- `GET /api/config` / `POST /api/config`
- `GET /api/sessions`
- `GET /api/session?path=...`
- `GET /api/search?q=...&limit=...&resultSort=...&groupSort=...`
- `GET /api/session-matches?session=...&q=...`
- `GET /api/workspaces?sort=...`
- `POST /api/reindex`
- `POST /api/clear-index`
- `GET /api/resolve-session?id=...`

## Search API Notes
- Sorting is server-driven: `resultSort` applies in SQL, `groupSort` applies after grouping.
- Search responses include `requestId` (echoed when supplied) and `Server-Timing` headers for profiling.
- Workspace summaries are computed only for workspaces present in the search results (Option A).
- If Option A becomes slow at scale, the clean third approach is to materialize a workspaces table during indexing and query it directly (requires schema/migration updates and reindex invalidation).

## Development
```bash
npm run dev
npm run build
npm run preview
```

## License
MIT
