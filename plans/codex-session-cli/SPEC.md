# Codex Session CLI Spec

Date: 2026-03-25

## Purpose

Codex Session CLI is a local command-line tool for inspecting Codex JSONL session logs directly from `~/.codex/sessions`.

The tool exists to make common session-inspection tasks fast and scriptable without opening the web app or manually searching raw JSONL. The immediate motivation is message retrieval and subagent introspection:

- Fetch the last assistant message from a session by session ID.
- Fetch the last message from a spawned subagent session.
- Inspect a parent session and see which subagents it spawned, what their nicknames were, what prompt each one received, and what they last returned.
- Produce lightweight session overviews such as first user prompt, start time, and tool-call count.

This spec defines the product goals, JSONL parsing contract, gaps in the current formatter parser, and the architecture for a reusable parsing core plus a CLI layer.

## Problem

Codex stores conversations as JSONL files on disk. Those files are rich, but they are not ergonomic to query directly.

Today, extracting a simple answer like "what was the last final answer from subagent `Poincare`?" requires one or more of:

- finding the correct session file by hand
- opening large JSONL logs
- distinguishing canonical assistant messages from duplicated response items
- parsing tool calls and tool outputs manually
- following parent and child thread relationships across files

The existing formatter repo already solves a large part of the base parsing problem for browsing and search. It understands turn boundaries, canonical user and assistant content, metrics, and session metadata. It does not yet model session lineage, subagent relationships, or parent-side subagent notifications.

The goal of Codex Session CLI is to reuse as much of that engine as possible, then extend it with a thin graph layer for parent-child relationships and subagent-specific retrieval.

## Goals

- Provide a local CLI for inspecting Codex sessions by session ID or session path.
- Make "show me the last assistant message" a first-class operation.
- Support message indexing by positive and negative index values.
- Support phase-aware retrieval so callers can ask for the last assistant message overall or the last `final_answer`.
- Provide a session overview command with high-signal metadata.
- Discover spawned subagents from a parent session.
- Resolve a child session back to its parent session when possible.
- Show subagent nicknames, dispatch prompts, completion status, and final outputs.
- Keep the parser robust across Codex CLI versions by normalizing around JSONL record types rather than tool names alone.
- Reuse the formatter parser core rather than creating a second unrelated implementation.

## Non-Goals

- This tool is not a hosted service.
- This tool is not a replacement for the formatter web UI.
- This tool does not need to parse or expose encrypted reasoning content.
- This tool does not need to build a full-text search product in v1.
- This tool does not need to mutate Codex session files.
- This tool does not need to solve every historical session shape before the core workflows work for current sessions.

## Primary User Workflows

### 1. Retrieve the last assistant message from a session

Example intent:

- "Given session `019d222b-f7a3-7160-8f05-775a9121935a`, return the last assistant message."
- "Return the last `final_answer` from that session."

Expected behavior:

- Resolve the session by session ID.
- Parse canonical assistant messages.
- Filter by phase if requested.
- Support `--index -1` for the last matching message.

### 2. Retrieve the last message from a subagent session

Example intent:

- "Return the last message from subagent `Poincare`."
- "Return the last final answer from child session `019d222b-f7a3-7160-8f05-775a9121935a`."

Expected behavior:

- Accept direct child session IDs.
- Support the same role, phase, and index filters as root sessions.

### 3. Inspect which subagents a parent session spawned

Example intent:

- "For parent session `019d2221-1ba5-75b2-b4f1-efd4440b08a4`, list all spawned subagents."

Expected behavior:

- Discover each `spawn_agent` call.
- Show agent ID and nickname.
- Show the first dispatch prompt sent to the child.
- Show whether `wait_agent` saw completion.
- Show the latest parent-side subagent notification if present.
- Show the latest child-side assistant message and latest child-side `final_answer` if the child session file can be resolved.

### 4. Produce a session overview

Example intent:

- "Tell me what session this was, when it started, what the first user prompt was, and how many tool calls it made."

Expected behavior:

- Report session identity and path.
- Report root vs subagent status.
- Report parent thread ID for subagents.
- Report first user message, start and end timestamps, turn count, tool-call count, and workspace.

### 5. Follow parent-child relationships

Example intent:

