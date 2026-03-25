# Codex Conversation Manager — Implementation Guide

This document replaces the early-era `IMPLEMENTATION_PLAN.txt` and `DESIGN_APPENDIX.txt`.
It is the canonical current-state behavior and invariants guide for contributors and
maintainers: it describes what ships today and what must not break.

Product direction, remaining sequencing, and deferred work live in:
- `ROADMAP.md`
- `plans/` for implementation plans (completed phases in `plans/_archived/`)

If you are new to the codebase:
- Start with `README.md` for setup and quick orientation.
- Use this guide for current shipped behavior and invariants.
- Use `AGENTS.md` for the repo map and task-oriented pointers.
- Use `USER_GUIDE.md` for user workflows and QA expectations.
- Use `VISUAL_STYLE_GUIDE.txt` for frontend/design direction.

---

## 1) System Goals and Scope

Codex Conversation Manager is a local web app that parses Codex JSONL session logs,
groups messages by turn, renders markdown, and provides fast full-text search.

Core goals:
- Browse sessions stored on disk with no manual copy/paste.
- Preserve exact message order and turn grouping.
- Show tools and thoughts inline with optional toggles.
- Provide fast search across sessions with match navigation.
- Offer reliable copy/export behavior for individual messages and entire sessions.

Non-goals:
- Production server or hosted service.
- Desktop packaging (Tauri/Electron).
- Cross-machine sync.

---

## 2) Current Stack

Frontend:
- React 19 + TypeScript (strict)
- Vite 7
- Tailwind CSS 4 via `@tailwindcss/vite`
- `@base-ui/react` for headless menus, popovers, selects, and checkboxes
- `@tanstack/react-table` for the session catalog row model
- `react-resizable-panels` for the split-pane layout
- `react-markdown` + `remark-gfm` + `rehype-raw` + `rehype-sanitize`
- `react-syntax-highlighter` (Prism)

Backend (Vite dev server middleware):
- Node + better-sqlite3 (FTS5)
- API routing + small utilities, all local and synchronous

---

## 3) Current Shipped Architecture Overview

### Frontend entry and page composition
- `src/main.tsx` boots the app inside a `.root` wrapper (required for Base UI portals).
- `src/features/conversation/ConversationViewer.tsx` renders a persistent resizable split-pane
  layout via `react-resizable-panels`: session catalog on the left, conversation detail on the
  right. It also routes to `/canvas`, `/layouts`, and `/stickytest` without a router.
- `src/features/conversation/components/SessionCatalogPane.tsx` renders the left-pane catalog
  powered by `@tanstack/react-table`, with Base UI facet filter popovers and select controls.
- `src/features/conversation/ConversationMain.tsx` renders the active session view in the right
  pane.
- `src/features/conversation/CanvasView.tsx` renders the dev/demo variant surface.
- `src/features/conversation/StickyTest.tsx` is a dev-only route for validating sticky behavior.

### Backend (Vite API middleware)
- `server/apiPlugin.ts` is a thin adapter (routes all `/api/*`).
- `server/routes/index.ts` maps method + path to handlers, including the canonical
  `session-detail`, `session-catalog`, and `session-catalog-facets` endpoints.
- `server/http.ts` provides `sendJson` and `readJsonBody`.

### Shared contracts and metrics
- `shared/sessionDetailTypes.ts` defines the canonical session-detail DTO
  (`SessionDetailResponse`, `SessionDetailTurn`, `SessionDetailItem`, etc.).
- `shared/sessionCatalogTypes.ts` defines the catalog row, query, facet, and pagination
  contracts (`SessionCatalogRow`, `SessionCatalogQuery`, `SessionCatalogFacetsResponse`, etc.).
- `shared/apiTypes.ts` defines legacy/widget-shaped endpoint types for the old search panel and
  workspace panel. New contracts should not be added here.
- `shared/sessionMetrics.ts` keeps session metrics and active-duration calculation aligned
  between server indexing and client-side fallback parsing.

---

## 4) JSONL Parsing and Turn Grouping (Critical Invariants)

