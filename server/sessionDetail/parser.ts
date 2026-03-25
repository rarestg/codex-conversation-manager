import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import type { SessionDetailItem, SessionDetailSummary, SessionDetailTurn } from '../../shared/sessionDetailTypes';
import { createSessionMetrics, createTurnDurationTracker } from '../../shared/sessionMetrics';
import { sanitizeGitRepo, sanitizeGitRepoFields } from '../gitRepo';

const MAX_PREVIEW_CHARS = 1000;
const MAX_PREVIEW_LINES = 50;

const SESSION_ID_REGEX = /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/;
const SESSION_ID_PREFIX_REGEX = /\b(?:sess(?:ion)?[_-])[a-zA-Z0-9_-]{6,}\b/;

const TOOL_CALL_TYPES = new Set(['function_call', 'custom_tool_call', 'web_search_call']);
const TOOL_OUTPUT_TYPES = new Set(['function_call_output', 'custom_tool_call_output', 'web_search_call_output']);

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const getString = (value: unknown) => (typeof value === 'string' ? value : undefined);

const formatJsonValue = (value: unknown) => {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch (_error) {
    return String(value);
  }
};

const parseTimestampFromFilename = (name: string) => {
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
  const normalized = value.replace(/\\/g, '/');
  const filename = normalized.split('/').pop() || normalized;
  const withoutExt = filename.replace(/\.jsonl$/i, '');
  const uuidMatch = withoutExt.match(SESSION_ID_REGEX);
  if (uuidMatch) return uuidMatch[0];
  const prefixMatch = withoutExt.match(SESSION_ID_PREFIX_REGEX);
  if (prefixMatch) return prefixMatch[0];
  return null;
};

