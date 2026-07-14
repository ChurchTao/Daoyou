import { beforeEach, describe, expect, it, vi } from 'vitest';
import { startSectTrialOnce } from './sectClient';

describe('startSectTrialOnce', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('按宗门去重 StrictMode 并发试炼请求', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify({
      success: true,
      data: { sect: { sectId: 'lingxiao' }, battle: {} },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    await Promise.all([startSectTrialOnce('lingxiao'), startSectTrialOnce('lingxiao')]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/sects/lingxiao/trial', { method: 'POST' });
    await startSectTrialOnce('lingxiao');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
