# Prompt B: Review, Fix, And Advance

Use this prompt after an implementation pass. This is the main review and hardening prompt. Alternate Prompt A and Prompt B until only final verification remains.

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

Then inspect only the code paths relevant to the implementation under review. The default starting set is:
- `/Users/rares/GITHUB/ARTIFACTS/codex-formatter/server/sessionDetail/parser.ts`
- `/Users/rares/GITHUB/ARTIFACTS/codex-formatter/src/features/conversation/parsing.ts`
- `/Users/rares/GITHUB/ARTIFACTS/codex-formatter/shared/sessionMetrics.ts`
- `/Users/rares/GITHUB/ARTIFACTS/codex-formatter/server/indexing/index.ts`
- `/Users/rares/GITHUB/ARTIFACTS/codex-formatter/package.json`

Goal:

Review the current Codex Session CLI implementation against the spec, recon guide, and plan. Identify gaps, regressions, or brittle assumptions. Fix the issues you agree with, validate the result, and update the plan docs before you stop.

Required delegation:

- You must dispatch at least one independent read-only review subagent before you finalize your own review.
- If the review finds substantive issues, dispatch at least one implementation subagent for an approved fix when that split is useful.
- Every delegated subagent must use:
  - `fork_context: false`
  - model: `gpt-5.4`
  - reasoning_effort: `xhigh`
- If you wait on a delegated `gpt-5.4` `xhigh` subagent, use at least a 30 minute wait:
  - `timeout_ms >= 1800000`
- Give every subagent ample context. Include:
  - the Codex Session CLI purpose
  - the relevant docs from `plans/codex-session-cli/`
  - the exact file scope it owns or reviews
  - what to prioritize
  - what output you expect

Required review priorities:

- parser-correctness regressions
- wrong session-ID or parent-child linkage
- duplicate-message bugs
- incorrect tool-call counts
- incorrect `final_answer` filtering
- brittle assumptions about `response_item.message`
- CLI ergonomics or missing acceptance behavior
- missing validation coverage

Required process:

1. Read the plan and handoff docs fully.
2. Claim the current pass in `SHARED_HANDOFF.md`.
3. Run an independent review pass with a subagent.
4. Compare the implementation to the acceptance criteria in `IMPLEMENTATION_EXECPLAN.md`.
5. Fix the approved issues yourself and/or through delegated implementation workers.
6. Re-run validation.
7. Update:
  - `IMPLEMENTATION_EXECPLAN.md`
  - `SHARED_HANDOFF.md`
8. In your final response, summarize:
  - findings
  - fixes made
  - validation results
  - subagents used
  - whether the next worker should use Prompt A again or Prompt C

Guardrails:

- Do not force closeout if material gaps remain.
- If you discover a structural issue that requires more implementation work, document it clearly and hand back to Prompt A.
- Keep the shared docs current enough that a fresh worker can continue without chat history.

Validation baseline:

- `npm run typecheck`
- `npm run check`
- `npm run mdlint -- plans/codex-session-cli/*.md` if docs changed
- run the chosen CLI entrypoint against the sample sessions in the plan
```