- "This child session belongs to which parent?"
- "How many subagents came out of this root session?"

Expected behavior:

- Resolve child to parent from child metadata.
- Resolve parent to children from parent tool ledger and child metadata.

## Existing Parsing Core In This Repo

The formatter already has a solid session parser and metrics layer.

### Canonical code paths

- `server/sessionDetail/parser.ts`
- `src/features/conversation/parsing.ts`
- `shared/sessionMetrics.ts`
- `server/indexing/index.ts`

The server parser is the best extraction target because it is more explicit about summary construction and metadata ranking.

### What the current parser already does well

#### Session ID canonicalization

The parser already defines a clear ranking:

- filename-derived session ID is authoritative
- `session_meta` is fallback
- `turn_context` is fallback below `session_meta`

This is implemented in `extractSessionIdFromPath`, `extractSessionIdFromObject`, and the rank-based update logic in `server/sessionDetail/parser.ts`.

Why this matters for the CLI:

- session IDs can be resolved cheaply from paths without fully parsing the file
- file names remain the stable join key across indexing and direct inspection

#### Canonical message source

The current parser intentionally treats `event_msg` as the canonical source of conversation content:

- `event_msg.payload.type == "user_message"` -> user message
- `event_msg.payload.type == "agent_message"` -> assistant message
- `event_msg.payload.type == "agent_reasoning"` -> thought
- `event_msg.payload.type == "token_count"` -> token-count event

It intentionally does not use `response_item.message` as the canonical source for normal chat messages because those records duplicate assistant content.

Why this matters for the CLI:

- "last assistant message" should come from `event_msg.agent_message` by default
- the CLI should not double-count or double-render duplicated assistant text

#### Turn grouping

The parser already uses the correct turn invariant:

- each `user_message` starts a new turn
- everything after that belongs to the same turn until the next `user_message`
- items before the first user message are session preamble

Why this matters for the CLI:

- `first_user_message` can be derived reliably
- message retrieval can expose turn indices if needed later

#### Tool call normalization and counting

The current parser already classifies tool traffic from `response_item`:

- `function_call`
- `custom_tool_call`
- `web_search_call`

It treats the matching output record types as tool outputs, not tool calls.

The shared metrics accumulator increments `toolCallCount` only for the tool-call record types above.

Why this matters for the CLI:

- session overviews can reuse the existing tool-call definition
- the CLI can expose both total tool-call count and raw tool ledger details

#### Session overview fields

The current parser and indexer already produce or store:

- first user message preview
- started and ended timestamps
- turn count
- message count
- thought count
- tool-call count
- metadata count
- token-count event count
- active duration
- cwd and git metadata

Why this matters for the CLI:

- v1 does not need a new summary model from scratch

## Observed JSONL Reality From Current Codex Sessions

This section captures the concrete JSONL shapes observed during investigation. These examples are informative and should guide the parser, but the implementation should still be tolerant of version differences.

### Root session shape

Observed root session example:

- Session ID: `019d2221-1ba5-75b2-b4f1-efd4440b08a4`
- `session_meta.payload.source == "cli"`

Implication:

- a session with `source == "cli"` is a root session unless other lineage metadata says otherwise

### Child subagent session shape

Observed child session example:

- Session ID: `019d222b-f7a3-7160-8f05-775a9121935a`
- Nickname: `Poincare`
- `session_meta.payload.source.subagent.thread_spawn.parent_thread_id == "019d2221-1ba5-75b2-b4f1-efd4440b08a4"`
- `session_meta.payload.source.subagent.thread_spawn.depth == 1`
- `session_meta.payload.source.subagent.thread_spawn.agent_nickname == "Poincare"`

Implication:

- child sessions carry an explicit link back to the parent thread in `session_meta`
- child session metadata is the cleanest way to answer "who is this child's parent?"

### Spawn-agent linkage in the parent session

Observed parent-side pattern:

- `response_item.payload.type == "function_call"`
- `response_item.payload.name == "spawn_agent"`
- `response_item.payload.arguments` is a JSON string
- the parsed arguments include fields such as `agent_type`, `fork_context`, `model`, `reasoning_effort`, and `message`

The matching `function_call_output` contains JSON like:

```json
{"agent_id":"019d222b-f7a3-7160-8f05-775a9121935a","nickname":"Poincare"}
```

