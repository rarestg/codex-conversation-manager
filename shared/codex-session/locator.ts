import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
import { extractSessionIdFromObject, extractSessionIdFromPath, normalizeSessionId } from './parseCore';
import { extractSessionLineage, mergeSessionLineage } from './sessionGraph';
import type { SessionGraphLocator, SessionGraphLocatorEntry } from './types';

const formatAmbiguousSessionIdMessage = (sessionId: string, entries: SessionGraphLocatorEntry[]) => {
  const paths = entries.map((entry) => `- ${entry.path}`).join('\n');
  return `Ambiguous session ID ${sessionId} matches ${entries.length} files:\n${paths}`;
};

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

export const readSessionGraphMetadataFromFile = async (filePath: string): Promise<SessionGraphLocatorEntry> => {
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
  const duplicateSessionIds = new Map<string, SessionGraphLocatorEntry[]>();
  const childrenByParentSessionId = new Map<string, SessionGraphLocatorEntry[]>();
  for (const filePath of files) {
    const entry = await readSessionGraphMetadataFromFile(filePath);
    entries.push(entry);
    if (entry.sessionId) {
      const duplicateEntries = duplicateSessionIds.get(entry.sessionId);
      if (duplicateEntries) {
        duplicateEntries.push(entry);
      } else {
        const existing = bySessionId.get(entry.sessionId);
        if (existing) {
          bySessionId.delete(entry.sessionId);
          duplicateSessionIds.set(entry.sessionId, [existing, entry]);
        } else {
          bySessionId.set(entry.sessionId, entry);
        }
      }
    }
    if (!entry.parentSessionId) continue;
    const existing = childrenByParentSessionId.get(entry.parentSessionId) ?? [];
    existing.push(entry);
    childrenByParentSessionId.set(entry.parentSessionId, existing);
  }

  return {
    root,
    entries,
    bySessionId,
    duplicateSessionIds,
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
    const byId = getSessionEntryById(locator, trimmed);
    if (byId) return byId;
  }

  const resolvedPath = path.isAbsolute(trimmed) ? path.resolve(trimmed) : path.resolve(locator.root, trimmed);
  return locator.entries.find((entry) => entry.path === trimmed || path.resolve(entry.path) === resolvedPath) ?? null;
};

export const getSessionEntryById = (
  locator: SessionGraphLocator,
  sessionId: string,
): SessionGraphLocatorEntry | null => {
  const normalizedSessionId = normalizeSessionId(sessionId);
  const duplicates = locator.duplicateSessionIds.get(normalizedSessionId);
  if (duplicates) {
    throw new Error(formatAmbiguousSessionIdMessage(normalizedSessionId, duplicates));
  }
  return locator.bySessionId.get(normalizedSessionId) ?? null;
};

export const getParentSessionEntry = (
  locator: SessionGraphLocator,
  childSessionId: string,
): SessionGraphLocatorEntry | null => {
  const child = getSessionEntryById(locator, childSessionId);
  if (!child?.parentSessionId) return null;
  return getSessionEntryById(locator, child.parentSessionId);
};

export const getChildSessionEntries = (
  locator: SessionGraphLocator,
  parentSessionId: string,
): SessionGraphLocatorEntry[] => {
  return locator.childrenByParentSessionId.get(normalizeSessionId(parentSessionId)) ?? [];
};
