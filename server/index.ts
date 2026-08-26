import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import type { Difficulty } from '../src/features/simulator/types.js';
import type {
  PlayerRegistrationRequest,
  ReplaySubmission,
  ReplayValidationResult,
  SessionRecord,
  SessionStartRequest,
  VisitorRegistrationRequest,
} from '../src/shared/replay.js';
import { validateReplay } from './replayValidator.js';
import {
  createSession,
  getSession,
  insertLeaderboardEntry,
  markSessionUsed,
  readLeaderboard,
  readStats,
  readVisitorStats,
  registerVisit,
  saveReplay,
} from './storage/fileStore.js';
import { sendTelegramVisitMessage } from './telemetry.js';
import { registerPlayer, verifyForkSessionRequest } from './verification.js';

interface SteamPriceOverviewPayload {
  success: boolean;
  lowest_price?: string | null;
  median_price?: string | null;
  volume?: string | null;
}

const DIFFICULTIES = new Set<Difficulty>(['beginner', 'experienced', 'expert', 'god']);
const SESSION_TTL_MS = 30 * 60 * 1000;
const MAX_REPLAY_COMMANDS = 500;
const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS ?? 'https://radik097.github.io')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
);

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use((_, res, next) => {
  res.set({
    'Cross-Origin-Resource-Policy': 'same-site',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  });
  next();
});
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Origin is not allowed'));
  },
  methods: ['GET', 'POST'],
}));
app.use(express.json({ limit: '128kb' }));
app.use('/api', createRateLimiter(120, 60_000));

app.post('/api/register-player', async (req: Request, res: Response, next: NextFunction) => {
  try {
    requireRegistrationToken(req);
    res.status(201).json(await registerPlayer(parsePlayerRegistration(req.body)));
  } catch (error) {
    next(error);
  }
});

app.post('/api/start-session', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const request = parseSessionStart(req.body);
    const verified = await verifyForkSessionRequest(request);
    const now = Date.now();
    const session: SessionRecord = {
      sessionId: randomUUID(),
      difficulty: request.difficulty,
      playerId: verified.player.playerId,
      forkName: verified.forkName,
      githubRepo: verified.githubRepo,
      version: request.version,
      startTimeMs: now,
      createdAtMs: now,
      expiresAtMs: now + SESSION_TTL_MS,
      usedAtMs: null,
      seed: randomBytes(16).toString('hex'),
      profile: 'uefi-single-root-grub',
      sessionKey: randomBytes(32).toString('hex'),
      buildHash: verified.buildHash,
      buildId: verified.buildId,
      verificationMode: 'official',
    };

    await createSession(session);
    res.status(201).json({
      sessionId: session.sessionId,
      sessionKey: session.sessionKey,
      startTimeMs: session.startTimeMs,
      seed: session.seed,
      profile: session.profile,
      playerId: session.playerId,
      githubRepo: session.githubRepo,
      buildHash: session.buildHash,
      buildId: session.buildId,
      forkName: session.forkName,
      expiresInSec: SESSION_TTL_MS / 1000,
      verificationMode: session.verificationMode,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/submit-replay', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const replay = parseReplay(req.body);
    const session = await getSession(replay.sessionId);
    if (!session) {
      res.status(404).json(rejectedReplay('SESSION_NOT_FOUND', 'Session was not found.'));
      return;
    }

    const receivedAtMs = Date.now();
    const result = validateReplay(session, replay, receivedAtMs);
    if (!result.accepted || !result.replayHash || !result.installHash || result.officialTimeMs === null) {
      res.status(422).json(result);
      return;
    }

    const claimedSession = await markSessionUsed(session.sessionId, receivedAtMs);
    if (!claimedSession || claimedSession.usedAtMs !== receivedAtMs) {
      res.status(409).json(rejectedReplay('SESSION_USED', 'This session has already been submitted.'));
      return;
    }

    await saveReplay(replay, result.replayHash);
    await insertLeaderboardEntry({
      playerId: session.playerId,
      forkName: session.forkName,
      githubRepo: session.githubRepo,
      difficulty: session.difficulty,
      timeMs: result.officialTimeMs,
      commandsCount: replay.commands.length,
      replayHash: result.replayHash,
      buildHash: session.buildHash,
      installHash: result.installHash,
      verified: true,
      sessionId: session.sessionId,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get('/api/leaderboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const difficulty = typeof req.query.difficulty === 'string' ? req.query.difficulty : undefined;
    if (difficulty && !DIFFICULTIES.has(difficulty as Difficulty)) {
      throw new RequestError('Invalid difficulty.');
    }
    const requestedLimit = Number(req.query.limit ?? 20);
    const limit = Number.isInteger(requestedLimit) ? Math.min(100, Math.max(1, requestedLimit)) : 20;
    const entries = await readLeaderboard();
    res.json(entries.filter((entry) => !difficulty || entry.difficulty === difficulty).slice(0, limit));
  } catch (error) {
    next(error);
  }
});

app.post('/api/visits', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = parseVisitor(req.body);
    const stats = await registerVisit(payload);
    void sendTelegramVisitMessage(payload, stats).catch((error) => {
      console.error('Telegram visit notification failed:', error instanceof Error ? error.message : 'unknown error');
    });
    res.status(201).json(stats);
  } catch (error) {
    next(error);
  }
});

app.get('/api/visits', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await readVisitorStats());
  } catch (error) {
    next(error);
  }
});

