import type Database from 'better-sqlite3';

const GIT_REPO_SQL_FUNCTION = 'sanitize_git_repo';
const GIT_REPO_VALUE_KEYS = new Set(['git_repo', 'gitRepo', 'repository_url', 'repositoryUrl']);

const sanitizeUrlGitRepo = (value: string) => {
  try {
    const parsed = new URL(value);
    const hasPassword = Boolean(parsed.password);
    const hasHttpUserInfo =
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') && Boolean(parsed.username || parsed.password);
    if (!hasPassword && !hasHttpUserInfo) {
      return value;
    }
    parsed.username = '';
    parsed.password = '';
    return parsed.toString();
  } catch (_error) {
    return value;
  }
};

export const sanitizeGitRepo = (value?: string | null) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return sanitizeUrlGitRepo(trimmed);
};

const sanitizeGitRepoFieldValue = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed ? sanitizeUrlGitRepo(trimmed) : value;
};

export const sanitizeGitRepoFields = <T>(value: T): T => {
  if (Array.isArray(value)) {
    const original = value as unknown[];
    const sanitizedItems = original.map((item) => sanitizeGitRepoFields(item));
    const changed = sanitizedItems.some((item, index) => item !== original[index]);
    return (changed ? sanitizedItems : original) as T;
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  let changed = false;
  const sanitized: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const nextChild = GIT_REPO_VALUE_KEYS.has(key) ? sanitizeGitRepoFieldValue(child) : sanitizeGitRepoFields(child);
    if (nextChild !== child) {
      changed = true;
    }
    sanitized[key] = nextChild;
  }

  return (changed ? sanitized : value) as T;
};

export const buildSanitizedGitRepoSql = (valueExpression: string) => `${GIT_REPO_SQL_FUNCTION}(${valueExpression})`;

export const registerGitRepoSqlFunctions = (database: Database.Database) => {
  database.function(GIT_REPO_SQL_FUNCTION, { deterministic: true }, (value: unknown) =>
    typeof value === 'string' ? sanitizeGitRepo(value) : null,
  );
};