Implication:

- parent sessions can discover spawned children by joining `spawn_agent` call IDs to `function_call_output`
- the dispatch prompt can be taken from the parsed `spawn_agent.arguments.message`

### Wait-agent linkage in the parent session

Observed parent-side pattern:

- `response_item.payload.name == "wait_agent"`
- the parsed arguments include `ids`, which contains child agent IDs
- the matching output contains a `status` object keyed by those same agent IDs

Implication:

- `wait_agent` output is a structured completion ledger for one or more children

### Parent-side subagent notifications

Observed parent-side pattern:

- `response_item.payload.type == "message"`
- `response_item.payload.role == "user"`
- message text begins with `<subagent_notification>`

The text contains embedded JSON with:

- `agent_id`
- `status`

Implication:

- parent-side subagent completion notifications are not represented as canonical `event_msg`
- the CLI must special-case this message shape if it wants to expose subagent completion from the parent thread

### Assistant message duplication

Observed pattern:

- the same assistant text appears in `event_msg.agent_message`
- it also appears in `response_item.message role="assistant"`

Implication:

- normal assistant retrieval should use `event_msg.agent_message`
- `response_item.message role="assistant"` should remain non-canonical for normal chat retrieval

### Multiple final answers in one session

Observed child-session pattern:

- a single session can contain multiple user turns
- more than one `assistant` message can have `phase == "final_answer"`

Implication:

- "last assistant message" and "last final answer" are different queries
- the CLI should support `phase` filtering explicitly

## Gaps In The Current Parser

The formatter parser is strong on single-session chat reconstruction, but it does not yet understand session graphs.

### Missing: subagent lineage model

The current parser does not extract or expose:

- `parent_thread_id`
- `agent_nickname`
- `agent_role`
- `depth`
- root-vs-subagent classification

### Missing: parent-side subagent ledger

The current parser does not yet interpret the parent-side records that matter for v1:

- `spawn_agent`
- `wait_agent`
- `<subagent_notification>`

Other agent-management calls such as `send_input`, `resume_agent`, and `close_agent` may appear in newer sessions, but v1 does not need dedicated graph semantics for them beyond preserving them as raw tool-ledger entries.

### Missing: message retrieval API

The formatter parser builds turns for UI rendering, but it does not expose a CLI-oriented message query interface such as:

- "assistant[-1]"
- "assistant final_answer[-1]"
- "all assistant messages"
- "first real user prompt"

### Missing: child-session resolution

The parser does not scan the session corpus to build a graph of:

- session ID -> file path
- parent session ID -> child session IDs
- child session ID -> parent session ID

### Missing: fork and resume lineage model

The parser already has best-effort field extraction for:

- `resume_session_id`
- `resumeSessionId`
- `conversation_id`
- `conversationId`

However, this was not confirmed against a live forked-session example during the investigation. The CLI should keep support for these fields as a provisional lineage mechanism, but the spec should treat it as an open validation item until a real sample is captured.

## Product Requirements

## Session Resolution

The CLI must be able to resolve a session by:

- exact session ID
- direct file path
- possibly later by fuzzy session-path match

The resolution rule should prefer:

1. exact session ID match
2. exact path match
3. explicit failure

The CLI should not silently guess when multiple sessions match.

## Message Retrieval Semantics

The CLI must support:

- `--role user`
- `--role assistant`
- `--role thought`
- `--phase commentary`
- `--phase final_answer`
- `--index <n>` where negative values count from the end

Default retrieval semantics:

- canonical source for `user`, `assistant`, and `thought` is `event_msg`
- canonical source for tool traffic is `response_item`
- `response_item.message` is ignored for ordinary conversation retrieval unless a dedicated mode requests response-item inspection

Special-case retrieval semantics:

- parent-side `<subagent_notification>` messages should be parsed into a synthetic event type such as `subagent_notification`

Recommended v1 behavior:

- `show <session> --role assistant --index -1` returns the last assistant message of any phase
- `show <session> --role assistant --phase final_answer --index -1` returns the last final answer

## Session Overview

The CLI overview command must report:

- session ID
- file path
- source kind: root or subagent
- parent session ID if present
- agent nickname and role if present
- depth if present
- cwd
- started and ended timestamps
- first user message
- turn count
- tool-call count

