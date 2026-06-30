import type { UnitStateSnapshot } from '@shared/engine/battle-v5/systems/state/types';
import { getBodyCultivationExternalResourceLossHooks } from '@shared/lib/bodyCultivation/effects';
import type { CultivatorCondition } from '@shared/types/condition';
import type { Cultivator } from '@shared/types/cultivator';
import { ConditionService } from './ConditionService';

function createCultivator(): Cultivator {
  return {
    id: 'c1',
    name: '韩立',
    gender: '男',
    realm: '筑基',
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
    spiritual_roots: [{ element: '木', strength: 80, grade: '真灵根' }],
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
  };
}

function createBattleSnapshot(hp: number, mp: number): UnitStateSnapshot {
  return {
    id: 'c1',
    name: '韩立',
    alive: hp > 0,
    hp: { current: hp, max: 1000, percent: hp / 1000 },
    mp: { current: mp, max: 800, percent: mp / 800 },
    shield: 0,
    attrs: {
      spirit: 36,
      vitality: 40,
      speed: 28,
      willpower: 32,
      wisdom: 30,
      atk: 0,
      def: 0,
      magicAtk: 0,
      magicDef: 0,
      critRate: 0,
      critDamageMult: 1,
      evasionRate: 0,
      controlHit: 0,
      controlResistance: 0,
      armorPenetration: 0,
      magicPenetration: 0,
      critResist: 0,
      critDamageReduction: 0,
      accuracy: 0,
      healAmplify: 0,
      maxHp: 1000,
      maxMp: 800,
    },
    baseAttrs: {
      spirit: 36,
      vitality: 40,
      speed: 28,
      willpower: 32,
      wisdom: 30,
      atk: 0,
      def: 0,
      magicAtk: 0,
      magicDef: 0,
      critRate: 0,
      critDamageMult: 1,
      evasionRate: 0,
      controlHit: 0,
      controlResistance: 0,
      armorPenetration: 0,
      magicPenetration: 0,
      critResist: 0,
      critDamageReduction: 0,
      accuracy: 0,
      healAmplify: 0,
      maxHp: 1000,
      maxMp: 800,
    },
    buffs: [],
    cooldowns: [],
    canAct: hp > 0,
  };
}

