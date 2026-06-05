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
  findTowerEnemySetMock,
  findLatestReadyTowerEnemySetMock,
  listTowerEnemySetsBySeasonMock,
  upsertReadyTowerEnemySetMock,
  upsertFailedTowerEnemySetMock,
} = vi.hoisted(() => ({
  findTowerEnemySetMock: vi.fn(),
  findLatestReadyTowerEnemySetMock: vi.fn(),
  listTowerEnemySetsBySeasonMock: vi.fn(),
  upsertReadyTowerEnemySetMock: vi.fn(),
  upsertFailedTowerEnemySetMock: vi.fn(),
}));

vi.mock('@server/lib/repositories/towerEnemySetRepository', () => ({
  findTowerEnemySet: findTowerEnemySetMock,
  findLatestReadyTowerEnemySet: findLatestReadyTowerEnemySetMock,
  listTowerEnemySetsBySeason: listTowerEnemySetsBySeasonMock,
  upsertReadyTowerEnemySet: upsertReadyTowerEnemySetMock,
  upsertFailedTowerEnemySet: upsertFailedTowerEnemySetMock,
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
    max_skills: 6,
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
    },
    copyFacts: {
      race: '人族',
      realm: '金丹',
      realmStage: '初期',
      difficulty: 5,
      difficultyFactor: 1,
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

function makeGenerator(): EnemyGenerator {
  return {
    buildDraft: vi.fn((input) => makeDraft(input)),
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

function makePreparedEnemies(seasonKey = '2026-W22@Asia/Shanghai') {
  return Array.from({ length: TOWER_MAX_FLOOR }, (_, index) => {
    const floor = index + 1;
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
  });
}

describe('tower enemy sets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findTowerEnemySetMock.mockResolvedValue(undefined);
    findLatestReadyTowerEnemySetMock.mockResolvedValue(undefined);
    listTowerEnemySetsBySeasonMock.mockResolvedValue([]);
  });

  it('generates twenty prepared enemies for each eligible realm', async () => {
    const generator = makeGenerator();
    const service = new TowerEnemySetService({ generator });
    const result = await service.ensureTowerEnemySetsForSeason(
      getTowerSeasonMeta(new Date('2026-06-01T00:00:00.000Z')),
    );

    expect(result.processed).toBe(TOWER_ELIGIBLE_REALMS.length);
    expect(result.generated).toBe(TOWER_ELIGIBLE_REALMS.length);
    expect(upsertReadyTowerEnemySetMock).toHaveBeenCalledTimes(
      TOWER_ELIGIBLE_REALMS.length,
    );
    expect(generator.buildDraft).toHaveBeenCalledTimes(
      TOWER_ELIGIBLE_REALMS.length * TOWER_MAX_FLOOR,
    );
    expect(generator.enrichNarrative).toHaveBeenCalledTimes(
      TOWER_ELIGIBLE_REALMS.length * TOWER_MAX_FLOOR,
    );
  });

  it('does not regenerate an existing complete ready set', async () => {
    const generator = makeGenerator();
    findTowerEnemySetMock.mockResolvedValueOnce({
      seasonKey: '2026-W22@Asia/Shanghai',
      realm: '金丹',
      status: 'ready',
      generatedAt: new Date('2026-06-01T00:00:00.000Z'),
      enemies: makePreparedEnemies(),
    });

    const service = new TowerEnemySetService({ generator });
    const result = await service.ensureTowerEnemySet(
      getTowerSeasonMeta(new Date('2026-06-01T00:00:00.000Z')),
      '金丹',
    );

    expect(result.skipped).toBe(true);
    expect(generator.buildDraft).not.toHaveBeenCalled();
    expect(upsertReadyTowerEnemySetMock).not.toHaveBeenCalled();
  });

  it('loads the latest ready set when the current season is missing', async () => {
    const latest = makePreparedEnemies();
    findLatestReadyTowerEnemySetMock.mockResolvedValueOnce({
      seasonKey: '2026-W21@Asia/Shanghai',
      realm: '金丹',
      status: 'ready',
      generatedAt: new Date('2026-05-25T00:00:00.000Z'),
      enemies: latest,
    });

    const service = new TowerEnemySetService({ generator: makeGenerator() });
    const enemy = await service.loadTowerEnemyForBattle({
      seasonKey: '2026-W22@Asia/Shanghai',
      realm: '金丹',
      floor: 3,
    });

    expect(enemy.enemy.id).toBe('enemy-3');
    expect(enemy).not.toBe(latest[2]);
  });

  it('falls back without LLM generation when no ready set exists', async () => {
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
    expect(fallbackGenerator.enrichNarrative).not.toHaveBeenCalled();
  });

  it('builds admin snapshots with missing and ready realm summaries', async () => {
    listTowerEnemySetsBySeasonMock.mockResolvedValueOnce([
      {
        seasonKey: '2026-W22@Asia/Shanghai',
        realm: '金丹',
        status: 'ready',
        schemaVersion: 1,
        generatedAt: new Date('2026-06-01T00:00:00.000Z'),
        updatedAt: new Date('2026-06-01T00:10:00.000Z'),
        errorMessage: null,
        enemies: makePreparedEnemies(),
      },
    ]);

    const service = new TowerEnemySetService({ generator: makeGenerator() });
    const snapshot = await service.getAdminSnapshot(
      '2026-W22@Asia/Shanghai',
    );

    expect(snapshot.realms[0]).toMatchObject({
      realm: '金丹',
      status: 'ready',
      enemyCount: 20,
      sourceCounts: { llm: 20, fallback: 0 },
    });
    expect(snapshot.realms[1]).toMatchObject({
      realm: '元婴',
      status: 'missing',
      enemyCount: 0,
    });
  });

  it('marks ready rows without twenty floors as incomplete in admin snapshots', async () => {
    listTowerEnemySetsBySeasonMock.mockResolvedValueOnce([
      {
        seasonKey: '2026-W22@Asia/Shanghai',
        realm: '金丹',
        status: 'ready',
        schemaVersion: 1,
        generatedAt: new Date('2026-06-01T00:00:00.000Z'),
        updatedAt: new Date('2026-06-01T00:10:00.000Z'),
        errorMessage: null,
        enemies: makePreparedEnemies().slice(0, 3),
      },
    ]);

    const service = new TowerEnemySetService({ generator: makeGenerator() });
    const snapshot = await service.getAdminSnapshot(
      '2026-W22@Asia/Shanghai',
    );

    expect(snapshot.realms[0]).toMatchObject({
      realm: '金丹',
      status: 'incomplete',
      enemyCount: 3,
    });
  });
});
