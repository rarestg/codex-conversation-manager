import type { ComponentType } from 'react';
import { formatCompactCount } from '../format';
import type { SessionDetails, SessionFileEntry, Turn } from '../types';
import { SessionHeader } from './SessionHeader';
import { Toggle } from './Toggle';

interface SessionStats {
  thoughtCount: number;
  toolCallCount: number;
  metaCount: number;
  tokenCount: number;
}

type SessionHeaderComponent = ComponentType<{
  activeSession: SessionFileEntry | null;
  sessionDetails: SessionDetails;
  sessionsRoot: string;
  visibleItemCount: number;
  stats: SessionStats;
  filteredTurns: Turn[];
  headerClassName?: string;
  titleClassName?: string;
  metaGridClassName?: string;
  statsRowClassName?: string;
  actionsClassName?: string;
}>;

interface CompactToggleProps {
  label: string;
  checked: boolean;
  count?: number | string;
  onChange: (checked: boolean) => void;
}

const CompactToggle = ({ label, checked, count, onChange }: CompactToggleProps) => (
  <label className="group chip chip-md chip-filled chip-shadow gap-2 py-1.5 text-xs text-slate-700 leading-none transition hover:border-slate-300">
    <span className="font-medium text-slate-900">{label}</span>
    {count !== undefined && (
      <span className="chip-count">
        <span className="chip-count-text">{count}</span>
      </span>
    )}
    <span className="relative inline-flex h-4 w-8 shrink-0 items-center overflow-hidden rounded-full">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span className="absolute inset-0 rounded-full bg-slate-200 transition-colors peer-checked:bg-teal-600" />
      <span className="absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-4" />
    </span>
  </label>
);

export interface SessionOverviewProps {
  activeSession: SessionFileEntry | null;
  sessionDetails: SessionDetails;
  sessionsRoot: string;
  filteredTurns: Turn[];
  visibleItemCount: number;
  stats: SessionStats;
  showThoughts: boolean;
  showTools: boolean;
  showMeta: boolean;
  showTokenCounts: boolean;
  showFullContent: boolean;
  onShowThoughtsChange: (value: boolean) => void;
  onShowToolsChange: (value: boolean) => void;
  onShowMetaChange: (value: boolean) => void;
  onShowTokenCountsChange: (value: boolean) => void;
  onShowFullContentChange: (value: boolean) => void;
  variantLabel?: string;
  variantHint?: string;
  HeaderComponent?: SessionHeaderComponent;
  toggleVariant?: 'default' | 'compact';
  showToggleCountsWhenOff?: boolean;
  containerClassName?: string;
  headerClassName?: string;
  titleClassName?: string;
  metaGridClassName?: string;
  statsRowClassName?: string;
  actionsClassName?: string;
  toggleGridClassName?: string;
}

export const SessionOverview = ({
  activeSession,
  sessionDetails,
  sessionsRoot,
  filteredTurns,
  visibleItemCount,
  stats,
  showThoughts,
  showTools,
  showMeta,
  showTokenCounts,
  showFullContent,
  onShowThoughtsChange,
  onShowToolsChange,
  onShowMetaChange,
  onShowTokenCountsChange,
  onShowFullContentChange,
  variantLabel,
  variantHint,
  HeaderComponent = SessionHeader,
  toggleVariant = 'default',
  showToggleCountsWhenOff = false,
  containerClassName,
  headerClassName,
  titleClassName,
  metaGridClassName,
  statsRowClassName,
  actionsClassName,
  toggleGridClassName,
}: SessionOverviewProps) => {
  const mergedContainerClassName = [
    'rounded-3xl border border-white/70 bg-white/80 p-6 shadow-card backdrop-blur',
    containerClassName,
  ]
    .filter(Boolean)
    .join(' ');
  const isCompactToggleLayout = toggleVariant === 'compact';
  const toggleGridClassNameMerged = [
    isCompactToggleLayout ? 'flex flex-wrap items-center gap-2' : 'grid gap-3 md:grid-cols-2 xl:grid-cols-5',
    toggleGridClassName,
  ]
    .filter(Boolean)
    .join(' ');
  const thoughtCount = showToggleCountsWhenOff ? stats.thoughtCount : undefined;
  const toolCount = showToggleCountsWhenOff ? stats.toolCallCount : undefined;
  const metaCount = showToggleCountsWhenOff ? stats.metaCount : undefined;
  const tokenCount = showToggleCountsWhenOff ? formatCompactCount(stats.tokenCount) : undefined;

  const hasVariantHeader = Boolean(variantLabel || variantHint);

  return (
    <section className={mergedContainerClassName}>
      {hasVariantHeader && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {variantLabel ? (
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">{variantLabel}</p>
          ) : (
            <span />
          )}
          {variantHint && <span className="text-xs text-slate-400">{variantHint}</span>}
        </div>
      )}
      <div className={[hasVariantHeader ? 'mt-4' : null, 'flex flex-col gap-3'].filter(Boolean).join(' ')}>
        <HeaderComponent
          activeSession={activeSession}
          sessionDetails={sessionDetails}
          sessionsRoot={sessionsRoot}
          visibleItemCount={visibleItemCount}
          stats={stats}
          filteredTurns={filteredTurns}
          headerClassName={headerClassName}
          titleClassName={titleClassName}
          metaGridClassName={metaGridClassName}
          statsRowClassName={statsRowClassName}
          actionsClassName={actionsClassName}
        />

        <div className={toggleGridClassNameMerged}>
          {isCompactToggleLayout ? (
            <>
              <CompactToggle
                label="Thoughts"
                checked={showThoughts}
                count={thoughtCount}
                onChange={onShowThoughtsChange}
              />
              <CompactToggle label="Tools" checked={showTools} count={toolCount} onChange={onShowToolsChange} />
              <CompactToggle
                label="Token counts"
                checked={showTokenCounts}
                count={tokenCount}
                onChange={onShowTokenCountsChange}
              />
              <CompactToggle label="Metadata" checked={showMeta} count={metaCount} onChange={onShowMetaChange} />
              <CompactToggle label="Full content" checked={showFullContent} onChange={onShowFullContentChange} />
            </>
          ) : (
            <>
              <Toggle
                label="Thoughts"
                description="Include agent reasoning inline."
                checked={showThoughts}
                onChange={onShowThoughtsChange}
              />
              <Toggle
                label="Tools"
                description="Tool calls and outputs inline."
                checked={showTools}
                onChange={onShowToolsChange}
              />
              <Toggle
                label="Token counts"
                description="token_count telemetry entries."
                checked={showTokenCounts}
                onChange={onShowTokenCountsChange}
              />
              <Toggle
                label="Metadata"
                description="turn_context and session_meta."
                checked={showMeta}
                onChange={onShowMetaChange}
              />
              <Toggle
                label="Full content"
                description="Disable truncation for long messages."
                checked={showFullContent}
                onChange={onShowFullContentChange}
              />
            </>
          )}
        </div>
      </div>
    </section>
  );
};