describe('ConditionService', () => {
  it('builds the documented default condition shape', () => {
    const cultivator = createCultivator();
    const condition = ConditionService.normalizeCondition(cultivator);

    expect(condition.version).toBe(1);
    expect(condition.resources.hp.current).toBeGreaterThan(0);
    expect(condition.resources.mp.current).toBeGreaterThan(0);
    expect(condition.gauges.pillToxicity).toBe(0);
    expect(condition.tracks.tempering.vitality).toEqual({ level: 0, progress: 0 });
    expect(condition.tracks.marrowWash).toEqual({ level: 0, progress: 0 });
    expect(condition.statuses).toEqual([]);
  });

  it('only recovers hp and mp during natural recovery', () => {
    const cultivator = createCultivator();
    const { maxHp, maxMp } = ConditionService.getMaxResources(cultivator);
    const fourHoursAgo = new Date(Date.now() - 4 * 3600 * 1000);

    const recovered = ConditionService.tickNaturalRecovery(
      cultivator,
      {
        ...ConditionService.normalizeCondition(cultivator),
        resources: {
          hp: { current: Math.max(1, maxHp - 600) },
          mp: { current: Math.max(0, maxMp - 420) },
        },
        gauges: {
          pillToxicity: 220,
        },
        statuses: [],
        timestamps: {
          lastRecoveryAt: fourHoursAgo.toISOString(),
        },
      },
      new Date(),
    );

    expect(recovered.resources.hp.current).toBeGreaterThan(Math.max(1, maxHp - 600));
    expect(recovered.resources.mp.current).toBeGreaterThan(Math.max(0, maxMp - 420));
    expect(recovered.gauges.pillToxicity).toBe(220);
    expect(recovered.statuses).toEqual([]);
  });

  it('uses body cultivation recovery multiplier during natural recovery', () => {
    const cultivator = createCultivator();
    const { maxHp, maxMp } = ConditionService.getMaxResources(cultivator);
    const now = new Date('2026-05-25T12:00:00.000Z');
    const twoHoursAgo = new Date('2026-05-25T10:00:00.000Z');
    const baseCondition = ConditionService.normalizeCondition(cultivator);
    const bodyCondition: CultivatorCondition = {
      ...baseCondition,
      tracks: {
        ...baseCondition.tracks,
        bodyCultivation: {
          version: 1,
          realm: 'mortal_body',
          tracks: {
            skin: { level: 0, progress: 0 },
            sinew_bone: { level: 5, progress: 0 },
            organs: { level: 0, progress: 0 },
            qi_blood: { level: 10, progress: 0 },
            primordial_spirit: { level: 0, progress: 0 },
          },
          milestones: {},
        },
      },
    };
    const { maxHp: bodyMaxHp } = ConditionService.getMaxResources(
      cultivator,
      bodyCondition,
    );

    const recovered = ConditionService.tickNaturalRecovery(
      cultivator,
      {
        ...bodyCondition,
        resources: {
          hp: { current: maxHp - 1000 },
          mp: { current: maxMp },
        },
        timestamps: {
          lastRecoveryAt: twoHoursAgo.toISOString(),
        },
      },
      now,
    );

    expect(recovered.resources.hp.current).toBe(
      Math.max(0, maxHp - 1000) +
        Math.floor(bodyMaxHp * 0.28 * 2 * 1.11),
    );
  });

  it('uses qi-blood cultivation to reduce pill toxicity recovery suppression', () => {
    const cultivator = createCultivator();
    const { maxHp, maxMp } = ConditionService.getMaxResources(cultivator);
    const now = new Date('2026-05-25T12:00:00.000Z');
    const twoHoursAgo = new Date('2026-05-25T10:00:00.000Z');
    const baseCondition = ConditionService.normalizeCondition(cultivator);
    const bodyCondition: CultivatorCondition = {
      ...baseCondition,
      gauges: {
        pillToxicity: 12,
      },
      tracks: {
        ...baseCondition.tracks,
        bodyCultivation: {
          version: 1,
          realm: 'mortal_body',
          tracks: {
            skin: { level: 0, progress: 0 },
            sinew_bone: { level: 0, progress: 0 },
            organs: { level: 0, progress: 0 },
            qi_blood: { level: 10, progress: 0 },
            primordial_spirit: { level: 0, progress: 0 },
          },
          milestones: {},
        },
      },
    };
    const { maxHp: bodyMaxHp } = ConditionService.getMaxResources(
      cultivator,
      bodyCondition,
    );

    const recovered = ConditionService.tickNaturalRecovery(
      cultivator,
      {
        ...bodyCondition,
        resources: {
          hp: { current: maxHp - 1000 },
          mp: { current: maxMp },
        },
        timestamps: {
          lastRecoveryAt: twoHoursAgo.toISOString(),
        },
      },
      now,
    );

    expect(recovered.resources.hp.current).toBe(
      Math.max(0, maxHp - 1000) +
        Math.floor(bodyMaxHp * 0.28 * 2 * 0.9353333333 * 1.08),
    );
  });

  it('lands defeated persistent PVE characters at 1 点气血、0 点法力、near_death', () => {
    const cultivator = createCultivator();
    const result = ConditionService.applyBattleOutcome(
      cultivator,
      ConditionService.normalizeCondition(cultivator),
      createBattleSnapshot(0, 0),
      'persistent_pve',
      true,
      new Date(),
    );

    expect(result.resources.hp.current).toBe(1);
    expect(result.resources.mp.current).toBe(0);
    expect(result.statuses.map((status) => status.key)).toEqual(
      expect.arrayContaining(['near_death']),
    );
  });

  it('uses jade marrow body cultivation to downgrade persistent PVE defeat from near death to major wound', () => {
    const cultivator = createCultivator();
    const baseCondition = ConditionService.normalizeCondition(cultivator);
    const condition: CultivatorCondition = {
      ...baseCondition,
      tracks: {
        ...baseCondition.tracks,
        bodyCultivation: {
          version: 1,
          realm: 'jade_marrow',
          tracks: {
            skin: { level: 0, progress: 0 },
            sinew_bone: { level: 12, progress: 0 },
            organs: { level: 0, progress: 0 },
            qi_blood: { level: 10, progress: 0 },
            primordial_spirit: { level: 0, progress: 0 },
          },
          milestones: {},
        },
      },
    };

    const result = ConditionService.applyBattleOutcome(
      cultivator,
      condition,
      createBattleSnapshot(0, 0),
      'persistent_pve',
      true,
      new Date('2026-05-25T12:00:00.000Z'),
    );

    expect(result.resources.hp.current).toBe(1);
    expect(result.resources.mp.current).toBe(0);
    expect(result.statuses.map((status) => status.key)).toContain(
      'major_wound',
    );
    expect(result.statuses.map((status) => status.key)).not.toContain(
      'near_death',
    );
  });

  it('adds wound states on persistent PVE victory based on remaining 气血 ratio', () => {
    const cultivator = createCultivator();
    const { maxHp, maxMp } = ConditionService.getMaxResources(cultivator);
    const minor = ConditionService.applyBattleOutcome(
      cultivator,
      ConditionService.normalizeCondition(cultivator),
      createBattleSnapshot(Math.floor(maxHp * 0.3), Math.floor(maxMp * 0.6)),
      'persistent_pve',
      false,
      new Date(),
    );
    const major = ConditionService.applyBattleOutcome(
      cultivator,
      ConditionService.normalizeCondition(cultivator),
      createBattleSnapshot(Math.floor(maxHp * 0.12), Math.floor(maxMp * 0.6)),
      'persistent_pve',
      false,
      new Date(),
    );

    expect(minor.statuses.map((status) => status.key)).toContain('minor_wound');
    expect(major.statuses.map((status) => status.key)).toContain('major_wound');
  });

  it('applies body cultivation battle settle recovery after low-hp victory', () => {
    const cultivator = createCultivator();
    const baseCondition = ConditionService.normalizeCondition(cultivator);
    const condition: CultivatorCondition = {
      ...baseCondition,
      tracks: {
        ...baseCondition.tracks,
        bodyCultivation: {
          version: 1,
          realm: 'bronze_skin',
          tracks: {
            skin: { level: 0, progress: 0 },
            sinew_bone: { level: 5, progress: 0 },
            organs: { level: 0, progress: 0 },
            qi_blood: { level: 10, progress: 0 },
            primordial_spirit: { level: 0, progress: 0 },
          },
          milestones: {},
        },
      },
    };
    const { maxHp, maxMp } = ConditionService.getMaxResources(cultivator, condition);
    const snapshotHp = Math.floor(maxHp * 0.4);

    const result = ConditionService.applyBattleOutcome(
      cultivator,
      condition,
      createBattleSnapshot(snapshotHp, Math.floor(maxMp * 0.6)),
      'persistent_pve',
      false,
      new Date('2026-05-25T12:00:00.000Z'),
    );

    expect(result.resources.hp.current).toBe(
      snapshotHp + Math.floor(maxHp * 0.07),
    );
  });

  it('downgrades battle wounds when body cultivation structure is strong enough', () => {
    const cultivator = createCultivator();
    const baseCondition = ConditionService.normalizeCondition(cultivator);
    const condition: CultivatorCondition = {
      ...baseCondition,
      tracks: {
        ...baseCondition.tracks,
        bodyCultivation: {
          version: 1,
          realm: 'iron_bone',
          tracks: {
            skin: { level: 0, progress: 0 },
            sinew_bone: { level: 10, progress: 0 },
            organs: { level: 0, progress: 0 },
            qi_blood: { level: 0, progress: 0 },
            primordial_spirit: { level: 0, progress: 0 },
          },
          milestones: {},
        },
      },
    };
    const { maxHp, maxMp } = ConditionService.getMaxResources(cultivator, condition);

    const result = ConditionService.applyBattleOutcome(
      cultivator,
      condition,
      createBattleSnapshot(Math.floor(maxHp * 0.12), Math.floor(maxMp * 0.6)),
      'persistent_pve',
      false,
      new Date('2026-05-25T12:00:00.000Z'),
    );

    expect(result.statuses.map((status) => status.key)).toContain('minor_wound');
    expect(result.statuses.map((status) => status.key)).not.toContain(
      'major_wound',
    );
  });

  it('adds body cultivation skin shield to persistent PVE battle init', () => {
    const cultivator = createCultivator();
    const baseCondition = ConditionService.normalizeCondition(cultivator);
    const condition: CultivatorCondition = {
      ...baseCondition,
      tracks: {
        ...baseCondition.tracks,
        bodyCultivation: {
          version: 1,
          realm: 'bronze_skin',
          tracks: {
            skin: { level: 10, progress: 0 },
            sinew_bone: { level: 0, progress: 0 },
            organs: { level: 0, progress: 0 },
            qi_blood: { level: 0, progress: 0 },
            primordial_spirit: { level: 0, progress: 0 },
          },
          milestones: {},
        },
      },
    };
    const { maxHp } = ConditionService.getMaxResources(cultivator, condition);

    const battleInit = ConditionService.buildBattleInit(
      cultivator,
      condition,
      'persistent_pve',
      new Date('2026-05-25T12:00:00.000Z'),
    );

    expect(battleInit.player?.resourceState?.shield).toBe(
      Math.floor(maxHp * 0.04),
    );
    expect(battleInit.player?.startingBuffs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'self',
          buff: expect.objectContaining({
            id: 'body_cultivation_skin_damage_reduction',
            name: '皮肤·外膜护体',
            listeners: [
              expect.objectContaining({
                eventType: 'DamageRequestEvent',
                effects: [
                  {
                    type: 'percent_damage_modifier',
                    params: {
                      mode: 'reduce',
                      value: 0.06,
                      cap: 0.45,
                    },
                  },
                ],
              }),
            ],
          }),
        }),
      ]),
    );
  });

  it('adds jade marrow death-prevent starting buff to persistent PVE battle init', () => {
    const cultivator = createCultivator();
    const baseCondition = ConditionService.normalizeCondition(cultivator);
    const condition: CultivatorCondition = {
      ...baseCondition,
      tracks: {
        ...baseCondition.tracks,
        bodyCultivation: {
          version: 1,
          realm: 'jade_marrow',
          tracks: {
            skin: { level: 0, progress: 0 },
            sinew_bone: { level: 12, progress: 0 },
            organs: { level: 0, progress: 0 },
            qi_blood: { level: 10, progress: 0 },
            primordial_spirit: { level: 0, progress: 0 },
          },
          milestones: {},
        },
      },
    };

    const battleInit = ConditionService.buildBattleInit(
      cultivator,
      condition,
      'persistent_pve',
      new Date('2026-05-25T12:00:00.000Z'),
    );

    expect(battleInit.player?.startingBuffs).toEqual([
      expect.objectContaining({
        source: 'self',
        buff: expect.objectContaining({
          id: 'body_cultivation_jade_marrow_death_prevent',
          name: '玉髓·不灭骨',
          listeners: [
            expect.objectContaining({
              eventType: 'DamageTakenEvent',
              effects: [{ type: 'death_prevent', params: {} }],
            }),
          ],
        }),
      }),
    ]);
  });

  it('adds golden-body burn-blood starting buff to persistent PVE battle init', () => {
    const cultivator = createCultivator();
    const baseCondition = ConditionService.normalizeCondition(cultivator);
    const condition: CultivatorCondition = {
      ...baseCondition,
      tracks: {
        ...baseCondition.tracks,
        bodyCultivation: {
          version: 1,
          realm: 'golden_body',
          tracks: {
            skin: { level: 10, progress: 0 },
            sinew_bone: { level: 12, progress: 0 },
            organs: { level: 15, progress: 0 },
            qi_blood: { level: 10, progress: 0 },
            primordial_spirit: { level: 10, progress: 0 },
          },
          milestones: {},
        },
      },
    };

    const battleInit = ConditionService.buildBattleInit(
      cultivator,
      condition,
      'persistent_pve',
      new Date('2026-05-25T12:00:00.000Z'),
    );

    expect(battleInit.player?.startingBuffs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'self',
          buff: expect.objectContaining({
            id: 'body_cultivation_golden_body_burn_blood',
            name: '金身·燃血爆发',
            listeners: [
              expect.objectContaining({
                eventType: 'DamageTakenEvent',
                effects: [
                  expect.objectContaining({
                    type: 'apply_buff',
                    params: expect.objectContaining({
                      buffConfig: expect.objectContaining({
                        id: 'body_cultivation_golden_body_burn_blood_active',
                      }),
                    }),
                  }),
                  expect.objectContaining({
                    type: 'apply_buff',
                    params: expect.objectContaining({
                      buffConfig: expect.objectContaining({
                        id: 'body_cultivation_golden_body_burn_blood_marker',
                        duration: -1,
                      }),
                    }),
                  }),
                ],
              }),
            ],
          }),
        }),
      ]),
    );
  });

  it('reduces external resource losses through body cultivation pressure hooks', () => {
    const cultivator = createCultivator();
    const baseCondition = ConditionService.normalizeCondition(cultivator);
    const condition: CultivatorCondition = {
      ...baseCondition,
      tracks: {
        ...baseCondition.tracks,
        bodyCultivation: {
          version: 1,
          realm: 'iron_bone',
          tracks: {
            skin: { level: 10, progress: 0 },
            sinew_bone: { level: 10, progress: 0 },
            organs: { level: 5, progress: 0 },
            qi_blood: { level: 10, progress: 0 },
            primordial_spirit: { level: 10, progress: 0 },
          },
          milestones: {},
        },
      },
    };
    const { maxHp, maxMp } = ConditionService.getMaxResources(cultivator, condition);
    const hooks = getBodyCultivationExternalResourceLossHooks(condition);
    const fullCondition: CultivatorCondition = {
      ...condition,
      resources: {
        hp: { current: maxHp },
        mp: { current: maxMp },
      },
    };

    const result = ConditionService.applyExternalResourceLoss(
      cultivator,
      fullCondition,
      {
        hpPercent: 0.2,
        mpPercent: 0.2,
      },
      new Date('2026-05-25T12:00:00.000Z'),
    );

    expect(result.resources.hp.current).toBe(
      maxHp - Math.floor(maxHp * 0.2 * hooks.hpLossMultiplier),
    );
    expect(result.resources.mp.current).toBe(
      maxMp - Math.floor(maxMp * 0.2 * hooks.mpLossMultiplier),
    );
  });

  it('advances body cultivation realm through the condition service', () => {
    const cultivator = createCultivator();
    cultivator.realm = '炼气';
    const baseCondition = ConditionService.normalizeCondition(cultivator);
    const condition: CultivatorCondition = {
      ...baseCondition,
      tracks: {
        ...baseCondition.tracks,
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
      },
    };

    const result = ConditionService.breakthroughBodyCultivationRealm(
      cultivator,
      condition,
      new Date('2026-05-25T12:00:00.000Z'),
      () => 0,
    );

    expect(result.success).toBe(true);
    expect(result.fromRealm).toBe('mortal_body');
    expect(result.toRealm).toBe('bronze_skin');
    expect(result.condition.tracks.bodyCultivation?.realm).toBe('bronze_skin');
    expect(
      result.condition.tracks.bodyCultivation?.milestones['realm.bronze_skin'],
    ).toBe(true);
  });

  it('does not read or rewrite condition for standard PVP or training', () => {
    const cultivator = createCultivator();
    const baseCondition: CultivatorCondition = {
      ...ConditionService.normalizeCondition(cultivator),
      resources: {
        hp: { current: 123 },
        mp: { current: 45 },
      },
    };

    expect(
      ConditionService.buildBattleInit(
        cultivator,
        baseCondition,
        'standard_pvp',
      ),
    ).toEqual({});
    expect(
      ConditionService.buildBattleInit(cultivator, baseCondition, 'training'),
    ).toEqual({});

    const standardOutcome = ConditionService.applyBattleOutcome(
      cultivator,
      baseCondition,
      createBattleSnapshot(999, 777),
      'standard_pvp',
      false,
      new Date(),
    );
    const trainingOutcome = ConditionService.applyBattleOutcome(
      cultivator,
      baseCondition,
      createBattleSnapshot(999, 777),
      'training',
      false,
      new Date(),
    );

    expect(standardOutcome.resources.hp.current).toBe(123);
    expect(standardOutcome.resources.mp.current).toBe(45);
    expect(trainingOutcome.resources.hp.current).toBe(123);
    expect(trainingOutcome.resources.mp.current).toBe(45);
  });
});
