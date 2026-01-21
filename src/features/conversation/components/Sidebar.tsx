import { type KeyboardEvent } from 'react'
import { renderSnippet } from '../markdown'
import type { SearchResult, SessionFileEntry, SessionTree } from '../types'

interface SidebarProps {
  sessionsTree: SessionTree | null
  sessionsRoot: string
  searchQuery: string
  onSearchQueryChange: (value: string) => void
  onSearchKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
  searchResults: SearchResult[]
  searchLoading: boolean
  onLoadSession: (sessionId: string, turnId?: number) => void
  activeSession: SessionFileEntry | null
  onRefreshSessions: () => void
}

export const Sidebar = ({
  sessionsTree,
  sessionsRoot,
  searchQuery,
  onSearchQueryChange,
  onSearchKeyDown,
  searchResults,
  searchLoading,
  onLoadSession,
  activeSession,
  onRefreshSessions,
}: SidebarProps) => {
  return (
    <aside className="w-full max-w-none space-y-5 lg:w-[340px]">
      <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-card backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg text-slate-900">Search sessions</h2>
            <p className="text-xs text-slate-500">Full-text search across user and assistant messages.</p>
          </div>
          {searchLoading && (
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500">Searching…</span>
          )}
        </div>
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          onKeyDown={onSearchKeyDown}
          placeholder="Search messages"
          className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-200"
        />
        {searchResults.length > 0 && (
          <div className="mt-4 space-y-3">
            {searchResults.map((result) => (
              <button
                key={result.id}
                onClick={() => onLoadSession(result.session_id, result.turn_id)}
                className="w-full rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3 text-left text-sm text-slate-700 transition hover:border-teal-200 hover:bg-white"
              >
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{result.session_id}</span>
                  <span>Turn {result.turn_id}</span>
                </div>
                <div className="mt-2 text-sm text-slate-700">{renderSnippet(result.snippet)}</div>
              </button>
            ))}
          </div>
        )}
        {searchQuery && !searchLoading && searchResults.length === 0 && (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
            No matches yet. Try another query or reindex.
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-card backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg text-slate-900">Sessions</h2>
            <p className="text-xs text-slate-500">Root: {sessionsTree?.root || sessionsRoot || '—'}</p>
          </div>
          <button
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
    </aside>
  )
}
