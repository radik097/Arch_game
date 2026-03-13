import type {
  LeaderboardEntry,
  ReplaySubmission,
  ReplayValidationResult,
  SessionStartRequest,
  SessionStartResponse,
  VisitorRegistrationRequest,
  VisitorStatsResponse,
} from '../../shared/replay';

const API_BASE_URL = (import.meta.env.VITE_ARCH_TRAINER_API_URL as string | undefined)?.trim() || 'http://localhost:8787';

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