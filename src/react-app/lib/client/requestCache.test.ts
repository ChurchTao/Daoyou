import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchJsonCached, invalidateCachedRequest } from './requestCache';

const key = 'sect:/api/sects/current';

afterEach(() => {
  invalidateCachedRequest(key);
  vi.unstubAllGlobals();
});

describe('fetchJsonCached abort ownership', () => {
  it('does not reuse an aborted request for a new signal owner', async () => {
    const firstController = new AbortController();
    const secondController = new AbortController();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementationOnce((_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('signal is aborted without reason', 'AbortError'));
          });
        }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, data: { sectId: 'lingxiao' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const obsolete = fetchJsonCached('/api/sects/current', {
      key,
      signal: firstController.signal,
    }).catch((error: unknown) => error);
    firstController.abort();
    const fresh = fetchJsonCached<{ success: boolean; data: { sectId: string } }>(
      '/api/sects/current',
      { key, signal: secondController.signal },
    );

    await expect(fresh).resolves.toEqual({
      success: true,
      data: { sectId: 'lingxiao' },
    });
    await expect(obsolete).resolves.toBeInstanceOf(DOMException);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('continues to deduplicate callers without cancellation signals', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await Promise.all([
      fetchJsonCached('/api/sects/current', { key }),
      fetchJsonCached('/api/sects/current', { key }),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
