# Frontend Shell Phase 2: Resizable Catalog and Detail Pane

Living document. Progress, Surprises & Discoveries, Decision Log, and Outcomes
must be kept current as work proceeds.

Implementing and reviewing agents must read this file in 200-line chunks before
editing code. Use commands like `sed -n '1,200p' plans/frontend-shell-phase2.md`,
then `sed -n '201,400p' ...`, and continue until EOF. Do not skim or rely on a
partial read.

## Purpose

After this change, the main app route should stop presenting separate
Search/Sessions/Workspaces panels and instead render a persistent split layout:

- a metadata-rich session catalog on the left
- the existing conversation viewer on the right
- a resize handle between them

This is the shell migration, not the full filtering/UI-polish migration.

Observable result:

- the root route (`/`) always shows a left catalog pane and a right detail pane
- the left pane loads rows from `GET /api/session-catalog`
- selecting a row opens that session on the right using the already-landed
  session-detail contract
- the shell is resizable via `react-resizable-panels`
- the project now includes the future shell packages:
  - `@base-ui/react`
  - `@tanstack/react-table`
  - `react-resizable-panels`

This phase explicitly does **not** include:

- Base UI filter menus/popovers for advanced filtering
- high-cardinality filter UX
- virtualization
- full sharp-UI cleanup

## Progress

- [x] (2026-03-07 09:55Z) Audited the current root shell, sidebar/home split,
  backend contract surface, and Base UI setup requirements.
- [x] (2026-03-07 10:05Z) Installed `@base-ui/react`,
  `@tanstack/react-table`, and `react-resizable-panels`.
- [x] (2026-03-07 10:11Z) Added the Base UI root prerequisites in
  `src/main.tsx` and `src/index.css`.
- [x] (2026-03-07 10:11Z) Added a catalog client fetch helper and a frontend
  hook around
  `GET /api/session-catalog`.
- [x] (2026-03-07 10:11Z) Built a left-pane catalog component powered by
  TanStack Table state.
- [x] (2026-03-07 10:11Z) Replaced the old home shell in
  `ConversationViewer.tsx` with a persistent
  resizable split layout.
- [x] (2026-03-07 10:11Z) Kept current session loading, deep links, and dev
  routes working.
- [x] (2026-03-07 10:11Z) Validated the new shell and documented deferred work.
- [x] (2026-03-07 11:19Z) Addressed review follow-up findings around
  content-search handoff, session-load race guards, server catalog validation,
  page clamping, and stale plan instructions.

## Context and Orientation

The backend-contracts phase has already landed these important primitives in the
working tree:

- `GET /api/session-detail?id=...` is now the canonical session-detail endpoint.
- `GET /api/session-catalog?...` returns one row per session file.
- the current viewer already consumes `session-detail` instead of raw browser
  parsing.

Current frontend shell shape:

- `src/features/conversation/ConversationViewer.tsx`
  - owns the root route layout
  - shows a home-only screen composed from `SearchPanel`, `WorkspacesPanel`, and
    `SessionsPanel`
  - shows a different two-pane layout (`Sidebar` + `ConversationMain`) once a
    session is active
- `src/features/conversation/components/Sidebar.tsx`
  - still embeds the old `SearchPanel` and `SessionsPanel`
- `src/features/conversation/hooks/useSearch.ts`
  - manages grouped search panel behavior and direct resolution
- `src/features/conversation/hooks/useSessions.ts`
  - still loads the old sessions tree and config/index actions
- `src/features/conversation/hooks/useWorkspaces.ts`
  - still loads workspace summaries for the home panel

Current URL behavior:

- `src/features/conversation/url.ts` and
  `src/features/conversation/hooks/useUrlSync.ts` keep `?session=` and `?turn=`
  in sync
- search highlighting uses `?q=...`

Relevant package setup state:

- `package.json` does not yet include `@base-ui/react`,
  `@tanstack/react-table`, or `react-resizable-panels`
- `src/main.tsx` currently renders `ConversationViewer` directly into `#root`
- `src/index.css` does not yet provide the Base UI portal prerequisites:
  - `.root { isolation: isolate; }`
  - `body { position: relative; }`

Terms used in this plan:

- Catalog pane: the new left-side list of sessions backed by
  `GET /api/session-catalog`
