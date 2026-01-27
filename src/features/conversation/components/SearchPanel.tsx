import { ArrowDownWideNarrow, CalendarClock, GitBranch, Hourglass, Repeat2 } from 'lucide-react';
import { type ClipboardEvent, type KeyboardEvent, type MouseEvent, useEffect, useRef } from 'react';
import { logSearch } from '../debug';
import { formatDate, formatDuration, formatDurationMs, formatTime, formatWorkspacePath } from '../format';
import { renderSnippet } from '../markdown';
import type {
  LoadSessionOptions,
  SearchGroupSort,
  SearchResultSort,
  SearchStatus,
  WorkspaceSearchGroup,
} from '../types';
import { GitHubIcon } from './GitHubIcon';

interface SearchPanelProps {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onSearchKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onSearchPasteUuid?: (event: ClipboardEvent<HTMLInputElement>) => void;
  searchGroups: WorkspaceSearchGroup[];
  searchStatus: SearchStatus;
  searchError?: string | null;
  searchTooShort?: boolean;
  resultSort: SearchResultSort;
  groupSort: SearchGroupSort;
  onResultSortChange: (value: SearchResultSort) => void;
  onGroupSortChange: (value: SearchGroupSort) => void;
  onLoadSession: (sessionId: string, turnId?: number, options?: LoadSessionOptions) => void;
  className?: string;
}

const getRepoLabel = (gitRepo?: string | null) => {
  if (!gitRepo) return null;
  const cleaned = gitRepo.replace(/\.git$/i, '');
  const parts = cleaned.split(/[/:]/).filter(Boolean);
  return parts[parts.length - 1] || cleaned;
};

const getWorkspaceTitle = (workspace: WorkspaceSearchGroup['workspace']) =>
  workspace.github_slug || getRepoLabel(workspace.git_repo) || workspace.cwd;

const RESULT_SORT_LABELS: Record<SearchResultSort, string> = {
  relevance: 'Relevance',
  matches: 'Most matches',
  recent: 'Most recent',
};

const GROUP_SORT_LABELS: Record<SearchGroupSort, string> = {
  last_seen: 'Last active',
  matches: 'Most matches',
};

