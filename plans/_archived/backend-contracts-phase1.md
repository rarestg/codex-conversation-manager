# Backend Contracts Phase 1: Session Detail and Catalog Foundations

Living document. Progress, Surprises & Discoveries, Decision Log, and Outcomes
must be kept current as work proceeds.

Implementing and reviewing agents must read this file in 200-line chunks before
editing code. Use commands like `sed -n '1,200p' plans/backend-contracts-phase1.md`,
then `sed -n '201,400p' ...`, and continue until EOF. Do not skim or rely on a
partial read.

## Purpose

After this change, the backend owns the canonical contracts for session detail
and session catalog data. The current viewer should load a normalized
`/api/session-detail` response instead of fetching raw JSONL and reparsing it in
the browser. A new `/api/session-catalog` endpoint should return one stable,
UI-agnostic row per session file so the future split-pane catalog UI can be
built without inventing another widget-shaped API.

Observable result:

- `GET /api/session-detail?id=<session-path>` returns normalized session
  metadata, turns, items, and parse errors.
- `GET /api/session-catalog?...` returns paginated session rows with stable
  sorting and optional content or locator query support.
- The current app still opens sessions normally, but the primary session loading
  path no longer depends on client-side JSONL parsing.
- `/api/session` and `/api/resolve-session` remain available as migration
  adapters, not as the long-term canonical UI contracts.

## Progress

- [x] (2026-03-07 09:28Z) Audited the current parser duplication, route surface,
  SQLite schema, and client session-loading path.
- [x] (2026-03-07 16:02Z) Confirmed the current `sessions` table already covers
  the minimal Phase 1 catalog row; no schema extension is needed for this slice.
- [x] (2026-03-07 16:33Z) Added shared domain DTO files for session detail and
  session catalog.
- [x] (2026-03-07 16:47Z) Extracted a canonical server-owned parser under
  `server/sessionDetail/parser.ts` and repointed indexing at it.
- [x] (2026-03-07 17:02Z) Added `GET /api/session-detail?id=...` and migrated
  the existing viewer to consume it.
- [x] (2026-03-07 17:14Z) Added a minimal `GET /api/session-catalog` endpoint
  with stable sorting and pagination.
- [x] (2026-03-07 17:10Z) Kept `/api/resolve-session` as a thin migration
  adapter over shared locator-resolution logic in `server/catalog/locator.ts`.
- [x] (2026-03-07 17:49Z) Fixed the same-rank metadata precedence regression in
  `server/sessionDetail/parser.ts`, restored a lightweight streaming
  metadata-check path for indexing, and restored `requestId` correlation on
  `/api/resolve-session`.
- [x] (2026-03-07 17:21Z) Validation passed: `npm run check`,
  `npm run typecheck`, and `npm run mdlint`.
- [x] (2026-03-24) Updated `IMPLEMENTATION_GUIDE.md`, `ROADMAP.md`, and
  `AGENTS.md` to reflect the new contract center.

## Context and Orientation

This repo currently has a useful indexing backend, but the API boundary is still
shaped around the old home-screen widgets.

Current server behavior:

- `server/routes/index.ts` exposes:
  - `GET /api/sessions` -> year/month/day tree used by `SessionsPanel`
  - `GET /api/workspaces` -> panel feed used by `WorkspacesPanel`
  - `GET /api/search` -> grouped search-panel results
  - `GET /api/session?path=...` -> raw JSONL text
  - `GET /api/resolve-session?id=...` -> exact-ish direct session lookup
- `server/indexing/index.ts` already extracts durable summary data while
  indexing:
  - filename-derived `session_id`
  - `cwd`, git metadata, timestamps
  - counts for turns, messages, thoughts, tools, metadata, token counts
  - `first_user_message`
  - `active_duration_ms`
- `server/db/index.ts` already stores those summary fields in the `sessions`
  table, plus searchable message bodies in `messages` / `messages_fts`.

Current client behavior:

- `src/features/conversation/hooks/useSession.ts` calls `fetchSession()` from
  `src/features/conversation/api.ts`.
- `fetchSession()` calls `GET /api/session?path=...` and returns raw text.
- `useSession.ts` then calls `parseJsonl()` from
  `src/features/conversation/parsing.ts` in the browser.
- That means the frontend reparses the same Codex JSONL structure the backend
  already had to understand while indexing.

Current duplication to remove:

- `server/indexing/index.ts` and `src/features/conversation/parsing.ts` both
  define tool-call and tool-output formatting logic.
