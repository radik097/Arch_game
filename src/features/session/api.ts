import type {
  AdminStatsResponse,
  LeaderboardEntry,
  ReplaySubmission,
  ReplayValidationResult,
  SessionStartRequest,
  SessionStartResponse,
  VisitorRegistrationRequest,
  VisitorStatsResponse,
} from '../../shared/replay';

const EXPLICIT_API_BASE_URL = (import.meta.env.VITE_ARCH_TRAINER_API_URL as string | undefined)?.trim() || '';
const IS_LOCAL_HOST = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
const API_BASE_URL = EXPLICIT_API_BASE_URL || (IS_LOCAL_HOST ? 'http://localhost:8787' : '');

function isApiConfigured(): boolean {
  return API_BASE_URL.length > 0;
}

export async function startOfficialSession(payload: SessionStartRequest): Promise<SessionStartResponse> {
  return requestJson<SessionStartResponse>('/api/start-session', payload);
}

export async function submitOfficialReplay(payload: ReplaySubmission): Promise<ReplayValidationResult> {
  return requestJson<ReplayValidationResult>('/api/submit-replay', payload);
}

export async function fetchLeaderboard(difficulty?: string): Promise<LeaderboardEntry[]> {
  if (!isApiConfigured()) {
    return [];
  }

  const suffix = difficulty ? `?difficulty=${encodeURIComponent(difficulty)}` : '';
  const response = await fetch(`${API_BASE_URL}/api/leaderboard${suffix}`);
  if (!response.ok) {
    throw new Error(`Leaderboard request failed with status ${response.status}`);
  }

  return (await response.json()) as LeaderboardEntry[];
}

export async function registerVisit(payload: VisitorRegistrationRequest): Promise<VisitorStatsResponse> {
  if (!isApiConfigured()) {
    return {
      totalVisits: 0,
      uniqueVisitors: 0,
      lastVisitAt: null,
      counted: false,
    };
  }

  return requestJson<VisitorStatsResponse>('/api/visits', payload);
}

export async function fetchVisitorStats(): Promise<VisitorStatsResponse> {
  if (!isApiConfigured()) {
    return {
      totalVisits: 0,
      uniqueVisitors: 0,
      lastVisitAt: null,
      counted: false,
    };
  }

  const response = await fetch(`${API_BASE_URL}/api/visits`);
  if (!response.ok) {
    throw new Error(`Visitor stats request failed with status ${response.status}`);
  }

  return (await response.json()) as VisitorStatsResponse;
}

export async function fetchAdminStats(user: string, password: string): Promise<AdminStatsResponse> {
  if (!isApiConfigured()) {
    throw new Error('Admin API is not configured for this deployment. Set VITE_ARCH_TRAINER_API_URL.');
  }

  const response = await fetch(`${API_BASE_URL}/api/admin/stats`, {
    headers: {
      'x-admin-user': user,
      'x-admin-password': password,
    },
  });

  if (!response.ok) {
    throw new Error(response.status === 401 ? 'Invalid admin credentials.' : `Admin stats request failed with status ${response.status}`);
  }

  return (await response.json()) as AdminStatsResponse;
}

async function requestJson<T>(path: string, body: unknown): Promise<T> {
  if (!isApiConfigured()) {
    throw new Error('API is not configured for this deployment. Set VITE_ARCH_TRAINER_API_URL.');
  }

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