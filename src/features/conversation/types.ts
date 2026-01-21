export type ParsedItemType = 'user' | 'assistant' | 'thought' | 'tool_call' | 'tool_output' | 'meta' | 'token_count';

export interface ParsedItem {
  id: string;
  type: ParsedItemType;
  content: string;
  seq: number;
  timestamp?: string;
  callId?: string;
  toolName?: string;
  raw?: unknown;
}

export interface Turn {
  id: number;
  startedAt?: string;
  items: ParsedItem[];
  isPreamble?: boolean;
}

export interface SessionFileEntry {
  id: string;
  filename: string;
  size: number;
  preview?: string | null;
  timestamp?: string | null;
  cwd?: string | null;
}

export interface SessionTree {
  root: string;
  years: Array<{
    year: string;
    months: Array<{
      month: string;
      days: Array<{
        day: string;
        files: SessionFileEntry[];
      }>;
    }>;
  }>;
}

export interface SessionDetails {
  sessionId?: string;
  cwd?: string;
}

export interface SearchResult {
  id: number;
  content: string;
  session_id: string;
  turn_id: number;
  role: string;
  timestamp?: string | null;
  session_timestamp?: string | null;
  cwd?: string | null;
  git_branch?: string | null;
  git_repo?: string | null;
  snippet?: string | null;
}

export type HistoryMode = 'replace' | 'push';

export interface LoadSessionOptions {
  historyMode?: HistoryMode;
}

export interface IndexSummary {
  scanned: number;
  updated: number;
  removed: number;
  messageCount: number;
}
