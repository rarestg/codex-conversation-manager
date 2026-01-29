import { Calendar, Clock, Fingerprint, GitBranch, Github, Hourglass, Repeat2 } from 'lucide-react';
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react';
import { memo, useEffect, useRef } from 'react';
import { isRenderDebugEnabled } from '../debug';
import {
  formatDayLabel,
  formatDuration,
  formatDurationMs,
  formatMonthLabel,
  formatRelativeTime,
  formatTime,
  formatWorkspacePath,
  getDaysInMonth,
  getDaysInYear,
  isSameDay,
} from '../format';
import { useRenderDebug } from '../hooks/useRenderDebug';
import { useWhyDidYouRender } from '../hooks/useWhyDidYouRender';
import type { LoadSessionOptions, SessionFileEntry, SessionTree } from '../types';
import { buildSessionUrl } from '../url';
import { CopyButton } from './CopyButton';
import { SessionLink } from './SessionLink';

const SESSIONS_SKELETON_KEYS = ['a', 'b', 'c', 'd', 'e'];

interface SessionsPanelProps {
  sessionsTree: SessionTree | null;
  sessionsRoot: string;
  loading: boolean;
  onRefreshSessions: () => void;
  onLoadSession: (sessionId: string, turnId?: number, options?: LoadSessionOptions) => void;
  activeSession: SessionFileEntry | null;
  activeWorkspace?: string | null;
  onClearWorkspace?: () => void;
  showWorkspaceFilter?: boolean;
  className?: string;
}

