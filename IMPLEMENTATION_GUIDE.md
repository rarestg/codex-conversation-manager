# Codex Conversation Manager — Implementation Guide

This document replaces the early-era `IMPLEMENTATION_PLAN.txt` and `DESIGN_APPENDIX.txt`.
It is a living guide for contributors and maintainers, describing how the current system
works and the invariants that must not change.

If you are new to the codebase, start here, then jump to `AGENTS.md` for task-oriented
notes and file pointers.

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
- `react-markdown` + `remark-gfm` + `rehype-sanitize`
- `react-syntax-highlighter` (Prism)

Backend (Vite dev server middleware):
- Node + better-sqlite3 (FTS5)
- API routing + small utilities, all local and synchronous

---

## 3) Architecture Overview

### Frontend entry and page composition
- `src/main.tsx` boots the app.
- `src/features/conversation/ConversationViewer.tsx` controls layout and data hooks.
- `src/features/conversation/ConversationMain.tsx` renders active session view.
- `src/features/conversation/components/Sidebar.tsx` renders search + session browser.
- `src/features/conversation/StickyTest.tsx` is a dev-only route for validating sticky behavior.

### Backend (Vite API middleware)
- `server/apiPlugin.ts` is a thin adapter (routes all `/api/*`).
- `server/routes/index.ts` maps method + path to handlers.
- `server/http.ts` provides `sendJson` and `readJsonBody`.

### Shared API contract
- `shared/apiTypes.ts` defines shared response types and sort unions.
- Client and server import these types directly.

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
   - `function_call_output`, `custom_tool_call_output` → Tool output

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

---

## 6) API Endpoints (Current Behavior)

### `GET /api/config`
Returns `{ value, source }`, where source is `env | config | default`.

### `POST /api/config`
Updates sessions root when `CODEX_SESSIONS_ROOT` is not set.
Validates absolute path and directory existence.

### `GET /api/sessions`
Returns a year/month/day tree of sessions, built from SQLite.
Accepts optional `workspace` filter.
Includes `Server-Timing` header.

### `GET /api/session?path=...`
Returns raw JSONL text for a session file.
Validates path safety (no traversal).
404 if missing; 403 if unreadable.

### `POST /api/reindex`
Rebuilds index incrementally (mtime/size checks).

### `POST /api/clear-index`
Drops schema and rebuilds index from scratch.

### `GET /api/search`
Query params:
- `q` (required)
- `limit` (default 20)
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

### `GET /api/session-matches`
Query params:
- `session` (required)
- `q` (required)
- `requestId` (echoed back)

Behavior:
- Returns `turn_ids` for matches in a given session.
- Excludes preamble (`turn_id <= 0`).
- `Server-Timing` header included.

### `GET /api/workspaces`
Returns workspace summaries for the sessions table.
Accepts `sort=last_seen|session_count`.

### `GET /api/resolve-session?id=...`
Resolves a session ID/path fragment to a session path.
Returns `{ id }` or 404 if not found.

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
All indexed content:
- `id` (AUTOINCREMENT)
- `session_id` (FK → sessions.id)
- `turn_id`
- `role` (`user | assistant | thought | tool_call | tool_output | meta`)
- `timestamp`
- `content`

Indexes:
- `idx_messages_session`, `idx_messages_turn`

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
   - Build messages list
   - Extract metadata (cwd, git info, timestamps)
   - Count items (turns, thoughts, tools, meta, token_count)
   - Compute `active_duration_ms` per turn from user message → last assistant activity
     (assistant message, agent_reasoning, tool calls, tool outputs)
6) Insert/update sessions and messages in a transaction.
7) Remove DB rows for deleted files.

Important: filename session ID wins; session_meta is fallback only.
Active duration and related metrics are computed by the shared accumulator in
`shared/sessionMetrics.ts` (used by server indexing and client fallback), so
reindex to apply definition changes to existing sessions.

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

## 10) Workspace Summaries (Option A)

The search endpoint collects the set of workspaces present in the results and fetches
only those summaries. This avoids scanning the entire sessions table per search.

Unknown workspace behavior:
- If a session has `cwd` empty or null, it is grouped under `Unknown workspace`.
- The UI displays that group with minimal metadata.

---

## 11) Frontend Behavior and UX Contracts

### Home view
- Search panel + Workspaces panel + Sessions panel.
- Search results are grouped by workspace with match counts and snippets.
- Search sorting controls: results (relevance/matches/recent) and workspaces (last_seen/matches).

### Session view
- Session header with metadata + copy controls.
- Toggles:
  - Show Thoughts
  - Show Tools
  - Show Metadata
  - Show Token Counts
  - Show Full Content
- Sticky controls bar with focus-gated shortcuts (first/last, prev/next, go to turn).
- Turn grouping is preserved; preamble shown separately.
- Match navigation (Prev/Next) for active search query.

### URL sync
Deep links:
- `?session=...&turn=...`
- `?q=...` for search highlighting
- `useUrlSync` and `url.ts` handle normalization and history updates.

### Copy / export
- Per-message copy: plain text (markdown stripped) and raw markdown.
- Conversation export respects toggle visibility.
- XML-like tags for export:
  - `<USER-MSG-n>`, `<ASSISTANT-RESPONSE-n>`, `<THINKING-n>`
  - `<TOOL-CALL-n name="..." call_id="...">`, `<TOOL-OUTPUT-n call_id="...">`

---

## 12) Error Handling

API behavior:
- 400 for invalid/missing params.
- 404 for missing sessions root or session file.
- 403 for unreadable session file.
- 500 for unhandled exceptions.

Parsing behavior:
- Blank lines ignored.
- Malformed JSON lines logged (rate-limited), parsing continues.
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

Formal tests are currently deferred. Manual verification flows include:
- Search with multiple queries; confirm grouping, snippets, and navigation.
- Sorting by relevance/matches/recent; group sort by last_seen/matches.
- Workspace filter applied to search and session list.
- Match navigation excludes preamble and aligns with highlighting.
- Reindex and clear-index flows rebuild data safely.

---

## 16) Contribution Tips

When modifying:
- Keep parsing invariants intact; they are relied upon by UI and search.
- Don’t change snippet markers (`[[...]]`) without updating the renderer.
- Ensure `/api/session-matches` continues to exclude preamble.
- Keep deterministic ordering in search (tie-breaker required).
- Update shared API types in `shared/apiTypes.ts` when changing response shapes.

For detailed file pointers, see `AGENTS.md`.
