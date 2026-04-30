# Implement Codex Session CLI

Living document. Progress, Surprises & Discoveries, Decision Log, and Outcomes must be kept current as work proceeds.

## Purpose

After this change, a user can inspect Codex JSONL sessions directly from the terminal by session ID or path, retrieve the last assistant message or last `final_answer`, inspect session overviews, and follow parent-child subagent relationships without manually reading raw JSONL.

The end-user proof is observable behavior:

- a user can run a CLI command against a session ID and get the last assistant message
- a user can run a CLI command against a parent session and see spawned subagents with nicknames, prompts, and latest outputs
- the CLI's message and tool-count semantics match the formatter's existing parser rules

## Progress

- [x] (2026-03-25) Wrote `SPEC.md`, `JSONL_RECON_GUIDE.md`, and the worker-loop doc set in `plans/codex-session-cli/`.
- [x] (2026-03-25) Chose the CLI entrypoint: `scripts/codex-session-cli.ts`, exposed via `npm run codex-session -- <command> [args]`, with `tsx` as the TypeScript runtime.
- [x] (2026-03-25) Extracted a reusable shared parser core under `shared/codex-session/` and refactored the server parser, frontend fallback parser, and shared session-ID helpers to consume it while preserving current canonical parsing behavior.
- [x] (2026-03-25) Added a shared session-graph layer under `shared/codex-session/` that classifies root vs subagent sessions, parses `spawn_agent` and `wait_agent` joins, parses parent-side `<subagent_notification>` records, and adds a lightweight locator for session ID/path and parent-child resolution.
- [x] (2026-03-25) Hardened and simplified the session-graph layer after dedicated review cycles: lineage classification is now structural, the high-level child graph unions spawn/wait/notification evidence without duplicate rows, and the locator scan avoids unbounded file-handle fanout.
- [x] (2026-03-26) Implemented real CLI commands for `overview` and `show`, including shared-locator resolution by session ID or direct path, canonical role filtering from `event_msg`, assistant phase filtering, negative index support, and human-readable output.
- [x] (2026-03-26) Validated the Milestone 3 sample workflows against the real parent/child sessions, including child overview, last assistant retrieval, last `final_answer` retrieval, direct-path resolution, and unchanged parent/child tool-call counts of `113` and `77`.
- [x] (2026-03-26) Implemented real CLI commands for `subagents` and `parent`, reusing the shared locator plus session-graph layer for parent-child resolution and enriching resolvable child sessions with canonical `event_msg`-derived assistant and `final_answer` output.
- [x] (2026-03-26) Validated the Milestone 4 sample workflows against the real parent/child sessions, including both spawned child IDs, the `Poincare` nickname, two parent-side notifications, child latest assistant and latest `final_answer` output surfacing, parent lookup back to `019d2221-1ba5-75b2-b4f1-efd4440b08a4`, and unchanged sample tool-call counts of `113` and `77`.
- [x] (2026-03-27) Tightened the execplan retrospective wording so Milestones 1-3 read explicitly as historical snapshots and Milestone 4 remains the live current-state section.
- [x] (2026-03-27) Added JSON output mode across `overview`, `show`, `subagents`, and `parent`, kept the existing human-readable output intact, and polished the help/output surface for real terminal use.
- [x] (2026-03-27) Completed the final hardening/review pass: exact path/ID resolution remained intact, `show` JSON output preserved canonical `event_msg` sourcing, `subagents` child enrichment was made sequential to avoid unbounded full-session fanout, and the sample workflows passed in both human and JSON modes.

## Context and Orientation

Current parser foundation already exists in this repo:

- `server/sessionDetail/parser.ts`
- `src/features/conversation/parsing.ts`
- `shared/sessionMetrics.ts`
- `server/indexing/index.ts`

What the current parser already gets right:

- filename-based session ID is authoritative
- canonical chat content comes from `event_msg`
- tool calls and tool outputs come from `response_item`
- turns start at `event_msg.user_message`
- `toolCallCount` counts `function_call`, `custom_tool_call`, and `web_search_call`

What the current implementation still does not provide:

- confirmed fork or resume lineage beyond provisional field extraction

What v1 does not need to overbuild:

- dedicated graph semantics for `send_input`, `resume_agent`, or `close_agent`
- committed raw personal session fixtures copied directly from `~/.codex/sessions`

Observed JSONL shapes that must be supported:

