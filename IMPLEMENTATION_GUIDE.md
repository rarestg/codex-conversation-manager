# Codex Conversation Manager — Implementation Guide

This document replaces the early-era `IMPLEMENTATION_PLAN.txt` and `DESIGN_APPENDIX.txt`.
It is the canonical current-state behavior and invariants guide for contributors and
maintainers: it describes what ships today and what must not break while the architecture
changes.

Target-state architecture and migration sequencing now live in:
- `ROADMAP.md` (`## Primary Initiative`)
- `todos/2026-03-07-2pm_session-catalog-rearchitecture-plan.txt`

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
- `react-markdown` + `remark-gfm` + `rehype-raw` + `rehype-sanitize`
- `react-syntax-highlighter` (Prism)

Backend (Vite dev server middleware):
- Node + better-sqlite3 (FTS5)
- API routing + small utilities, all local and synchronous

---

## 3) Current Shipped Architecture Overview

### Frontend entry and page composition
- `src/main.tsx` boots the app.
- `src/features/conversation/ConversationViewer.tsx` controls layout/data hooks and switches
  between `/`, `/canvas`, `/layouts`, and `/stickytest` without a router.
- `src/features/conversation/ConversationMain.tsx` renders active session view.
- `src/features/conversation/CanvasView.tsx` renders the dev/demo variant surface.
- `src/features/conversation/components/Sidebar.tsx` renders search + session browser.
- `src/features/conversation/StickyTest.tsx` is a dev-only route for validating sticky behavior.

### Backend (Vite API middleware)
- `server/apiPlugin.ts` is a thin adapter (routes all `/api/*`).
- `server/routes/index.ts` maps method + path to handlers.
- `server/http.ts` provides `sendJson` and `readJsonBody`.

### Shared contracts and metrics
- `shared/apiTypes.ts` defines legacy/widget-shaped endpoint types and sort unions used by the
  current home shell during migration.
- New domain contracts belong in `shared/sessionCatalogTypes.ts` and
  `shared/sessionDetailTypes.ts`.
- `shared/sessionMetrics.ts` keeps session metrics and active-duration calculation aligned
  between server indexing and client-side fallback parsing.

---

## 4) JSONL Parsing and Turn Grouping (Critical Invariants)

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

### Indexing and session tree
- `server/indexing/index.ts`: JSONL parsing + indexing
- `server/indexing/tree.ts`: session tree and preview truncation

### Search
- `server/search/normalize.ts`: FTS query normalization
- `server/search/queries.ts`: search SQL + grouping

### Workspace summaries
- `server/workspaces.ts`: workspace summary queries and GitHub slug extraction

### Logging
- `server/logging.ts`: debug flags and log helpers
  - `CODEX_DEBUG=1` for general debug
  - `CODEX_SEARCH_DEBUG=1` for search logs

### Shared cross-layer logic
- `shared/sessionMetrics.ts`: canonical session metrics + active duration logic
- `server/types.ts` and `src/features/conversation/types.ts`: tree/session/viewer data shapes

---

## 6) Current Legacy Adapters And Supporting Endpoints

### `GET /api/config`
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
This remains the current debug/export/raw-access path while `GET /api/session-detail`
becomes the canonical UI contract.

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
This grouped response is a legacy adapter for the current search panel, not the target
catalog/search contract.

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
This is a current panel feed and should collapse into catalog facets during migration.

### `GET /api/resolve-session?id=...`
Query params:
- `id` (required)
- `workspace` (optional)
- `requestId` (optional, debug/logging only)

Behavior:
- Resolves exact `session_id`, then exact `path`, then `path LIKE`.
- Applies optional workspace filtering before choosing a match.
- Returns `{ id }` or 404 if not found.
- During the catalog migration, this should remain a thin adapter over the same
  locator-resolution service used by `locatorQuery`, so Enter/UUID flows keep working
  without duplicating lookup logic.

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
5) If changed or new, parse entire JSONL:
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

## 10) Workspace Summaries (Current Legacy Adapter, Option A)

The search endpoint collects the set of workspaces present in the results and fetches
only those summaries. This avoids scanning the entire sessions table per search.

Unknown workspace behavior:
- If a session has `cwd` empty or null, it is grouped under `Unknown workspace`.
- The UI displays that group with minimal metadata.

---

## 11) Frontend Behavior and UX Contracts (Current Home Shell)

### Home view
- Search panel + Workspaces panel + Sessions panel.
- Search results are grouped by workspace with match counts and snippets.
- Typing debounces FTS search (350ms) once the query has at least one searchable token.
- Queries that normalize to no searchable tokens stay client-side in the "too short to search" state.
- Enter attempts direct session resolution first.
- Pasting an exact UUID attempts immediate session resolution before falling back to FTS.
- Search sorting controls: results (relevance/matches/recent) and workspaces (last_seen/matches).
- Opening a session clears any active workspace filter.

This section documents the current shipped home shell. The target replacement is the
session-catalog split-pane architecture described in `ROADMAP.md` and
`todos/2026-03-07-2pm_session-catalog-rearchitecture-plan.txt`.

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

Client parsing behavior:
- Blank lines ignored.
- Malformed JSON lines are collected as per-line parse errors and parsing continues.
- UI surfaces non-blocking parse error banners when applicable.

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
- Search with multiple queries; confirm grouping, snippets, and navigation.
- Direct session resolution via Enter and UUID paste.
- Sorting by relevance/matches/recent; group sort by last_seen/matches.
- Workspace filter applied to search and session list, then cleared when opening a session.
- Match navigation excludes preamble and aligns with highlighting.
- Turn shortcuts only activate when the messages pane is focused.
- Reindex and clear-index flows rebuild data safely.
- `/canvas`, `/layouts`, and `/stickytest` remain usable when touching layout/sticky behavior.

Migration parity checks to add once session-detail and session-catalog land:
- Compare current raw-file parsing against server `session-detail` output for representative
  sessions, including parse errors, preamble handling, and turn grouping.
- Compare `/api/resolve-session` against locator-service / `locatorQuery` behavior so Enter
  and UUID flows stay equivalent during migration.

---

## 16) Contribution Tips

When modifying:
- Keep parsing invariants intact; they are relied upon by UI and search.
- Don’t change snippet markers (`[[...]]`) without updating the renderer.
- Keep `/api/search` and `/api/session-matches` aligned on preamble exclusion.
- Keep deterministic ordering in search (tie-breaker required).
- Update `shared/apiTypes.ts` only for current legacy/widget-shaped endpoints.
- Put new domain contracts in `shared/sessionCatalogTypes.ts` and
  `shared/sessionDetailTypes.ts`.
- Update `shared/sessionMetrics.ts` when changing metric or active-duration definitions.
- Update `README.md` / `AGENTS.md` when canonical doc locations or validation commands change.

For detailed file pointers, see `AGENTS.md`.