- Detail pane: the existing conversation viewer on the right
- Shell PR: the layout migration that swaps the old panel/home shell for the new
  split-pane structure

Non-negotiable constraints:

- Do not install `@tanstack/react-virtual` yet. Virtualization is a later step.
- Do not build Base UI filter menus/popovers in this phase. Simple controls are
  acceptable for now.
- Do not regress current session loading, deep links, or dev routes
  (`/canvas`, `/layouts`, `/stickytest`).
- Do not spend this phase polishing sharp UI details that are not required to
  make the new shell usable.

## Plan of Work

### 1. Install the shell packages and prepare the app root

Install:

- `@base-ui/react`
- `@tanstack/react-table`
- `react-resizable-panels`

Do not install:

- `@tanstack/react-virtual`

Update:

- `package.json`
- `package-lock.json`

Then add the Base UI prerequisites:

- in `src/main.tsx`, render the app inside a `.root` wrapper element
- in `src/index.css`, add:
  - `.root { isolation: isolate; }`
  - `body { position: relative; }`

This phase does not need to use a Base UI component yet, but it should leave the
app ready for the next phase when menus/popovers arrive.

### 2. Add a catalog fetch helper and hook

Add a frontend fetch helper in:

- `src/features/conversation/api.ts`

Expected additions:

- `fetchSessionCatalog(query)`

Then create a frontend hook, likely:

- `src/features/conversation/hooks/useSessionCatalog.ts`

That hook should own:

- `contentQuery`
- `locatorQuery`
- `sort`
- `page`
- `pageSize`
- `loading`
- `error`
- `rows`
- `totalRows`
- `totalPages`
- `appliedQuery`

Recommended scope for this phase:

- content search input
- locator input
- sort control
- pagination state

Do not add workspace menus or advanced facet state yet. Those belong to the next
phase.

Behavior notes:

- `locatorQuery` should narrow rows through `session-catalog`
- pressing Enter in the locator input may still use the existing direct
  resolution path if that keeps current behavior sharp and predictable
- `contentQuery` should be debounced; do not hammer the server on every
  keystroke

### 3. Build the left catalog pane with TanStack Table state

Add a new component, for example:

- `src/features/conversation/components/SessionCatalogPane.tsx`

or split it into:

- `SessionCatalogPane.tsx`
- `SessionCatalogTable.tsx`

Use TanStack Table for:

- column definitions
- sorting state
- row selection state
- visible row model

Do not let TanStack Table dictate the backend contract or the overall visual
design. It is a state engine here, not the product definition.

Recommended row columns for this phase:

- preview / filename
- workspace (`cwd`)
- session ID
- timestamps
- key numeric metrics such as turns/messages/duration

Recommended controls at the top of the pane for this phase:

- plain text input for `contentQuery`
- plain text input for `locatorQuery`
- native select or simple control for sort
- basic paging controls

Do not build complex menus/popovers yet. That is the next phase.

Row behavior requirements:

- clicking a row loads that session on the right
- the selected row stays visually aligned with the active session
- the catalog remains usable even when no session is selected

### 4. Replace the old home shell with a persistent split layout

Update:

- `src/features/conversation/ConversationViewer.tsx`

Use `react-resizable-panels` to create:

- left panel: catalog pane
- resize handle
- right panel: current conversation detail pane

Recommended defaults:

- left pane roughly 40-45%
- right pane roughly 55-60%
- enforce sane minimum sizes so neither pane collapses into unusability

Important behavior decisions:

- the root route should no longer switch between “home panels” and “session
  view”; the catalog pane should stay visible
- when no session is active, the right pane should show a clear empty state
- when a session is active, reuse `ConversationMain` rather than rewriting the
  detail viewer in this phase
- keep the existing header/settings affordances unless they clearly fight the
  new shell

Dev route safety:

- `/canvas`, `/layouts`, and `/stickytest` must keep working
- only the primary route shell should change in this phase

### 5. De-emphasize the legacy panel components without forcing a big delete

It is acceptable to leave these components in the repo during this phase:

- `SearchPanel.tsx`
- `SessionsPanel.tsx`
- `WorkspacesPanel.tsx`
- `Sidebar.tsx`

