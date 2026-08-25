import { getRealmStageAttributeBudget } from '@shared/config/realmProgression';
import { createCombatUnitFromCultivator } from '@shared/engine/battle-v5/adapters/CultivatorCombatAdapter';
import {
  REALM_STAGE_VALUES,
  REALM_VALUES,
} from '@shared/types/constants';
import type { Cultivator } from '@shared/types/cultivator';
import { describe, expect, it } from 'vitest';
import { LINGXIAO_ORGANIZATION } from './LingxiaoOrganizationModule';

function playerFixture(overrides: Partial<Cultivator> = {}): Cultivator {
  return {
    id: 'player',
    name: '玩家',
    gender: '女',
    realm: '筑基',
    realm_stage: '中期',
    age: 88,
    lifespan: 300,
    attributes: {
      vitality: 99,
      strength: 35,
      spirit: 12,
      endurance: 43,
      speed: 71,
      willpower: 26,
    },
    spiritual_roots: [{ element: '雷', strength: 100 }],
    pre_heaven_fates: [{ name: '玩家命格' }],
    cultivations: [],
    skills: [],
    inventory: { artifacts: [], consumables: [], materials: [] },
    equipped: { weapon: null, armor: null, accessory: null },
    spirit_stones: 0,
    ...overrides,
  };
}

