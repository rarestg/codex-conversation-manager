import {
  CalendarClock,
  Clock,
  Copy,
  Eye,
  Folder,
  GitBranch,
  Github,
  Hash,
  Hourglass,
  Minus,
  Repeat2,
} from 'lucide-react';
import { buildConversationExport } from '../copy';
import {
  formatCompactCount,
  formatDuration,
  formatDurationMs,
  formatRelativeTime,
  formatRepoFallbackPath,
  formatTimestamp,
  formatWorkspacePath,
  isSameDay,
} from '../format';
import { useRenderDebug } from '../hooks/useRenderDebug';
import type { SessionDetails, SessionFileEntry, Turn } from '../types';
import { CopyButton } from './CopyButton';

interface SessionStats {
  thoughtCount: number;
  toolCallCount: number;
  metaCount: number;
  tokenCount: number;
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
    totalTokenCounts: stats.tokenCount,
  });

  const sessionId = sessionDetails.sessionId || activeSession?.sessionId;
  const cwd = sessionDetails.cwd;
  const rawTitle = activeSession?.preview?.trim() || activeSession?.filename || 'Session viewer';
  const title = rawTitle.replace(/\s+/g, ' ').trim();
  const now = new Date();
  const timeSource = activeSession?.startedAt ?? activeSession?.timestamp ?? '';
  const timeLabel = timeSource && isSameDay(timeSource, now) ? formatRelativeTime(timeSource, now) : '';
  const timestampLabel = timeSource ? formatTimestamp(timeSource, false) : 'Select a session to start.';
  const durationLabel = activeSession
    ? formatDurationMs(activeSession.activeDurationMs) || formatDuration(activeSession.startedAt, activeSession.endedAt)
    : '';
  const tokenCount = activeSession?.tokenCount ?? stats.tokenCount;
  const tokenCountLabel =
    tokenCount === null || tokenCount === undefined
      ? visibleItemCount > 0
        ? formatCompactCount(stats.tokenCount)
        : '—'
      : formatCompactCount(tokenCount);
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
    return formatRepoFallbackPath(cwdValue);
  };
  // Note: if a session hasn't been indexed yet, activeSession.cwd may be null even when
  // sessionDetails.cwd exists, so the repo fallback can show "no repo" until indexing fills it.
  const repoLabel = activeSession ? getRepoLabel(activeSession.gitRepo, activeSession.cwd) : null;
  const isRepoFromGit = Boolean(activeSession?.gitRepo?.trim());
  const headerClassNameMerged = ['space-y-3', headerClassName].filter(Boolean).join(' ');
  const titleClassNameMerged = ['text-xl text-slate-900 leading-snug line-clamp-2', titleClassName]
    .filter(Boolean)
    .join(' ');
  const metaGridClassNameMerged = ['flex flex-col gap-2', metaGridClassName].filter(Boolean).join(' ');
  const statsRowClassNameMerged = ['flex flex-wrap items-center gap-2 text-xs text-slate-600', statsRowClassName]
    .filter(Boolean)
    .join(' ');
  const actionsClassNameMerged = ['flex items-center gap-2', actionsClassName].filter(Boolean).join(' ');
  const subtitleItemClassName = 'chip chip-md gap-1 text-slate-500';
  const subtitleButtonClassName = `${subtitleItemClassName} chip-button`;
  const subtitleLabelWrapperClassName = 'min-w-0 flex-1';
  const subtitleLabelClassName = 'min-w-0 truncate';

  const timeNode = (
    <CopyButton
      text={timestampLabel}
      idleLabel={timestampLabel}
      hoverLabel={null}
      ariaLabel="Copy session timestamp"
      title={timestampLabel}
      leading={<CalendarClock className="h-3.5 w-3.5" />}
      labelWrapperClassName={subtitleLabelWrapperClassName}
      labelClassName={subtitleLabelClassName}
      className={subtitleButtonClassName}
      disabled={!timeSource}
    />
  );
  const RepoIcon = isRepoFromGit ? Github : Folder;
  const repoTitle = (activeSession?.gitRepo ?? repoLabel) || '';
  const repoNode = repoLabel ? (
    <CopyButton
      text={repoLabel}
      idleLabel={repoLabel}
      hoverLabel={null}
      ariaLabel="Copy repo"
      title={repoTitle}
      leading={<RepoIcon className="h-3.5 w-3.5" />}
      labelWrapperClassName={subtitleLabelWrapperClassName}
      labelClassName={subtitleLabelClassName}
      className={subtitleButtonClassName}
    />
  ) : (
    <span className={`${subtitleItemClassName} chip-left text-slate-400`}>
      <Minus className="h-3.5 w-3.5" />
      <span className={subtitleLabelClassName}>no repo</span>
    </span>
  );
  const branchNode = activeSession?.gitBranch ? (
    <CopyButton
      text={activeSession.gitBranch}
      idleLabel={activeSession.gitBranch}
      hoverLabel={null}
      ariaLabel="Copy branch"
      title={activeSession.gitBranch}
      leading={<GitBranch className="h-3.5 w-3.5" />}
      labelWrapperClassName={subtitleLabelWrapperClassName}
      labelClassName={subtitleLabelClassName}
      className={subtitleButtonClassName}
    />
  ) : (
    <span className={`${subtitleItemClassName} chip-left text-slate-400`}>
      <Minus className="h-3.5 w-3.5" />
      <span className={subtitleLabelClassName}>no branch</span>
    </span>
  );

  const renderMetaRow = (label: string, displayValue: string, copyValue: string, ariaLabel: string) => (
    <CopyButton
      text={copyValue}
      idleLabel={displayValue}
      reserveLabel={displayValue}
      ariaLabel={ariaLabel}
      title={copyValue}
      leading={label}
      leadingClassName="meta-label"
      labelWrapperClassName="min-w-0 flex-1"
      labelClassName="meta-value"
      className="meta-row"
    />
  );

  return (
    <div className={headerClassNameMerged}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 w-full flex flex-col gap-3">
          <h2 className={titleClassNameMerged} title={title}>
            {title}
          </h2>
          <div className="flex w-full items-center text-xs text-slate-500">
            <div className="flex-1" />
            <div className="min-w-0">{timeNode}</div>
            <div className="flex justify-center px-2 text-slate-300" style={{ flex: '2 1 0%' }}>
              •
            </div>
            <div className="min-w-0">{repoNode}</div>
            <div className="flex justify-center px-2 text-slate-300" style={{ flex: '2 1 0%' }}>
              •
            </div>
            <div className="min-w-0">{branchNode}</div>
            <div className="flex-1" />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className={statsRowClassNameMerged}>
          {timeLabel && (
            <span className="chip chip-sm chip-filled gap-1">
              <Clock className="h-3.5 w-3.5" />
              <span className="chip-value">{timeLabel}</span>
            </span>
          )}
          {durationLabel && (
            <span className="chip chip-sm chip-filled gap-1">
              <Hourglass className="h-3.5 w-3.5" />
              <span className="chip-value">{durationLabel}</span>
            </span>
          )}
          {activeSession?.turnCount !== null && activeSession?.turnCount !== undefined && (
            <span className="chip chip-sm chip-filled gap-1">
              <Repeat2 className="h-3.5 w-3.5" />
              <span className="chip-value">{activeSession.turnCount}</span>
              <span>turns</span>
            </span>
          )}
          {activeSession && (
            <span className="chip chip-sm chip-filled gap-1">
              <Hash className="h-3.5 w-3.5" />
              <span className="chip-value">{tokenCountLabel}</span>
              <span>token counts</span>
            </span>
          )}
          {activeSession && (
            <span className="chip chip-sm chip-filled gap-1">
              <Eye className="h-3.5 w-3.5" />
              <span className="chip-value">{visibleItemCount}</span>
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
