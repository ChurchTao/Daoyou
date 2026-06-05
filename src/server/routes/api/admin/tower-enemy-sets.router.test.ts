import { Hono } from 'hono';

const {
  getAdminSnapshotMock,
  ensureTowerEnemySetMock,
  ensureTowerEnemySetsForSeasonMock,
} = vi.hoisted(() => ({
  getAdminSnapshotMock: vi.fn(),
  ensureTowerEnemySetMock: vi.fn(),
  ensureTowerEnemySetsForSeasonMock: vi.fn(),
}));

vi.mock('@server/lib/hono/middleware', () => ({
  requireAdmin: () => async (_context: any, next: () => Promise<void>) => {
    await next();
  },
}));

vi.mock('@server/lib/tower/enemySets', () => ({
  towerEnemySetService: {
    getAdminSnapshot: getAdminSnapshotMock,
    ensureTowerEnemySet: ensureTowerEnemySetMock,
    ensureTowerEnemySetsForSeason: ensureTowerEnemySetsForSeasonMock,
  },
}));

import towerEnemySetsRouter from './tower-enemy-sets.router';

function createApp() {
  return new Hono().route(
    '/api/admin/tower-enemy-sets',
    towerEnemySetsRouter,
  );
}

const sampleSnapshot = {
  seasonKey: '2026-W22@Asia/Shanghai',
  realms: [
    {
      seasonKey: '2026-W22@Asia/Shanghai',
      realm: '金丹',
      status: 'ready',
      schemaVersion: 1,
      enemyCount: 20,
      generatedAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-01T00:00:00.000Z',
      errorMessage: null,
      sourceCounts: { llm: 20, fallback: 0 },
      enemies: [],
    },
  ],
};

describe('admin tower enemy sets router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAdminSnapshotMock.mockResolvedValue(sampleSnapshot);
  });

  it('returns a weekly tower enemy set snapshot', async () => {
    const response = await createApp().request(
      '/api/admin/tower-enemy-sets?seasonKey=2026-W22@Asia%2FShanghai',
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      success?: boolean;
      data?: { snapshot?: unknown };
    };
    expect(payload.success).toBe(true);
    expect(payload.data?.snapshot).toEqual(sampleSnapshot);
    expect(getAdminSnapshotMock).toHaveBeenCalledWith(
      '2026-W22@Asia/Shanghai',
    );
  });

  it('rejects invalid season keys', async () => {
    const response = await createApp().request(
      '/api/admin/tower-enemy-sets?seasonKey=bad',
    );

    expect(response.status).toBe(400);
    expect(getAdminSnapshotMock).not.toHaveBeenCalled();
  });

  it('generates one realm manually', async () => {
    ensureTowerEnemySetMock.mockResolvedValueOnce({
      seasonKey: '2026-W22@Asia/Shanghai',
      realm: '金丹',
      generated: true,
      skipped: false,
      enemyCount: 20,
      source: 'generated',
    });

    const response = await createApp().request(
      '/api/admin/tower-enemy-sets/generate',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seasonKey: '2026-W22@Asia/Shanghai',
          realm: '金丹',
          force: true,
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(ensureTowerEnemySetMock).toHaveBeenCalledWith(
      expect.objectContaining({ seasonKey: '2026-W22@Asia/Shanghai' }),
      '金丹',
      { force: true },
    );
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        snapshot: sampleSnapshot,
      },
    });
  });

  it('generates all eligible realms manually', async () => {
    ensureTowerEnemySetsForSeasonMock.mockResolvedValueOnce({
      seasonKey: '2026-W22@Asia/Shanghai',
      processed: 7,
      generated: 7,
      skipped: 0,
      failed: 0,
      logs: [],
    });

    const response = await createApp().request(
      '/api/admin/tower-enemy-sets/generate',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seasonKey: '2026-W22@Asia/Shanghai',
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(ensureTowerEnemySetsForSeasonMock).toHaveBeenCalledWith(
      expect.objectContaining({ seasonKey: '2026-W22@Asia/Shanghai' }),
      { force: false },
    );
  });

  it('rejects generation for realms below tower eligibility', async () => {
    const response = await createApp().request(
      '/api/admin/tower-enemy-sets/generate',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seasonKey: '2026-W22@Asia/Shanghai',
          realm: '筑基',
        }),
      },
    );

    expect(response.status).toBe(400);
    expect(ensureTowerEnemySetMock).not.toHaveBeenCalled();
  });
});