- root sessions show `session_meta.payload.source == "cli"`
- child sessions show `session_meta.payload.source.subagent.thread_spawn`
- `spawn_agent` output returns `agent_id` and `nickname`
- `wait_agent` output returns status keyed by child agent ID
- parent-side subagent notifications appear as `response_item.message role="user"` whose text begins with `<subagent_notification>`
- assistant text is duplicated in `response_item.message role="assistant"`, so `event_msg.agent_message` remains canonical

Concrete sample sessions available for validation:

- parent session `019d2221-1ba5-75b2-b4f1-efd4440b08a4`
- child session `019d222b-f7a3-7160-8f05-775a9121935a`
- second child session `019d2235-bd83-7a51-b4cc-05d7d3050c7f`

Expected sample facts from recon:

- child `019d222b-f7a3-7160-8f05-775a9121935a` is nicknamed `Poincare`
- that child points back to parent `019d2221-1ba5-75b2-b4f1-efd4440b08a4`
- parent sample contains two `spawn_agent` calls and two `wait_agent` calls
- parent sample contains two `<subagent_notification>` messages
- child sample has `77` tool calls by the formatter rule: `71 function_call + 6 web_search_call`
- parent sample has `113` tool calls by the formatter rule: `108 function_call + 4 custom_tool_call + 1 web_search_call`

## Plan of Work

### 1. Choose and record the CLI entrypoint

Pick the initial file layout and invocation path. The preferred default is:

- shared parsing modules under `shared/codex-session/`
- CLI entrypoint under `scripts/codex-session-cli.ts` or `scripts/codex-session-cli.mjs`
- a package script such as `codex-session`

If a different layout is chosen, update this file and `SHARED_HANDOFF.md` immediately so future workers do not guess.

### 2. Extract a shared parser core

Create a shared parser layer that can be consumed by the existing formatter code and the new CLI.

Preferred responsibilities:

- normalize session identity
- parse canonical messages from `event_msg`
- parse tool ledger records from `response_item`
- compute metrics using the existing session-metrics rules
- expose a flat event list useful to the CLI

Preferred files:

- `shared/codex-session/types.ts`
- `shared/codex-session/parseCore.ts`

Refactor targets:

- `server/sessionDetail/parser.ts`
- optionally `src/features/conversation/parsing.ts`

If frontend refactoring is too risky or awkward in the current pass, defer it explicitly in `Decision Log` and preserve server-side correctness first.

### 3. Add a session graph layer

Create a session-graph module that can answer:

- is this session root or subagent?
- who is this child's parent?
- which children did this parent spawn?
- what prompt was sent to each child?
- what did `wait_agent` report?
- what parent-side subagent notifications were seen?

Preferred files:

- `shared/codex-session/sessionGraph.ts`
- `shared/codex-session/locator.ts`

Required logic:

- parse `session_meta.payload.source`
- parse `spawn_agent` arguments and outputs
- parse `wait_agent` arguments and outputs
- parse `<subagent_notification>` from `response_item.message role="user"`

### 4. Implement CLI commands

Minimum required command set:

- `overview <session>`
- `show <session> --role assistant --index -1`
- `show <session> --role assistant --phase final_answer --index -1`
- `subagents <session>`
- `parent <session>`

Required behavior:

- resolve session by ID or direct path
- filter canonical messages by role and phase
- support negative indices
- keep parent-side notification handling scoped to `<subagent_notification>` rather than treating all `response_item.message role="user"` records as chat messages

### 5. Harden and validate

Validation must use real sample sessions.

At minimum, validate that the chosen CLI entrypoint can:

- identify the child as a subagent with nickname `Poincare`
- resolve the child's parent correctly
- return the child's latest assistant `final_answer`
- report the parent's spawned children
- report tool-call counts that match recon

### 6. Finalize docs and closeout

Before completion:

- update this plan
- update `SHARED_HANDOFF.md`
- ensure spec and recon guide still match the implemented behavior

## Milestones

### Milestone 1: Shared parser core extracted

Scope:

- create the shared parser and types
- refactor the server parser to use it or to delegate key logic to it

What exists at the end:

- there is one parser core for canonical session parsing instead of duplicated logic growing separately for CLI work
- existing formatter behavior remains intact

Validation:

- `npm run typecheck`
- `npm run check`

Expected result:

- both commands pass
- existing session parsing behavior is preserved

### Milestone 2: Session graph layer exists

Scope:

- root and subagent classification
- parent-child linkage
- spawn and wait parsing
- parent-side notification parsing

What exists at the end:

- the code can map parent sessions to child sessions and child sessions back to parents

Validation:

- use the sample parent and child sessions to verify:
  - child `019d222b-f7a3-7160-8f05-775a9121935a` resolves to parent `019d2221-1ba5-75b2-b4f1-efd4440b08a4`
  - parent `019d2221-1ba5-75b2-b4f1-efd4440b08a4` lists child `019d222b-f7a3-7160-8f05-775a9121935a` with nickname `Poincare`

