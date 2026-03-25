# Codex JSONL Recon Guide

Date: 2026-03-25

This document captures the JSONL reconnaissance work done for the Codex Session CLI investigation. It turns the `jq` probing, raw findings, and Bacon's research summary into a reusable field guide for engineers inspecting other Codex session files.

This is not the product spec. Use [SPEC.md](/Users/rares/GITHUB/ARTIFACTS/codex-formatter/plans/codex-session-cli/SPEC.md) for the product and architecture definition. Use this file when you need to inspect raw session files and answer questions like:

- What is the real session ID here?
- Is this a root thread or a spawned subagent?
- What was the first actual user prompt?
- What was the last assistant message or last final answer?
- How many tool calls did this session make?
- Which child sessions did this parent spawn?
- What did `wait_agent` return?
- How do parent-side subagent notifications show up in the raw JSONL?

## Sessions Investigated

Primary child session used during recon:

- `/Users/rares/.codex/sessions/2026/03/24/rollout-2026-03-24T16-26-40-019d222b-f7a3-7160-8f05-775a9121935a.jsonl`

Primary parent session used during recon:

- `/Users/rares/.codex/sessions/2026/03/24/rollout-2026-03-24T16-14-48-019d2221-1ba5-75b2-b4f1-efd4440b08a4.jsonl`

Observed child session facts:

- child session ID: `019d222b-f7a3-7160-8f05-775a9121935a`
- nickname: `Poincare`
- parent session ID: `019d2221-1ba5-75b2-b4f1-efd4440b08a4`

## High-Signal Findings

### 1. Session identity is clear in `session_meta`

Bacon's core finding was right: `session_meta` is the identity anchor inside the file.

For the child session, this probe:

```bash
jq -cr '
  select(.type=="session_meta")
  | {
      timestamp,
      session_type: .payload.source,
      id: .payload.id,
      agent_nickname: .payload.agent_nickname,
      parent_thread_id: .payload.source.subagent.thread_spawn.parent_thread_id
    }
' child.jsonl
```

returned:

```json
{
  "timestamp": "2026-03-24T23:26:41.277Z",
  "session_type": {
    "subagent": {
      "thread_spawn": {
        "parent_thread_id": "019d2221-1ba5-75b2-b4f1-efd4440b08a4",
        "depth": 1,
        "agent_nickname": "Poincare",
        "agent_role": "default"
      }
    }
  },
  "id": "019d222b-f7a3-7160-8f05-775a9121935a",
  "agent_nickname": "Poincare",
  "parent_thread_id": "019d2221-1ba5-75b2-b4f1-efd4440b08a4"
}
```

Takeaway:

- `session_meta.payload.id` is the in-file session ID
- `session_meta.payload.source == "cli"` indicates a root session
- `session_meta.payload.source.subagent.thread_spawn` indicates a spawned child session
- the child carries its own parent link via `parent_thread_id`

### 2. Canonical conversation content comes from `event_msg`

The formatter parser rule held up under direct inspection.

For the child session, this probe:

```bash
jq -cr '
  select(.type=="event_msg" and .payload.type=="user_message")
  | {timestamp, message: .payload.message}
' child.jsonl | head -n 3
```

showed the actual user prompts as plain strings, not tool records or metadata wrappers.

The first result was the full spawned review request beginning with:

- `Review the mobility refresh pipeline changes in /Users/rares/housing-search...`

The second result was a later follow-up prompt:

- `ok we implemented changes based on this feedback. review it again to make sure they're addressed`

Takeaway:

- the first real user prompt is the first `event_msg.user_message`
- this is the correct source for "first prompt" and turn starts
- in the files inspected here, `event_msg.payload.message` is a string

### 3. Assistant text is duplicated in `response_item.message`

For the child session, these two probes:

```bash
jq -cr '
  select(.type=="event_msg" and .payload.type=="agent_message")
  | [.timestamp, .payload.phase, .payload.message]
  | @tsv
' child.jsonl | tail -n 1
```

and

```bash
jq -cr '
  select(.type=="response_item" and .payload.type=="message" and .payload.role=="assistant")
  | [.timestamp, .payload.phase, (.payload.content[0].text // .payload.content[0].text.lines[0]? // "")]
  | @tsv
' child.jsonl | tail -n 1
```

returned the same final answer content with nearly identical timestamps.

Takeaway:

- `event_msg.agent_message` is the canonical assistant stream
- `response_item.message role="assistant"` is duplicate assistant content
- use `event_msg` for normal chat retrieval

### 4. A session can contain multiple `final_answer` messages

This probe:

```bash
jq -cr '
  select(.type=="response_item" and .payload.type=="message" and .payload.role=="assistant")
  | {timestamp, phase: .payload.phase}
' child.jsonl | tail -n 8
```

