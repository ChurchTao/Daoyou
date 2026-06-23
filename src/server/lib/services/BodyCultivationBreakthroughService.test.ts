import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Consumable, Cultivator } from '@shared/types/cultivator';
import type { CompatibleAlchemyPropertyKey } from '@shared/types/consumable';

const { consumeConsumableByIdMock, consumeMaterialByIdMock } =
  vi.hoisted(() => ({
    consumeConsumableByIdMock: vi.fn(),
    consumeMaterialByIdMock: vi.fn(),
  }));

vi.mock('@server/lib/services/cultivatorService', () => ({
  consumeConsumableById: consumeConsumableByIdMock,
  consumeMaterialById: consumeMaterialByIdMock,
}));

import {
  consumeBodyCultivationBreakthroughCosts,
  getBodyCultivationBreakthroughReadiness,
} from './BodyCultivationBreakthroughService';

function temperingPill(
  options: Partial<Consumable> & {
    propertyKey?: CompatibleAlchemyPropertyKey;
  } = {},
): Consumable {
  const { propertyKey = 'body_skin', ...overrides } = options;

  return {
    id: 'pill-1',
    name: '青岚淬膜丹',
    type: '丹药',
    quality: '玄品',
    quantity: 1,
    description: '',
    spec: {
      kind: 'pill',
      family: 'tempering',
      operations: [],
      consumeRules: {
        scene: 'out_of_battle_only',
        quotaCategory: 'none',
      },
      alchemyMeta: {
        source: 'improvised',
        sourceMaterials: [],
        analysisVersion: 2,
        propertyVector: [{ key: propertyKey, weight: 1 } as never],
        sourceMaterialVectors: [],
        stability: 80,
        toxicityRating: 3,
        tags: ['tempering'],
      },
    },
    ...overrides,
  };
}