The canonical parser implementation lives in `server/sessionDetail/parser.ts`. The frontend
receives pre-parsed turns from `GET /api/session-detail` and no longer parses JSONL itself
for its primary data path.

### Source of truth for content
1) **Primary conversational content** comes from `event_msg`:
   - `user_message` → User
   - `agent_message` → Assistant
   - `agent_reasoning` → Thought
   - `token_count` → Token Count (tracked separately)
   This avoids duplicates from `response_item.message`.

2) **Tools/actions** come from `response_item`:
   - `function_call`, `custom_tool_call`, `web_search_call` → Tool call
   - `function_call_output`, `custom_tool_call_output`, `web_search_call_output` → Tool output

### Turn grouping
- A new turn starts at each `user_message`.
- Everything after that belongs to the same turn until the next `user_message`.
- Items before the first user message are in a **Session Preamble** group.
- **Ordering is preserved**: render in file line order; toggles only hide, never reorder.

### Session ID canonicalization
- The filename-based session ID is authoritative.
- `session_meta` / `turn_context` IDs are **fallback only** when the filename lacks an ID.
- Mismatches are logged but do not override filename-derived IDs.

### Preamble exclusion in search
- `/api/session-matches` must **exclude preamble** (`turn_id <= 0`) to keep match
  navigation aligned with search results.

---

## 5) Backend Modules (Current Layout)

### Routing and HTTP
- `server/apiPlugin.ts`: Vite middleware adapter (thin).
- `server/routes/index.ts`: actual route handlers.
- `server/http.ts`: `sendJson`, `readJsonBody`.

### Config and paths
- `server/config.ts`: sessions root resolution + path safety.
  - Default root: `~/.codex/sessions`
  - Env override: `CODEX_SESSIONS_ROOT` (disables UI edits)
  - Config file: `~/.codex-formatter/config.json`
  - Path safety: reject `..`, absolute paths, outside-root.

### DB and schema
- `server/db/index.ts`: SQLite init, schema, migrations.
- DB path: `~/.codex-formatter/codex_index.db`
- Schema is managed here; do not duplicate SQL elsewhere.

### Session detail (canonical parser and service)
- `server/sessionDetail/parser.ts`: canonical JSONL parser shared by indexing and on-demand
  session detail. Exports `parseSessionRaw()` and `readSessionMetadataFromFile()`.
- `server/sessionDetail/service.ts`: builds `SessionDetailResponse` from parsed data.

### Session catalog
- `server/catalog/queries.ts`: catalog query builder with exact-value facet filtering,
  content-search integration, locator queries, sorting, and pagination.
- `server/catalog/facets.ts`: self-excluding facet count queries for workspace, repo, and
  branch.
- `server/catalog/locator.ts`: shared session-resolution logic used by both the catalog
  `locatorQuery` and `GET /api/resolve-session`.

### Indexing and session tree
- `server/indexing/index.ts`: incremental indexing, delegates JSONL parsing to the canonical
  parser in `server/sessionDetail/parser.ts`.
- `server/indexing/tree.ts`: session tree and preview truncation.

### Search
- `server/search/normalize.ts`: FTS query normalization
- `server/search/queries.ts`: search SQL + grouping

### Workspace summaries (legacy)
- `server/workspaces.ts`: workspace summary queries and GitHub slug extraction.
  Superseded by catalog facets for the new shell but still used by legacy search endpoints.

### Logging
- `server/logging.ts`: debug flags and log helpers
  - `CODEX_DEBUG=1` for general debug
  - `CODEX_SEARCH_DEBUG=1` for search logs

### Shared cross-layer logic
- `shared/sessionMetrics.ts`: canonical session metrics + active duration logic
- `shared/sessionDetailTypes.ts` and `shared/sessionCatalogTypes.ts`: domain DTOs
- `server/types.ts` and `src/features/conversation/types.ts`: tree/session/viewer data shapes

---

## 6) API Endpoints

### Canonical Endpoints

