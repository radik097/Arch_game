import { db } from './database';

export interface Session {
  id: string;
  user_id: string;
  mode: string;
  difficulty: string;
  completed_at: number | null;
  duration_ms: number | null;
  replay_hash: string | null;
  verified: boolean;
}

export interface LeaderboardEntry {
  user_id: string;
  session_id: string;
  duration_ms: number;
  difficulty: string;
  verified_at: number;
}

export interface ReplayEvent {
  id: string;
  session_id: string;
  timestamp: number;
  command: string;
  stdout_hash: string;
  state_hash: string;
  sequence_num: number;
}

export const SessionRepository = {
  async createSession(data: Omit<Session, 'verified'>): Promise<Session> {
    db.prepare(`INSERT INTO sessions (id, user_id, mode, difficulty, completed_at, duration_ms, replay_hash, verified) VALUES (?, ?, ?, ?, ?, ?, ?, 0)`).run(
      data.id, data.user_id, data.mode, data.difficulty, data.completed_at, data.duration_ms, data.replay_hash
    );
    return { ...data, verified: false };
  },
  async getSession(id: string): Promise<Session | null> {
    return db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) || null;
  },
  async updateSession(id: string, data: Partial<Session>): Promise<void> {
    const fields = Object.keys(data).map((k) => `${k} = ?`).join(', ');
    const values = Object.values(data);
    db.prepare(`UPDATE sessions SET ${fields} WHERE id = ?`).run(...values, id);
  },
  async getLeaderboard(difficulty?: string, limit = 20): Promise<LeaderboardEntry[]> {
    let sql = 'SELECT * FROM leaderboard';
    const params: any[] = [];
    if (difficulty) {
      sql += ' WHERE difficulty = ?';
      params.push(difficulty);
    }
    sql += ' ORDER BY duration_ms ASC LIMIT ?';
    params.push(limit);
    return db.prepare(sql).all(...params);
  },
  async addReplayEvent(event: ReplayEvent): Promise<void> {
    db.prepare(`INSERT INTO replay_events (id, session_id, timestamp, command, stdout_hash, state_hash, sequence_num) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
      event.id, event.session_id, event.timestamp, event.command, event.stdout_hash, event.state_hash, event.sequence_num
    );
  },
  async getReplayEvents(sessionId: string): Promise<ReplayEvent[]> {
    return db.prepare('SELECT * FROM replay_events WHERE session_id = ? ORDER BY sequence_num ASC').all(sessionId);
  },
};
