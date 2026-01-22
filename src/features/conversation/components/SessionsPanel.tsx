import { Clock, Fingerprint, GitBranch, Github, Hourglass, Repeat2 } from 'lucide-react';
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react';
import type { MouseEvent } from 'react';
import { copyText } from '../copy';
import {
  formatDayLabel,
  formatDuration,
  formatMonthLabel,
  formatRelativeTime,
  formatTime,
  formatWorkspacePath,
  isSameDay,
} from '../format';
import { useCopyFeedback } from '../hooks/useCopyFeedback';
import type { SessionFileEntry, SessionTree } from '../types';

const SESSIONS_SKELETON_KEYS = ['a', 'b', 'c', 'd', 'e'];

interface SessionsPanelProps {
  sessionsTree: SessionTree | null;
  sessionsRoot: string;
  loading: boolean;
  onRefreshSessions: () => void;
  onLoadSession: (sessionId: string, turnId?: number) => void;
  activeSession: SessionFileEntry | null;
  activeWorkspace?: string | null;
  onClearWorkspace?: () => void;
  className?: string;
}

export const SessionsPanel = ({
  sessionsTree,
  sessionsRoot,
  loading,
  onRefreshSessions,
  onLoadSession,
  activeSession,
  activeWorkspace,
  onClearWorkspace,
  className,
}: SessionsPanelProps) => {
  const formatCountLabel = (count: number, label: string) => `${count} ${count === 1 ? label : `${label}s`}`;
  const now = new Date();
  const { copiedId, showCopied } = useCopyFeedback();
  const getRepoLabel = (gitRepo?: string | null, cwd?: string | null) => {
    if (gitRepo) {
      const cleaned = gitRepo.replace(/\.git$/i, '');
      const parts = cleaned.split(/[/:]/).filter(Boolean);
      if (parts.length >= 2) {
        return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
      }
      return cleaned;
    }
    if (!cwd) return null;
    const trimmed = cwd.trim();
    if (!trimmed) return null;
    const parts = trimmed.split(/[\\/]/).filter(Boolean);
    return parts[parts.length - 1] ?? null;
  };
  const formatSessionId = (value: string) => {
    if (value.length <= 16) return value;
    return `${value.slice(0, 8)}...${value.slice(-4)}`;
  };
  const handleCopySessionId = async (event: MouseEvent<HTMLButtonElement>, value: string, id: string) => {
    event.stopPropagation();
    event.preventDefault();
    await copyText(value);
    showCopied(id, 1500);
  };

  return (
    <div className={className}>
      <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-card backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg text-slate-900">Sessions</h2>
            <p className="text-xs text-slate-500">
              Root: {formatWorkspacePath(sessionsTree?.root || sessionsRoot || '—')}
            </p>
            {activeWorkspace && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-teal-50 px-3 py-1 text-[11px] font-semibold text-teal-700">
                  Filtered by workspace
                </span>
                <span className="truncate rounded-full bg-slate-100 px-3 py-1 text-[11px] text-slate-600">
                  {formatWorkspacePath(activeWorkspace)}
                </span>
                {onClearWorkspace && (
                  <button
                    type="button"
                    onClick={onClearWorkspace}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-600 shadow-sm hover:text-slate-900"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onRefreshSessions}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 shadow-sm hover:text-slate-900"
          >
            Refresh
          </button>
        </div>
        <OverlayScrollbarsComponent
          className="mt-4 max-h-[60vh]"
          options={{
            overflow: { x: 'hidden', y: 'scroll' },
            scrollbars: {
              theme: 'os-theme-codex',
              autoHide: 'scroll',
              autoHideDelay: 800,
            },
          }}
          data-overlayscrollbars-initialize
        >
          <div className="space-y-3">
            {loading ? (
              <div className="space-y-3 animate-pulse">
                {SESSIONS_SKELETON_KEYS.map((key) => (
                  <div
                    key={`sessions-skeleton-${key}`}
                    className="rounded-2xl border border-slate-100 bg-white/70 px-3 py-3"
                  >
                    <div className="h-3 w-24 rounded-full bg-slate-200" />
                    <div className="mt-2 flex flex-wrap gap-2">
                      <div className="h-4 w-16 rounded-full bg-slate-100" />
                      <div className="h-4 w-20 rounded-full bg-slate-100" />
                      <div className="h-4 w-14 rounded-full bg-slate-100" />
                    </div>
                  </div>
                ))}
              </div>
            ) : sessionsTree?.years.length ? (
              sessionsTree.years.map((year) => (
                <details key={year.year} open className="group">
                  <summary className="cursor-pointer list-none rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
                    <div className="flex w-full items-center justify-between gap-3">
                      <span>{year.year}</span>
                      <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                        {formatCountLabel(
                          year.months.reduce(
                            (total, month) => total + month.days.reduce((sum, day) => sum + day.files.length, 0),
                            0,
                          ),
                          'session',
                        )}
                      </span>
                    </div>
                  </summary>
                  <div className="mt-2 space-y-2 pl-2">
                    {year.months.map((month) => (
                      <details key={`${year.year}-${month.month}`} className="group">
                        <summary className="cursor-pointer list-none rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm">
                          <div className="flex w-full items-center justify-between gap-3">
                            <span>{formatMonthLabel(year.year, month.month)}</span>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                              {formatCountLabel(
                                month.days.reduce((sum, day) => sum + day.files.length, 0),
                                'session',
                              )}
                            </span>
                          </div>
                        </summary>
                        <div className="mt-2 space-y-2 pl-2">
                          {month.days.map((day) => (
                            <details key={`${year.year}-${month.month}-${day.day}`} className="group">
                              <summary className="cursor-pointer list-none rounded-xl bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-500">
                                <div className="flex w-full items-center justify-between gap-3">
                                  <span>{formatDayLabel(year.year, month.month, day.day)}</span>
                                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-slate-500">
                                    {formatCountLabel(day.files.length, 'session')}
                                  </span>
                                </div>
                              </summary>
                              <div className="mt-2 space-y-2 pl-2">
                                {day.files.map((file) => {
                                  const title = file.preview?.trim() || 'Session';
                                  const durationLabel = formatDuration(file.startedAt, file.endedAt);
                                  const timeSource = file.startedAt ?? file.timestamp ?? '';
                                  const timeLabel = timeSource
                                    ? isSameDay(timeSource, now)
                                      ? formatRelativeTime(timeSource, now)
                                      : formatTime(timeSource)
                                    : '';
                                  const repoLabel = getRepoLabel(file.gitRepo, file.cwd);
                                  const sessionId = file.sessionId;
                                  const sessionIdLabel = formatSessionId(sessionId);
                                  const sessionCopyId = `session-id-${file.id}`;

                                  return (
                                    <div
                                      key={file.id}
                                      className={`w-full rounded-2xl border px-3 py-2 text-left text-xs transition ${
                                        activeSession?.id === file.id
                                          ? 'border-teal-300 bg-teal-50 text-teal-800'
                                          : 'border-slate-100 bg-white text-slate-600 hover:border-teal-200 hover:text-slate-900'
                                      }`}
                                    >
                                      <button
                                        type="button"
                                        onClick={() => onLoadSession(file.id)}
                                        className="w-full text-left"
                                      >
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="min-w-0">
                                            <div className="truncate text-sm font-semibold text-slate-800">{title}</div>
                                          </div>
                                        </div>
                                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                                          {timeLabel && (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px]/[12px] text-slate-600 shadow-sm">
                                              <Clock className="h-3 w-3" />
                                              <span className="translate-y-[0.5px]">{timeLabel}</span>
                                            </span>
                                          )}
                                          {durationLabel && (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px]/[12px] text-slate-600 shadow-sm">
                                              <Hourglass className="h-3 w-3" />
                                              <span className="translate-y-[0.5px]">{durationLabel}</span>
                                            </span>
                                          )}
                                          {file.turnCount !== null && file.turnCount !== undefined && (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px]/[12px] text-slate-600 shadow-sm">
                                              <Repeat2 className="h-3 w-3" />
                                              <span className="translate-y-[0.5px]">{file.turnCount}</span>
                                            </span>
                                          )}
                                          {repoLabel && (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] leading-none text-slate-600 shadow-sm">
                                              <Github className="h-3 w-3" />
                                              {repoLabel}
                                            </span>
                                          )}
                                          {file.gitBranch && (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] leading-none text-slate-600 shadow-sm">
                                              <GitBranch className="h-3 w-3" />
                                              {file.gitBranch}
                                            </span>
                                          )}
                                        </div>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(event) => handleCopySessionId(event, sessionId, sessionCopyId)}
                                        title={sessionId}
                                        className="mt-2 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 hover:bg-slate-200"
                                      >
                                        <Fingerprint className="h-3 w-3" />
                                        <span className="truncate">{sessionIdLabel}</span>
                                        {copiedId === sessionCopyId && (
                                          <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] text-slate-500">
                                            Copied
                                          </span>
                                        )}
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </details>
                          ))}
                        </div>
                      </details>
                    ))}
                  </div>
                </details>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                No sessions found yet. Update your sessions root in settings.
              </div>
            )}
          </div>
        </OverlayScrollbarsComponent>
      </div>
    </div>
  );
};
