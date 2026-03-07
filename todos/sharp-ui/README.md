# Sharp UI Tracker

This folder tracks the implementation-slice documents for the sharp UI
migration.

Canonical background docs remain outside this folder:

- `todos/2026-01-27-1pm_sharp-ui-implementation-plan.md`
- `todos/2026-01-27-1pm_sharp-ui-implementation-plan-mapping.md`
- `todos/2026-01-27-1pm_sharp-ui-implementation-plan-addendum.md`
- `VISUAL_STYLE_GUIDE.txt`

The current product direction matters:

- The repo is moving toward the session catalog + detail-pane architecture in
  `todos/2026-03-07-2pm_session-catalog-rearchitecture-plan.txt`.
- Because of that, not every sharp UI slice should be applied to the current
  legacy home panels.

## Status Legend

- `planned`: still directly useful
- `re-scope`: keep the design intent, but apply it to the new catalog UI rather
  than the legacy panels
- `defer`: valid, but intentionally waiting on a dependency
- `done`: implemented
- `archived`: superseded and no longer active

## Current Status

- `2026-01-29-9am_sharp-ui-pr1-core-tokens.md`
  - Status: `planned`
  - Why: shared tokens and primitives carry forward cleanly.
- `2026-01-29-9am_sharp-ui-pr2-focus-contract.md`
  - Status: `planned`
  - Why: the focus system is cross-cutting and should land early.
- `2026-01-29-9am_sharp-ui-pr3-tags-and-meta.md`
  - Status: `planned`
  - Why: shared tag/meta cleanup is still useful, but best done after core
    primitives stabilize.
- `2026-01-29-9am_sharp-ui-pr4-search-panel.md`
  - Status: `re-scope`
  - Why: the scan-first row/list ideas are good, but they should target the new
    session catalog pane rather than the current `SearchPanel`.
- `2026-01-29-9am_sharp-ui-pr5-sessions-workspaces.md`
  - Status: `re-scope`
  - Why: the list/selection rules should target the unified session catalog
    instead of polishing the current sessions/workspaces split.
- `2026-01-29-9am_sharp-ui-pr6-conversation-content.md`
  - Status: `planned`
  - Why: the right-hand detail pane still needs these content-surface changes.
- `2026-01-29-9am_sharp-ui-pr7-modals-and-cleanup.md`
  - Status: `planned`
  - Why: modals, chrome cleanup, and guardrails remain relevant after the new
    shell lands.

## Update Rules

- When a slice lands, change its status here first.
- If a slice is superseded, move it to `todos/_archive/` and add an archive note
  at the top of the file.
- If a slice needs a new implementation target because of the catalog
  rearchitecture, keep the original doc but mark it `re-scope` here rather than
  pretending it still targets the old panels unchanged.
