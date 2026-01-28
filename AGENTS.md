# AGENTS.md

This file provides guidance for contributors working on this repository.

## Project Overview
Codex Conversation Manager (codex-formatter) is a local web app for parsing, visualizing, and searching Codex JSONL sessions. It reads local session logs, groups conversations by user turn, renders messages with markdown, and surfaces tools/actions inline.

## Implementation Guide
See `IMPLEMENTATION_GUIDE.md` for the canonical, up-to-date architecture and invariants.

## Current Stack
- React 19 + TypeScript (strict)
- Vite 7 (dev server + API middleware)
- Tailwind CSS 4 via `@tailwindcss/vite`
- SQLite (FTS5) via `better-sqlite3`
- `react-markdown` + `remark-gfm` + `rehype-sanitize`
- `react-syntax-highlighter` (Prism)

## Quality Checks
Run these frequently while working on changes:
- `npm run typecheck` (TypeScript checks for frontend + server)
- `npm run check` (Biome lint + formatting validation)
- `npm run mdlint` (run when adding or editing Markdown files)
Note: use `python3` for local scripts (not `python`).

Fix commands when needed:
- `npm run check:write` (autofix lint + formatting)
- `npm run lint:fix` (lint autofix only)
- `npm run format:write` (formatting only)

## Engineering Principles
- Prefer clean, long-term solutions over "low risk" or "fast" changes. Optimize for correctness and maintainability first.

## Repository Layout
- `src/main.tsx` - React entry.
- `src/features/conversation/ConversationViewer.tsx` - page layout + top-level hooks.
- `src/features/conversation/ConversationMain.tsx` - active session view (header + filters + turns).
- `src/features/conversation/components/` - UI building blocks:
  - `Sidebar.tsx` (search + sessions tree)
  - `SearchPanel.tsx` (FTS search + results)
  - `SessionsPanel.tsx` (session tree + session ID copy)
  - `WorkspacesPanel.tsx` (workspace summaries + filters)
  - `CopyButton.tsx` (shared copy UX + success/error feedback)
  - `SessionHeader.tsx` (session details + copy controls)
  - `TurnList.tsx` / `TurnCard.tsx` / `MessageCard.tsx` (turn + message rendering)
  - `SettingsModal.tsx` (sessions root + indexing actions)
  - `Toggle.tsx` (feature toggles)
- `src/features/conversation/hooks/` - state + data flow:
  - `useSessions.ts` (config, sessions tree, reindexing)
  - `useSession.ts` (load/parse a session file)
  - `useSearch.ts` (FTS search + resolve session IDs)
  - `useUrlSync.ts` (URL deep-link sync)
  - `useWorkspaces.ts` (workspace summaries)
  - `useCopyFeedback.ts` (copy status + live-region feedback; used by `CopyButton`)
  - `useRenderDebug.ts` / `useWhyDidYouRender.ts` (dev-only render instrumentation; gated)
- `src/features/conversation/parsing.ts` - JSONL parsing rules + turn grouping.
- `src/features/conversation/api.ts` - client fetch helpers for API endpoints.
- `src/features/conversation/markdown.tsx` - sanitized markdown rendering + snippet highlighting.
- `src/features/conversation/copy.ts` - per-message + conversation export formatting + copy helper.
- `src/features/conversation/format.ts` - formatting helpers (timestamps, truncation).
- `src/features/conversation/debug.ts` - render debug flag (`VITE_RENDER_DEBUG`).
- `src/features/conversation/url.ts` - session/turn query-string helpers.
- `src/index.css` - Tailwind entry, global theme, and animation utilities.
- `server/apiPlugin.ts` - Vite API middleware adapter (delegates to routes).
- `server/routes/index.ts` - HTTP routing for API endpoints.
- `server/http.ts` - JSON helpers + body parsing.
- `server/config.ts` - sessions root config + path safety.
- `server/db/index.ts` - SQLite connection + schema management.
- `server/indexing/` - JSONL parsing + indexing + sessions tree.
- `server/search/` - FTS normalization + query builders.
- `server/workspaces.ts` - workspace summaries + GitHub slug extraction.
- `server/logging.ts` - debug/search logging toggles.
- `vite.config.ts` - Vite config wiring.
- `shared/apiTypes.ts` - shared API response/types for client + server.
- `IMPLEMENTATION_GUIDE.md` - canonical architecture + invariants (replaces legacy plan/appendix docs).

