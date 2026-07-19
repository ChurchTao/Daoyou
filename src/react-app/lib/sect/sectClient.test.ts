import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchSectCurrent,
  startSectTaskBattleOnce,
  startSectTrialOnce,
} from './sectClient';

describe('startSectTrialOnce', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('按宗门去重 StrictMode 并发试炼请求', async () => {
    const fetchMock = vi.fn().mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            success: true,
            data: { sect: { sectId: 'lingxiao' }, battle: {} },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    );
    vi.stubGlobal('fetch', fetchMock);
    await Promise.all([
      startSectTrialOnce('lingxiao'),
      startSectTrialOnce('lingxiao'),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/sects/lingxiao/trial', {
      method: 'POST',
      headers: { 'Idempotency-Key': expect.any(String) },
    });
    await startSectTrialOnce('lingxiao');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('startSectTaskBattleOnce', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('uses the generic task action endpoint and dedupes one battle attempt', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            task: { definitionId: 'fixture-task', state: 'active' },
            outcome: {
              renderer: 'sect.outcome.battle',
              data: { battle: { id: 'battle-1' }, won: false, challengeTitle: '试炼', rewardGranted: false },
            },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const attemptId = '00000000-0000-4000-8000-000000000005';
    const [first, second] = await Promise.all([
      startSectTaskBattleOnce('fixture-task', attemptId),
      startSectTaskBattleOnce('fixture-task', attemptId),
    ]);
    expect(first).toEqual(second);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/sects/current/tasks/fixture-task/actions/execute',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Idempotency-Key': attemptId }),
      }),
    );
  });
});

describe('sect query dedupe', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('dedupes concurrent overview reads through the shared request cache', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ success: true, data: { sect: null, definition: null } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    await Promise.all([fetchSectCurrent(), fetchSectCurrent()]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
