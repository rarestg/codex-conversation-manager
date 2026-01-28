Watcher + SSE Plan Addendum: Persistent Index Jobs (Option B)
============================================================

Purpose
-------
This addendum should be read immediately after todos/2026-01-23-7pm_watch-sessions-sse-plan.txt.
It expands the SSE + watcher plan to use a persistent, DB-backed indexing job model ("Option B"),
so progress survives reloads and is visible to multiple clients. The key idea: keep the watcher
and SSE transport, but store indexing status in SQLite instead of only in memory.

Why this is attractive now
--------------------------
- The SSE plan already introduces a server event channel. Once it exists, emitting richer
  progress events is nearly free.
- The watcher will trigger reindex automatically; DB-backed job state prevents UI confusion
  if the user reloads mid-index.
- With a DB-only sessions picker, persisting index job status aligns with the broader
  architecture (DB as source of truth).

High-level synergy
------------------
- The watcher still detects filesystem changes and triggers reindex.
- The index manager still serializes runs (no concurrent reindex).
- The SSE endpoint still streams updates.
- The new part: a durable index job table and snapshots of progress.

What Option B adds
------------------
1) Persistent job state (SQLite)
   - New table: index_jobs (and optional index_job_events).
   - Job status survives server restarts and browser reloads.
   - UI can query the current job state at any time.

2) Unified job manager
   - The reindex trigger and watcher both call a single startReindex() method.
   - That method creates/updates job rows, runs indexSessions(), and updates progress.

3) Rich progress events
   - SSE payloads include counts and status, not just "index-updated".
   - The UI can render scanning vs indexing progress live.

Suggested schema
----------------
Add this to server/db/index.ts migrations:

index_jobs
- id (TEXT, PK)              -- UUID or timestamp-based ID
- status (TEXT)              -- idle | scanning | indexing | done | error
- created_at (TEXT)
- started_at (TEXT)
- finished_at (TEXT)
- root (TEXT)
- found (INTEGER)            -- files discovered so far
- total (INTEGER)            -- total after scan
- processed (INTEGER)        -- files processed
- updated (INTEGER)
- skipped (INTEGER)
- removed (INTEGER)
- message_count (INTEGER)
- metadata_checked (INTEGER)
- error (TEXT)

(Optional) index_job_events
- id (INTEGER, PK)
- job_id (TEXT)
- ts (TEXT)
- type (TEXT)                -- progress event type
- payload (TEXT)             -- JSON string

Notes:
- index_job_events is optional. If omitted, the SSE stream can read directly from the current job row.
- Keep one active job at a time. You can store only the latest job row or store a history.

API changes
-----------
1) POST /api/reindex
   - Returns { jobId } immediately (no waiting for completion).
   - Starts or queues a job via the index manager.

2) GET /api/index-status
   - Returns the latest job snapshot from index_jobs (or null if none).
   - Used on initial load before SSE is connected.

3) GET /api/index-events (SSE)
   - Stream progress events with payloads that match the index_jobs shape.
   - Event types: index-started, index-scan-progress, index-progress, index-done, index-error.

Index manager responsibilities
------------------------------
- Accept a root path and start a job if none running.
- Debounce watcher events (same as original plan) but queue a reindex if a run is in flight.
- Update index_jobs row periodically during scan and indexing.
- Emit SSE events on state change.
- Ensure flags are cleared on exceptions (no deadlocks).

Where to wire progress
----------------------
- scanSessionFiles(root, onFound)
  - Call onFound(foundCount) for each file discovered (or throttled).
  - Update index_jobs: status=scanning, found=foundCount.

- indexSessions(root, onProgress)
  - On each file processed: update processed/updated/skipped/removed/message_count.
  - When total becomes known (end of scan), set total.

- finalize
  - status=done or error, finished_at=..., error=... if needed.

Frontend integration
--------------------
- Add a hook (useIndexStatus) that:
  - Calls /api/index-status for initial state.
  - Subscribes to /api/index-events via EventSource.
- Show progress in:
  - Home view on first load ("Found N sessions...", "Indexing X / Y...").
  - Settings modal (replace static summary with live status).

Bundling with watcher plan
--------------------------
- The watcher plan already calls indexSessions() and emits SSE "index-updated".
- Instead, the watcher should call the index manager which:
  - Creates/updates a job row,
  - Streams progress events,
  - Emits an index-done event when finished.
- The existing "index-updated" event can remain as a compatibility alias,
  but the UI should migrate to the richer events.

Ordering (merged plan)
----------------------
1) Add DB schema for index_jobs (and optional events).
2) Implement index manager with job creation + state updates.
3) Wire scan/index progress callbacks into indexSessions().
4) Implement SSE that streams job snapshots.
5) Update frontend hook to use index-status + SSE.
6) Update UI to show scanning/indexing progress.
7) Start watcher (as per SSE plan) and route it through the index manager.

Tradeoffs
---------
- More schema work and migrations, but significantly better UX and resilience.
- Slightly more DB writes (throttling recommended, e.g., every 200-500ms).

Verification additions
----------------------
- Reload the page mid-index and confirm progress continues (status from DB).
- Open two tabs and confirm both get the same progress updates.
- Kill and restart the dev server mid-index; verify index_jobs reports last known state.

Notes
-----
- This addendum does not replace the SSE plan; it enhances it.
- If implementing Option B, remove or minimize any in-memory progress state
  except transient throttling buffers.
