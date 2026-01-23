import type { CSSProperties } from 'react';
import { isRenderDebugEnabled } from '../debug';
import { MAX_PREVIEW_CHARS } from '../format';
import { MarkdownBlock, markdownToPlainText } from '../markdown';
import type { ParsedItem } from '../types';
import { CopyButton } from './CopyButton';

interface MessageCardProps {
  item: ParsedItem;
  itemIndex: number;
  showFullContent: boolean;
}

export const MessageCard = ({ item, itemIndex, showFullContent }: MessageCardProps) => {
  if (isRenderDebugEnabled && itemIndex === 0) {
    console.debug('[render] MessageCard', { id: item.id, type: item.type });
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
  const getCopyText = async (format: 'text' | 'markdown') => {
    const raw = item.content;
    if (format === 'text') {
      return markdownToPlainText(raw);
    }
    return raw;
  };

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
            <CopyButton
              getText={() => getCopyText('text')}
              idleLabel="Copy text"
              hoverLabel="Copy text"
              ariaLabel={`Copy ${roleLabel} message as text`}
              className="rounded-full border border-white/70 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm"
            />
            <CopyButton
              getText={() => getCopyText('markdown')}
              idleLabel="Copy MD"
              hoverLabel="Copy MD"
              ariaLabel={`Copy ${roleLabel} message as markdown`}
              className="rounded-full border border-white/70 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm"
            />
          </div>
        )}
        {['tool_call', 'tool_output', 'meta', 'token_count'].includes(item.type) && (
          <CopyButton
            getText={() => getCopyText('markdown')}
            idleLabel="Copy"
            hoverLabel="Copy"
            ariaLabel={`Copy ${roleLabel} content`}
            className="rounded-full border border-white/70 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm"
          />
        )}
      </div>

      <div className="mt-3 message-body">
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
