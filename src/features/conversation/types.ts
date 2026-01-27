export type ParsedItemType = 'user' | 'assistant' | 'thought' | 'tool_call' | 'tool_output' | 'meta' | 'token_count';
export type SearchStatus = 'idle' | 'debouncing' | 'loading' | 'success' | 'error';

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
  preview?: string | null;
  timestamp?: string | null;
  cwd?: string | null;
  gitBranch?: string | null;
  gitRepo?: string | null;
  gitCommitHash?: string | null;
  turnCount?: number | null;
  messageCount?: number | null;
  thoughtCount?: number | null;
  toolCallCount?: number | null;
  metaCount?: number | null;
  tokenCount?: number | null;
  startedAt?: string | null;
  endedAt?: string | null;
  activeDurationMs?: number | null;
  sessionId: string;
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
  git_commit_hash?: string | null;
  snippet?: string | null;
}

export interface SessionSearchResult {
  session_path: string;
  session_id: string | null;
  first_user_message?: string | null;
  session_timestamp?: string | null;
  cwd?: string | null;
  git_branch?: string | null;
  git_repo?: string | null;
  git_commit_hash?: string | null;
  match_message_count: number;
  match_turn_count: number;
  first_match_turn_id: number | null;
  snippet?: string | null;
  turn_count?: number | null;
  started_at?: string | null;
  ended_at?: string | null;
  active_duration_ms?: number | null;
}

export interface WorkspaceSummary {
  cwd: string;
  session_count: number;
  last_seen: string | null;
  git_branch: string | null;
  git_repo: string | null;
  git_commit_hash: string | null;
  github_slug: string | null;
}

export interface WorkspaceSearchGroup {
  workspace: WorkspaceSummary;
  results: SessionSearchResult[];
  match_count: number;
}

export interface SearchResponse {
  groups: WorkspaceSearchGroup[];
  tokens: string[];
}

export interface SessionMatchesResponse {
  session: string;
  tokens: string[];
  turn_ids: number[];
}

export type HistoryMode = 'replace' | 'push';

export interface LoadSessionOptions {
  historyMode?: HistoryMode;
  searchQuery?: string | null;
}

export interface JumpToTurnOptions {
  historyMode?: HistoryMode;
  scroll?: boolean;
}

export interface IndexSummary {
  scanned: number;
  updated: number;
  removed: number;
  messageCount: number;
}