- Both sides define filename/session metadata extraction logic.
- `shared/apiTypes.ts` is currently the shared contract center, but it only
  describes legacy/widget-shaped responses such as grouped search and workspace
  summaries.

Terms used in this plan:

- `sessions.id`: the canonical session identity key. It is the session path
  relative to the configured sessions root. This must remain the primary
  navigation key.
- `session_id`: metadata extracted from the filename or embedded payloads. It is
  useful for lookup, but not reliable enough to become the primary key.
- Session detail DTO: the normalized data structure returned by
  `GET /api/session-detail`.
- Session catalog row: one row per session file returned by
  `GET /api/session-catalog`.
- Legacy adapter: an endpoint kept during migration for compatibility with the
  old UI, but not considered the long-term architecture boundary.

Known constraints that must not break:

- Filename-derived `session_id` remains authoritative over embedded metadata.
- Raw session access via `GET /api/session` must remain available for
  debug/export use, even after the viewer migrates.
- Search highlight snippets using `[[...]]` markers must remain intact.
- The current viewer must preserve turn ordering, preamble handling, and match
  navigation behavior after it switches to session-detail DTOs.

## Plan of Work

### 1. Introduce dedicated shared domain DTO files

Add new shared type files:

- `shared/sessionDetailTypes.ts`
- `shared/sessionCatalogTypes.ts`

Keep these files types-only. Do not put runtime helpers in them.

Expected contents:

- `shared/sessionDetailTypes.ts`
  - `SessionDetailItemType`
  - `SessionDetailItem`
  - `SessionDetailTurn`
  - `SessionDetailSummary`
  - `SessionDetailResponse`
- `shared/sessionCatalogTypes.ts`
  - `SessionCatalogSort`
  - `SessionCatalogQuery`
  - `SessionCatalogRow`
  - `SessionCatalogResponse`

Also update `shared/apiTypes.ts` only as needed for migration:

- It may re-export new types temporarily if that reduces churn.
- It must not become the home of the new domain DTOs.
- Add a short comment if helpful clarifying that it remains the legacy
  widget-shaped contract file during migration.

Recommended minimal `SessionCatalogRow` fields for Phase 1:

- `id`
- `path`
- `filename`
- `sessionId`
- `preview`
- `timestamp`
- `cwd`
- `gitBranch`
- `gitRepo`
- `gitCommitHash`
- `startedAt`
- `endedAt`
- `turnCount`
- `messageCount`
- `thoughtCount`
- `toolCallCount`
- `metaCount`
- `tokenCountCount`
- `activeDurationMs`
- `matchCount` (nullable; only meaningful when `contentQuery` is used)
- `firstMatchTurnId` (nullable)
- `snippet` (nullable; preserve `[[...]]` markers if content search is used)

Recommended minimal `SessionCatalogQuery` fields for Phase 1:

- `contentQuery?: string`
- `locatorQuery?: string`
- `workspace?: string | null`
- `sort?: 'recent' | 'oldest' | 'turns_desc' | 'messages_desc' | 'duration_desc'`
- `page?: number`
- `pageSize?: number`

Do not add facet types yet unless they materially simplify Phase 1. Facets are a
later step in the overall sequence.

### 2. Extract a canonical server-owned session parser

Create a new server-owned runtime parser module. A good home is one of:

- `server/sessionDetail/parser.ts`
- `server/indexing/sessionParser.ts`

Pick one and stay consistent. The key requirement is ownership, not the exact
folder name.

This parser should:

- parse raw JSONL line-by-line or from a raw string
- normalize turns and parsed items
- collect parse errors
- apply the same core invariants used today:
  - `event_msg` drives conversational content
  - `response_item` drives tool calls and outputs
  - filename-derived `session_id` wins over embedded metadata
  - preamble items belong to a separate pre-user turn
- expose enough summary data that the indexer can reuse it or derive from it

Do not promote `src/features/conversation/parsing.ts` into the canonical parser.
That file is frontend-local and currently tied to viewer types and helpers.

Preferred implementation direction:

- move or recreate shared runtime normalization logic on the server
- keep the client as a consumer of DTOs, not a parser owner

The first cut does not need to store full parsed sessions in SQLite. Parsing on
demand from the raw file is acceptable for session detail, as long as the logic
is owned by the server and reused consistently.

### 3. Repoint indexing at the canonical parser or shared extraction helpers

`server/indexing/index.ts` already knows how to extract summary metadata. Update
it so it shares logic with the new canonical parser rather than maintaining a
parallel implementation.

