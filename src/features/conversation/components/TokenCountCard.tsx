import type { CSSProperties } from 'react';
import { isRenderDebugEnabled } from '../debug';
import { formatJsonValue, MAX_PREVIEW_CHARS } from '../format';
import { buildTokenCountExport, formatCreditsSummary, formatTokenValue, parseTokenCountEntry } from '../tokenCounts';
import type { ParsedItem } from '../types';
import { CopyButton } from './CopyButton';

interface TokenCountCardProps {
  item: ParsedItem;
  itemIndex: number;
  showFullContent: boolean;
}

const formatMaybe = (value?: number | null) => formatTokenValue(value) || '--';

const formatPercentLabel = (value?: number | null) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '--';
  return `${Math.round(value)}%`;
};

const MeterBar = ({
  label,
  percent,
  detail,
  colorClassName,
}: {
  label: string;
  percent: number | null;
  detail?: string;
  colorClassName: string;
}) => {
  if (percent === null || percent === undefined || !Number.isFinite(percent)) return null;
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="tabular-nums">{formatPercentLabel(clamped)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full ${colorClassName}`} style={{ width: `${clamped}%` }} />
      </div>
      {detail && <div className="text-[11px] text-slate-500">{detail}</div>}
    </div>
  );
};

export const TokenCountCard = ({ item, itemIndex, showFullContent }: TokenCountCardProps) => {
  if (isRenderDebugEnabled && itemIndex === 0) {
    console.debug('[render] TokenCountCard', { id: item.id, type: item.type });
  }
  const parsed = parseTokenCountEntry(item.raw ?? item.content);
  const rawContent = formatJsonValue(item.raw ?? item.content) || item.content || '';
  const tokenExport = buildTokenCountExport(item.raw ?? item.content);
  const truncated =
    !showFullContent && rawContent.length > MAX_PREVIEW_CHARS
      ? `${rawContent.slice(0, MAX_PREVIEW_CHARS)}...`
      : rawContent;
  const totalTokens = parsed?.totalUsage?.totalTokens ?? null;
  const contextWindow = parsed?.contextWindowSize ?? null;
  const contextPercent = parsed?.contextUsagePercent ?? null;
  const lastUsage = parsed?.lastUsage ?? null;
  const cacheHitRate = lastUsage?.cacheHitRate ?? null;
  const cacheHitLabel =
    cacheHitRate !== null && Number.isFinite(cacheHitRate) ? `${Math.round(cacheHitRate * 100)}% hit rate` : '--';
  const contextDetail =
    totalTokens !== null && contextWindow !== null
      ? `${formatMaybe(totalTokens)} / ${formatMaybe(contextWindow)} tokens`
      : undefined;

  const primaryLimit = parsed?.rateLimits.primary ?? null;
  const secondaryLimit = parsed?.rateLimits.secondary ?? null;
  const creditsSummary = parsed ? formatCreditsSummary(parsed.rateLimits.credits, parsed.rateLimits.planType) : null;
  const showRateLimits = Boolean(primaryLimit || secondaryLimit || creditsSummary);

  return (
    <div
      className="animate-stagger rounded-2xl border border-slate-200/70 bg-slate-50/80 px-4 py-4 text-sm text-slate-800 shadow-sm"
      style={{ '--stagger-delay': `${itemIndex * 40}ms` } as CSSProperties}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">Token Count</p>
          {totalTokens !== null && (
            <p className="mt-1 text-xs text-slate-500">
              Total: <span className="font-semibold text-slate-700">{formatMaybe(totalTokens)}</span>
            </p>
          )}
        </div>
        <CopyButton
          getText={async () => tokenExport || rawContent}
          idleLabel="Copy"
          hoverLabel="Copy"
          ariaLabel="Copy token count content"
          className="rounded-full border border-white/70 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm"
        />
      </div>

      {parsed ? (
        <div className="mt-4 space-y-4">
          <MeterBar
            label="Context window"
            percent={contextPercent}
            detail={contextDetail}
            colorClassName="bg-teal-500"
          />

          <div className="rounded-2xl border border-slate-200 bg-white/70 p-3">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Last turn</div>
            <div className="mt-2 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
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
            </div>
            <div className="mt-2 text-[11px] text-slate-500">Cache efficiency: {cacheHitLabel}</div>
          </div>

          {showRateLimits && (
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Rate limits</div>
              {primaryLimit && (
                <MeterBar
                  label={`Primary${primaryLimit.windowMinutes ? ` (${primaryLimit.windowMinutes}m)` : ''}`}
                  percent={primaryLimit.usedPercent ?? null}
                  colorClassName="bg-indigo-500"
                />
              )}
              {secondaryLimit && (
                <MeterBar
                  label={`Secondary${secondaryLimit.windowMinutes ? ` (${secondaryLimit.windowMinutes}m)` : ''}`}
                  percent={secondaryLimit.usedPercent ?? null}
                  colorClassName="bg-amber-500"
                />
              )}
              {creditsSummary && <div className="text-[11px] text-slate-500">{creditsSummary}</div>}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white/70 p-3 text-xs text-slate-500">
          Token usage unavailable. Raw payload:
          <pre className="mt-2 whitespace-pre-wrap break-words text-[11px] text-slate-600">{truncated || '--'}</pre>
        </div>
      )}
    </div>
  );
};