app.get('/api/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await readStats());
  } catch (error) {
    next(error);
  }
});

app.get('/api/steam/priceoverview', async (req: Request, res: Response) => {
  const appId = Number(req.query.appid);
  const currency = Number(req.query.currency ?? 5);
  const marketHashName = typeof req.query.market_hash_name === 'string' ? req.query.market_hash_name.trim() : '';

  if (!Number.isInteger(appId) || appId <= 0 || !Number.isInteger(currency) || currency <= 0) {
    res.status(400).json({ error: 'Invalid appid or currency.' });
    return;
  }
  if (!marketHashName || marketHashName.length > 256) {
    res.status(400).json({ error: 'market_hash_name is required and must not exceed 256 characters.' });
    return;
  }

  try {
    const response = await fetch(buildSteamPriceOverviewUrl(appId, currency, marketHashName), {
      headers: { Accept: 'application/json', 'User-Agent': 'ArchTrainer/0.2.0' },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      res.status(502).json({ error: `Steam request failed with status ${response.status}` });
      return;
    }
    const payload = (await response.json()) as unknown;
    if (!isSteamPriceOverviewPayload(payload) || !payload.success || !hasPriceOverviewFields(payload)) {
      res.status(502).json({ error: 'Steam returned an invalid or empty price overview payload.' });
      return;
    }
    res.set('Cache-Control', 'no-store').json({
      success: true,
      lowest_price: payload.lowest_price ?? null,
      median_price: payload.median_price ?? null,
      volume: payload.volume ?? null,
      appid: appId,
      currency,
      market_hash_name: marketHashName,
      source: 'steam',
    });
  } catch {
    res.status(502).json({ error: 'Steam request failed.' });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof UnauthorizedError) {
    res.status(401).json({ error: error.message });
    return;
  }
  if (error instanceof ServiceUnavailableError) {
    res.status(503).json({ error: error.message });
    return;
  }
  if (error instanceof RequestError) {
    res.status(400).json({ error: error.message });
    return;
  }
  if (error instanceof SyntaxError && 'body' in error) {
    res.status(400).json({ error: 'Invalid JSON payload.' });
    return;
  }
  console.error('Request failed:', error instanceof Error ? error.message : 'unknown error');
  res.status(500).json({ error: 'Internal server error.' });
});

const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => {
  console.log(`Arch Trainer server running on port ${port}`);
});

function parsePlayerRegistration(value: unknown): PlayerRegistrationRequest {
  const payload = asObject(value);
  return { githubRepo: requiredString(payload.githubRepo, 'githubRepo', 200) };
}

function requireRegistrationToken(req: Request): void {
  const expected = process.env.PLAYER_REGISTRATION_TOKEN?.trim();
  if (!expected) {
    throw new ServiceUnavailableError('Player registration is not configured.');
  }
  const supplied = req.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  if (expectedBuffer.length !== suppliedBuffer.length || !timingSafeEqual(expectedBuffer, suppliedBuffer)) {
    throw new UnauthorizedError('Invalid registration token.');
  }
}

function parseSessionStart(value: unknown): SessionStartRequest {
  const payload = asObject(value);
  const difficulty = requiredString(payload.difficulty, 'difficulty', 32);
  if (!DIFFICULTIES.has(difficulty as Difficulty)) {
    throw new RequestError('Invalid difficulty.');
  }
  const verification = asObject(payload.verification);
  asObject(verification.config);
  asObject(verification.buildProof);
  requiredString(verification.playerId, 'verification.playerId', 100);
  requiredString(verification.githubRepo, 'verification.githubRepo', 200);
  return {
    difficulty: difficulty as Difficulty,
    version: requiredString(payload.version, 'version', 32),
    verification: verification as unknown as SessionStartRequest['verification'],
  };
}

