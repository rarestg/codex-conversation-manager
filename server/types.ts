export interface FileEntry {
  absPath: string;
  relPath: string;
  size: number;
  mtimeMs: number;
}

export interface SessionFileInfo {
  id: string;
  filename: string;
  preview: string | null;
  timestamp: string | null;
  cwd: string | null;
  gitBranch: string | null;
  gitRepo: string | null;
  gitCommitHash: string | null;
  turnCount: number | null;
  messageCount: number | null;
  thoughtCount: number | null;
  toolCallCount: number | null;
  metaCount: number | null;
  tokenCount: number | null;
  startedAt: string | null;
  endedAt: string | null;
  activeDurationMs: number | null;
  sessionId: string;
}

export interface SessionTreeEntry {
  id: string;
  filename: string;
  preview: string | null;
  timestamp: string | null;
  cwd: string | null;
  gitBranch: string | null;
  gitRepo: string | null;
  gitCommitHash: string | null;
  sessionId: string;
  turnCount: number | null;
  messageCount: number | null;
  thoughtCount: number | null;
  toolCallCount: number | null;
  metaCount: number | null;
  tokenCount: number | null;
  startedAt: string | null;
  endedAt: string | null;
  activeDurationMs: number | null;
}

export type DaysMap = Map<string, SessionFileInfo[]>;
export type MonthsMap = Map<string, DaysMap>;
export type YearsMap = Map<string, MonthsMap>;