## Architecture at a Glance
- **Frontend**: `ConversationViewer` composes the page (home vs. session). `ConversationMain` renders the active session view.
- **Data flow**:
  - `useSessions` loads config + sessions tree and drives reindexing.
  - `useSession` loads a session file and parses it via `parseJsonl`.
  - `useSearch` queries FTS and resolves session IDs.
  - `useWorkspaces` loads workspace summaries for filtering.
  - `useUrlSync` keeps `?session=...&turn=...` in sync with the browser history.
- **Backend**: Vite dev-server middleware (`server/apiPlugin.ts`) delegates to route handlers in `server/routes/index.ts`, which call config/db/indexing/search/workspace helpers.
- **Storage**: SQLite DB in user home directory; session JSONL files read from disk.

## JSONL Parsing Rules (Critical)
1) **Primary conversation content** comes from `event_msg`:
   - `user_message` → User
   - `agent_message` → Assistant
   - `agent_reasoning` → Thought
   - `token_count` → Token Count
   This avoids duplicates from `response_item.message`.
2) **Tools/actions** come from `response_item`:
   - `function_call`, `custom_tool_call`, `web_search_call` → Tool call
   - `function_call_output`, `custom_tool_call_output` → Tool output
3) **Turn grouping**:
   - Each `user_message` starts a new turn.
   - All subsequent items belong to that turn until the next `user_message`.
   - Items before the first user message go into a "Session Preamble".
4) **Chronological order**:
   - Preserve JSONL line order.
   - Rendering is a filtered view of that order (toggles hide items, never reorder).
5) **Session details**:
   - `session_meta` and `turn_context` are parsed to extract session ID + cwd.
   - Filename-based session ID is canonical; do not overwrite it with ancestor session_meta IDs.
   - Fallback for session ID lives in `extractSessionIdFromPath`.

## Data Model (Implemented)
- `Turn`: `{ id, startedAt?, items[], isPreamble? }`
- `ParsedItem` types: `user`, `assistant`, `thought`, `tool_call`, `tool_output`, `meta`, `token_count`
- `SessionTree`: nested `{ years -> months -> days -> files[] }` for sidebar rendering.

## URL / Deep Linking
- Session + turn are encoded as query params (`?session=...&turn=...`).
- Search deep links include `?q=` for match highlighting + navigation.
- `url.ts` handles normalization + history updates; `useUrlSync` applies it on load/back/forward.

## Indexing & Search (SQLite FTS5)
- Schema + DB wiring live in `server/db/index.ts`.
- Indexing + session parsing live in `server/indexing/`.
- FTS normalization + queries live in `server/search/`.
- Workspace summaries live in `server/workspaces.ts`.
- Tables: `sessions`, `files`, `messages`, `messages_fts` (FTS5).
- Indexing is incremental via file size + mtime checks; it streams JSONL lines.
- Session preview text is the first user message (bounded by a line limit).
- Search results include highlighted snippets (`[[...]]`), rendered in `renderSnippet`.
- Search responses echo `requestId` when provided and include `Server-Timing` headers.

## Server/API Endpoints
- `GET /api/config` → read sessions root + source (`env`, `config`, `default`).
- `POST /api/config` → update sessions root (disabled when env override is set).
- `GET /api/sessions` → tree of available sessions grouped by year/month/day.
- `GET /api/session?path=...` → raw JSONL for a single session.
- `GET /api/search?q=...&limit=...&resultSort=...&groupSort=...&requestId=...` → FTS search results.
- `GET /api/session-matches?session=...&q=...&requestId=...` → matching turn IDs for in-session navigation.
- `GET /api/workspaces?sort=...` → workspace summaries for filtering.
- `POST /api/reindex` → rebuild/refresh index incrementally.
- `POST /api/clear-index` → drop + rebuild index.
- `GET /api/resolve-session?id=...` → resolve a session ID or path fragment.

