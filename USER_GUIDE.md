# Codex Conversation Manager — User Guide

This guide is a fast, practical overview of the core features and daily workflows.
It assumes the app is running locally and you have Codex JSONL sessions on disk.

---

## Quick Walkthrough (2 minutes)

1) **Search for a session**
   - Use the search bar on the home screen.
   - Type a query (e.g., a library name or error message).
   - Open a result to load the session at the first matching turn.
   - ![Quick search and open](GIF_URL_HERE)

2) **Jump between turns**
   - Use **Left/Right Arrow** keys to navigate turns.
   - Or press **Cmd/Ctrl + K** to open **Go to turn** and jump directly.
   - ![Turn navigation shortcuts](GIF_URL_HERE)

3) **Inspect thoughts and context usage**
   - Enable **Show Thoughts** and **Show Token Counts** in the session header.
   - View the assistant’s reasoning and context usage metrics inline.
   - ![Thoughts and token counts](GIF_URL_HERE)

---

## Indexing Your Database

The app uses SQLite to index session files for fast search.

How to index:
- Open **Settings** (gear icon).
- Click **Reindex** to scan new or changed files.
- Use **Clear & Rebuild** only if you suspect corruption or want a full reset.
- ![Reindexing sessions](GIF_URL_HERE)

Notes:
- Default sessions root: `~/.codex/sessions`
- Optional config file: `~/.codex-formatter/config.json`
- Env override: `CODEX_SESSIONS_ROOT` (disables editing in the UI)

---

## Searching Conversations

### What you can search
- User messages
- Assistant messages
- (Thoughts and tools are indexed, but results emphasize user/assistant text)

### Search behavior
- Queries are normalized for Unicode and tokenized safely.
- Minimum token length rules:
  - Latin script: **>= 3**
  - Numeric: **>= 2**
  - Non-Latin: **>= 1**
- If your query is too short, you’ll see a “Type a longer query” hint.

### Sorting results
Use the **Results** and **Workspaces** dropdowns:
- Results: **Relevance**, **Most matches**, **Most recent**
- Workspaces: **Last active**, **Most matches**
- The server honors these parameters and keeps ordering deterministic.

### Grouped results
Search results are grouped by workspace and include:
- Match counts
- Session metadata chips
- Snippet highlights

![Search sorting and grouping](GIF_URL_HERE)

---

## Limiting to a Workspace or Folder

You can scope search and session browsing to a workspace:
- Use the **Workspaces** panel to pick a workspace.
- The **Sessions** panel and **Search** results will be filtered.
- Clear the filter to return to the full view.

![Workspace filtering](GIF_URL_HERE)

---

## Browsing the Session List

The sessions browser is a year → month → day tree.

You can:
- Expand dates to reveal sessions.
- See chips for time, duration, turns, and repo metadata.
- Copy the session ID directly from the row.
- Click a session to open it.

![Browsing the session tree](GIF_URL_HERE)

---

## Working Inside a Session

### Header and toggles
The header shows:
- Session time, duration, turns, and counts
- Copyable session ID and workspace path
- **Copy conversation** export button

Toggles:
- Show Thoughts
- Show Tools
- Show Metadata
- Show Token Counts
- Show Full Content

![Session header toggles](GIF_URL_HERE)

### Copy and export
Per-message copy options:
- Copy text (markdown stripped)
- Copy markdown (raw content)

Conversation export:
- Uses XML-like tags for user/assistant/thought/tool blocks
- Respects visibility toggles

![Copy and export](GIF_URL_HERE)

---

## Turn Navigation and Deep Links

### Keyboard navigation
- **Left/Right Arrow**: move to previous/next turn
- **Cmd/Ctrl + K**: open “Go to turn” modal

### URL deep linking
- `?session=...&turn=...` deep links to a specific turn
- `?q=...` deep links to a search match and enables Next/Prev

![Turn jump modal](GIF_URL_HERE)

---

## Match Navigation (Search Within a Session)

When a search query is active:
- The session view shows a **match bar**.
- Use **Prev/Next** to move between matching turns.
- Matches are highlighted and only include turns > 0 (preamble excluded).

![Session match navigation](GIF_URL_HERE)

---

## Settings and Configuration

Settings modal allows:
- Changing sessions root (disabled when `CODEX_SESSIONS_ROOT` is set)
- Reindexing and clear/rebuild flows

![Settings modal](GIF_URL_HERE)

---

## Troubleshooting

### Search returns nothing
- Reindex the sessions root.
- Check if your query is long enough (token rules above).

### Session file not found
- The session list is DB-backed; reindex to refresh stale entries.

### Workspace filter feels wrong
- Clear the filter and retry search/browse to verify root scope.

---

## Feature Recap (Checklist)

- Local JSONL session browser with turn grouping
- SQLite-backed indexing and FTS search
- Workspace-grouped search results with sort controls
- Search match navigation with `?q=` deep links
- Sessions tree (year/month/day) + copyable session IDs
- Session header stats and copy actions
- Token count visualization + export
- Turn navigation via arrows and Cmd/Ctrl+K
- Settings modal for root + indexing management
