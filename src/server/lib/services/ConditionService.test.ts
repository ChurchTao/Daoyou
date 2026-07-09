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

function withBodyCultivation(condition: CultivatorCondition): CultivatorCondition {
  return {
    ...condition,
    tracks: {
      ...condition.tracks,
      bodyCultivation: {
        version: 1,
        realm: 'dao_body',
        milestones: {},
        tracks: {
          skin: { level: 30, progress: 0 },
          sinew_bone: { level: 30, progress: 0 },
          organs: { level: 30, progress: 0 },
          qi_blood: { level: 30, progress: 0 },
          primordial_spirit: { level: 30, progress: 0 },
        },
      },
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

describe('ConditionService body cultivation boundaries', () => {
  it('does not apply body cultivation to natural recovery', () => {
    const now = new Date('2026-07-01T01:00:00.000Z');
    const bodyCondition = withBodyCultivation(createCondition(0, 0));
    const cultivator = createCultivator(bodyCondition);
    const maxResources = ConditionService.getMaxResources(cultivator, bodyCondition);
    const body = ConditionService.tickNaturalRecovery(
      cultivator,
      bodyCondition,
      now,
    );

    expect(body.resources.hp.current).toBe(
      Math.floor(maxResources.maxHp * 0.28),
    );
    expect(body.resources.mp.current).toBe(
      Math.floor(maxResources.maxMp * 0.38),
    );
  });

  it('does not apply body cultivation mitigation to external resource loss', () => {
    const condition = withBodyCultivation(createCondition(1000, 800));
    const preview = ConditionService.previewExternalResourceLoss(
      createCultivator(condition),
      condition,
      {
        hpPercent: 0.1,
        mpPercent: 0.1,
      },
    );

    expect(preview.hpLoss).toBe(preview.rawHpLoss);
    expect(preview.mpLoss).toBe(preview.rawMpLoss);
    expect(preview.preventedHpLoss).toBe(0);
    expect(preview.preventedMpLoss).toBe(0);
    expect(preview.triggerTexts).toEqual([]);
  });

  it('does not apply body cultivation defeat protection after battle', () => {
    const condition = withBodyCultivation(createCondition(1000, 800));
    const settled = ConditionService.applyBattleOutcome(
      createCultivator(condition),
      condition,
      {} as any,
      'persistent_pve',
      true,
      new Date('2026-07-01T01:00:00.000Z'),
    );

    expect(settled.resources.hp.current).toBe(1);
    expect(settled.resources.mp.current).toBe(0);
    expect(settled.statuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'near_death' }),
      ]),
    );
    expect(settled.statuses.some((status) => status.key === 'major_wound')).toBe(
      false,
    );
  });
});
