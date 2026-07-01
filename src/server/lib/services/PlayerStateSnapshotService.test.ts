import { AttributeType, ModifierType } from '@shared/engine/battle-v5/core/types';
import type {
  PlayerLoadout,
  PlayerProfileCultivator,
} from '@shared/contracts/player';
import type { CultivatorCondition } from '@shared/types/condition';

const mocks = vi.hoisted(() => ({
  findCultivator: vi.fn(),
}));

vi.mock('@server/lib/drizzle/db', () => ({
  getExecutor: () => ({
    query: {
      cultivators: {
        findFirst: mocks.findCultivator,
      },
    },
  }),
}));

vi.mock('@server/lib/repositories/playerStateRepository', () => ({
  getOrCreateStateVersion: vi.fn(async () => ({
    globalVersion: 1,
    domainVersions: {
      profile: 1,
      condition: 1,
      progress: 1,
      currency: 1,
      loadout: 1,
      mail: 1,
      tasks: 1,
    },
  })),
}));

vi.mock('@server/lib/services/cultivatorService', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('./cultivatorService')>();

  return {
    ...actual,
    getPlayerProfileCultivatorById: vi.fn(),
    getPlayerLoadoutByCultivatorId: vi.fn(),
  };
});

import { buildPlayerStateSnapshot } from './PlayerStateSnapshotService';
import {
  getPlayerLoadoutByCultivatorId,
  getPlayerProfileCultivatorById,
} from './cultivatorService';
import { ConditionService } from './ConditionService';

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
      lastRecoveryAt: new Date().toISOString(),
    },
  };
}

function createProfile(condition: CultivatorCondition): PlayerProfileCultivator {
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
    spirit_stones: 0,
    condition,
  };
}

function createLoadout(): PlayerLoadout {
  return {
    skills: [],
    cultivations: [
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
    ],
    artifacts: [],
    equipped: {
      weapon: null,
      armor: null,
      accessory: null,
    },
  };
}

describe('buildPlayerStateSnapshot condition/display consistency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findCultivator.mockResolvedValue({ id: 'cultivator-1' });
  });

  it('uses the same runtime loadout max for profile display and condition snapshot', async () => {
    const bareProfile = createProfile(createCondition(0));
    const bareMax = ConditionService.getMaxResources({
      ...bareProfile,
      skills: [],
      cultivations: [],
      inventory: { artifacts: [], consumables: [], materials: [] },
      equipped: { weapon: null, armor: null, accessory: null },
    });
    const profile = createProfile(
      createCondition(bareMax.maxHp, bareMax.maxMp),
    );

    vi.mocked(getPlayerProfileCultivatorById).mockResolvedValue(profile);
    vi.mocked(getPlayerLoadoutByCultivatorId).mockResolvedValue(createLoadout());

    const snapshot = await buildPlayerStateSnapshot({
      userId: 'user-1',
      cultivatorId: 'cultivator-1',
      domains: ['profile', 'condition'],
    });

    const displayHp = snapshot.snapshot.profile?.display.resources.hp;
    const conditionHp = snapshot.snapshot.condition?.resources.hp;

    expect(displayHp).toEqual({
      current: conditionHp?.current,
      max: conditionHp?.max,
      percent: 100,
    });
    expect(conditionHp?.current).toBe(conditionHp?.max);
    expect(conditionHp?.max).toBeGreaterThan(bareMax.maxHp);
  });
});
