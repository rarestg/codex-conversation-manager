# Prompt A: Implement The Next Milestone

Use this prompt for the first implementation pass and for later implementation passes whenever there is still milestone work left to do.

## Copy-Paste Prompt

```text
You are working in `/Users/rares/GITHUB/ARTIFACTS/codex-formatter`.

Do not read unrelated docs from other `plans/` folders. Stay within the docs in `plans/codex-session-cli/` plus `AGENTS.md`.

Read these first:
- `/Users/rares/GITHUB/ARTIFACTS/codex-formatter/AGENTS.md`
- `/Users/rares/GITHUB/ARTIFACTS/codex-formatter/plans/codex-session-cli/README.md`
- `/Users/rares/GITHUB/ARTIFACTS/codex-formatter/plans/codex-session-cli/SPEC.md`
- `/Users/rares/GITHUB/ARTIFACTS/codex-formatter/plans/codex-session-cli/JSONL_RECON_GUIDE.md`
- `/Users/rares/GITHUB/ARTIFACTS/codex-formatter/plans/codex-session-cli/IMPLEMENTATION_EXECPLAN.md`
- `/Users/rares/GITHUB/ARTIFACTS/codex-formatter/plans/codex-session-cli/SHARED_HANDOFF.md`

Then inspect only the code paths relevant to the milestone you are taking. The default starting set is:
- `/Users/rares/GITHUB/ARTIFACTS/codex-formatter/server/sessionDetail/parser.ts`
- `/Users/rares/GITHUB/ARTIFACTS/codex-formatter/src/features/conversation/parsing.ts`
- `/Users/rares/GITHUB/ARTIFACTS/codex-formatter/shared/sessionMetrics.ts`
- `/Users/rares/GITHUB/ARTIFACTS/codex-formatter/server/indexing/index.ts`
- `/Users/rares/GITHUB/ARTIFACTS/codex-formatter/package.json`

Goal:

Advance the next incomplete milestone for Codex Session CLI. Do not stop at analysis. Pick the highest-priority incomplete milestone from `IMPLEMENTATION_EXECPLAN.md`, implement it end-to-end, validate it, and update the plan docs before you stop.

Required delegation:

- You are expected to use subagents when they are useful.
- If the milestone can be split into disjoint work, dispatch one or more implementation or research subagents.
- Even if you keep the main implementation local, dispatch at least one independent read-only review or targeted recon subagent before finalizing your pass.
- Every delegated subagent must use:
  - `fork_context: false`
  - model: `gpt-5.4`
  - reasoning_effort: `xhigh`
- If you wait on a delegated `gpt-5.4` `xhigh` subagent, use at least a 30 minute wait:
  - `timeout_ms >= 1800000`
- Give every subagent ample context. Include:
  - the purpose of Codex Session CLI
  - the relevant docs from `plans/codex-session-cli/`
  - the exact file scope it owns or reviews
  - what result you expect back
  - any constraints or invariants
- If you delegate code changes, give disjoint ownership and tell workers they are not alone in the codebase.

Required process:

1. Read the plan and handoff docs fully.
2. Claim the current pass in `SHARED_HANDOFF.md`.
3. If the CLI entrypoint decision is still open, make the decision now and record it in both `IMPLEMENTATION_EXECPLAN.md` and `SHARED_HANDOFF.md`.
4. Implement the next incomplete milestone.
5. Run the relevant validation commands.
6. Update:
  - `IMPLEMENTATION_EXECPLAN.md`
  - `SHARED_HANDOFF.md`
7. In your final response, summarize:
  - what you changed
  - what validation passed or failed
  - what subagents you used and what they found
  - what remains open
  - whether the next worker should use Prompt B or Prompt C

Guardrails:

- Preserve the formatter's existing canonical parsing rules unless the plan explicitly says otherwise.
- Do not introduce a second unrelated parser if the existing parser can be extracted and reused.
- Treat `event_msg` as canonical conversation content.
- Treat parent-side `<subagent_notification>` as a special-case graph event, not a normal user message.
- Do not overbuild dedicated graph semantics for `send_input`, `resume_agent`, or `close_agent` unless a milestone or newly observed sample proves they are required.
- If you add committed fixtures, use minimized or redacted data rather than raw personal session logs from `~/.codex/sessions`.
- If you discover a better file layout than the preferred one in the plan, update the plan and handoff docs immediately so future workers stay aligned.

Validation baseline:

- `npm run typecheck`
- `npm run check`
- `npm run mdlint -- plans/codex-session-cli/*.md` if you changed docs

Use the real sample sessions from the plan when validating CLI behavior.
```
