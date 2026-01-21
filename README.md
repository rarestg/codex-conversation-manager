<div align="center">
  <img src="codex-convo-manager.png" alt="Codex Conversation Manager" style="max-width: 500px; width: 100%; height: auto;" />
</div>

# Codex Conversation Manager

A local, developer-focused web app for parsing, visualizing, and searching Codex JSONL sessions. It reads local session logs, groups conversations by user turn, renders messages with markdown, and surfaces tools/actions inline to preserve causal flow.

## Features
- Browse Codex sessions stored on disk and keep sessions separate.
- View conversations grouped by user turn with inline tools/actions.
- Full-text search across user and assistant messages via SQLite FTS5.
- Markdown rendering with sanitized output and code highlighting.
- Per-message and conversation-wide copy actions.

## Getting Started
```bash
npm install
npm run dev
```

## Notes
- Default sessions root: `~/.codex/sessions` (override with `CODEX_SESSIONS_ROOT`).
- Config lives at `~/.codex-formatter/config.json`.
- SQLite index lives at `~/.codex-formatter/codex_index.db`.

## Development
```bash
npm run dev
npm run build
npm run preview
```

## License
MIT
