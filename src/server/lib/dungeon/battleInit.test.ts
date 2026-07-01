import {
  buildDungeonBattleInit,
  buildPersistentStatus,
  incrementOrInsertStatus,
  promoteInjuryStatus,
} from './battleInit';
import { ConditionService } from '@server/lib/services/ConditionService';
import { AttributeType, ModifierType } from '@shared/engine/battle-v5/core/types';
import type { PlayerLoadout } from '@shared/contracts/player';
import type { Cultivator } from '@shared/types/cultivator';

function createCultivator(condition?: Cultivator['condition']): Cultivator {
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
    spirit_stones: 0,
    condition,
  };
}

describe('dungeon battle init helpers', () => {
  test('副本战斗从持久 condition 注入角色当前气血和法力', () => {
    const battleInit = buildDungeonBattleInit(
      createCultivator({
        version: 1,
        resources: {
          hp: { current: 321 },
          mp: { current: 123 },
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
        metrics: {
          totalRecoveredHp: 0,
          totalRecoveredMp: 0,
        },
      }),
    );

    expect(battleInit.player?.resourceState?.hp).toEqual({
      mode: 'absolute',
      value: 321,
    });
    expect(battleInit.player?.resourceState?.mp).toEqual({
      mode: 'absolute',
      value: 123,
    });
  });

  test('副本战斗在完整 loadout 上限下保留旧满血语义', () => {
    const bareMax = ConditionService.getMaxResources(createCultivator());
    const profile = createCultivator({
      version: 1,
      resources: {
        hp: { current: bareMax.maxHp },
        mp: { current: bareMax.maxMp },
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
    });
    const loadout: PlayerLoadout = {
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
    const runtime: Cultivator = {
      ...profile,
      skills: loadout.skills,
      cultivations: loadout.cultivations,
      inventory: {
        artifacts: loadout.artifacts,
        consumables: [],
        materials: [],
      },
      equipped: loadout.equipped,
    };
    runtime.condition = ConditionService.tickNaturalRecovery(
      runtime,
      profile.condition,
      undefined,
      { legacyMaxResources: bareMax },
    );
    const runtimeMax = ConditionService.getMaxResources(runtime);
    const battleInit = buildDungeonBattleInit(runtime);

    expect(battleInit.player?.resourceState?.hp).toEqual({
      mode: 'absolute',
      value: runtimeMax.maxHp,
    });
  });

  test('副本战斗复用持久 PVE 的炼体入场护盾', () => {
    const battleInit = buildDungeonBattleInit(
      createCultivator({
        version: 1,
        resources: {
          hp: { current: 321 },
          mp: { current: 123 },
        },
        gauges: {
          pillToxicity: 0,
        },
        tracks: {
          bodyCultivation: {
            version: 1,
            realm: 'bronze_skin',
            tracks: {
              skin: { level: 5, progress: 0 },
              sinew_bone: { level: 0, progress: 0 },
              organs: { level: 0, progress: 0 },
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
        timestamps: {
          lastRecoveryAt: new Date().toISOString(),
        },
        metrics: {
          totalRecoveredHp: 0,
          totalRecoveredMp: 0,
        },
      }),
    );

    expect(battleInit.player?.resourceState?.shield).toBeGreaterThan(0);
  });

  test('weakness 可叠层，伤势会按轻伤→重伤→濒死晋级', () => {
    const weaknessStatuses = incrementOrInsertStatus([], 'weakness', 2);
    const stackedWeakness = incrementOrInsertStatus(
      weaknessStatuses,
      'weakness',
      3,
    );

    expect(stackedWeakness[0].stacks).toBe(5);

    const minor = promoteInjuryStatus([]);
    const major = promoteInjuryStatus(minor);
    const nearDeath = promoteInjuryStatus(major);

    expect(minor.map((status) => status.key)).toEqual(['minor_wound']);
    expect(major.map((status) => status.key)).toEqual(['major_wound']);
    expect(nearDeath.map((status) => status.key)).toEqual([
      'near_death',
    ]);
  });
});
