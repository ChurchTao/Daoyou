import type { UnitStateSnapshot } from '@/engine/battle-v5/systems/state/types';
import type { Cultivator } from '@/types/cultivator';
import { PersistentStateService } from './PersistentStateService';

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
    persistent_statuses: [],
  };
}

describe('PersistentStateService', () => {
  it('applies natural recovery and keeps deficit markers in sync', () => {
    const cultivator = createCultivator();
    const { maxHp, maxMp } = PersistentStateService.getMaxResources(cultivator);
    const fourHoursAgo = new Date(Date.now() - 4 * 3600 * 1000);

    const result = PersistentStateService.applyNaturalRecovery(
      {
        ...cultivator,
        persistent_state: {
          currentHp: Math.max(1, maxHp - 600),
          currentMp: Math.max(0, maxMp - 420),
          pillToxicity: 0,
          realmPillUsage: {},
          lastNaturalRecoveryAt: fourHoursAgo.toISOString(),
        },
      },
      {
        currentHp: Math.max(1, maxHp - 600),
        currentMp: Math.max(0, maxMp - 420),
        pillToxicity: 0,
        realmPillUsage: {},
        lastNaturalRecoveryAt: fourHoursAgo.toISOString(),
      },
      [],
      new Date(),
    );

    expect(result.state.currentHp).toBeGreaterThan(Math.max(1, maxHp - 600));
    expect(result.state.currentMp).toBeGreaterThan(Math.max(0, maxMp - 420));
    expect(result.statuses.map((status) => status.templateId)).toEqual(
      expect.arrayContaining(['hp_deficit', 'mana_depleted']),
    );
  });

  it('lands defeated PVE characters at 1 HP, 0 MP, near_death', () => {
    const cultivator = createCultivator();
    const snapshot: UnitStateSnapshot = {
      id: 'c1',
      name: '韩立',
      alive: false,
      hp: { current: 0, max: 1000, percent: 0 },
      mp: { current: 0, max: 800, percent: 0 },
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
      canAct: false,
    };

    const result = PersistentStateService.applyPveBattleOutcome(
      cultivator,
      undefined,
      [],
      snapshot,
      true,
    );

    expect(result.state.currentHp).toBe(1);
    expect(result.state.currentMp).toBe(0);
    expect(result.statuses.map((status) => status.templateId)).toEqual(
      expect.arrayContaining(['near_death', 'hp_deficit', 'mana_depleted']),
    );
  });

  it('prefers explicit persistent state during chained updates', () => {
    const cultivator = {
      ...createCultivator(),
      persistent_state: {
        currentHp: 9999,
        currentMp: 9999,
        pillToxicity: 2,
        realmPillUsage: {},
        lastNaturalRecoveryAt: new Date().toISOString(),
      },
    };
    const { maxHp, maxMp } = PersistentStateService.getMaxResources(cultivator);
    const fourHoursAgo = new Date(Date.now() - 4 * 3600 * 1000);
    const explicitState = {
      currentHp: Math.max(1, maxHp - 360),
      currentMp: Math.max(0, maxMp - 210),
      pillToxicity: 21,
      realmPillUsage: { 筑基: 2 },
      lastNaturalRecoveryAt: fourHoursAgo.toISOString(),
    };

    const recovered = PersistentStateService.applyNaturalRecovery(
      cultivator,
      explicitState,
      [],
      new Date(),
    );
    expect(recovered.state.currentHp).toBeGreaterThan(explicitState.currentHp);
    expect(recovered.state.currentHp).toBeLessThan(maxHp);
    expect(recovered.state.currentMp).toBeGreaterThan(explicitState.currentMp);
    expect(recovered.state.currentMp).toBeLessThanOrEqual(maxMp);
    expect(recovered.state.realmPillUsage?.筑基).toBe(2);

    const toxicityRaised = PersistentStateService.addPillToxicity(
      cultivator,
      explicitState,
      7,
      new Date(),
    );
    expect(toxicityRaised.currentHp).toBe(explicitState.currentHp);
    expect(toxicityRaised.currentMp).toBe(explicitState.currentMp);
    expect(toxicityRaised.pillToxicity).toBe(28);
  });
});