function parseReplay(value: unknown): ReplaySubmission {
  const payload = asObject(value);
  const commands = payload.commands;
  if (!Array.isArray(commands) || commands.length === 0 || commands.length > MAX_REPLAY_COMMANDS) {
    throw new RequestError(`commands must contain between 1 and ${MAX_REPLAY_COMMANDS} entries.`);
  }
  for (const item of commands) {
    const command = asObject(item);
    requiredString(command.cmd, 'commands[].cmd', 512);
    if (!Number.isSafeInteger(command.tGameMs) || !Number.isSafeInteger(command.tUnixMs)) {
      throw new RequestError('Replay timestamps must be integers.');
    }
    const hash = requiredString(command.hash, 'commands[].hash', 64);
    if (!/^[a-f0-9]{64}$/i.test(hash)) {
      throw new RequestError('Replay command hash is invalid.');
    }
  }
  const difficulty = requiredString(payload.difficulty, 'difficulty', 32);
  if (!DIFFICULTIES.has(difficulty as Difficulty)) {
    throw new RequestError('Invalid difficulty.');
  }
  return {
    version: requiredString(payload.version, 'version', 32),
    difficulty: difficulty as Difficulty,
    sessionId: requiredString(payload.sessionId, 'sessionId', 100),
    seed: requiredString(payload.seed, 'seed', 100),
    playerId: requiredString(payload.playerId, 'playerId', 100),
    githubRepo: requiredString(payload.githubRepo, 'githubRepo', 200),
    buildHash: requiredString(payload.buildHash, 'buildHash', 200),
    buildId: requiredString(payload.buildId, 'buildId', 200),
    commands: commands as ReplaySubmission['commands'],
  };
}

function parseVisitor(value: unknown): VisitorRegistrationRequest {
  const payload = asObject(value);
  return {
    sessionId: requiredString(payload.sessionId, 'sessionId', 100),
    page: requiredString(payload.page, 'page', 500),
    referrer: optionalString(payload.referrer, 1000),
    userAgent: optionalString(payload.userAgent, 500),
    language: optionalString(payload.language, 50),
    timezone: optionalString(payload.timezone, 100),
    screen: optionalString(payload.screen, 50),
  };
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RequestError('JSON body must be an object.');
  }
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, name: string, maxLength: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength) {
    throw new RequestError(`${name} is required and must not exceed ${maxLength} characters.`);
  }
  return value.trim();
}

function optionalString(value: unknown, maxLength: number): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.length > maxLength) {
    throw new RequestError(`Optional string must not exceed ${maxLength} characters.`);
  }
  return value;
}

function rejectedReplay(code: 'SESSION_NOT_FOUND' | 'SESSION_USED', message: string): ReplayValidationResult {
  return {
    accepted: false,
    officialTimeMs: null,
    commandsAccepted: 0,
    issue: { code, message },
    replayHash: '',
    installHash: null,
    completed: false,
  };
}

function createRateLimiter(limit: number, windowMs: number) {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const existing = buckets.get(key);
    const bucket = !existing || existing.resetAt <= now ? { count: 0, resetAt: now + windowMs } : existing;
    bucket.count += 1;
    buckets.set(key, bucket);
    res.set('RateLimit-Remaining', String(Math.max(0, limit - bucket.count)));
    if (bucket.count > limit) {
      res.set('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)));
      res.status(429).json({ error: 'Too many requests.' });
      return;
    }
    if (buckets.size > 10_000) {
      for (const [bucketKey, value] of buckets) {
        if (value.resetAt <= now) buckets.delete(bucketKey);
      }
    }
    next();
  };
}

function isSteamPriceOverviewPayload(value: unknown): value is SteamPriceOverviewPayload {
  return Boolean(value && typeof value === 'object' && typeof (value as Record<string, unknown>).success === 'boolean');
}

function hasPriceOverviewFields(payload: SteamPriceOverviewPayload): boolean {
  return typeof payload.lowest_price === 'string' || typeof payload.median_price === 'string' || typeof payload.volume === 'string';
}

function buildSteamPriceOverviewUrl(appId: number, currency: number, marketHashName: string): string {
  const url = new URL('https://steamcommunity.com/market/priceoverview/');
  url.searchParams.set('currency', String(currency));
  url.searchParams.set('appid', String(appId));
  url.searchParams.set('market_hash_name', marketHashName);
  return url.toString();
}

class RequestError extends Error {}
class UnauthorizedError extends Error {}
class ServiceUnavailableError extends Error {}
