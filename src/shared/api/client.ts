const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

async function request(path: string, options: RequestInit = {}, retries = 3): Promise<any> {
  let lastError;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(BASE_URL + path, options);
      if (!res.ok) throw new Error(await res.text());
      return await res.json();
    } catch (e) {
      lastError = e;
      await new Promise((r) => setTimeout(r, 300 * (i + 1)));
    }
  }
  throw lastError;
}

export const api = {
  async createSession(data: any) {
    return request('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },
  async addEvent(sessionId: string, event: any) {
    return request(`/api/sessions/${sessionId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
  },
  async completeSession(sessionId: string, data: any) {
    return request(`/api/sessions/${sessionId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },
  async getLeaderboard(difficulty?: string, limit = 20) {
    const params = new URLSearchParams();
    if (difficulty) params.set('difficulty', difficulty);
    params.set('limit', String(limit));
    try {
      return await request(`/api/leaderboard?${params.toString()}`);
    } catch (e) {
      // Graceful degradation: offline mode
      return [];
    }
  },
};
