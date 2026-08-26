import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type {
  StatsResponse,
  LeaderboardEntry,
  PlayerRecord,
  ReplaySubmission,
  SessionRecord,
  VisitorRegistrationRequest,
  VisitorStatsResponse,
} from '../../src/shared/replay.js';
import { applyVisitorEvent, createEmptyVisitorStore, createVisitorStatsResponse, type VisitorStore } from '../telemetry.js';

const dataRoot = join(process.cwd(), 'data');
const sessionsPath = join(dataRoot, 'sessions.json');
const leaderboardPath = join(dataRoot, 'leaderboard.json');
const playersPath = join(dataRoot, 'players.json');
const visitorsPath = join(dataRoot, 'visitors.json');
const replayDir = join(dataRoot, 'replays');
let writeQueue: Promise<void> = Promise.resolve();

export async function createSession(record: SessionRecord): Promise<void> {
  await withWriteLock(async () => {
    const sessions = await readJson<SessionRecord[]>(sessionsPath, []);
    sessions.push(record);
    await writeJson(sessionsPath, sessions);
  });
}

export async function getSession(sessionId: string): Promise<SessionRecord | null> {
  const sessions = await readJson<SessionRecord[]>(sessionsPath, []);
  return sessions.find((record) => record.sessionId === sessionId) ?? null;
}

export async function markSessionUsed(sessionId: string, usedAtMs: number): Promise<SessionRecord | null> {
  return withWriteLock(async () => {
    const sessions = await readJson<SessionRecord[]>(sessionsPath, []);
    const sessionIndex = sessions.findIndex((record) => record.sessionId === sessionId);
    if (sessionIndex === -1 || sessions[sessionIndex].usedAtMs !== null) {
      return null;
    }

    const updated: SessionRecord = { ...sessions[sessionIndex], usedAtMs };
    sessions[sessionIndex] = updated;
    await writeJson(sessionsPath, sessions);
    return updated;
  });
}

export async function createPlayer(record: PlayerRecord): Promise<void> {
  await withWriteLock(async () => {
    const players = await readJson<PlayerRecord[]>(playersPath, []);
    players.push(record);
    await writeJson(playersPath, players);
  });
}

export async function getPlayerById(playerId: string): Promise<PlayerRecord | null> {
  const players = await readJson<PlayerRecord[]>(playersPath, []);
  return players.find((record) => record.playerId === playerId) ?? null;
}

export async function getPlayerByRepo(githubRepo: string): Promise<PlayerRecord | null> {
  const players = await readJson<PlayerRecord[]>(playersPath, []);
  return players.find((record) => record.githubRepo === githubRepo) ?? null;
}

export async function saveReplay(replay: ReplaySubmission, replayHash: string): Promise<void> {
  if (!/^[A-Za-z0-9-]{1,100}$/.test(replay.sessionId) || !/^[a-f0-9]{64}$/i.test(replayHash)) {
    throw new Error('Invalid replay file identifier.');
  }
  await mkdir(replayDir, { recursive: true });
  const target = join(replayDir, `${replay.sessionId}-${replayHash}.json`);
  await writeJson(target, { ...replay, replayHash });
}

export async function insertLeaderboardEntry(entry: Omit<LeaderboardEntry, 'id' | 'createdAt'>): Promise<LeaderboardEntry> {
  return withWriteLock(async () => {
    const leaderboard = await readJson<LeaderboardEntry[]>(leaderboardPath, []);
    const created: LeaderboardEntry = {
      ...entry,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };

    leaderboard.push(created);
    leaderboard.sort((left, right) => left.timeMs - right.timeMs);
    await writeJson(leaderboardPath, leaderboard);
    return created;
  });
}

export async function readLeaderboard(): Promise<LeaderboardEntry[]> {
  return readJson<LeaderboardEntry[]>(leaderboardPath, []);
}

export async function registerVisit(payload: VisitorRegistrationRequest): Promise<VisitorStatsResponse> {
  return withWriteLock(async () => {
    const current = await readJson<VisitorStore>(visitorsPath, createEmptyVisitorStore());
    const { store, stats } = applyVisitorEvent(current, payload, new Date().toISOString());
    await writeJson(visitorsPath, store);
    return stats;
  });
}

export async function readVisitorStats(): Promise<VisitorStatsResponse> {
  const current = await readJson<VisitorStore>(visitorsPath, createEmptyVisitorStore());
  return createVisitorStatsResponse(current);
}

export async function readStats(): Promise<StatsResponse> {
  const visitors = await readJson<VisitorStore>(visitorsPath, createEmptyVisitorStore());
  const sessions = await readJson<SessionRecord[]>(sessionsPath, []);
  const players = await readJson<PlayerRecord[]>(playersPath, []);
  const leaderboard = await readJson<LeaderboardEntry[]>(leaderboardPath, []);
  const replayCount = await readReplayCount();

  return {
    visitors: {
      totalVisits: visitors.totalVisits,
      uniqueVisitors: visitors.uniqueVisitors,
      lastVisitAt: visitors.lastVisitAt,
    },
    sessions: {
      total: sessions.length,
      open: sessions.filter((session) => session.usedAtMs === null).length,
      used: sessions.filter((session) => session.usedAtMs !== null).length,
    },
    replays: {
      total: replayCount,
    },
    players: {
      total: players.length,
    },
    leaderboard: {
      total: leaderboard.length,
      top: leaderboard
        .slice()
        .sort((left, right) => left.timeMs - right.timeMs)
        .slice(0, 5)
        .map((entry) => ({
          forkName: entry.forkName,
          difficulty: entry.difficulty,
          timeMs: entry.timeMs,
          createdAt: entry.createdAt,
        })),
    },
    generatedAt: new Date().toISOString(),
  };
}

async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(path, 'utf8');
    return JSON.parse(raw) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return fallback;
    throw error;
  }
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(value, null, 2), 'utf8');
  await rename(temporaryPath, path);
}

async function withWriteLock<T>(operation: () => Promise<T>): Promise<T> {
  const previous = writeQueue;
  let release: () => void = () => undefined;
  writeQueue = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await operation();
  } finally {
    release();
  }
}

async function readReplayCount(): Promise<number> {
  try {
    const entries = await readdir(replayDir, { withFileTypes: true });
    return entries.filter((entry) => entry.isFile() && entry.name.endsWith('.json')).length;
  } catch {
    return 0;
  }
}
