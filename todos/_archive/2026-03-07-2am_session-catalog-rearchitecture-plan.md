## Archive Note

Archived on 2026-03-07.

Reason: superseded by `todos/2026-03-07-2pm_session-catalog-rearchitecture-plan.txt`,
which is the preferred consolidated version of the session catalog +
detail-pane rearchitecture plan.

# Session Catalog + Detail Pane Rearchitecture Plan

## Context

The current app already has strong local indexing and search primitives, but the HTTP layer and shared types are shaped around the current home screen:

- `/api/sessions` returns a year/month/day tree for the sessions panel
- `/api/workspaces` returns workspace summaries for the workspaces panel
- `/api/search` returns workspace-grouped session results for the search panel
- `/api/session` returns raw JSONL, and the frontend reparses it for the detail pane

That means the backend is only partially decoupled from the UI. The indexing and SQLite read model are reusable, but the route contracts are still panel-specific, and the session-detail parser is duplicated across server and client.

The new direction is better:

- left side: one metadata-rich session catalog with strong filtering and search
- right side: the selected conversation in a detail pane
- UI primitives: `@base-ui/react`
- row model / sorting / filtering / virtualization: TanStack Table + TanStack Virtual

The clean architecture move is to make the backend own canonical session understanding, then let the frontend become a thin renderer over explicit catalog and detail contracts.

## Goals

- Make the backend the canonical source of truth for session parsing, metadata extraction, and computed metrics.
- Replace panel-specific home-view contracts with a unified session-catalog query model.
- Support a dense, tabular, filter-heavy left pane without leaking TanStack Table internals into the API.
- Keep the existing session viewer behavior and deep-link semantics while migrating.
- Preserve current path-safety, indexing, and search invariants.
- Use Base UI for menus, popovers, dialogs, and related headless primitives.

## Non-Goals

- No generic metadata EAV system or overabstracted "query language".
- No spreadsheet editing or AG Grid style cell-editing features.
- No rewrite away from local Vite middleware + SQLite.
- No need to remove the raw JSONL endpoint; it can remain for debugging/export.

## Current Architecture Assessment

### Good seams already present

- `server/indexing/index.ts` already owns filesystem scanning, file parsing, and index writes.
- `server/search/queries.ts` already isolates FTS normalization and search SQL from route handlers.
- `server/workspaces.ts` is already a small query module rather than inline route logic.
- `shared/sessionMetrics.ts` already centralizes a meaningful cross-layer invariant.
- SQLite already contains a useful session-level read model in `sessions` plus `messages` / `messages_fts`.

### Current coupling problems

- Session parsing is duplicated:
  - backend indexing parser in `server/indexing/index.ts`
  - frontend detail parser in `src/features/conversation/parsing.ts`
- Shared API types model current panel outputs instead of durable domain contracts:
  - `SessionTree`
  - `WorkspaceSummary`
  - `WorkspaceSearchGroup`
- Home-view data loading is split across independent hooks and endpoints:
  - `useSessions`
  - `useWorkspaces`
  - `useSearch`
- `/api/search` is optimized for grouped search results, not a general catalog query.
- `/api/sessions` is optimized for sidebar/tree rendering, not a session grid or table.
- `/api/session` returns raw text, forcing frontend parsing and making the detail pane depend on client-side session understanding.

This is moderate coupling, not catastrophic coupling. The indexing/search core is reusable. The part that needs redesign is the query contract layer and the session-detail boundary.

## Architectural Decision

Introduce a backend-owned session catalog domain with three responsibilities:

1. Ingest session files and persist normalized read models in SQLite.
2. Answer catalog queries and facets from one shared query object.
3. Return parsed session detail DTOs for the right-hand conversation pane.

Routes become thin adapters over domain services. Frontend hooks consume domain-shaped contracts, not panel-shaped contracts. TanStack Table and Base UI sit above this layer and do not define it.

## Target Boundaries

### 1) Ingestion / indexing layer

Responsibilities:

- scan JSONL files from the configured sessions root
- parse entries once with canonical rules
- compute session summary metrics
- persist searchable messages and session-level read models
- extract extra filterable metadata where worthwhile

Suggested modules:

- `server/session-log/parseSessionLog.ts`
- `server/session-log/extractSessionSummary.ts`
- `server/catalog/indexSessions.ts`
- `server/catalog/catalogRepository.ts`

### 2) Catalog query layer

Responsibilities:

- normalize and validate filter input
- run filtered/sorted/paginated session queries
- run facet queries
- resolve direct session identifiers
- merge FTS results with metadata filters without forcing a grouped-search response shape

Suggested modules:

- `server/catalog/catalogQuery.ts`
- `server/catalog/catalogFacets.ts`
- `server/catalog/catalogFilters.ts`
- `server/catalog/resolveSession.ts`

### 3) Session detail layer

Responsibilities:

- read one session by ID/path
- return parsed turns/items in canonical order
- return parse warnings and summary metadata
- preserve a raw JSONL path for debug/export workflows

Suggested modules:

- `server/session-log/getSessionDetail.ts`
- `server/session-log/sessionDetailTypes.ts`

### 4) HTTP adapter layer

Responsibilities:

- parse HTTP query params / request bodies
- call domain services
- attach timing/debug headers
- serialize shared DTOs

This layer should not contain SQL or frontend-shape grouping logic.

### 5) Frontend data layer

Responsibilities:

- translate UI state into `SessionCatalogQuery`
- keep query/filter/selection state in the URL
- render catalog rows and detail responses
- avoid reparsing raw JSONL in React

Suggested hooks:

- `useSessionCatalog`
- `useSessionCatalogFacets`
- `useSessionDetail`
- `useCatalogUrlState`

## Canonical Shared Contracts

Define these in a new shared module such as `shared/catalogTypes.ts`.

Do not model the API around TanStack Table's internal state shape. Keep the domain contracts UI-library-neutral.

```ts
export type CatalogSortKey =
  | 'startedAt'
  | 'endedAt'
  | 'activeDurationMs'
  | 'turnCount'
  | 'messageCount'
  | 'workspace'
  | 'repo'
  | 'branch'
  | 'relevance';

export type SortDirection = 'asc' | 'desc';

export type RangeFilter<T> = {
  min?: T | null;
  max?: T | null;
};

export interface SessionCatalogQuery {
  q?: string;
  filters: {
    workspace?: string[];
    repo?: string[];
    branch?: string[];
    toolName?: string[];
    startedAt?: RangeFilter<string>;
    activeDurationMs?: RangeFilter<number>;
    turnCount?: RangeFilter<number>;
    messageCount?: RangeFilter<number>;
    thoughtCount?: RangeFilter<number>;
    toolCallCount?: RangeFilter<number>;
    tokenCountCount?: RangeFilter<number>;
    hasThoughts?: boolean;
    hasToolCalls?: boolean;
    hasTokenCounts?: boolean;
    hasPreamble?: boolean;
    hasSessionId?: boolean;
  };
  sort: Array<{ key: CatalogSortKey; dir: SortDirection }>;
  page: {
    offset: number;
    limit: number;
  };
}
```

```ts
export interface SessionCatalogRow {
  id: string;
  sessionId: string | null;
  filename: string;
  preview: string | null;
  cwd: string | null;
  gitRepo: string | null;
  githubSlug: string | null;
  gitBranch: string | null;
  gitCommitHash: string | null;
  timestamp: string | null;
  startedAt: string | null;
  endedAt: string | null;
  activeDurationMs: number | null;
  turnCount: number | null;
  messageCount: number | null;
  thoughtCount: number | null;
  toolCallCount: number | null;
  toolOutputCount: number | null;
  metaCount: number | null;
  tokenCountCount: number | null;
  hasPreamble: boolean;
  toolNames?: string[];
  firstMatchTurnId?: number | null;
  matchMessageCount?: number | null;
  matchTurnCount?: number | null;
  snippet?: string | null;
  fileSize?: number | null;
  fileMtime?: number | null;
  indexedAt?: string | null;
}
```

