import { type FormEvent, useEffect, useRef, useState } from 'react';

interface TurnJumpModalProps {
  open: boolean;
  totalTurns: number;
  currentTurnIndex: number;
  onClose: () => void;
  onJump: (requestedTurn: number) => void;
}

export const TurnJumpModal = ({ open, totalTurns, currentTurnIndex, onClose, onJump }: TurnJumpModalProps) => {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const didOpenRef = useRef(false);

  useEffect(() => {
    if (!open) {
      didOpenRef.current = false;
      return;
    }
    if (didOpenRef.current) return;
    didOpenRef.current = true;
    const initial = currentTurnIndex >= 0 && totalTurns > 0 ? String(Math.min(currentTurnIndex + 1, totalTurns)) : '';
    setValue(initial);
  }, [currentTurnIndex, open, totalTurns]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    if (!open) return;
    window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  }, [open]);

  if (!open) return null;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!totalTurns) return;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return;
    onJump(numeric);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="turn-jump-title"
        className="w-full max-w-sm rounded-3xl border border-white/70 bg-white p-4 shadow-soft"
      >
        <div className="flex items-center justify-between">
          <h3 id="turn-jump-title" className="text-base font-medium text-slate-900">
            Go to turn
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:text-slate-700"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-3 space-y-2">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span>Turn</span>
            <input
              ref={inputRef}
              id="turn-jump-input"
              type="number"
              min={1}
              max={Math.max(totalTurns, 1)}
              inputMode="numeric"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              disabled={!totalTurns}
              aria-label="Turn number"
              placeholder={totalTurns > 0 ? `1` : '—'}
              className="min-w-0 w-24 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700 focus:border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-200 disabled:cursor-not-allowed disabled:opacity-60"
            />
            <span>of</span>
            <span className="text-slate-500">{totalTurns > 0 ? totalTurns : '—'}</span>
          </div>
          <div className="text-[11px] text-slate-500">Enter to go · Esc to close</div>
        </form>
      </div>
    </div>
  );
};
