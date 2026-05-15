import type { UnitStateSnapshot } from '@shared/engine/battle-v5/systems/state/types';
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
    max_skills: 4,
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

  it('lands defeated persistent PVE characters at 1 HP, 0 MP, near_death', () => {
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

  it('adds wound states on persistent PVE victory based on remaining HP ratio', () => {
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
