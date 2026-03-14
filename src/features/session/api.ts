import type {
  CountApiCounterResponse,
  LeaderboardEntry,
  ReplaySubmission,
  ReplayValidationResult,
  SessionStartRequest,
  SessionStartResponse,
  StatsResponse,
  VisitorRegistrationRequest,
  VisitorStatsResponse,
} from '../../shared/replay';

const IS_LOCAL_HOST = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
const API_BASE_URL = IS_LOCAL_HOST ? 'http://localhost:8787' : '';
const COUNT_API_BASE_URL = 'https://api.countapi.xyz';
const COUNT_API_NAMESPACE = 'arch-trainer';
const COUNT_API_KEY_PAGE_VIEWS = 'page-views';

export async function startOfficialSession(payload: SessionStartRequest): Promise<SessionStartResponse> {
  return requestJson<SessionStartResponse>('/api/start-session', payload);
}

export async function submitOfficialReplay(payload: ReplaySubmission): Promise<ReplayValidationResult> {
  return requestJson<ReplayValidationResult>('/api/submit-replay', payload);
}

export async function fetchLeaderboard(difficulty?: string): Promise<LeaderboardEntry[]> {
  const suffix = difficulty ? `?difficulty=${encodeURIComponent(difficulty)}` : '';
  const response = await fetch(`${API_BASE_URL}/api/leaderboard${suffix}`);
  if (!response.ok) {
    throw new Error(`Leaderboard request failed with status ${response.status}`);
  }

  return (await response.json()) as LeaderboardEntry[];
}

export async function registerVisit(payload: VisitorRegistrationRequest): Promise<VisitorStatsResponse> {
  return requestJson<VisitorStatsResponse>('/api/visits', payload);
}

export async function fetchVisitorStats(): Promise<VisitorStatsResponse> {
  const response = await fetch(`${API_BASE_URL}/api/visits`);
  if (!response.ok) {
    throw new Error(`Visitor stats request failed with status ${response.status}`);
  }

  return (await response.json()) as VisitorStatsResponse;
}

export async function fetchStats(): Promise<StatsResponse> {
  const response = await fetch(`${API_BASE_URL}/api/stats`);
  if (!response.ok) {
    throw new Error(`Stats request failed with status ${response.status}`);
  }

  return (await response.json()) as StatsResponse;
}

export async function hitPublicPageCounter(): Promise<CountApiCounterResponse> {
  const response = await fetch(`${COUNT_API_BASE_URL}/hit/${encodeURIComponent(COUNT_API_NAMESPACE)}/${encodeURIComponent(COUNT_API_KEY_PAGE_VIEWS)}`);
  if (!response.ok) {
    throw new Error(`CountAPI hit failed with status ${response.status}`);
  }

  return (await response.json()) as CountApiCounterResponse;
}

export async function fetchPublicPageCounter(): Promise<CountApiCounterResponse> {
  const response = await fetch(`${COUNT_API_BASE_URL}/get/${encodeURIComponent(COUNT_API_NAMESPACE)}/${encodeURIComponent(COUNT_API_KEY_PAGE_VIEWS)}`);
  if (!response.ok) {
    throw new Error(`CountAPI get failed with status ${response.status}`);
  }

  return (await response.json()) as CountApiCounterResponse;
}

async function requestJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json()) as T & { error?: string; issue?: { message?: string } };
  if (!response.ok) {
    const message = payload.issue?.message || payload.error || `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload;
}