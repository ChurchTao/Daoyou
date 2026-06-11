import { Hono } from 'hono';
import type { Cultivator } from '@shared/types/cultivator';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

const {
  activeCultivatorRecord,
  executorMock,
  commitPlayerStateMutationMock,
  listStateEventsAfterMock,
  subscribePlayerStateEventsMock,
} =
  vi.hoisted(() => ({
  activeCultivatorRecord: {
    id: 'cultivator-1',
    userId: 'user-1',
    status: 'active',
    gameSettings: {},
  },
  executorMock: {},
  listStateEventsAfterMock: vi.fn(),
  subscribePlayerStateEventsMock: vi.fn(() => vi.fn()),
  commitPlayerStateMutationMock: vi.fn(async (input: any) => {
    const { result, changes } = await input.run({ __tx: true });
    return {
      result,
      state: {
        cultivatorId: input.cultivatorId,
        globalVersion: 40,
        domainVersions: Object.fromEntries(
          changes.map((change: any) => [change.domain, 40]),
        ),
        events: changes.map((change: any, index: number) => ({
          id: index + 1,
          cultivatorId: input.cultivatorId,
          globalVersion: 40,
          domainVersion: 40,
          domain: change.domain,
          eventType: change.eventType,
          patch: change.patch ?? {},
          invalidates: change.invalidates ?? [],
          source: input.source,
          createdAt: '2026-01-01T00:00:00.000Z',
        })),
      },
    };
  }),
}));

vi.mock('@server/lib/drizzle/db', () => ({
  getExecutor: vi.fn(),
}));

vi.mock('@server/lib/hono/middleware', () => ({
  requireUser: () => async (context: any, next: () => Promise<void>) => {
    context.set('user', { id: 'user-1' });
    await next();
  },
  requireActiveCultivator: () => async (
    context: any,
    next: () => Promise<void>,
  ) => {
    context.set('user', { id: 'user-1' });
    context.set('cultivator', activeCultivatorRecord);
    context.set('executor', executorMock);
    await next();
  },
  requireActiveCultivatorRef: () => async (
    context: any,
    next: () => Promise<void>,
  ) => {
    context.set('user', { id: 'user-1' });
    context.set('activeCultivatorRef', {
      userId: 'user-1',
      cultivatorId: 'cultivator-1',
      status: 'active',
    });
    context.set('executor', executorMock);
    await next();
  },
  validateJson: (schema: any) => async (
    context: any,
    next: () => Promise<void>,
  ) => {
    context.set('validatedJson', schema.parse(await context.req.json()));
    await next();
  },
  getValidatedJson: (context: any) => context.get('validatedJson'),
}));

vi.mock('@server/lib/services/cultivatorService', () => ({
  getCultivatorsByUserId: vi.fn(),
  hasDeadCultivator: vi.fn(),
  updateCultivatorGameSettings: vi.fn(),
}));

vi.mock('@server/lib/services/PlayerStateMutationService', () => ({
  commitPlayerStateMutation: commitPlayerStateMutationMock,
  toPlayerStateMutationResponse: (committed: any) => ({
    success: true,
    data: committed.result,
    state: committed.state,
  }),
}));

vi.mock('@server/lib/repositories/playerStateRepository', () => ({
  listStateEventsAfter: listStateEventsAfterMock,
}));

vi.mock('@server/lib/services/playerStateBroadcaster', () => ({
  subscribePlayerStateEvents: subscribePlayerStateEventsMock,
}));

vi.mock('@server/lib/services/PlayerStateSnapshotService', () => ({
  buildPlayerStateSnapshot: vi.fn(),
  parsePlayerStateDomains: vi.fn(() => [
    'profile',
    'condition',
    'progress',
    'currency',
    'inventory',
    'products',
    'mail',
    'tasks',
  ]),
}));

import { getExecutor } from '@server/lib/drizzle/db';
import { listStateEventsAfter } from '@server/lib/repositories/playerStateRepository';
import {
  getCultivatorsByUserId,
  hasDeadCultivator,
  updateCultivatorGameSettings,
} from '@server/lib/services/cultivatorService';
import playerRouter from './player.router';

const getExecutorMock = getExecutor as unknown as Mock;
const getCultivatorsByUserIdMock = getCultivatorsByUserId as unknown as Mock;
const hasDeadCultivatorMock = hasDeadCultivator as unknown as Mock;
const updateCultivatorGameSettingsMock =
  updateCultivatorGameSettings as unknown as Mock;
const listStateEventsAfterImportedMock = listStateEventsAfter as unknown as Mock;

