import { simulateBattleV5 } from '@server/lib/services/simulateBattleV5';
import type { Cultivator } from '@shared/types/cultivator';
import {
  buildTrainingBattleInitConfig,
  createDefaultTrainingRoomStorage,
  parseTrainingRoomStorage,
} from './config';

function createCultivator(id: string, name: string): Cultivator {
  return {
    id,
    name,
    age: 18,
    lifespan: 120,
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
    inventory: { artifacts: [], consumables: [], materials: [] },
    equipped: { weapon: null, armor: null, accessory: null },
    max_skills: 0,
    spirit_stones: 0,
    gender: '男',
    realm: '炼气',
    realm_stage: '初期',
    persistent_statuses: [],
  };
}

describe('training-room config', () => {
  test('无效版本或脏数据会回退默认配置', () => {
    const invalidVersion = parseTrainingRoomStorage(
      JSON.stringify({
        version: 999,
        currentDraft: { foo: 'bar' },
        presets: 'not-an-array',
      }),
    );
    const brokenJson = parseTrainingRoomStorage('{bad json}');

    expect(invalidVersion).toEqual(createDefaultTrainingRoomStorage());
    expect(brokenJson).toEqual(createDefaultTrainingRoomStorage());
  });

  test('玩家旧自定义配置会被忽略并恢复为默认入场', () => {
    const storage = parseTrainingRoomStorage(
      JSON.stringify({
        version: 1,
        currentDraft: {
          player: {
            hp: { mode: 'percent', value: 0.2 },
            mp: { mode: 'absolute', value: 12 },
            shield: 999,
            statusRefs: [{ version: 1, templateId: 'weakness', stacks: 3 }],
          },
          dummy: {
            maxHp: 100_000,
            maxMp: 0,
            baseAttributes: {
              spirit: 10,
              vitality: 10,
              wisdom: 10,
              speed: 10,
              willpower: 10,
            },
            modifiers: [],
          },
        },
        presets: [],
      }),
    );

    expect(storage.currentDraft.player).toEqual(
      createDefaultTrainingRoomStorage().currentDraft.player,
    );
  });

  test('默认练功房配置能把木桩首帧初始化为十万血', () => {
    const player = createCultivator('player', '道友');
    const dummy = createCultivator('dummy', '木桩');
    const initConfig = buildTrainingBattleInitConfig(
      createDefaultTrainingRoomStorage().currentDraft,
    );

    const result = simulateBattleV5(player, dummy, initConfig);
    const initFrame = result.stateTimeline.frames[0].units.dummy;

    expect(initFrame.hp.current).toBe(100_000);
    expect(initFrame.hp.max).toBe(100_000);
  });

  test('训练初始化不会读取玩家自定义草稿', () => {
    const initConfig = buildTrainingBattleInitConfig({
      player: {
        hp: { mode: 'percent', value: 0.2 },
        mp: { mode: 'absolute', value: 12 },
        shield: 999,
        statusRefs: [{ version: 1, templateId: 'weakness', stacks: 3 }],
      },
      dummy: createDefaultTrainingRoomStorage().currentDraft.dummy,
    });

    expect(initConfig.player).toEqual({
      resourceState: {
        hp: { mode: 'percent', value: 1 },
        mp: { mode: 'percent', value: 1 },
        shield: 0,
      },
    });
  });
});
