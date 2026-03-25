import type Database from 'better-sqlite3';
import { logDebug, logSearchDebug } from '../logging';

export interface LocatorSql {
  whereClause: string;
  whereParams: string[];
  orderClause: string;
  orderParams: string[];
}

export const buildLocatorSql = (alias: string, query: string): LocatorSql => {
  const escaped = query.replace(/[\\%_]/g, '\\$&');
  const likePattern = `%${escaped}%`;
  return {
    whereClause: `(${alias}.session_id = ? OR ${alias}.path = ? OR ${alias}.path LIKE ? ESCAPE '\\')`,
    whereParams: [query, query, likePattern],
    orderClause: [
      `CASE`,
      `WHEN ${alias}.session_id = ? THEN 0`,
      `WHEN ${alias}.path = ? THEN 1`,
      `ELSE 2`,
      `END`,
      `LENGTH(${alias}.path) ASC`,
      `${alias}.path ASC`,
    ].join(', '),
    orderParams: [query, query],
  };
};

interface ResolveSessionOptions {
  id: string;
  workspace?: string | null;
  requestId?: string | null;
}

export const resolveSessionId = (
  database: Database.Database,
  options: ResolveSessionOptions,
): { id: string } | null => {
  const { id, workspace, requestId } = options;
  const locator = buildLocatorSql('sessions', id);
  const params = [...locator.whereParams];
  const whereParts = [locator.whereClause];
  if (workspace) {
    whereParts.push('sessions.cwd = ?');
    params.push(workspace);
  }

  logSearchDebug('resolve:request', {
    requestId,
    id,
    workspace,
    whereClause: whereParts.join(' AND '),
    params,
  });

  try {
    const row = database
      .prepare(
        `
          SELECT sessions.id AS id
          FROM sessions
          WHERE ${whereParts.join(' AND ')}
          ORDER BY ${locator.orderClause}
          LIMIT 1
        `,
      )
      .get(...params, ...locator.orderParams) as { id?: string } | undefined;

    if (!row?.id) {
      logDebug('resolve-session miss', { id });
      logSearchDebug('resolve:miss', { requestId, id, workspace });
      return null;
    }

    logDebug('resolve-session hit', { id, resolved: row.id });
    logSearchDebug('resolve:hit', { requestId, id, workspace, resolved: row.id });
    return { id: row.id };
  } catch (error) {
    logSearchDebug('resolve:error', { requestId, id, workspace, error });
    throw error;
  }
};
