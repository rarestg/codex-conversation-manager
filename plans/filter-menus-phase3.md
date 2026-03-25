# Filter Menus Phase 3: Base UI Facets for the Session Catalog

Living document. Progress, Surprises & Discoveries, Decision Log, and Outcomes
must be kept current as work proceeds.

Implementing and reviewing agents must read this file in 200-line chunks before
editing code. Use commands like `sed -n '1,200p' plans/filter-menus-phase3.md`,
then `sed -n '201,400p' ...`, and continue until EOF. Do not skim or rely on a
partial read.

## Purpose

After this change, the session catalog should stop relying on plain text inputs
and native selects for all filtering. Instead, the left pane should gain
purpose-built Base UI controls:

- popover-based facet filters for exact-value metadata
- Base UI select controls for sort and page size
- visible active-filter state in the catalog header

This phase is where the shell starts feeling like a real session workbench
instead of a minimally wired table.

Observable result:

- the catalog has filter buttons that open Base UI popovers
- users can filter rows by workspace, repo, and branch from facet lists with
  counts
- sort and page-size controls are Base UI powered instead of native `<select>`
- active filters are visible and removable from the catalog header
- the backend exposes the facet data the UI needs instead of relying on
  widget-era `/api/workspaces`

This phase explicitly does **not** include:

- virtualization
- broad visual-system cleanup
- URL-backed catalog filter state
- every possible filter dimension

## Progress

- [x] (2026-03-07 10:25Z) Audited the Step 2 catalog shell, the installed Base
  UI package surface, and the missing facet-service dependency.
- [x] (2026-03-07 18:12Z) Confirmed the Step 2 baseline only supports a single
  `workspace` filter and native `<select>` controls, so the shared catalog DTOs
  and backend query layer need to expand before the pane can move to Base UI.
- [x] (2026-03-07 19:08Z) Extended the shared catalog contract with
  multi-value workspace/repo/branch facet filters plus a dedicated facet
  response shape.
- [x] (2026-03-07 19:18Z) Added `GET /api/session-catalog-facets` and taught
  the backend catalog query to accept repeated `workspaces`, `gitRepos`, and
  `gitBranches` params while still accepting the legacy single `workspace`
  input.
- [x] (2026-03-07 19:34Z) Replaced native sort/page-size `<select>` controls
  with Base UI `Select` and added Base UI `Popover` + `Checkbox` facet menus
  for workspace, repo, and branch.
- [x] (2026-03-07 19:34Z) Added visible active-filter chips, per-facet clear
  actions, and a global clear-filters action in the catalog header.
- [x] (2026-03-07 19:40Z) Validation passed with `npm run check`,
  `npm run typecheck`, and `npm run mdlint`.
- [x] (2026-03-07 20:05Z) Follow-up review fixes landed: manual refresh now
  invalidates both row and facet requests, and unknown workspace/repo/branch
  buckets are selectable via a shared sentinel value instead of being rendered
  as disabled informational rows.

## Context and Orientation

What exists now after Step 2:

- the root route is a persistent split shell
- `src/features/conversation/components/SessionCatalogPane.tsx` renders the left
  pane
- `src/features/conversation/hooks/useSessionCatalog.ts` drives:
  - `contentQuery`
  - `locatorQuery`
  - `sort`
  - `page`
  - `pageSize`
- the backend already serves `GET /api/session-catalog`
- Base UI is installed and the root prerequisites already exist in:
  - `src/main.tsx`
  - `src/index.css`

What is still missing:

- there is no facet endpoint
- the catalog query only supports a single `workspace` string and no array-based
  exact filters
- sort and page size still use native `<select>`
- the shell does not expose repo/branch/workspace filtering through menus

Base UI package surface confirmed locally:

- installed package: `@base-ui/react` 1.2.0
- relevant local exports include:
  - `popover`
  - `select`
  - `checkbox`
  - `menu`
  - `dialog`

Terms used in this plan:

- Facet: a filterable exact-value field plus counts, for example workspace or
  git repo