#### `GET /api/session-detail?id=...`
Query params:
- `id` (required) — `sessions.id` (relative session path)

Behavior:
- Reads the raw JSONL file from disk and parses it with the canonical server-owned parser.
- Returns `SessionDetailResponse`: `session` (summary metadata), `turns` (normalized turn
  array), and `parseErrors` (non-fatal).
- Validates path safety (no traversal outside sessions root).
- 400 if `id` is missing; 404 if the session file does not exist.
- This is the primary session-loading contract used by the frontend.

#### `GET /api/session-catalog?...`
Query params:
- `contentQuery` (optional) — FTS content search
- `locatorQuery` (optional) — direct session ID/path resolution
- `workspaces` (optional, repeated) — exact workspace filter
- `gitRepos` (optional, repeated) — exact repo filter
- `gitBranches` (optional, repeated) — exact branch filter
- `workspace` (optional) — legacy single-value shortcut, mapped into `workspaces[]`
- `sort` (optional) — `recent` | `oldest` | `turns_desc` | `messages_desc` | `duration_desc`
- `page` (optional, default 1)
- `pageSize` (optional, default 50, clamped to 1-200)

Behavior:
- One row per session file.
- Deterministic ordering with `sessions.id ASC` tie-breaker.
- Stable pagination. Out-of-range pages are clamped.
- Optional content-search integration using existing FTS tables; when active, rows include
  `matchCount`, `firstMatchTurnId`, and `snippet` with `[[...]]` markers.
- Optional locator-resolution using the shared locator helper.
- Exact facet filters combine with AND across facets, OR within a facet.
- Returns `rows`, `totalRows`, `page`, `pageSize`, `totalPages`, `appliedQuery`,
  and optional `contentTokens`.

#### `GET /api/session-catalog-facets?...`
Accepts the same filtering context as the catalog query. For each facet dimension, counts are
self-excluding on that dimension (e.g., workspace counts are not filtered by selected
workspaces). Returns `SessionCatalogFacetsResponse` with `workspaces`, `gitRepos`, and
`gitBranches` arrays, each containing `{ value, label, count }` buckets.

### Supporting Endpoints

#### `GET /api/config`
Returns `{ value, source }`, where source is `env | config | default`.

### `POST /api/config`
Updates sessions root when `CODEX_SESSIONS_ROOT` is not set.
Validates absolute path and directory existence.

### `GET /api/sessions`
Returns a year/month/day tree of sessions, built from SQLite.
Accepts optional `workspace` filter.
Includes `Server-Timing` header.
This is a current home-shell projection, not the target catalog contract.

### `GET /api/session?path=...`
Returns raw JSONL text for a session file.
Validates path safety (no traversal).
404 if missing; 403 if unreadable.
This is the debug/export/raw-access path. The canonical UI contract is
`GET /api/session-detail`.

### `POST /api/reindex`
Rebuilds index incrementally (mtime/size checks).

### `POST /api/clear-index`
Drops schema and rebuilds index from scratch.

### `GET /api/search`
Query params:
- `q` (required)
- `limit` (default 20, clamped to 1-200)
- `workspace` (optional)
- `resultSort` (`relevance` | `matches` | `recent`)
- `groupSort` (`last_seen` | `matches`)
- `requestId` (echoed back)

Behavior:
- One result row per **session file**.
- Uses `session_path` (sessions.id/path) for navigation.
- Snippets include `[[...]]` markers.
- Workspace filter applied **inside the matches CTE**.
- Workspace summaries computed for **result workspaces only** (Option A).
- Deterministic ordering via `sessions.id ASC` tie-breaker.
- `Server-Timing` header included.
This grouped response is a legacy adapter for the old search panel. The session catalog
endpoint is the current primary browsing/search contract.

### `GET /api/session-matches`
Query params:
- `session` (required)
- `q` (required)
- `requestId` (echoed back)

Behavior:
- Returns `turn_ids` and normalized search `tokens` for matches in a given session.
- Excludes preamble (`turn_id <= 0`).
- `Server-Timing` header included.

