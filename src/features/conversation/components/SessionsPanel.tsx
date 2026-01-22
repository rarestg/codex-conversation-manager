import { formatWorkspacePath } from '../format';
import type { SessionFileEntry, SessionTree } from '../types';

interface SessionsPanelProps {
  sessionsTree: SessionTree | null;
  sessionsRoot: string;
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
  onRefreshSessions,
  onLoadSession,
  activeSession,
  activeWorkspace,
  onClearWorkspace,
  className,
}: SessionsPanelProps) => {
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
        <div className="mt-4 max-h-[60vh] space-y-3 overflow-auto pr-1">
          {sessionsTree?.years.length ? (
            sessionsTree.years.map((year) => (
              <details key={year.year} open className="group">
                <summary className="cursor-pointer list-none rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
                  {year.year}
                </summary>
                <div className="mt-2 space-y-2 pl-2">
                  {year.months.map((month) => (
                    <details key={`${year.year}-${month.month}`} className="group">
                      <summary className="cursor-pointer list-none rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm">
                        {month.month}
                      </summary>
                      <div className="mt-2 space-y-2 pl-2">
                        {month.days.map((day) => (
                          <details key={`${year.year}-${month.month}-${day.day}`} className="group">
                            <summary className="cursor-pointer list-none rounded-xl bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-500">
                              {day.day}
                            </summary>
                            <div className="mt-2 space-y-2 pl-2">
                              {day.files.map((file) => (
                                <button
                                  type="button"
                                  key={file.id}
                                  onClick={() => onLoadSession(file.id)}
                                  className={`w-full rounded-2xl border px-3 py-2 text-left text-xs transition ${
                                    activeSession?.id === file.id
                                      ? 'border-teal-300 bg-teal-50 text-teal-800'
                                      : 'border-slate-100 bg-white text-slate-600 hover:border-teal-200 hover:text-slate-900'
                                  }`}
                                >
                                  <div className="font-medium">{file.filename}</div>
                                  {file.preview && (
                                    <div className="mt-1 max-h-9 overflow-hidden text-[11px] text-slate-500">
                                      {file.preview}
                                    </div>
                                  )}
                                </button>
                              ))}
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
      </div>
    </div>
  );
};
