import { type KeyboardEvent, memo } from 'react';
import type { SessionFileEntry, SessionTree, WorkspaceSearchGroup } from '../types';
import { SearchPanel } from './SearchPanel';
import { SessionsPanel } from './SessionsPanel';

interface SidebarProps {
  sessionsTree: SessionTree | null;
  sessionsRoot: string;
  sessionsLoading: boolean;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onSearchKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  searchGroups: WorkspaceSearchGroup[];
  searchLoading: boolean;
  onLoadSession: (sessionId: string, turnId?: number) => void;
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
  searchGroups,
  searchLoading,
  onLoadSession,
  activeSession,
  onRefreshSessions,
  activeWorkspace,
  onClearWorkspace,
}: SidebarProps) => {
  return (
    <aside className="w-full max-w-none space-y-5 lg:w-[340px]">
      <SearchPanel
        searchQuery={searchQuery}
        onSearchQueryChange={onSearchQueryChange}
        onSearchKeyDown={onSearchKeyDown}
        searchGroups={searchGroups}
        searchLoading={searchLoading}
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
