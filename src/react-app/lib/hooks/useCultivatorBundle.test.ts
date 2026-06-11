import type { PlayerCultivatorView } from '@shared/contracts/player';
import type { Cultivator } from '@shared/types/cultivator';
import { describe, expect, it } from 'vitest';
import {
  buildFetchStateFromPlayerView,
  buildLegacyFetchStateFromPlayerState,
} from './useCultivatorBundle';

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
      artifacts: [
        {
          id: 'artifact-1',
          name: '玄木佩',
          slot: 'accessory',
          element: '木',
          attributeModifiers: [],
        },
      ],
      consumables: [],
      materials: [],
    },
    equipped: {
      weapon: null,
      armor: null,
      accessory: 'artifact-1',
    },
    max_skills: 3,
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

function createCultivatorView(): PlayerCultivatorView {
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

describe('buildFetchStateFromPlayerView', () => {
  it('keeps the raw cultivator and server-derived display snapshot together', () => {
    const cultivatorView = createCultivatorView();

    const state = buildFetchStateFromPlayerView({
      cultivatorView,
      unreadMailCount: 4,
    });

    expect(state.cultivator?.id).toBe('cultivator-1');
    expect(state.display).toBe(cultivatorView.display);
    expect(state.display?.attrs.maxMp).toBe(777);
    expect(state.display?.resources.mp).toEqual({
      current: 512,
      max: 777,
      percent: 65.89,
    });
    expect(state.inventory.artifacts).toHaveLength(1);
    expect(state.inventoryLoaded).toEqual({
      artifacts: true,
      materials: false,
      consumables: false,
    });
    expect(state.unreadMailCount).toBe(4);
  });
});

describe('buildLegacyFetchStateFromPlayerState', () => {
  it('derives display resources from patched condition instead of stale profile display', () => {
    const cultivatorView = createCultivatorView();
    const nextCondition = {
      ...cultivatorView.cultivator.condition,
      resources: {
        hp: { current: 12 },
        mp: { current: 34 },
      },
    };

    const state = buildLegacyFetchStateFromPlayerState({
      userId: 'user-1',
      cultivatorId: 'cultivator-1',
      globalVersion: 2,
      domainVersions: {
        profile: 1,
        condition: 2,
        progress: 0,
        currency: 0,
        inventory: 0,
        products: 0,
        mail: 0,
        tasks: 0,
      },
      snapshot: {
        profile: cultivatorView,
        condition: nextCondition,
      },
      loading: false,
      isRefreshing: false,
      isRecovering: false,
      refreshingDomains: new Set(),
      staleDomains: new Set(),
      lastSyncAt: null,
      error: null,
    });

    expect(state.cultivator?.condition).toBe(nextCondition);
    expect(state.display?.resources.hp.current).toBe(12);
    expect(state.display?.resources.mp.current).toBe(34);
  });

  it('restores live exp cap when event progress patches omit persisted exp_cap', () => {
    const cultivatorView = createCultivatorView();

    const state = buildLegacyFetchStateFromPlayerState({
      userId: 'user-1',
      cultivatorId: 'cultivator-1',
      globalVersion: 2,
      domainVersions: {
        profile: 1,
        condition: 0,
        progress: 2,
        currency: 0,
        inventory: 0,
        products: 0,
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
      loading: false,
      isRefreshing: false,
      isRecovering: false,
      refreshingDomains: new Set(),
      staleDomains: new Set(),
      lastSyncAt: null,
      error: null,
    });

    expect(state.cultivator?.cultivation_progress?.exp_cap).toBe(250);
    expect(state.cultivator?.cultivation_progress?.cultivation_exp).toBe(120);
  });
});
