import { AttributeType, ModifierType } from '@shared/engine/battle-v5/core/types';
import type { Cultivator } from '@shared/types/cultivator';
import type { CultivatorCondition } from '@shared/types/condition';
import { ConditionService } from './ConditionService';

function createCultivator(
  condition?: CultivatorCondition,
  withLoadout = false,
): Cultivator {
  return {
    id: 'cultivator-1',
    name: '九千幽',
    gender: '女',
    realm: '筑基',
    realm_stage: '初期',
    age: 30,
    lifespan: 180,
    attributes: {
      vitality: 10,
      spirit: 10,
      wisdom: 10,
      speed: 10,
      willpower: 10,
    },
    spiritual_roots: [],
    pre_heaven_fates: [],
    cultivations: withLoadout
      ? [
          {
            id: 'gongfa-1',
            name: '归元诀',
            attributeModifiers: [
              {
                attrType: AttributeType.VITALITY,
                type: ModifierType.ADD,
                value: 1,
              },
            ],
          },
        ]
      : [],
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
    condition,
  };
}

function createCondition(hp: number, mp = 100): CultivatorCondition {
  return {
    version: 1,
    resources: {
      hp: { current: hp },
      mp: { current: mp },
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
    timestamps: {
      lastRecoveryAt: '2026-07-01T00:00:00.000Z',
    },
  };
}

describe('ConditionService resource max snapshots', () => {
  it('preserves legacy full-health semantics when loadout raises runtime max', () => {
    const bare = createCultivator();
    const full = createCultivator(undefined, true);
    const legacyMax = ConditionService.getMaxResources(bare);
    const runtimeMax = ConditionService.getMaxResources(full);

    const normalized = ConditionService.normalizeCondition(
      full,
      createCondition(legacyMax.maxHp, legacyMax.maxMp),
      new Date('2026-07-01T00:00:00.000Z'),
      { legacyMaxResources: legacyMax },
    );

    expect(runtimeMax.maxHp).toBeGreaterThan(legacyMax.maxHp);
    expect(normalized.resources.hp).toEqual({
      current: runtimeMax.maxHp,
      max: runtimeMax.maxHp,
    });
    expect(normalized.resources.mp).toEqual({
      current: runtimeMax.maxMp,
      max: runtimeMax.maxMp,
    });
  });

  it('keeps real injury when legacy current is below the old max', () => {
    const bare = createCultivator();
    const full = createCultivator(undefined, true);
    const legacyMax = ConditionService.getMaxResources(bare);
    const runtimeMax = ConditionService.getMaxResources(full);

    const normalized = ConditionService.normalizeCondition(
      full,
      createCondition(legacyMax.maxHp - 100, legacyMax.maxMp),
      new Date('2026-07-01T00:00:00.000Z'),
      { legacyMaxResources: legacyMax },
    );

    expect(normalized.resources.hp).toEqual({
      current: legacyMax.maxHp - 100,
      max: runtimeMax.maxHp,
    });
  });

  it('uses stored max snapshots to carry full-health semantics across future max increases', () => {
    const full = createCultivator(undefined, true);
    const previousMax = 502;
    const runtimeMax = ConditionService.getMaxResources(full);
    const condition = createCondition(previousMax);
    condition.resources.hp.max = previousMax;

    const normalized = ConditionService.normalizeCondition(
      full,
      condition,
      new Date('2026-07-01T00:00:00.000Z'),
    );

    expect(normalized.resources.hp).toEqual({
      current: runtimeMax.maxHp,
      max: runtimeMax.maxHp,
    });
  });
});
