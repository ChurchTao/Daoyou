import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getStateMock, getTodayMock, joinMock } = vi.hoisted(() => ({
  getStateMock: vi.fn(), getTodayMock: vi.fn(), joinMock: vi.fn(),
}));

vi.mock('@server/lib/drizzle/db', () => ({ getExecutor: vi.fn(() => ({})) }));
vi.mock('@server/lib/hono/middleware', () => {
  return {
    requireActiveCultivator: () => async (context: any, next: () => Promise<void>) => {
      context.set('user', { id: 'user-1' });
      context.set('cultivator', { id: 'cultivator-1', realm: '筑基', realm_stage: '初期', playerRace: 'human' });
      await next();
    },
    validateJson: () => async (_context: any, next: () => Promise<void>) => next(),
    getValidatedJson: (context: any) => context.get('validatedJson'),
  };
});
vi.mock('@server/lib/services/SectService', () => {
  class SectError extends Error {
    constructor(public code: string, message: string, public status = 409) { super(message); }
  }
  return { SectError, SectService: {
    getState: getStateMock, join: joinMock,
    recordExperience: vi.fn(), trainMethod: vi.fn(), selectSwiftPath: vi.fn(),
    setMeridianLoadout: vi.fn(), activateMeridianLoadout: vi.fn(),
    setAbilityLoadout: vi.fn(), setTactic: vi.fn(),
  } };
});
vi.mock('@server/lib/services/SectCommissionService', () => ({
  SectCommissionService: { getToday: getTodayMock, recordEvent: vi.fn(), claim: vi.fn() },
}));
vi.mock('@server/lib/services/cultivatorService', () => ({ getPlayerRuntimeCultivatorById: vi.fn() }));
vi.mock('@shared/lib/battle/simulateBattleV5', () => ({ simulateBattleV5: vi.fn() }));
vi.mock('@server/lib/services/PlayerStateMutationService', () => ({
  commitPlayerStateMutation: vi.fn(async (args) => {
    const value = await args.run({});
    return { result: value.result, state: { cultivatorId: 'cultivator-1', globalVersion: 1, domainVersions: { sect: 1 }, events: [] } };
  }),
  toPlayerStateMutationResponse: vi.fn((value) => ({ success: true, data: value.result, state: value.state })),
}));

import sectsRouter from './sects.router';

const activeSect = {
  membershipId: 'm1', sectId: 'lingxiao', status: 'active', contribution: 30,
  tacticId: 'steady', activeMeridianSlot: 1, configVersion: 1,
  methods: { 'lingxiao-canon': 5, 'sword-guidance': 5 },
  meridianLoadouts: [{ slot: 1, nodeIds: [], version: 1 }], abilityLoadout: ['guiding-sword'],
};

describe('sects router', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns current race, membership, cap and commission', async () => {
    getStateMock.mockResolvedValue(activeSect);
    getTodayMock.mockResolvedValue({ dateKey: '2026-07-13' });
    const response = await new Hono().route('/api/sects', sectsRouter).request('/api/sects/current');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true, data: {
      playerRace: 'human', methodLevelCap: 25, sect: { status: 'active' }, commission: { dateKey: '2026-07-13' },
    } });
  });

  it('commits joining as sect and loadout state changes', async () => {
    joinMock.mockResolvedValue(activeSect);
    const response = await new Hono().route('/api/sects', sectsRouter).request('/api/sects/lingxiao/join', { method: 'POST' });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true, data: { sect: { membershipId: 'm1' } }, state: { domainVersions: { sect: 1 } } });
  });
});
