# Codex Conversation Manager — User Guide

This guide is the practical, user-facing walkthrough for the app. It assumes the app is running locally and that your Codex JSONL sessions live on disk.

---

## Quick Walkthrough

- Search from the home screen to find a session by query, then open a result at the first matching turn.
- Inside a session, use the sticky controls or keyboard shortcuts to move between turns and matches.
- Toggle thoughts, tools, metadata, and token counts on or off depending on how much detail you want to inspect.
- Copy individual messages or export the currently visible conversation view.

---

## First Run And Indexing

The app uses SQLite to index sessions for fast search and browsing.

On first run:
- Open **Settings**.
- Confirm the sessions root.
- Click **Reindex** to scan new or changed files.

Use **Clear & Rebuild** only when you want to rebuild the index from scratch.

Notes:
- Default sessions root: `~/.codex/sessions`
- Saved config file: `~/.codex-formatter/config.json`
- `CODEX_SESSIONS_ROOT` overrides the root and disables editing it in the UI

---

## Searching Sessions

### What is searchable

Search covers indexed session content:
- User messages
- Assistant messages
- Assistant thoughts
- Tool calls and tool outputs

Search does not currently cover:
- Metadata entries such as `session_meta` and `turn_context`
- Token-count telemetry entries

### Search behavior

- Typing performs a short debounce before search runs.
- Queries must contain at least one searchable token:
  - Latin script: `>= 3` characters
  - Numeric: `>= 2`
  - Non-Latin: `>= 1`
- If your query is too short, the UI stays in a "Type a longer query to search" state.
- Press **Enter** in the search box to try resolving a session ID or path fragment directly.
- Pasting an exact UUID tries to open the session immediately before falling back to normal search.

### Results and sorting

Search results are:
- Grouped by workspace
- Returned one row per session
- Shown with match counts, snippets, and session metadata chips

Sort controls:
- **Results**: Relevance, Most matches, Most recent
- **Workspaces**: Last active, Most matches

---

## Filtering By Workspace

You can scope the home view to one workspace:
- Use the **Workspaces** panel to pick a workspace.
- The **Search** and **Sessions** panels will filter to that workspace.
- Clear the filter to return to the full home view.

Current behavior to know:
- Opening a session clears the active home-view workspace filter.

---

## Browsing Sessions

The sessions browser is a year → month → day tree backed by the SQLite index.

You can:
- Expand dates to reveal sessions
- See chips for time, duration, turns, and repo metadata
- Copy the session ID directly from the row
- Open a session from the list

If a session file has been deleted or moved since indexing, the row can be stale until you reindex.

---

## Working Inside A Session

### Header and toggles

The session header shows:
- Session time and relative recency
- Duration and turn count
- Token-count totals and visible-item count
- Copyable session ID and workspace path
- **Copy conversation** export action

Available toggles:
- Show Thoughts
- Show Tools
- Show Metadata
- Show Token Counts
- Show Full Content

When **Show Token Counts** is on, the UI only shows token-count entries that follow content and contain usage data.

### Search within a session

When a session is open from search or has a `?q=` query in the URL:
- Matching turns are highlighted
- The sticky bar shows the active query
- **Prev** and **Next** move through matching turns only
- Preamble entries are excluded from match navigation

---

## Keyboard Navigation

Shortcuts are focus-gated: they only work when the messages pane is focused.

Available shortcuts:
- **Left / Right Arrow**: previous / next turn
- **Cmd/Ctrl + Up Arrow**: first turn
- **Cmd/Ctrl + Down Arrow**: last turn
- **Cmd/Ctrl + K**: open **Go to turn**
- **Cmd/Ctrl + Shift + H**: return Home

The sticky controls bar shows whether shortcuts are currently active.

---

## Deep Links

The app supports URL-based deep links:
- `?session=...&turn=...` opens a specific session and turn
- `?q=...` preserves the active search term for in-session match highlighting and navigation

Back/forward navigation keeps session, turn, and active search state in sync.

---

## Copy And Export

Per-message copy options:
- **Copy text** converts rendered markdown to plain text
- **Copy MD** copies the raw markdown/content

Conversation export:
- Respects the currently visible toggles
- Uses XML-like tags for exported blocks
- Includes user, assistant, thought, tool, metadata, and token-count entries when visible

---

## Settings

The Settings modal lets you:
- Change the sessions root when `CODEX_SESSIONS_ROOT` is not set
- Reindex new or changed files
- Clear and rebuild the index

If you change the root, reindex before expecting accurate browsing or search results.

---

## Troubleshooting

### Search returns nothing

- Reindex the current sessions root
- Make sure the query is long enough to be searchable
- Confirm you are not still scoped to a workspace filter on the home view

### A session row opens to "file not found"

- The sessions list is index-backed, so stale rows can survive until the next reindex
- Run **Reindex** to refresh the database view of the filesystem

### Workspace filtering feels inconsistent

- Workspace filters apply on the home view only
- Opening a session clears the active workspace filter
- Return Home if you want to choose a different workspace filter

---

## Recap

- Index the sessions root before relying on browse/search
- Use search for session-level discovery and `?q=` for in-session match navigation
- Use toggles to reduce noise and export exactly the visible conversation surface
- Focus the messages pane before using keyboard shortcuts
