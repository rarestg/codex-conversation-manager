import { createSessionMetrics, createTurnDurationTracker } from '../sessionMetrics';
import type {
  CanonicalSessionMessage,
  CodexSessionDetails,
  CodexSessionItem,
  CodexSessionSummary,
  CodexSessionTurn,
  IndexedMessage,
  ParsedSessionCoreResult,
  ParseSessionCoreOptions,
  SessionDetailsOptions,
} from './types';

const DEFAULT_PREVIEW_MAX_CHARS = 1000;
const DEFAULT_PREVIEW_MAX_LINES = 50;

export const SESSION_ID_REGEX = /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/;
export const SESSION_ID_PREFIX_REGEX = /\b(?:sess(?:ion)?[_-])[a-zA-Z0-9_-]{6,}\b/;

const TOOL_CALL_TYPES = new Set(['function_call', 'custom_tool_call', 'web_search_call']);
const TOOL_OUTPUT_TYPES = new Set(['function_call_output', 'custom_tool_call_output', 'web_search_call_output']);

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const getString = (value: unknown) => (typeof value === 'string' ? value : undefined);

const getFilenameFromPath = (value?: string | null) => {
  if (!value) return '';
  const normalized = value.replace(/\\/g, '/');
  return normalized.split('/').pop() || normalized;
};

export const formatJsonValue = (value: unknown) => {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch (_error) {
    return String(value);
  }
};

const parseTimestampFromFilename = (name?: string | null) => {
  if (!name) return null;
  const match = name.match(/(\d{4}-\d{2}-\d{2}T\d{2}[-:]\d{2}[-:]\d{2})/);
  if (!match) return null;
  return match[1].replace(/T(\d{2})-(\d{2})-(\d{2})/, 'T$1:$2:$3');
};

export const normalizeSessionId = (value: string) => {
  const trimmed = value.trim();
  const uuidMatch = trimmed.match(SESSION_ID_REGEX);
  if (uuidMatch) return uuidMatch[0];
  const prefixMatch = trimmed.match(SESSION_ID_PREFIX_REGEX);
  if (prefixMatch) return prefixMatch[0];
  return trimmed;
};

export const extractSessionIdFromPath = (value?: string | null) => {
  if (!value) return null;
  const filename = getFilenameFromPath(value);
  const withoutExt = filename.replace(/\.jsonl$/i, '');
  const uuidMatch = withoutExt.match(SESSION_ID_REGEX);
  if (uuidMatch) return uuidMatch[0];
  const prefixMatch = withoutExt.match(SESSION_ID_PREFIX_REGEX);
  if (prefixMatch) return prefixMatch[0];
  return null;
};

const normalizeCwdValue = (value: string, normalizeCwd?: (value: string) => string | undefined) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return normalizeCwd?.(trimmed) ?? trimmed;
  } catch (_error) {
    return trimmed;
  }
};

export const extractSessionIdFromObject = (value: unknown, depth = 0): string | null => {
  if (!value || typeof value !== 'object' || depth > 2) return null;
  const obj = value as Record<string, unknown>;
  const direct =
    obj.session_id ??
    obj.sessionId ??
    obj.conversation_id ??
    obj.conversationId ??
    obj.id ??
    obj.resume_session_id ??
    obj.resumeSessionId;
  if (typeof direct === 'string' && direct.trim()) return normalizeSessionId(direct);
  if (typeof obj.session === 'string' && obj.session.trim()) return normalizeSessionId(obj.session);
  if (obj.session && typeof obj.session === 'object') {
    const nestedId = (obj.session as Record<string, unknown>).id;
    if (typeof nestedId === 'string' && nestedId.trim()) return normalizeSessionId(nestedId);
    const nested = extractSessionIdFromObject(obj.session, depth + 1);
    if (nested) return nested;
  }
  const containers = [obj.session_info, obj.sessionInfo, obj.metadata, obj.context, obj.payload];
  for (const container of containers) {
    const nested = extractSessionIdFromObject(container, depth + 1);
    if (nested) return nested;
  }
  return null;
};

export const extractCwdFromObject = (value: unknown, depth = 0, options: SessionDetailsOptions = {}): string | null => {
  const { normalizeCwd } = options;
  if (!value || typeof value !== 'object' || depth > 2) return null;
  const obj = value as Record<string, unknown>;
  const direct =
    obj.cwd ??
    obj.current_working_directory ??
    obj.working_dir ??
    obj.workingDirectory ??
    obj.repo_root ??
    obj.workspace_root ??
    obj.root_dir;
  if (typeof direct === 'string' && direct.trim()) return normalizeCwdValue(direct, normalizeCwd);
  if (obj.session && typeof obj.session === 'object') {
    const nested = extractCwdFromObject(obj.session, depth + 1, options);
    if (nested) return nested;
  }
  const containers = [obj.metadata, obj.context, obj.environment, obj.env, obj.workspace, obj.payload];
  for (const container of containers) {
    const nested = extractCwdFromObject(container, depth + 1, options);
    if (nested) return nested;
  }
  return null;
};