- Facet bucket: one selectable value within a facet, for example one workspace
  path
- Active filters: the currently selected facet values shown as removable labels
  in the catalog header

Non-negotiable constraints:

- Do not add virtualization here.
- Do not turn this into a giant “all filters ever” phase.
- Keep content search, locator search, row activation, and deep-link behavior
  working.
- Keep styling local and sharp-minded; do not let Base UI reintroduce layered,
  rounded, over-decorated controls by default.

## Plan of Work

### 1. Extend the shared catalog query types for exact facet filters

Update the shared catalog contract in:

- `shared/sessionCatalogTypes.ts`

Add array-based exact filters:

- `workspaces?: string[]`
- `gitRepos?: string[]`
- `gitBranches?: string[]`

Also add facet response types. These can live either in
`shared/sessionCatalogTypes.ts` or in a new adjacent file such as
`shared/sessionCatalogFacetTypes.ts`. Pick one and keep it consistent.

Recommended facet types:

- `SessionCatalogFacetValue`
  - `value: string | null`
  - `label: string`
  - `count: number`
- `SessionCatalogFacetsResponse`
  - `workspaces: SessionCatalogFacetValue[]`
  - `gitRepos: SessionCatalogFacetValue[]`
  - `gitBranches: SessionCatalogFacetValue[]`
  - `appliedQuery`

Keep the facet model intentionally narrow in this phase. Workspace, repo, and
branch are enough to validate the pattern.

### 2. Extend the backend catalog query to accept array filters

Update:

- `server/catalog/queries.ts`
- `server/routes/index.ts`

The catalog query should now accept multiple exact filters:

- `workspaces`
- `gitRepos`
- `gitBranches`

Recommended route encoding:

- repeated query params, for example:
  - `?workspaces=/repo/a&workspaces=/repo/b`
  - `?gitRepos=owner/repo`
  - `?gitBranches=main`

Behavior requirements:

- combine exact filters with `AND`
- within one facet, allow `OR` semantics across the selected values
- preserve existing `contentQuery`, `locatorQuery`, sort, and pagination
- keep deterministic ordering

Do not remove the existing single-value `workspace` handling until the new UI is
migrated. If needed, treat it as a legacy shortcut or map it into the new array
shape internally.

### 3. Add a facet endpoint for the catalog

Add a new endpoint, for example:

- `GET /api/session-catalog-facets`

This endpoint should accept the same filtering context as the catalog query, but
when computing one facet’s counts it should not self-filter on that same facet.

Example:

- when computing workspace counts, honor content query / locator query / repo /
  branch, but not currently selected workspaces

That keeps the facet UI useful instead of collapsing to the already-selected
values.

Recommended backend files:

- `server/catalog/facets.ts`
- `server/routes/index.ts`

Scope for this phase:

- workspace counts from `sessions.cwd`
- repo counts from `sessions.git_repo`
- branch counts from `sessions.git_branch`

No numeric-range facets yet. Keep it exact-value and count-based for now.

### 4. Add a frontend hook for catalog facets

Add a frontend hook, for example:

- `src/features/conversation/hooks/useSessionCatalogFacets.ts`

This hook should:

- fetch facet data for the current catalog context
- debounce or batch requests sensibly if content query is changing
- expose loading/error state
- expose the facet buckets needed by the UI

Keep the hook separate from `useSessionCatalog.ts` unless a small shared helper
emerges naturally. The catalog rows and the facet counts are related but not the
same request lifecycle.

### 5. Replace native controls with Base UI controls

Update:

- `src/features/conversation/components/SessionCatalogPane.tsx`
- add small reusable subcomponents if needed under
  `src/features/conversation/components/`

Recommended control mapping:

- Base UI `Select` for:
  - sort
  - page size
- Base UI `Popover` for:
  - workspace filter
  - repo filter
  - branch filter
- Base UI `Checkbox` inside each facet popover for multi-select behavior

What the UI should show:

- a row of compact controls near the top of the pane
- one button per facet, for example:
  - `Workspace`
  - `Repo`
  - `Branch`
- each button shows a small active-count indicator when filters are selected
- the popover body shows searchable or scrollable exact-value lists with counts

For this phase, the popover content can be simple:

- list of checkbox rows
- optional lightweight client-side filtering inside a facet if the list is long

Do not build a highly animated, highly decorative control cluster. Keep it
functional and dense.

### 6. Add visible active-filter state and clear behavior

The catalog header should show what is currently active.

Recommended behavior:

- render removable labels for selected facet values
- provide one global “Clear filters” action
- keep locator/content search distinct from facet filters in the display

This matters because hidden menu state is not good enough once multiple facet
filters can be active simultaneously.

### 7. Keep selection and deep-link behavior stable

The Step 2 fixes must stay intact:

- content-search rows still pass `?q=` and `firstMatchTurnId`
- stale session-detail responses still cannot win
- root-not-found behavior remains aligned across endpoints

This phase is about better filtering controls, not about reworking the detail
loading model.

### 8. Update the plan with what remains deferred

At the end of implementation, explicitly record what is still out of scope:

- virtualization
- query state in the URL
- numeric/range filters
- richer searchable facet pickers if needed later
- full sharp-UI treatment of the new controls

## Milestones

### Milestone 1: Facet-capable backend contract exists

Scope:

- shared facet types
- array-based catalog exact filters
- `GET /api/session-catalog-facets`

Acceptance:

- the backend accepts multi-value workspace/repo/branch filters
- the facet endpoint returns counts for those three fields
- existing catalog row queries still work

Suggested verification commands:

```bash
cd /Users/rares/GITHUB/ARTIFACTS/codex-formatter
npm run check
npm run typecheck
rg -n "session-catalog-facets|gitRepos|gitBranches|workspaces" server shared
```

Manual verification:

1. Start the dev server with `npm run dev`.
2. Call:

   ```bash
   curl -s "http://localhost:5173/api/session-catalog-facets"
   ```

3. Confirm the response includes `workspaces`, `gitRepos`, and `gitBranches`
   arrays with counts.

### Milestone 2: Base UI filter controls replace native shell controls

Scope:

- Base UI Select for sort and page size
- Base UI Popover + Checkbox for workspace/repo/branch filters
- visible active-filter state

Acceptance:

- no native `<select>` remains for sort/page size in the catalog pane
- facet buttons open popovers with selectable values and counts
- selected facet values visibly narrow catalog rows
- active filters are visible and removable

Suggested verification commands:

```bash
cd /Users/rares/GITHUB/ARTIFACTS/codex-formatter
npm run check
npm run typecheck
rg -n "@base-ui/react/(popover|select|checkbox)" src/features/conversation
```

Manual verification:

1. Open the app on `/`.
2. Open each facet popover and confirm values/counts render.
3. Select one workspace facet and confirm the row list narrows.
4. Add a repo or branch filter and confirm filters combine.
5. Remove filters from the active-filter strip and confirm rows repopulate.

### Milestone 3: Step 2 behavior still holds under the new controls

Scope:

- preserve content-search activation context
- preserve locator behavior
- preserve selection and session loading stability

Acceptance:

- clicking a content-search result row still lands near the first match and
  preserves `?q=`
- locator resolution still works via Enter
- rapid row switching still respects last-click-wins behavior

Suggested verification commands:

```bash
cd /Users/rares/GITHUB/ARTIFACTS/codex-formatter
npm run check
npm run typecheck
```

Manual verification:

1. Search content so rows have match counts.
2. Open a matching row and confirm the right pane highlights the query.
3. Switch rows quickly and confirm the final click wins.
4. Use the locator input with Enter and confirm direct resolution still works.

## Validation and Acceptance

Run all relevant checks before handoff or review:

```bash
cd /Users/rares/GITHUB/ARTIFACTS/codex-formatter
npm run check
npm run typecheck
npm run mdlint
```

Then confirm the structural conditions:

```bash
cd /Users/rares/GITHUB/ARTIFACTS/codex-formatter
rg -n "session-catalog-facets|gitRepos|gitBranches|workspaces" server shared
rg -n "@base-ui/react/(popover|select|checkbox)" src/features/conversation
rg -n "Clear filters|active filters|Workspace|Repo|Branch" src/features/conversation/components/SessionCatalogPane.tsx
```

Interpretation guidance:

- the backend should clearly expose facet support
- the frontend should clearly use Base UI controls for the catalog filters
- the catalog pane should show visible active-filter affordances

Manual acceptance checklist:

- the left pane still loads rows and opens sessions reliably
- filter popovers open above the shell correctly
- active filters are visible and removable
- sort/page size are Base UI powered
- no virtualization work has been pulled in

## Surprises & Discoveries

- Discovery: the current hook and response shape only track a single
  `workspace` string in `appliedQuery`, so the facet work needs a shared
  contract update instead of a UI-only patch.
  Impact: update the shared DTO first and treat the old `workspace` param as a
  legacy input that maps into the new array shape during migration.
  Date: 2026-03-07

- Discovery: the facet request lifecycle wants its own hook, but it does not
  need a second debounce layer if it keys off the catalog hook’s debounced
  content query.
  Impact: `useSessionCatalogFacets` stays separate from row loading while still
  avoiding request churn during content-search typing.
  Date: 2026-03-07

- Discovery: modeling unknown facet buckets as `null` in the response clashes
  with a multi-select UI because the query contract only carries strings.
  Impact: the cleaner fix is a shared explicit sentinel value that both the
  facet response and the query filters can round-trip.
  Date: 2026-03-07

## Decision Log

- Decision: Step 3 includes a thin backend facet endpoint even though the main
  goal is frontend menus/popovers.
  Rationale: good filter menus need real facet data; otherwise the UI is forced
  back into ad-hoc client derivation or the legacy `/api/workspaces` path.
  Date: 2026-03-07

- Decision: keep this phase to exact-value workspace/repo/branch facets.
  Rationale: that is enough to prove the pattern without dragging in numeric
  range filters or overbuilding the catalog query too early.
  Date: 2026-03-07

- Decision: use Base UI `Select` for shell dropdowns and Base UI `Popover` plus
  `Checkbox` for multi-select facet menus.
  Rationale: this matches the installed package surface and the user’s
  requirement to move toward Base UI while keeping styling local.
  Date: 2026-03-07

- Decision: keep facet counts server-owned and self-excluding on their own
  dimension instead of deriving them client-side from the current page of rows.
  Rationale: page-local counts would be misleading, and self-excluding facet
  queries keep multi-select menus useful once filters are already active.
  Date: 2026-03-07

- Decision: unknown workspace/repo/branch buckets should be filterable, not
  informational-only.
  Rationale: the backend contract already models them as real facet buckets, so
  the UI should round-trip them through the same filter path instead of
  disabling them.
  Date: 2026-03-07

## Outcomes & Retrospective

- Shipped facet fields:
  - workspace
  - git repo
  - git branch
- Base UI assembly:
  - `Select` now drives sort and page size
  - `Popover` + `Checkbox` now drive multi-select facet menus
  - active filters render as removable chips in the catalog header
- Backend outcomes:
  - catalog queries now accept repeated exact-value facet params
  - legacy single `workspace` still maps into the new array contract
  - `/api/session-catalog-facets` returns self-excluding counts for the three
    exact facets
  - unknown facet buckets now round-trip through a shared sentinel filter value
- Review follow-up outcomes:
  - the refresh button now refreshes both rows and facet counts
  - unknown buckets are selectable instead of disabled
- Deferred intentionally:
  - virtualization
  - URL-backed filter state
  - numeric/range filters
  - searchable facet pickers inside the popovers
  - full sharp-UI polish pass over the new controls
- Next likely step:
  - keep the new filter shell stable, then decide whether large row counts
    justify virtualization before broadening the filter surface further
