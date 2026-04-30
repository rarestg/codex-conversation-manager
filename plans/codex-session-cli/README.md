# Codex Session CLI Plan Set

Date: 2026-03-25

This folder now contains the full planning and handoff set for implementing Codex Session CLI.

Use these files in this order:

1. `SPEC.md`
2. `JSONL_RECON_GUIDE.md`
3. `IMPLEMENTATION_EXECPLAN.md`
4. `SHARED_HANDOFF.md`
5. one of the worker prompt files

## File Map

- `SPEC.md`
  - Product and architecture spec.
- `JSONL_RECON_GUIDE.md`
  - Raw JSONL recon findings, `jq` recipes, and interpretation rules.
- `IMPLEMENTATION_EXECPLAN.md`
  - Living implementation plan with milestones, validation, and acceptance criteria.
- `SHARED_HANDOFF.md`
  - Shared notes log that every worker must update before stopping.
- `PROMPT_A_IMPLEMENT_NEXT_MILESTONE.md`
  - Use this for an implementation pass.
- `PROMPT_B_REVIEW_AND_ADVANCE.md`
  - Use this for a review-and-fix pass.
- `PROMPT_C_FINALIZE_AND_CLOSE.md`
  - Use this for the final verification and closeout pass.

## Recommended Loop

Start with Prompt A.

Then alternate:

1. Prompt A for implementation progress.
2. Prompt B for review, hardening, and gap closure.

Repeat that loop until the implementation plan says only final verification or closeout work remains.

Then use Prompt C.

## Current Status

Codex Session CLI v1 is closed out locally.

The only known non-blocking gaps are live `wait_agent` `timed_out: true` samples and live fork or resume lineage samples. The parser keeps best-effort support for `resume_session_id` and `conversation_id`, but v1 acceptance does not depend on a confirmed fixture for those shapes.

No additional worker is needed for the current v1 scope. Reuse the prompt loop in this folder only if future follow-up work resumes.

Implementation workers should read the docs in this folder first, then inspect the relevant code paths for the milestone they are taking. The default starting set is:

- `scripts/codex-session-cli.ts`
- `shared/codex-session/types.ts`
- `shared/codex-session/parseCore.ts`
- `shared/codex-session/sessionGraph.ts`
- `shared/codex-session/locator.ts`
- `server/sessionDetail/parser.ts`
- `src/features/conversation/parsing.ts`
- `shared/sessionMetrics.ts`
- `package.json`

If workers add committed fixtures, they should use minimized or redacted data rather than raw personal session logs from `~/.codex/sessions`.

## Worker Rules

All workers using this plan set should follow these rules:

- Do not read unrelated docs from other `plans/` folders.
- Read the docs in this folder first, plus `AGENTS.md`.
- After reading the docs, inspect only the code paths relevant to the milestone instead of wandering the repo broadly.
- Keep `IMPLEMENTATION_EXECPLAN.md` and `SHARED_HANDOFF.md` current.
- Delegate when useful instead of doing everything serially.
- Any delegated subagent must use:
  - `fork_context: false`
  - model: `gpt-5.5`
  - reasoning: `xhigh`
- If a worker waits on a delegated `gpt-5.5` `xhigh` subagent, use at least a 30-minute wait window:
  - `timeout_ms >= 1800000`
- Every subagent must receive explicit scope, file ownership or review scope, expected output, and relevant context from the docs in this folder.

## Exit Discipline

No worker should stop without updating:

- `IMPLEMENTATION_EXECPLAN.md`
- `SHARED_HANDOFF.md`

The goal is that a fresh worker can pick up from those two files plus the spec and recon guide without having to infer missing context from chat history.
