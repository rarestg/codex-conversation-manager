import { ArrowDownWideNarrow, Keyboard } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { TurnJumpModal } from './components/TurnJumpModal';

const filler = Array.from({ length: 24 }, (_, index) => `Header line ${index + 1}`);
const rows = Array.from({ length: 80 }, (_, index) => `Row ${index + 1}`);
const mockSessions = Array.from({ length: 6 }, (_, index) => `Session row ${index + 1}`);

const isEditableElement = (target: EventTarget | null) => {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
};

export const StickyTest = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [activeRowIndex, setActiveRowIndex] = useState(0);
  const [jumpOpen, setJumpOpen] = useState(false);
  const totalRows = rows.length;

  const scrollToRow = useCallback(
    (index: number, behavior: ScrollBehavior = 'smooth') => {
      const clamped = Math.min(Math.max(index, 0), totalRows - 1);
      setActiveRowIndex(clamped);
      const element = document.getElementById(`sticky-row-${clamped + 1}`);
      if (element) {
        element.scrollIntoView({ behavior, block: 'start' });
      }
    },
    [totalRows],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (isEditableElement(event.target)) return;

      if (containerRef.current) {
        const activeElement = document.activeElement;
        const targetNode = event.target instanceof Node ? event.target : null;
        const containsTarget = targetNode ? containerRef.current.contains(targetNode) : false;
        const containsActive = activeElement ? containerRef.current.contains(activeElement) : false;
        if (!containsTarget && !containsActive) return;
      }

      const isGoTo = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      if (isGoTo) {
        event.preventDefault();
        setJumpOpen(true);
        return;
      }

      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const delta = event.key === 'ArrowRight' ? 1 : -1;
      scrollToRow(activeRowIndex + delta);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeRowIndex, scrollToRow]);

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-24">
      <div className="flex flex-col gap-6 lg:flex-row-reverse">
        <aside className="w-full max-w-none space-y-5 lg:w-[340px]">
          <section className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-card backdrop-blur">
            <div className="flex flex-col gap-3">
              <div>
                <h2 className="text-lg text-slate-900">Search panel (mock)</h2>
                <p className="text-xs text-slate-500">Mimics sidebar search size.</p>
              </div>
              <div className="flex flex-col gap-3">
                <div className="h-9 rounded-2xl border border-slate-200 bg-white" />
                <div className="flex flex-col gap-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Sort disclosure variants
                  </div>
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-medium text-slate-500">Variant A: current</span>
                      {/* Winner: best weight/scanability for a disclosure control; matches current SearchPanel. */}
                      <details open className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <summary className="flex items-center justify-between px-3 py-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                              <ArrowDownWideNarrow className="h-3 w-3" />
                              Sort
                            </div>
                            <div className="truncate text-xs text-slate-700">Relevance · Last active</div>
                          </div>
                          <span className="ml-3 text-slate-400">▾</span>
                        </summary>
                        <div className="grid gap-3 p-3">
                          <div className="flex flex-col items-start gap-1">
                            <span className="text-[11px] font-semibold text-slate-500">Results</span>
                            <select className="w-full rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 shadow-sm">
                              <option>Relevance</option>
                              <option>Most matches</option>
                              <option>Most recent</option>
                            </select>
                          </div>
                          <div className="flex flex-col items-start gap-1">
                            <span className="text-[11px] font-semibold text-slate-500">Workspaces</span>
                            <select className="w-full rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 shadow-sm">
                              <option>Last active</option>
                              <option>Most matches</option>
                            </select>
                          </div>
                        </div>
                      </details>
                    </div>
                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-medium text-slate-500">Variant B: slim summary row</span>
                      {/* Loses weight and feels less like a control; useful for tight layouts but not preferred. */}
                      <details open className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <summary className="flex items-center justify-between px-3 py-1">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                              <ArrowDownWideNarrow className="h-3 w-3" />
                              Sort
                            </div>
                            <div className="truncate text-xs text-slate-700">Relevance · Last active</div>
                          </div>
                          <span className="ml-3 text-slate-400">▾</span>
                        </summary>
                        <div className="grid gap-3 p-3">
                          <div className="flex flex-col items-start gap-1">
                            <span className="text-[11px] font-semibold text-slate-500">Results</span>
                            <select className="w-full rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 shadow-sm">
                              <option>Relevance</option>
                              <option>Most matches</option>
                              <option>Most recent</option>
                            </select>
                          </div>
                          <div className="flex flex-col items-start gap-1">
                            <span className="text-[11px] font-semibold text-slate-500">Workspaces</span>
                            <select className="w-full rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 shadow-sm">
                              <option>Last active</option>
                              <option>Most matches</option>
                            </select>
                          </div>
                        </div>
                      </details>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
          <section className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-card backdrop-blur">
            <h2 className="text-lg text-slate-900">Sessions panel (mock)</h2>
            <p className="mt-1 text-xs text-slate-500">Mimics session list height.</p>
            <div className="mt-4 space-y-3">
              {mockSessions.map((label) => (
                <div
                  key={label}
                  className="rounded-2xl border border-slate-100 bg-white px-4 py-3 text-xs text-slate-500 shadow-sm"
                >
                  {label}
                </div>
              ))}
            </div>
          </section>
        </aside>

        <div
          ref={containerRef}
          tabIndex={-1}
          onPointerDown={(event) => {
            const target = event.target as HTMLElement | null;
            if (!target) return;
            if (target.closest('button, a, input, textarea, select, [contenteditable="true"]')) return;
            containerRef.current?.focus({ preventScroll: true });
          }}
          className="flex-1 space-y-6 focus:outline-none focus-visible:outline-none"
        >
          {/* Sticky anchors to the nearest ancestor that spans the scrollable area. */}
          <section className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-card backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">Sticky Test</p>
            <h1 className="mt-3 text-2xl text-slate-900">Header block (tall)</h1>
            <div className="mt-4 space-y-2 text-sm text-slate-600">
              {filler.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </section>

          {/* This sticky bar is inside a short wrapper, so it cannot stick once the wrapper scrolls out. */}
          <section className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-card backdrop-blur">
            <h2 className="text-lg text-slate-900">Sticky inside header-only wrapper (fails by design)</h2>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-700 shadow-sm">
                This sticky bar should stop sticking once you scroll past this section.
              </div>
              {/* Sticky is bounded by this section's box, so it cannot persist below it. */}
              <div className="sticky top-[calc(env(safe-area-inset-top)+0.75rem)] rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm">
                Sticky bar (contained)
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-card backdrop-blur">
            <h2 className="text-lg text-slate-900">Sticky in full column (works)</h2>
            <p className="mt-2 text-sm text-slate-500">
              The bar below is a sibling of the header and the list, so it stays within the full scroll column and can
              stick with a gap.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
              <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                <Keyboard className="h-3.5 w-3.5" />
                Shortcuts
              </span>
              <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white/70 px-2 py-0.5 text-[11px] text-slate-600 shadow-sm">
                ←
              </span>
              <span className="text-[11px] text-slate-500">Prev row</span>
              <span className="text-slate-300">·</span>
              <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white/70 px-2 py-0.5 text-[11px] text-slate-600 shadow-sm">
                →
              </span>
              <span className="text-[11px] text-slate-500">Next row</span>
              <span className="text-slate-300">·</span>
              <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white/70 px-2 py-0.5 text-[11px] text-slate-600 shadow-sm">
                ⌘K / Ctrl+K
              </span>
              <span className="text-[11px] text-slate-500">Go to row</span>
            </div>
          </section>

          {/* This sticky bar is placed in the full column flow so it sticks for the entire scroll. */}
          <div className="sticky top-[calc(env(safe-area-inset-top)+0.75rem)] z-20 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700 shadow-sm">
            Sticky bar (full column)
          </div>

          <div className="space-y-3">
            {rows.map((row, index) => {
              const isActive = index === activeRowIndex;
              return (
                <div
                  key={row}
                  id={`sticky-row-${index + 1}`}
                  className={[
                    'rounded-2xl border px-4 py-3 text-sm shadow-sm',
                    isActive
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border-slate-100 bg-white text-slate-700',
                  ].join(' ')}
                >
                  {row}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <TurnJumpModal
        open={jumpOpen}
        totalTurns={totalRows}
        currentTurnIndex={activeRowIndex}
        onClose={() => setJumpOpen(false)}
        onJump={(requestedTurn) => {
          const numeric = Math.round(requestedTurn);
          scrollToRow(numeric - 1);
          setJumpOpen(false);
        }}
      />
    </div>
  );
};