describe('LingxiaoOrganizationModule', () => {
  it('centralizes V1 facility permissions by disciple rank', () => {
    const registered =
      LINGXIAO_ORGANIZATION.capabilities.snapshot('registered');
    expect(registered['sect.hall.view'].granted).toBe(true);
    expect(registered['sect.shop.use'].granted).toBe(false);
    expect(registered['sect.facility.cultivation.use'].granted).toBe(false);
    expect(registered['sect.facility.alchemy.use'].granted).toBe(false);

    const outer = LINGXIAO_ORGANIZATION.capabilities.snapshot('outer');
    expect(outer['sect.shop.use'].granted).toBe(true);
    expect(outer['sect.construction.view'].granted).toBe(true);
    expect(outer['sect.facility.cultivation.use'].granted).toBe(true);
    expect(outer['sect.facility.alchemy.use'].granted).toBe(false);

    const inner = LINGXIAO_ORGANIZATION.capabilities.snapshot('inner');
    expect(inner['sect.facility.alchemy.use'].granted).toBe(true);
    expect(inner['sect.facility.refinery.use'].granted).toBe(true);
    expect(inner['sect.cave.view'].granted).toBe(true);
  });

  it('owns rank, economy, task, and construction content', () => {
    expect(
      (
        ['registered', 'outer', 'inner', 'true'] as const
      ).map((rank) => LINGXIAO_ORGANIZATION.ranks.methodLevelCap(rank)),
    ).toEqual([45, 90, 135, 180]);
    expect(LINGXIAO_ORGANIZATION.ranks.requirement('outer')).toMatchObject({
      minRealm: '炼气',
      contribution: 100,
      dailyCompletions: 3,
    });
    expect(LINGXIAO_ORGANIZATION.ranks.requirement('inner')).toMatchObject({
      minRealm: '筑基',
      contribution: 500,
    });
    expect(LINGXIAO_ORGANIZATION.ranks.requirement('true')).toMatchObject({
      minRealm: '元婴',
      contribution: 3000,
    });
    expect(
      LINGXIAO_ORGANIZATION.ranks.requirement('true').requiredTaskTags,
    ).toContainEqual({ tag: 'promotion.elder_trial', label: '通过长老试炼' });
    expect(
      LINGXIAO_ORGANIZATION.tasks.get('dungeon_exploration')?.executorKey,
    ).toBe('sect.dungeon');
    expect(LINGXIAO_ORGANIZATION.construction.facilities[0]?.key).toBe('archive');
    expect(LINGXIAO_ORGANIZATION.construction.upgradeTarget(1)).toBe(250);
    expect(
      [1, 2, 3, 4, 5].map((archiveLevel) =>
        LINGXIAO_ORGANIZATION.benefits.methodLevelCap(
          new Map([['archive', archiveLevel]]),
        ),
      ),
    ).toEqual([40, 75, 110, 145, 180]);
    const levels = new Map([
      ['archive', 5],
      ['cultivation_room', 5],
      ['workshop', 5],
      ['spirit_vein', 5],
    ]);
    expect(LINGXIAO_ORGANIZATION.benefits.methodLevelCap(levels)).toBe(180);
    expect(
      LINGXIAO_ORGANIZATION.benefits.retreatMultiplier(levels, 'outer'),
    ).toBe(1.1);
    expect(
      LINGXIAO_ORGANIZATION.benefits.craftDiscount(
        'sect.craft.alchemy',
        levels,
        'true',
      ),
    ).toEqual({
      capability: 'sect.facility.alchemy.use',
      discount: 0.2,
    });
    expect(
      LINGXIAO_ORGANIZATION.benefits.craftDiscount(
        'sect.craft.refinery',
        levels,
        'true',
      ),
    ).toEqual({
      capability: 'sect.facility.refinery.use',
      discount: 0.2,
    });
    expect(LINGXIAO_ORGANIZATION.benefits.stipendMultiplier(levels)).toBe(1.25);
  });

  it('declares independent battle and material bounties', () => {
    const battle = LINGXIAO_ORGANIZATION.tasks.get('weekly_bounty_battle');
    const material = LINGXIAO_ORGANIZATION.tasks.get(
      'weekly_bounty_material',
    );

    expect(battle).toMatchObject({
      kind: 'weekly',
      enrollment: 'manual',
      executorKey: 'sect.battle',
      minimumDifficulty: 'hard',
      reward: {
        policy: 'sect.reward.realm-task',
        input: { baseContribution: 20 },
      },
      completionTags: ['promotion.bounty'],
    });
    expect(material).toMatchObject({
      kind: 'weekly',
      enrollment: 'manual',
      executorKey: 'sect.delivery.material',
      minimumDifficulty: 'hard',
      offer: {
        policy: 'sect.offer.delivery',
        input: { kind: 'material' },
      },
      reward: {
        policy: 'sect.reward.realm-task',
        input: { baseContribution: 20 },
      },
      completionTags: ['promotion.bounty'],
    });
    expect(
      LINGXIAO_ORGANIZATION.tasks
        .listByCompletionTag('promotion.bounty')
        .map((task) => task.id),
    ).toEqual(['weekly_bounty_battle', 'weekly_bounty_material']);
  });

  it('builds the fixed mine beast at 75% of every realm-stage budget', () => {
    const factory = LINGXIAO_ORGANIZATION.battles.get('mine_patrol')!;
    expect(factory.acquisition).toBe('preset');

    for (const realm of REALM_VALUES) {
      for (const realmStage of REALM_STAGE_VALUES) {
        const result = factory.create({
          player: playerFixture({ realm, realm_stage: realmStage }),
          target: null,
          sectId: 'lingxiao',
          opponentId: `mine-${realm}-${realmStage}`,
        });
        const budget = getRealmStageAttributeBudget(realm, realmStage);
        const base = Math.floor(budget / 6);
        const remainder = budget % 6;
        const expected = ['vitality', 'strength', 'spirit', 'endurance', 'speed', 'willpower']
          .map((key, index) => [
            key,
            Math.max(1, Math.floor((base + (index < remainder ? 1 : 0)) * 0.75)),
          ]);

        expect(result.opponent).toMatchObject({
          name: '裂岩獠兽',
          realm,
          realm_stage: realmStage,
          attributes: Object.fromEntries(expected),
        });
      }
    }

    const result = factory.create({
      player: playerFixture(),
      target: null,
      sectId: 'lingxiao',
      opponentId: 'mine-fixed',
    });
    expect(result).toMatchObject({
      title: '矿场巡视',
      presetId: 'mine-beast-rockfang-v1',
      description:
        '盘踞宗门矿脉的厚甲妖兽，惯以獠牙冲阵、震地扰敌，并以妖血强化自身。',
    });
    expect(result.opponent.skills).toMatchObject([
      { name: '碎岩扑击', element: '土', quality: '玄品' },
      { name: '撼地怒吼', element: '土', quality: '玄品' },
      { name: '妖血沸腾', element: '火', quality: '玄品' },
    ]);
    expect(
      result.opponent.skills.map((skill) =>
        skill.productModel?.affixes.map((affix) => affix.id),
      ),
    ).toEqual([
      ['skill-core-damage-earth', 'skill-variant-def-break'],
      ['skill-core-damage-earth', 'skill-variant-control-stun'],
      ['skill-core-fire-channeling'],
    ]);
    expect(() => createCombatUnitFromCultivator(result.opponent)).not.toThrow();
  });

  it('declares the persistent or standardized resource strategy in scene metadata', () => {
    expect(
      Object.fromEntries(
        [
          'mine_patrol',
          'weekly_tournament',
          'weekly_bounty_battle',
          'elder_trial',
        ].map((taskId) => [
          taskId,
          LINGXIAO_ORGANIZATION.battles.get(taskId)?.stateStrategy,
        ]),
      ),
    ).toEqual({
      mine_patrol: 'persistent_world',
      weekly_tournament: 'standard_full',
      weekly_bounty_battle: 'persistent_world',
      elder_trial: 'persistent_world',
    });
  });

  it.each([
    ['weekly_tournament', 'same-sect', '宗门小比'],
    ['weekly_bounty_battle', 'other-sect', '悬赏令·讨伐'],
  ] as const)(
    'freezes the player target for %s without scaling',
    (taskId, acquisition, title) => {
      const target = playerFixture({
        id: 'target',
        name: '锁定对手',
        realm: '筑基',
        realm_stage: '圆满',
      });
      const result = LINGXIAO_ORGANIZATION.battles.get(taskId)?.create({
        player: playerFixture(),
        target,
        sectId: 'lingxiao',
        opponentId: `npc-${taskId}`,
      });

      expect(LINGXIAO_ORGANIZATION.battles.get(taskId)?.acquisition).toBe(
        acquisition,
      );
      expect(result?.title).toBe(title);
      expect(result?.opponent).toEqual({
        ...target,
        id: `npc-${taskId}`,
      });
      target.name = '领取后改名';
      target.attributes.vitality = 1;
      expect(result?.opponent.name).toBe('锁定对手');
      expect(result?.opponent.attributes.vitality).toBe(99);
    },
  );

  it('builds the fixed Lingxiao elder combat loadout', () => {
    const result = LINGXIAO_ORGANIZATION.battles.get('elder_trial')?.create({
      player: playerFixture(),
      target: null,
      sectId: 'lingxiao',
      opponentId: 'elder-trial',
    });

    expect(result).toMatchObject({
      title: '长老试炼',
      presetId: 'elder-trial-lingxiao-v1',
      opponent: {
        name: '听剑老人·试炼化身',
        realm: '元婴',
        realm_stage: '圆满',
      },
    });
    expect(result?.opponent.sect).toMatchObject({
      sectId: 'lingxiao',
      activePathId: 'swift-sword',
      methods: {
        'lingxiao-canon': 135,
        'sword-guidance': 135,
        'void-step': 135,
        'edge-cleansing': 135,
        'origin-returning': 135,
        'sword-nurturing': 135,
      },
      abilityLoadout: [
        'guiding-sword',
        'linked-edge',
        'breaking-edge',
        'sect-ultimate',
      ],
    });
    expect(result?.opponent.sect?.paths).toEqual([
      {
        pathId: 'swift-sword',
        unlockedLayerIds: ['1', '2', '3', '4', '5', 'ultimate'],
        tacticId: 'aggressive',
        activeMeridianSlot: 1,
        meridianLoadouts: [
          { slot: 1, nodeIds: [], version: 1 },
          { slot: 2, nodeIds: [], version: 1 },
          { slot: 3, nodeIds: [], version: 1 },
        ],
      },
    ]);
    expect(result?.opponent.inventory.artifacts).toMatchObject([
      { name: '照尘古剑', slot: 'weapon', quality: '地品' },
      { name: '藏锋剑衣', slot: 'armor', quality: '地品' },
      { name: '澄心剑珏', slot: 'accessory', quality: '地品' },
    ]);
    expect(
      result?.opponent.inventory.artifacts.map((artifact) =>
        artifact.productModel?.affixes.map((affix) => affix.id),
      ),
    ).toEqual([
      [
        'artifact-panel-weapon-dual-atk',
        'artifact-panel-spirit',
        'artifact-weapon-blood-drinker',
      ],
      [
        'artifact-panel-armor-dual-def',
        'artifact-panel-vitality',
        'artifact-defense-death-prevent',
      ],
      [
        'artifact-panel-accessory-utility',
        'artifact-panel-willpower',
        'artifact-accessory-clear-heart-pendant',
      ],
    ]);
    expect(() =>
      createCombatUnitFromCultivator(result!.opponent),
    ).not.toThrow();
  });
});
