<div align="center">
  <img src="codex-convo-manager.png" alt="Codex Conversation Manager" style="max-width: 500px; width: 100%; height: auto;" />
</div>

# Codex Conversation Manager

Local web app for browsing, searching, and inspecting Codex JSONL session logs. It runs entirely on your machine: the frontend is React/Vite, the backend is local Vite middleware, and search/indexing are backed by SQLite FTS5.

## Start Here

- [ROADMAP.md](ROADMAP.md) for repo vision, current product direction, and implementation sequencing
- [USER_GUIDE.md](USER_GUIDE.md) for day-to-day usage and UI workflows
- [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md) for the canonical architecture, invariants, and API behavior
- [AGENTS.md](AGENTS.md) for the agent-oriented repo map and workflow rules
- [VISUAL_STYLE_GUIDE.txt](VISUAL_STYLE_GUIDE.txt) for UI direction and frontend constraints
- [todos/sharp-ui/README.md](todos/sharp-ui/README.md) for sharp UI implementation tracking
- `todos/` for active plans and working notes
- [todos/_done/INDEX.txt](todos/_done/INDEX.txt) for completed-plan history, newest first

## Current Capabilities

- Browse indexed local sessions by date from the home view or sidebar
- Search across indexed session content with SQLite FTS5, grouped and filterable by workspace
- Paste a session UUID or press Enter in search to resolve and open a session directly
- Deep-link to sessions, turns, and active search queries with `?session=...&turn=...&q=...`
- Render user/assistant messages, thoughts, tool calls/outputs, metadata, and token-count telemetry
- Copy plain text, markdown, or filtered conversation exports
- Navigate turns and in-session matches with sticky controls and focus-gated keyboard shortcuts
- Use dev-only demo routes for layout experiments and sticky-behavior checks

## Quick Start

CI runs on Node 20, so use a current Node 20.x install locally as well.

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

If your sessions are not under the default root, either:

- set `CODEX_SESSIONS_ROOT=/absolute/path/to/sessions`, or
- use the Settings modal in the app to update the saved root

On first run, populate the SQLite index before expecting sessions or search results:

- open Settings
- run `Reindex`
- reload the home view if you changed the sessions root

## Validation

Run these before wrapping up changes:

- `npm run typecheck`
- `npm run check`
- `npm run mdlint` when you edit Markdown

Useful autofix commands:

- `npm run check:write`
- `npm run lint:fix`
- `npm run format:write`
- `npm run mdlint:fix`

Optional local hook setup: install `pre-commit` with your package manager of choice, then run `pre-commit install`.

## Configuration And Storage

- Default sessions root: `~/.codex/sessions`
- Env override: `CODEX_SESSIONS_ROOT`
- Saved config: `~/.codex-formatter/config.json`
- SQLite index: `~/.codex-formatter/codex_index.db`
- Debug flags: see [.env.example](.env.example)

## Repo Map

- `ROADMAP.md` explains the current vision, immediate next steps, and which plans are active vs deferred
- `src/features/conversation/` is the main frontend feature: viewer shell, session rendering, parsing, hooks, markdown/copy/url helpers, and UI components
- `src/features/conversation/canvas/` and `src/features/conversation/CanvasView.tsx` power the dev/demo surface at `/canvas` and `/layouts`
- `src/features/conversation/StickyTest.tsx` is the dev-only sticky-behavior sandbox at `/stickytest`
- `server/` contains the local API middleware, config/path safety, SQLite wiring, indexing, search, and workspace summaries
- `shared/` contains API contracts and shared session-metrics logic used by both client and server
- `scripts/typecheck.js` runs both TypeScript projects
- `todos/sharp-ui/` contains the sharp UI implementation slices plus a status tracker

## Development Notes

```bash
npm run build
npm run preview
```

There is no separate automated test suite in this repo today. CI enforces `npm run typecheck`, `npm run check`, and `npm run mdlint`.

## License

MIT
