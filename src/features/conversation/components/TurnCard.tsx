import { formatTimestamp } from '../format';
import type { Turn } from '../types';
import { MessageCard } from './MessageCard';

interface TurnCardProps {
  turn: Turn;
  showFullContent: boolean;
  highlightTokens?: string[];
  isMatch?: boolean;
}

export const TurnCard = ({ turn, showFullContent, highlightTokens, isMatch }: TurnCardProps) => {
  return (
    <section
      id={`turn-${turn.id}`}
      className="relative animate-rise rounded-3xl border border-white/80 bg-white/80 p-6 shadow-card"
    >
      <span data-turn-anchor={turn.id} className="absolute inset-x-0 top-0 h-px" aria-hidden="true" />
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-600">
            {turn.isPreamble ? 'Session Preamble' : `Turn ${turn.id}`}
          </p>
          {turn.startedAt && <p className="text-xs text-slate-500">{formatTimestamp(turn.startedAt)}</p>}
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">{turn.items.length} items</span>
      </div>

      <div className="mt-4 space-y-4">
        {turn.items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-4 text-xs text-slate-500">
            All items hidden by filters.
          </div>
        ) : (
          turn.items.map((item, itemIndex) => (
            <MessageCard
              key={item.id}
              item={item}
              itemIndex={itemIndex}
              showFullContent={showFullContent}
              highlightTokens={isMatch ? highlightTokens : undefined}
            />
          ))
        )}
      </div>
    </section>
  );
};
