import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnemyGenerator } from '@shared/engine/enemyGenerator';
import type { EnemyGenerationDraft } from '@shared/engine/enemy-generation/types';
import {
  getTowerSeasonMeta,
  TOWER_ELIGIBLE_REALMS,
  TOWER_MAX_FLOOR,
  type TowerPreparedEnemy,
} from '@shared/lib/tower';
import type { Cultivator } from '@shared/types/cultivator';

const {
  findTowerEnemyFloorMock,
  findLatestReadyTowerEnemyFloorMock,
  listTowerEnemyFloorSummariesBySeasonMock,
  listTowerEnemyFloorsBySeasonRealmMock,
  upsertReadyTowerEnemyFloorMock,
  upsertFailedTowerEnemyFloorMock,
} = vi.hoisted(() => ({
  findTowerEnemyFloorMock: vi.fn(),
  findLatestReadyTowerEnemyFloorMock: vi.fn(),
  listTowerEnemyFloorSummariesBySeasonMock: vi.fn(),
  listTowerEnemyFloorsBySeasonRealmMock: vi.fn(),
  upsertReadyTowerEnemyFloorMock: vi.fn(),
  upsertFailedTowerEnemyFloorMock: vi.fn(),
}));

vi.mock('@server/lib/repositories/towerEnemySetRepository', () => ({
  findTowerEnemyFloor: findTowerEnemyFloorMock,
  findLatestReadyTowerEnemyFloor: findLatestReadyTowerEnemyFloorMock,
  listTowerEnemyFloorSummariesBySeason: listTowerEnemyFloorSummariesBySeasonMock,
  listTowerEnemyFloorsBySeasonRealm: listTowerEnemyFloorsBySeasonRealmMock,
  upsertReadyTowerEnemyFloor: upsertReadyTowerEnemyFloorMock,
  upsertFailedTowerEnemyFloor: upsertFailedTowerEnemyFloorMock,
}));

import { TowerEnemySetService } from './enemySets';

function makeCultivator(id: string): Cultivator {
  return {
    id,
    name: id,
    title: '守关人',
    gender: '男',
    race: '人族',
    realm: '金丹',
    realm_stage: '初期',
    age: 120,
    lifespan: 800,
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
    inventory: { artifacts: [], consumables: [], materials: [] },
    equipped: { weapon: null, armor: null, accessory: null },
    spirit_stones: 0,
    background: 'fallback',
    description: 'fallback',
  };
}

function makeDraft(input: Record<string, unknown>): EnemyGenerationDraft {
  return {
    input: input as unknown as EnemyGenerationDraft['input'],
    missingNarrative: {
      name: true,
      title: true,
      background: true,
      description: true,
    },
    balance: {
      baseCap: 80,
      difficultyFactor: 1,
      totalAttributeBudget: 400,
      band: 'core',
      variantKey: String(input.variantSeed ?? 'variant'),
      primaryElement: '金',
      secondaryElement: '木',
      primaryPersonaId: 'test',
      recoveryTierUsed: 0,
      bodyCultivation: {
        realm: 'mortal_body',
        totalLevel: 0,
        focusTracks: [],
        trackLevels: {
          skin: 0,
          sinew_bone: 0,
          organs: 0,
          qi_blood: 0,
          primordial_spirit: 0,
        },
      },
    },
    copyFacts: {
      race: '人族',
      realm: '金丹',
      realmStage: '初期',
      difficulty: 5,
      difficultyFactor: 1,
      bodyCultivation: {
        realm: 'mortal_body',
        totalLevel: 0,
        focusTracks: [],
        trackLevels: {
          skin: 0,
          sinew_bone: 0,
          organs: 0,
          qi_blood: 0,
          primordial_spirit: 0,
        },
      },
      primaryElement: '金',
      secondaryElement: '木',
      profileTags: [],
      personaTags: [],
      character: {
        fallbackName: '守关人',
        fallbackTitle: '守关人',
        fallbackBackground: 'fallback',
        fallbackDescription: 'fallback',
      },
      products: [],
    },
    cultivator: makeCultivator(String(input.variantSeed ?? 'enemy')),
  };
}

function makeGenerator(options: { failFloor?: number } = {}): EnemyGenerator {
  return {
    buildDraft: vi.fn((input) => {
      if (
        options.failFloor &&
        String(input.variantSeed).endsWith(`:${options.failFloor}`)
      ) {
        throw new Error(`floor ${options.failFloor} failed`);
      }
      return makeDraft(input);
    }),
    enrichNarrative: vi.fn(async (draft: EnemyGenerationDraft) => ({
      ...draft,
      missingNarrative: {
        name: false,
        title: false,
        background: false,
        description: false,
      },
    })),
  } as unknown as EnemyGenerator;
}

