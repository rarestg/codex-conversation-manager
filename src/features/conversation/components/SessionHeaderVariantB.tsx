import { Clock, Copy, Eye, GitBranch, Github, Hourglass, Repeat2 } from 'lucide-react';
import { buildConversationExport } from '../copy';
import { formatDuration, formatRelativeTime, formatTimestamp, formatWorkspacePath, isSameDay } from '../format';
import { useRenderDebug } from '../hooks/useRenderDebug';
import type { SessionDetails, SessionFileEntry, Turn } from '../types';
import { CopyButton } from './CopyButton';

interface SessionStats {
  thoughtCount: number;
  toolCallCount: number;
  metaCount: number;
}

interface SessionHeaderVariantBProps {
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
}

export const SessionHeaderVariantB = ({
  activeSession,
  sessionDetails,
  sessionsRoot,
  visibleItemCount,
  stats,
  filteredTurns,
  headerClassName,
  titleClassName,
  metaGridClassName,
  statsRowClassName,
  actionsClassName,
}: SessionHeaderVariantBProps) => {
  useRenderDebug('SessionHeaderVariantB', {
    activeSessionId: activeSession?.id ?? null,
    sessionId: sessionDetails.sessionId ?? null,
    cwd: sessionDetails.cwd ?? null,
    visibleItemCount,
    filteredTurnCount: filteredTurns.length,
    totalThoughts: stats.thoughtCount,
    totalTools: stats.toolCallCount,
    totalMeta: stats.metaCount,
  });

  const sessionId = sessionDetails.sessionId || activeSession?.sessionId;
  const cwd = sessionDetails.cwd;
  const rawTitle = activeSession?.preview?.trim() || activeSession?.filename || 'Session viewer';
  const title = rawTitle.replace(/\s+/g, ' ').trim();
  const now = new Date();
  const timeSource = activeSession?.startedAt ?? activeSession?.timestamp ?? '';
  const timeLabel = timeSource && isSameDay(timeSource, now) ? formatRelativeTime(timeSource, now) : '';
  const timestampLabel = timeSource ? formatTimestamp(timeSource, false) : 'Select a session to start.';
  const durationLabel = activeSession ? formatDuration(activeSession.startedAt, activeSession.endedAt) : '';
  const sessionRoot = sessionsRoot?.trim() || '';
  const fallbackId = activeSession?.id ?? '';
  const pathSeparator = sessionRoot.includes('\\') ? '\\' : sessionRoot ? '/' : fallbackId.includes('\\') ? '\\' : '/';
  const trimmedRoot = sessionRoot.replace(/[\\/]+$/, '');
  const normalizedRoot = trimmedRoot || (/^[\\/]+$/.test(sessionRoot) ? pathSeparator : '');
  const normalizedId = activeSession?.id ? activeSession.id.replace(/[\\/]+/g, pathSeparator) : '';
  const rootJoiner = normalizedRoot && normalizedRoot !== pathSeparator ? pathSeparator : '';
  const filePath =
    activeSession && normalizedRoot && normalizedId ? `${normalizedRoot}${rootJoiner}${normalizedId}` : normalizedId;
  const getRepoLabel = (gitRepo?: string | null, cwdValue?: string | null) => {
    if (gitRepo) {
      const cleaned = gitRepo.replace(/\.git$/i, '');
      const parts = cleaned.split(/[/:]/).filter(Boolean);
      if (parts.length >= 2) {
        return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
      }
      return cleaned;
    }
    if (!cwdValue) return null;
    const trimmed = cwdValue.trim();
    if (!trimmed) return null;
    const parts = trimmed.split(/[\\/]/).filter(Boolean);
    return parts[parts.length - 1] ?? null;
  };
  const repoLabel = activeSession ? getRepoLabel(activeSession.gitRepo, activeSession.cwd) : null;
  const headerClassNameMerged = ['space-y-4', headerClassName].filter(Boolean).join(' ');
  const titleClassNameMerged = ['text-xl text-slate-900 leading-snug line-clamp-2', titleClassName]
    .filter(Boolean)
    .join(' ');
  const metaGridClassNameMerged = ['flex flex-col gap-2', metaGridClassName].filter(Boolean).join(' ');
  const statsRowClassNameMerged = ['flex flex-wrap items-center gap-2 text-xs text-slate-600', statsRowClassName]
    .filter(Boolean)
    .join(' ');
  const actionsClassNameMerged = ['flex items-center gap-2', actionsClassName].filter(Boolean).join(' ');

  const timeNode = timestampLabel ? <span className="min-w-0 truncate">{timestampLabel}</span> : <span />;
  const repoNode = repoLabel ? (
    <CopyButton
      text={repoLabel}
      idleLabel={repoLabel}
      reserveLabel={repoLabel}
      ariaLabel="Copy repo"
      title={repoLabel}
      leading={<Github className="h-3.5 w-3.5" />}
      labelWrapperClassName="min-w-0"
      labelClassName="min-w-0 truncate"
      className="inline-flex min-w-0 items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
    />
  ) : (
    <span className="truncate text-slate-400">no repo</span>
  );
  const branchNode = activeSession?.gitBranch ? (
    <CopyButton
      text={activeSession.gitBranch}
      idleLabel={activeSession.gitBranch}
      reserveLabel={activeSession.gitBranch}
      ariaLabel="Copy branch"
      title={activeSession.gitBranch}
      leading={<GitBranch className="h-3.5 w-3.5" />}
      labelWrapperClassName="min-w-0"
      labelClassName="min-w-0 truncate"
      className="inline-flex min-w-0 items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
    />
  ) : (
    <span className="truncate text-slate-400">no branch</span>
  );

  const renderMetaRow = (label: string, displayValue: string, copyValue: string, ariaLabel: string) => (
    <CopyButton
      text={copyValue}
      idleLabel={displayValue}
      reserveLabel={displayValue}
      ariaLabel={ariaLabel}
      title={copyValue}
      leading={label}
      leadingClassName="w-16 shrink-0 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400"
      labelWrapperClassName="min-w-0 flex-1"
      labelClassName="min-w-0 truncate text-xs text-slate-700"
      className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white/70 px-3 py-2 text-left"
    />
  );

  return (
    <div className={headerClassNameMerged}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 w-full">
          <h2 className={`${titleClassNameMerged} mb-1`} title={title}>
            {title}
          </h2>
          <div className="mt-3 flex w-full items-center text-xs text-slate-500">
            {timeNode}
            <div className="flex-1 px-2 text-center text-slate-300">•</div>
            {repoNode}
            <div className="flex-1 px-2 text-center text-slate-300">•</div>
            {branchNode}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className={statsRowClassNameMerged}>
          {timeLabel && (
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/70 px-2 py-1 text-[11px] text-slate-600">
              <Clock className="h-3.5 w-3.5" />
              <span className="tabular-nums">{timeLabel}</span>
            </span>
          )}
          {durationLabel && (
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/70 px-2 py-1 text-[11px] text-slate-600">
              <Hourglass className="h-3.5 w-3.5" />
              <span className="tabular-nums">{durationLabel}</span>
            </span>
          )}
          {activeSession?.turnCount !== null && activeSession?.turnCount !== undefined && (
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/70 px-2 py-1 text-[11px] text-slate-600">
              <Repeat2 className="h-3.5 w-3.5" />
              <span className="tabular-nums">{activeSession.turnCount}</span>
              <span>turns</span>
            </span>
          )}
          {activeSession && (
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/70 px-2 py-1 text-[11px] text-slate-600">
              <Eye className="h-3.5 w-3.5" />
              <span className="tabular-nums">{visibleItemCount}</span>
              <span>visible</span>
            </span>
          )}
        </div>
        <div className={actionsClassNameMerged}>
          <CopyButton
            getText={() => buildConversationExport(filteredTurns)}
            idleLabel="Copy conversation"
            hoverLabel="Copy conversation"
            reserveLabel="Copy conversation"
            duration={2000}
            disabled={!visibleItemCount}
            ariaLabel="Copy conversation"
            leading={<Copy className="h-3.5 w-3.5" />}
            centerLabel
            labelClassName="text-center"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900 disabled:opacity-50"
          />
        </div>
      </div>

      {(sessionId || cwd || activeSession?.filename || activeSession) && (
        <div className={metaGridClassNameMerged}>
          {sessionId && renderMetaRow('Session', sessionId, sessionId, 'Copy session id')}
          {cwd && renderMetaRow('Dir', formatWorkspacePath(cwd), cwd, 'Copy session directory')}
          {activeSession?.filename &&
            renderMetaRow('File', activeSession.filename, filePath || activeSession.filename, 'Copy session file path')}
        </div>
      )}
    </div>
  );
};
