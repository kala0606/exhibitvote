import Database from 'better-sqlite3';
import path from 'path';

import fs from 'fs';

// In production (Fly.io) DB_PATH points to the mounted volume
const DB_PATH = process.env.DB_PATH ?? path.join(__dirname, '..', 'data', 'exhibitvote.db');
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      state TEXT NOT NULL DEFAULT 'setup',
      current_idea_index INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      name TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ideas (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'solo',
      member_names TEXT NOT NULL DEFAULT '[]',
      presenter_name TEXT NOT NULL,
      order_index INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS votes (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      voter_id TEXT NOT NULL,
      gold_idea_id TEXT NOT NULL,
      silver_idea_id TEXT NOT NULL,
      bronze_idea_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE(session_id, voter_id),
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (voter_id) REFERENCES students(id) ON DELETE CASCADE
    );
  `);
}
