import { Home, Settings } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { CanvasView } from './CanvasView';
import { ConversationMain } from './ConversationMain';
import { SessionCatalogPane } from './components/SessionCatalogPane';
import { SettingsModal } from './components/SettingsModal';
import { useRenderDebug } from './hooks/useRenderDebug';
import { useSession } from './hooks/useSession';
import { useSessions } from './hooks/useSessions';
import { useUrlSync } from './hooks/useUrlSync';
import { StickyTest } from './StickyTest';

const bumpRefreshKey = (value: number) => value + 1;

export default function ConversationViewer() {
  const [apiError, setApiError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [catalogRefreshKey, setCatalogRefreshKey] = useState(0);

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
  } = useSessions({ onError: setApiError });

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

  useUrlSync(loadSession, clearSession);

  useRenderDebug('ConversationViewer', {
    activeSessionId: activeSession?.id ?? null,
    settingsOpen,
    loadingSessions,
    loadingSession,
    sessionsTreeRoot: sessionsTree?.root ?? null,
    catalogRefreshKey,
  });

  const refreshCatalog = useCallback(() => {
    setCatalogRefreshKey(bumpRefreshKey);
  }, []);

  const handleClearIndex = useCallback(async () => {
    const confirmed = window.confirm('This will clear the index and rebuild it from scratch. Continue?');
    if (!confirmed) return;
    await rebuildIndex();
    refreshCatalog();
  }, [rebuildIndex, refreshCatalog]);

  const handleSaveRoot = useCallback(async () => {
    await saveRoot();
    clearSession();
    refreshCatalog();
  }, [clearSession, refreshCatalog, saveRoot]);

  const handleReindex = useCallback(async () => {
    await reindex();
    refreshCatalog();
  }, [refreshCatalog, reindex]);

  const locationPath = window.location.pathname.replace(/\/+$/, '') || '/';
  const isCanvas = locationPath === '/canvas' || locationPath === '/layouts';
  const isStickyTest = locationPath === '/stickytest';
  const isPrimaryShell = !isCanvas && !isStickyTest;

  const handleGoHome = useCallback(() => {
    clearSession();
    const targetPath = isCanvas ? '/' : locationPath;
    window.history.pushState(null, '', `${targetPath}${window.location.hash || ''}`);
  }, [clearSession, isCanvas, locationPath]);

  const title = isStickyTest ? 'Sticky sandbox' : isCanvas ? 'Layout canvas' : 'Session Catalog & Conversation Viewer';
  const subtitle = isStickyTest
    ? 'Sticky positioning and overflow test surface.'
    : isCanvas
      ? 'Dev-only comparison routes and layout experiments.'
      : 'Browse indexed Codex sessions on the left and inspect the active conversation on the right.';

  return (
    <div className="min-h-screen px-4 py-8 sm:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-[1600px] flex-col gap-6">
        <header className="flex flex-col gap-3 rounded-3xl border border-white/70 bg-white/70 px-6 py-5 shadow-soft backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-teal-700">
                Codex Conversation Manager
              </p>
              <h1 className="mt-2 text-3xl text-slate-900">{title}</h1>
              <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
            </div>
            <div className="flex items-center gap-2">
              {isPrimaryShell && (activeSession || loadingSession) ? (
                <button
                  type="button"
                  onClick={handleGoHome}
                  title="Back to catalog (Cmd/Ctrl+Shift+H)"
                  aria-label="Back to catalog (Cmd/Ctrl+Shift+H)"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
                >
                  <Home className="h-4 w-4" />
                  Catalog
                </button>
              ) : null}
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
          {apiError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {apiError}
            </div>
          ) : null}
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
        ) : (
          <div className="min-h-0 flex-1">
            <Group orientation="horizontal" id="conversation-shell-layout" className="h-full min-h-0">
              <Panel id="catalog-pane" defaultSize="42%" minSize="28%" className="min-w-0">
                <SessionCatalogPane
                  activeSessionId={activeSession?.id ?? null}
                  loadingSession={loadingSession}
                  onLoadSession={loadSession}
                  refreshKey={catalogRefreshKey}
                />
              </Panel>

              <Separator className="group relative mx-2 w-2 shrink-0 focus:outline-none focus-visible:outline-none">
                <div className="absolute inset-y-2 left-1/2 w-px -translate-x-1/2 rounded-full bg-slate-300 transition group-hover:bg-teal-400 group-data-[resize-handle-state=drag]:bg-teal-500" />
              </Separator>

              <Panel id="detail-pane" defaultSize="58%" minSize="32%" className="min-w-0">
                <div className="h-full overflow-auto rounded-3xl border border-white/70 bg-white/80 px-4 py-4 shadow-card backdrop-blur sm:px-5 sm:py-5">
                  {activeSession || loadingSession ? (
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
                  ) : (
                    <div className="flex h-full min-h-[560px] items-center justify-center">
                      <div className="max-w-xl rounded-3xl border border-dashed border-slate-200 bg-white/60 px-8 py-10 text-center">
                        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-700">Ready</p>
                        <h2 className="mt-3 text-2xl text-slate-900">Select a session from the catalog</h2>
                        <p className="mt-3 text-sm leading-6 text-slate-600">
                          The catalog pane stays visible on the left. Use content search, locator lookup, sorting, and
                          paging to narrow the list, then open any session on the right without leaving the shell.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </Panel>
            </Group>
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