function makePreparedEnemy(floor: number, seasonKey = '2026-W22@Asia/Shanghai') {
  return {
    floor,
    encounter: {
      floor,
      kind: floor % 10 === 0 ? 'boss' : floor % 5 === 0 ? 'elite' : 'normal',
      difficulty: floor * 5,
      race: '人族',
      realm: '金丹',
      realmStage: '初期',
      isBoss: floor % 10 === 0,
    },
    enemy: makeCultivator(`enemy-${floor}`),
    generationMeta: {
      variantSeed: `tower:${seasonKey}:金丹:${floor}`,
      source: 'llm',
      generatedAt: '2026-06-01T00:00:00.000Z',
    },
  } satisfies TowerPreparedEnemy;
}

function makeFloorRecord(floor: number, status: 'ready' | 'failed' = 'ready') {
  return {
    seasonKey: '2026-W22@Asia/Shanghai',
    realm: '金丹',
    floor,
    status,
    schemaVersion: 1,
    generatedAt: new Date('2026-06-01T00:00:00.000Z'),
    updatedAt: new Date('2026-06-01T00:10:00.000Z'),
    errorMessage: status === 'failed' ? '生成失败' : null,
    enemy: status === 'ready' ? makePreparedEnemy(floor) : null,
  };
}

describe('tower enemy sets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findTowerEnemyFloorMock.mockResolvedValue(undefined);
    findLatestReadyTowerEnemyFloorMock.mockResolvedValue(undefined);
    listTowerEnemyFloorSummariesBySeasonMock.mockResolvedValue([]);
    listTowerEnemyFloorsBySeasonRealmMock.mockResolvedValue([]);
  });

  it('generates one row per floor for each eligible realm', async () => {
    const generator = makeGenerator();
    const service = new TowerEnemySetService({ generator });
    const result = await service.ensureTowerEnemySetsForSeason(
      getTowerSeasonMeta(new Date('2026-06-01T00:00:00.000Z')),
    );

    expect(result.processed).toBe(TOWER_ELIGIBLE_REALMS.length * TOWER_MAX_FLOOR);
    expect(result.generated).toBe(TOWER_ELIGIBLE_REALMS.length * TOWER_MAX_FLOOR);
    expect(upsertReadyTowerEnemyFloorMock).toHaveBeenCalledTimes(
      TOWER_ELIGIBLE_REALMS.length * TOWER_MAX_FLOOR,
    );
    expect(generator.buildDraft).toHaveBeenCalledTimes(
      TOWER_ELIGIBLE_REALMS.length * TOWER_MAX_FLOOR,
    );
  });

  it('skips existing ready floors and does not regenerate them', async () => {
    const generator = makeGenerator();
    findTowerEnemyFloorMock.mockImplementation(async ({ floor }) =>
      floor <= 3 ? makeFloorRecord(floor) : undefined,
    );

    const service = new TowerEnemySetService({ generator });
    const result = await service.ensureTowerEnemySet(
      getTowerSeasonMeta(new Date('2026-06-01T00:00:00.000Z')),
      '金丹',
    );

    expect(result.skipped).toBe(3);
    expect(result.generated).toBe(17);
    expect(upsertReadyTowerEnemyFloorMock).toHaveBeenCalledTimes(17);
    expect(generator.buildDraft).toHaveBeenCalledTimes(17);
  });

  it('records failed floors and can retry only missing or failed floors later', async () => {
    const failingGenerator = makeGenerator({ failFloor: 4 });
    const service = new TowerEnemySetService({ generator: failingGenerator });
    const first = await service.ensureTowerEnemySet(
      getTowerSeasonMeta(new Date('2026-06-01T00:00:00.000Z')),
      '金丹',
    );

    expect(first.failed).toBe(1);
    expect(upsertFailedTowerEnemyFloorMock).toHaveBeenCalledWith(
      expect.objectContaining({ realm: '金丹', floor: 4 }),
    );

    vi.clearAllMocks();
    findTowerEnemyFloorMock.mockImplementation(async ({ floor }) =>
      floor === 4 ? undefined : makeFloorRecord(floor),
    );
    const retryGenerator = makeGenerator();
    const retryService = new TowerEnemySetService({ generator: retryGenerator });
    const retry = await retryService.ensureTowerEnemySet(
      getTowerSeasonMeta(new Date('2026-06-01T00:00:00.000Z')),
      '金丹',
    );

    expect(retry.skipped).toBe(19);
    expect(retry.generated).toBe(1);
    expect(upsertReadyTowerEnemyFloorMock).toHaveBeenCalledTimes(1);
    expect(upsertReadyTowerEnemyFloorMock).toHaveBeenCalledWith(
      expect.objectContaining({ realm: '金丹', floor: 4 }),
    );
  });

  it('loads the latest ready floor when the current season floor is missing', async () => {
    findLatestReadyTowerEnemyFloorMock.mockResolvedValueOnce(makeFloorRecord(3));

    const service = new TowerEnemySetService({ generator: makeGenerator() });
    const enemy = await service.loadTowerEnemyForBattle({
      seasonKey: '2026-W22@Asia/Shanghai',
      realm: '金丹',
      floor: 3,
    });

    expect(enemy.enemy.id).toBe('enemy-3');
    expect(findLatestReadyTowerEnemyFloorMock).toHaveBeenCalledWith({
      realm: '金丹',
      floor: 3,
      beforeSeasonKey: '2026-W22@Asia/Shanghai',
    });
  });

  it('falls back without LLM generation when no ready floor exists', async () => {
    const generator = makeGenerator();
    const fallbackGenerator = makeGenerator();
    const service = new TowerEnemySetService({ generator, fallbackGenerator });

    const enemy = await service.loadTowerEnemyForBattle({
      seasonKey: '2026-W22@Asia/Shanghai',
      realm: '金丹',
      floor: 1,
    });

    expect(enemy.generationMeta.source).toBe('fallback');
    expect(generator.buildDraft).not.toHaveBeenCalled();
    expect(fallbackGenerator.buildDraft).toHaveBeenCalledTimes(1);
  });

  it('builds admin snapshots from floor summaries without enemy details', async () => {
    listTowerEnemyFloorSummariesBySeasonMock.mockResolvedValueOnce(
      Array.from({ length: TOWER_MAX_FLOOR }, (_, index) =>
        ({ ...makeFloorRecord(index + 1), enemy: undefined }),
      ),
    );

    const service = new TowerEnemySetService({ generator: makeGenerator() });
    const snapshot = await service.getAdminSnapshot(
      '2026-W22@Asia/Shanghai',
    );

    expect(snapshot.realms[0]).toMatchObject({
      realm: '金丹',
      status: 'ready',
      enemyCount: 20,
    });
    expect(snapshot.realms[0]).not.toHaveProperty('enemies');
    expect(snapshot.realms[0]).not.toHaveProperty('sourceCounts');
    expect(snapshot.realms[1]).toMatchObject({
      realm: '元婴',
      status: 'missing',
      enemyCount: 0,
    });
  });

  it('marks realm summaries as failed when any floor failed', async () => {
    listTowerEnemyFloorSummariesBySeasonMock.mockResolvedValueOnce([
      makeFloorRecord(1),
      makeFloorRecord(2),
      makeFloorRecord(3, 'failed'),
    ]);

    const service = new TowerEnemySetService({ generator: makeGenerator() });
    const snapshot = await service.getAdminSnapshot(
      '2026-W22@Asia/Shanghai',
    );

    expect(snapshot.realms[0]).toMatchObject({
      realm: '金丹',
      status: 'failed',
      enemyCount: 2,
    });
    expect(snapshot.realms[0].errorMessage).toContain('3层');
  });

  it('loads admin enemy details for one realm only', async () => {
    listTowerEnemyFloorsBySeasonRealmMock.mockResolvedValueOnce(
      Array.from({ length: TOWER_MAX_FLOOR }, (_, index) =>
        makeFloorRecord(index + 1),
      ),
    );

    const service = new TowerEnemySetService({ generator: makeGenerator() });
    const detail = await service.getAdminRealmDetail({
      seasonKey: '2026-W22@Asia/Shanghai',
      realm: '金丹',
    });

    expect(listTowerEnemyFloorsBySeasonRealmMock).toHaveBeenCalledWith({
      seasonKey: '2026-W22@Asia/Shanghai',
      realm: '金丹',
    });
    expect(detail).toMatchObject({
      realm: '金丹',
      status: 'ready',
      enemyCount: 20,
      sourceCounts: { llm: 20, fallback: 0 },
    });
    expect(detail.enemies).toHaveLength(20);
  });
});
