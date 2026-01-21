interface SettingsModalProps {
  open: boolean
  sessionsRoot: string
  sessionsRootSource: string
  indexSummary: string
  reindexing: boolean
  clearingIndex: boolean
  onSessionsRootChange: (value: string) => void
  onSaveRoot: () => void
  onReindex: () => void
  onClearIndex: () => void
  onClose: () => void
}

export const SettingsModal = ({
  open,
  sessionsRoot,
  sessionsRootSource,
  indexSummary,
  reindexing,
  clearingIndex,
  onSessionsRootChange,
  onSaveRoot,
  onReindex,
  onClearIndex,
  onClose,
}: SettingsModalProps) => {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-lg rounded-3xl border border-white/70 bg-white p-6 shadow-soft">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl text-slate-900">Settings</h3>
            <p className="text-xs text-slate-500">Manage session root and indexing.</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-500 hover:text-slate-700"
          >
            Close
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Sessions root ({sessionsRootSource || 'custom'})
            </label>
            <input
              value={sessionsRoot}
              onChange={(event) => onSessionsRootChange(event.target.value)}
              disabled={sessionsRootSource === 'env'}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700 focus:border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-200 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={onSaveRoot}
              disabled={sessionsRootSource === 'env'}
              className="rounded-full border border-teal-200 bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              Save root
            </button>
            <button
              onClick={onReindex}
              disabled={reindexing || clearingIndex}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm disabled:opacity-60"
            >
              {reindexing ? 'Reindexing…' : 'Reindex'}
            </button>
            <button
              onClick={onClearIndex}
              disabled={clearingIndex || reindexing}
              className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 shadow-sm disabled:opacity-60"
            >
              {clearingIndex ? 'Clearing…' : 'Clear & rebuild'}
            </button>
          </div>
          {indexSummary && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
              {indexSummary}
            </div>
          )}
          {sessionsRootSource === 'env' && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
              CODEX_SESSIONS_ROOT is set via environment variable. Update it in your shell to change the root.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
