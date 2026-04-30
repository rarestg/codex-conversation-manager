import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import {
  extractSessionDetails,
  extractSessionIdFromPath,
  parseSessionCore,
} from '../../shared/codex-session/parseCore';
import { normalizeCwd } from '../../shared/codex-session/path';
import type { IndexedMessage as CoreIndexedMessage } from '../../shared/codex-session/types';
import type { SessionDetailSummary, SessionDetailTurn } from '../../shared/sessionDetailTypes';
import { sanitizeGitRepoFields } from '../gitRepo';

export {
  extractSessionIdFromObject,
  extractSessionIdFromPath,
  normalizeSessionId,
} from '../../shared/codex-session/parseCore';

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

const toSessionDetailTurns = (turns: ParsedSessionResult['turns']): SessionDetailTurn[] => turns;

const toIndexedMessages = (messages: CoreIndexedMessage[]): IndexedMessage[] => messages;

export const parseSessionRaw = ({ raw, sessionPath }: ParseSessionOptions): ParsedSessionResult => {
  const filename = path.basename(sessionPath);
  const parsed = parseSessionCore({
    raw,
    sessionPath,
    normalizeCwd,
    sanitizeEntry: sanitizeGitRepoFields,
  });

  return {
    summary: {
      id: sessionPath,
      path: sessionPath,
      filename,
      sessionId: parsed.summary.sessionId,
      preview: parsed.summary.preview,
      timestamp: parsed.summary.timestamp,
      cwd: parsed.summary.cwd,
      gitBranch: parsed.summary.gitBranch,
      gitRepo: parsed.summary.gitRepo,
      gitCommitHash: parsed.summary.gitCommitHash,
      startedAt: parsed.summary.startedAt,
      endedAt: parsed.summary.endedAt,
      turnCount: parsed.summary.turnCount,
      messageCount: parsed.summary.messageCount,
      thoughtCount: parsed.summary.thoughtCount,
      toolCallCount: parsed.summary.toolCallCount,
      metaCount: parsed.summary.metaCount,
      tokenCountCount: parsed.summary.tokenCountCount,
      activeDurationMs: parsed.summary.activeDurationMs,
    },
    turns: toSessionDetailTurns(parsed.turns),
    parseErrors: parsed.parseErrors,
    messagesForIndex: toIndexedMessages(parsed.messagesForIndex),
  };
};

export const readSessionMetadataFromFile = async (filePath: string): Promise<SessionMetadataResult> => {
  const stream = fs.createReadStream(filePath, { encoding: 'utf-8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let sessionId: string | null = extractSessionIdFromPath(filePath);
  let cwd: string | null = null;
  let sessionIdRank = sessionId ? 4 : 0;
  let cwdRank = 0;

  try {
    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        const entry = sanitizeGitRepoFields(JSON.parse(line));
        if (entry.type !== 'session_meta' && entry.type !== 'turn_context') {
          continue;
        }
        const rank = entry.type === 'session_meta' ? 3 : 2;
        const details = extractSessionDetails(entry, { normalizeCwd });
        const nextSessionId = details.sessionId ?? null;
        if (nextSessionId && rank > sessionIdRank) {
          sessionId = nextSessionId;
          sessionIdRank = rank;
        }
        const nextCwd = details.cwd ?? null;
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