```ts
export interface SessionCatalogFacets {
  workspaces: Array<{ value: string; count: number }>;
  repos: Array<{ value: string; count: number }>;
  branches: Array<{ value: string; count: number }>;
  tools: Array<{ value: string; count: number }>;
  ranges: {
    startedAt: { min: string | null; max: string | null };
    activeDurationMs: { min: number | null; max: number | null };
    turnCount: { min: number | null; max: number | null };
    messageCount: { min: number | null; max: number | null };
    thoughtCount: { min: number | null; max: number | null };
    toolCallCount: { min: number | null; max: number | null };
    tokenCountCount: { min: number | null; max: number | null };
  };
}
```

```ts
export interface SessionDetailResponse {
  session: SessionCatalogRow;
  details: {
    cwd: string | null;
    sessionId: string | null;
    parseWarnings: string[];
  };
  turns: Array<{
    id: number;
    startedAt?: string;
    activeDurationMs?: number | null;
    isPreamble?: boolean;
    items: Array<{
      id: string;
      type: 'user' | 'assistant' | 'thought' | 'tool_call' | 'tool_output' | 'meta' | 'token_count';
      seq: number;
      timestamp?: string;
      content: string;
      callId?: string;
      toolName?: string;
    }>;
  }>;
}
```

## What The Backend Already Has

These fields already exist or are already derivable with little work:

- session path / ID
- first-user preview
- cwd
- git repo / branch / commit
- timestamps
- turn count
- message count
- thought count
- tool call count
- meta count
- token count count
- active duration
- FTS search over indexed message content

That means the table redesign should build on the current read model, not replace it.

## What The Backend Does Not Yet Have

### Missing contract 1: unified session-catalog query

Today there is no single backend call that says:

- give me session rows
- filtered by workspace/repo/branch/ranges/booleans
- optionally searched by FTS query
- sorted and paginated
- in one row shape suitable for a table

That contract must be added.

### Missing contract 2: catalog facets

Today the UI can fetch workspace summaries, but it cannot ask:

- what workspaces exist under the current filter set
- what branches remain after selecting a repo
- what tool names appear in the remaining result set
- what numeric ranges are available

That facet layer is necessary for a powerful filter UI.

### Missing contract 3: server-owned session detail DTO

Today the detail pane still depends on raw file fetch + client parse. For the redesign, the backend should own:

- canonical turn grouping
- canonical item typing
- canonical metadata extraction
- canonical parse warning behavior

The raw JSONL endpoint can remain, but it should become an escape hatch, not the main detail contract.

### Missing contract 4: richer extracted metadata for filtering

The current `sessions` table is strong, but a tabular UI benefits from a few extra fields:

- `tool_output_count`
- `has_preamble`
- file metadata from `files` in row responses
- optional tool-name extraction for tool facets

Tool-name filtering is the one place where a normalized child table is worth it.

## Proposed SQLite Changes

Keep the current tables:

- `sessions`
- `files`
- `messages`
- `messages_fts`

Add or extend:

- add `tool_output_count INTEGER` to `sessions`
- add `has_preamble INTEGER NOT NULL DEFAULT 0` to `sessions`
- add `session_tools(session_id TEXT, tool_name TEXT, call_count INTEGER, PRIMARY KEY(session_id, tool_name))`

Notes:

- Do not invent a generic key/value metadata table yet.
- Join `files` into catalog queries instead of duplicating file size and indexed time into `sessions`.
- Defer model/provider extraction until there is a reliable parser source for it.

## Search And Filter Semantics

The left pane should support two different kinds of narrowing:

- content search via SQLite FTS
- metadata filtering via exact/range/boolean filters

Those should be combined in one catalog query service.

Important rule:

- rows should be metadata-rich
- filters should not all be high-cardinality dropdowns

A clean split is:

- exact multi-select filters: workspace, repo, branch, tool name
- range filters: started time, duration, turns, messages, thoughts, tool calls, token telemetry
- boolean filters: has thoughts, has tools, has token counts, has preamble, has session ID
- free text: content FTS / preview search

