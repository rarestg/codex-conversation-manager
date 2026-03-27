import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
import { extractSessionIdFromObject, extractSessionIdFromPath, normalizeSessionId } from './parseCore';
import { extractSessionLineage, mergeSessionLineage } from './sessionGraph';
import type { SessionGraphLocator, SessionGraphLocatorEntry } from './types';

const walkJsonlFiles = async (root: string): Promise<string[]> => {
  const output: string[] = [];
  const walk = async (dir: string) => {
    const dirents = await fsp.readdir(dir, { withFileTypes: true });
    for (const dirent of dirents) {
      const fullPath = path.join(dir, dirent.name);
      if (dirent.isDirectory()) {
        await walk(fullPath);
      } else if (dirent.isFile() && dirent.name.endsWith('.jsonl')) {
        output.push(fullPath);
      }
    }
  };
  await walk(root);
  output.sort();
  return output;
};

export const readSessionGraphMetadataFromFile = async (filePath: string): Promise<SessionGraphLocatorEntry | null> => {
  const stream = fs.createReadStream(filePath, { encoding: 'utf-8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let sessionId = extractSessionIdFromPath(filePath);
  let sessionIdRank = sessionId ? 4 : 0;
  let lineage: ReturnType<typeof extractSessionLineage> = {
    sourceKind: 'unknown',
    parentSessionId: null,
    agentNickname: null,
    agentRole: null,
    depth: null,
  };

  try {
    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line) as Record<string, unknown>;
        const entryType = typeof entry.type === 'string' ? entry.type : undefined;
        if (entryType !== 'session_meta' && entryType !== 'turn_context') continue;

        const payload = entry.payload ?? entry;
        const rank = entryType === 'session_meta' ? 3 : 2;
        const extractedSessionId = extractSessionIdFromObject(payload);
        if (extractedSessionId && rank > sessionIdRank) {
          sessionId = extractedSessionId;
          sessionIdRank = rank;
        }

        if (entryType === 'session_meta') {
          lineage = mergeSessionLineage(lineage, extractSessionLineage(payload));
        }
      } catch (_error) {
        // Ignore malformed lines during the lightweight metadata pass.
      }
    }
  } finally {
    rl.close();
    stream.destroy();
  }

  if (!sessionId) return null;

  return {
    sessionId,
    path: filePath,
    ...lineage,
  };
};

export const buildSessionGraphLocator = async (root: string): Promise<SessionGraphLocator> => {
  const files = await walkJsonlFiles(root);
  const entries: SessionGraphLocatorEntry[] = [];
  const bySessionId = new Map<string, SessionGraphLocatorEntry>();
  const childrenByParentSessionId = new Map<string, SessionGraphLocatorEntry[]>();
  for (const filePath of files) {
    const entry = await readSessionGraphMetadataFromFile(filePath);
    if (!entry) continue;
    entries.push(entry);
    bySessionId.set(entry.sessionId, entry);
    if (!entry.parentSessionId) continue;
    const existing = childrenByParentSessionId.get(entry.parentSessionId) ?? [];
    existing.push(entry);
    childrenByParentSessionId.set(entry.parentSessionId, existing);
  }

  return {
    root,
    entries,
    bySessionId,
    childrenByParentSessionId,
  };
};

export const resolveSessionSpecifier = (
  locator: SessionGraphLocator,
  specifier: string,
): SessionGraphLocatorEntry | null => {
  const trimmed = specifier.trim();
  if (!trimmed) return null;

  if (trimmed === normalizeSessionId(trimmed)) {
    const byId = locator.bySessionId.get(trimmed);
    if (byId) return byId;
  }

  const resolvedPath = path.resolve(trimmed);
  return locator.entries.find((entry) => entry.path === trimmed || path.resolve(entry.path) === resolvedPath) ?? null;
};

export const getParentSessionEntry = (
  locator: SessionGraphLocator,
  childSessionId: string,
): SessionGraphLocatorEntry | null => {
  const child = locator.bySessionId.get(normalizeSessionId(childSessionId));
  if (!child?.parentSessionId) return null;
  return locator.bySessionId.get(child.parentSessionId) ?? null;
};

export const getChildSessionEntries = (
  locator: SessionGraphLocator,
  parentSessionId: string,
): SessionGraphLocatorEntry[] => {
  return locator.childrenByParentSessionId.get(normalizeSessionId(parentSessionId)) ?? [];
};