export const extractSessionDetails = (entry: unknown, options: SessionDetailsOptions = {}): CodexSessionDetails => {
  const record = asRecord(entry);
  const payload = record.payload ?? entry;
  return {
    sessionId: extractSessionIdFromObject(payload) ?? undefined,
    cwd: extractCwdFromObject(payload, 0, options) ?? undefined,
  };
};

type GitFields = Pick<CodexSessionSummary, 'gitBranch' | 'gitRepo' | 'gitCommitHash'>;

const getTrimmedString = (value: unknown) => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const extractGitFields = (value: unknown): Partial<GitFields> => {
  const obj = asRecord(value);
  const gitPayload = asRecord(obj.git);
  const gitBranch = getString(obj.git_branch) ?? getString(obj.gitBranch) ?? getString(gitPayload.branch);
  const gitRepo =
    getTrimmedString(obj.git_repo) ??
    getTrimmedString(obj.gitRepo) ??
    getTrimmedString(gitPayload.repository_url) ??
    getTrimmedString(gitPayload.repositoryUrl);
  const gitCommitHash =
    getString(obj.git_commit_hash) ??
    getString(obj.gitCommitHash) ??
    getString(gitPayload.commit_hash) ??
    getString(gitPayload.commitHash);
  return {
    ...(gitBranch ? { gitBranch } : {}),
    ...(gitRepo ? { gitRepo } : {}),
    ...(gitCommitHash ? { gitCommitHash } : {}),
  };
};

const formatToolCall = (item: unknown) => {
  const obj = asRecord(item);
  const tool = asRecord(obj.tool);
  const name = getString(obj.name) ?? getString(obj.tool_name) ?? getString(tool.name) ?? 'tool';
  const callId = getString(obj.call_id) ?? getString(obj.id) ?? getString(obj.callId);
  const args = obj.arguments ?? obj.args ?? obj.input ?? obj.parameters;
  const parts = [`name: ${name}`];
  if (callId) parts.push(`call_id: ${callId}`);
  const argsText = formatJsonValue(args);
  if (argsText) parts.push(`arguments:\n${argsText}`);
  return { name, callId, content: parts.join('\n') };
};

const formatToolOutput = (item: unknown) => {
  const obj = asRecord(item);
  const callId = getString(obj.call_id) ?? getString(obj.id) ?? getString(obj.callId);
  const output = obj.output ?? obj.result ?? obj.content ?? obj.text ?? obj.value;
  const parts: string[] = [];
  if (callId) parts.push(`call_id: ${callId}`);
  const outputText = formatJsonValue(output);
  if (outputText) parts.push(`output:\n${outputText}`);
  return { callId, content: parts.join('\n') };
};

const shouldReplaceRankedValue = (rank: number, currentRank: number, preferLatestEqualRankMetadata: boolean) =>
  rank > currentRank || (preferLatestEqualRankMetadata && rank === currentRank);