function createApp() {
  return new Hono().route('/player', playerRouter);
}

function createCultivator(overrides: Partial<Cultivator> = {}): Cultivator {
  return {
    id: 'cultivator-1',
    createdAt: '2026-01-02T03:04:05.000Z',
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
        longevityPillUsesByRealm: {},
      },
      statuses: [],
      timestamps: {},
    },
    ...overrides,
  };
}

function createStateEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    cultivatorId: 'cultivator-1',
    globalVersion: 11,
    domainVersion: 4,
    domain: 'mail',
    eventType: 'mail.changed',
    patch: {},
    invalidates: [],
    source: 'test',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('player router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    activeCultivatorRecord.gameSettings = {};

    getExecutorMock.mockReturnValue({
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([{ count: 3 }]),
        })),
      })),
    });
    listStateEventsAfterMock.mockResolvedValue([]);
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
            createdAt: '2026-01-02T03:04:05.000Z',
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
            cultivator: expect.objectContaining({
              id: 'cultivator-1',
              createdAt: '2026-01-02T03:04:05.000Z',
            }),
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

  it('returns current cultivator game settings', async () => {
    activeCultivatorRecord.gameSettings = {
      battleAbilityStrategy: {
        version: 1,
        mode: 'aggressive',
        healHpSkipThreshold: 0.7,
        emergencyHealHpThreshold: 0.25,
        restoreMpSkipThreshold: 0.5,
        avoidRepeatControl: false,
      },
    };

    const response = await createApp().request('/player/settings');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: activeCultivatorRecord.gameSettings,
    });
  });

  it('updates current cultivator game settings', async () => {
    const nextSettings = {
      battleAbilityStrategy: {
        version: 1,
        mode: 'conservative',
        healHpSkipThreshold: 0.9,
        emergencyHealHpThreshold: 0.45,
        restoreMpSkipThreshold: 0.6,
        avoidRepeatControl: true,
      },
    };
    updateCultivatorGameSettingsMock.mockResolvedValueOnce(nextSettings);

    const response = await createApp().request('/player/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameSettings: nextSettings }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: true,
        data: nextSettings,
        state: expect.objectContaining({
          events: expect.arrayContaining([
            expect.objectContaining({
              source: 'player_settings_update',
              domain: 'profile',
            }),
          ]),
        }),
      }),
    );
    expect(updateCultivatorGameSettingsMock).toHaveBeenCalledWith(
      'cultivator-1',
      nextSettings,
      { __tx: true },
    );
  });

  it('does not require snapshot for multiple domains sharing the next global version', async () => {
    listStateEventsAfterImportedMock.mockResolvedValueOnce([
      {
        id: 1,
        cultivatorId: 'cultivator-1',
        globalVersion: 11,
        domainVersion: 4,
        domain: 'mail',
        eventType: 'mail.changed',
        patch: {},
        invalidates: [],
        source: 'test',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 2,
        cultivatorId: 'cultivator-1',
        globalVersion: 11,
        domainVersion: 7,
        domain: 'currency',
        eventType: 'currency.changed',
        patch: {},
        invalidates: [],
        source: 'test',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);

    const response = await createApp().request('/player/state/events?after=10');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          requiresSnapshot: false,
        }),
      }),
    );
  });

  it('requires snapshot when recovered events have a real version gap', async () => {
    listStateEventsAfterImportedMock.mockResolvedValueOnce([
      {
        id: 3,
        cultivatorId: 'cultivator-1',
        globalVersion: 12,
        domainVersion: 4,
        domain: 'mail',
        eventType: 'mail.changed',
        patch: {},
        invalidates: [],
        source: 'test',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);

    const response = await createApp().request('/player/state/events?after=10');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          requiresSnapshot: true,
        }),
      }),
    );
  });

  it('terminates player state stream frames with an SSE blank line', async () => {
    listStateEventsAfterImportedMock.mockResolvedValueOnce([
      createStateEvent(),
    ]);
    const controller = new AbortController();

    const response = await createApp().request('/player/state/stream?after=10', {
      signal: controller.signal,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    const reader = response.body?.getReader();
    expect(reader).toBeDefined();

    const chunk = await reader!.read();
    const text = new TextDecoder().decode(chunk.value);
    const dataLine = text
      .split('\n')
      .find((line) => line.startsWith('data: '));

    expect(text).toContain('event: player-state\nid: 11\ndata: ');
    expect(text.endsWith('\n\n')).toBe(true);
    expect(() => JSON.parse(dataLine!.slice('data: '.length))).not.toThrow();

    await reader!.cancel();
    controller.abort();
  });
});