A good outcome is:

- one place owns session and item normalization
- indexing calls into that logic, then persists summary rows/messages
- session-detail loading calls into that same logic for on-demand detail DTOs

Be pragmatic. If a full parser unification would create too much churn in one
pass, extract the overlapping helpers first and reuse them in both places. The
point is to stop drift, not to chase elegance for its own sake.

### 4. Decide whether the schema needs a conservative Phase 1 extension

Inspect `server/db/index.ts` and the current `sessions` table before making any
schema changes.

For Phase 1, only add columns if a minimal catalog row truly needs them and they
cannot be derived cheaply from existing data. Examples the broader roadmap
mentioned as possible later additions include:

- `assistant_message_count`
- `tool_output_count`
- `malformed_line_count`
- `has_parse_issues`

If the minimal catalog row can be built from the existing schema plus optional
content-search joins, do not add columns yet. Record that decision in the
Decision Log section of this plan when implementing.

If a schema change is needed:

- add the column(s) in `server/db/index.ts`
- update the indexer to populate them
- keep the additions conservative and query-driven

### 5. Add a locator-resolution helper and keep `/api/resolve-session` as an adapter

The roadmap and reviewer guidance established that `locatorQuery` is the new
domain concept for direct session lookup.

Implement shared locator-resolution logic in a neutral server module, for
example:

- `server/catalog/locator.ts`

That logic should:

- resolve exact `session_id`
- then exact `path`
- then path fragment matches
- respect optional workspace scoping if that remains relevant to the old UI

Then:

- keep `GET /api/resolve-session?id=...` alive
- make it call the same underlying locator-resolution logic used by
  `session-catalog` when `locatorQuery` is present

This avoids duplicating lookup semantics in two different places.

### 6. Add `GET /api/session-detail?id=...`

Update `server/routes/index.ts` to expose a new canonical detail endpoint:

- `GET /api/session-detail?id=<sessions.id>`

Behavior requirements:

- accept `id`, not raw filesystem path fragments
- validate that the session path is safe using the same root/path safety rules as
  the raw endpoint
- read the raw file from disk
- parse it with the new server-owned parser
- return normalized DTOs
- preserve parse errors as non-fatal data in the response

Suggested response shape:

- `session`
  - `id`
  - `path`
  - `filename`
  - `sessionId`
  - `cwd`
  - `gitBranch`
  - `gitRepo`
  - `gitCommitHash`
  - `timestamp`
  - `startedAt`
  - `endedAt`
  - `turnCount`
  - `messageCount`
  - `thoughtCount`
  - `toolCallCount`
  - `metaCount`
  - `tokenCountCount`
  - `activeDurationMs`
  - `preview`
- `turns`
- `parseErrors`

Use `sessions.id` as the request identity key and preserve any indexed summary
values when they help avoid recomputing or filling gaps.

Keep `GET /api/session?path=...` in place. It remains for debug/export and
should not be deleted in this phase.

### 7. Migrate the existing viewer to use `session-detail`

Even though this phase is backend-first, it must exercise the new contract in
the current app so dual parsing does not linger indefinitely.

Update:

- `src/features/conversation/api.ts`
- `src/features/conversation/hooks/useSession.ts`
- `src/features/conversation/types.ts`

Required behavior:

- add `fetchSessionDetail(sessionId: string)`
- make `useSession.ts` call the new endpoint instead of `fetchSession()`
- remove `parseJsonl()` from the primary session-loading path
- keep existing viewer behavior stable:
  - same session/turn URL handling
  - same toggle behavior
  - same session metadata display
  - same parse error surfacing

It is acceptable to keep frontend display types close to current shapes during
migration, but the source of truth must become the server DTO. If the current
viewer types already match the new DTO closely enough, prefer adapting them
rather than inventing another translation layer.

Do not delete `fetchSession()` yet. It may still be useful for debug/export or
future raw-download affordances.

### 8. Add `GET /api/session-catalog`

Add a new endpoint and query module, for example:

- `server/catalog/filters.ts`
- `server/catalog/queries.ts`

`GET /api/session-catalog` should support a minimal but durable query surface:

- `contentQuery`
- `locatorQuery`
- `workspace`
- `sort`
- `page`
- `pageSize`

Behavior requirements:

- one row per session file
- deterministic ordering with `sessions.id` as the tie-breaker
- stable pagination
- optional content-search integration using existing FTS tables
- optional locator-resolution behavior using the shared locator helper
- do not return grouped workspaces or widget-shaped panel data