Expected result:

- the parent-child join works from both directions

### Milestone 3: `overview` and `show` commands work

Scope:

- implement session resolution
- implement canonical message filtering
- implement role and phase selection
- implement negative index behavior

What exists at the end:

- the CLI can answer the main "show me the last assistant message" workflow

Validation:

- run the chosen CLI entrypoint for:
  - child session overview
  - child session last assistant message
  - child session last final answer

Expected result:

- child overview includes:
  - session ID `019d222b-f7a3-7160-8f05-775a9121935a`
  - parent `019d2221-1ba5-75b2-b4f1-efd4440b08a4`
  - nickname `Poincare`
  - tool-call count `77`
- last final answer output matches the child's latest recorded `assistant` message where `phase == "final_answer"` rather than assuming a fixed findings or no-findings payload

### Milestone 4: `subagents` and `parent` commands work

Scope:

- parent-side subagent listing
- child-side parent lookup
- surfaced dispatch prompt and latest child outputs

What exists at the end:

- the CLI can answer the main "what subagents came out of this session?" workflow

Validation:

- run the chosen CLI entrypoint for the parent session

Expected result:

- the parent lists at least:
  - child `019d222b-f7a3-7160-8f05-775a9121935a` / nickname `Poincare`
  - child `019d2235-bd83-7a51-b4cc-05d7d3050c7f`
- the parent tool-call count is `113`
- two parent-side subagent notifications are surfaced or counted

### Milestone 5: Hardening and closeout

Scope:

- JSON output mode
- help text
- docs polish
- decide whether any committed fixtures are needed, and if so, make them minimized or redacted
- final review and validation

What exists at the end:

- the CLI is usable from terminal and scripts
- docs and plan files reflect the final behavior

Validation:

- `npm run typecheck`
- `npm run check`
- `npm run mdlint -- plans/codex-session-cli/*.md`
- run the chosen CLI entrypoint against the sample parent and child sessions in both human and JSON modes

Expected result:

- all commands pass
- help output is clear
- the sample workflows from the spec succeed

## Validation and Acceptance

The work is complete when all of the following are true:

- a user can retrieve the last assistant message from a session by ID
- a user can retrieve the last `final_answer` from a session by ID
- a user can inspect a parent session and see its child subagents
- a user can inspect a child session and see its parent
- tool-call counts match the existing parser rule
- canonical assistant retrieval is sourced from `event_msg`, not duplicated `response_item.message`
- parent-side `<subagent_notification>` records are parsed as a special case
- the plan, handoff, spec, and recon docs all reflect the final implemented behavior

## Surprises & Discoveries

- Recon showed that parent-side `<subagent_notification>` messages are carried by `response_item.message role="user"`, not by `event_msg`.
- Recon also showed that a single session can contain multiple `final_answer` assistant messages across turns.
- The current repo has no explicit code for subagent lineage yet, so this must be added as a new graph layer rather than assumed to exist.
- Historical session versions can vary in tool names, so record type should drive classification more than tool name.
- The server and frontend parsers were already slightly different in metadata handling: the server treats same-rank metadata as non-authoritative and normalizes `cwd`, while the frontend fallback parser replaced same-rank metadata and only trimmed `cwd`. The shared core now preserves those differences via wrapper options instead of flattening them accidentally.
- Most `function_call_output` records are ordinary tool text, not embedded JSON. The graph layer should only JSON-decode outputs for matched `spawn_agent` and `wait_agent` calls instead of treating every tool output as structured.
- For the real Milestone 4 samples, the latest canonical assistant message and the latest canonical `final_answer` can be the same `event_msg.agent_message`, so the CLI should surface both fields independently instead of assuming they differ.

## Decision Log

- Decision: Use `event_msg` as the canonical conversation source.
  Rationale: This matches the existing formatter parser and avoids duplicate assistant messages from `response_item.message`.
  Date: 2026-03-25

- Decision: Model parent-side `<subagent_notification>` as a synthetic event rather than a canonical chat message.
  Rationale: It is structurally important to the session graph but is not part of normal conversation text.
  Date: 2026-03-25

- Decision: Start with a metadata scan plus on-demand full parsing, not a new database.
  Rationale: This is enough for v1 and matches the repo's current incremental parsing mindset.
  Date: 2026-03-25

- Decision: Use the worker loop defined in this folder rather than a one-shot implementation handoff.
  Rationale: The work spans parser extraction, graph modeling, CLI ergonomics, and review cycles.
  Date: 2026-03-25