const SessionsPanelComponent = ({
  sessionsTree,
  sessionsRoot,
  loading,
  onRefreshSessions,
  onLoadSession,
  activeSession,
  activeWorkspace,
  onClearWorkspace,
  showWorkspaceFilter = true,
  className,
}: SessionsPanelProps) => {
  const formatCountLabel = (count: number, label: string) => `${count} ${count === 1 ? label : `${label}s`}`;
  const now = new Date();
  const renderStart = isRenderDebugEnabled ? performance.now() : 0;
  const listRef = useRef<HTMLDivElement | null>(null);
  const activeRowRef = useRef<HTMLDivElement | null>(null);
  const treeKey = sessionsTree?.years.length ?? 0;

  useRenderDebug('SessionsPanel', {
    loading,
    treeKey,
    sessionsRoot,
    activeSessionId: activeSession?.id ?? null,
    activeWorkspace: activeWorkspace ?? null,
  });
  useWhyDidYouRender(
    'SessionsPanel',
    {
      sessionsTree,
      sessionsRoot,
      loading,
      activeSession,
      activeWorkspace,
      onRefreshSessions,
      onLoadSession,
      onClearWorkspace,
    },
    { includeFunctions: true },
  );

  useEffect(() => {
    if (!isRenderDebugEnabled) return;
    const duration = performance.now() - renderStart;
    console.debug('[render cost] SessionsPanel', { duration });
  });

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

  useEffect(() => {
    const container = listRef.current;
    if (!container) return;
    if (!treeKey) return;

    const activeId = activeSession?.id;
    const detailsNodes = Array.from(container.querySelectorAll<HTMLDetailsElement>('details'));

    if (!activeId) {
      for (const node of detailsNodes) {
        const level = node.dataset.level;
        if (level === 'year') {
          node.open = true;
        } else {
          node.open = false;
        }
      }
      return;
    }

    const [year, month, day] = activeId.split('/');
    if (!year || !month || !day) return;

    const openDetails = () => {
      for (const node of detailsNodes) {
        const level = node.dataset.level;
        if (level === 'year') {
          node.open = node.dataset.year === year;
        } else if (level === 'month') {
          node.open = node.dataset.year === year && node.dataset.month === month;
        } else if (level === 'day') {
          node.open = node.dataset.year === year && node.dataset.month === month && node.dataset.day === day;
        }
      }
    };

    openDetails();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const row = activeRowRef.current;
        if (!row) return;
        const viewport = row.closest<HTMLElement>('.os-viewport');
        if (viewport) {
          const rowRect = row.getBoundingClientRect();
          const viewRect = viewport.getBoundingClientRect();
          const inView = rowRect.top >= viewRect.top && rowRect.bottom <= viewRect.bottom;
          if (!inView) {
            row.scrollIntoView({ block: 'nearest' });
          }
        } else {
          row.scrollIntoView({ block: 'nearest' });
        }
      });
    });
  }, [activeSession?.id, treeKey]);

  return (
    <div className={className}>
      <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-card backdrop-blur">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <h2 className="text-lg text-slate-900">Sessions</h2>
              <p className="text-xs text-slate-500">
                Root: {formatWorkspacePath(sessionsTree?.root || sessionsRoot || '—')}
              </p>
            </div>
            <button
              type="button"
              onClick={onRefreshSessions}
              className="inline-flex shrink-0 items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 shadow-sm hover:text-slate-900"
            >
              Refresh
            </button>
          </div>
          {showWorkspaceFilter && (
            <div className="flex flex-wrap items-center gap-2">
              {activeWorkspace ? (
                <>
                  <span className="inline-flex h-6 min-w-[14rem] items-center justify-start gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] leading-none text-slate-600 shadow-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                    Workspace filter on
                  </span>
                  <span className="inline-flex h-6 items-center truncate rounded-full bg-slate-100 px-3 py-1 text-[11px] leading-none text-slate-600">
                    {formatWorkspacePath(activeWorkspace)}
                  </span>
                  {onClearWorkspace && (
                    <button
                      type="button"
                      onClick={onClearWorkspace}
                      className="inline-flex box-border h-6 items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] leading-none text-slate-600 shadow-sm hover:text-slate-900"
                    >
                      Clear
                    </button>
                  )}
                </>
              ) : (
                <span className="inline-flex h-6 min-w-[14rem] items-center justify-start gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] leading-none text-slate-400 shadow-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-300" aria-hidden="true" />
                  Workspace filter off
                </span>
              )}
            </div>
          )}
          <OverlayScrollbarsComponent
            className="max-h-[60vh]"
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
            <div ref={listRef} className="space-y-3">
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
                  <details
                    key={year.year}
                    open
                    className="group overflow-visible"
                    data-level="year"
                    data-year={year.year}
                  >
                    <summary className="cursor-pointer list-none rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
                      <div className="flex w-full items-center justify-between gap-3">
                        <span>{year.year}</span>
                        <div className="flex items-center gap-2">
                          {(() => {
                            const yearSessionCount = year.months.reduce(
                              (total, month) => total + month.days.reduce((sum, day) => sum + day.files.length, 0),
                              0,
                            );
                            const yearActiveDays = year.months.reduce((total, month) => total + month.days.length, 0);
                            const yearTotalDays = getDaysInYear(year.year);

                            return (
                              <>
                                {yearTotalDays && (
                                  <span className="chip chip-xs chip-soft gap-1 font-medium text-slate-500">
                                    <Calendar className="h-3 w-3" />
                                    <span className="chip-value translate-y-[0.5px] inline-block min-w-[6ch] text-center">
                                      {`${yearActiveDays}/${yearTotalDays}`}
                                    </span>
                                  </span>
                                )}
                                <span className="chip chip-xs chip-soft font-medium text-slate-500">
                                  <span className="translate-y-[0.5px] inline-flex items-center gap-1">
                                    <span className="chip-value min-w-[4ch] text-center">{yearSessionCount}</span>
                                    <span>{yearSessionCount === 1 ? 'session' : 'sessions'}</span>
                                  </span>
                                </span>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </summary>
                    <div className="mt-2 space-y-2 pl-2">
                      {year.months.map((month) => (
                        <details
                          key={`${year.year}-${month.month}`}
                          className="group overflow-visible"
                          data-level="month"
                          data-year={year.year}
                          data-month={month.month}
                        >
                          <summary className="cursor-pointer list-none rounded-xl border border-slate-100 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
                            <div className="flex w-full items-center justify-between gap-3">
                              <span>{formatMonthLabel(year.year, month.month)}</span>
                              <div className="flex items-center gap-2">
                                {(() => {
                                  const monthSessionCount = month.days.reduce((sum, day) => sum + day.files.length, 0);
                                  const monthActiveDays = month.days.length;
                                  const monthTotalDays = getDaysInMonth(year.year, month.month);

                                  return (
                                    <>
                                      {monthTotalDays && (
                                        <span className="chip chip-xs chip-muted gap-1 font-medium text-slate-500">
                                          <Calendar className="h-3 w-3" />
                                          <span className="chip-value translate-y-[0.5px] inline-block min-w-[6ch] text-center">
                                            {`${monthActiveDays}/${monthTotalDays}`}
                                          </span>
                                        </span>
                                      )}
                                      <span className="chip chip-xs chip-muted font-medium text-slate-500">
                                        <span className="translate-y-[0.5px] inline-flex items-center gap-1">
                                          <span className="chip-value min-w-[4ch] text-center">
                                            {monthSessionCount}
                                          </span>
                                          <span>{monthSessionCount === 1 ? 'session' : 'sessions'}</span>
                                        </span>
                                      </span>
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                          </summary>
                          <div className="mt-2 space-y-2 pl-2">
                            {month.days.map((day) => (
                              <details
                                key={`${year.year}-${month.month}-${day.day}`}
                                className="group overflow-visible"
                                data-level="day"
                                data-year={year.year}
                                data-month={month.month}
                                data-day={day.day}
                              >
                                <summary className="cursor-pointer list-none rounded-xl bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-500">
                                  <div className="flex w-full items-center justify-between gap-3">
                                    <span>{formatDayLabel(year.year, month.month, day.day)}</span>
                                    <span className="chip chip-xs chip-white font-medium text-slate-500">
                                      {formatCountLabel(day.files.length, 'session')}
                                    </span>
                                  </div>
                                </summary>
                                <div className="mt-2 space-y-2 pl-2">
                                  {day.files.map((file) => {
                                    const title = file.preview?.trim() || 'Session';
                                    const timeSource = file.startedAt ?? file.timestamp ?? '';
                                    const durationLabel =
                                      formatDurationMs(file.activeDurationMs) ||
                                      formatDuration(file.startedAt, file.endedAt);
                                    const durationDisplay = durationLabel || (timeSource ? '-' : '');
                                    const timeLabel = timeSource
                                      ? isSameDay(timeSource, now)
                                        ? formatRelativeTime(timeSource, now)
                                        : formatTime(timeSource)
                                      : '';
                                    const repoLabel = getRepoLabel(file.gitRepo, file.cwd);
                                    const sessionId = file.sessionId;
                                    const sessionIdLabel = formatSessionId(sessionId);
                                    const turnCountValue = file.turnCount ?? null;
                                    const sessionHref = buildSessionUrl(file.id);
                                    const isActiveSession = activeSession?.id === file.id;

                                    return (
                                      <div
                                        key={file.id}
                                        ref={file.id === activeSession?.id ? activeRowRef : null}
                                        className={`w-full rounded-2xl border px-3 py-2 text-left text-xs transition ${
                                          isActiveSession
                                            ? 'border-teal-300 bg-teal-50 text-teal-800'
                                            : 'border-slate-100 bg-white text-slate-600 hover:border-teal-200 hover:text-slate-900'
                                        }`}
                                      >
                                        <SessionLink
                                          href={sessionHref}
                                          ariaCurrent={isActiveSession ? 'page' : undefined}
                                          onNavigate={() => onLoadSession(file.id)}
                                          className="block w-full text-left"
                                        >
                                          <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                              <div className="truncate text-sm font-semibold text-slate-800">
                                                {title}
                                              </div>
                                            </div>
                                          </div>
                                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                                            {timeLabel && (
                                              <span className="chip chip-xs chip-white chip-shadow gap-1">
                                                <Clock className="h-3 w-3" />
                                                <span className="chip-value translate-y-[0.5px] inline-block min-w-[7ch] text-center">
                                                  {timeLabel}
                                                </span>
                                              </span>
                                            )}
                                            {timeSource && (
                                              <span className="chip chip-xs chip-white chip-shadow gap-1">
                                                <Hourglass className="h-3 w-3" />
                                                <span className="chip-value translate-y-[0.5px] inline-block min-w-[6ch] text-center">
                                                  {durationDisplay}
                                                </span>
                                              </span>
                                            )}
                                            <span className="chip chip-xs chip-white chip-shadow gap-1">
                                              <Repeat2 className="h-3 w-3" />
                                              <span className="chip-value translate-y-[0.5px] inline-block min-w-[4ch] text-center">
                                                {turnCountValue ?? '—'}
                                              </span>
                                            </span>
                                            {repoLabel && (
                                              <span className="chip chip-xs chip-white chip-shadow gap-1 leading-none">
                                                <Github className="h-3 w-3" />
                                                {repoLabel}
                                              </span>
                                            )}
                                            {file.gitBranch && (
                                              <span className="chip chip-xs chip-white chip-shadow gap-1 leading-none">
                                                <GitBranch className="h-3 w-3" />
                                                {file.gitBranch}
                                              </span>
                                            )}
                                          </div>
                                        </SessionLink>
                                        <CopyButton
                                          text={sessionId}
                                          idleLabel={sessionIdLabel}
                                          hoverLabel="Copy"
                                          reserveLabel={sessionIdLabel}
                                          ariaLabel="Copy session id"
                                          title={sessionId}
                                          leading={<Fingerprint className="h-3 w-3" />}
                                          labelWrapperClassName="min-w-0"
                                          labelClassName="min-w-0 truncate"
                                          className="chip chip-xs chip-muted chip-button mt-2 min-w-0 gap-1 hover:bg-slate-200"
                                        />
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
    </div>
  );
};

export const SessionsPanel = memo(SessionsPanelComponent);