function createCultivator(): Cultivator {
  return {
    id: 'cultivator-1',
    name: '韩立',
    gender: '男',
    realm: '炼气',
    realm_stage: '初期',
    age: 30,
    lifespan: 180,
    status: 'active',
    attributes: {
      vitality: 40,
      spirit: 36,
      wisdom: 30,
      speed: 28,
      willpower: 32,
    },
    spiritual_roots: [],
    pre_heaven_fates: [],
    cultivations: [],
    skills: [],
    inventory: {
      artifacts: [],
      consumables: [temperingPill()],
      materials: [
        {
          id: 'material-1',
          name: '青纹破关露',
          type: 'aux',
          rank: '玄品',
          quantity: 1,
        },
      ],
    },
    equipped: {
      weapon: null,
      armor: null,
      accessory: null,
    },
    max_skills: 4,
    spirit_stones: 0,
    condition: {
      version: 1,
      resources: {
        hp: { current: 100 },
        mp: { current: 100 },
      },
      gauges: {
        pillToxicity: 0,
      },
      tracks: {
        bodyCultivation: {
          version: 1,
          realm: 'mortal_body',
          tracks: {
            skin: { level: 4, progress: 0 },
            sinew_bone: { level: 4, progress: 0 },
            organs: { level: 4, progress: 0 },
            qi_blood: { level: 0, progress: 0 },
            primordial_spirit: { level: 0, progress: 0 },
          },
          milestones: {},
        },
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
  };
}

describe('BodyCultivationBreakthroughService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds an inventory cost plan for the next body realm', () => {
    const readiness = getBodyCultivationBreakthroughReadiness(createCultivator());

    expect(readiness.canAttempt).toBe(true);
    expect(readiness.nextRealm).toBe('bronze_skin');
    expect(readiness.successChance).toBe(0.82);
    expect(readiness.guaranteeProgress).toBe(0);
    expect(readiness.failedAttempts).toBe(0);
    expect(readiness.inventoryRequirements).toEqual([
      {
        type: 'material',
        name: '进阶材料（特殊辅料，玄品以上）',
        label: '进阶材料（特殊辅料，玄品以上）',
        quantity: 1,
        ownedQuantity: 1,
        met: true,
        materialType: 'aux',
        minQuality: '玄品',
      },
      {
        type: 'consumable',
        name: '皮肤方向炼体丹（玄品以上）',
        label: '皮肤方向炼体丹（玄品以上）',
        quantity: 1,
        ownedQuantity: 1,
        met: true,
        family: 'tempering',
        property: 'body_skin',
        minQuality: '玄品',
      },
    ]);
    expect(readiness.costPlan).toMatchObject({
      materials: [{ id: 'material-1', quantity: 1 }],
      consumables: [{ id: 'pill-1', quantity: 1 }],
    });
  });

  it('matches breakthrough materials by type and minimum quality, not name', () => {
    const cultivator = createCultivator();
    cultivator.inventory.materials = [
      {
        id: 'renamed-material',
        name: '玄阶护脉砂',
        type: 'aux',
        rank: '地品',
        quantity: 1,
      },
    ];

    const readiness = getBodyCultivationBreakthroughReadiness(cultivator);

    expect(readiness.canAttempt).toBe(true);
    expect(readiness.costPlan.materials).toEqual([
      { id: 'renamed-material', quantity: 1 },
    ]);
  });

  it('rejects named legacy breakthrough materials with the wrong type', () => {
    const cultivator = createCultivator();
    cultivator.inventory.materials = [
      {
        id: 'wrong-type-material',
        name: '铜皮破限液',
        type: 'tcdb',
        rank: '玄品',
        quantity: 1,
      },
    ];

    const readiness = getBodyCultivationBreakthroughReadiness(cultivator);

    expect(readiness.canAttempt).toBe(false);
    expect(readiness.inventoryRequirements).toContainEqual({
      type: 'material',
      name: '进阶材料（特殊辅料，玄品以上）',
      label: '进阶材料（特殊辅料，玄品以上）',
      quantity: 1,
      ownedQuantity: 0,
      met: false,
      materialType: 'aux',
      minQuality: '玄品',
    });
  });

  it('rejects breakthrough materials below the minimum quality', () => {
    const cultivator = createCultivator();
    cultivator.inventory.materials = [
      {
        id: 'low-quality-material',
        name: '低阶护脉砂',
        type: 'aux',
        rank: '灵品',
        quantity: 1,
      },
    ];

    const readiness = getBodyCultivationBreakthroughReadiness(cultivator);

    expect(readiness.canAttempt).toBe(false);
    expect(readiness.inventoryRequirements).toContainEqual({
      type: 'material',
      name: '进阶材料（特殊辅料，玄品以上）',
      label: '进阶材料（特殊辅料，玄品以上）',
      quantity: 1,
      ownedQuantity: 0,
      met: false,
      materialType: 'aux',
      minQuality: '玄品',
    });
  });

  it('plans matching material consumption by inventory id order', () => {
    const cultivator = createCultivator();
    cultivator.condition!.tracks!.bodyCultivation = {
      version: 1,
      realm: 'iron_bone',
      tracks: {
        skin: { level: 12, progress: 0 },
        sinew_bone: { level: 12, progress: 0 },
        organs: { level: 12, progress: 0 },
        qi_blood: { level: 12, progress: 0 },
        primordial_spirit: { level: 12, progress: 0 },
      },
      milestones: {},
    };
    cultivator.inventory.materials = [
      {
        id: 'material-a',
        name: '玉阶髓砂',
        type: 'tcdb',
        rank: '真品',
        quantity: 1,
      },
      {
        id: 'material-b',
        name: '玉阶骨精',
        type: 'tcdb',
        rank: '地品',
        quantity: 3,
      },
    ];
    cultivator.inventory.consumables = [
      temperingPill({
        id: 'pill-a',
        propertyKey: 'body_sinew_bone',
        quality: '真品',
        quantity: 2,
      }),
    ];

    const readiness = getBodyCultivationBreakthroughReadiness(cultivator);

    expect(readiness.nextRealm).toBe('jade_marrow');
    expect(readiness.costPlan.materials).toEqual([
      { id: 'material-a', quantity: 1 },
      { id: 'material-b', quantity: 1 },
    ]);
  });

  it('matches body breakthrough pills by property and quality, not name', () => {
    const cultivator = createCultivator();
    cultivator.inventory.consumables = [
      temperingPill({
        id: 'renamed-pill',
        name: '回春淬体丹',
      }),
    ];

    const readiness = getBodyCultivationBreakthroughReadiness(cultivator);

    expect(readiness.canAttempt).toBe(true);
    expect(readiness.costPlan.consumables).toEqual([
      { id: 'renamed-pill', quantity: 1 },
    ]);
  });

  it('rejects body breakthrough pills with the wrong property', () => {
    const cultivator = createCultivator();
    cultivator.inventory.consumables = [
      temperingPill({
        id: 'wrong-property-pill',
        name: '润膜散',
        propertyKey: 'body_organs',
      }),
    ];

    const readiness = getBodyCultivationBreakthroughReadiness(cultivator);

    expect(readiness.canAttempt).toBe(false);
    expect(readiness.inventoryRequirements).toContainEqual({
      type: 'consumable',
      name: '皮肤方向炼体丹（玄品以上）',
      label: '皮肤方向炼体丹（玄品以上）',
      quantity: 1,
      ownedQuantity: 0,
      met: false,
      family: 'tempering',
      property: 'body_skin',
      minQuality: '玄品',
    });
  });

  it('rejects body breakthrough pills below the minimum quality', () => {
    const cultivator = createCultivator();
    cultivator.inventory.consumables = [
      temperingPill({
        id: 'low-quality-pill',
        quality: '灵品',
      }),
    ];

    const readiness = getBodyCultivationBreakthroughReadiness(cultivator);

    expect(readiness.canAttempt).toBe(false);
    expect(readiness.inventoryRequirements).toContainEqual({
      type: 'consumable',
      name: '皮肤方向炼体丹（玄品以上）',
      label: '皮肤方向炼体丹（玄品以上）',
      quantity: 1,
      ownedQuantity: 0,
      met: false,
      family: 'tempering',
      property: 'body_skin',
      minQuality: '玄品',
    });
  });

  it('canonicalizes legacy tempering properties when matching breakthrough pills', () => {
    const cultivator = createCultivator();
    cultivator.inventory.consumables = [
      temperingPill({
        id: 'legacy-pill',
        propertyKey: 'tempering_speed',
      }),
    ];

    const readiness = getBodyCultivationBreakthroughReadiness(cultivator);

    expect(readiness.canAttempt).toBe(true);
    expect(readiness.costPlan.consumables).toEqual([
      { id: 'legacy-pill', quantity: 1 },
    ]);
  });

  it('ignores malformed legacy tempering pills instead of failing readiness', () => {
    const cultivator = createCultivator();
    delete cultivator.condition!.tracks.bodyCultivation;
    cultivator.condition!.tracks.tempering = {
      vitality: { level: 4, progress: 0 },
      spirit: { level: 4, progress: 0 },
      wisdom: { level: 0, progress: 0 },
      speed: { level: 4, progress: 0 },
      willpower: { level: 0, progress: 0 },
    };
    cultivator.inventory.consumables = [
      {
        id: 'legacy-malformed-pill',
        name: '旧版淬体丹',
        type: '丹药',
        quality: '玄品',
        quantity: 1,
        description: '',
        spec: {
          kind: 'pill',
          family: 'tempering',
          operations: [],
          consumeRules: {
            scene: 'out_of_battle_only',
            quotaCategory: 'none',
          },
        },
      } as unknown as Consumable,
    ];

    const readiness = getBodyCultivationBreakthroughReadiness(cultivator);

    expect(readiness.nextRealm).toBe('bronze_skin');
    expect(readiness.ruleRequirements.every((requirement) => requirement.met)).toBe(true);
    expect(readiness.inventoryRequirements).toContainEqual({
      type: 'consumable',
      name: '皮肤方向炼体丹（玄品以上）',
      label: '皮肤方向炼体丹（玄品以上）',
      quantity: 1,
      ownedQuantity: 0,
      met: false,
      family: 'tempering',
      property: 'body_skin',
      minQuality: '玄品',
    });
    expect(readiness.canAttempt).toBe(false);
  });

  it('consumes planned materials and consumables in the provided transaction', async () => {
    const readiness = getBodyCultivationBreakthroughReadiness(createCultivator());

    await consumeBodyCultivationBreakthroughCosts(
      'user-1',
      'cultivator-1',
      readiness.costPlan,
      'tx' as never,
    );

    expect(consumeMaterialByIdMock).toHaveBeenCalledWith(
      'user-1',
      'cultivator-1',
      'material-1',
      1,
      'tx',
    );
    expect(consumeConsumableByIdMock).toHaveBeenCalledWith(
      'user-1',
      'cultivator-1',
      'pill-1',
      1,
      'tx',
    );
  });
});