Expected response fields:

- `rows`
- `totalRows`
- `page`
- `pageSize`
- `totalPages`
- `appliedQuery`
- `contentTokens` (optional, only if content query is present)

This endpoint does not need facets yet. That belongs to the next major step in
the sequence.

### 9. Update docs after the code lands

Once the code compiles and the behavior is validated, update the relevant docs
so they stop describing the old contract center as if nothing changed.

At minimum review:

- `IMPLEMENTATION_GUIDE.md`
- `ROADMAP.md`
- `AGENTS.md`

Specifically:

- mark `shared/apiTypes.ts` as legacy/widget-shaped if it still exists
- document `shared/sessionDetailTypes.ts` and `shared/sessionCatalogTypes.ts`
- document `GET /api/session-detail`
- document that the current viewer now consumes server detail DTOs
- describe `/api/resolve-session` as a migration adapter over shared locator
  logic if that is what landed

## Milestones

### Milestone 1: Shared DTOs and canonical parser boundary exist

Scope:

- add the two shared DTO files
- add the canonical server-owned parser module
- reuse or extract shared normalization logic instead of leaving two fully
  separate parser implementations

Acceptance:

- the repo contains `shared/sessionDetailTypes.ts` and
  `shared/sessionCatalogTypes.ts`
- the canonical parser lives on the server, not in `src/`
- `npm run typecheck` passes

Suggested verification commands:

```bash
cd <repo-root>
npm run typecheck
rg -n "sessionDetailTypes|sessionCatalogTypes" shared src server
```

Expected results:

- TypeScript succeeds
- the new shared DTO files are referenced from server and/or client code

### Milestone 2: Session detail is server-owned and the viewer consumes it

Scope:

- add `GET /api/session-detail`
- migrate the current viewer to load it
- keep raw session access for debug/export

Acceptance:

- `src/features/conversation/hooks/useSession.ts` no longer uses `parseJsonl()`
  for the primary session load path
- selecting a session in the app still shows the same conversation structure
- parse errors remain visible and non-fatal

Suggested verification commands:

```bash
cd <repo-root>
npm run check
npm run typecheck
rg -n "parseJsonl\\(" src/features/conversation/hooks/useSession.ts
rg -n "/api/session-detail" server/routes/index.ts src/features/conversation/api.ts
```

Expected results:

- lint/typecheck pass
- `useSession.ts` no longer calls `parseJsonl(`
- the new endpoint is wired on both server and client sides

Manual verification:

1. Start the dev server with `npm run dev`.
2. Open the app and load a known session.
3. Confirm the session still renders turns, preamble, metadata, and parse-error
   banners correctly.
4. Confirm direct session URL loading (`?session=...`) still works.

### Milestone 3: Minimal catalog endpoint exists and direct resolution is unified

Scope:

- add `GET /api/session-catalog`
- add filter normalization and stable sorting
- unify direct-resolution logic behind shared locator handling

Acceptance:

- `GET /api/session-catalog?page=1&pageSize=20` returns rows plus paging data
- `locatorQuery` and `/api/resolve-session` share the same underlying lookup
  semantics
- no grouped workspace-specific response shape appears in the new endpoint

Suggested verification commands:

```bash
cd <repo-root>
npm run check
npm run typecheck
rg -n "session-catalog|locatorQuery|resolve-session" server src shared
```

Expected results:

- code compiles cleanly
- the new catalog endpoint exists
- shared locator handling is visible in the server code

Manual verification:

1. Start `npm run dev`.
2. In another terminal, call:

   ```bash
   curl -s "http://localhost:5173/api/session-catalog?page=1&pageSize=2"
   ```

3. Confirm the JSON includes `rows`, `totalRows`, `page`, `pageSize`, and
   `totalPages`.
4. Pick a session `id` from the response and call:

   ```bash
   curl -s "http://localhost:5173/api/session-detail?id=<that-id>"
   ```

5. Confirm the response includes `session`, `turns`, and `parseErrors`.

## Validation and Acceptance

Run all of the following before handing off or asking for review:

```bash
cd <repo-root>
npm run check
npm run typecheck
npm run mdlint
```

Then verify the following code-level invariants:

```bash
cd <repo-root>
rg -n "shared/apiTypes" src server shared
rg -n "sessionDetailTypes|sessionCatalogTypes" src server shared
rg -n "parseJsonl\\(" src/features/conversation
rg -n "GET /api/session-detail|GET /api/session-catalog|GET /api/resolve-session" server/routes/index.ts
```

