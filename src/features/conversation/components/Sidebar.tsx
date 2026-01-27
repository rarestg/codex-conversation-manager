import { type ClipboardEvent, type KeyboardEvent, memo } from 'react';
import { isRenderDebugEnabled } from '../debug';
import { useRenderDebug } from '../hooks/useRenderDebug';
import { useWhyDidYouRender } from '../hooks/useWhyDidYouRender';
import type {
  LoadSessionOptions,
  SearchGroupSort,
  SearchResultSort,
  SearchStatus,
  SessionFileEntry,
  SessionTree,
  WorkspaceSearchGroup,
} from '../types';
import { SearchPanel } from './SearchPanel';
import { SessionsPanel } from './SessionsPanel';

interface SidebarProps {
  sessionsTree: SessionTree | null;
  sessionsRoot: string;
  sessionsLoading: boolean;
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
  activeSession: SessionFileEntry | null;
  onRefreshSessions: () => void;
  activeWorkspace?: string | null;
  onClearWorkspace?: () => void;
}

const SidebarComponent = ({
  sessionsTree,
  sessionsRoot,
  sessionsLoading,
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
  activeSession,
  onRefreshSessions,
  activeWorkspace,
  onClearWorkspace,
}: SidebarProps) => {
  const renderStart = isRenderDebugEnabled ? performance.now() : 0;
  useRenderDebug('Sidebar', {
    sessionsLoading,
    searchQuery,
    searchStatus,
    searchGroupsCount: searchGroups.length,
    resultSort,
    groupSort,
    activeSessionId: activeSession?.id ?? null,
    activeWorkspace: activeWorkspace ?? null,
  });
  useWhyDidYouRender(
    'Sidebar',
    {
      sessionsTree,
      sessionsRoot,
      sessionsLoading,
      searchQuery,
      searchGroups,
      searchStatus,
      searchError,
      searchTooShort,
      resultSort,
      groupSort,
      activeSession,
      activeWorkspace,
      onSearchQueryChange,
      onSearchKeyDown,
      onResultSortChange,
      onGroupSortChange,
      onLoadSession,
      onRefreshSessions,
      onClearWorkspace,
    },
    { includeFunctions: true },
  );

  if (isRenderDebugEnabled) {
    // RAF captures layout/paint time for perceived cost, not just React render.
    requestAnimationFrame(() => {
      const duration = performance.now() - renderStart;
      console.debug('[render cost] Sidebar', { duration });
    });
  }

  return (
    <aside className="w-full max-w-none space-y-5 lg:w-[340px]">
      <SearchPanel
        searchQuery={searchQuery}
        onSearchQueryChange={onSearchQueryChange}
        onSearchKeyDown={onSearchKeyDown}
        onSearchPasteUuid={onSearchPasteUuid}
        searchGroups={searchGroups}
        searchStatus={searchStatus}
        searchError={searchError}
        searchTooShort={searchTooShort}
        resultSort={resultSort}
        groupSort={groupSort}
        onResultSortChange={onResultSortChange}
        onGroupSortChange={onGroupSortChange}
        onLoadSession={onLoadSession}
      />
      <SessionsPanel
        sessionsTree={sessionsTree}
        sessionsRoot={sessionsRoot}
        loading={sessionsLoading}
        onRefreshSessions={onRefreshSessions}
        onLoadSession={onLoadSession}
        activeSession={activeSession}
        activeWorkspace={activeWorkspace}
        onClearWorkspace={onClearWorkspace}
      />
    </aside>
  );
};

export const Sidebar = memo(SidebarComponent);
