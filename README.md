<div align="center">
  <img src="codex-convo-manager.png" alt="Codex Conversation Manager" style="max-width: 500px; width: 100%; height: auto;" />
</div>

# Codex Conversation Manager

A local web app for parsing, visualizing, and searching Codex JSONL sessions. It reads local session logs, groups conversations by user turn, renders messages with markdown, and surfaces tools/actions inline.

## Features
- Browse Codex sessions stored on disk and keep sessions separate.
- View conversations grouped by user turn with inline tools/actions.
- Full-text search across user and assistant messages via SQLite FTS5.
- Markdown rendering with sanitized output and code highlighting.
- Per-message and conversation-wide copy actions.
- Session settings modal (set root, reindex, clear/rebuild index).
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

## Code Tour
- `src/main.tsx` wires up the app and imports the feature entry.
- `src/features/conversation/ConversationViewer.tsx` is the main container composing hooks + UI.
- `src/features/conversation/components/` holds the UI building blocks:
  - `Sidebar.tsx` (search + session browser)
  - `SessionHeader.tsx` (session metadata + copy controls)
  - `TurnList.tsx` / `TurnCard.tsx` / `MessageCard.tsx` (conversation rendering)
  - `SettingsModal.tsx` (session root + indexing actions)
  - `Toggle.tsx` (feature toggles)
- `src/features/conversation/hooks/` manages data flow:
  - `useSessions.ts` (config, sessions tree, reindex)
  - `useSession.ts` (load/parse a session)
  - `useSearch.ts` (FTS search + resolve session IDs)
  - `useUrlSync.ts` (deep-link sync)
  - `useCopyFeedback.ts` (clipboard feedback state)
- `src/features/conversation/parsing.ts` implements JSONL parsing rules and turn grouping.
- `src/features/conversation/markdown.tsx` handles sanitized markdown + snippet highlighting.
- `src/features/conversation/api.ts` wraps API fetches; `copy.ts` formats exports; `url.ts` handles deep links.
- `vite.config.ts` contains API endpoints and SQLite indexing logic.

## API Endpoints (dev middleware)
- `GET /api/config` / `POST /api/config`
- `GET /api/sessions`
- `GET /api/session?path=...`
- `GET /api/search?q=...&limit=...`
- `POST /api/reindex`
- `POST /api/clear-index`
- `GET /api/resolve-session?id=...`

## Development
```bash
npm run dev
npm run build
npm run preview
```

## License
MIT
