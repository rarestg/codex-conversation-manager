export type SearchResultSort = 'relevance' | 'matches' | 'recent';
export type SearchGroupSort = 'last_seen' | 'matches';

export interface WorkspaceSummary {
  cwd: string;
  session_count: number;
  last_seen: string | null;
  git_branch: string | null;
  git_repo: string | null;
  git_commit_hash: string | null;
  github_slug: string | null;
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

export interface WorkspaceSearchGroup {
  workspace: WorkspaceSummary;
  results: SessionSearchResult[];
  match_count: number;
}

export interface SearchResponse {
  groups: WorkspaceSearchGroup[];
  tokens: string[];
  requestId?: string | null;
}

export interface SessionMatchesResponse {
  session: string;
  tokens: string[];
  turn_ids: number[];
  requestId?: string | null;
}
