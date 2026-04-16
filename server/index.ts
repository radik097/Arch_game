import express from 'express';
import cors from 'cors';
import { SessionRepository } from './storage/SessionRepository';
const app = express();
app.use(cors());
app.use(express.json());
// POST /api/sessions — создать сессию
app.post('/api/sessions', async (req, res) => {
  try {
    const { id, user_id, mode, difficulty, completed_at, duration_ms, replay_hash } = req.body;
    if (!id || !user_id || !mode || !difficulty) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const session = await SessionRepository.createSession({ id, user_id, mode, difficulty, completed_at, duration_ms, replay_hash });
    res.status(201).json(session);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// GET /api/sessions/:id — получить сессию
app.get('/api/sessions/:id', async (req, res) => {
  try {
    const session = await SessionRepository.getSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// POST /api/sessions/:id/events — добавить replay event
app.post('/api/sessions/:id/events', async (req, res) => {
  try {
    const { id, session_id, timestamp, command, stdout_hash, state_hash, sequence_num } = req.body;
    if (!id || !session_id || !timestamp || !command || !stdout_hash || !state_hash || sequence_num == null) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    await SessionRepository.addReplayEvent({ id, session_id, timestamp, command, stdout_hash, state_hash, sequence_num });
    res.status(201).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// POST /api/sessions/:id/complete — завершить и верифицировать
app.post('/api/sessions/:id/complete', async (req, res) => {
  try {
    const { completed_at, duration_ms, replay_hash, verified } = req.body;
    await SessionRepository.updateSession(req.params.id, { completed_at, duration_ms, replay_hash, verified });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// GET /api/leaderboard — получить лидерборд
app.get('/api/leaderboard', async (req, res) => {
  try {
    const { difficulty, limit } = req.query;
    const entries = await SessionRepository.getLeaderboard(
      typeof difficulty === 'string' ? difficulty : undefined,
      limit ? Number(limit) : 20
    );
    res.json(entries);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// GET /api/health — healthcheck
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Arch Trainer server running on port ${PORT}`);
});