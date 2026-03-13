import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { LeaderboardEntry, PlayerRecord, ReplaySubmission, SessionRecord, VisitorRegistrationRequest, VisitorStatsResponse } from '../../src/shared/replay.js';
import { applyVisitorEvent, createEmptyVisitorStore, createVisitorStatsResponse, type VisitorStore } from '../telemetry.js';

const dataRoot = join(process.cwd(), 'data');
const sessionsPath = join(dataRoot, 'sessions.json');
const leaderboardPath = join(dataRoot, 'leaderboard.json');
const playersPath = join(dataRoot, 'players.json');
const visitorsPath = join(dataRoot, 'visitors.json');
const replayDir = join(dataRoot, 'replays');

export async function createSession(record: SessionRecord): Promise<void> {
  const sessions = await readJson<SessionRecord[]>(sessionsPath, []);
  sessions.push(record);
  await writeJson(sessionsPath, sessions);
}

export async function getSession(sessionId: string): Promise<SessionRecord | null> {
  const sessions = await readJson<SessionRecord[]>(sessionsPath, []);
  return sessions.find((record) => record.sessionId === sessionId) ?? null;
}

export async function markSessionUsed(sessionId: string, usedAtMs: number): Promise<SessionRecord | null> {
  const sessions = await readJson<SessionRecord[]>(sessionsPath, []);
  const sessionIndex = sessions.findIndex((record) => record.sessionId === sessionId);
  if (sessionIndex === -1) {
    return null;
  }

  const updated: SessionRecord = {
    ...sessions[sessionIndex],
    usedAtMs,
  };

  sessions[sessionIndex] = updated;
  await writeJson(sessionsPath, sessions);
  return updated;
}

export async function createPlayer(record: PlayerRecord): Promise<void> {
  const players = await readJson<PlayerRecord[]>(playersPath, []);
  players.push(record);
  await writeJson(playersPath, players);
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
  await mkdir(replayDir, { recursive: true });
  const target = join(replayDir, `${replay.sessionId}-${replayHash}.json`);
  await writeFile(target, JSON.stringify({ ...replay, replayHash }, null, 2), 'utf8');
}

export async function insertLeaderboardEntry(entry: Omit<LeaderboardEntry, 'id' | 'createdAt'>): Promise<LeaderboardEntry> {
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
}

export async function readLeaderboard(): Promise<LeaderboardEntry[]> {
  return readJson<LeaderboardEntry[]>(leaderboardPath, []);
}

export async function registerVisit(payload: VisitorRegistrationRequest): Promise<VisitorStatsResponse> {
  const current = await readJson<VisitorStore>(visitorsPath, createEmptyVisitorStore());
  const { store, stats } = applyVisitorEvent(current, payload, new Date().toISOString());
  await writeJson(visitorsPath, store);
  return stats;
}

export async function readVisitorStats(): Promise<VisitorStatsResponse> {
  const current = await readJson<VisitorStore>(visitorsPath, createEmptyVisitorStore());
  return createVisitorStatsResponse(current);
}

async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(path, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(value, null, 2), 'utf8');
}