- Decision: Use `scripts/codex-session-cli.ts` with a package script `codex-session` backed by `tsx`.
  Rationale: The repo is TypeScript-first, and a TS entrypoint can import the shared parser modules directly without forcing a separate JavaScript parser path or a build-only workflow.
  Date: 2026-03-25

- Decision: Keep the shared parser core runtime-agnostic and preserve server-vs-frontend metadata differences with wrapper options.
  Rationale: The extraction needs one shared core, but the server remains the canonical parser and the existing frontend fallback behavior should not silently change.
  Date: 2026-03-25

- Decision: Include `scripts/**/*.ts` in the server TypeScript project so the CLI entrypoint is covered by `npm run typecheck`.
  Rationale: The new CLI entrypoint is Node-side TypeScript and should be validated by the existing server typecheck pass from day one.
  Date: 2026-03-25

- Decision: Keep the session graph in separate `shared/codex-session/sessionGraph.ts` and `locator.ts` modules instead of widening the canonical chat parser surface first.
  Rationale: This preserves the formatter's existing `event_msg`-first conversation rules while still exposing the parent-child and subagent ledger data the CLI needs.
  Date: 2026-03-25

- Decision: Only JSON-decode matched `spawn_agent` and `wait_agent` outputs, not every `function_call_output`.
  Rationale: Real sessions contain many plain-text tool outputs such as terminal command logs; eager JSON parsing creates misleading graph parse errors for normal sessions.
  Date: 2026-03-25

- Decision: Expose a small `canonicalMessages` list from the shared parser core instead of teaching the CLI to re-parse raw JSONL or inspect duplicate `response_item.message` records.
  Rationale: This keeps `show` phase-aware while preserving the formatter's `event_msg`-first chat contract and avoids a second parser path in the CLI.
  Date: 2026-03-26

- Decision: Add `--json` as a command-wide output modifier while preserving the existing human-readable output and warning flow.
  Rationale: The CLI needs a scriptable machine-readable mode for Milestone 5, but the default terminal experience should stay concise and unchanged for interactive use.
  Date: 2026-03-27

## Outcomes & Retrospective

Initial state before implementation:

- spec written
- recon guide written
- implementation not started yet
- worker-loop docs prepared

Historical state after Milestone 1:

- shipped:
  - shared parser modules in `shared/codex-session/`
  - server parser refactored to delegate to the shared core
  - frontend fallback parser refactored to delegate to the shared core
  - shared session-ID helpers moved out of the browser URL module
  - CLI entrypoint scaffold added at `scripts/codex-session-cli.ts`
  - package script `npm run codex-session -- ...` wired through `tsx`
- remains:
  - session graph and subagent lineage
  - real CLI commands beyond `--help`
  - JSON output modes and closeout validation
- lessons learned:
  - the right extraction seam was the canonical parse loop plus identity helpers, not the server wrapper
  - preserving existing wrapper-level differences explicitly is safer than assuming the two current parsers were fully aligned
  - review-driven edge-case checks mattered: the shared extraction initially regressed blank `git_repo` fallback behavior and non-string `agent_reasoning.text` rendering, and both needed targeted follow-up fixes

Historical state after Milestone 2:

- shipped:
  - shared session-graph parsing in `shared/codex-session/sessionGraph.ts`
  - lightweight session locator and parent-child metadata scan in `shared/codex-session/locator.ts`
  - root vs subagent classification from child-side `session_meta.payload.source.subagent.thread_spawn`
  - parent-side `spawn_agent` and `wait_agent` reconstruction keyed by `call_id`
  - parent-side `<subagent_notification>` parsing as a special graph event rather than canonical chat
- validated:
  - sample child `019d222b-f7a3-7160-8f05-775a9121935a` resolves to parent `019d2221-1ba5-75b2-b4f1-efd4440b08a4`
  - child nickname `Poincare` is recovered from child metadata
  - sample parent reconstructs both spawned children and both parent-side notifications
  - existing tool-call counts remain `113` for the parent and `77` for the child
- remains:
  - CLI commands `overview`, `show`, `subagents`, and `parent`
  - phase-aware assistant retrieval surface for `show --phase final_answer`
  - JSON output mode and closeout validation
  - unvalidated `timed_out: true` and resume/fork lineage shapes
- lessons learned:
  - the first working graph surface still needed a correctness pass around structural lineage and child aggregation edge cases
  - a small amount of follow-up simplification was worth doing, but only after the behavior was covered by real-session validation

Historical state after Milestone 3:

- shipped:
  - real `overview` and `show` command implementations in `scripts/codex-session-cli.ts`
  - locator-backed session resolution by exact session ID or direct path without adding a second resolver
  - shared `canonicalMessages` extraction in `shared/codex-session/parseCore.ts` so the CLI can filter canonical `event_msg` messages by role and assistant phase
  - human-readable CLI output for session overview and message retrieval, while leaving `subagents`, `parent`, and JSON output for later milestones
- validated:
  - child overview for `019d222b-f7a3-7160-8f05-775a9121935a` reports parent `019d2221-1ba5-75b2-b4f1-efd4440b08a4`, nickname `Poincare`, and tool-call count `77`
  - `show 019d222b-f7a3-7160-8f05-775a9121935a --role assistant --index -1` returns the latest canonical assistant message from `event_msg`
  - `show 019d222b-f7a3-7160-8f05-775a9121935a --role assistant --phase final_answer --index -1` returns the latest canonical assistant `final_answer`
  - direct-path resolution works for the child sample session file
  - parent and child overview output still report tool-call counts `113` and `77`
- remains:
  - CLI commands `subagents` and `parent`
  - JSON output mode
  - final closeout validation and any remaining review-driven fixes
  - unvalidated `timed_out: true` and resume/fork lineage shapes
- lessons learned:
  - the smallest durable seam for Milestone 3 was a shared canonical-message list, not CLI-side raw-entry inspection
  - direct-path resolution can still go through the shared locator cleanly, which keeps ID/path lookup behavior in one place

Current state after Milestone 4:

- shipped:
  - real `subagents` and `parent` command implementations in `scripts/codex-session-cli.ts`
  - `subagents` output built from parent-side `parsedGraph.spawnedChildren` and enriched through locator-resolved child sessions
  - child latest assistant and latest `final_answer` retrieval still sourced from shared canonical `event_msg` messages rather than duplicated `response_item.message`
  - parent lookup resolved through the shared locator and rendered with parent metadata instead of a second lineage path
- validated:
  - `subagents 019d2221-1ba5-75b2-b4f1-efd4440b08a4` lists child `019d222b-f7a3-7160-8f05-775a9121935a` with nickname `Poincare` plus child `019d2235-bd83-7a51-b4cc-05d7d3050c7f`
  - the parent-side subagent view surfaces notification count `2`
  - each resolvable child includes its latest canonical assistant message and latest canonical `final_answer`
  - `parent 019d222b-f7a3-7160-8f05-775a9121935a` resolves back to `019d2221-1ba5-75b2-b4f1-efd4440b08a4`
  - sample tool-call counts remain `113` for the parent and `77` for the child
- remains:
  - JSON output mode
  - final closeout review and any review-driven fixes
  - unvalidated `timed_out: true` and resume/fork lineage shapes
- lessons learned:
  - the graph layer already carried the right parent-side facts for Milestone 4, so the CLI only needed enrichment glue rather than new lineage semantics
  - for the sample child review session, the latest assistant message and latest `final_answer` are the same canonical `event_msg`, so the command surface should expose both fields independently

Current state after Milestone 5:

- shipped:
  - `--json` output mode across `overview`, `show`, `subagents`, and `parent`
  - structured JSON payloads that preserve canonical `event_msg` message sourcing and keep parent-side `<subagent_notification>` data on the graph-aware surfaces only
  - clearer command help text, global `--json` documentation, and JSON-formatted error output when `--json` is requested
  - stricter unknown-option handling for `overview`, `subagents`, and `parent`
  - sequential child-session enrichment inside `subagents` to avoid unbounded parallel full-session loads during large parent-session inspection
- validated:
  - the sample parent and child sessions still pass the human-readable workflows for `overview`, `show`, `subagents`, and `parent`
  - the same workflows now pass in JSON mode
  - tool-call counts remain `113` for the parent and `77` for the child
  - `show --role assistant --phase final_answer --index -1 --json` reports `source: "event_msg"` and matches the last raw `event_msg.agent_message` `final_answer` in the sample child file
  - exact direct-path resolution still works, and arbitrary strings containing a valid session ID still fail cleanly instead of resolving
- remains:
  - unvalidated `wait_agent` `timed_out: true` samples
  - unvalidated live resume/fork lineage samples
- lessons learned:
  - the machine-readable CLI mode was easiest to keep trustworthy by building JSON from the same already-validated command data instead of adding a second code path
  - the final review pass was still valuable after Milestone 4 because it caught two closeout-quality issues: inconsistent unknown-option errors and unbounded child-session fanout during `subagents` enrichment