const normalizeCwd = (value?: string | null) => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  try {
    const normalized = path.normalize(trimmed);
    return path.isAbsolute(normalized) ? path.resolve(normalized) : normalized;
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
    obj.resume_session_id ??
    obj.resumeSessionId ??
    obj.id;
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

export const extractCwdFromObject = (value: unknown, depth = 0): string | null => {
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
  if (typeof direct === 'string' && direct.trim()) return normalizeCwd(direct) ?? direct.trim();
  if (obj.session && typeof obj.session === 'object') {
    const nested = extractCwdFromObject(obj.session, depth + 1);
    if (nested) return nested;
  }
  const containers = [obj.metadata, obj.context, obj.environment, obj.env, obj.workspace, obj.payload];
  for (const container of containers) {
    const nested = extractCwdFromObject(container, depth + 1);
    if (nested) return nested;
  }
  return null;
};

type GitFields = Pick<SessionDetailSummary, 'gitBranch' | 'gitRepo' | 'gitCommitHash'>;

const extractGitFields = (value: unknown): Partial<GitFields> => {
  const obj = asRecord(value);
  const gitPayload = asRecord(obj.git);
  const gitBranch = getString(obj.git_branch) ?? getString(obj.gitBranch) ?? getString(gitPayload.branch);
  const gitRepo = sanitizeGitRepo(
    getString(obj.git_repo) ??
      getString(obj.gitRepo) ??
      getString(gitPayload.repository_url) ??
      getString(gitPayload.repositoryUrl),
  );
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

export interface IndexedMessage {
  turnId: number;
  role: 'user' | 'assistant' | 'thought' | 'tool_call' | 'tool_output';
  timestamp?: string;
  content: string;
}

export interface ParsedSessionResult {
  summary: SessionDetailSummary;
  turns: SessionDetailTurn[];
  parseErrors: string[];
  messagesForIndex: IndexedMessage[];
}

interface SessionMetadataResult {
  sessionId: string | null;
  cwd: string | null;
}

interface ParseSessionOptions {
  raw: string;
  sessionPath: string;
}

export const parseSessionRaw = ({ raw, sessionPath }: ParseSessionOptions): ParsedSessionResult => {
  const lines = raw.split('\n');
  const errors: string[] = [];
  const turns: SessionDetailTurn[] = [];
  const preambleItems: SessionDetailItem[] = [];
  const turnMap = new Map<number, SessionDetailTurn>();
  const metrics = createSessionMetrics({
    previewMaxChars: MAX_PREVIEW_CHARS,
    previewMaxLines: MAX_PREVIEW_LINES,
  });
  const turnDuration = createTurnDurationTracker();
  const filename = path.basename(sessionPath);
  const filenameSessionId = extractSessionIdFromPath(sessionPath);
  let currentTurn = 0;
  let currentTurnRef: SessionDetailTurn | null = null;
  let seq = 0;
  let sessionIdRank = filenameSessionId ? 4 : 0;
  let cwdRank = 0;
  let sessionMetaSeen = false;
  const summaryState: Omit<SessionDetailSummary, 'preview'> & { preview?: string | null } = {
    id: sessionPath,
    path: sessionPath,
    filename,
    sessionId: filenameSessionId,
    timestamp: null,
    cwd: null,
    gitBranch: null,
    gitRepo: null,
    gitCommitHash: null,
    startedAt: null,
    endedAt: null,
    turnCount: null,
    messageCount: null,
    thoughtCount: null,
    toolCallCount: null,
    metaCount: null,
    tokenCountCount: null,
    activeDurationMs: null,
  };

  const updateSessionId = (value: unknown, rank: number) => {
    const extracted = extractSessionIdFromObject(value);
    if (extracted && rank > sessionIdRank) {
      summaryState.sessionId = extracted;
      sessionIdRank = rank;
    }
  };

  const updateCwd = (value: unknown, rank: number) => {
    const extracted = extractCwdFromObject(value);
    if (extracted && rank > cwdRank) {
      summaryState.cwd = extracted;
      cwdRank = rank;
    }
  };

  const ensureTurn = (turnId: number, startedAt?: string) => {
    const existing = turnMap.get(turnId);
    if (existing) return existing;
    const turn: SessionDetailTurn = { id: turnId, startedAt, items: [] };
    turnMap.set(turnId, turn);
    turns.push(turn);
    return turn;
  };

  const addItem = (item: SessionDetailItem) => {
    if (currentTurn === 0) {
      preambleItems.push(item);
      return;
    }
    const turn = ensureTurn(currentTurn, item.timestamp);
    turn.items.push(item);
  };

  const closeCurrentTurn = () => {
    if (!currentTurnRef) return;
    currentTurnRef.activeDurationMs = turnDuration.closeTurn();
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim()) continue;
    seq += 1;
    try {
      const entry = sanitizeGitRepoFields(JSON.parse(line));
      metrics.recordTimestamp(entry.timestamp);

      if (entry.type === 'event_msg') {
        const payload = entry.payload ?? {};
        if (payload.type === 'user_message') {
          closeCurrentTurn();
          currentTurn += 1;
          const turn = ensureTurn(currentTurn, entry.timestamp);
          currentTurnRef = turn;
          turnDuration.startTurn(entry.timestamp);
          const content = formatJsonValue(payload.message ?? '');
          metrics.recordUserMessage(entry.timestamp, content);
          turn.items.push({
            id: `item-${seq}`,
            type: 'user',
            content,
            seq,
            timestamp: entry.timestamp,
            raw: entry,
          });
        } else if (payload.type === 'agent_message') {
          metrics.recordAssistantMessage(entry.timestamp);
          turnDuration.recordAssistantActivity(entry.timestamp);
          addItem({
            id: `item-${seq}`,
            type: 'assistant',
            content: formatJsonValue(payload.message ?? ''),
            seq,
            timestamp: entry.timestamp,
            raw: entry,
          });
        } else if (payload.type === 'agent_reasoning' && payload.text) {
          metrics.recordThought(entry.timestamp);
          turnDuration.recordAssistantActivity(entry.timestamp);
          addItem({
            id: `item-${seq}`,
            type: 'thought',
            content: formatJsonValue(payload.text),
            seq,
            timestamp: entry.timestamp,
            raw: entry,
          });
        } else if (payload.type === 'token_count') {
          metrics.recordTokenCount(entry.timestamp);
          addItem({
            id: `item-${seq}`,
            type: 'token_count',
            content: formatJsonValue(payload),
            seq,
            timestamp: entry.timestamp,
            raw: entry,
          });
        }
        continue;
      }

      if (entry.type === 'session_meta' || entry.type === 'turn_context') {
        const payload = entry.payload ?? entry;
        const rank = entry.type === 'session_meta' ? 3 : 2;
        updateSessionId(payload, rank);
        updateCwd(payload, rank);
        if (entry.type === 'session_meta') {
          const gitFields = extractGitFields(payload);
          if (!sessionMetaSeen) {
            if (gitFields.gitBranch) summaryState.gitBranch = gitFields.gitBranch;
            if (gitFields.gitRepo) summaryState.gitRepo = gitFields.gitRepo;
            if (gitFields.gitCommitHash) summaryState.gitCommitHash = gitFields.gitCommitHash;
            const metaTimestamp = getString(asRecord(payload).timestamp) ?? getString(entry.timestamp);
            if (metaTimestamp) summaryState.timestamp = metaTimestamp;
          } else {
            summaryState.gitBranch = summaryState.gitBranch ?? gitFields.gitBranch ?? null;
            summaryState.gitRepo = summaryState.gitRepo ?? gitFields.gitRepo ?? null;
            summaryState.gitCommitHash = summaryState.gitCommitHash ?? gitFields.gitCommitHash ?? null;
            summaryState.timestamp =
              summaryState.timestamp ?? getString(asRecord(payload).timestamp) ?? getString(entry.timestamp) ?? null;
          }
          sessionMetaSeen = true;
        }
        metrics.recordMeta(entry.timestamp);
        addItem({
          id: `item-${seq}`,
          type: 'meta',
          content: formatJsonValue(payload),
          seq,
          timestamp: entry.timestamp,
          raw: entry,
        });
        continue;
      }

      const isResponseItem = entry.type === 'response_item';
      const item = isResponseItem ? (entry.item ?? entry.response_item ?? entry.payload ?? {}) : entry;
      const itemType = isResponseItem ? item.type : entry.type;

      if (TOOL_CALL_TYPES.has(itemType)) {
        const formatted = formatToolCall(item);
        metrics.recordToolCall(entry.timestamp);
        turnDuration.recordAssistantActivity(entry.timestamp);
        addItem({
          id: `item-${seq}`,
          type: 'tool_call',
          content: formatted.content,
          seq,
          timestamp: entry.timestamp,
          callId: formatted.callId,
          toolName: formatted.name,
          raw: item,
        });
        continue;
      }

      if (TOOL_OUTPUT_TYPES.has(itemType)) {
        const formatted = formatToolOutput(item);
        metrics.recordToolOutput(entry.timestamp);
        turnDuration.recordAssistantActivity(entry.timestamp);
        addItem({
          id: `item-${seq}`,
          type: 'tool_output',
          content: formatted.content,
          seq,
          timestamp: entry.timestamp,
          callId: formatted.callId,
          raw: item,
        });
      }
    } catch (error: any) {
      errors.push(`Line ${i + 1}: ${error?.message || 'Parse error'}`);
    }
  }

  closeCurrentTurn();

  const finalizedMetrics = metrics.finalize();
  const outputTurns: SessionDetailTurn[] = [];
  if (preambleItems.length > 0) {
    outputTurns.push({ id: 0, items: preambleItems, isPreamble: true });
  }
  outputTurns.push(...turns);

  const messagesForIndex: IndexedMessage[] = outputTurns.flatMap((turn) =>
    turn.items
      .filter(
        (item): item is SessionDetailItem & { type: IndexedMessage['role'] } =>
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

  return {
    summary: {
      ...summaryState,
      preview: finalizedMetrics.firstUserMessage ?? null,
      timestamp: summaryState.timestamp ?? parseTimestampFromFilename(filename) ?? null,
      startedAt: finalizedMetrics.startedAt ?? null,
      endedAt: finalizedMetrics.endedAt ?? null,
      turnCount: finalizedMetrics.turnCount ?? null,
      messageCount: finalizedMetrics.messageCount,
      thoughtCount: finalizedMetrics.thoughtCount,
      toolCallCount: finalizedMetrics.toolCallCount,
      metaCount: finalizedMetrics.metaCount,
      tokenCountCount: finalizedMetrics.tokenCountCount,
      activeDurationMs: finalizedMetrics.activeDurationMs ?? null,
    },
    turns: outputTurns,
    parseErrors: errors,
    messagesForIndex,
  };
};

export const readSessionMetadataFromFile = async (filePath: string): Promise<SessionMetadataResult> => {
  const stream = fs.createReadStream(filePath, { encoding: 'utf-8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let sessionId: string | null = null;
  let cwd: string | null = null;
  let sessionIdRank = 0;
  let cwdRank = 0;

  try {
    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        const entry = sanitizeGitRepoFields(JSON.parse(line));
        if (entry.type !== 'session_meta' && entry.type !== 'turn_context') {
          continue;
        }
        const payload = entry.payload ?? entry;
        const rank = entry.type === 'session_meta' ? 3 : 2;
        const nextSessionId = extractSessionIdFromObject(payload);
        if (nextSessionId && rank > sessionIdRank) {
          sessionId = nextSessionId;
          sessionIdRank = rank;
        }
        const nextCwd = extractCwdFromObject(payload);
        if (nextCwd && rank > cwdRank) {
          cwd = nextCwd;
          cwdRank = rank;
        }
      } catch (_error) {
        // Ignore malformed lines in the lightweight metadata pass; the full parser
        // will surface them when the file is reindexed or loaded as session detail.
      }
    }
  } finally {
    rl.close();
    stream.destroy();
  }

  return { sessionId, cwd };
};
