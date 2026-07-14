import type { Cultivator } from '@shared/types/cultivator';
import { describe, expect, it } from 'vitest';
import type { PlayerStateStoreData } from './store';
import { selectActiveCultivatorProfile, selectCultivatorDisplay } from './selectors';

function createCultivator(overrides: Partial<Cultivator> = {}): Cultivator {
  return {
    id: 'cultivator-1',
    name: '韩立',
    gender: '男',
    realm: '炼气',
    realm_stage: '初期',
    age: 18,
    lifespan: 120,
    status: 'active',
    attributes: {
      vitality: 10,
      spirit: 10,
      wisdom: 10,
      speed: 10,
      willpower: 10,
    },
    spiritual_roots: [],
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
    spirit_stones: 120,
    cultivation_progress: {
      cultivation_exp: 20,
      exp_cap: 100,
      comprehension_insight: 5,
    },
    condition: {
      resources: {
        hp: { current: 240 },
        mp: { current: 180 },
      },
      gauges: {
        pillToxicity: 0,
      },
      statuses: [],
      tracks: {
        tempering: {},
        marrowWash: { level: 0, progress: 0 },
      },
      counters: {
        cultivationPillUsesByRealm: {},
      },
      timestamps: {},
    },
    ...overrides,
  };
}

function createCultivatorView(): NonNullable<PlayerStateStoreData['snapshot']['profile']> {
  return {
    cultivator: createCultivator(),
    display: {
      attrs: {
        spirit: 10,
        vitality: 10,
        speed: 10,
        willpower: 10,
        wisdom: 10,
        atk: 50,
        def: 40,
        magicAtk: 50,
        magicDef: 40,
        critRate: 0.05,
        critDamageMult: 1.25,
        evasionRate: 0.03,
        controlHit: 0.03,
        controlResistance: 0.03,
        armorPenetration: 0,
        magicPenetration: 0,
        critResist: 0,
        critDamageReduction: 0,
        accuracy: 0,
        healAmplify: 0,
        maxHp: 360,
        maxMp: 777,
      },
      resources: {
        hp: {
          current: 240,
          max: 360,
          percent: 66.67,
        },
        mp: {
          current: 512,
          max: 777,
          percent: 65.89,
        },
      },
    },
  };
}

function createStoreState(
  overrides: Partial<PlayerStateStoreData>,
): PlayerStateStoreData {
  return {
    userId: 'user-1',
    cultivatorId: 'cultivator-1',
    globalVersion: 1,
    domainVersions: {
      profile: 1,
      condition: 0,
      progress: 0,
      currency: 0,
      loadout: 0,
      mail: 0,
      tasks: 0,
    },
    snapshot: {},
    loading: false,
    isRefreshing: false,
    isRecovering: false,
    refreshingDomains: new Set(),
    staleDomains: new Set(),
    lastSyncAt: null,
    error: null,
    ...overrides,
  };
}

describe('player state selectors', () => {
  it('prefers the latest sect snapshot and immediately recalculates display attributes', () => {
    const cultivatorView = createCultivatorView();
    cultivatorView.cultivator.sect = {
      membershipId: 'member-1', sectId: 'lingxiao', status: 'active', contribution: 20,
      tacticId: 'steady', activeMeridianSlot: 1, configVersion: 1,
      methods: { 'lingxiao-canon': 5, 'sword-guidance': 5 },
      meridianLoadouts: [], abilityLoadout: [null, null, null, null],
    };
    const latestSect = {
      ...cultivatorView.cultivator.sect,
      methods: { 'lingxiao-canon': 100, 'sword-guidance': 100 },
    };
    const staleState = createStoreState({ snapshot: { profile: cultivatorView } });
    const latestState = createStoreState({ snapshot: { profile: cultivatorView, sect: latestSect } });

    expect(selectActiveCultivatorProfile(latestState)?.sect).toEqual(latestSect);
    expect(selectCultivatorDisplay(latestState)!.attrs.atk).toBeGreaterThan(
      selectCultivatorDisplay(staleState)!.attrs.atk,
    );
  });

  it('derives display resources from patched condition instead of stale profile display', () => {
    const cultivatorView = createCultivatorView();
    const nextCondition = {
      ...cultivatorView.cultivator.condition,
      resources: {
        hp: { current: 12 },
        mp: { current: 34 },
      },
    };

    const state = createStoreState({
      globalVersion: 2,
      domainVersions: {
        profile: 1,
        condition: 2,
        progress: 0,
        currency: 0,
        loadout: 0,
        mail: 0,
        tasks: 0,
      },
      snapshot: {
        profile: cultivatorView,
        condition: nextCondition,
      },
    });

    const cultivator = selectActiveCultivatorProfile(state);
    const display = selectCultivatorDisplay(state);

    expect(cultivator?.condition).toBe(nextCondition);
    expect(display?.resources.hp.current).toBe(12);
    expect(display?.resources.mp.current).toBe(34);
  });

  it('restores live exp cap when event progress patches omit persisted exp_cap', () => {
    const cultivatorView = createCultivatorView();

    const state = createStoreState({
      globalVersion: 2,
      domainVersions: {
        profile: 1,
        condition: 0,
        progress: 2,
        currency: 0,
        loadout: 0,
        mail: 0,
        tasks: 0,
      },
      snapshot: {
        profile: cultivatorView,
        progress: {
          cultivation_exp: 120,
          comprehension_insight: 8,
        },
      },
    });

    const cultivator = selectActiveCultivatorProfile(state);

    expect(cultivator?.cultivation_progress?.exp_cap).toBe(500);
    expect(cultivator?.cultivation_progress?.cultivation_exp).toBe(120);
  });
});
