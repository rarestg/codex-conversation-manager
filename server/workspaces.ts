import type Database from 'better-sqlite3';
import type { WorkspaceSummary } from '../shared/apiTypes';

export type { WorkspaceSummary };

const extractGithubSlug = (value?: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const sshMatch = trimmed.match(/^git@github\.com:([^/]+\/[^/]+?)(?:\.git)?$/i);
  if (sshMatch) return sshMatch[1];
  const httpsMatch = trimmed.match(/^https?:\/\/github\.com\/([^/]+\/[^/]+?)(?:\.git)?\/?$/i);
  if (httpsMatch) return httpsMatch[1];
  const sshUrlMatch = trimmed.match(/^ssh:\/\/git@github\.com\/([^/]+\/[^/]+?)(?:\.git)?$/i);
  if (sshUrlMatch) return sshUrlMatch[1];
  return null;
};

export const getWorkspaceSummaries = (database: Database.Database, workspaces?: string[]): WorkspaceSummary[] => {
  const filters = (workspaces ?? []).map((value) => value?.trim()).filter((value): value is string => Boolean(value));
  const hasFilter = Array.isArray(workspaces);
  if (hasFilter && filters.length === 0) return [];
  const placeholder = filters.length ? ` AND cwd IN (${filters.map(() => '?').join(', ')})` : '';
  const whereClause = `WHERE cwd IS NOT NULL AND cwd != ''${placeholder}`;
  const params = filters.length ? [...filters, ...filters] : [];
  const rows = database
    .prepare(
      `
        WITH summary AS (
          SELECT cwd, COUNT(*) AS session_count, MAX(timestamp) AS last_seen
          FROM sessions
          ${whereClause}
          GROUP BY cwd
        ),
        ranked AS (
          SELECT
            cwd,
            git_branch,
            git_repo,
            git_commit_hash,
            timestamp,
            ROW_NUMBER() OVER (PARTITION BY cwd ORDER BY timestamp DESC) AS rn
          FROM sessions
          ${whereClause}
        )
        SELECT
          summary.cwd AS cwd,
          summary.session_count AS session_count,
          summary.last_seen AS last_seen,
          ranked.git_branch AS git_branch,
          ranked.git_repo AS git_repo,
          ranked.git_commit_hash AS git_commit_hash
        FROM summary
        LEFT JOIN ranked ON ranked.cwd = summary.cwd AND ranked.rn = 1
      `,
    )
    .all(...params) as Array<{
    cwd: string;
    session_count: number;
    last_seen?: string | null;
    git_branch?: string | null;
    git_repo?: string | null;
    git_commit_hash?: string | null;
  }>;
  return rows.map((row) => ({
    cwd: row.cwd,
    session_count: row.session_count,
    last_seen: row.last_seen ?? null,
    git_branch: row.git_branch ?? null,
    git_repo: row.git_repo ?? null,
    git_commit_hash: row.git_commit_hash ?? null,
    github_slug: extractGithubSlug(row.git_repo ?? undefined),
  }));
};
