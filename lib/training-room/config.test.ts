import { simulateBattleV5 } from '@/lib/services/simulateBattleV5';
import type { Cultivator } from '@/types/cultivator';
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

  test('默认练功房配置能把木桩首帧初始化为千万血', () => {
    const player = createCultivator('player', '道友');
    const dummy = createCultivator('dummy', '木桩');
    const initConfig = buildTrainingBattleInitConfig(
      createDefaultTrainingRoomStorage().currentDraft,
    );

    const result = simulateBattleV5(player, dummy, initConfig);
    const initFrame = result.stateTimeline.frames[0].units.dummy;

    expect(initFrame.hp.current).toBe(10_000_000);
    expect(initFrame.hp.max).toBe(10_000_000);
  });
});
