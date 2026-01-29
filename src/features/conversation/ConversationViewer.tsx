import { Home, Settings } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { CanvasView } from './CanvasView';
import { ConversationMain } from './ConversationMain';
import { SearchPanel } from './components/SearchPanel';
import { SessionsPanel } from './components/SessionsPanel';
import { SettingsModal } from './components/SettingsModal';
import { Sidebar } from './components/Sidebar';
import { WorkspacesPanel } from './components/WorkspacesPanel';
import { useRenderDebug } from './hooks/useRenderDebug';
import { useSearch } from './hooks/useSearch';
import { useSession } from './hooks/useSession';
import { useSessions } from './hooks/useSessions';
import { useUrlSync } from './hooks/useUrlSync';
import { useWorkspaces } from './hooks/useWorkspaces';
import { StickyTest } from './StickyTest';

export default function ConversationViewer() {
  const [apiError, setApiError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeWorkspace, setActiveWorkspace] = useState<string | null>(null);

  const {
    sessionsTree,
    sessionsRoot,
    setSessionsRoot,
    sessionsRootSource,
    loadSessions,
    saveRoot,
    reindex,
    rebuildIndex,
    loadingSessions,
    reindexing,
    clearingIndex,
    indexSummary,
  } = useSessions({ onError: setApiError, workspace: activeWorkspace });

  const {
    turns,
    parseErrors,
    activeSession,
    sessionDetails,
    activeSearchQuery,
    loadingSession,
    loadSession,
    clearSession,
    jumpToTurn,
    setSessionSearchQuery,
  } = useSession({
    sessionsTree,
    onError: setApiError,
  });

  const {
    searchQuery,
    setSearchQuery,
    clearSearch,
    searchGroups,
    searchStatus,
    searchError,
    searchTooShort,
    resultSort,
    setResultSort,
    groupSort,
    setGroupSort,
    handleSearchKeyDown,
    handleSearchPasteUuid,
  } = useSearch({
    onError: setApiError,
    onLoadSession: loadSession,
    workspace: activeWorkspace,
  });

  const {
    workspaces,
    loading: workspacesLoading,
    sort: workspacesSort,
    setSort: setWorkspacesSort,
    loadWorkspaces,
  } = useWorkspaces({ onError: setApiError });

  useUrlSync(loadSession, clearSession);

  useRenderDebug('ConversationViewer', {
    activeSessionId: activeSession?.id ?? null,
    activeWorkspace,
    settingsOpen,
    loadingSessions,
    loadingSession,
    workspacesLoading,
    workspacesSort,
    searchQuery,
    resultSort,
    groupSort,
    sessionsTreeRoot: sessionsTree?.root ?? null,
  });

  useEffect(() => {
    if (!activeSession || !activeWorkspace) return;
    setActiveWorkspace(null);
  }, [activeSession, activeWorkspace]);

  const handleClearIndex = useCallback(async () => {
    const confirmed = window.confirm('This will clear the index and rebuild it from scratch. Continue?');
    if (!confirmed) return;
    await rebuildIndex();
    await loadWorkspaces();
  }, [loadWorkspaces, rebuildIndex]);

  const handleSaveRoot = useCallback(async () => {
    await saveRoot();
    setActiveWorkspace(null);
    await loadWorkspaces();
  }, [loadWorkspaces, saveRoot]);

  const handleReindex = useCallback(async () => {
    await reindex();
    await loadWorkspaces();
  }, [loadWorkspaces, reindex]);

  const handleSelectWorkspace = useCallback((workspace: string) => {
    setActiveWorkspace((current) => (current === workspace ? null : workspace));
  }, []);

  const handleClearWorkspace = useCallback(() => {
    setActiveWorkspace(null);
  }, []);

  const locationPath = window.location.pathname.replace(/\/+$/, '') || '/';
  const isCanvas = locationPath === '/canvas' || locationPath === '/layouts';
  // Dev/QA route: keep /stickytest available for sticky behavior sanity checks.
  const isStickyTest = locationPath === '/stickytest';

  const handleGoHome = useCallback(() => {
    clearSession();
    const targetPath = isCanvas ? '/' : locationPath;
    window.history.pushState(null, '', `${targetPath}${window.location.hash || ''}`);
  }, [clearSession, isCanvas, locationPath]);

  const showHome = !activeSession && !loadingSession && !isCanvas && !isStickyTest;

  const headerClassName = showHome
    ? 'flex flex-col gap-3 rounded-3xl border border-white/70 bg-white/70 px-6 py-5 shadow-soft backdrop-blur'
    : 'flex flex-col gap-1 rounded-3xl border border-white/70 bg-white/70 px-5 py-3 shadow-soft backdrop-blur';

  const headerRowClassName = showHome
    ? 'flex flex-wrap items-center justify-between gap-4'
    : 'flex flex-wrap items-center justify-between gap-3';

  return (
    <div className="min-h-screen px-4 py-8 sm:px-8">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
        <header className={headerClassName}>
          <div className={headerRowClassName}>
            <div>
              <p
                className={
                  showHome
                    ? 'text-xs font-semibold uppercase tracking-[0.35em] text-teal-700'
                    : 'text-sm font-semibold uppercase tracking-[0.3em] text-teal-700'
                }
              >
                Codex Conversation Manager
              </p>
              {showHome && (
                <>
                  <h1 className="mt-2 text-3xl text-slate-900">Session Explorer & Conversation Viewer</h1>
                  <p className="mt-1 text-sm text-slate-600">
                    Browse local Codex JSONL sessions, inspect turns, and search across your own history.
                  </p>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!showHome && (
                <button
                  type="button"
                  onClick={handleGoHome}
                  title="Home (Cmd/Ctrl+Shift+H)"
                  aria-label="Home (Cmd/Ctrl+Shift+H)"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
                >
                  <Home className="h-4 w-4" />
                  Home
                </button>
              )}
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                aria-label="Open settings"
                title="Settings"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
              >
                <Settings className="h-4 w-4" />
              </button>
            </div>
          </div>
          {apiError && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {apiError}
            </div>
          )}
        </header>

        {isStickyTest ? (
          <StickyTest />
        ) : isCanvas ? (
          <CanvasView
            sessionsTree={sessionsTree}
            sessionsRoot={sessionsRoot}
            loadingSessions={loadingSessions}
            onRefreshSessions={loadSessions}
            onLoadSession={loadSession}
            activeSession={activeSession}
            sessionDetails={sessionDetails}
            turns={turns}
          />
        ) : showHome ? (
          <div className="flex flex-col gap-6">
            <SearchPanel
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              onClearSearch={clearSearch}
              onSearchKeyDown={handleSearchKeyDown}
              onSearchPasteUuid={handleSearchPasteUuid}
              activeWorkspace={activeWorkspace}
              onClearWorkspace={handleClearWorkspace}
              showWorkspaceFilter
              searchGroups={searchGroups}
              searchStatus={searchStatus}
              searchError={searchError}
              searchTooShort={searchTooShort}
              resultSort={resultSort}
              groupSort={groupSort}
              onResultSortChange={setResultSort}
              onGroupSortChange={setGroupSort}
              onLoadSession={loadSession}
            />
            <div className="grid gap-6 lg:grid-cols-2">
              <WorkspacesPanel
                workspaces={workspaces}
                loading={workspacesLoading}
                sort={workspacesSort}
                onSortChange={setWorkspacesSort}
                activeWorkspace={activeWorkspace}
                onSelectWorkspace={handleSelectWorkspace}
                onClearWorkspace={handleClearWorkspace}
              />
              <SessionsPanel
                sessionsTree={sessionsTree}
                sessionsRoot={sessionsRoot}
                loading={loadingSessions}
                onRefreshSessions={loadSessions}
                onLoadSession={loadSession}
                activeSession={activeSession}
                activeWorkspace={activeWorkspace}
                onClearWorkspace={handleClearWorkspace}
                showWorkspaceFilter
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6 lg:flex-row-reverse">
            <Sidebar
              sessionsTree={sessionsTree}
              sessionsRoot={sessionsRoot}
              sessionsLoading={loadingSessions}
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              onClearSearch={clearSearch}
              onSearchKeyDown={handleSearchKeyDown}
              onSearchPasteUuid={handleSearchPasteUuid}
              searchGroups={searchGroups}
              searchStatus={searchStatus}
              searchError={searchError}
              searchTooShort={searchTooShort}
              resultSort={resultSort}
              groupSort={groupSort}
              onResultSortChange={setResultSort}
              onGroupSortChange={setGroupSort}
              onLoadSession={loadSession}
              activeSession={activeSession}
              onRefreshSessions={loadSessions}
              activeWorkspace={activeWorkspace}
              onClearWorkspace={handleClearWorkspace}
            />

            <ConversationMain
              turns={turns}
              parseErrors={parseErrors}
              activeSession={activeSession}
              sessionDetails={sessionDetails}
              sessionsRoot={sessionsTree?.root || sessionsRoot}
              loadingSession={loadingSession}
              activeSearchQuery={activeSearchQuery}
              jumpToTurn={jumpToTurn}
              setSessionSearchQuery={setSessionSearchQuery}
              onGoHome={handleGoHome}
            />
          </div>
        )}
      </div>

      <SettingsModal
        open={settingsOpen}
        sessionsRoot={sessionsRoot}
        sessionsRootSource={sessionsRootSource}
        indexSummary={indexSummary}
        reindexing={reindexing}
        clearingIndex={clearingIndex}
        onSessionsRootChange={setSessionsRoot}
        onSaveRoot={handleSaveRoot}
        onReindex={handleReindex}
        onClearIndex={handleClearIndex}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
