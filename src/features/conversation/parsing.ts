import {
  extractSessionIdFromPath,
  extractSessionDetails as extractSharedSessionDetails,
  parseSessionCore,
} from '../../../shared/codex-session/parseCore';
import type { SessionDetails, Turn } from './types';

export { extractSessionIdFromPath };

export const extractSessionDetails = (entry: any): SessionDetails => {
  return extractSharedSessionDetails(entry);
};

export const parseJsonl = (raw: string) => {
  const parsed = parseSessionCore({
    raw,
    preferLatestEqualRankMetadata: true,
  });

  return {
    turns: parsed.turns as Turn[],
    errors: parsed.parseErrors,
    sessionInfo: parsed.sessionInfo,
    metrics: {
      startedAt: parsed.summary.startedAt,
      endedAt: parsed.summary.endedAt,
      turnCount: parsed.summary.turnCount,
      messageCount: parsed.summary.messageCount,
      thoughtCount: parsed.summary.thoughtCount,
      toolCallCount: parsed.summary.toolCallCount,
      metaCount: parsed.summary.metaCount,
      tokenCountCount: parsed.summary.tokenCountCount,
      activeDurationMs: parsed.summary.activeDurationMs,
      preview: parsed.summary.preview,
      firstUserMessage: parsed.summary.preview,
    },
  };
};
