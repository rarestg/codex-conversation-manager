import { formatTimestamp } from '../format';
import type { ParsedItem, Turn } from '../types';
import { MessageCard } from './MessageCard';

interface TurnCardProps {
  turn: Turn;
  showFullContent: boolean;
  copiedId: string | null;
  onCopyItem: (item: ParsedItem, format: 'text' | 'markdown') => void;
}

export const TurnCard = ({ turn, showFullContent, copiedId, onCopyItem }: TurnCardProps) => {
  return (
    <section
      id={`turn-${turn.id}`}
      className="animate-rise rounded-3xl border border-white/80 bg-white/80 p-6 shadow-card"
    >
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
        {turn.items.map((item, itemIndex) => (
          <MessageCard
            key={item.id}
            item={item}
            itemIndex={itemIndex}
            showFullContent={showFullContent}
            copiedId={copiedId}
            onCopyItem={onCopyItem}
          />
        ))}
      </div>
    </section>
  );
};
