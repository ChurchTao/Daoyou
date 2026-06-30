vi.mock('@server/lib/repositories/cultivatorRepository', () => ({
  sampleActiveCultivatorIds: vi.fn(),
}));

vi.mock('@server/lib/services/cultivatorService', () => ({
  getCultivatorByIdUnsafe: vi.fn(),
}));

vi.mock('@server/lib/services/simulateBattleV5', () => ({
  simulateBattleV5: vi.fn(),
}));

import {
  AdminBattleSimulatorError,
  AdminBattleSimulatorService,
} from './AdminBattleSimulatorService';
import type { BattleRecord } from '@shared/types/battle';
import type { Cultivator } from '@shared/types/cultivator';

function makeCultivator(id: string, name: string): Cultivator {
  return {
    id,
    name,
    title: null,
    realm: '金丹',
    realm_stage: '初期',
    age: 80,
    lifespan: 500,
    status: 'active',
    attributes: {
      vitality: 80,
      spirit: 80,
      wisdom: 80,
      speed: 80,
      willpower: 80,
    },
    spiritual_roots: [{ element: '金', strength: 80 }],
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
    spirit_stones: 0,
    background: '',
    gender: '男',
    condition: {
      version: 1,
      resources: { hp: { current: 100 }, mp: { current: 100 } },
      gauges: { pillToxicity: 0 },
      tracks: {
        bodyCultivation: { realm: '凡体', progress: 0, tracks: {} },
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
        bodyCultivationPillUses: 0,
      },
      statuses: [],
      timestamps: {},
    },
  } as unknown as Cultivator;
}

function makeSnapshot(id: string, name: string, hp: number) {
  return {
    id,
    name,
    alive: hp > 0,
    hp: { current: hp, max: 100, percent: hp / 100 },
    mp: { current: 50, max: 100, percent: 0.5 },
    shield: 0,
    attrs: {},
    baseAttrs: {},
    buffs: [],
    cooldowns: [],
    canAct: hp > 0,
  } as any;
}

function makeBattleRecord(args: {
  player: Cultivator;
  opponent: Cultivator;
  winnerSide: 'A' | 'B';
  turns?: number;
}): BattleRecord {
  const winner = args.winnerSide === 'A' ? args.player : args.opponent;
  const loser = args.winnerSide === 'A' ? args.opponent : args.player;
  const playerId = args.player.id!;
  const opponentId = args.opponent.id!;
  return {
    winner,
    loser,
    logs: ['A uses skill', 'B takes damage'],
    turns: args.turns ?? 3,
    player: playerId,
    opponent: opponentId,
    logSpans: [],
    stateTimeline: {
      unitIds: [playerId, opponentId],
      unitNames: {
        [playerId]: args.player.name,
        [opponentId]: args.opponent.name,
      },
      frames: [
        {
          frameId: 1,
          turn: args.turns ?? 3,
          phase: 'battle_end',
          units: {
            [playerId]: makeSnapshot(
              playerId,
              args.player.name,
              args.winnerSide === 'A' ? 70 : 0,
            ),
            [opponentId]: makeSnapshot(
              opponentId,
              args.opponent.name,
              args.winnerSide === 'B' ? 70 : 0,
            ),
          },
        },
      ],
    },
    winnerSnapshot: makeSnapshot(winner.id!, winner.name, 70),
    loserSnapshot: makeSnapshot(loser.id!, loser.name, 0),
  };
}

