import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { CONFIG_DIR } from '../config';
import { logDebug } from '../logging';

const DB_PATH = path.join(CONFIG_DIR, 'codex_index.db');

let db: Database.Database | null = null;

const initSchema = (database: Database.Database) => {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      path TEXT UNIQUE NOT NULL,
      session_id TEXT,
      session_id_checked INTEGER,
      timestamp TEXT,
      cwd TEXT,
      git_branch TEXT,
      git_repo TEXT,
      git_commit_hash TEXT,
      first_user_message TEXT,
      started_at TEXT,
      ended_at TEXT,
      turn_count INTEGER,
      message_count INTEGER,
      thought_count INTEGER,
      tool_call_count INTEGER,
      meta_count INTEGER,
      token_count_count INTEGER,
      active_duration_ms INTEGER
    );

    CREATE TABLE IF NOT EXISTS files (
      path TEXT PRIMARY KEY,
      size INTEGER,
      mtime INTEGER,
      hash TEXT,
      indexed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      turn_id INTEGER,
      role TEXT NOT NULL,
      timestamp TEXT,
      content TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
      content,
      session_id UNINDEXED,
      turn_id UNINDEXED,
      role UNINDEXED,
      tokenize = 'porter'
    );
    DROP TRIGGER IF EXISTS messages_ai;
    DROP TRIGGER IF EXISTS messages_ad;
    DROP TRIGGER IF EXISTS messages_au;

    CREATE TRIGGER messages_ai AFTER INSERT ON messages BEGIN
      INSERT INTO messages_fts(rowid, content, session_id, turn_id, role)
      VALUES (new.id, new.content, new.session_id, new.turn_id, new.role);
    END;

    CREATE TRIGGER messages_ad AFTER DELETE ON messages BEGIN
      DELETE FROM messages_fts WHERE rowid = old.id;
    END;

    CREATE TRIGGER messages_au AFTER UPDATE ON messages BEGIN
      DELETE FROM messages_fts WHERE rowid = old.id;
      INSERT INTO messages_fts(rowid, content, session_id, turn_id, role)
      VALUES (new.id, new.content, new.session_id, new.turn_id, new.role);
    END;

    CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
    CREATE INDEX IF NOT EXISTS idx_messages_turn ON messages(session_id, turn_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_timestamp ON sessions(timestamp);
    CREATE INDEX IF NOT EXISTS idx_sessions_cwd ON sessions(cwd);
  `);
  database.exec('CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON sessions(session_id)');
};

const SESSION_COLUMNS: Record<string, string> = {
  started_at: 'TEXT',
  ended_at: 'TEXT',
  turn_count: 'INTEGER',
  message_count: 'INTEGER',
  thought_count: 'INTEGER',
  tool_call_count: 'INTEGER',
  meta_count: 'INTEGER',
  token_count_count: 'INTEGER',
  active_duration_ms: 'INTEGER',
};

const ensureSessionColumns = (database: Database.Database) => {
  const rows = database.prepare('PRAGMA table_info(sessions)').all() as Array<{ name: string }>;
  const existing = new Set(rows.map((row) => row.name));
  const missing = Object.entries(SESSION_COLUMNS).filter(([name]) => !existing.has(name));
  if (!missing.length) return;
  for (const [name, type] of missing) {
    database.exec(`ALTER TABLE sessions ADD COLUMN ${name} ${type}`);
  }
  logDebug('db migrate sessions', { added: missing.map(([name]) => name) });
};

const ensureDb = () => {
  if (db) return db;
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  db = new Database(DB_PATH);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('trusted_schema = ON'); // Allow schema-defined triggers/virtual tables in our local DB; we control the schema and accept the trade-off.
  logDebug('db open', DB_PATH);
  initSchema(db);
  ensureSessionColumns(db);
  return db;
};

const clearDbSchema = (database: Database.Database) => {
  database.exec(`
    DROP TRIGGER IF EXISTS messages_ai;
    DROP TRIGGER IF EXISTS messages_ad;
    DROP TRIGGER IF EXISTS messages_au;
    DROP TABLE IF EXISTS messages_fts;
    DROP TABLE IF EXISTS messages;
    DROP TABLE IF EXISTS files;
    DROP TABLE IF EXISTS sessions;
    DROP TABLE IF EXISTS schema_version;
  `);
};

export const getDb = () => ensureDb();

export const resetDb = () => {
  const database = ensureDb();
  const clearTransaction = database.transaction(() => {
    clearDbSchema(database);
    initSchema(database);
    ensureSessionColumns(database);
  });
  clearTransaction();
};
