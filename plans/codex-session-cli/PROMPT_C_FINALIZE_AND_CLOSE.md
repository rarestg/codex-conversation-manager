# Prompt C: Finalize And Close

Use this prompt only when the implementation plan says the remaining work is final verification, polish, or closeout.

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

Then inspect only the code paths relevant to the implementation being finalized. The default starting set is:
- `/Users/rares/GITHUB/ARTIFACTS/codex-formatter/server/sessionDetail/parser.ts`
- `/Users/rares/GITHUB/ARTIFACTS/codex-formatter/src/features/conversation/parsing.ts`
- `/Users/rares/GITHUB/ARTIFACTS/codex-formatter/shared/sessionMetrics.ts`
- `/Users/rares/GITHUB/ARTIFACTS/codex-formatter/server/indexing/index.ts`
- `/Users/rares/GITHUB/ARTIFACTS/codex-formatter/package.json`

Goal:

Do the final verification and closeout pass for Codex Session CLI. Confirm the acceptance criteria, run final validation, clean up any remaining high-signal issues, and update the plan docs so the work can be considered complete.

Required delegation:

- You must dispatch at least one independent final-review subagent before declaring the work complete.
- If that review surfaces meaningful issues, dispatch an implementation subagent for any approved fixes when useful.
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
  - the acceptance criteria to verify

Required process:

1. Read the plan and handoff docs fully.
2. Claim the current pass in `SHARED_HANDOFF.md`.
3. Run the final independent review subagent.
4. Compare the current implementation against every acceptance item in `IMPLEMENTATION_EXECPLAN.md`.
5. Fix only the remaining meaningful issues.
6. Re-run final validation.
7. Update:
  - `IMPLEMENTATION_EXECPLAN.md`
  - `SHARED_HANDOFF.md`
  - any user-facing docs if the final behavior differs from the current spec or recon text
8. In your final response, summarize:
  - whether the implementation is complete
  - any residual risks
  - exact validation run
  - subagents used and what they found

Guardrails:

- If the review finds material unfinished work, do not force completion. Document the gap and hand back to Prompt A or Prompt B.
- Do not leave the plan or handoff stale.
- Make sure the final implemented behavior is still aligned with the spec or that the spec is updated to match reality.

Validation baseline:

- `npm run typecheck`
- `npm run check`
- `npm run mdlint -- plans/codex-session-cli/*.md`
- run the chosen CLI entrypoint against the real sample parent and child sessions in both normal and JSON output modes
```
