import { Brain, Check, Clock, Copy, Eye, GitBranch, Github, Hourglass, Info, Repeat2, Wrench } from 'lucide-react';
import { buildConversationExport, copyText } from '../copy';
import {
  formatDuration,
  formatRelativeTime,
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
  const durationLabel = activeSession ? formatDuration(activeSession.startedAt, activeSession.endedAt) : '';
  const durationDisplay = durationLabel || (timeSource ? '-' : '');
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
  const handleCopyMeta = async (value: string) => {
    await copyText(value);
  };
  const handleCopyConversation = async () => {
    if (!visibleItemCount) return;
    const formatted = buildConversationExport(filteredTurns);
    await copyText(formatted);
  };
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
            {sessionId && (
              <div className="chip">
                <span className="chip-label">Session</span>
                <span className="chip-value" title={sessionId}>
                  {sessionId}
                </span>
                <CopyButton
                  onCopy={() => handleCopyMeta(sessionId)}
                  className="chip-action"
                  aria-label="Copy session id"
                  title="Copy session id"
                  copiedLabel={<Check className="h-3.5 w-3.5 text-emerald-600" />}
                >
                  <Copy className="h-3.5 w-3.5" />
                </CopyButton>
              </div>
            )}
            {cwd && (
              <div className="chip">
                <span className="chip-label">Dir</span>
                <span className="chip-value" title={cwd}>
                  {formatWorkspacePath(cwd)}
                </span>
                <CopyButton
                  onCopy={() => handleCopyMeta(cwd)}
                  className="chip-action"
                  aria-label="Copy session directory"
                  title="Copy session directory"
                  copiedLabel={<Check className="h-3.5 w-3.5 text-emerald-600" />}
                >
                  <Copy className="h-3.5 w-3.5" />
                </CopyButton>
              </div>
            )}
            {activeSession?.filename && (
              <div className="chip">
                <span className="chip-label">File</span>
                <span className="chip-value" title={filePath || activeSession.filename}>
                  {activeSession.filename}
                </span>
                <CopyButton
                  onCopy={() => handleCopyMeta(filePath || activeSession.filename)}
                  className="chip-action"
                  aria-label="Copy session file path"
                  title="Copy session file path"
                  copiedLabel={<Check className="h-3.5 w-3.5 text-emerald-600" />}
                >
                  <Copy className="h-3.5 w-3.5" />
                </CopyButton>
              </div>
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
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1.5 text-[11px] leading-none text-slate-600 shadow-sm">
                  <Github className="h-3.5 w-3.5" />
                  {repoLabel}
                </span>
              )}
              {activeSession.gitBranch && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1.5 text-[11px] leading-none text-slate-600 shadow-sm">
                  <GitBranch className="h-3.5 w-3.5" />
                  {activeSession.gitBranch}
                </span>
              )}
            </div>
            <div className={statsRowClassNameMerged}>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1.5 text-[11px]/[14px] text-slate-600 shadow-sm">
                <Brain className="h-3.5 w-3.5" />
                <span className="translate-y-[0.5px] inline-block min-w-[4ch] text-center tabular-nums">
                  {stats.thoughtCount}
                </span>
                <span className="translate-y-[0.5px]">thoughts</span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1.5 text-[11px]/[14px] text-slate-600 shadow-sm">
                <Wrench className="h-3.5 w-3.5" />
                <span className="translate-y-[0.5px] inline-block min-w-[4ch] text-center tabular-nums">
                  {stats.toolCallCount}
                </span>
                <span className="translate-y-[0.5px]">tools</span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1.5 text-[11px]/[14px] text-slate-600 shadow-sm">
                <Info className="h-3.5 w-3.5" />
                <span className="translate-y-[0.5px] inline-block min-w-[4ch] text-center tabular-nums">
                  {stats.metaCount}
                </span>
                <span className="translate-y-[0.5px]">meta</span>
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
          onCopy={handleCopyConversation}
          duration={2000}
          disabled={!visibleItemCount}
          className="inline-flex min-w-[170px] items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900 disabled:opacity-50"
        >
          Copy conversation
        </CopyButton>
      </div>
    </div>
  );
};
