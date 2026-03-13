import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import {
  insertLeaderboardEntry,
  createSession,
  getSession,
  markSessionUsed,
  readAdminStats,
  readVisitorStats,
  readLeaderboard,
  registerVisit,
  saveReplay,
} from './storage/fileStore.js';
import { computeReplayHash, validateReplay } from './replayValidator.js';
import { sendTelegramVisitMessage } from './telemetry.js';
import { registerPlayer, verifyForkSessionRequest } from './verification.js';
import type {
  PlayerRegistrationRequest,
  ReplaySubmission,
  SessionRecord,
  SessionStartRequest,
  SessionStartResponse,
  VisitorRegistrationRequest,
} from '../src/shared/replay.js';

const PORT = Number(process.env.PORT ?? 8787);
const SESSION_TTL_MS = 15 * 60 * 1000;
const SESSION_RATE_LIMIT_MAX = 5;
const SESSION_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const ADMIN_USER = 'root';
const ADMIN_PASSWORD = 'GNOME-kde-plasma-log';
const startSessionAttempts = new Map<string, number[]>();

const server = createServer(async (request, response) => {
  try {
    if (!request.url) {
      return sendJson(response, 400, { error: 'Missing URL.' });
    }

    if (request.method === 'OPTIONS') {
      return sendNoContent(response, 204);
    }

    if (request.method === 'POST' && request.url === '/api/visits') {
      const body = await readJsonBody<VisitorRegistrationRequest>(request);
      const stats = await registerVisit(body);
      void sendTelegramVisitMessage(body, stats).catch((error) => {
        console.error('Telegram visitor notification failed:', error);
      });
      return sendJson(response, 200, stats);
    }

    if (request.method === 'GET' && request.url === '/api/visits') {
      const stats = await readVisitorStats();
      return sendJson(response, 200, stats);
    }

    if (request.method === 'GET' && request.url === '/api/admin/stats') {
      if (!isAdminAuthorized(request)) {
        return sendJson(response, 401, { error: 'Unauthorized admin access.' });
      }
      const stats = await readAdminStats();
      return sendJson(response, 200, stats);
    }

    if (request.method === 'POST' && request.url === '/api/register-player') {
      const body = await readJsonBody<PlayerRegistrationRequest>(request);
      const payload = await registerPlayer(body);
      return sendJson(response, 200, payload);
    }

    if (request.method === 'POST' && (request.url === '/api/start-session' || request.url === '/api/session/start')) {
      const body = await readJsonBody<SessionStartRequest>(request);
      const verified = await verifyForkSessionRequest(body);
      assertRateLimit(verified.player.playerId);
      const sessionRecord = buildSessionRecord(body, verified);
      await createSession(sessionRecord);

      const payload: SessionStartResponse = {
        sessionId: sessionRecord.sessionId,
        sessionKey: sessionRecord.sessionKey,
        startTimeMs: sessionRecord.startTimeMs,
        seed: sessionRecord.seed,
        profile: sessionRecord.profile,
        playerId: sessionRecord.playerId,
        githubRepo: sessionRecord.githubRepo,
        buildHash: sessionRecord.buildHash,
        buildId: sessionRecord.buildId,
        forkName: sessionRecord.forkName,
        expiresInSec: SESSION_TTL_MS / 1000,
        verificationMode: 'official',
      };

      return sendJson(response, 200, payload);
    }

    if (request.method === 'POST' && (request.url === '/api/submit-replay' || request.url === '/api/replay/submit')) {
      const body = await readJsonBody<ReplaySubmission>(request);
      const session = await getSession(body.sessionId);
      if (!session) {
        return sendJson(response, 404, {
          accepted: false,
          issue: {
            code: 'SESSION_NOT_FOUND',
            message: 'Server session was not found for this replay.',
          },
        });
      }

      if (session.usedAtMs !== null) {
        return sendJson(response, 409, {
          accepted: false,
          issue: {
            code: 'SESSION_USED',
            message: 'This session already submitted a replay and is closed.',
          },
        });
      }

      const usedAtMs = Date.now();
      await markSessionUsed(body.sessionId, usedAtMs);

      const result = validateReplay(session, body, usedAtMs);
      const replayHash = result.replayHash || computeReplayHash(session, body.commands);
      await saveReplay(body, replayHash);

      if (result.accepted && result.officialTimeMs !== null && result.installHash !== null) {
        const leaderboardEntry = await insertLeaderboardEntry({
          playerId: session.playerId,
          forkName: session.forkName,
          githubRepo: session.githubRepo,
          difficulty: body.difficulty,
          timeMs: result.officialTimeMs,
          commandsCount: result.commandsAccepted,
          replayHash,
          buildHash: session.buildHash,
          installHash: result.installHash,
          verified: true,
          sessionId: body.sessionId,
        });

        return sendJson(response, 200, {
          ...result,
          leaderboardEntry,
        });
      }

      return sendJson(response, 422, result);
    }

    if (request.method === 'GET' && request.url.startsWith('/api/leaderboard')) {
      const url = new URL(request.url, `http://${request.headers.host}`);
      const difficulty = url.searchParams.get('difficulty');
      const leaderboard = await readLeaderboard();
      const filtered = difficulty ? leaderboard.filter((entry) => entry.difficulty === difficulty) : leaderboard;
      return sendJson(response, 200, filtered);
    }

    return sendJson(response, 404, { error: 'Not found.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error.';
    return sendJson(response, 500, { error: message });
  }
});

server.listen(PORT, () => {
  console.log(`Arch Trainer validation server listening on http://localhost:${PORT}`);
});

function buildSessionRecord(request: SessionStartRequest, verified: Awaited<ReturnType<typeof verifyForkSessionRequest>>): SessionRecord {
  const now = Date.now();
  return {
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
    seed: createHash('sha256').update(randomBytes(12)).digest('hex').slice(0, 12),
    profile: 'uefi-single-root-grub',
    sessionKey: randomBytes(32).toString('hex'),
    buildHash: verified.buildHash,
    buildId: verified.buildId,
    verificationMode: 'official',
  };
}

function assertRateLimit(rateKey: string): void {
  const now = Date.now();
  const recent = (startSessionAttempts.get(rateKey) ?? []).filter((timestamp) => now - timestamp <= SESSION_RATE_LIMIT_WINDOW_MS);
  if (recent.length >= SESSION_RATE_LIMIT_MAX) {
    throw new Error('Rate limit exceeded: official server allows at most 5 sessions per minute per player.');
  }

  recent.push(now);
  startSessionAttempts.set(rateKey, recent);
}

function sendJson(response: import('node:http').ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, {
    ...createCorsHeaders(),
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(body));
}

function sendNoContent(response: import('node:http').ServerResponse, statusCode: number): void {
  response.writeHead(statusCode, {
    ...createCorsHeaders(),
    'Cache-Control': 'no-store',
  });
  response.end();
}

function createCorsHeaders(): Record<string, string> {
  const origin = process.env.CORS_ALLOW_ORIGIN?.trim() || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,x-admin-user,x-admin-password',
  };
}

function isAdminAuthorized(request: import('node:http').IncomingMessage): boolean {
  const user = request.headers['x-admin-user'];
  const password = request.headers['x-admin-password'];

  const adminUser = Array.isArray(user) ? user[0] : user;
  const adminPassword = Array.isArray(password) ? password[0] : password;

  return adminUser === ADMIN_USER && adminPassword === ADMIN_PASSWORD;
}

async function readJsonBody<T>(request: import('node:http').IncomingMessage): Promise<T> {
  const chunks: Uint8Array[] = [];

  for await (const chunk of request) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) {
    throw new Error('Request body is required.');
  }

  return JSON.parse(raw) as T;
}