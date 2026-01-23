import { useMemo, useState } from 'react';
import { canvasDemos } from './canvas/registry';
import type { CanvasContext, CanvasDemoVariant } from './canvas/types';
import { formatDate, formatTime } from './format';
import type { SessionDetails, SessionFileEntry, SessionTree, Turn } from './types';

interface CanvasViewProps {
  sessionsTree: SessionTree | null;
  sessionsRoot: string;
  loadingSessions: boolean;
  onRefreshSessions: () => void;
  onLoadSession: (sessionId: string, turnId?: number) => void;
  activeSession: SessionFileEntry | null;
  sessionDetails: SessionDetails;
  turns: Turn[];
}

const flattenSessions = (tree: SessionTree | null): SessionFileEntry[] => {
  if (!tree) return [];
  const entries: SessionFileEntry[] = [];
  for (const year of tree.years) {
    for (const month of year.months) {
      for (const day of month.days) {
        entries.push(...day.files);
      }
    }
  }
  return entries;
};

const formatSessionOption = (file: SessionFileEntry) => {
  const rawTitle = file.preview?.trim() || file.filename || 'Session';
  const title = rawTitle.replace(/\s+/g, ' ').trim();
  const trimmedTitle = title.length > 80 ? `${title.slice(0, 77)}...` : title;
  const timeSource = file.startedAt ?? file.timestamp ?? '';
  const timeLabel = timeSource ? `${formatDate(timeSource)} ${formatTime(timeSource)}` : '';
  return timeLabel ? `${trimmedTitle} · ${timeLabel}` : trimmedTitle;
};

const buildDefaultVariantSelection = () => {
  const selections: Record<string, string[]> = {};
  for (const demo of canvasDemos) {
    selections[demo.id] = demo.variants.map((variant) => variant.id);
  }
  return selections;
};

interface CanvasVariantCardProps {
  variant: CanvasDemoVariant;
  context: CanvasContext;
}

const CanvasVariantCard = ({ variant, context }: CanvasVariantCardProps) => {
  const VariantComponent = variant.Component;
  return <VariantComponent context={context} />;
};

