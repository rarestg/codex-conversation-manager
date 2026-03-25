export type SessionDetailItemType =
  | 'user'
  | 'assistant'
  | 'thought'
  | 'tool_call'
  | 'tool_output'
  | 'meta'
  | 'token_count';

export interface SessionDetailItem {
  id: string;
  type: SessionDetailItemType;
  content: string;
  seq: number;
  timestamp?: string;
  callId?: string;
  toolName?: string;
  raw?: unknown;
}

export interface SessionDetailTurn {
  id: number;
  startedAt?: string;
  items: SessionDetailItem[];
  activeDurationMs?: number | null;
  isPreamble?: boolean;
}

export interface SessionDetailSummary {
  id: string;
  path: string;
  filename: string;
  sessionId: string | null;
  preview: string | null;
  timestamp: string | null;
  cwd: string | null;
  gitBranch: string | null;
  gitRepo: string | null;
  gitCommitHash: string | null;
  startedAt: string | null;
  endedAt: string | null;
  turnCount: number | null;
  messageCount: number | null;
  thoughtCount: number | null;
  toolCallCount: number | null;
  metaCount: number | null;
  tokenCountCount: number | null;
  activeDurationMs: number | null;
}

export interface SessionDetailResponse {
  session: SessionDetailSummary;
  turns: SessionDetailTurn[];
  parseErrors: string[];
}
