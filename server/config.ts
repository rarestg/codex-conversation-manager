import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

interface ConfigFile {
  sessionsRoot?: string;
}

export type SessionsRootInfo = { value: string; source: 'env' | 'config' | 'default' };

export const CONFIG_DIR = path.join(os.homedir(), '.codex-formatter');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');
const DEFAULT_SESSIONS_ROOT = path.join(os.homedir(), '.codex', 'sessions');

let cachedConfig: ConfigFile | null = null;
let cachedRoot: SessionsRootInfo | null = null;

const ensureDir = async (dir: string) => {
  await fsp.mkdir(dir, { recursive: true });
};

const readConfigFile = async (): Promise<ConfigFile> => {
  if (cachedConfig) return cachedConfig;
  let config: ConfigFile;
  try {
    const raw = await fsp.readFile(CONFIG_PATH, 'utf-8');
    config = JSON.parse(raw) as ConfigFile;
  } catch (_error) {
    config = {};
  }
  cachedConfig = config;
  return config;
};

const writeConfigFile = async (config: ConfigFile) => {
  await ensureDir(CONFIG_DIR);
  await fsp.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
  cachedConfig = config;
};

export const resolveSessionsRoot = async (): Promise<SessionsRootInfo> => {
  if (cachedRoot) return cachedRoot;
  if (process.env.CODEX_SESSIONS_ROOT) {
    cachedRoot = { value: process.env.CODEX_SESSIONS_ROOT, source: 'env' };
    return cachedRoot;
  }
  const config = await readConfigFile();
  if (config.sessionsRoot) {
    cachedRoot = { value: config.sessionsRoot, source: 'config' };
    return cachedRoot;
  }
  cachedRoot = { value: DEFAULT_SESSIONS_ROOT, source: 'default' };
  return cachedRoot;
};

export const setSessionsRoot = async (root: string) => {
  cachedRoot = { value: root, source: 'config' };
  const existing = await readConfigFile();
  await writeConfigFile({ ...existing, sessionsRoot: root });
};

export const ensureRootExists = async (root: string) => {
  try {
    const stat = await fsp.stat(root);
    return stat.isDirectory();
  } catch (_error) {
    return false;
  }
};

export const ensurePathSafe = (root: string, relativePath: string) => {
  if (!relativePath || relativePath.includes('\0')) return null;
  const normalized = path.normalize(relativePath);
  if (path.isAbsolute(normalized)) return null;
  if (normalized.split(path.sep).includes('..')) return null;
  const resolvedRoot = path.resolve(root);
  const resolvedPath = path.resolve(root, normalized);
  if (!resolvedPath.startsWith(resolvedRoot + path.sep) && resolvedPath !== resolvedRoot) {
    return null;
  }
  return resolvedPath;
};
