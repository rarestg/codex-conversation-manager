import { findLastTokenCountItem, formatCreditsSummary, formatTokenValue, parseTokenCountEntry } from '../tokenCounts';
import type { CanvasContext } from './types';

const formatMaybe = (value?: number | null) => formatTokenValue(value) || '--';

const formatPercentLabel = (value?: number | null) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '--';
  return `${Math.round(value)}%`;
};

const TokenCountEmptyState = () => (
  <div className="rounded-3xl border border-dashed border-slate-200 bg-white/70 px-6 py-8 text-center text-sm text-slate-500">
    No token_count entries found in this session.
  </div>
);

export const TokenCountVariantA = ({ context }: { context: CanvasContext }) => {
  const tokenItem = findLastTokenCountItem(context.turns);
  const parsed = parseTokenCountEntry(tokenItem?.raw ?? tokenItem?.content);
  if (!parsed) return <TokenCountEmptyState />;

  const totalTokens = parsed.totalUsage?.totalTokens ?? null;
  const contextUsedTokens = parsed.contextUsedTokens ?? null;
  const contextWindow = parsed.contextWindowSize ?? null;
  const contextPercent = parsed.contextUsagePercent ?? null;
  const lastUsage = parsed.lastUsage ?? null;
  const cacheHitRate = lastUsage?.cacheHitRate ?? null;
  const cacheHitLabel =
    cacheHitRate !== null && Number.isFinite(cacheHitRate) ? `${Math.round(cacheHitRate * 100)}% hit rate` : '--';
  const creditsSummary = formatCreditsSummary(parsed.rateLimits.credits, parsed.rateLimits.planType);
  const showRateLimits = Boolean(parsed.rateLimits.primary || parsed.rateLimits.secondary || creditsSummary);

  return (
    <section className="rounded-3xl border border-white/80 bg-white/80 p-6 shadow-card backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-teal-700">Token Count</p>
          <h3 className="mt-2 text-lg text-slate-900">Telemetry snapshot</h3>
          {totalTokens !== null && (
            <p className="mt-1 text-xs text-slate-500">
              Total (cumulative): <span className="font-semibold text-slate-700">{formatMaybe(totalTokens)}</span>
            </p>
          )}
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] text-slate-500">Last event</span>
      </div>

      <div className="mt-4 space-y-4">
        <div>
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-medium text-slate-700">Context window</span>
            <span className="tabular-nums">{formatPercentLabel(contextPercent)}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full bg-teal-500" style={{ width: `${contextPercent ?? 0}%` }} />
          </div>
          {contextUsedTokens !== null && contextWindow !== null && (
            <div className="mt-1 text-[11px] text-slate-500">
              {formatMaybe(contextUsedTokens)} / {formatMaybe(contextWindow)} tokens
            </div>
          )}
        </div>

        <div className="grid gap-2 rounded-2xl border border-slate-100 bg-white/70 p-3 text-xs text-slate-600 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-2">
            <span>Input</span>
            <span className="font-semibold text-slate-700">{formatMaybe(lastUsage?.inputTokens)}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span>Cached</span>
            <span className="font-semibold text-slate-700">{formatMaybe(lastUsage?.cachedTokens)}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span>Output</span>
            <span className="font-semibold text-slate-700">{formatMaybe(lastUsage?.outputTokens)}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span>Reasoning</span>
            <span className="font-semibold text-slate-700">{formatMaybe(lastUsage?.reasoningTokens)}</span>
          </div>
          <div className="sm:col-span-2 text-[11px] text-slate-500">Cache efficiency: {cacheHitLabel}</div>
        </div>

        {showRateLimits && (
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Rate limits</div>
            {parsed.rateLimits.primary && (
              <div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-medium text-slate-700">
                    Primary
                    {parsed.rateLimits.primary.windowMinutes ? ` (${parsed.rateLimits.primary.windowMinutes}m)` : ''}
                  </span>
                  <span className="tabular-nums">
                    {formatPercentLabel(parsed.rateLimits.primary.usedPercent ?? null)}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full bg-indigo-500"
                    style={{ width: `${parsed.rateLimits.primary.usedPercent ?? 0}%` }}
                  />
                </div>
              </div>
            )}
            {parsed.rateLimits.secondary && (
              <div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-medium text-slate-700">
                    Secondary
                    {parsed.rateLimits.secondary.windowMinutes
                      ? ` (${parsed.rateLimits.secondary.windowMinutes}m)`
                      : ''}
                  </span>
                  <span className="tabular-nums">
                    {formatPercentLabel(parsed.rateLimits.secondary.usedPercent ?? null)}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full bg-amber-500"
                    style={{ width: `${parsed.rateLimits.secondary.usedPercent ?? 0}%` }}
                  />
                </div>
              </div>
            )}
            {creditsSummary && <div className="text-[11px] text-slate-500">{creditsSummary}</div>}
          </div>
        )}
      </div>
    </section>
  );
};

