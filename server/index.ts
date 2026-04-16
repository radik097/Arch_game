import express from 'express';
import cors from 'cors';
import { SessionRepository } from './storage/SessionRepository';

interface SteamPriceOverviewPayload {
  success: boolean;
  lowest_price?: string | null;
  median_price?: string | null;
  volume?: string | null;
}

const app = express();
app.use(cors());
app.use(express.json());

function isSteamPriceOverviewPayload(value: unknown): value is SteamPriceOverviewPayload {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return typeof record.success === 'boolean';
}

function hasPriceOverviewFields(payload: SteamPriceOverviewPayload): boolean {
  return (
    typeof payload.lowest_price === 'string' ||
    typeof payload.median_price === 'string' ||
    typeof payload.volume === 'string'
  );
}

function buildSteamPriceOverviewUrl(appId: number, currency: number, marketHashName: string): string {
  const url = new URL('https://steamcommunity.com/market/priceoverview/');
  url.searchParams.set('currency', String(currency));
  url.searchParams.set('appid', String(appId));
  url.searchParams.set('market_hash_name', marketHashName);
  return url.toString();
}

// POST /api/sessions — создать сессию
app.post('/api/sessions', async (req: any, res: any) => {
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
app.get('/api/sessions/:id', async (req: any, res: any) => {
  try {
    const session = await SessionRepository.getSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// POST /api/sessions/:id/events — добавить replay event
app.post('/api/sessions/:id/events', async (req: any, res: any) => {
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
app.post('/api/sessions/:id/complete', async (req: any, res: any) => {
  try {
    const { completed_at, duration_ms, replay_hash, verified } = req.body;
    await SessionRepository.updateSession(req.params.id, { completed_at, duration_ms, replay_hash, verified });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// GET /api/leaderboard — получить лидерборд
app.get('/api/leaderboard', async (req: any, res: any) => {
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

// GET /api/steam/priceoverview — прокси для Steam Market без браузерных CORS-прокси
app.get('/api/steam/priceoverview', async (req: any, res: any) => {
  const appId = Number(req.query.appid);
  const currency = Number(req.query.currency ?? 5);
  const marketHashName = typeof req.query.market_hash_name === 'string' ? req.query.market_hash_name.trim() : '';

  if (!Number.isInteger(appId) || appId <= 0) {
    return res.status(400).json({ error: 'Invalid appid' });
  }

  if (!Number.isInteger(currency) || currency <= 0) {
    return res.status(400).json({ error: 'Invalid currency' });
  }

  if (!marketHashName) {
    return res.status(400).json({ error: 'market_hash_name is required' });
  }

  try {
    const steamUrl = buildSteamPriceOverviewUrl(appId, currency, marketHashName);
    const response = await fetch(steamUrl, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'ArchTrainer/0.1.0',
      },
    });

    if (!response.ok) {
      return res.status(502).json({ error: `Steam request failed with status ${response.status}` });
    }

    const payload = (await response.json()) as unknown;
    if (!isSteamPriceOverviewPayload(payload)) {
      return res.status(502).json({ error: 'Steam returned an invalid payload' });
    }

    if (!payload.success || !hasPriceOverviewFields(payload)) {
      return res.status(502).json({ error: 'Steam returned an empty price overview payload', payload });
    }

    res.set('Cache-Control', 'no-store');
    return res.json({
      success: true,
      lowest_price: payload.lowest_price ?? null,
      median_price: payload.median_price ?? null,
      volume: payload.volume ?? null,
      appid: appId,
      currency,
      market_hash_name: marketHashName,
      source: 'steam',
    });
  } catch (error) {
    return res.status(502).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// GET /api/health — healthcheck
app.get('/api/health', (req: any, res: any) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Arch Trainer server running on port ${PORT}`);
});
