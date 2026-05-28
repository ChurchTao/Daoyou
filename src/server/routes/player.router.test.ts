import { Hono } from 'hono';
import type { Cultivator } from '@shared/types/cultivator';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('@server/lib/drizzle/db', () => ({
  getExecutor: vi.fn(),
}));

vi.mock('@server/lib/hono/middleware', () => ({
  requireUser: () => async (context: any, next: () => Promise<void>) => {
    context.set('user', { id: 'user-1' });
    await next();
  },
}));

vi.mock('@server/lib/services/cultivatorService', () => ({
  getCultivatorsByUserId: vi.fn(),
  hasDeadCultivator: vi.fn(),
}));

import { getExecutor } from '@server/lib/drizzle/db';
import {
  getCultivatorsByUserId,
  hasDeadCultivator,
} from '@server/lib/services/cultivatorService';
import playerRouter from './player.router';

const getExecutorMock = getExecutor as unknown as Mock;
const getCultivatorsByUserIdMock = getCultivatorsByUserId as unknown as Mock;
const hasDeadCultivatorMock = hasDeadCultivator as unknown as Mock;

function createApp() {
  return new Hono().route('/player', playerRouter);
}

function createCultivator(overrides: Partial<Cultivator> = {}): Cultivator {
  return {
    id: 'cultivator-1',
    name: '韩立',
    gender: '男',
    realm: '炼气',
    realm_stage: '初期',
    age: 18,
    lifespan: 120,
    status: 'active',
    attributes: {
      vitality: 10,
      spirit: 10,
      wisdom: 10,
      speed: 10,
      willpower: 10,
    },
    spiritual_roots: [],
    pre_heaven_fates: [],
    cultivations: [],
    skills: [],
    inventory: {
      artifacts: [],
      consumables: [],
      materials: [],
    },
    equipped: {
      weapon: null,
      armor: null,
      accessory: null,
    },
    max_skills: 3,
    spirit_stones: 128,
    condition: {
      version: 1,
      resources: {
        hp: { current: 9999 },
        mp: { current: 9999 },
      },
      gauges: {
        pillToxicity: 0,
      },
      tracks: {
        tempering: {
          vitality: { level: 0, progress: 0 },
          spirit: { level: 0, progress: 0 },
          wisdom: { level: 0, progress: 0 },
          speed: { level: 0, progress: 0 },
          willpower: { level: 0, progress: 0 },
        },
        marrowWash: { level: 0, progress: 0 },
      },
      counters: {
        longTermPillUsesByRealm: {},
        cultivationPillUsesByRealm: {},
      },
      statuses: [],
      timestamps: {},
    },
    ...overrides,
  };
}

describe('player router', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getExecutorMock.mockReturnValue({
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([{ count: 3 }]),
        })),
      })),
    });
  });

  it('returns player cultivators with a server-derived display snapshot', async () => {
    getCultivatorsByUserIdMock.mockResolvedValueOnce([createCultivator()]);
    hasDeadCultivatorMock.mockResolvedValueOnce(false);

    const response = await createApp().request('/player/active');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        activeCultivator: {
          cultivator: expect.objectContaining({
            id: 'cultivator-1',
            name: '韩立',
          }),
          display: {
            attrs: expect.objectContaining({
              spirit: 10,
              willpower: 10,
              maxHp: 360,
              maxMp: 360,
            }),
            resources: {
              hp: {
                current: 360,
                max: 360,
                percent: 100,
              },
              mp: {
                current: 360,
                max: 360,
                percent: 100,
              },
            },
          },
        },
        cultivators: [
          expect.objectContaining({
            cultivator: expect.objectContaining({ id: 'cultivator-1' }),
            display: expect.objectContaining({
              attrs: expect.objectContaining({ maxMp: 360 }),
            }),
          }),
        ],
        unreadMailCount: 3,
      },
      meta: {
        hasActive: true,
        hasDead: false,
      },
    });
    expect(getCultivatorsByUserIdMock).toHaveBeenCalledWith('user-1');
    expect(hasDeadCultivatorMock).toHaveBeenCalledWith('user-1');
  });
});