function makeService(overrides: Partial<ConstructorParameters<typeof AdminBattleSimulatorService>[0]> = {}) {
  const cultivators = new Map([
    ['11111111-1111-4111-8111-111111111111', makeCultivator('11111111-1111-4111-8111-111111111111', '甲')],
    ['22222222-2222-4222-8222-222222222222', makeCultivator('22222222-2222-4222-8222-222222222222', '乙')],
    ['33333333-3333-4333-8333-333333333333', makeCultivator('33333333-3333-4333-8333-333333333333', '丙')],
  ]);
  let simulateCalls = 0;
  const service = new AdminBattleSimulatorService({
    loadCultivator: vi.fn(async (id: string) => {
      const cultivator = cultivators.get(id);
      return cultivator
        ? { cultivator, userId: `user-${id}`, updatedAt: new Date() }
        : null;
    }),
    sampleCultivatorIds: vi.fn(async ({ limit }) =>
      Array.from(cultivators.keys()).slice(0, limit),
    ),
    simulateBattle: vi.fn((player: Cultivator, opponent: Cultivator) => {
      simulateCalls += 1;
      return makeBattleRecord({
        player,
        opponent,
        winnerSide: simulateCalls % 2 === 0 ? 'B' : 'A',
        turns: simulateCalls + 2,
      });
    }),
    generator: {
      buildDraft: vi.fn((input) => {
        const id = `enemy:${input.variantSeed}`;
        const cultivator = makeCultivator(id, `模板${input.difficulty}`);
        cultivator.realm = input.realm;
        cultivator.realm_stage = input.realmStage;
        cultivator.race = input.race;
        return {
          input: {
            ...input,
            difficulty: input.difficulty ?? 50,
            isBoss: Boolean(input.isBoss),
          },
          balance: {
            variantKey: input.variantSeed ?? 'variant',
          },
          cultivator,
        };
      }),
    } as any,
    ...overrides,
  });
  return service;
}

describe('AdminBattleSimulatorService', () => {
  it('loads two active cultivators and returns duel logs and winner summary', async () => {
    const service = makeService();

    const result = await service.duel({
      playerCultivatorId: '11111111-1111-4111-8111-111111111111',
      opponentCultivatorId: '22222222-2222-4222-8222-222222222222',
    });

    expect(result.winnerSide).toBe('A');
    expect(result.turns).toBe(3);
    expect(result.logs).toEqual(['A uses skill', 'B takes damage']);
    expect(result.participants.a.name).toBe('甲');
    expect(result.finalState.a.snapshot.hp.current).toBe(70);
  });

  it('returns a clear error when an active cultivator is missing', async () => {
    const service = makeService();

    await expect(
      service.duel({
        playerCultivatorId: '11111111-1111-4111-8111-111111111111',
        opponentCultivatorId: '99999999-9999-4999-8999-999999999999',
      }),
    ).rejects.toMatchObject({
      status: 404,
      message: '未找到 active 角色',
    });
  });

  it('aggregates template Monte Carlo wins, turn stats, and sample logs', async () => {
    const service = makeService();

    const result = await service.monteCarlo({
      scenario: 'template_vs_template',
      sampleCount: 4,
      sampleLogLimit: 2,
      templateFilters: {
        realms: ['金丹'],
        realmStages: ['初期'],
        races: ['人族'],
        difficultyMin: 50,
        difficultyMax: 50,
      },
      liveSampleFilters: undefined,
    });

    expect(result.sampleCount).toBe(4);
    expect(result.aWins).toBe(2);
    expect(result.bWins).toBe(2);
    expect(result.turnStats).toMatchObject({ p50: 4, p95: 6, min: 3, max: 6 });
    expect(result.samples).toHaveLength(2);
    expect(result.samples[0]?.logs).toEqual(['A uses skill', 'B takes damage']);
    expect(result.breakdowns.some((item) => item.dimension === 'A境界')).toBe(true);
  });

  it('caps live sample repository requests at the service limit', async () => {
    const sampleCultivatorIds = vi.fn(async () => [
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
      '33333333-3333-4333-8333-333333333333',
    ]);
    const service = makeService({ sampleCultivatorIds });

    await service.monteCarlo({
      scenario: 'live_sample_vs_live_sample',
      sampleCount: 100,
      sampleLogLimit: 0,
      templateFilters: undefined,
      liveSampleFilters: {
        realms: ['金丹'],
      },
    });

    expect(sampleCultivatorIds).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 100,
        realms: ['金丹'],
      }),
    );
  });
});
