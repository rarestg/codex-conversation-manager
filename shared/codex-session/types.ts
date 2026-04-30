export type CodexSessionItemType =
  | 'user'
  | 'assistant'
  | 'thought'
  | 'tool_call'
  | 'tool_output'
  | 'meta'
  | 'token_count';

export interface CodexSessionItem {
  id: string;
  type: CodexSessionItemType;
  content: string;
  seq: number;
  timestamp?: string;
  callId?: string;
  toolName?: string;
  raw?: unknown;
}

export interface CodexSessionTurn {
  id: number;
  startedAt?: string;
  items: CodexSessionItem[];
  activeDurationMs?: number | null;
  isPreamble?: boolean;
}

export interface CodexSessionDetails {
  sessionId?: string;
  cwd?: string;
}

export interface CodexSessionSummary {
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
  messageCount: number;
  thoughtCount: number;
  toolCallCount: number;
  metaCount: number;
  tokenCountCount: number;
  activeDurationMs: number | null;
}

export interface IndexedMessage {
  turnId: number;
  role: 'user' | 'assistant' | 'thought' | 'tool_call' | 'tool_output';
  timestamp?: string;
  content: string;
}

export interface CanonicalSessionMessage {
  seq: number;
  turnIndex: number | null;
  timestamp?: string;
  role: 'user' | 'assistant' | 'thought';
  phase?: string | null;
  content: string;
  source: 'event_msg';
}

export interface ParsedSessionCoreResult {
  summary: CodexSessionSummary;
  turns: CodexSessionTurn[];
  parseErrors: string[];
  messagesForIndex: IndexedMessage[];
  canonicalMessages: CanonicalSessionMessage[];
  sessionInfo: CodexSessionDetails;
}

export interface ParseSessionCoreOptions {
  raw: string;
  sessionPath?: string | null;
  normalizeCwd?: (value: string) => string | undefined;
  preferLatestEqualRankMetadata?: boolean;
  sanitizeEntry?: <T>(value: T) => T;
  previewMaxChars?: number;
  previewMaxLines?: number;
}

export interface SessionDetailsOptions {
  normalizeCwd?: (value: string) => string | undefined;
}

export type SessionGraphSourceKind = 'root' | 'subagent' | 'unknown';

export interface SessionGraphSpawnCall {
  seq: number;
  timestamp?: string;
  callId: string | null;
  agentType: string | null;
  model: string | null;
  reasoningEffort: string | null;
  forkContext: boolean | null;
  dispatchPrompt: string | null;
  rawArguments: unknown;
}

export interface SessionGraphSpawnOutput {
  seq: number;
  timestamp?: string;
  callId: string | null;
  agentId: string | null;
  nickname: string | null;
  rawOutput: unknown;
}

export interface SessionGraphWaitEvent {
  seq: number;
  timestamp?: string;
  callId: string | null;
  agentIds: string[];
  statusByAgentId: Record<string, unknown>;
  timedOut: boolean | null;
  rawArguments: unknown;
  rawOutput: unknown;
}

export interface SessionGraphNotification {
  seq: number;
  timestamp?: string;
  agentId: string | null;
  status: unknown;
  rawText: string;
  rawPayload: unknown;
}

export interface SessionGraphChildLink {
  agentId: string | null;
  nickname: string | null;
  spawnedAt: string | null;
  spawnCallId: string | null;
  agentType: string | null;
  model: string | null;
  reasoningEffort: string | null;
  forkContext: boolean | null;
  dispatchPrompt: string | null;
  latestWaitStatus: unknown;
  latestNotification: SessionGraphNotification | null;
}

export interface ParsedSessionGraphResult {
  sessionId: string | null;
  sessionPath: string | null;
  sourceKind: SessionGraphSourceKind;
  parentSessionId: string | null;
  agentNickname: string | null;
  agentRole: string | null;
  depth: number | null;
  spawnCalls: SessionGraphSpawnCall[];
  spawnOutputs: SessionGraphSpawnOutput[];
  waitEvents: SessionGraphWaitEvent[];
  notifications: SessionGraphNotification[];
  spawnedChildren: SessionGraphChildLink[];
  latestWaitStatusByAgentId: Record<string, unknown>;
  latestNotificationByAgentId: Record<string, SessionGraphNotification>;
  parseErrors: string[];
}

export interface SessionGraphLocatorEntry {
  sessionId: string;
  path: string;
  sourceKind: SessionGraphSourceKind;
  parentSessionId: string | null;
  agentNickname: string | null;
  agentRole: string | null;
  depth: number | null;
}

export interface SessionGraphLocator {
  root: string;
  entries: SessionGraphLocatorEntry[];
  bySessionId: Map<string, SessionGraphLocatorEntry>;
  childrenByParentSessionId: Map<string, SessionGraphLocatorEntry[]>;
}
