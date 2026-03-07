# AGENTS.md

Use this file as the repo map. Keep deep implementation detail in the canonical docs rather than expanding this file into a second manual.

## What This Repo Is

Codex Conversation Manager is a local web app for browsing, searching, and inspecting Codex JSONL sessions. The frontend is React 19 + TypeScript on Vite, the backend is local Vite middleware, and indexing/search use SQLite FTS5.

## Start Here By Task

- Setup, running, and quick orientation: `README.md`
- Roadmap, sequencing, and current product direction: `ROADMAP.md`
- Architecture, invariants, parsing/indexing/search behavior, and API contracts: `IMPLEMENTATION_GUIDE.md`
- User-facing workflows and QA expectations: `USER_GUIDE.md`
- Frontend/design work: `VISUAL_STYLE_GUIDE.txt`
- Sharp UI implementation tracking: `todos/sharp-ui/README.md`
- Command inventory: `package.json`
- CI truth: `.github/workflows/ci.yml`
- Active plans: `todos/`
- Completed-plan history: `todos/_done/INDEX.txt`
- Investigations and lessons learned: `todos/_learnings/`
- Superseded plans: `todos/_archive/`
- Small follow-ups: `todos/nits/`

## Repo Map

- `ROADMAP.md`: product direction, immediate next steps, and plan sequencing
- `src/main.tsx`: app entry
- `src/features/conversation/`: primary frontend feature area
- `src/features/conversation/ConversationViewer.tsx`: top-level shell, home/session split, and manual path switching instead of a router
- `src/features/conversation/ConversationMain.tsx`: active session view
- `src/features/conversation/components/`: search, sidebar, session header/overview, turn/message rendering, settings, and turn-jump UI
- `src/features/conversation/hooks/`: session loading, search, sessions tree, workspaces, URL sync, turn navigation, and render-debug hooks
- `src/features/conversation/canvas/` plus `CanvasView.tsx`: dev/demo variants at `/canvas` and `/layouts`
- `src/features/conversation/StickyTest.tsx`: dev-only sticky sandbox at `/stickytest`
- `server/`: API adapter/routes, config/path safety, DB/schema, indexing, search, workspace summaries, logging
- `shared/`: API types and shared session-metrics logic used by client and server
- Exact data shapes live in `src/features/conversation/types.ts`, `shared/apiTypes.ts`, and `shared/sessionMetrics.ts`
- `scripts/typecheck.js`: runs both TypeScript projects
- `todos/sharp-ui/`: implementation-slice docs for the sharp UI migration, with current status notes

## Non-Negotiable Invariants

- Primary conversation content comes from `event_msg`; tools/actions come from `response_item`
- Each `user_message` starts a new turn; items before the first user message belong to Session Preamble
- Preserve JSONL line order; UI toggles hide items but do not reorder them
- Filename-derived session ID is canonical; metadata-derived IDs are fallback only
- Reject unsafe paths such as `..`, absolute paths, or anything outside the configured sessions root
- Search match navigation excludes preamble turns; see `IMPLEMENTATION_GUIDE.md` for the full contract

## Data And Config

- Default sessions root: `~/.codex/sessions`
- `CODEX_SESSIONS_ROOT` overrides the root and disables editing it in the UI
- Saved config file: `~/.codex-formatter/config.json`
- SQLite index: `~/.codex-formatter/codex_index.db`
- Debug flags live in `.env.example`, `src/features/conversation/debug.ts`, and `server/logging.ts`

## Validation

Run these after relevant changes:

- `npm run typecheck`
- `npm run check`
- `npm run mdlint` when editing Markdown

Useful fix commands:

- `npm run check:write`
- `npm run lint:fix`
- `npm run format:write`
- `npm run mdlint:fix`

Notes:

- Use `python3` for local scripts, not `python`
- CI currently enforces typecheck, Biome check, and markdownlint; there is no separate automated test suite in this repo today
- For numbered Markdown lists, indent nested bullets so markdownlint does not restart numbering

## Workflow Notes

- Prefer durable fixes over narrow local patches
- If user-provided content looks redacted or summarized (for example `[Pasted Content ...]`), ask for the full content before acting on it
- After edits, run the relevant validation commands before final review
- Before editing CSS, locate selectors with `rg` and review the diff afterward to confirm only the intended rules changed
- If doing UI work and `agent-browser` is available, use it for a quick sanity check; useful dev-only routes are `/canvas`, `/layouts`, and `/stickytest`
- When updating `todos/_done/INDEX.txt`, keep entries newest-first and run `python3 todos/_done/reorder_index.py`
