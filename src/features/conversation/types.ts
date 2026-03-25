import type {
  SessionDetailItem,
  SessionDetailItemType,
  SessionDetailResponse,
  SessionDetailSummary,
  SessionDetailTurn,
} from '../../../shared/sessionDetailTypes';

export type ParsedItemType = SessionDetailItemType;
export type SearchStatus = 'idle' | 'debouncing' | 'loading' | 'success' | 'error';

export type {
  SearchGroupSort,
  SearchResponse,
  SearchResultSort,
  SessionMatchesResponse,
  SessionSearchResult,
  WorkspaceSearchGroup,
  WorkspaceSummary,
} from '../../../shared/apiTypes';

export type ParsedItem = SessionDetailItem;

export type Turn = SessionDetailTurn;

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

export type { SessionDetailResponse, SessionDetailSummary };

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
