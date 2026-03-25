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
- [ ] Choose the CLI entrypoint and package-script shape, then record that decision in this file and `SHARED_HANDOFF.md`.
- [ ] Extract a reusable shared parser core from the existing session parser.
- [ ] Add a session-graph layer for root and subagent relationships.
- [ ] Implement CLI commands for `overview` and `show`.
- [ ] Implement CLI commands for `subagents` and `parent`.
- [ ] Add JSON output mode and polish message-filter semantics.
- [ ] Validate against real sample sessions and complete closeout.

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

What the current parser does not model:

- root vs subagent classification
- parent-child session graph
- `spawn_agent` and `wait_agent` semantics
- parent-side `<subagent_notification>` messages
- CLI-oriented message retrieval and filtering

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
- support JSON output mode
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
- last final answer output contains `No findings in the reviewed target files.`

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

## Outcomes & Retrospective

Initial state:

- spec written
- recon guide written
- implementation not started yet
- worker-loop docs prepared

Update this section at major milestones and at final completion with:

- what shipped
- what remains
- lessons learned