## Config, Paths, and Storage
- Default sessions root: `~/.codex/sessions`.
- Env override: `CODEX_SESSIONS_ROOT` (UI disables root editing when set).
- Optional config file: `~/.codex-formatter/config.json`.
- SQLite DB: `~/.codex-formatter/codex_index.db`.
- Debug logging: `CODEX_DEBUG=1`.
- Search debug logging: `CODEX_SEARCH_DEBUG=1`.
- Render debug logging (dev only): `VITE_RENDER_DEBUG=1` (see `.env.example`).
- Search UI debug logging (dev only): `VITE_SEARCH_DEBUG=1`.
- Turn navigation debug logging (dev only): `VITE_TURN_NAV_DEBUG=1`.
- **Path safety**: reject `..`, absolute paths, or paths outside root.

## UI Behavior
- Sidebar: search + date-tree session browser.
- Home view: search + workspaces panel + sessions panel.
- Search:
  - Typing performs FTS search after a short debounce.
  - Pasting a UUID auto-resolves (if found) and suppresses debounce.
  - Pressing Enter attempts `/api/resolve-session` for direct session IDs.
- Main viewer:
  - Conversation grouped by turn, with "Session Preamble" for pre-user entries.
  - Toggles: Show Thoughts, Show Tools, Show Metadata, Show Full Content.
  - Session header displays session ID + cwd chips with copy actions.
  - Search matches are highlighted and navigable with Next/Prev when `?q=` is present.
- Settings modal:
  - Manage sessions root and indexing (reindex, clear & rebuild).

## Copy / Export
- Per-message copy:
  - **Copy text** uses a markdown AST → plain text conversion that preserves line breaks.
  - **Copy MD** copies the raw message content.
- Copy actions use `CopyButton`, which centralizes hover/click feedback and success/error handling.
- Conversation-wide copy respects visibility toggles and uses XML-like tags:
  - `<USER-MSG-n>`, `<ASSISTANT-RESPONSE-n>`, `<THINKING-n>`
  - `<TOOL-CALL-n name="..." call_id="...">`, `<TOOL-OUTPUT-n call_id="...">`

## Tailwind v4 Notes
- Tailwind runs via `@tailwindcss/vite` in `vite.config.ts`.
- CSS entry is `src/index.css` with `@import "tailwindcss"`.
- Custom shadows, animations, and chips live in `src/index.css`.
- Fonts are loaded in `index.html`.

## Performance Notes
- Indexing is incremental (mtime/size tracking in SQLite).
- JSONL parsing is line-based; avoid holding huge files in memory where possible.
- Preview extraction is bounded by a max line count.
- UI virtualization can be added later for extremely large sessions.

## Source of Truth
- `IMPLEMENTATION_GUIDE.md` is the canonical architecture/invariants reference.

## Communication Guardrails
- If user-provided content appears redacted or summarized (e.g. `[Pasted Content ...]`), call it out immediately and ask for the full content.

## Agent-Browser (UI Automation)
- Before using, confirm availability: run `agent-browser --help`.
- Use it for quick UI sanity checks while implementing:
  - `agent-browser open http://localhost:5173` and `agent-browser wait --load networkidle`
  - `agent-browser snapshot -i -c` for an interactive map with refs
  - `agent-browser fill @ref "text"` + `agent-browser press Enter` for search
  - `agent-browser select @ref "Option"` for sort/workspace filters
  - `agent-browser click @ref` to open sessions and verify deep links (`?session=...&turn=...&q=...`)
  - `agent-browser get url` to confirm navigation
- Useful extra checks:
  - `agent-browser console` and `agent-browser errors` for runtime issues
  - `agent-browser screenshot --full` for UI snapshots during review
  - `agent-browser set viewport <w> <h>` or `set device` to verify mobile layouts
- Nudge: use agent-browser to validate UI changes as you implement, not just at the end.
- Run the dev server in tmux for parallel log capture:
  - `tmux new -s codex-dev 'VITE_RENDER_DEBUG=1 VITE_TURN_NAV_DEBUG=1 VITE_SEARCH_DEBUG=1 CODEX_DEBUG=1 CODEX_SEARCH_DEBUG=1 npm run dev'`
  - `tmux attach -t codex-dev` to inspect logs while running UI checks.
- Close out cleanly when done:
  - `agent-browser close` to shut the browser session.
  - `tmux kill-session -t codex-dev` to stop the dev server.

## Todos Index Usage
- The canonical completed-plan index lives at `todos/_done/INDEX.txt`.
- New entries must use timestamped filenames (see the index instructions).
- Run `python3 todos/_done/reorder_index.py` after edits to keep newest-first ordering.
