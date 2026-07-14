import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@app/lib/player-state/store', () => ({
  consumePlayerStateMutation: vi.fn(async (response: Response) => {
    const payload = await response.json();
    return payload.data;
  }),
}));

import { startLingxiaoExperienceOnce } from './sectClient';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('startLingxiaoExperienceOnce', () => {
  it('dedupes concurrent trial requests triggered by StrictMode effects', async () => {
    const payload = {
      success: true,
      data: { sect: { membershipId: 'trial' }, battle: { turns: 1 } },
      state: {},
    };
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const [first, second] = await Promise.all([
      startLingxiaoExperienceOnce(),
      startLingxiaoExperienceOnce(),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/sects/lingxiao/experience', {
      method: 'POST',
    });
    expect(second).toBe(first);

    await startLingxiaoExperienceOnce();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