But they should no longer define the normal root-route experience.

Do not turn this into a large delete/refactor PR. If removing old wiring is
cheap and safe, do it. Otherwise leave the components unmounted and defer
cleanup.

### 6. Keep URL/deep-link behavior stable

The current deep-link behavior is still valuable:

- `?session=...`
- `?turn=...`
- `?q=...` for match highlighting in the detail pane

This phase should preserve existing session and turn deep links. It does not
need to add catalog-query URL state yet. That can come later once the filter
model is more stable.

### 7. Document what is intentionally deferred

When implementation is done, update this plan with the explicit deferred list:

- Base UI menus/popovers for filters
- workspace/repo/branch facet UIs
- advanced filter state in the URL
- virtualization
- sharp-UI restyling of the entire new shell

That makes it clear the phase ended where intended rather than stopping
halfway through.

## Milestones

### Milestone 1: Packages and root prerequisites are installed

Scope:

- install the three shell packages
- add `.root` and `body` CSS prerequisites for Base UI

Acceptance:

- `package.json` and `package-lock.json` include the new packages
- `src/main.tsx` renders a `.root` wrapper
- `src/index.css` defines `.root { isolation: isolate; }` and
  `body { position: relative; }`

Suggested verification commands:

```bash
cd /Users/rares/GITHUB/ARTIFACTS/codex-formatter
npm run check
npm run typecheck
rg -n "\"@base-ui/react\"|\"@tanstack/react-table\"|\"react-resizable-panels\"" package.json
rg -n "isolation: isolate|position: relative" src/index.css src/main.tsx
```

### Milestone 2: Catalog hook and left pane exist

Scope:

- add `fetchSessionCatalog`
- add `useSessionCatalog`
- add the new catalog pane component

Acceptance:

- the left pane renders rows from `GET /api/session-catalog`
- row selection calls the existing session load path
- simple query/sort controls exist without requiring menus/popovers

Suggested verification commands:

```bash
cd /Users/rares/GITHUB/ARTIFACTS/codex-formatter
npm run check
npm run typecheck
rg -n "fetchSessionCatalog|useSessionCatalog|SessionCatalogPane" src
```

### Milestone 3: The root route is a resizable split shell

Scope:

- `ConversationViewer.tsx` uses `react-resizable-panels`
- the old home-only panel composition is replaced on the normal route

Acceptance:

- the root route shows the catalog on the left and the detail pane on the right
- the divider is draggable
- selecting a row opens the session in the right pane
- no active session still yields a usable right-pane empty state
- dev routes still work

Suggested verification commands:

```bash
cd /Users/rares/GITHUB/ARTIFACTS/codex-formatter
npm run check
npm run typecheck
rg -n "Group|Separator|react-resizable-panels" src
```

Manual verification:

1. Start the dev server with `npm run dev`.
2. Open `http://localhost:5173`.
3. Confirm the left catalog pane is visible immediately.
4. Click a row and confirm the selected conversation opens on the right.
5. Drag the resize handle and confirm both panes resize cleanly.
6. Refresh on a deep-linked session URL and confirm the right pane still opens
   the selected session.
7. Visit `/canvas`, `/layouts`, and `/stickytest` and confirm they still load.

## Validation and Acceptance

Run all relevant checks before handoff or review:

```bash
cd /Users/rares/GITHUB/ARTIFACTS/codex-formatter
npm run check
npm run typecheck
npm run mdlint
```

If the package install modified lockfiles or formatting significantly, re-run
`npm run check` after those changes settle.

Then confirm these structural conditions:

```bash
cd /Users/rares/GITHUB/ARTIFACTS/codex-formatter
rg -n "\"@base-ui/react\"|\"@tanstack/react-table\"|\"react-resizable-panels\"" package.json
rg -n "fetchSessionCatalog|useSessionCatalog|SessionCatalogPane" src
rg -n "Group|Separator" src/features/conversation
```

Interpretation guidance:

- The shell packages should be present in `package.json`.
- A catalog hook and pane component should exist in `src/`.
- The normal route shell should now be built around resizable panels.

Manual acceptance checklist:

- the normal route no longer shows the old Search/Workspaces/Sessions home grid
- the left catalog and right detail pane are visible together
- selecting a catalog row loads the session detail without breaking current
  session/turn URL behavior
