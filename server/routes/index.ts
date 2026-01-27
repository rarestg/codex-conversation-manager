import fsp from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { ensurePathSafe, ensureRootExists, resolveSessionsRoot, setSessionsRoot } from '../config';
import { getDb, resetDb } from '../db';
import { readJsonBody, sendJson } from '../http';
import { indexSessions } from '../indexing';
import { buildSessionsTree, getSessionsForTree } from '../indexing/tree';
import { DEBUG_ENABLED, logDebug } from '../logging';
import {
  resolveSession,
  type SearchGroupSort,
  type SearchResultSort,
  searchSessions,
  sessionMatches,
} from '../search/queries';
import { getWorkspaceSummaries } from '../workspaces';

type ApiHandler = (req: IncomingMessage, res: ServerResponse, url: URL) => Promise<void>;

const routes: Record<string, ApiHandler> = {
  'GET /api/config': async (_req, res) => {
    const root = await resolveSessionsRoot();
    return sendJson(res, 200, root);
  },
  'POST /api/config': async (req, res) => {
    if (process.env.CODEX_SESSIONS_ROOT) {
      return sendJson(res, 400, {
        error: 'CODEX_SESSIONS_ROOT is set; config updates are disabled until it is unset.',
      });
    }
    const body = await readJsonBody(req);
    const sessionsRoot = typeof body === 'object' && body ? (body as Record<string, unknown>).sessionsRoot : undefined;
    if (!sessionsRoot || typeof sessionsRoot !== 'string') {
      return sendJson(res, 400, { error: 'sessionsRoot is required.' });
    }
    if (!path.isAbsolute(sessionsRoot)) {
      return sendJson(res, 400, { error: 'sessionsRoot must be an absolute path.' });
    }
    const exists = await ensureRootExists(sessionsRoot);
    if (!exists) {
      return sendJson(res, 400, { error: 'sessionsRoot does not exist or is not a directory.' });
    }
    await setSessionsRoot(sessionsRoot);
    return sendJson(res, 200, { ok: true, sessionsRoot });
  },
  'GET /api/sessions': async (_req, res, url) => {
    const startedAt = performance.now();
    const rootInfo = await resolveSessionsRoot();
    const rootExists = await ensureRootExists(rootInfo.value);
    const afterRoot = performance.now();
    if (!rootExists) {
      return sendJson(res, 404, {
        error: `Sessions root not found: ${rootInfo.value}. Set CODEX_SESSIONS_ROOT or update ~/.codex-formatter/config.json`,
      });
    }
    const database = getDb();
    const afterDbInit = performance.now();
    const workspace = url.searchParams.get('workspace')?.trim() || null;
    const entries = getSessionsForTree(database, workspace);
    const afterQuery = performance.now();
    const tree = buildSessionsTree(rootInfo.value, entries);
    const afterTree = performance.now();
    const payload = JSON.stringify(tree);
    const afterJson = performance.now();
    const payloadBytes = Buffer.byteLength(payload);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Server-Timing',
      [
        `root;dur=${(afterRoot - startedAt).toFixed(2)}`,
        `dbinit;dur=${(afterDbInit - afterRoot).toFixed(2)}`,
        `query;dur=${(afterQuery - afterDbInit).toFixed(2)}`,
        `tree;dur=${(afterTree - afterQuery).toFixed(2)}`,
        `json;dur=${(afterJson - afterTree).toFixed(2)}`,
        `total;dur=${(afterJson - startedAt).toFixed(2)}`,
      ].join(', '),
    );
    res.end(payload);

    if (DEBUG_ENABLED) {
      const queryMs = afterQuery - afterDbInit;
      const totalMs = afterJson - startedAt;
      logDebug('/api/sessions timing', {
        rootMs: afterRoot - startedAt,
        dbInitMs: afterDbInit - afterRoot,
        queryMs,
        treeMs: afterTree - afterQuery,
        jsonMs: afterJson - afterTree,
        totalMs,
        entries: entries.length,
        payloadKb: Math.round(payloadBytes / 1024),
      });
      if (queryMs > 200) {
        try {
          const rowCounts = database
            .prepare(
              `
                SELECT
                  (SELECT COUNT(*) FROM sessions) AS sessions_count,
                  (SELECT COUNT(*) FROM messages) AS messages_count
              `,
            )
            .get() as { sessions_count: number; messages_count: number };
          logDebug('/api/sessions counts', rowCounts);

          const whereClause = workspace ? 'WHERE sessions.cwd = ?' : '';
          const explainStmt = database.prepare(
            `
              EXPLAIN QUERY PLAN
              SELECT
                sessions.id AS id,
                sessions.path AS path,
                sessions.first_user_message AS first_user_message,
                sessions.timestamp AS timestamp,
                sessions.cwd AS cwd,
                sessions.git_branch AS git_branch,
                sessions.git_repo AS git_repo,
                sessions.git_commit_hash AS git_commit_hash,
                sessions.session_id AS session_id,
                sessions.turn_count AS turn_count,
                sessions.message_count AS message_count,
                sessions.thought_count AS thought_count,
                sessions.tool_call_count AS tool_call_count,
                sessions.meta_count AS meta_count,
                sessions.token_count_count AS token_count_count,
                sessions.started_at AS started_at,
                sessions.ended_at AS ended_at,
                sessions.active_duration_ms AS active_duration_ms
              FROM sessions
              ${whereClause}
            `,
          );
          const plan = workspace ? explainStmt.all(workspace) : explainStmt.all();
          logDebug('/api/sessions query plan', plan);
        } catch (error) {
          logDebug('/api/sessions debug query failed', error);
        }
      }
    }
  },
  'GET /api/workspaces': async (_req, res, url) => {
    const sort = url.searchParams.get('sort');
    const sortBy = sort === 'session_count' ? 'session_count' : 'last_seen';
    const database = getDb();
    const workspaces = getWorkspaceSummaries(database);
    workspaces.sort((a, b) => {
      if (sortBy === 'session_count') {
        if (b.session_count !== a.session_count) {
          return b.session_count - a.session_count;
        }
        const lastSeenCompare = (b.last_seen ?? '').localeCompare(a.last_seen ?? '');
        if (lastSeenCompare !== 0) return lastSeenCompare;
      } else {
        const lastSeenCompare = (b.last_seen ?? '').localeCompare(a.last_seen ?? '');
        if (lastSeenCompare !== 0) return lastSeenCompare;
        if (b.session_count !== a.session_count) {
          return b.session_count - a.session_count;
        }
      }
      return a.cwd.localeCompare(b.cwd);
    });
    return sendJson(res, 200, { workspaces });
  },
  'GET /api/session': async (_req, res, url) => {
    const rootInfo = await resolveSessionsRoot();
    const rootExists = await ensureRootExists(rootInfo.value);
    if (!rootExists) {
      return sendJson(res, 404, {
        error: `Sessions root not found: ${rootInfo.value}. Set CODEX_SESSIONS_ROOT or update ~/.codex-formatter/config.json`,
      });
    }
    const relativePath = url.searchParams.get('path') || '';
    const resolvedPath = ensurePathSafe(rootInfo.value, relativePath);
    if (!resolvedPath) {
      return sendJson(res, 400, { error: 'Invalid session path.' });
    }
    let raw: string;
    try {
      raw = await fsp.readFile(resolvedPath, 'utf-8');
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        return sendJson(res, 404, { error: 'Session file not found. Please reindex.' });
      }
      if (error?.code === 'EACCES') {
        return sendJson(res, 403, { error: 'Unable to read session file.' });
      }
      throw error;
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');
    res.end(raw);
  },
  'POST /api/reindex': async (_req, res) => {
    const rootInfo = await resolveSessionsRoot();
    const rootExists = await ensureRootExists(rootInfo.value);
    if (!rootExists) {
      return sendJson(res, 404, {
        error: `Sessions root not found: ${rootInfo.value}. Set CODEX_SESSIONS_ROOT or update ~/.codex-formatter/config.json`,
      });
    }
    logDebug('reindex start', { root: rootInfo.value });
    const summary = await indexSessions(rootInfo.value);
    logDebug('reindex done', summary);
    return sendJson(res, 200, { ok: true, summary });
  },
  'POST /api/clear-index': async (_req, res) => {
    const rootInfo = await resolveSessionsRoot();
    const rootExists = await ensureRootExists(rootInfo.value);
    if (!rootExists) {
      return sendJson(res, 404, {
        error: `Sessions root not found: ${rootInfo.value}. Set CODEX_SESSIONS_ROOT or update ~/.codex-formatter/config.json`,
      });
    }
    logDebug('clear-index start', { root: rootInfo.value });
    resetDb();
    const summary = await indexSessions(rootInfo.value);
    logDebug('clear-index done', summary);
    return sendJson(res, 200, { ok: true, summary });
  },
  'GET /api/resolve-session': async (_req, res, url) => {
    const id = url.searchParams.get('id')?.trim();
    if (!id) return sendJson(res, 400, { error: 'id is required.' });
    const requestId = url.searchParams.get('requestId')?.trim() || null;
    const workspace = url.searchParams.get('workspace')?.trim();
    const database = getDb();
    const resolved = resolveSession(database, { id, workspace, requestId });
    if (!resolved) return sendJson(res, 404, { error: 'Session not found.' });
    return sendJson(res, 200, resolved);
  },
  'GET /api/search': async (_req, res, url) => {
    const q = url.searchParams.get('q');
    const limit = Number(url.searchParams.get('limit') || '20');
    const workspace = url.searchParams.get('workspace')?.trim() || null;
    const requestId = url.searchParams.get('requestId')?.trim() || null;
    const resultSortParam = url.searchParams.get('resultSort')?.trim();
    const groupSortParam = url.searchParams.get('groupSort')?.trim();
    const resultSort: SearchResultSort =
      resultSortParam === 'matches' ? 'matches' : resultSortParam === 'recent' ? 'recent' : 'relevance';
    const groupSort: SearchGroupSort = groupSortParam === 'matches' ? 'matches' : 'last_seen';
    if (q === null) return sendJson(res, 400, { error: 'q is required.' });
    const database = getDb();
    const { response, timings } = searchSessions(database, {
      query: q,
      limit: Number.isFinite(limit) ? limit : 20,
      workspace,
      requestId,
      resultSort,
      groupSort,
      getWorkspaceSummaries,
    });
    const responsePayload = requestId ? { ...response, requestId } : response;
    const jsonStart = performance.now();
    const payload = JSON.stringify(responsePayload);
    const jsonMs = performance.now() - jsonStart;
    const totalMs = timings.totalMs + jsonMs;

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Server-Timing',
      [
        `normalize;dur=${timings.normalizeMs.toFixed(2)}`,
        `query;dur=${timings.queryMs.toFixed(2)}`,
        `group;dur=${timings.groupMs.toFixed(2)}`,
        `json;dur=${jsonMs.toFixed(2)}`,
        `total;dur=${totalMs.toFixed(2)}`,
      ].join(', '),
    );
    res.end(payload);
    return;
  },
  'GET /api/session-matches': async (_req, res, url) => {
    const session = url.searchParams.get('session')?.trim();
    const q = url.searchParams.get('q');
    const requestId = url.searchParams.get('requestId')?.trim() || null;
    if (!session) return sendJson(res, 400, { error: 'session is required.' });
    if (q === null) return sendJson(res, 400, { error: 'q is required.' });
    const database = getDb();
    const { response, timings } = sessionMatches(database, { session, query: q, requestId });
    const responsePayload = requestId ? { ...response, requestId } : response;
    const jsonStart = performance.now();
    const payload = JSON.stringify(responsePayload);
    const jsonMs = performance.now() - jsonStart;
    const totalMs = timings.totalMs + jsonMs;

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Server-Timing',
      [
        `normalize;dur=${timings.normalizeMs.toFixed(2)}`,
        `query;dur=${timings.queryMs.toFixed(2)}`,
        `json;dur=${jsonMs.toFixed(2)}`,
        `total;dur=${totalMs.toFixed(2)}`,
      ].join(', '),
    );
    res.end(payload);
    return;
  },
};

export const handleApiRequest = async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
  if (!req.url) return false;
  const url = new URL(req.url, 'http://localhost');
  const method = req.method ?? 'GET';
  const handler = routes[`${method} ${url.pathname}`];
  try {
    if (!handler) {
      sendJson(res, 404, { error: 'Not found' });
      return true;
    }
    await handler(req, res, url);
    return true;
  } catch (error: unknown) {
    console.error('[api]', method, url.pathname, error);
    const message = error instanceof Error ? error.message : 'Server error';
    sendJson(res, 500, { error: message });
    return true;
  }
};