## Subagent Introspection

For a parent session, the CLI must be able to list spawned subagents with:

- child session ID
- nickname
- spawned-at timestamp
- dispatch prompt
- whether `wait_agent` was called for that child
- most recent wait-agent status
- most recent parent-side notification
- child session path if resolvable
- child first user message if resolvable
- child last assistant message if resolvable
- child last final answer if resolvable

For a child session, the CLI must be able to show:

- parent session ID
- nickname
- depth
- root-vs-subagent classification

## Proposed CLI Surface

The exact command names may change, but the v1 capability set should be equivalent to the following:

```bash
codex-session overview <session-id>
codex-session show <session-id> --role assistant --index -1
codex-session show <session-id> --role assistant --phase final_answer --index -1
codex-session subagents <session-id>
codex-session parent <child-session-id>
```

Possible later additions:

- `codex-session show <session-id> --slice -3:`
- `codex-session graph <session-id>`
- `codex-session tool-calls <session-id>`
- `codex-session notifications <session-id>`

## Proposed Architecture

### 1. Extract a reusable parser core

Move the reusable logic behind the current server parser into a shared module dedicated to JSONL session parsing.

Recommended responsibilities:

- parse JSONL line by line
- normalize session identity
- classify canonical messages
- classify tool calls and tool outputs
- compute metrics
- expose a session summary plus a flat event stream

This shared core should become the source of truth for both:

- the formatter server
- the new CLI

### 2. Add a session-graph layer

Build a second module on top of the parser core for lineage and subagent modeling.

Recommended responsibilities:

- scan session files and resolve session ID -> path
- read lightweight metadata from `session_meta`
- classify root vs subagent sessions
- extract parent-child relationships from child metadata
- parse parent-side `spawn_agent` and `wait_agent` records
- parse parent-side `<subagent_notification>` records
- join parent and child sessions into a graph view

This is the major feature missing from the current formatter engine.

### 3. Use a two-pass strategy

The current formatter indexer already follows the right general shape:

- cheap metadata pass when possible
- full parse only when needed

The CLI should adopt the same pattern.

Recommended flow:

1. Metadata-scan all session files to build a locator map and lightweight lineage hints.
2. Resolve the requested session ID to a path.
3. Fully parse only the requested session and directly related child or parent sessions.

This keeps the CLI fast without needing a database in v1.

### 4. Normalize around record type first

Codex versions vary. Tool names can change, and different sessions may include different function names, but the structural record types are more stable.

The parser should normalize around:

- `event_msg`
- `response_item`
- `session_meta`
- `turn_context`

and then interpret the specific payload types within those records.

For tools, record type matters more than the tool name:

- `function_call`
- `custom_tool_call`
- `web_search_call`

This reduces version fragility.

## Data Model Recommendation

The CLI does not need to expose the formatter's UI turn model directly. It should expose a simpler event model.

Recommended session identity model:

```ts
type SessionIdentity = {
  sessionId: string;
  path: string;
  sourceKind: 'root' | 'subagent' | 'unknown';
  parentSessionId?: string | null;
  agentNickname?: string | null;
  agentRole?: string | null;
  depth?: number | null;
  cwd?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
};
```

Recommended message model:

```ts
type SessionMessage = {
  seq: number;
  turnIndex: number | null;
  timestamp?: string;
  role: 'user' | 'assistant' | 'thought';
  phase?: 'commentary' | 'final_answer' | string | null;
  content: string;
  source: 'event_msg';
};
```

Recommended tool-event model:

```ts
type ToolEvent = {
  seq: number;
  timestamp?: string;
  kind: 'tool_call' | 'tool_output';
  rawType: string;
  name?: string | null;
  callId?: string | null;
  content: string;
};
```

Recommended subagent event model:

```ts
type SubagentRecord = {
  agentId: string;
  nickname?: string | null;
  parentSessionId: string;
  spawnCallId?: string | null;
  spawnedAt?: string | null;
  dispatchMessage?: string | null;
  waitCallIds: string[];
  latestWaitStatus?: string | null;
  latestNotificationStatus?: string | null;
  childPath?: string | null;
};
```

## Parsing Rules For Subagents

### Root vs subagent classification

