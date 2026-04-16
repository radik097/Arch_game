export interface SteamPriceOverviewQuery {
  appId: number;
  currency?: number;
  marketHashName: string;
}

export interface SteamPriceOverviewPayload {
  success: boolean;
  lowest_price?: string | null;
  median_price?: string | null;
  volume?: string | null;
}

export interface SteamPriceOverviewResult {
  success: true;
  lowestPrice: string | null;
  medianPrice: string | null;
  volume: string | null;
  currency: number;
  appId: number;
  marketHashName: string;
  source: 'backend' | 'direct' | 'allorigins-raw' | 'corsproxy.io';
}

export interface SteamPriceOverviewRequestOptions {
  preferBackend?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export const STEAM_MARKET_PROXY_CHAIN = ['allorigins-raw', 'corsproxy.io'] as const;

const DEFAULT_CURRENCY = 5;
const DEFAULT_TIMEOUT_MS = 5000;
const LOCAL_BACKEND_URLS = ['http://localhost:8787', 'http://localhost:3000'] as const;

const PROXY_CHAIN: Array<{
  id: 'allorigins-raw' | 'corsproxy.io';
  buildUrl: (targetUrl: string) => string;
}> = [
  {
    id: 'allorigins-raw',
    buildUrl: (targetUrl) => `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
  },
  {
    id: 'corsproxy.io',
    buildUrl: (targetUrl) => `https://corsproxy.io/?url=${encodeURIComponent(targetUrl)}`,
  },
];

export function buildSteamPriceOverviewUrl(query: SteamPriceOverviewQuery): string {
  const normalized = normalizeQuery(query);
  const url = new URL('https://steamcommunity.com/market/priceoverview/');
  url.searchParams.set('currency', String(normalized.currency));
  url.searchParams.set('appid', String(normalized.appId));
  url.searchParams.set('market_hash_name', normalized.marketHashName);
  return url.toString();
}

export async function fetchSteamPriceOverview(
  query: SteamPriceOverviewQuery,
  options: SteamPriceOverviewRequestOptions = {},
): Promise<SteamPriceOverviewResult> {
  const normalized = normalizeQuery(query);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const errors: string[] = [];

  if (options.preferBackend !== false) {
    for (const backendBaseUrl of getBackendBaseUrls()) {
      try {
        const payload = await fetchJsonWithTimeout(buildBackendUrl(backendBaseUrl, normalized), timeoutMs, options.signal);
        return normalizePriceOverview(payload, normalized, 'backend');
      } catch (error) {
        errors.push(`backend(${backendBaseUrl}): ${formatErrorMessage(error)}`);
      }
    }
  }

  const targetUrl = buildSteamPriceOverviewUrl(normalized);
  if (typeof window === 'undefined') {
    try {
      const payload = await fetchJsonWithTimeout(targetUrl, timeoutMs, options.signal, {
        Accept: 'application/json',
        'User-Agent': 'ArchTrainer/0.1.0',
      });
      return normalizePriceOverview(payload, normalized, 'direct');
    } catch (error) {
      errors.push(`direct: ${formatErrorMessage(error)}`);
    }
  }

  for (const proxy of PROXY_CHAIN) {
    try {
      const payload = await fetchJsonWithTimeout(proxy.buildUrl(targetUrl), timeoutMs, options.signal);
      return normalizePriceOverview(payload, normalized, proxy.id);
    } catch (error) {
      errors.push(`${proxy.id}: ${formatErrorMessage(error)}`);
    }
  }

  throw new Error(`Steam market request failed. ${errors.join(' | ')}`);
}

export function isSteamPriceOverviewPayload(value: unknown): value is SteamPriceOverviewPayload {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.success !== 'boolean') {
    return false;
  }

  return true;
}

function normalizeQuery(query: SteamPriceOverviewQuery): Required<SteamPriceOverviewQuery> {
  if (!Number.isInteger(query.appId) || query.appId <= 0) {
    throw new Error(`Invalid appId: ${query.appId}`);
  }

  const marketHashName = query.marketHashName.trim();
  if (!marketHashName) {
    throw new Error('marketHashName is required');
  }

  const currency = query.currency ?? DEFAULT_CURRENCY;
  if (!Number.isInteger(currency) || currency <= 0) {
    throw new Error(`Invalid currency: ${currency}`);
  }

  return {
    appId: query.appId,
    currency,
    marketHashName,
  };
}

function getBackendBaseUrls(): string[] {
  const backendBaseUrls: string[] = [];

  if (typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)) {
    backendBaseUrls.push(...LOCAL_BACKEND_URLS);
  }

  const envBaseUrl = import.meta.env.VITE_API_URL?.trim();
  if (envBaseUrl) {
    backendBaseUrls.push(envBaseUrl);
  }

  return Array.from(new Set(backendBaseUrls.map(trimTrailingSlash).filter(Boolean)));
}

function buildBackendUrl(baseUrl: string, query: Required<SteamPriceOverviewQuery>): string {
  const url = new URL(`${trimTrailingSlash(baseUrl)}/api/steam/priceoverview`);
  url.searchParams.set('currency', String(query.currency));
  url.searchParams.set('appid', String(query.appId));
  url.searchParams.set('market_hash_name', query.marketHashName);
  return url.toString();
}

async function fetchJsonWithTimeout(
  url: string,
  timeoutMs: number,
  signal?: AbortSignal,
  headers?: Record<string, string>,
): Promise<unknown> {
  const controller = new AbortController();
  let abortedByCaller = false;

  const onAbort = () => {
    abortedByCaller = true;
    controller.abort(signal?.reason);
  };

  if (signal) {
    if (signal.aborted) {
      onAbort();
    } else {
      signal.addEventListener('abort', onAbort, { once: true });
    }
  }

  const timeoutId = setTimeout(() => {
    controller.abort(new Error(`Request timed out after ${timeoutMs}ms`));
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...headers,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    if (controller.signal.aborted) {
      if (abortedByCaller) {
        throw new Error('Request was aborted');
      }

      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', onAbort);
  }
}

function normalizePriceOverview(
  payload: unknown,
  query: Required<SteamPriceOverviewQuery>,
  source: SteamPriceOverviewResult['source'],
): SteamPriceOverviewResult {
  if (!isSteamPriceOverviewPayload(payload)) {
    throw new Error('Response is not a valid Steam price overview payload');
  }

  if (!payload.success) {
    throw new Error('Steam returned success=false');
  }

  if (!hasAtLeastOnePriceField(payload)) {
    throw new Error('Steam returned an empty price overview payload');
  }

  return {
    success: true,
    lowestPrice: payload.lowest_price ?? null,
    medianPrice: payload.median_price ?? null,
    volume: payload.volume ?? null,
    currency: query.currency,
    appId: query.appId,
    marketHashName: query.marketHashName,
    source,
  };
}

function hasAtLeastOnePriceField(payload: SteamPriceOverviewPayload): boolean {
  return (
    typeof payload.lowest_price === 'string' ||
    typeof payload.median_price === 'string' ||
    typeof payload.volume === 'string'
  );
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