showed:

- several `commentary` messages
- one `final_answer` at `2026-03-24T23:35:32.224Z`
- more commentary later
- another `final_answer` at `2026-03-24T23:55:35.424Z`

Takeaway:

- "last assistant message" and "last final answer" are different queries
- a CLI should support `--phase final_answer`

### 5. Tool calls live in `response_item`, not `event_msg`

Tool traffic was found in `response_item.payload.type`, not in `event_msg`.

For the child session, this count probe:

```bash
jq -r '
  select(
    .type=="response_item"
    and (
      .payload.type=="function_call"
      or .payload.type=="custom_tool_call"
      or .payload.type=="web_search_call"
      or .payload.type=="function_call_output"
      or .payload.type=="custom_tool_call_output"
      or .payload.type=="web_search_call_output"
    )
  )
  | .payload.type
' child.jsonl | sort | uniq -c
```

returned:

```text
71 function_call
71 function_call_output
6 web_search_call
```

For the parent session, the same probe returned:

```text
4 custom_tool_call
4 custom_tool_call_output
108 function_call
108 function_call_output
1 web_search_call
```

Takeaway:

- the formatter's existing tool-call counting rule matches observed reality
- tool-call counts should include `function_call`, `custom_tool_call`, and `web_search_call`
- tool outputs are separate records

### 6. Tool names vary, but tool record types are stable

For the child session, this probe:

```bash
jq -cr '
  select(.type=="response_item" and .payload.type=="function_call")
  | .payload.name
' child.jsonl | sort | uniq -c
```

returned:

```text
67 exec_command
4 write_stdin
```

For the parent session, the same style probe returned:

```text
93 exec_command
2 spawn_agent
2 wait_agent
11 write_stdin
```

Takeaway:

- normalize by record type first
- use the function name for interpretation only after you have already identified a tool-call record

### 7. `spawn_agent` output is the clean parent-to-child bridge

This parent-session probe:

```bash
jq -cr '
  select(.type=="response_item" and .payload.type=="function_call" and .payload.name=="spawn_agent")
  | {
      timestamp,
      call_id: .payload.call_id,
      arguments: (
        .payload.arguments
        | fromjson
        | {message, model, reasoning_effort, fork_context, agent_type}
      )
    }
' parent.jsonl | head -n 3
```

showed the dispatch prompt and spawn settings.

Then this probe:

```bash
jq -cr '
  select(.type=="response_item" and .payload.type=="function_call_output" and .payload.call_id=="call_TRKcckJJmU1kyIKAwVpq8onx")
  | .payload.output
  | fromjson
' parent.jsonl
```

returned:

```json
{
  "agent_id": "019d222b-f7a3-7160-8f05-775a9121935a",
  "nickname": "Poincare"
}
```

Takeaway:

- `spawn_agent` call ID joins directly to the matching `function_call_output`
- the output gives you the child session ID and nickname
- the parsed arguments give you the dispatch prompt

### 8. `wait_agent` output is a structured completion ledger

This probe:

```bash
jq -cr '
  select(.type=="response_item" and .payload.type=="function_call_output" and .payload.call_id=="call_SlHUwu9lWo7MP5mF7B9yZiti")
  | .payload.output
  | fromjson
' parent.jsonl
```

returned a JSON object shaped like:

```json
{
  "status": {
    "019d222b-f7a3-7160-8f05-775a9121935a": {
      "completed": "..."
    }
  },
  "timed_out": false
}
```

Takeaway:

- `wait_agent.arguments.ids[]` tells you which children were being waited on
- `wait_agent` output gives per-child completion status keyed by agent ID

### 9. Parent-side subagent notifications are hidden in `response_item.message role="user"`

This was the biggest discovery not covered by the formatter's current parser.

This parent-session probe:

```bash
jq -cr '
  select(.type=="response_item" and (.payload.type=="function_call" or .payload.type=="function_call_output" or .payload.type=="message"))
  | {
      timestamp,
      type: .payload.type,
      name: .payload.name,
      role: .payload.role,
      call_id: .payload.call_id,
      output: .payload.output,
      first_text: (.payload.content[0].text // .payload.content[0].text.lines[0]? // null)
    }
' parent.jsonl | rg 'spawn_agent|wait_agent|subagent_notification|019d222b-f7a3-7160-8f05-775a9121935a|Poincare'
```

showed:

- `spawn_agent`
- matching `function_call_output`
- `wait_agent`
- matching `function_call_output`
- a `response_item.message role="user"` whose text starts with `<subagent_notification>`

This count probe:

```bash
jq -cr '
  select(.type=="response_item" and .payload.type=="message" and .payload.role=="user")
  | .payload.content[0].text
' parent.jsonl | rg '^<subagent_notification>' -c
```

returned:

