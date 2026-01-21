# AGENTS.md

This file provides guidance for contributors working on this repository.

## Project Overview
Codex Conversation Manager (codex-formatter) is a local, developer-focused web app for parsing, visualizing, and searching Codex JSONL sessions. It reads local session logs, groups conversations by user turn, renders messages with markdown, and surfaces tools/actions inline to preserve causal flow.

## Current Stack
- React 19 + TypeScript (strict)
- Vite 7 (dev server + API middleware)
- Tailwind CSS 4 via `@tailwindcss/vite`
- SQLite (FTS5) via `better-sqlite3`
- `react-markdown` + `remark-gfm` + `rehype-sanitize`
- `react-syntax-highlighter` (Prism)

## Repository Layout
- `src/main.tsx` - React entry.
- `src/ConversationViewer.tsx` - main UI, parsing, markdown rendering, copy actions.
- `src/index.css` - Tailwind entry (`@import "tailwindcss"`) and global styles.
- `vite.config.ts` - Vite config + API middleware + SQLite indexing.
- `AGENTS.md` - this file.
- `IMPLEMENTATION_PLAN.txt` / `DESIGN_APPENDIX.txt` - historical plan and schema.

## Architecture at a Glance
- **Frontend**: React + Tailwind, single-page UI with sidebar and main viewer.
- **Backend**: Vite dev-server middleware exposes REST endpoints and handles indexing.
- **Storage**: SQLite DB in user home directory for search; sessions read from disk.

## JSONL Parsing Rules (Critical)
1) **Primary conversation content** comes from `event_msg`:
   - `user_message` → User message
   - `agent_message` → Assistant message
   - `agent_reasoning` → Thought message
   This avoids duplicates from `response_item.message`.

2) **Tools/actions** come from `response_item`:
   - `function_call`, `custom_tool_call`, `web_search_call` → Tool call
   - `function_call_output`, `custom_tool_call_output` → Tool output

3) **Turn grouping**:
   - Each `user_message` starts a new turn.
   - All subsequent items belong to that turn until the next `user_message`.
   - Items before the first user message go into a "Session Preamble" section.

4) **Chronological order**:
   - Preserve line order from the JSONL file.
   - Rendering is a filtered view of that order (toggles hide items, never reorder).

## Data Model (Recommended)
- `Turn` contains `items: ParsedItem[]` to preserve sequence.
- `ParsedItem` types: `user`, `assistant`, `thought`, `tool_call`, `tool_output`, `meta`, `token_count`.
- Avoid rigid buckets; keep a linear stream.

## Server/API Endpoints
- `GET /api/sessions` → tree of available sessions grouped by year/month/day.
- `GET /api/session?path=...` → raw JSONL for a single session.
- `GET /api/search?q=...&limit=...` → SQLite FTS search results.
- `POST /api/reindex` → rebuild/refresh index.
- `GET /api/config` → read sessions root.
- `POST /api/config` → update sessions root.

## Config, Paths, and Storage
- Default sessions root: `~/.codex/sessions`.
- Env override: `CODEX_SESSIONS_ROOT` (UI disables root editing when set).
- Optional config file: `~/.codex-formatter/config.json`.
- SQLite DB: `~/.codex-formatter/codex_index.db`.
- **Path safety**: reject `..` or paths outside root.

## UI Behavior
- Sidebar: search + date-tree session browser.
- Main viewer: conversation grouped by turn, tools inline.
- Toggles (defaults: thoughts/tools ON): Show Thoughts, Show Tools, Show Metadata, Show Full Content.
- Markdown rendering: `react-markdown` + `remark-gfm` + `rehype-sanitize`.
- Code blocks: Prism highlighting with `react-syntax-highlighter`.
- **Whitespace**: markdown text blocks render with `white-space: pre-wrap` to preserve newlines generically.

## Copy / Export
- Per-message copy:
  - **Copy text** uses a markdown AST → plain text conversion that preserves line breaks.
  - **Copy MD** copies the raw message content.
- Conversation-wide copy respects visibility toggles and uses XML-like tags:
  - `<USER-MSG-n>`, `<ASSISTANT-RESPONSE-n>`, `<THINKING-n>`
  - `<TOOL-CALL-n name="..." call_id="...">`, `<TOOL-OUTPUT-n call_id="...">`

## Tailwind v4 Notes
- Tailwind runs via the Vite plugin: `@tailwindcss/vite` in `vite.config.ts`.
- CSS entry is `src/index.css` with `@import "tailwindcss"`.
- There is no `postcss.config.js` in the current setup.
- Custom shadows and global styles live in `src/index.css`.
- Fonts are loaded in `index.html`.

## Performance Notes
- Indexing is incremental (mtime/size tracking in SQLite).
- JSONL parsing is line-based; avoid holding huge files in memory where possible.
- UI virtualization can be added later for extremely large sessions.

## Development Commands
```
npm run dev
npm run build
npm run preview
```

## Source of Truth
- `IMPLEMENTATION_PLAN.txt` and `DESIGN_APPENDIX.txt` describe the original spec and schema.
