import type { CSSProperties } from 'react';
import { isRenderDebugEnabled } from '../debug';
import { formatJsonValue, MAX_PREVIEW_CHARS } from '../format';
import { buildTokenCountExport, formatTokenValue, parseTokenCountEntry } from '../tokenCounts';
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
  const contextUsedTokens = parsed?.contextUsedTokens ?? null;
  const contextWindow = parsed?.contextWindowSize ?? null;
  const contextPercent = parsed?.contextUsagePercent ?? null;
  const lastUsage = parsed?.lastUsage ?? null;
  const cacheHitRate = lastUsage?.cacheHitRate ?? null;
  const contextDetail =
    contextUsedTokens !== null && contextWindow !== null
      ? `${formatMaybe(contextUsedTokens)} / ${formatMaybe(contextWindow)} tokens`
      : undefined;

  const formatWindowMinutes = (minutes?: number | null) => {
    if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) return null;
    if (minutes >= 1440 && minutes % 1440 === 0) return `${minutes / 1440}d`;
    if (minutes >= 60 && minutes % 60 === 0) return `${minutes / 60}h`;
    return `${Math.round(minutes)}m`;
  };
  const buildRateLimitLabel = (label: string, percent?: number | null, windowMinutes?: number | null) => {
    if (percent === null || percent === undefined || !Number.isFinite(percent)) return null;
    const windowLabel = formatWindowMinutes(windowMinutes);
    return windowLabel
      ? `${label} ${formatPercentLabel(percent)} (${windowLabel})`
      : `${label} ${formatPercentLabel(percent)}`;
  };
  const usageParts: Array<{ key: string; text: string }> = [
    { key: 'input', text: `Input ${formatMaybe(lastUsage?.inputTokens)}` },
    {
      key: 'cached',
      text: `Cached ${formatMaybe(lastUsage?.cachedTokens)}${
        cacheHitRate !== null && Number.isFinite(cacheHitRate) ? ` (${Math.round(cacheHitRate * 100)}% hit)` : ''
      }`,
    },
    { key: 'output', text: `Output ${formatMaybe(lastUsage?.outputTokens)}` },
    { key: 'reasoning', text: `Reasoning ${formatMaybe(lastUsage?.reasoningTokens)}` },
  ];
  const primarySummary = buildRateLimitLabel(
    'Primary',
    parsed?.rateLimits.primary?.usedPercent ?? null,
    parsed?.rateLimits.primary?.windowMinutes ?? null,
  );
  const secondarySummary = buildRateLimitLabel(
    'Secondary',
    parsed?.rateLimits.secondary?.usedPercent ?? null,
    parsed?.rateLimits.secondary?.windowMinutes ?? null,
  );
  const limitParts: Array<{ key: string; text: string }> = [];
  if (primarySummary) limitParts.push({ key: 'primary', text: primarySummary });
  if (secondarySummary) limitParts.push({ key: 'secondary', text: secondarySummary });

  return (
    <div
      className="animate-stagger rounded-2xl border border-slate-200/70 bg-slate-50/80 px-4 py-4 text-sm text-slate-800 shadow-sm"
      style={{ '--stagger-delay': `${itemIndex * 40}ms` } as CSSProperties}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">Token Count</p>
        </div>
        <CopyButton
          getText={async () => tokenExport || rawContent}
          idleLabel="Copy"
          hoverLabel="Copy"
          ariaLabel="Copy token count content"
          className="chip chip-lg chip-filled chip-shadow chip-button !border-white/70 font-medium"
        />
      </div>

      {parsed ? (
        <div className="mt-3 space-y-3">
          <MeterBar
            label="Context window"
            percent={contextPercent}
            detail={contextDetail}
            colorClassName="bg-teal-500"
          />
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
            <div className="chip-segmented">
              <span className="flex items-center bg-slate-500 px-2.5 text-[10px] font-medium text-white">Usage</span>
              <span className="flex flex-wrap items-center px-2.5 py-1">
                {usageParts.map((part, index) => (
                  <span key={part.key} className="inline-flex items-center">
                    {index > 0 && <span className="mx-1.5 text-slate-300">·</span>}
                    <span>{part.text}</span>
                  </span>
                ))}
              </span>
            </div>
            {limitParts.length > 0 && (
              <div className="chip-segmented">
                <span className="flex items-center bg-slate-500 px-2.5 text-[10px] font-medium text-white">Limits</span>
                <span className="flex flex-wrap items-center px-2.5 py-1">
                  {limitParts.map((part, index) => (
                    <span key={part.key} className="inline-flex items-center">
                      {index > 0 && <span className="mx-1.5 text-slate-300">·</span>}
                      <span>{part.text}</span>
                    </span>
                  ))}
                </span>
              </div>
            )}
          </div>
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