- the app still supports direct session loading and search highlighting in the
  right pane
- no Base UI menus/popovers are required yet

## Surprises & Discoveries

- The working tree already contains concurrent backend-contract changes for
  `session-detail` and `session-catalog` that are not in the last committed
  baseline yet. The shell migration should build on those contracts instead of
  assuming the older raw-session browser parsing path still exists.
- `useSession` still relies on the legacy sessions tree for some fallback
  metadata, so removing `useSessions` entirely would expand this slice more than
  intended.
- The installed `react-resizable-panels` release exports `Group` and
  `Separator` rather than the newer panel-group / resize-handle naming used in
  some examples, and its size props need percentage strings instead of raw
  numbers for this layout.
- Preserving search-result context requires the catalog row activation path to
  pass both `searchQuery` and `firstMatchTurnId` into the existing session-load
  contract when a content query is active.

## Decision Log

- Decision: install `@base-ui/react` in this phase even if the first real
  filter-menu/popover usage lands next.
  Rationale: the next phase depends on it, and the root/portal prerequisites
  belong to shell setup.
  Date: 2026-03-07

- Decision: install `@tanstack/react-table` now, but not
  `@tanstack/react-virtual`.
  Rationale: the catalog row model is part of the shell; virtualization is a
  later optimization and should not be guessed at before we see real row counts.
  Date: 2026-03-07

- Decision: keep catalog query state local for now and preserve existing
  `?session=`, `?turn=`, and `?q=` URL behavior.
  Rationale: advanced filter/query URL state will be easier to add after the
  filter model stabilizes in the next phase.
  Date: 2026-03-07

- Decision: keep `useSessions` mounted in the shell for config/index actions
  and active-session fallback metadata during this phase.
  Rationale: it avoids a larger state migration while the catalog shell lands,
  and the legacy tree can be retired later once the detail path no longer
  depends on it.
  Date: 2026-03-07

- Decision: do not force a large delete of legacy panel components in this PR.
  Rationale: the goal is to move the shell, not to chase cleanup that could
  destabilize the transition.
  Date: 2026-03-07

- Decision: keep the left-pane controls intentionally plain in this phase:
  text inputs, native selects, and manual paging.
  Rationale: this lands the shell and catalog contract without prematurely
  committing to Base UI menu/popover behavior or advanced filter UX.
  Date: 2026-03-07

- Decision: use the installed `react-resizable-panels` `Group`/`Separator` API
  directly rather than wrapping it behind local abstractions.
  Rationale: this phase only needs the shell split, and a thin integration is
  easier to validate while the package surface is still settling.
  Date: 2026-03-07

- Decision: guard `useSession` with request ids plus `AbortController` instead
  of delaying URL updates until after detail fetch completion.
  Rationale: this preserves the existing deep-link-first behavior while
  preventing stale detail responses from overwriting the newest session load.
  Date: 2026-03-07

## Outcomes & Retrospective

- The shell packages installed cleanly:
  - `@base-ui/react`
  - `@tanstack/react-table`
  - `react-resizable-panels`
- The new catalog pane is structured as:
  - `fetchSessionCatalog` in `src/features/conversation/api.ts`
  - `useSessionCatalog` in `src/features/conversation/hooks/useSessionCatalog.ts`
  - `SessionCatalogPane` in `src/features/conversation/components/SessionCatalogPane.tsx`
  - a persistent `Group` split shell in `src/features/conversation/ConversationViewer.tsx`
- The old home shell is no longer mounted on the normal route. Legacy panel
  components remain in the repo but no longer define the primary experience.
- Validation completed successfully:
  - `npm run check`
  - `npm run typecheck`
  - `npm run mdlint`
- Review follow-up fixes landed:
  - content-search row activation now preserves `?q=` and jumps to
    `firstMatchTurnId` when available
  - `useSession` ignores stale detail responses and aborts superseded requests
  - `GET /api/session-catalog` now respects missing-root failures and clamps
    out-of-range pages
- Deferred to the next phase:
  - Base UI filter menus/popovers for advanced filters
  - workspace/repo/branch facet UIs
  - advanced filter state in the URL
  - virtualization
  - broader sharp-UI cleanup across the new shell
