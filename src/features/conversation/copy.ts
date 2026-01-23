import { generateId } from './format';
import type { Turn } from './types';

export const copyText = async (text: string): Promise<boolean> => {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.warn('Clipboard write failed, falling back to execCommand copy.', error);
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);

  try {
    textarea.select();
    return document.execCommand('copy');
  } catch (error) {
    console.error('Copy failed:', error);
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
};

export const buildConversationExport = (turns: Turn[]) => {
  const convId = generateId();
  const counters: Record<string, number> = {
    user: 0,
    assistant: 0,
    thought: 0,
    tool_call: 0,
    tool_output: 0,
    meta: 0,
  };

  const items = turns.flatMap((turn) => turn.items);
  const formatted = items
    .map((item) => {
      const countKey = item.type === 'token_count' ? 'meta' : item.type;
      if (counters[countKey] === undefined) counters[countKey] = 0;
      counters[countKey] += 1;
      const count = counters[countKey];
      if (item.type === 'user') return `<USER-MSG-${count}>\n${item.content}\n</USER-MSG-${count}>`;
      if (item.type === 'assistant') {
        return `<ASSISTANT-RESPONSE-${count}>\n${item.content}\n</ASSISTANT-RESPONSE-${count}>`;
      }
      if (item.type === 'thought') {
        return `<THINKING-${count}>\n${item.content}\n</THINKING-${count}>`;
      }
      if (item.type === 'tool_call') {
        const nameAttr = item.toolName ? ` name="${item.toolName}"` : '';
        const callAttr = item.callId ? ` call_id="${item.callId}"` : '';
        return `<TOOL-CALL-${count}${nameAttr}${callAttr}>\n${item.content}\n</TOOL-CALL-${count}>`;
      }
      if (item.type === 'tool_output') {
        const callAttr = item.callId ? ` call_id="${item.callId}"` : '';
        return `<TOOL-OUTPUT-${count}${callAttr}>\n${item.content}\n</TOOL-OUTPUT-${count}>`;
      }
      return `<META-${count}>\n${item.content}\n</META-${count}>`;
    })
    .join('\n\n');

  return `<CONVERSATION-${convId}>\n\n${formatted}\n\n</CONVERSATION-${convId}>`;
};
