import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest, buildQuery } from './client';

describe('API client', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('builds supported query parameters and uses the Vite proxy prefix', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ items: [], page: 2, limit: 20, total: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const query = buildQuery({ page: 2, limit: 20, status: 'PENDING', userId: undefined });
    await apiRequest(`/contents${query}`);

    expect(query).toBe('?page=2&limit=20&status=PENDING');
    expect(fetchMock).toHaveBeenCalledWith('/api/contents?page=2&limit=20&status=PENDING', expect.any(Object));
  });

  it('normalizes network failures without exposing a stack trace', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(apiRequest('/contents')).rejects.toEqual(
      expect.objectContaining({ status: 0, message: 'Unable to reach the CMQ API.' }),
    );
  });
});
