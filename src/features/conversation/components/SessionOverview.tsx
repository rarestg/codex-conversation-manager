import type { SessionDetails, SessionFileEntry, Turn } from '../types';
import { SessionHeader } from './SessionHeader';
import { Toggle } from './Toggle';

interface SessionStats {
  thoughtCount: number;
  toolCallCount: number;
  metaCount: number;
}

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
  showFullContent: boolean;
  onShowThoughtsChange: (value: boolean) => void;
  onShowToolsChange: (value: boolean) => void;
  onShowMetaChange: (value: boolean) => void;
  onShowFullContentChange: (value: boolean) => void;
  variantLabel?: string;
  variantHint?: string;
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
  showFullContent,
  onShowThoughtsChange,
  onShowToolsChange,
  onShowMetaChange,
  onShowFullContentChange,
  variantLabel,
  variantHint,
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
  const toggleGridClassNameMerged = ['mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4', toggleGridClassName]
    .filter(Boolean)
    .join(' ');

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
      <div className={hasVariantHeader ? 'mt-4' : undefined}>
        <SessionHeader
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
            label="Metadata"
            description="turn_context, session_meta, token_count."
            checked={showMeta}
            onChange={onShowMetaChange}
          />
          <Toggle
            label="Full content"
            description="Disable truncation for long messages."
            checked={showFullContent}
            onChange={onShowFullContentChange}
          />
        </div>
      </div>
    </section>
  );
};