### `GET /api/workspaces`
Returns workspace summaries for the sessions table.
Accepts `sort=last_seen|session_count`.
Only sessions with non-empty `cwd` contribute workspace rows.
This is a legacy panel feed. Catalog facets (`GET /api/session-catalog-facets`) are the
current primary source of workspace/repo/branch filtering data.

### `GET /api/resolve-session?id=...`
Query params:
- `id` (required)
- `workspace` (optional)
- `requestId` (optional, debug/logging only)

Behavior:
- Resolves exact `session_id`, then exact `path`, then `path LIKE`.
- Applies optional workspace filtering before choosing a match.
- Returns `{ id }` or 404 if not found.
- Implemented as a thin adapter over the shared locator-resolution logic in
  `server/catalog/locator.ts`, the same service used by the catalog `locatorQuery`.

---

## 7) SQLite Schema (Current)

The schema is defined in `server/db/index.ts`. Key tables:

### sessions
Columns:
- `id` (TEXT, PK) — session path (relative to root)
- `path` (TEXT, unique)
- `session_id` (TEXT) — filename-derived ID (canonical)
- `session_id_checked` (INTEGER)
- `timestamp` (TEXT)
- `cwd` (TEXT)
- `git_branch` (TEXT)
- `git_repo` (TEXT)
- `git_commit_hash` (TEXT)
- `first_user_message` (TEXT)
- `started_at` (TEXT)
- `ended_at` (TEXT)
- `turn_count` (INTEGER)
- `message_count` (INTEGER)
- `thought_count` (INTEGER)
- `tool_call_count` (INTEGER)
- `meta_count` (INTEGER)
- `token_count_count` (INTEGER)
- `active_duration_ms` (INTEGER)

Indexes:
- `idx_sessions_timestamp`, `idx_sessions_cwd`, `idx_sessions_session_id`

### files
Tracks file state for incremental indexing:
- `path`, `size`, `mtime`, `hash`, `indexed_at`

### messages
Searchable indexed content only:
- `id` (AUTOINCREMENT)
- `session_id` (FK → sessions.id)
- `turn_id`
- `role` (`user | assistant | thought | tool_call | tool_output`)
- `timestamp`
- `content`

Indexes:
- `idx_messages_session`, `idx_messages_turn`

Notes:
- `session_meta`, `turn_context`, and `token_count` contribute session metrics / client rendering,
  but are not written into `messages` or `messages_fts` today.

### messages_fts (FTS5)
Virtual table synchronized by triggers:
- `content`
- `session_id` (UNINDEXED)
- `turn_id` (UNINDEXED)
- `role` (UNINDEXED)
- `tokenize = 'porter'`

---

## 8) Indexing Pipeline

Entry: `indexSessions(root)` in `server/indexing/index.ts`.

Workflow:
1) Scan `.jsonl` files under root (recursive).
2) Compare `size` + `mtime` vs `files` table.
3) If unchanged and `session_id_checked` already done, skip.
4) If unchanged but `session_id_checked` missing, read just session_meta/turn_context.
5) If changed or new, parse entire JSONL via `parseSessionRaw()` from
   `server/sessionDetail/parser.ts`:
   - Build searchable messages list (`user`, `assistant`, `thought`, `tool_call`, `tool_output`)
   - Extract metadata (cwd, git info, timestamps, session-id fallbacks)
   - Count items (turns, thoughts, tools, meta, token_count)
   - Keep `session_meta`, `turn_context`, and `token_count` in metrics/state, but not in FTS rows
   - Compute `active_duration_ms` per turn from user message → last assistant activity
     (assistant message, agent_reasoning, tool calls, tool outputs, including web search output)
6) Insert/update sessions and messages in a transaction.
7) Remove DB rows for deleted files.

Important: filename session ID wins; session_meta is fallback only.
Active duration and related metrics are computed by the shared accumulator in
`shared/sessionMetrics.ts` (used by server indexing and client fallback), so
reindex to apply definition changes to existing sessions.

