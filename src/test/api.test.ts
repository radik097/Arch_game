import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchPublicPageCounter, hitPublicPageCounter } from '../features/session/api';

describe('session api CountAPI helpers', () => {
  const originalFetch = globalThis.fetch;
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('hits the public page counter endpoint', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        namespace: 'arch-trainer',
        key: 'page-views',
        value: 42,
      }),
    } as Response);

    const result = await hitPublicPageCounter();

    expect(fetchMock).toHaveBeenCalledWith('https://api.countapi.xyz/hit/arch-trainer/page-views');
    expect(result.value).toBe(42);
  });

  it('reads the public page counter endpoint', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        namespace: 'arch-trainer',
        key: 'page-views',
        value: 108,
      }),
    } as Response);

    const result = await fetchPublicPageCounter();

    expect(fetchMock).toHaveBeenCalledWith('https://api.countapi.xyz/get/arch-trainer/page-views');
    expect(result).toEqual({
      namespace: 'arch-trainer',
      key: 'page-views',
      value: 108,
    });
  });

  it('throws when CountAPI hit fails', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: 'unavailable' }),
    } as Response);

    await expect(hitPublicPageCounter()).rejects.toThrow('CountAPI hit failed with status 503');
  });

  it('throws when CountAPI get fails', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: 'missing' }),
    } as Response);

    await expect(fetchPublicPageCounter()).rejects.toThrow('CountAPI get failed with status 404');
  });
});