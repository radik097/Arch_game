import type { VisitorRegistrationRequest, VisitorStatsResponse } from '../src/shared/replay.js';

interface VisitorSessionRecord {
  firstSeenAt: string;
  lastSeenAt: string;
  visits: number;
  page: string;
  referrer: string;
  userAgent: string;
  language: string;
  timezone: string;
  screen: string;
}

export interface VisitorStore {
  totalVisits: number;
  uniqueVisitors: number;
  lastVisitAt: string | null;
  sessions: Record<string, VisitorSessionRecord>;
}

export function createEmptyVisitorStore(): VisitorStore {
  return {
    totalVisits: 0,
    uniqueVisitors: 0,
    lastVisitAt: null,
    sessions: {},
  };
}

export function applyVisitorEvent(
  store: VisitorStore,
  payload: VisitorRegistrationRequest,
  visitedAt: string,
): { store: VisitorStore; stats: VisitorStatsResponse } {
  const existing = store.sessions[payload.sessionId];
  const counted = !existing;

  const nextSession: VisitorSessionRecord = {
    firstSeenAt: existing?.firstSeenAt ?? visitedAt,
    lastSeenAt: visitedAt,
    visits: (existing?.visits ?? 0) + 1,
    page: payload.page,
    referrer: payload.referrer ?? existing?.referrer ?? '',
    userAgent: payload.userAgent ?? existing?.userAgent ?? '',
    language: payload.language ?? existing?.language ?? '',
    timezone: payload.timezone ?? existing?.timezone ?? '',
    screen: payload.screen ?? existing?.screen ?? '',
  };

  const nextStore: VisitorStore = {
    ...store,
    totalVisits: store.totalVisits + 1,
    uniqueVisitors: store.uniqueVisitors + (counted ? 1 : 0),
    lastVisitAt: visitedAt,
    sessions: {
      ...store.sessions,
      [payload.sessionId]: nextSession,
    },
  };

  return {
    store: nextStore,
    stats: {
      totalVisits: nextStore.totalVisits,
      uniqueVisitors: nextStore.uniqueVisitors,
      lastVisitAt: nextStore.lastVisitAt,
      counted,
    },
  };
}

export function createVisitorStatsResponse(store: VisitorStore): VisitorStatsResponse {
  return {
    totalVisits: store.totalVisits,
    uniqueVisitors: store.uniqueVisitors,
    lastVisitAt: store.lastVisitAt,
    counted: false,
  };
}

export function buildTelegramVisitMessage(payload: VisitorRegistrationRequest, stats: VisitorStatsResponse): string {
  const lines = [
    'Arch Trainer visitor event',
    `page: ${payload.page}`,
    `counted: ${stats.counted ? 'yes' : 'no'}`,
    `total visits: ${stats.totalVisits}`,
    `unique visitors: ${stats.uniqueVisitors}`,
    `referrer: ${payload.referrer || 'direct'}`,
    `language: ${payload.language || 'unknown'}`,
    `timezone: ${payload.timezone || 'unknown'}`,
    `screen: ${payload.screen || 'unknown'}`,
    `ua: ${(payload.userAgent || 'unknown').slice(0, 180)}`,
    `at: ${stats.lastVisitAt || 'unknown'}`,
  ];

  return lines.join('\n');
}

export async function sendTelegramVisitMessage(payload: VisitorRegistrationRequest, stats: VisitorStatsResponse): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) {
    return;
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: buildTelegramVisitMessage(payload, stats),
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Telegram notification failed with status ${response.status}`);
  }
}