Interpretation guidance:

- `shared/apiTypes` may still appear for legacy search/workspace contracts, but
  the new domain DTOs should live in the dedicated files.
- `parseJsonl(` may still exist in the repo during migration, but it should no
  longer be the primary loader in `useSession.ts`.
- `GET /api/resolve-session` should still exist, but its resolution logic should
  be shared with the new catalog-side locator behavior.

Manual acceptance checklist:

- load the app and open an existing session from the old home screen
- verify turn grouping and preamble rendering match prior behavior
- verify direct session resolution via Enter and UUID paste still works
- verify `/api/session-detail` returns parse errors without failing the whole
  request
- verify `/api/session-catalog` returns stable rows and pagination

## Surprises & Discoveries

- The repo is currently on `main` with `plans/` untracked locally, so this phase
  is landing against the shared working tree rather than the earlier docs-only
  branch context.
- The existing `sessions` table is already sufficient for the minimal catalog
  row: `id`, locator metadata, timestamps, counts, preview, and duration are all
  present. The new catalog endpoint can be implemented without DB schema churn.
- The current viewer types were already close to the target session-detail DTO,
  so the frontend migration only required swapping the loading contract rather
  than building a separate adapter layer.
- Review follow-up exposed a real correctness bug: same-rank `session_meta` and
  `turn_context` values must preserve first-wins behavior, not last-wins
  overwrites. That invariant matters both for session detail and for indexed
  workspace metadata.

## Decision Log

- Decision: `sessions.id` remains the canonical navigation key.
  Rationale: it is already the stable primary key in SQLite and the current UI.
  `session_id` is metadata, not identity.
  Date: 2026-03-07

- Decision: `GET /api/session` remains available after this phase.
  Rationale: raw access is still useful for debug/export and should not be
  conflated with the canonical UI contract.
  Date: 2026-03-07

- Decision: `GET /api/resolve-session` stays alive as a migration adapter over
  shared locator-resolution logic.
  Rationale: the current Enter-to-resolve and UUID-paste flows are real product
  behavior and should not fork into separate lookup implementations.
  Date: 2026-03-07

- Decision: schema additions are optional in this phase and must be justified by
  the minimal catalog row.
  Rationale: the current `sessions` table is already close to sufficient.
  Avoid schema churn unless the new endpoint truly needs more columns.
  Date: 2026-03-07

- Decision: Phase 1 will not change the SQLite schema.
  Rationale: the existing `sessions` table already exposes every field required
  by the minimal catalog row, and match/snippet data can be derived from the
  existing FTS tables at query time.
  Date: 2026-03-07

- Decision: same-rank metadata extraction remains first-wins for `session_id`
  and `cwd`.
  Rationale: later same-rank `session_meta` / `turn_context` entries can reflect
  ancestry or older context and must not overwrite the first canonical values.
  Date: 2026-03-07

- Decision: keep the full raw-file parser for reindex/detail loads, but use a
  lightweight streaming metadata scan for the indexer’s metadata-check path.
  Rationale: it restores the old cheap path for unchanged files without
  reintroducing parser ownership drift.
  Date: 2026-03-07

## Outcomes & Retrospective

- Landed shared DTOs in `shared/sessionDetailTypes.ts` and
  `shared/sessionCatalogTypes.ts`.
- Landed a canonical server-owned parser in `server/sessionDetail/parser.ts`,
  reused by both `server/indexing/index.ts` and the new session-detail path.
- Landed `GET /api/session-detail` and switched
  `src/features/conversation/hooks/useSession.ts` to consume it instead of
  fetching raw JSONL and calling `parseJsonl()` in the browser.
- Landed `GET /api/session-catalog` with stable pagination, sort handling,
  optional content-query integration over the existing FTS tables, and shared
  locator filtering.
- Kept `GET /api/session` for raw debug/export access and kept
  `GET /api/resolve-session` alive as an adapter over
  `server/catalog/locator.ts`.
- No schema changes were needed in this phase.
- The viewer’s primary session-loading path no longer depends on client-side raw
  parsing.
- Review follow-up fixes restored first-wins metadata precedence and brought
  back a cheap streaming metadata-check path for unchanged files, and restored
  `requestId` correlation on `/api/resolve-session`.
- Remaining next-step work is the frontend shell/catalog redesign on top of
  these new contracts, plus doc updates in the canonical repo docs.
