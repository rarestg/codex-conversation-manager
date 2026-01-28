export type SessionMetrics = {
  startedAt: string | null;
  endedAt: string | null;
  turnCount: number | null;
  messageCount: number;
  thoughtCount: number;
  toolCallCount: number;
  metaCount: number;
  tokenCountCount: number;
  activeDurationMs: number | null;
  firstUserMessage: string | null;
};

export type SessionMetricsOptions = {
  previewMaxChars?: number;
  previewMaxLines?: number;
};

export type SessionMetricsAccumulator = {
  recordTimestamp: (timestamp?: string | null) => void;
  recordUserMessage: (timestamp?: string | null, content?: string | null) => void;
  recordAssistantMessage: (timestamp?: string | null) => void;
  recordAssistantActivity: (timestamp?: string | null) => void;
  recordThought: (timestamp?: string | null) => void;
  recordToolCall: (timestamp?: string | null) => void;
  recordToolOutput: (timestamp?: string | null) => void;
  recordMeta: (timestamp?: string | null) => void;
  recordTokenCount: (timestamp?: string | null) => void;
  closeTurn: () => void;
  finalize: () => SessionMetrics;
};

export const createSessionMetrics = (options: SessionMetricsOptions = {}): SessionMetricsAccumulator => {
  const { previewMaxChars = 1000, previewMaxLines = 50 } = options;

  let firstUserMessage: string | null = null;
  let startedAt: string | null = null;
  let endedAt: string | null = null;
  let startedAtMs: number | null = null;
  let endedAtMs: number | null = null;

  let turnCount = 0;
  let messageCount = 0;
  let thoughtCount = 0;
  let toolCallCount = 0;
  let metaCount = 0;
  let tokenCountCount = 0;

  let inTurn = false;
  let currentTurnStartMs: number | null = null;
  let lastAssistantActivityMs: number | null = null;
  let activeDurationMs = 0;
  let activeDurationPairs = 0;

  const parseTimestamp = (value?: string | null) => {
    if (!value) return null;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const updateBounds = (value?: string | null) => {
    if (!value) return;
    const parsed = parseTimestamp(value);
    if (parsed === null) return;
    if (startedAtMs === null || parsed < startedAtMs) {
      startedAtMs = parsed;
      startedAt = value;
    }
    if (endedAtMs === null || parsed > endedAtMs) {
      endedAtMs = parsed;
      endedAt = value;
    }
  };

  const truncatePreview = (value: string) => {
    let truncated = value.slice(0, previewMaxChars);
    const lines = truncated.split(/\r?\n/);
    if (lines.length > previewMaxLines) {
      truncated = lines.slice(0, previewMaxLines).join('\n');
    }
    return truncated;
  };

  const closeTurn = () => {
    if (!inTurn) return;
    if (currentTurnStartMs !== null && lastAssistantActivityMs !== null) {
      const diff = lastAssistantActivityMs - currentTurnStartMs;
      if (Number.isFinite(diff) && diff >= 0) {
        activeDurationMs += diff;
        activeDurationPairs += 1;
      }
    }
    inTurn = false;
    currentTurnStartMs = null;
    lastAssistantActivityMs = null;
  };

  const recordAssistantActivity = (timestamp?: string | null) => {
    updateBounds(timestamp);
    if (!inTurn) return;
    const parsed = parseTimestamp(timestamp ?? undefined);
    if (parsed !== null) lastAssistantActivityMs = parsed;
  };

  return {
    recordTimestamp: updateBounds,

    recordUserMessage: (timestamp, content) => {
      closeTurn();
      inTurn = true;
      currentTurnStartMs = parseTimestamp(timestamp ?? undefined);
      lastAssistantActivityMs = null;
      turnCount += 1;
      messageCount += 1;
      updateBounds(timestamp);
      if (!firstUserMessage && content) {
        const trimmed = content.trim();
        if (trimmed) firstUserMessage = truncatePreview(trimmed);
      }
    },

    recordAssistantMessage: (timestamp) => {
      messageCount += 1;
      recordAssistantActivity(timestamp);
    },

    recordAssistantActivity,

    recordThought: (timestamp) => {
      thoughtCount += 1;
      messageCount += 1;
      recordAssistantActivity(timestamp);
    },

    recordToolCall: (timestamp) => {
      toolCallCount += 1;
      messageCount += 1;
      recordAssistantActivity(timestamp);
    },

    recordToolOutput: (timestamp) => {
      messageCount += 1;
      recordAssistantActivity(timestamp);
    },

    recordMeta: (timestamp) => {
      metaCount += 1;
      updateBounds(timestamp);
    },

    recordTokenCount: (timestamp) => {
      tokenCountCount += 1;
      updateBounds(timestamp);
    },

    closeTurn,

    finalize: () => {
      closeTurn();
      return {
        startedAt,
        endedAt,
        turnCount: turnCount > 0 ? turnCount : null,
        messageCount,
        thoughtCount,
        toolCallCount,
        metaCount,
        tokenCountCount,
        activeDurationMs: activeDurationPairs > 0 ? activeDurationMs : null,
        firstUserMessage,
      };
    },
  };
};
