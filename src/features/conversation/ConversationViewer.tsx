import { useMemo, useState } from 'react';
import { SearchPanel } from './components/SearchPanel';
import { SessionHeader } from './components/SessionHeader';
import { SessionsPanel } from './components/SessionsPanel';
import { SettingsModal } from './components/SettingsModal';
import { Sidebar } from './components/Sidebar';
import { Toggle } from './components/Toggle';
import { TurnList } from './components/TurnList';
import { WorkspacesPanel } from './components/WorkspacesPanel';
import { buildConversationExport, copyText } from './copy';
import { useCopyFeedback } from './hooks/useCopyFeedback';
import { useSearch } from './hooks/useSearch';
import { useSession } from './hooks/useSession';
import { useSessions } from './hooks/useSessions';
import { useUrlSync } from './hooks/useUrlSync';
import { useWorkspaces } from './hooks/useWorkspaces';
import { markdownToPlainText } from './markdown';
import type { ParsedItem } from './types';

export default function ConversationViewer() {
  const [showThoughts, setShowThoughts] = useState(true);
  const [showTools, setShowTools] = useState(true);
  const [showMeta, setShowMeta] = useState(false);
  const [showFullContent, setShowFullContent] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const { copiedId, showCopied } = useCopyFeedback();
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
    reindexing,
    clearingIndex,
    indexSummary,
  } = useSessions({ onError: setApiError, workspace: activeWorkspace });

  const { turns, parseErrors, activeSession, sessionDetails, loadingSession, loadSession, clearSession } = useSession({
    sessionsTree,
    onError: setApiError,
  });

  const { searchQuery, setSearchQuery, searchGroups, searchLoading, handleSearchKeyDown } = useSearch({
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

  const filteredTurns = useMemo(() => {
    return turns.map((turn) => {
      const items = turn.items.filter((item) => {
        if (item.type === 'thought' && !showThoughts) return false;
        if ((item.type === 'tool_call' || item.type === 'tool_output') && !showTools) return false;
        if ((item.type === 'meta' || item.type === 'token_count') && !showMeta) return false;
        return true;
      });
      return { ...turn, items };
    });
  }, [turns, showThoughts, showTools, showMeta]);

  const visibleItemCount = useMemo(() => {
    return filteredTurns.reduce((count, turn) => count + turn.items.length, 0);
  }, [filteredTurns]);

  const handleCopyConversation = async () => {
    const formatted = buildConversationExport(filteredTurns);
    await copyText(formatted);
    showCopied('conversation', 2000);
  };

  const handleCopyItem = async (item: ParsedItem, format: 'text' | 'markdown') => {
    const raw = item.content;
    const text = format === 'text' ? await markdownToPlainText(raw) : raw;
    await copyText(text);
    showCopied(item.id + format, 1500);
  };

  const handleCopyMeta = async (value: string, id: string) => {
    await copyText(value);
    showCopied(id, 1500);
  };

  const handleClearIndex = async () => {
    const confirmed = window.confirm('This will clear the index and rebuild it from scratch. Continue?');
    if (!confirmed) return;
    await rebuildIndex();
    await loadWorkspaces();
  };

  const handleSaveRoot = async () => {
    await saveRoot();
    setActiveWorkspace(null);
    await loadWorkspaces();
  };

  const handleReindex = async () => {
    await reindex();
    await loadWorkspaces();
  };

  const handleSelectWorkspace = (workspace: string) => {
    setActiveWorkspace((current) => (current === workspace ? null : workspace));
  };

  const handleClearWorkspace = () => {
    setActiveWorkspace(null);
  };

  const showHome = !activeSession;

  return (
    <div className="min-h-screen px-4 py-8 sm:px-8">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
        <header className="flex flex-col gap-3 rounded-3xl border border-white/70 bg-white/70 px-6 py-5 shadow-soft backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-teal-700">
                Codex Conversation Manager
              </p>
              <h1 className="mt-2 text-3xl text-slate-900">Session Explorer & Conversation Viewer</h1>
              <p className="mt-1 text-sm text-slate-600">
                Browse local Codex JSONL sessions, inspect turns, and search across your own history.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
            >
              Settings
            </button>
          </div>
          {apiError && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {apiError}
            </div>
          )}
        </header>

        {showHome ? (
          <div className="flex flex-col gap-6">
            <SearchPanel
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              onSearchKeyDown={handleSearchKeyDown}
              searchGroups={searchGroups}
              searchLoading={searchLoading}
              onLoadSession={loadSession}
            />
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]">
              <SessionsPanel
                sessionsTree={sessionsTree}
                sessionsRoot={sessionsRoot}
                onRefreshSessions={loadSessions}
                onLoadSession={loadSession}
                activeSession={activeSession}
                activeWorkspace={activeWorkspace}
                onClearWorkspace={handleClearWorkspace}
              />
              <WorkspacesPanel
                workspaces={workspaces}
                loading={workspacesLoading}
                sort={workspacesSort}
                onSortChange={setWorkspacesSort}
                activeWorkspace={activeWorkspace}
                onSelectWorkspace={handleSelectWorkspace}
                onClearWorkspace={handleClearWorkspace}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6 lg:flex-row">
            <Sidebar
              sessionsTree={sessionsTree}
              sessionsRoot={sessionsRoot}
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              onSearchKeyDown={handleSearchKeyDown}
              searchGroups={searchGroups}
              searchLoading={searchLoading}
              onLoadSession={loadSession}
              activeSession={activeSession}
              onRefreshSessions={loadSessions}
              activeWorkspace={activeWorkspace}
              onClearWorkspace={handleClearWorkspace}
            />

            <main className="flex-1 min-w-0 space-y-6">
              <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-card backdrop-blur">
                <SessionHeader
                  activeSession={activeSession}
                  sessionDetails={sessionDetails}
                  visibleItemCount={visibleItemCount}
                  copiedId={copiedId}
                  onCopyConversation={handleCopyConversation}
                  onCopyMeta={handleCopyMeta}
                />

                <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <Toggle
                    label="Show thoughts"
                    description="Include agent reasoning inline."
                    checked={showThoughts}
                    onChange={setShowThoughts}
                  />
                  <Toggle
                    label="Show tools"
                    description="Tool calls and outputs inline."
                    checked={showTools}
                    onChange={setShowTools}
                  />
                  <Toggle
                    label="Show metadata"
                    description="turn_context, session_meta, token_count."
                    checked={showMeta}
                    onChange={setShowMeta}
                  />
                  <Toggle
                    label="Show full content"
                    description="Disable truncation for long messages."
                    checked={showFullContent}
                    onChange={setShowFullContent}
                  />
                </div>
              </div>

              <TurnList
                filteredTurns={filteredTurns}
                loadingSession={loadingSession}
                activeSession={activeSession}
                parseErrors={parseErrors}
                showFullContent={showFullContent}
                copiedId={copiedId}
                onCopyItem={handleCopyItem}
              />
            </main>
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