Use these rules:

1. If `session_meta.payload.source.subagent.thread_spawn` exists, classify as `subagent`.
2. Else if `session_meta.payload.source == "cli"`, classify as `root`.
3. Else classify as `unknown`.

### Parent lookup from a child session

Use:

- `session_meta.payload.source.subagent.thread_spawn.parent_thread_id`

### Child lookup from a parent session

Use all of:

- `spawn_agent` output `agent_id`
- `wait_agent.arguments.ids[]`
- parsed `<subagent_notification>.agent_id`

Join these against:

- child `session_meta.payload.id`

### Dispatch prompt extraction

Use:

- parsed JSON from `spawn_agent.arguments.message`

This should be treated as the parent-side dispatch prompt.

### Child first prompt extraction

Use:

- first canonical `event_msg.user_message`

This should be treated as the first real prompt seen inside the child session.

In current observed sessions, the child's first canonical user message matches the parent-side `spawn_agent.arguments.message`.

## Output Semantics

### Human-readable output

Default CLI output should be concise and readable in the terminal.

### Machine-readable output

The CLI should also support structured output such as JSON for scripting workflows.

Recommended early support:

- `--json` for `overview`
- `--json` for `subagents`
- `--json` for `show`

This matters because one of the primary use cases is forwarding or piping the final output of a child session into another tool or conversation.

## Acceptance Criteria

The v1 spec is satisfied when all of the following are true:

- A user can retrieve the last assistant message from a session by session ID.
- A user can retrieve the last `final_answer` from a session by session ID.
- A user can inspect a parent session and see its spawned subagents.
- For each spawned subagent, the CLI can show nickname, child session ID, and dispatch prompt.
- For each spawned subagent, the CLI can show whether parent-side `wait_agent` status and parent-side `<subagent_notification>` status were observed.
- For each resolvable child session, the CLI can show the child's latest assistant message and latest `final_answer`.
- The CLI overview reports the same session ID, first user message, and tool-call count definitions as the formatter parser core, plus root-vs-subagent classification and parent metadata when present.
- The implementation does not double-count duplicated assistant content from `response_item.message`.
- The implementation correctly special-cases `<subagent_notification>` as a parent-side subagent event.

## Definition Of Done

V1 is done when all acceptance criteria above are true and the implementation has reached this operational bar:

- `npm run typecheck` passes.
- `npm run check` passes.
- The CLI is validated against the real sample parent and child sessions named in `IMPLEMENTATION_EXECPLAN.md`.
- Existing formatter parsing behavior is not regressed while extracting or reusing the shared parser core.
- Any committed fixtures are minimized or redacted rather than copied from personal raw session logs under `~/.codex/sessions`.
- Fork or resume lineage may remain best-effort if no live structural sample was available; that does not block v1 closeout.

## Open Questions

- We did not confirm a live forked-session example with `resume_session_id` or `conversation_id`. The parser should keep best-effort support, but this needs a real fixture before lineage semantics are considered stable.
- The exact CLI command names are still flexible. This spec defines required capabilities, not final branding.
- A future version may want a persistent local cache or SQLite index for faster cross-session graph queries, but v1 can start with a metadata scan plus on-demand full parsing.

## Recommended Build Order

1. Extract the shared JSONL parser core from the current formatter parser.
2. Add a flat event model for canonical messages and tool ledger records.
3. Add session metadata scanning for session ID and parent-thread discovery.
4. Add parent-side subagent parsing for `spawn_agent`, `wait_agent`, and `<subagent_notification>`.
5. Add the CLI commands `overview`, `show`, `subagents`, and `parent`.
6. Add fixtures for the observed root and child session shapes.
7. Validate tool-call counts and message retrieval against real sample sessions.

## Summary

The formatter repo already contains the right foundation for Codex Session CLI:

- canonical session parsing
- correct turn grouping
- correct user and assistant classification
- correct tool-call accounting
- useful overview metrics

What it lacks is the session-graph layer:

- root-vs-subagent classification
- parent-child joins
- spawn and wait parsing
- parent-side subagent notification handling
- direct CLI retrieval semantics

The right implementation strategy is not to replace the existing parser. It is to extract the parser core into a reusable shared module, then add a dedicated session-graph layer and CLI surface on top.