## Endpoint Proposal

Introduce new endpoints alongside the current ones:

- `GET /api/session-catalog`
- `GET /api/session-catalog/facets`
- `GET /api/session-detail?id=...`

Keep these for compatibility during migration:

- `GET /api/session`
- `GET /api/search`
- `GET /api/sessions`
- `GET /api/workspaces`
- `GET /api/resolve-session`

Important design rule:

- define the domain query object first
- let the route adapter translate URL params into that object

This keeps transport decisions separate from the catalog model. We can start with `GET` for URL-friendly filters and still keep the internal query contract stable if a future `POST` route becomes useful.

## Base UI + Frontend Stack

Use:

- `@base-ui/react` for popovers, menus, dialogs, and similar primitives
- `@tanstack/react-table` for the row/filter/sort model
- `@tanstack/react-virtual` for large result sets
- `react-resizable-panels` for the resizable left/right layout

Base UI setup requirements to include during implementation:

- add an application root wrapper with `isolation: isolate`
- add `body { position: relative; }` for visual-viewport-safe backdrops on modern iOS Safari

Important boundary:

- Base UI should provide interaction primitives
- TanStack Table should provide table state
- neither should define the backend contracts

## Migration Plan

### Phase 1: Define new shared contracts

- Add `shared/catalogTypes.ts`.
- Keep existing `shared/apiTypes.ts` intact for current UI compatibility.
- Add neutral query/row/facet/detail DTOs.

### Phase 2: Move canonical session detail parsing to the server

- Extract parser logic from the current duplication into one server-owned module.
- Add `GET /api/session-detail?id=...`.
- Update the frontend to consume `SessionDetailResponse` for the active session.
- Keep `/api/session` as a raw/debug endpoint.

### Phase 3: Extend the indexer for table-grade metadata

- Persist `tool_output_count`.
- Persist `has_preamble`.
- Add `session_tools` extraction and writes.
- Reuse `files` metadata in catalog row queries.

### Phase 4: Add catalog query and facet services

- Implement `querySessionCatalog(query)`.
- Implement `getSessionCatalogFacets(query)`.
- Merge FTS + metadata filtering in one query path.
- Keep `resolveSession` for direct ID/path opens.

### Phase 5: Build the new shell

- Replace the current home view with a resizable split layout.
- Left pane: session catalog table with column visibility, filters, and search.
- Right pane: conversation detail view for the selected session.
- Promote workspace from a dedicated panel to a column + filter.

### Phase 6: Remove obsolete frontend coupling

- delete client-side raw JSONL parsing from normal app flow
- retire `useWorkspaces` as a home-panel data source
- retire grouped-search home behavior once the catalog replaces it
- keep compatibility routes only if still useful for dev/debug

## Landmines

- Do not make the API mirror TanStack Table's raw state shape.
- Do not keep two canonical session parsers after the migration.
- Do not force the table to consume `/api/search` grouped results.
- Do not treat every metadata field as a visible facet control.
- Do not overdesign a generic metadata store before concrete filters need it.

## Acceptance Criteria

- The backend can answer one catalog query that combines search, filters, sorting, and pagination.
- The backend can answer facet queries for the current filter set.
- The right-hand detail pane loads from a parsed server DTO, not raw JSONL parsing in React.
- Rows expose enough metadata to filter by workspace, repo, branch, turns, duration, token telemetry, and content search.
- Deep links for session and turn selection remain intact.
- Base UI is used for overlay and menu primitives in the new layout.
- The design remains compatible with the repo's sharp, scan-first direction.

## Recommended First Slice

Build the backend before the table:

1. Add `shared/catalogTypes.ts`.
2. Add `GET /api/session-detail`.
3. Add `GET /api/session-catalog` without facets first.
4. Wire a minimal left-pane table to that contract.
5. Add facets after the first end-to-end catalog/detail flow works.

That sequence keeps the backend/UI boundary clean and prevents the table library from dictating the shape of the architecture.
