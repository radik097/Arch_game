import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve(__dirname, '../../data/arch_trainer.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    mode TEXT,
    difficulty TEXT,
    completed_at INTEGER,
    duration_ms INTEGER,
    replay_hash TEXT,
    verified INTEGER
  );
  CREATE TABLE IF NOT EXISTS replay_events (
    id TEXT PRIMARY KEY,
    session_id TEXT,
    timestamp INTEGER,
    command TEXT,
    stdout_hash TEXT,
    state_hash TEXT,
    sequence_num INTEGER
  );
  CREATE TABLE IF NOT EXISTS leaderboard (
    user_id TEXT,
    session_id TEXT,
    duration_ms INTEGER,
    difficulty TEXT,
    verified_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_leaderboard_difficulty ON leaderboard(difficulty);
  CREATE INDEX IF NOT EXISTS idx_replay_events_session ON replay_events(session_id);
`);

export { db };