```text
2
```

Takeaway:

- parent-side subagent notifications are not `event_msg`
- they need explicit parsing from `response_item.message role="user"`
- they are structured and reliable enough to support a synthetic `subagent_notification` event in the CLI

### 10. `response_item.message role="user"` contains multiple categories

This parent-session probe:

```bash
jq -cr '
  select(.type=="response_item" and .payload.type=="message" and .payload.role=="user")
  | {
      timestamp,
      phase: .payload.phase,
      text: (.payload.content[0].text // .payload.content[0].text.lines[0]? // null)
    }
' parent.jsonl | head -n 10
```

showed at least three distinct classes of user-role response items:

- injected repo/context material such as AGENTS instructions
- actual user prompts
- `<subagent_notification>` wrappers

Takeaway:

- do not treat every `response_item.message role="user"` as a conversational user message
- for normal chat reconstruction, use `event_msg.user_message`
- use `response_item.message role="user"` only for targeted special cases like subagent notifications

### 11. Raw text corpus searches can produce false positives

One recon pass used a broad `rg` search for strings like `resume_session_id` across `~/.codex/sessions`.

That search produced hits, but those hits were not confirmed live lineage objects. Some came from `function_call_output` blobs where a prior session had printed source code containing those field names.

Takeaway:

- raw text search across the corpus is useful for discovery, but not for structural confirmation
- when validating whether a field truly exists in live session objects, prefer structural `jq` queries over `rg`
- treat `resume_session_id` and `conversation_id` as provisional until a structural query finds them in a real session object

## Bacon's Research Summary

Bacon's direct-read summary lined up with the manual `jq` checks:

- `session_meta.payload.id` is the in-file session identity anchor
- root sessions show `source: "cli"`
- child sessions show `source.subagent.thread_spawn`
- `spawn_agent` output contains `agent_id` and `nickname`
- `wait_agent` output is keyed by child agent ID
- parent-side subagent notifications arrive as `response_item.message role="user"`

One clarification after the manual probes:

- in the example sessions inspected here, the canonical user prompt in `event_msg.user_message` is a plain string
- structured `content` arrays showed up in `response_item.message`, not in `event_msg.user_message`

So for prompt extraction, the safest rule is still:

- use `event_msg.user_message` first
- only fall back to `response_item.message role="user"` when you are doing targeted investigation rather than ordinary chat parsing

## Repeatable Recon Recipes

The following recipes are the ones worth reusing on future JSONL investigations.

Replace `file.jsonl`, `parent.jsonl`, and `child.jsonl` with real file paths.

### Show session identity and lineage

```bash
jq -cr '
  select(.type=="session_meta")
  | {
      id: .payload.id,
      source: .payload.source,
      agent_nickname: .payload.agent_nickname,
      parent_thread_id: .payload.source.subagent.thread_spawn.parent_thread_id
    }
' file.jsonl
```

Use this first on any new file.

### Show the first real user prompt

```bash
jq -cr '
  select(.type=="event_msg" and .payload.type=="user_message")
  | .payload.message
' file.jsonl | head -n 1
```

Use this when you need the session kickoff prompt.

### Show all canonical assistant messages with phase

```bash
jq -cr '
  select(.type=="event_msg" and .payload.type=="agent_message")
  | {timestamp, phase: .payload.phase, message: .payload.message}
' file.jsonl
```

Use this when you need to understand the assistant timeline.

### Show the last canonical assistant message

```bash
jq -cr '
  select(.type=="event_msg" and .payload.type=="agent_message")
  | [.timestamp, .payload.phase, .payload.message]
  | @tsv
' file.jsonl | tail -n 1
```

### Show the last assistant `final_answer`

```bash
jq -cr '
  select(.type=="event_msg" and .payload.type=="agent_message" and .payload.phase=="final_answer")
  | [.timestamp, .payload.message]
  | @tsv
' file.jsonl | tail -n 1
```

### Count tool-call and tool-output record types

```bash
jq -r '
  select(
    .type=="response_item"
    and (
      .payload.type=="function_call"
      or .payload.type=="custom_tool_call"
      or .payload.type=="web_search_call"
      or .payload.type=="function_call_output"
      or .payload.type=="custom_tool_call_output"
      or .payload.type=="web_search_call_output"
    )
  )
  | .payload.type
' file.jsonl | sort | uniq -c
```

Use this when validating tool-call counts.

### Count function names inside `function_call`

```bash
jq -cr '
  select(.type=="response_item" and .payload.type=="function_call")
  | .payload.name
' file.jsonl | sort | uniq -c
```

Use this to understand which tools dominate a session.

### Structurally probe for fork or resume lineage fields

