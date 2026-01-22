import { Brain, Check, Clock, Copy, Eye, GitBranch, Github, Hourglass, Info, Repeat2, Wrench } from 'lucide-react';
import {
  formatDuration,
  formatRelativeTime,
  formatTime,
  formatTimestamp,
  formatWorkspacePath,
  isSameDay,
} from '../format';
import type { SessionDetails, SessionFileEntry } from '../types';

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
  copiedId: string | null;
  onCopyConversation: () => void;
  onCopyMeta: (value: string, id: string) => void;
}

export const SessionHeader = ({
  activeSession,
  sessionDetails,
  sessionsRoot,
  visibleItemCount,
  stats,
  copiedId,
  onCopyConversation,
  onCopyMeta,
}: SessionHeaderProps) => {
  const sessionId = sessionDetails.sessionId;
  const cwd = sessionDetails.cwd;
  const title = activeSession?.preview?.trim() || activeSession?.filename || 'Session viewer';
  const now = new Date();
  const timeSource = activeSession?.startedAt ?? activeSession?.timestamp ?? '';
  const timeLabel = timeSource
    ? isSameDay(timeSource, now)
      ? formatRelativeTime(timeSource, now)
      : formatTime(timeSource)
    : '';
  const durationLabel = activeSession ? formatDuration(activeSession.startedAt, activeSession.endedAt) : '';
  const durationDisplay = durationLabel || (timeSource ? '0m' : '');
  const sessionRoot = sessionsRoot?.trim() || '';
  const filePath =
    activeSession && sessionRoot
      ? `${sessionRoot.replace(/[\\/]+$/, '')}/${activeSession.id}`
      : activeSession?.id || '';
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

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 space-y-3">
        <h2 className="text-xl text-slate-900 truncate" title={title}>
          {title}
        </h2>
        <p className="text-xs text-slate-500">
          {activeSession?.timestamp
            ? `Session: ${formatTimestamp(activeSession.timestamp)}`
            : 'Select a session to start.'}
        </p>
        {(sessionId || cwd || activeSession?.filename) && (
          <div className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
            {sessionId && (
              <div className="chip">
                <span className="chip-label">Session</span>
                <span className="chip-value" title={sessionId}>
                  {sessionId}
                </span>
                <button
                  type="button"
                  onClick={() => onCopyMeta(sessionId, 'session-id')}
                  className="chip-action"
                  aria-label="Copy session id"
                  title="Copy session id"
                >
                  {copiedId === 'session-id' ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            )}
            {cwd && (
              <div className="chip">
                <span className="chip-label">Dir</span>
                <span className="chip-value" title={cwd}>
                  {formatWorkspacePath(cwd)}
                </span>
                <button
                  type="button"
                  onClick={() => onCopyMeta(cwd, 'session-cwd')}
                  className="chip-action"
                  aria-label="Copy session directory"
                  title="Copy session directory"
                >
                  {copiedId === 'session-cwd' ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            )}
            {activeSession?.filename && (
              <div className="chip">
                <span className="chip-label">File</span>
                <span className="chip-value" title={filePath || activeSession.filename}>
                  {activeSession.filename}
                </span>
                <button
                  type="button"
                  onClick={() => onCopyMeta(filePath || activeSession.filename, 'session-file')}
                  className="chip-action"
                  aria-label="Copy session file path"
                  title="Copy session file path"
                >
                  {copiedId === 'session-file' ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            )}
          </div>
        )}
        {activeSession && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
              {timeLabel && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[10px]/[12px] text-slate-600 shadow-sm">
                  <Clock className="h-3 w-3" />
                  <span className="translate-y-[0.5px] inline-block min-w-[7ch] text-center tabular-nums">
                    {timeLabel}
                  </span>
                </span>
              )}
              {timeSource && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[10px]/[12px] text-slate-600 shadow-sm">
                  <Hourglass className="h-3 w-3" />
                  <span className="translate-y-[0.5px] inline-block min-w-[6ch] text-center tabular-nums">
                    {durationDisplay}
                  </span>
                </span>
              )}
              {activeSession.turnCount !== null && activeSession.turnCount !== undefined && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[10px]/[12px] text-slate-600 shadow-sm">
                  <Repeat2 className="h-3 w-3" />
                  <span className="translate-y-[0.5px] inline-block min-w-[4ch] text-center tabular-nums">
                    {activeSession.turnCount}
                  </span>
                </span>
              )}
              {repoLabel && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[10px] leading-none text-slate-600 shadow-sm">
                  <Github className="h-3 w-3" />
                  {repoLabel}
                </span>
              )}
              {activeSession.gitBranch && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[10px] leading-none text-slate-600 shadow-sm">
                  <GitBranch className="h-3 w-3" />
                  {activeSession.gitBranch}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[10px]/[12px] text-slate-600 shadow-sm">
                <Eye className="h-3 w-3" />
                <span className="translate-y-[0.5px] inline-block min-w-[4ch] text-center tabular-nums">
                  {visibleItemCount}
                </span>
                <span className="translate-y-[0.5px]">visible</span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[10px]/[12px] text-slate-600 shadow-sm">
                <Brain className="h-3 w-3" />
                <span className="translate-y-[0.5px] inline-block min-w-[4ch] text-center tabular-nums">
                  {stats.thoughtCount}
                </span>
                <span className="translate-y-[0.5px]">thoughts</span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[10px]/[12px] text-slate-600 shadow-sm">
                <Wrench className="h-3 w-3" />
                <span className="translate-y-[0.5px] inline-block min-w-[4ch] text-center tabular-nums">
                  {stats.toolCallCount}
                </span>
                <span className="translate-y-[0.5px]">tools</span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[10px]/[12px] text-slate-600 shadow-sm">
                <Info className="h-3 w-3" />
                <span className="translate-y-[0.5px] inline-block min-w-[4ch] text-center tabular-nums">
                  {stats.metaCount}
                </span>
                <span className="translate-y-[0.5px]">meta</span>
              </span>
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onCopyConversation}
          disabled={!visibleItemCount}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900 disabled:opacity-50"
        >
          {copiedId === 'conversation' ? 'Copied' : 'Copy conversation'}
        </button>
      </div>
    </div>
  );
};
