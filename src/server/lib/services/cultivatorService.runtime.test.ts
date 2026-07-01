import { AttributeType, ModifierType } from '@shared/engine/battle-v5/core/types';
import type {
  PlayerLoadout,
  PlayerProfileCultivator,
} from '@shared/contracts/player';
import type { CultivatorCondition } from '@shared/types/condition';
import { ConditionService } from './ConditionService';
import { buildCultivatorRuntime } from './cultivatorService';

vi.mock('@server/lib/drizzle/db', () => ({
  getExecutor: vi.fn(),
}));

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

describe('buildCultivatorRuntime condition normalization', () => {
  it('keeps legacy full health full after loadout raises the runtime max', () => {
    const bareProfile = createProfile(createCondition(0));
    const bareMax = ConditionService.getMaxResources(
      buildCultivatorRuntime(bareProfile, {
        skills: [],
        cultivations: [],
        artifacts: [],
        equipped: {
          weapon: null,
          armor: null,
          accessory: null,
        },
      }),
    );
    const runtime = buildCultivatorRuntime(
      createProfile(createCondition(bareMax.maxHp, bareMax.maxMp)),
      createLoadout(),
    );
    const runtimeMax = ConditionService.getMaxResources(runtime);

    expect(runtime.condition?.resources.hp).toEqual({
      current: runtimeMax.maxHp,
      max: runtimeMax.maxHp,
    });
  });

  it('does not turn a real injury into full health during loadout merge', () => {
    const bareProfile = createProfile(createCondition(0));
    const bareMax = ConditionService.getMaxResources(
      buildCultivatorRuntime(bareProfile, {
        skills: [],
        cultivations: [],
        artifacts: [],
        equipped: {
          weapon: null,
          armor: null,
          accessory: null,
        },
      }),
    );
    const runtime = buildCultivatorRuntime(
      createProfile(createCondition(bareMax.maxHp - 80, bareMax.maxMp)),
      createLoadout(),
    );
    const runtimeMax = ConditionService.getMaxResources(runtime);

    expect(runtime.condition?.resources.hp).toEqual({
      current: bareMax.maxHp - 80,
      max: runtimeMax.maxHp,
    });
  });
});
