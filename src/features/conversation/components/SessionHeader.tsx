import {
  Brain,
  Clock,
  Copy,
  Eye,
  Folder,
  GitBranch,
  Github,
  Hash,
  Hourglass,
  Info,
  Repeat2,
  Wrench,
} from 'lucide-react';
import { buildConversationExport } from '../copy';
import {
  formatCompactCount,
  formatDuration,
  formatDurationMs,
  formatRelativeTime,
  formatRepoFallbackPath,
  formatTime,
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

interface SessionHeaderProps {
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

export const SessionHeader = ({
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
}: SessionHeaderProps) => {
  useRenderDebug('SessionHeader', {
    activeSessionId: activeSession?.id ?? null,
    sessionId: sessionDetails.sessionId ?? null,
    cwd: sessionDetails.cwd ?? null,
    visibleItemCount,
    filteredTurnCount: filteredTurns.length,
  });

  const sessionId = sessionDetails.sessionId || activeSession?.sessionId;
  const cwd = sessionDetails.cwd;
  const rawTitle = activeSession?.preview?.trim() || activeSession?.filename || 'Session viewer';
  const title = rawTitle.replace(/\s+/g, ' ').trim();
  const now = new Date();
  const timeSource = activeSession?.startedAt ?? activeSession?.timestamp ?? '';
  const timeLabel = timeSource
    ? isSameDay(timeSource, now)
      ? formatRelativeTime(timeSource, now)
      : formatTime(timeSource)
    : '';
  const durationLabel = activeSession
    ? formatDurationMs(activeSession.activeDurationMs) || formatDuration(activeSession.startedAt, activeSession.endedAt)
    : '';
  const durationDisplay = durationLabel || (timeSource ? '-' : '');
  const thoughtCount = activeSession?.thoughtCount ?? stats.thoughtCount;
  const toolCallCount = activeSession?.toolCallCount ?? stats.toolCallCount;
  const metaCount = activeSession?.metaCount ?? stats.metaCount;
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
  const repoLabel = activeSession ? getRepoLabel(activeSession.gitRepo, activeSession.cwd) : null;
  const isRepoFromGit = Boolean(activeSession?.gitRepo?.trim());
  const RepoIcon = isRepoFromGit ? Github : Folder;
  const repoTitle = (activeSession?.gitRepo ?? repoLabel) || '';
  const headerClassNameMerged = ['flex flex-wrap items-start justify-between gap-4', headerClassName]
    .filter(Boolean)
    .join(' ');
  const titleClassNameMerged = ['text-xl text-slate-900 truncate', titleClassName].filter(Boolean).join(' ');
  const metaGridClassNameMerged = ['grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-3', metaGridClassName]
    .filter(Boolean)
    .join(' ');
  const statsRowClassNameMerged = ['flex flex-wrap items-center gap-2 text-[11px] text-slate-500', statsRowClassName]
    .filter(Boolean)
    .join(' ');
  const actionsClassNameMerged = ['flex items-center gap-3', actionsClassName].filter(Boolean).join(' ');

  const renderMetaChip = (label: string, displayValue: string, copyValue: string, ariaLabel: string) => (
    <CopyButton
      text={copyValue}
      idleLabel={displayValue}
      reserveLabel={displayValue}
      ariaLabel={ariaLabel}
      title={copyValue}
      leading={label}
      leadingClassName="chip-label"
      labelWrapperClassName="min-w-0 flex-1"
      labelClassName="chip-value"
      className="chip text-left"
    />
  );

  return (
    <div className={headerClassNameMerged}>
      <div className="min-w-0 space-y-3">
        <h2 className={titleClassNameMerged} title={title}>
          {title}
        </h2>
        <p className="text-xs text-slate-500">
          {activeSession?.startedAt || activeSession?.timestamp
            ? formatTimestamp(activeSession.startedAt ?? activeSession.timestamp, false)
            : 'Select a session to start.'}
        </p>
        {(sessionId || cwd || activeSession?.filename) && (
          <div className={metaGridClassNameMerged}>
            {sessionId && renderMetaChip('Session', sessionId, sessionId, 'Copy session id')}
            {cwd && renderMetaChip('Dir', formatWorkspacePath(cwd), cwd, 'Copy session directory')}
            {activeSession?.filename &&
              renderMetaChip(
                'File',
                activeSession.filename,
                filePath || activeSession.filename,
                'Copy session file path',
              )}
          </div>
        )}
        {activeSession && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
              {timeLabel && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1.5 text-[11px]/[14px] text-slate-600 shadow-sm">
                  <Clock className="h-3.5 w-3.5" />
                  <span className="translate-y-[0.5px] inline-block min-w-[7ch] text-center tabular-nums">
                    {timeLabel}
                  </span>
                </span>
              )}
              {timeSource && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1.5 text-[11px]/[14px] text-slate-600 shadow-sm">
                  <Hourglass className="h-3.5 w-3.5" />
                  <span className="translate-y-[0.5px] inline-block min-w-[6ch] text-center tabular-nums">
                    {durationDisplay}
                  </span>
                </span>
              )}
              {activeSession.turnCount !== null && activeSession.turnCount !== undefined && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1.5 text-[11px]/[14px] text-slate-600 shadow-sm">
                  <Repeat2 className="h-3.5 w-3.5" />
                  <span className="translate-y-[0.5px] inline-block min-w-[4ch] text-center tabular-nums">
                    {activeSession.turnCount}
                  </span>
                </span>
              )}
              {repoLabel && (
                <CopyButton
                  text={repoLabel}
                  idleLabel={repoLabel}
                  reserveLabel={repoLabel}
                  ariaLabel="Copy repo"
                  title={repoTitle}
                  leading={<RepoIcon className="h-3.5 w-3.5" />}
                  labelWrapperClassName="min-w-0"
                  labelClassName="min-w-0 truncate"
                  className="inline-flex min-w-0 items-center gap-1 rounded-full bg-white px-2.5 py-1.5 text-[11px] leading-none text-slate-600 shadow-sm"
                />
              )}
              {activeSession.gitBranch && (
                <CopyButton
                  text={activeSession.gitBranch}
                  idleLabel={activeSession.gitBranch}
                  reserveLabel={activeSession.gitBranch}
                  ariaLabel="Copy branch"
                  title={activeSession.gitBranch}
                  leading={<GitBranch className="h-3.5 w-3.5" />}
                  labelWrapperClassName="min-w-0"
                  labelClassName="min-w-0 truncate"
                  className="inline-flex min-w-0 items-center gap-1 rounded-full bg-white px-2.5 py-1.5 text-[11px] leading-none text-slate-600 shadow-sm"
                />
              )}
            </div>
            <div className={statsRowClassNameMerged}>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1.5 text-[11px]/[14px] text-slate-600 shadow-sm">
                <Brain className="h-3.5 w-3.5" />
                <span className="translate-y-[0.5px] inline-block min-w-[4ch] text-center tabular-nums">
                  {thoughtCount}
                </span>
                <span className="translate-y-[0.5px]">thoughts</span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1.5 text-[11px]/[14px] text-slate-600 shadow-sm">
                <Wrench className="h-3.5 w-3.5" />
                <span className="translate-y-[0.5px] inline-block min-w-[4ch] text-center tabular-nums">
                  {toolCallCount}
                </span>
                <span className="translate-y-[0.5px]">tools</span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1.5 text-[11px]/[14px] text-slate-600 shadow-sm">
                <Info className="h-3.5 w-3.5" />
                <span className="translate-y-[0.5px] inline-block min-w-[4ch] text-center tabular-nums">
                  {metaCount}
                </span>
                <span className="translate-y-[0.5px]">meta</span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1.5 text-[11px]/[14px] text-slate-600 shadow-sm">
                <Hash className="h-3.5 w-3.5" />
                <span className="translate-y-[0.5px] inline-block min-w-[4ch] text-center tabular-nums">
                  {tokenCountLabel}
                </span>
                <span className="translate-y-[0.5px]">token counts</span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1.5 text-[11px]/[14px] text-slate-600 shadow-sm">
                <Eye className="h-3.5 w-3.5" />
                <span className="translate-y-[0.5px] inline-block min-w-[4ch] text-center tabular-nums">
                  {visibleItemCount}
                </span>
                <span className="translate-y-[0.5px]">visible</span>
              </span>
            </div>
          </div>
        )}
      </div>
      <div className={actionsClassNameMerged}>
        <CopyButton
          getText={() => buildConversationExport(filteredTurns)}
          duration={2000}
          disabled={!visibleItemCount}
          idleLabel="Copy conversation"
          hoverLabel="Copy conversation"
          reserveLabel="Copy conversation"
          ariaLabel="Copy conversation"
          leading={<Copy className="h-3.5 w-3.5" />}
          className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900 disabled:opacity-50"
        />
      </div>
    </div>
  );
};