### Shared metrics contracts (`shared/sessionMetrics.ts`)
- `message_count` includes `user`, `assistant`, `thought`, `tool_call`, and `tool_output`
- `tool_call_count` counts tool-call entries only; outputs are separate message rows
- `meta_count` and `token_count_count` are tracked separately from searchable message rows
- `active_duration_ms` only accumulates for turns that have both a user-start timestamp and later assistant activity
- `first_user_message` is preview-truncated before storage/tree rendering

---

## 9) Search Behavior and Invariants

### FTS normalization (`server/search/normalize.ts`)
- Tokenizes Unicode (`\p{L}\p{N}\p{M}`).
- Token cap: 32 tokens.
- Minimum token length:
  - Latin script: >= 3
  - Numeric: >= 2
  - Non-Latin: >= 1
- Produces `"token"` AND `"token"` query.
- If no searchable tokens remain after normalization, the server returns no results and no tokens.

### Search surface
- SQLite search currently indexes `user`, `assistant`, `thought`, `tool_call`, and `tool_output`.
- `session_meta`, `turn_context`, and `token_count` are rendered in the client but are not searchable via FTS.
- The client mirrors the same token rules to drive the "too short to search" state before sending requests.

### Search result invariants
- One row per session file.
- `session_path` used for navigation.
- Snippets return `[[...]]` markers for highlighting.
- Preamble excluded (turn_id <= 0) for both search and match navigation.

### Sorting
Server-driven:
- `resultSort` controls SQL ORDER BY.
- Relevance uses FTS5 bm25; lower scores are more relevant (ordered ASC).
- `groupSort` applied after grouping results in JS.
- Deterministic tie-breaker: `sessions.id ASC`.

---

## 10) Workspace Summaries (Legacy) and Catalog Facets

The legacy search endpoint still collects workspace summaries for its grouped response using
the Option A strategy (result-only summaries).

The current primary filtering surface is `GET /api/session-catalog-facets`, which returns
self-excluding facet counts for workspace, repo, and branch. Unknown/empty values are
represented using a shared sentinel value (`SESSION_CATALOG_UNKNOWN_VALUE`) that round-trips
through both facet responses and filter queries.

---

## 11) Frontend Behavior and UX Contracts

### Split-pane shell
- The root route renders a persistent resizable split layout via `react-resizable-panels`.
- Left pane: `SessionCatalogPane` backed by `GET /api/session-catalog` and
  `GET /api/session-catalog-facets`.
- Right pane: `ConversationMain` backed by `GET /api/session-detail`.
- The catalog pane stays visible while a session is loaded.
- When no session is active, the right pane shows an empty state.

### Catalog controls
- Content search input debounces FTS search (350ms) once the query has at least one
  searchable token.
- Locator input for direct session ID/path resolution; Enter triggers resolution.
- Base UI `Select` controls for sort order and page size.
- Base UI `Popover` + `Checkbox` facet filter menus for workspace, repo, and branch.
- Active filters are visible as removable chips in the catalog header.
- Facet counts are server-driven and self-excluding on their own dimension.
- Pagination controls at the bottom of the catalog pane.

### Session view
- Session view is composed around `SessionOverview`, the sticky controls bar, `TurnList`, and `TurnJumpModal`.
- Session header shows metadata + copy controls.
- Toggles:
  - Show Thoughts
  - Show Tools
  - Show Metadata
  - Show Token Counts
  - Show Full Content
- When token counts are shown, the UI compresses them to usage-bearing `token_count` items that follow content.
- Sticky controls bar has focus-gated shortcuts:
  - ArrowLeft / ArrowRight → previous / next turn
  - Cmd/Ctrl + ArrowUp / ArrowDown → first / last turn
  - Cmd/Ctrl + K → turn jump modal
  - Cmd/Ctrl + Shift + H → Home
- Turn grouping is preserved; preamble shown separately.
- Match navigation (Prev/Next) for active search query.

### Dev-only routes
- `/canvas` and `/layouts` render the variant/demo surface.
- `/stickytest` is a focused sticky-behavior sandbox.

