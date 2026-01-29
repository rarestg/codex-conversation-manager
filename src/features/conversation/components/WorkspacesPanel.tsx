import { ArrowDownWideNarrow } from 'lucide-react';
import { memo } from 'react';
import { formatDate, formatTime, formatWorkspacePath } from '../format';
import { useRenderDebug } from '../hooks/useRenderDebug';
import type { WorkspaceSummary } from '../types';
import { GitHubIcon } from './GitHubIcon';

interface WorkspacesPanelProps {
  workspaces: WorkspaceSummary[];
  loading: boolean;
  sort: 'last_seen' | 'session_count';
  onSortChange: (value: 'last_seen' | 'session_count') => void;
  activeWorkspace: string | null;
  onSelectWorkspace: (value: string) => void;
  onClearWorkspace: () => void;
  className?: string;
}

const getRepoLabel = (gitRepo?: string | null) => {
  if (!gitRepo) return null;
  const cleaned = gitRepo.replace(/\.git$/i, '');
  const parts = cleaned.split(/[/:]/).filter(Boolean);
  return parts[parts.length - 1] || cleaned;
};

const getWorkspaceTitle = (workspace: WorkspaceSummary) =>
  workspace.github_slug || getRepoLabel(workspace.git_repo) || workspace.cwd;

const WorkspacesPanelComponent = ({
  workspaces,
  loading,
  sort,
  onSortChange,
  activeWorkspace,
  onSelectWorkspace,
  onClearWorkspace,
  className,
}: WorkspacesPanelProps) => {
  useRenderDebug('WorkspacesPanel', {
    loading,
    workspacesCount: workspaces.length,
    sort,
    activeWorkspace: activeWorkspace ?? null,
  });

  return (
    <div className={className}>
      <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-card backdrop-blur">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-2">
              <h2 className="text-lg text-slate-900">Workspaces</h2>
              <p className="text-xs text-slate-500">Browse sessions by working directory and repo.</p>
            </div>
            <div className="flex items-center gap-2">
              {loading && <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500">Loading…</span>}
              <span className="search-sort-label">
                <ArrowDownWideNarrow className="h-3 w-3" />
                Sort
              </span>
              <select
                value={sort}
                onChange={(event) => onSortChange(event.target.value as 'last_seen' | 'session_count')}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 shadow-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-200"
              >
                <option value="last_seen">Last seen</option>
                <option value="session_count">Session count</option>
              </select>
            </div>
          </div>
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
                <button
                  type="button"
                  onClick={onClearWorkspace}
                  className="inline-flex box-border h-6 items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] leading-none text-slate-600 shadow-sm hover:text-slate-900"
                >
                  Clear
                </button>
              </>
            ) : (
              <span className="inline-flex h-6 min-w-[14rem] items-center justify-start gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] leading-none text-slate-400 shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-300" aria-hidden="true" />
                Workspace filter off
              </span>
            )}
          </div>
          <div className="space-y-3">
            {workspaces.length ? (
              workspaces.map((workspace) => {
                const isActive = activeWorkspace === workspace.cwd;
                const displayCwd = formatWorkspacePath(workspace.cwd);
                const githubUrl = workspace.github_slug ? `https://github.com/${workspace.github_slug}` : null;
                return (
                  <button
                    key={workspace.cwd}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => onSelectWorkspace(workspace.cwd)}
                    className={`w-full cursor-pointer rounded-2xl border text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-200 ${
                      isActive
                        ? 'border-teal-300 bg-teal-50 text-teal-800'
                        : 'border-slate-100 bg-white text-slate-700 hover:border-teal-200 hover:bg-white'
                    }`}
                  >
                    <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 sm:flex-1">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          {githubUrl && (
                            <a
                              href={githubUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(event) => event.stopPropagation()}
                              aria-label={`Open ${workspace.github_slug} on GitHub`}
                              title="Open on GitHub"
                              className="rounded-full bg-slate-200 p-1 text-slate-600 transition hover:bg-slate-300"
                            >
                              <GitHubIcon className="h-3.5 w-3.5" />
                            </a>
                          )}
                          <span className="truncate">{getWorkspaceTitle(workspace)}</span>
                        </div>
                        <div className="mt-1 truncate text-xs text-slate-500" title={workspace.cwd}>
                          {displayCwd}
                        </div>
                        {workspace.git_branch && (
                          <div className="mt-1 text-[11px] text-slate-500">Branch: {workspace.git_branch}</div>
                        )}
                      </div>
                      <div className="shrink-0 text-right text-xs text-slate-500">
                        <div>{workspace.session_count} sessions</div>
                        {workspace.last_seen && (
                          <>
                            <div>{formatDate(workspace.last_seen)}</div>
                            <div>{formatTime(workspace.last_seen)}</div>
                          </>
                        )}
                      </div>
                    </div>
                    {workspace.git_repo && !githubUrl && (
                      <div className="px-4 pb-3 text-[11px] text-slate-500">{workspace.git_repo}</div>
                    )}
                  </button>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                No workspaces indexed yet. Click Reindex in Settings.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const WorkspacesPanel = memo(WorkspacesPanelComponent);