export const SearchPanel = ({
  searchQuery,
  onSearchQueryChange,
  onSearchKeyDown,
  onSearchPasteUuid,
  searchGroups,
  searchStatus,
  searchError,
  searchTooShort,
  resultSort,
  groupSort,
  onResultSortChange,
  onGroupSortChange,
  onLoadSession,
  className,
}: SearchPanelProps) => {
  const resultSortLabel = RESULT_SORT_LABELS[resultSort];
  const groupSortLabel = GROUP_SORT_LABELS[groupSort];
  const resultCount = searchGroups.reduce((total, group) => total + group.results.length, 0);
  const isSearching = searchStatus === 'debouncing' || searchStatus === 'loading';
  const showTooShortState = Boolean(searchQuery) && Boolean(searchTooShort);
  const showEmptyState =
    Boolean(searchQuery) && !showTooShortState && searchStatus === 'success' && searchGroups.length === 0;
  const showErrorState = searchStatus === 'error';
  const handleOpenGithub = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!window.confirm('Open this repository on GitHub in a new tab?')) {
      event.preventDefault();
    }
  };
  const lastStateRef = useRef({
    status: searchStatus,
    isSearching,
    groupCount: searchGroups.length,
    resultCount,
    showEmptyState,
    showTooShortState,
    renderedAt: performance.now(),
  });
  useEffect(() => {
    const now = performance.now();
    const last = lastStateRef.current;
    if (last.status !== searchStatus) {
      logSearch('ui:status:change', {
        query: searchQuery,
        from: last.status,
        to: searchStatus,
        deltaMs: Number((now - last.renderedAt).toFixed(2)),
      });
    }
    if (last.isSearching !== isSearching) {
      logSearch('ui:searching:change', {
        query: searchQuery,
        from: last.isSearching,
        to: isSearching,
        deltaMs: Number((now - last.renderedAt).toFixed(2)),
      });
    }
    if (last.groupCount !== searchGroups.length || last.resultCount !== resultCount) {
      logSearch('ui:results:change', {
        query: searchQuery,
        groupCount: searchGroups.length,
        resultCount,
        deltaMs: Number((now - last.renderedAt).toFixed(2)),
      });
    }
    if (last.showEmptyState !== showEmptyState) {
      logSearch('ui:empty-state:change', {
        query: searchQuery,
        from: last.showEmptyState,
        to: showEmptyState,
        deltaMs: Number((now - last.renderedAt).toFixed(2)),
      });
    }
    if (last.showTooShortState !== showTooShortState) {
      logSearch('ui:too-short:change', {
        query: searchQuery,
        from: last.showTooShortState,
        to: showTooShortState,
        deltaMs: Number((now - last.renderedAt).toFixed(2)),
      });
    }
    lastStateRef.current = {
      status: searchStatus,
      isSearching,
      groupCount: searchGroups.length,
      resultCount,
      showEmptyState,
      showTooShortState,
      renderedAt: now,
    };
  }, [isSearching, resultCount, searchGroups.length, searchQuery, searchStatus, showEmptyState, showTooShortState]);
  logSearch('ui:render', {
    query: searchQuery,
    status: searchStatus,
    isSearching,
    groupCount: searchGroups.length,
    resultCount,
    showEmptyState,
    showTooShortState,
  });
  return (
    <div className={className}>
      <div className="search-panel rounded-3xl border border-white/70 bg-white/80 p-5 shadow-card backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg text-slate-900">Search sessions</h2>
            <p className="text-xs text-slate-500">Full-text search across user and assistant messages.</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="search-sort-desktop search-sort-controls">
              <div className="search-sort-select">
                <span className="search-sort-label">Results</span>
                <label className="sr-only" htmlFor="search-result-sort">
                  Sort results by
                </label>
                <select
                  id="search-result-sort"
                  value={resultSort}
                  onChange={(event) => onResultSortChange(event.target.value as SearchResultSort)}
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 shadow-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-200"
                >
                  <option value="relevance">Relevance</option>
                  <option value="matches">Most matches</option>
                  <option value="recent">Most recent</option>
                </select>
              </div>
              <div className="search-sort-select">
                <span className="search-sort-label">Workspaces</span>
                <label className="sr-only" htmlFor="search-group-sort">
                  Sort workspaces by
                </label>
                <select
                  id="search-group-sort"
                  value={groupSort}
                  onChange={(event) => onGroupSortChange(event.target.value as SearchGroupSort)}
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 shadow-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-200"
                >
                  <option value="last_seen">Last active</option>
                  <option value="matches">Most matches</option>
                </select>
              </div>
            </div>
          </div>
        </div>
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          onKeyDown={onSearchKeyDown}
          onPaste={onSearchPasteUuid}
          placeholder="Search messages"
          aria-label="Search sessions"
          className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-200"
        />
        <div className="search-sort-mobile mt-3">
          <details className="search-sort-disclosure rounded-2xl border border-slate-200 bg-white shadow-sm">
            <summary className="search-sort-summary flex items-center justify-between px-3 py-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                  <ArrowDownWideNarrow className="h-3 w-3" />
                  Sort
                </div>
                <div className="truncate text-xs text-slate-700">
                  {resultSortLabel} · {groupSortLabel}
                </div>
              </div>
              <span className="ml-3 text-slate-400">▾</span>
            </summary>
            <div className="grid gap-3 p-3">
              <div className="search-sort-select">
                <span className="search-sort-label">Results</span>
                <label className="sr-only" htmlFor="search-result-sort-mobile">
                  Sort results by
                </label>
                <select
                  id="search-result-sort-mobile"
                  value={resultSort}
                  onChange={(event) => onResultSortChange(event.target.value as SearchResultSort)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 shadow-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-200"
                >
                  <option value="relevance">Relevance</option>
                  <option value="matches">Most matches</option>
                  <option value="recent">Most recent</option>
                </select>
              </div>
              <div className="search-sort-select">
                <span className="search-sort-label">Workspaces</span>
                <label className="sr-only" htmlFor="search-group-sort-mobile">
                  Sort workspaces by
                </label>
                <select
                  id="search-group-sort-mobile"
                  value={groupSort}
                  onChange={(event) => onGroupSortChange(event.target.value as SearchGroupSort)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 shadow-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-200"
                >
                  <option value="last_seen">Last active</option>
                  <option value="matches">Most matches</option>
                </select>
              </div>
            </div>
          </details>
        </div>
        {isSearching && (
          <div className="mt-4 space-y-2" aria-live="polite">
            <div className="search-skeleton-card">
              <div className="search-skeleton-row search-skeleton-row-sm" />
              <div className="search-skeleton-row" />
              <div className="search-skeleton-row search-skeleton-row-lg" />
            </div>
            <div className="search-skeleton-card">
              <div className="search-skeleton-row search-skeleton-row-sm" />
              <div className="search-skeleton-row" />
              <div className="search-skeleton-row search-skeleton-row-lg" />
            </div>
          </div>
        )}
        {searchGroups.length > 0 && (
          <div className="mt-4 space-y-4">
            {searchGroups.map((group) => (
              <div key={group.workspace.cwd} className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                <div className="search-group-header">
                  <div className="flex min-w-0 items-start gap-3 sm:flex-1">
                    {group.workspace.github_slug && (
                      <a
                        href={`https://github.com/${group.workspace.github_slug}`}
                        target="_blank"
                        rel="noreferrer"
                        title="Open on GitHub"
                        aria-label={`Open ${group.workspace.github_slug} on GitHub`}
                        onClick={handleOpenGithub}
                        className="search-github-icon-link mt-0.5 rounded-full bg-slate-200 p-1 text-slate-600 transition hover:bg-slate-300"
                      >
                        <GitHubIcon className="h-3.5 w-3.5" />
                      </a>
                    )}
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-800">
                        {getWorkspaceTitle(group.workspace)}
                      </div>
                      <div className="mt-1 truncate text-xs text-slate-500" title={group.workspace.cwd}>
                        {formatWorkspacePath(group.workspace.cwd)}
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-xs text-slate-500">
                    <div>
                      {group.match_count} matches
                      {group.workspace.session_count ? ` · ${group.workspace.session_count} sessions` : ''}
                    </div>
                    {group.workspace.last_seen && (
                      <div>
                        Last active: {formatDate(group.workspace.last_seen)} {formatTime(group.workspace.last_seen)}
                      </div>
                    )}
                  </div>
                </div>
                {group.workspace.github_slug ? (
                  <a
                    href={`https://github.com/${group.workspace.github_slug}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={handleOpenGithub}
                    className="search-github-link mt-2 items-center gap-2 text-xs font-medium text-teal-700 hover:text-teal-800"
                  >
                    Open on GitHub
                  </a>
                ) : (
                  group.workspace.git_repo && (
                    <div className="mt-2 text-xs text-slate-500">{group.workspace.git_repo}</div>
                  )
                )}
                <div className="mt-3 space-y-2">
                  {group.results.map((result) => {
                    const timeSource = result.started_at ?? result.session_timestamp ?? result.ended_at ?? '';
                    const durationLabel =
                      formatDurationMs(result.active_duration_ms) || formatDuration(result.started_at, result.ended_at);
                    const durationDisplay = durationLabel || (timeSource ? '-' : '');
                    const turnCountValue = result.turn_count ?? null;

                    return (
                      <button
                        type="button"
                        key={result.session_path}
                        onClick={() =>
                          onLoadSession(result.session_path, result.first_match_turn_id ?? undefined, {
                            searchQuery: searchQuery.trim() || null,
                          })
                        }
                        className="w-full rounded-2xl border border-slate-100 bg-white px-4 py-3 text-left text-sm text-slate-700 transition hover:border-teal-200 hover:bg-white"
                      >
                        <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                          <span className="min-w-0 flex-1 truncate" title={result.session_id || result.session_path}>
                            {result.session_id || result.session_path}
                          </span>
                          <span className="shrink-0">
                            {result.match_message_count} matches · {result.match_turn_count} turns
                          </span>
                        </div>
                        <div className="search-result-stack mt-2">
                          <div className="search-result-title min-w-0 max-w-full text-sm font-medium text-slate-800">
                            {result.first_user_message || result.session_path}
                          </div>
                          {(result.session_timestamp ||
                            result.git_branch ||
                            timeSource ||
                            durationDisplay ||
                            turnCountValue !== null) && (
                            <div className="search-result-metrics">
                              {result.session_timestamp && (
                                <span className="search-result-chip">
                                  <CalendarClock className="h-3 w-3" />
                                  <span className="chip-value">
                                    {formatDate(result.session_timestamp)} {formatTime(result.session_timestamp)}
                                  </span>
                                </span>
                              )}
                              {durationDisplay && (
                                <span className="search-result-chip">
                                  <Hourglass className="h-3 w-3" />
                                  <span className="chip-value translate-y-[0.5px]">{durationDisplay}</span>
                                </span>
                              )}
                              <span className="search-result-chip">
                                <Repeat2 className="h-3 w-3" />
                                <span className="chip-value translate-y-[0.5px]">{turnCountValue ?? '—'}</span>
                                <span className="translate-y-[0.5px]">turns</span>
                              </span>
                              {result.git_branch && (
                                <span className="search-result-chip" title={result.git_branch}>
                                  <GitBranch className="h-3 w-3" />
                                  <span className="truncate">{result.git_branch}</span>
                                </span>
                              )}
                            </div>
                          )}
                          <div className="min-w-0 max-w-full text-sm text-slate-700 line-clamp-3 break-words overflow-hidden">
                            {renderSnippet(result.snippet)}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
        {showErrorState && (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {searchError || 'Search failed. Try again or reindex.'}
          </div>
        )}
        {showTooShortState && (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
            Type a longer query to search.
          </div>
        )}
        {showEmptyState && (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
            No matches yet. Try another query or reindex.
          </div>
        )}
      </div>
    </div>
  );
};