### URL sync
Deep links:
- `?session=...&turn=...`
- `?q=...` for search highlighting
- `useUrlSync` handles initial load and back/forward navigation.
- `url.ts` handles normalization and history updates; turn tracking uses `replaceState` while scrolling.

### Copy / export
- Per-message copy: plain text (markdown stripped) and raw markdown.
- Conversation export respects toggle visibility.
- XML-like tags for export:
  - `<USER-MSG-n>`, `<ASSISTANT-RESPONSE-n>`, `<THINKING-n>`
  - `<TOOL-CALL-n name="..." call_id="...">`, `<TOOL-OUTPUT-n call_id="...">`
  - `<TOKEN-COUNT-n>`, `<META-n>`

---

## 12) Error Handling

API behavior:
- 400 for invalid/missing params.
- 404 for missing sessions root or session file.
- 403 for unreadable session file.
- 500 for unhandled exceptions.

Server indexing behavior:
- Blank lines ignored.
- Malformed JSON lines logged (rate-limited), parsing continues.

Session-detail error handling:
- Parse errors are generated by the server parser and returned in the `parseErrors` field of
  `GET /api/session-detail`.
- Malformed JSON lines are collected as per-line errors; parsing continues.
- The frontend surfaces non-blocking parse error banners from the server response.

---

## 13) Debug Flags

Server:
- `CODEX_DEBUG=1` general debug logs
- `CODEX_SEARCH_DEBUG=1` verbose search logs

Client (dev only):
- `VITE_RENDER_DEBUG=1`
- `VITE_SEARCH_DEBUG=1`
- `VITE_TURN_NAV_DEBUG=1`

---

## 14) Performance Notes

- Indexing is incremental based on size + mtime.
- Search uses FTS5 with early workspace filtering in the matches CTE.
- Workspace summaries are computed only for result workspaces (Option A).
- Session tree queries are SQLite-only (no filesystem scan on read).

---

## 15) Testing / Validation

Automated checks:
- `npm run typecheck`
- `npm run check`
- `npm run mdlint`

CI runs the same three commands above. Formal tests are currently deferred.

Manual verification flows include:
- Open a session from the catalog pane; confirm turn grouping, preamble, and metadata render.
- Use content search in the catalog; confirm match counts, snippets, and highlighting in the
  detail pane.
- Direct session resolution via the locator input (Enter) and UUID paste.
- Facet filtering: select workspace/repo/branch filters and confirm rows narrow; remove filters
  and confirm rows repopulate.
- Sort and page-size controls change catalog ordering and row count.
- Match navigation excludes preamble and aligns with highlighting.
- Turn shortcuts only activate when the messages pane is focused.
- Reindex and clear-index flows rebuild data safely.
- Deep-link loading: `?session=...&turn=...&q=...` loads the correct session and state.
- `/canvas`, `/layouts`, and `/stickytest` remain usable when touching layout/sticky behavior.

Parity checks (server parser vs. legacy client parser):
- Compare server `session-detail` output against legacy client-side parsing for representative
  sessions, including parse errors, preamble handling, and turn grouping.
- Compare `/api/resolve-session` against catalog `locatorQuery` behavior so Enter and UUID
  flows stay equivalent.

---

## 16) Contribution Tips

When modifying:
- Keep parsing invariants intact; they are relied upon by UI and search.
- Don’t change snippet markers (`[[...]]`) without updating the renderer.
- Keep `/api/search` and `/api/session-matches` aligned on preamble exclusion.
- Keep deterministic ordering in search (tie-breaker required).
- Update `shared/apiTypes.ts` only for legacy/widget-shaped endpoints.
- Domain contracts live in `shared/sessionCatalogTypes.ts` and
  `shared/sessionDetailTypes.ts`; add new domain types there, not in `apiTypes.ts`.
- Update `shared/sessionMetrics.ts` when changing metric or active-duration definitions.
- Update `README.md` / `AGENTS.md` when canonical doc locations or validation commands change.

For detailed file pointers, see `AGENTS.md`.
