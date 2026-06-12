import { describe, expect, it } from 'vitest';
import type { DungeonDifficultyTier, MapNodeInfo } from './mapSystem';
import {
  canChallengeDungeonRealm,
  clampDungeonEnemyRealmStage,
  getAllMapNodes,
  getAllSatelliteNodes,
  getDungeonRewardBonus,
  resolveDungeonEnemyDifficulty,
  resolveDungeonMapConfig,
} from './mapSystem';

function createNode(
  difficulty?: DungeonDifficultyTier,
): MapNodeInfo {
  return {
    id: 'test-node',
    name: '测试秘境',
    region: '测试',
    realm_requirement: '筑基',
    tags: [],
    description: '',
    connections: [],
    x: 0,
    y: 0,
    ...(difficulty ? { dungeon_config: { difficulty } } : {}),
  };
}

describe('resolveDungeonMapConfig', () => {
  it('defaults old map nodes to normal difficulty', () => {
    expect(resolveDungeonMapConfig(createNode())).toMatchObject({
      realmRequirement: '筑基',
      difficultyTier: 'normal',
      difficultyLabel: '普通',
      enemyDifficulty: 24,
      allowedEnemyRealmStages: ['初期', '中期'],
      allowBossLoadout: false,
    });
  });

  it.each([
    ['easy', '低危', 12, ['初期'], false],
    ['normal', '普通', 24, ['初期', '中期'], false],
    ['hard', '险地', 40, ['中期', '后期'], false],
    ['elite', '凶险', 60, ['后期', '圆满'], true],
    ['boss', '绝境', 80, ['圆满'], true],
  ] as const)(
    'resolves %s difficulty preset',
    (tier, label, enemyDifficulty, allowedStages, allowBossLoadout) => {
      expect(resolveDungeonMapConfig(createNode(tier))).toMatchObject({
        difficultyTier: tier,
        difficultyLabel: label,
        enemyDifficulty,
        allowedEnemyRealmStages: allowedStages,
        allowBossLoadout,
      });
    },
  );

  it('resolves fixed enemy generator difficulty by realm and tier', () => {
    expect(resolveDungeonEnemyDifficulty('炼气', 'easy')).toBe(10);
    expect(resolveDungeonEnemyDifficulty('筑基', 'normal')).toBe(24);
    expect(resolveDungeonEnemyDifficulty('元婴', 'hard')).toBe(50);
    expect(resolveDungeonEnemyDifficulty('渡劫', 'boss')).toBe(96);
  });

  it('clamps enemy realm stage by dungeon tier', () => {
    expect(
      clampDungeonEnemyRealmStage(
        '圆满',
        resolveDungeonMapConfig(createNode('easy')),
      ),
    ).toBe('初期');
    expect(
      clampDungeonEnemyRealmStage(
        '后期',
        resolveDungeonMapConfig(createNode('normal')),
      ),
    ).toBe('中期');
    expect(
      clampDungeonEnemyRealmStage(
        '初期',
        resolveDungeonMapConfig(createNode('hard')),
      ),
    ).toBe('中期');
    expect(
      clampDungeonEnemyRealmStage(
        '中期',
        resolveDungeonMapConfig(createNode('elite')),
      ),
    ).toBe('后期');
    expect(
      clampDungeonEnemyRealmStage(
        '后期',
        resolveDungeonMapConfig(createNode('boss')),
      ),
    ).toBe('圆满');
  });

  it('exposes reward bonuses by dungeon tier', () => {
    expect(getDungeonRewardBonus('easy')).toBe(1);
    expect(getDungeonRewardBonus('normal')).toBe(1.1);
    expect(getDungeonRewardBonus('hard')).toBe(1.2);
    expect(getDungeonRewardBonus('elite')).toBe(1.3);
    expect(getDungeonRewardBonus('boss')).toBe(1.5);
  });

  it('allows dungeon challenges only up to the player realm', () => {
    expect(canChallengeDungeonRealm('筑基', '炼气')).toBe(true);
    expect(canChallengeDungeonRealm('筑基', '筑基')).toBe(true);
    expect(canChallengeDungeonRealm('筑基', '金丹')).toBe(false);
  });

  it('keeps curated map data explicitly classified', () => {
    const satelliteNodes = getAllSatelliteNodes();

    // 只有卫星节点需要 dungeon_config
    expect(satelliteNodes.every((node) => node.dungeon_config?.difficulty)).toBe(true);

    // 主节点不应有 dungeon_config（副本仅限卫星节点）
    const mainNodes = getAllMapNodes();
    expect(mainNodes.every((node) => !node.dungeon_config)).toBe(true);

    // 验证特定卫星节点的难度配置
    expect(
      resolveDungeonMapConfig(
        satelliteNodes.find((node) => node.id === 'SAT_TN_01')!,
      ).difficultyLabel,
    ).toBe('普通');
    expect(
      resolveDungeonMapConfig(
        satelliteNodes.find((node) => node.id === 'SAT_LX_05')!,
      ).difficultyLabel,
    ).toBe('凶险');
    expect(
      resolveDungeonMapConfig(
        satelliteNodes.find((node) => node.id === 'SAT_DJ_02')!,
      ).difficultyLabel,
    ).toBe('绝境');
  });
});
