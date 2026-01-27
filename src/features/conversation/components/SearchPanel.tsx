import { type KeyboardEvent, useEffect, useRef } from 'react';
import { logSearch } from '../debug';
import { formatDate, formatTime, formatWorkspacePath } from '../format';
import { renderSnippet } from '../markdown';
import type { WorkspaceSearchGroup } from '../types';
import { GitHubIcon } from './GitHubIcon';

interface SearchPanelProps {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onSearchKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  searchGroups: WorkspaceSearchGroup[];
  searchLoading: boolean;
  onLoadSession: (sessionId: string, turnId?: number) => void;
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

export const SearchPanel = ({
  searchQuery,
  onSearchQueryChange,
  onSearchKeyDown,
  searchGroups,
  searchLoading,
  onLoadSession,
  className,
}: SearchPanelProps) => {
  const resultCount = searchGroups.reduce((total, group) => total + group.results.length, 0);
  const showEmptyState = Boolean(searchQuery) && !searchLoading && searchGroups.length === 0;
  const lastStateRef = useRef({
    loading: searchLoading,
    groupCount: searchGroups.length,
    resultCount,
    showEmptyState,
    renderedAt: performance.now(),
  });
  useEffect(() => {
    const now = performance.now();
    const last = lastStateRef.current;
    if (last.loading !== searchLoading) {
      logSearch('ui:loading:change', {
        query: searchQuery,
        from: last.loading,
        to: searchLoading,
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
    lastStateRef.current = {
      loading: searchLoading,
      groupCount: searchGroups.length,
      resultCount,
      showEmptyState,
      renderedAt: now,
    };
  }, [resultCount, searchGroups.length, searchLoading, searchQuery, showEmptyState]);
  logSearch('ui:render', {
    query: searchQuery,
    loading: searchLoading,
    groupCount: searchGroups.length,
    resultCount,
    showEmptyState,
  });
  return (
    <div className={className}>
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
          aria-label="Search sessions"
          className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-200"
        />
        {searchGroups.length > 0 && (
          <div className="mt-4 space-y-4">
            {searchGroups.map((group) => (
              <div key={group.workspace.cwd} className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3 sm:flex-1">
                    {group.workspace.github_slug && (
                      <div className="mt-0.5 rounded-full bg-slate-200 p-1 text-slate-600">
                        <GitHubIcon className="h-3.5 w-3.5" />
                      </div>
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
                      <>
                        <div>{formatDate(group.workspace.last_seen)}</div>
                        <div>{formatTime(group.workspace.last_seen)}</div>
                      </>
                    )}
                  </div>
                </div>
                {group.workspace.github_slug ? (
                  <a
                    href={`https://github.com/${group.workspace.github_slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-2 text-xs font-medium text-teal-700 hover:text-teal-800"
                  >
                    Open on GitHub
                  </a>
                ) : (
                  group.workspace.git_repo && (
                    <div className="mt-2 text-xs text-slate-500">{group.workspace.git_repo}</div>
                  )
                )}
                <div className="mt-3 space-y-2">
                  {group.results.map((result) => (
                    <button
                      type="button"
                      key={result.id}
                      onClick={() => onLoadSession(result.session_id, result.turn_id)}
                      className="w-full rounded-2xl border border-slate-100 bg-white px-4 py-3 text-left text-sm text-slate-700 transition hover:border-teal-200 hover:bg-white"
                    >
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>{result.session_id}</span>
                        <span>Turn {result.turn_id}</span>
                      </div>
                      <div className="mt-2 text-sm text-slate-700">{renderSnippet(result.snippet)}</div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {searchQuery && !searchLoading && searchGroups.length === 0 && (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
            No matches yet. Try another query or reindex.
          </div>
        )}
      </div>
    </div>
  );
};
