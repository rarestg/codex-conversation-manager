import type { CSSProperties } from 'react';
import { MAX_PREVIEW_CHARS } from '../format';
import { MarkdownBlock } from '../markdown';
import type { ParsedItem } from '../types';

interface MessageCardProps {
  item: ParsedItem;
  itemIndex: number;
  showFullContent: boolean;
  copiedId: string | null;
  onCopyItem: (item: ParsedItem, format: 'text' | 'markdown') => void;
}

export const MessageCard = ({ item, itemIndex, showFullContent, copiedId, onCopyItem }: MessageCardProps) => {
  if (import.meta.env.DEV && itemIndex === 0) {
    console.debug('[render] MessageCard', { id: item.id, type: item.type, copiedId });
  }
  const isMarkdownItem = ['user', 'assistant', 'thought'].includes(item.type);
  const displayContent = item.content;
  const truncated =
    !showFullContent && displayContent.length > MAX_PREVIEW_CHARS
      ? `${displayContent.slice(0, MAX_PREVIEW_CHARS)}…`
      : displayContent;
  const roleLabel =
    item.type === 'user'
      ? 'User'
      : item.type === 'assistant'
        ? 'Assistant'
        : item.type === 'thought'
          ? 'Thought'
          : item.type === 'tool_call'
            ? 'Tool Call'
            : item.type === 'tool_output'
              ? 'Tool Output'
              : item.type === 'token_count'
                ? 'Token Count'
                : 'Meta';

  const tone =
    item.type === 'user'
      ? 'border-blue-200/70 bg-blue-50/80 text-blue-900'
      : item.type === 'assistant'
        ? 'border-emerald-200/70 bg-emerald-50/80 text-emerald-900'
        : item.type === 'thought'
          ? 'border-amber-200/70 bg-amber-50/80 text-amber-900'
          : item.type === 'tool_call'
            ? 'border-indigo-200/70 bg-indigo-50/80 text-indigo-900'
            : item.type === 'tool_output'
              ? 'border-rose-200/70 bg-rose-50/80 text-rose-900'
              : 'border-slate-200/70 bg-slate-50/80 text-slate-800';

  return (
    <div
      className={`animate-stagger rounded-2xl border px-4 py-4 text-sm shadow-sm ${tone}`}
      style={{ '--stagger-delay': `${itemIndex * 40}ms` } as CSSProperties}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em]">{roleLabel}</p>
          {item.toolName && <p className="mt-1 text-xs text-slate-500">Tool: {item.toolName}</p>}
          {item.callId && <p className="text-xs text-slate-500">Call ID: {item.callId}</p>}
        </div>
        {isMarkdownItem && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onCopyItem(item, 'text')}
              aria-label={`Copy ${roleLabel} message as text`}
              className="rounded-full border border-white/70 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm"
            >
              {copiedId === item.id + 'text' ? 'Copied' : 'Copy text'}
            </button>
            <button
              type="button"
              onClick={() => onCopyItem(item, 'markdown')}
              aria-label={`Copy ${roleLabel} message as markdown`}
              className="rounded-full border border-white/70 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm"
            >
              {copiedId === item.id + 'markdown' ? 'Copied' : 'Copy MD'}
            </button>
          </div>
        )}
        {['tool_call', 'tool_output', 'meta', 'token_count'].includes(item.type) && (
          <button
            type="button"
            onClick={() => onCopyItem(item, 'markdown')}
            aria-label={`Copy ${roleLabel} content`}
            className="rounded-full border border-white/70 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm"
          >
            {copiedId === item.id + 'markdown' ? 'Copied' : 'Copy'}
          </button>
        )}
      </div>

      <div className="mt-3">
        {isMarkdownItem ? (
          <MarkdownBlock content={truncated} />
        ) : (
          <pre className="whitespace-pre-wrap break-words rounded-xl bg-white/70 p-3 text-xs text-slate-800">
            {truncated || '—'}
          </pre>
        )}
      </div>
    </div>
  );
};