export const TokenCountVariantB = ({ context }: { context: CanvasContext }) => {
  const tokenItem = findLastTokenCountItem(context.turns);
  const parsed = parseTokenCountEntry(tokenItem?.raw ?? tokenItem?.content);
  if (!parsed) return <TokenCountEmptyState />;

  const contextUsedTokens = parsed.contextUsedTokens ?? null;
  const contextWindow = parsed.contextWindowSize ?? null;
  const contextPercent = parsed.contextUsagePercent ?? null;
  const lastUsage = parsed.lastUsage ?? null;
  const creditsSummary = formatCreditsSummary(parsed.rateLimits.credits, parsed.rateLimits.planType);
  const showRateLimits = Boolean(parsed.rateLimits.primary || parsed.rateLimits.secondary || creditsSummary);

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900 px-6 py-5 text-slate-100 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Tokens & Limits</p>
          <h3 className="mt-2 text-lg font-semibold text-white">System dashboard</h3>
        </div>
        <span className="rounded-full border border-slate-700 px-3 py-1 text-[11px] text-slate-300">
          Session snapshot
        </span>
      </div>

      <div className="mt-4 space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span className="uppercase tracking-[0.2em]">Context window</span>
            <span className="tabular-nums">{formatPercentLabel(contextPercent)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full bg-cyan-400" style={{ width: `${contextPercent ?? 0}%` }} />
          </div>
          {contextUsedTokens !== null && contextWindow !== null && (
            <div className="text-[11px] text-slate-400">
              {formatMaybe(contextUsedTokens)} / {formatMaybe(contextWindow)} tokens
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-800/60 p-3 text-xs">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-slate-400">
            <span>Last turn efficiency</span>
            <span className="tabular-nums">
              {lastUsage?.cacheHitRate !== null && lastUsage?.cacheHitRate !== undefined
                ? `${Math.round(lastUsage.cacheHitRate * 100)}% cached`
                : '--'}
            </span>
          </div>
          <div className="mt-2 grid gap-2 text-slate-200 sm:grid-cols-2">
            <div className="flex items-center justify-between gap-2">
              <span>Input</span>
              <span className="font-semibold">{formatMaybe(lastUsage?.inputTokens)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>Cached</span>
              <span className="font-semibold">{formatMaybe(lastUsage?.cachedTokens)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>Output</span>
              <span className="font-semibold">{formatMaybe(lastUsage?.outputTokens)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>Reasoning</span>
              <span className="font-semibold">{formatMaybe(lastUsage?.reasoningTokens)}</span>
            </div>
          </div>
        </div>

        {showRateLimits && (
          <div className="space-y-3">
            <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Rate limits</div>
            {parsed.rateLimits.primary && (
              <div>
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span>
                    Primary
                    {parsed.rateLimits.primary.windowMinutes ? ` (${parsed.rateLimits.primary.windowMinutes}m)` : ''}
                  </span>
                  <span className="tabular-nums">
                    {formatPercentLabel(parsed.rateLimits.primary.usedPercent ?? null)}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full bg-indigo-400"
                    style={{ width: `${parsed.rateLimits.primary.usedPercent ?? 0}%` }}
                  />
                </div>
              </div>
            )}
            {parsed.rateLimits.secondary && (
              <div>
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span>
                    Secondary
                    {parsed.rateLimits.secondary.windowMinutes
                      ? ` (${parsed.rateLimits.secondary.windowMinutes}m)`
                      : ''}
                  </span>
                  <span className="tabular-nums">
                    {formatPercentLabel(parsed.rateLimits.secondary.usedPercent ?? null)}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full bg-amber-400"
                    style={{ width: `${parsed.rateLimits.secondary.usedPercent ?? 0}%` }}
                  />
                </div>
              </div>
            )}
            {creditsSummary && <div className="text-[11px] text-slate-400">{creditsSummary}</div>}
          </div>
        )}
      </div>
    </section>
  );
};
