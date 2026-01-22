import { formatTimestamp, formatWorkspacePath } from '../format';
import type { SessionDetails, SessionFileEntry } from '../types';

interface SessionHeaderProps {
  activeSession: SessionFileEntry | null;
  sessionDetails: SessionDetails;
  visibleItemCount: number;
  copiedId: string | null;
  onCopyConversation: () => void;
  onCopyMeta: (value: string, id: string) => void;
}

export const SessionHeader = ({
  activeSession,
  sessionDetails,
  visibleItemCount,
  copiedId,
  onCopyConversation,
  onCopyMeta,
}: SessionHeaderProps) => {
  const sessionId = sessionDetails.sessionId;
  const cwd = sessionDetails.cwd;

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="min-w-0 space-y-2">
        <h2 className="text-xl text-slate-900">{activeSession ? activeSession.filename : 'Session viewer'}</h2>
        <p className="text-xs text-slate-500">
          {activeSession?.timestamp
            ? `Session: ${formatTimestamp(activeSession.timestamp)}`
            : 'Select a session to start.'}
        </p>
        {(sessionId || cwd) && (
          <div className="grid gap-2 text-xs sm:grid-cols-2">
            {sessionId && (
              <div className="chip">
                <span className="chip-label">Session</span>
                <span className="chip-value" title={sessionId}>
                  {sessionId}
                </span>
                <button type="button" onClick={() => onCopyMeta(sessionId, 'session-id')} className="chip-action">
                  {copiedId === 'session-id' ? 'Copied' : 'Copy'}
                </button>
              </div>
            )}
            {cwd && (
              <div className="chip">
                <span className="chip-label">Dir</span>
                <span className="chip-value" title={cwd}>
                  {formatWorkspacePath(cwd)}
                </span>
                <button type="button" onClick={() => onCopyMeta(cwd, 'session-cwd')} className="chip-action">
                  {copiedId === 'session-cwd' ? 'Copied' : 'Copy'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
          {visibleItemCount} visible items
        </span>
        <button
          type="button"
          onClick={onCopyConversation}
          disabled={!visibleItemCount}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900 disabled:opacity-50"
        >
          {copiedId === 'conversation' ? 'Copied' : 'Copy conversation'}
        </button>
      </div>
    </div>
  );
};