export const CanvasView = ({
  sessionsTree,
  sessionsRoot,
  loadingSessions,
  onRefreshSessions,
  onLoadSession,
  activeSession,
  sessionDetails,
  turns,
}: CanvasViewProps) => {
  const [activeDemoId, setActiveDemoId] = useState<string>(canvasDemos[0]?.id ?? '');
  const [activeVariantsByDemo, setActiveVariantsByDemo] =
    useState<Record<string, string[]>>(buildDefaultVariantSelection);
  const sessionOptions = useMemo(() => flattenSessions(sessionsTree), [sessionsTree]);
  const activeDemo = useMemo(
    () => canvasDemos.find((demo) => demo.id === activeDemoId) ?? canvasDemos[0],
    [activeDemoId],
  );

  if (!activeDemo) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-200 bg-white/70 p-6 text-sm text-slate-500">
        No canvas demos registered yet.
      </div>
    );
  }

  const selectedVariantIds = new Set(
    activeVariantsByDemo[activeDemo.id] ?? activeDemo.variants.map((variant) => variant.id),
  );
  const selectedVariants = activeDemo.variants.filter((variant) => selectedVariantIds.has(variant.id));
  const allVariantsSelected = selectedVariants.length === activeDemo.variants.length && activeDemo.variants.length > 0;
  const demoRequiresSession = activeDemo.requiresSessionData ?? false;
  const demoTurns = demoRequiresSession ? turns : [];
  const demoSession = demoRequiresSession ? activeSession : null;
  const demoSessionDetails = demoRequiresSession ? sessionDetails : {};
  const resolvedSessionsRoot = sessionsTree?.root || sessionsRoot;
  const variantGridClassName =
    selectedVariants.length > 1 ? 'grid gap-6 grid-cols-1 lg:grid-cols-2 items-start' : 'grid gap-6 grid-cols-1';
  const canvasContext: CanvasContext = {
    activeSession: demoSession,
    sessionDetails: demoSessionDetails,
    sessionsRoot: resolvedSessionsRoot,
    turns: demoTurns,
    hasSessionData: Boolean(demoSession),
  };

  const handleToggleVariant = (variantId: string) => {
    setActiveVariantsByDemo((current) => {
      const currentSelection = new Set(current[activeDemo.id] ?? activeDemo.variants.map((variant) => variant.id));
      if (currentSelection.has(variantId)) {
        currentSelection.delete(variantId);
      } else {
        currentSelection.add(variantId);
      }
      return { ...current, [activeDemo.id]: Array.from(currentSelection) };
    });
  };

  const handleToggleAllVariants = () => {
    setActiveVariantsByDemo((current) => {
      const currentSelection = new Set(current[activeDemo.id] ?? activeDemo.variants.map((variant) => variant.id));
      const shouldSelectAll = !activeDemo.variants.every((variant) => currentSelection.has(variant.id));
      return {
        ...current,
        [activeDemo.id]: shouldSelectAll ? activeDemo.variants.map((variant) => variant.id) : [],
      };
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-card backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-teal-700">Layout canvas</p>
            <h2 className="mt-2 text-xl text-slate-900">{activeDemo.label}</h2>
            <p className="mt-1 text-sm text-slate-600">
              {activeDemo.description ?? 'Pick a demo to compare variants side by side.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRefreshSessions}
              disabled={loadingSessions}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900 disabled:opacity-50"
            >
              {loadingSessions ? 'Refreshing…' : 'Refresh sessions'}
            </button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500" htmlFor="canvas-demo">
              Demo
            </label>
            <select
              id="canvas-demo"
              value={activeDemoId}
              onChange={(event) => setActiveDemoId(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-200"
            >
              {canvasDemos.map((demo) => (
                <option key={demo.id} value={demo.id}>
                  {demo.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end justify-end text-xs text-slate-500">
            {demoRequiresSession
              ? sessionsTree?.root
                ? `Root: ${sessionsTree.root}`
                : 'No sessions root loaded yet.'
              : 'No session data needed.'}
          </div>
        </div>
        {demoRequiresSession ? (
          <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
            <div className="space-y-2">
              <label
                className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500"
                htmlFor="canvas-session"
              >
                Session file
              </label>
              <select
                id="canvas-session"
                value={demoSession?.id ?? ''}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value) {
                    onLoadSession(value);
                  }
                }}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-200"
              >
                <option value="">Select a session…</option>
                {sessionOptions.map((file) => (
                  <option key={file.id} value={file.id}>
                    {formatSessionOption(file)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end justify-end text-xs text-slate-500">
              {demoSession ? 'Loaded from session data.' : 'Select a session to preview.'}
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-xs text-slate-500">
            No session data needed for this demo.
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Variants</span>
          <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-slate-200 bg-white p-1 text-xs text-slate-600 shadow-sm">
            <button
              type="button"
              onClick={handleToggleAllVariants}
              className={
                allVariantsSelected
                  ? 'rounded-full bg-teal-600 px-3 py-1 font-semibold text-white'
                  : 'rounded-full px-3 py-1 font-semibold text-slate-600 hover:text-slate-800'
              }
            >
              All
            </button>
            {activeDemo.variants.map((variant) => {
              const isSelected = selectedVariantIds.has(variant.id);
              return (
                <button
                  key={variant.id}
                  type="button"
                  onClick={() => handleToggleVariant(variant.id)}
                  className={
                    isSelected
                      ? 'rounded-full bg-teal-600 px-3 py-1 font-semibold text-white'
                      : 'rounded-full px-3 py-1 font-semibold text-slate-600 hover:text-slate-800'
                  }
                >
                  {variant.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {selectedVariants.length ? (
        <div className={variantGridClassName}>
          {selectedVariants.map((variant) => (
            <div key={variant.id} className="min-w-0">
              <CanvasVariantCard variant={variant} context={canvasContext} />
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white/70 px-6 py-8 text-center text-sm text-slate-500">
          Select at least one variant to render.
        </div>
      )}
    </div>
  );
};