```bash
jq -cr '
  .. | objects
  | select(
      has("resume_session_id")
      or has("resumeSessionId")
      or has("conversation_id")
      or has("conversationId")
    )
  | {
      resume_session_id,
      resumeSessionId,
      conversation_id,
      conversationId,
      keys: keys
    }
' file.jsonl
```

Use this instead of raw `rg` when you need to confirm whether a live session object actually carries fork or resume lineage fields.

### Inspect `spawn_agent` calls

```bash
jq -cr '
  select(.type=="response_item" and .payload.type=="function_call" and .payload.name=="spawn_agent")
  | {
      timestamp,
      call_id: .payload.call_id,
      args: (.payload.arguments | fromjson)
    }
' parent.jsonl
```

Use this to recover dispatch prompts and spawn settings.

### Resolve a specific `spawn_agent` output

```bash
jq -cr '
  select(.type=="response_item" and .payload.type=="function_call_output" and .payload.call_id=="CALL_ID_HERE")
  | .payload.output
  | fromjson
' parent.jsonl
```

Use this to recover child session ID and nickname.

### Inspect `wait_agent` calls

```bash
jq -cr '
  select(.type=="response_item" and .payload.type=="function_call" and .payload.name=="wait_agent")
  | {
      timestamp,
      call_id: .payload.call_id,
      args: (.payload.arguments | fromjson)
    }
' parent.jsonl
```

Use this to see which child IDs the parent waited on.

### Resolve a specific `wait_agent` output

```bash
jq -cr '
  select(.type=="response_item" and .payload.type=="function_call_output" and .payload.call_id=="CALL_ID_HERE")
  | .payload.output
  | fromjson
' parent.jsonl
```

Use this to see completion status keyed by child agent ID.

### Extract subagent notifications from the parent session

```bash
jq -cr '
  select(.type=="response_item" and .payload.type=="message" and .payload.role=="user")
  | {
      timestamp,
      text: (.payload.content[0].text // "")
    }
  | select(.text | startswith("<subagent_notification>"))
' parent.jsonl
```

Use this when you suspect the parent session contains subagent completion notifications.

### Inspect all user-role response messages

```bash
jq -cr '
  select(.type=="response_item" and .payload.type=="message" and .payload.role=="user")
  | {
      timestamp,
      phase: .payload.phase,
      text: (.payload.content[0].text // "")
    }
' file.jsonl
```

Use this when you need to separate:

- context injection
- real prompts
- synthetic system notifications

## Interpreting Results Safely

### Prefer `event_msg` for normal conversation reconstruction

Use `event_msg` for:

- user messages
- assistant messages
- thoughts
- token-count timeline

### Prefer `response_item` for the tool ledger

Use `response_item` for:

- tool calls
- tool outputs
- spawn and wait behavior
- parent-side subagent notifications

### Expect JSON-encoded strings inside arguments and outputs

A common pattern is:

- `.payload.arguments` is a JSON string
- `.payload.output` is a JSON string

That is why many probes use `fromjson`.

### Be careful with raw text searches across the session corpus

`function_call_output.output` can contain source code, markdown, or terminal output captured from earlier work. A plain `rg` over the whole corpus can therefore find field names that only exist inside captured command output rather than inside the session's structured JSON objects.

### Do not assume all user-role records are the real user prompt

Especially in parent sessions, `response_item.message role="user"` can include:

- injected repo context
- actual user prompts
- subagent notifications

Use `event_msg.user_message` for canonical prompt reconstruction.

### Do not assume one final answer per session

Sessions can span multiple turns. If you need the latest closeout specifically, filter by `phase == "final_answer"`.

## Recon Workflow Recommendation

When probing a new JSONL file, use this order:

1. Run the `session_meta` identity probe.
2. Run the first-user-message probe.
3. Run the canonical assistant-message probe.
4. Run the tool-type count probe.
5. If it is a parent session, inspect `spawn_agent`, `wait_agent`, and subagent notifications.
6. If it is a child session, inspect `parent_thread_id`, nickname, and last assistant message.

This order keeps the investigation grounded and prevents random probing.

## What This Means For The CLI

These recon results support a concrete implementation strategy:

- base message retrieval should use `event_msg`
- tool counts should use the formatter's existing `response_item` classification
- subagent support requires a new graph layer on top of the current parser
- parent-side subagent notifications must be modeled as a special-case synthetic event
- `--index -1` should operate after filtering by role and phase

## Summary

The important knowledge transfer from the recon work is this:

- `session_meta` tells you who the session is
- `event_msg` tells you what the conversation said
- `response_item` tells you what the model and tools did
- `spawn_agent` and `wait_agent` tell you how parent and child sessions are linked
- `<subagent_notification>` is the hidden parent-side signal the current formatter does not yet parse

If you follow the recipes in this file, you should be able to inspect an unfamiliar Codex JSONL session without guessing at the shape.