export const parseSessionCore = ({
  raw,
  sessionPath,
  normalizeCwd,
  preferLatestEqualRankMetadata = false,
  sanitizeEntry,
  previewMaxChars = DEFAULT_PREVIEW_MAX_CHARS,
  previewMaxLines = DEFAULT_PREVIEW_MAX_LINES,
}: ParseSessionCoreOptions): ParsedSessionCoreResult => {
  const lines = raw.split('\n');
  const errors: string[] = [];
  const turns: CodexSessionTurn[] = [];
  const preambleItems: CodexSessionItem[] = [];
  const turnMap = new Map<number, CodexSessionTurn>();
  const canonicalMessages: CanonicalSessionMessage[] = [];
  const metrics = createSessionMetrics({
    previewMaxChars,
    previewMaxLines,
  });
  const turnDuration = createTurnDurationTracker();
  const filename = getFilenameFromPath(sessionPath);
  const filenameSessionId = extractSessionIdFromPath(sessionPath);
  let currentTurn = 0;
  let currentTurnRef: CodexSessionTurn | null = null;
  let seq = 0;
  let sessionIdRank = filenameSessionId ? 4 : 0;
  let cwdRank = 0;
  let sessionMetaSeen = false;
  const summaryState: CodexSessionSummary = {
    sessionId: filenameSessionId,
    preview: null,
    timestamp: null,
    cwd: null,
    gitBranch: null,
    gitRepo: null,
    gitCommitHash: null,
    startedAt: null,
    endedAt: null,
    turnCount: null,
    messageCount: 0,
    thoughtCount: 0,
    toolCallCount: 0,
    metaCount: 0,
    tokenCountCount: 0,
    activeDurationMs: null,
  };

  const updateSessionId = (value: unknown, rank: number) => {
    const extracted = extractSessionIdFromObject(value);
    if (!extracted) return;
    if (shouldReplaceRankedValue(rank, sessionIdRank, preferLatestEqualRankMetadata)) {
      summaryState.sessionId = extracted;
      sessionIdRank = rank;
    }
  };

  const updateCwd = (value: unknown, rank: number) => {
    const extracted = extractCwdFromObject(value, 0, { normalizeCwd });
    if (!extracted) return;
    if (shouldReplaceRankedValue(rank, cwdRank, preferLatestEqualRankMetadata)) {
      summaryState.cwd = extracted;
      cwdRank = rank;
    }
  };

  const ensureTurn = (turnId: number, startedAt?: string) => {
    const existing = turnMap.get(turnId);
    if (existing) return existing;
    const turn: CodexSessionTurn = { id: turnId, startedAt, items: [] };
    turnMap.set(turnId, turn);
    turns.push(turn);
    return turn;
  };

  const addItem = (item: CodexSessionItem) => {
    if (currentTurn === 0) {
      preambleItems.push(item);
      return;
    }
    const turn = ensureTurn(currentTurn, item.timestamp);
    turn.items.push(item);
  };

  const currentMessageTurnIndex = () => (currentTurn > 0 ? currentTurn : null);

  const closeCurrentTurn = () => {
    if (!currentTurnRef) return;
    currentTurnRef.activeDurationMs = turnDuration.closeTurn();
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim()) continue;
    seq += 1;
    try {
      const parsedEntry = JSON.parse(line) as unknown;
      const entry = sanitizeEntry ? sanitizeEntry(parsedEntry) : parsedEntry;
      const entryRecord = asRecord(entry);
      const entryTimestamp = getString(entryRecord.timestamp);
      metrics.recordTimestamp(entryTimestamp);

      if (entryRecord.type === 'event_msg') {
        const payload = asRecord(entryRecord.payload);
        const payloadType = getString(payload.type);
        if (payloadType === 'user_message') {
          closeCurrentTurn();
          currentTurn += 1;
          const turn = ensureTurn(currentTurn, entryTimestamp);
          currentTurnRef = turn;
          turnDuration.startTurn(entryTimestamp);
          const content = formatJsonValue(payload.message ?? '');
          metrics.recordUserMessage(entryTimestamp, content);
          canonicalMessages.push({
            seq,
            turnIndex: currentTurn,
            timestamp: entryTimestamp,
            role: 'user',
            phase: null,
            content,
            source: 'event_msg',
          });
          turn.items.push({
            id: `item-${seq}`,
            type: 'user',
            content,
            seq,
            timestamp: entryTimestamp,
            raw: entry,
          });
        } else if (payloadType === 'agent_message') {
          const content = formatJsonValue(payload.message ?? '');
          const phase = getString(payload.phase) ?? null;
          metrics.recordAssistantMessage(entryTimestamp);
          turnDuration.recordAssistantActivity(entryTimestamp);
          canonicalMessages.push({
            seq,
            turnIndex: currentMessageTurnIndex(),
            timestamp: entryTimestamp,
            role: 'assistant',
            phase,
            content,
            source: 'event_msg',
          });
          addItem({
            id: `item-${seq}`,
            type: 'assistant',
            content,
            seq,
            timestamp: entryTimestamp,
            raw: entry,
          });
        } else if (payloadType === 'agent_reasoning') {
          const thoughtText = payload.text;
          if (thoughtText) {
            const content = formatJsonValue(thoughtText);
            metrics.recordThought(entryTimestamp);
            turnDuration.recordAssistantActivity(entryTimestamp);
            canonicalMessages.push({
              seq,
              turnIndex: currentMessageTurnIndex(),
              timestamp: entryTimestamp,
              role: 'thought',
              phase: null,
              content,
              source: 'event_msg',
            });
            addItem({
              id: `item-${seq}`,
              type: 'thought',
              content,
              seq,
              timestamp: entryTimestamp,
              raw: entry,
            });
          }
        } else if (payloadType === 'token_count') {
          metrics.recordTokenCount(entryTimestamp);
          addItem({
            id: `item-${seq}`,
            type: 'token_count',
            content: formatJsonValue(payload),
            seq,
            timestamp: entryTimestamp,
            raw: entry,
          });
        }
        continue;
      }

      if (entryRecord.type === 'session_meta' || entryRecord.type === 'turn_context') {
        const payload = entryRecord.payload ?? entry;
        const rank = entryRecord.type === 'session_meta' ? 3 : 2;
        updateSessionId(payload, rank);
        updateCwd(payload, rank);
        if (entryRecord.type === 'session_meta') {
          const gitFields = extractGitFields(payload);
          if (!sessionMetaSeen) {
            if (gitFields.gitBranch) summaryState.gitBranch = gitFields.gitBranch;
            if (gitFields.gitRepo) summaryState.gitRepo = gitFields.gitRepo;
            if (gitFields.gitCommitHash) summaryState.gitCommitHash = gitFields.gitCommitHash;
            const metaTimestamp = getString(asRecord(payload).timestamp) ?? entryTimestamp;
            if (metaTimestamp) summaryState.timestamp = metaTimestamp;
          } else {
            summaryState.gitBranch = summaryState.gitBranch ?? gitFields.gitBranch ?? null;
            summaryState.gitRepo = summaryState.gitRepo ?? gitFields.gitRepo ?? null;
            summaryState.gitCommitHash = summaryState.gitCommitHash ?? gitFields.gitCommitHash ?? null;
            summaryState.timestamp =
              summaryState.timestamp ?? getString(asRecord(payload).timestamp) ?? entryTimestamp ?? null;
          }
          sessionMetaSeen = true;
        }
        metrics.recordMeta(entryTimestamp);
        addItem({
          id: `item-${seq}`,
          type: 'meta',
          content: formatJsonValue(payload),
          seq,
          timestamp: entryTimestamp,
          raw: entry,
        });
        continue;
      }

      const isResponseItem = entryRecord.type === 'response_item';
      const item = isResponseItem
        ? (entryRecord.item ?? entryRecord.response_item ?? entryRecord.payload ?? {})
        : entry;
      const itemRecord = asRecord(item);
      const itemType = isResponseItem ? getString(itemRecord.type) : getString(entryRecord.type);

      if (itemType && TOOL_CALL_TYPES.has(itemType)) {
        const formatted = formatToolCall(item);
        metrics.recordToolCall(entryTimestamp);
        turnDuration.recordAssistantActivity(entryTimestamp);
        addItem({
          id: `item-${seq}`,
          type: 'tool_call',
          content: formatted.content,
          seq,
          timestamp: entryTimestamp,
          callId: formatted.callId,
          toolName: formatted.name,
          raw: item,
        });
        continue;
      }

      if (itemType && TOOL_OUTPUT_TYPES.has(itemType)) {
        const formatted = formatToolOutput(item);
        metrics.recordToolOutput(entryTimestamp);
        turnDuration.recordAssistantActivity(entryTimestamp);
        addItem({
          id: `item-${seq}`,
          type: 'tool_output',
          content: formatted.content,
          seq,
          timestamp: entryTimestamp,
          callId: formatted.callId,
          raw: item,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Parse error';
      errors.push(`Line ${i + 1}: ${message}`);
    }
  }

  closeCurrentTurn();

  const finalizedMetrics = metrics.finalize();
  const outputTurns: CodexSessionTurn[] = [];
  if (preambleItems.length > 0) {
    outputTurns.push({ id: 0, items: preambleItems, isPreamble: true });
  }
  outputTurns.push(...turns);

  const messagesForIndex: IndexedMessage[] = outputTurns.flatMap((turn) =>
    turn.items
      .filter(
        (item): item is CodexSessionItem & { type: IndexedMessage['role'] } =>
          item.type === 'user' ||
          item.type === 'assistant' ||
          item.type === 'thought' ||
          item.type === 'tool_call' ||
          item.type === 'tool_output',
      )
      .map((item) => ({
        turnId: turn.id,
        role: item.type,
        timestamp: item.timestamp,
        content: item.content,
      })),
  );

  summaryState.preview = finalizedMetrics.firstUserMessage ?? null;
  summaryState.timestamp = summaryState.timestamp ?? parseTimestampFromFilename(filename) ?? null;
  summaryState.startedAt = finalizedMetrics.startedAt ?? null;
  summaryState.endedAt = finalizedMetrics.endedAt ?? null;
  summaryState.turnCount = finalizedMetrics.turnCount ?? null;
  summaryState.messageCount = finalizedMetrics.messageCount;
  summaryState.thoughtCount = finalizedMetrics.thoughtCount;
  summaryState.toolCallCount = finalizedMetrics.toolCallCount;
  summaryState.metaCount = finalizedMetrics.metaCount;
  summaryState.tokenCountCount = finalizedMetrics.tokenCountCount;
  summaryState.activeDurationMs = finalizedMetrics.activeDurationMs ?? null;

  return {
    summary: summaryState,
    turns: outputTurns,
    parseErrors: errors,
    messagesForIndex,
    canonicalMessages,
    sessionInfo: {
      sessionId: summaryState.sessionId ?? undefined,
      cwd: summaryState.cwd ?? undefined,
    },
  };
};
