import { describe, expect, it } from 'vitest';
import {
  projectSectCombat,
  PRODUCTION_SECT_IDS,
  resolveSectAbility,
} from '../..';
import { SectStateValidator, type CultivatorSectState } from '../../../core';
import { WUXIANG_MODULE, WUXIANG_TECHNIQUE_IDS } from '..';

type PathId = 'mirror-karma' | 'demon-crossing';

function state(pathId: PathId, nodes: string[] = []): CultivatorSectState {
  return {
    membershipId: 'w1',
    sectId: 'wuxiang',
    status: 'active',
    contribution: 0,
    configVersion: 2,
    activePathId: pathId,
    methods: {
      'wuxiang-canon': 5,
      'blood-lotus': 3,
      'white-bone': 3,
      'wrathful-ming': 3,
      'six-senses': 3,
      'reed-crossing-method': 3,
    },
    paths: [
      {
        pathId,
        unlockedLayerIds: ['1', '2', '3', '4', '5', 'ultimate'],
        tacticId: pathId === 'mirror-karma' ? 'guard' : 'trial-fire',
        activeMeridianSlot: 1,
        meridianLoadouts: [
          { slot: 1, nodeIds: nodes, version: 1 },
          { slot: 2, nodeIds: [], version: 1 },
          { slot: 3, nodeIds: [], version: 1 },
        ],
      },
    ],
    abilityLoadout: [
      'turn-form',
      'blood-tide',
      'three-knocks',
      'observe-calamity',
    ],
  };
}

const abilityTable: Record<
  PathId,
  Record<
    string,
    {
      names: [string, string, string];
      target: 'enemy' | 'self';
      cost: number;
      cooldown: number;
    }
  >
> = {
  'mirror-karma': {
    'flower-heart': {
      names: ['拈花叩心', '花落问罪', '心花两忘'],
      target: 'enemy',
      cost: 0.05,
      cooldown: 0,
    },
    'blood-tide': {
      names: ['血海听潮', '血海回澜', '海月同潮'],
      target: 'self',
      cost: 0.08,
      cooldown: 3,
    },
    'three-knocks': {
      names: ['三叩业门', '业门倒叩', '门内无人'],
      target: 'enemy',
      cost: 0.07,
      cooldown: 2,
    },
    'observe-calamity': {
      names: ['闭目观劫', '开眼见劫', '劫相俱寂'],
      target: 'self',
      cost: 0.1,
      cooldown: 4,
    },
    'five-skandhas': {
      names: ['照见五蕴', '五蕴还照', '五蕴皆空'],
      target: 'enemy',
      cost: 0.06,
      cooldown: 3,
    },
    'reed-crossing': {
      names: ['一苇横江', '一苇倒渡', '此岸非岸'],
      target: 'self',
      cost: 0.08,
      cooldown: 5,
    },
  },
  'demon-crossing': {
    'flower-heart': {
      names: ['拈花叩心', '摘心问魔', '心魔两忘'],
      target: 'enemy',
      cost: 0.06,
      cooldown: 0,
    },
    'blood-tide': {
      names: ['血海听潮', '血海倒悬', '血海无涯'],
      target: 'self',
      cost: 0.14,
      cooldown: 3,
    },
    'three-knocks': {
      names: ['三叩业门', '三叩魔关', '业门无生'],
      target: 'enemy',
      cost: 0.09,
      cooldown: 2,
    },
    'observe-calamity': {
      names: ['闭目观劫', '开眼见魔', '劫火自明'],
      target: 'self',
      cost: 0.11,
      cooldown: 4,
    },
    'five-skandhas': {
      names: ['照见五蕴', '焚尽五蕴', '蕴空身在'],
      target: 'self',
      cost: 0.07,
      cooldown: 3,
    },
    'reed-crossing': {
      names: ['一苇横江', '一苇渡厄', '苦海无舟'],
      target: 'self',
      cost: 0.1,
      cooldown: 5,
    },
  },
};

describe('无相禅宗战斗投影', () => {
  it('作为独立宗门进入生产目录，并保持双道途各六层三选一', () => {
    expect(PRODUCTION_SECT_IDS).toContain('wuxiang');
    expect(WUXIANG_MODULE.definition.configVersion).toBe(2);
    expect(WUXIANG_MODULE.definition.paths).toHaveLength(2);
    for (const path of WUXIANG_MODULE.definition.paths) {
      expect(path.layers).toHaveLength(6);
      expect(path.nodes).toHaveLength(18);
      expect(path.tactics).toHaveLength(3);
      for (const layer of path.layers) {
        expect(
          path.nodes.filter((node) => node.layerId === layer.id),
        ).toHaveLength(3);
      }
    }
  });

  it.each(['mirror-karma', 'demon-crossing'] as const)(
    '%s 只接受 configVersion=2 的当前状态',
    (pathId) => {
      const sect = state(pathId);
      expect(sect.configVersion).toBe(2);
      expect(() =>
        new SectStateValidator().validate(WUXIANG_MODULE, sect),
      ).not.toThrow();
      expect(WUXIANG_MODULE.definition.configVersion).toBe(2);
    },
  );

  it.each(['mirror-karma', 'demon-crossing'] as const)(
    '%s 的六门神通只使用 A、B、C 效果层，不再生成完整变体',
    (pathId) => {
      const sect = state(pathId);
      const projection = projectSectCombat({ sect, realm: '化神' })!;
      expect(projection.resources[0]).toMatchObject({
        name: '心念',
        initial: 0,
        max: 6,
      });
      expect(projection.selectionStrategy).toBeDefined();

      for (const abilityId of WUXIANG_TECHNIQUE_IDS) {
        const config = resolveSectAbility({
          sect,
          realm: '化神',
          abilityId,
        }).config;
        expect('variants' in config).toBe(false);
        expect(config.effectLayers?.map((layer) => layer.id)).toEqual([
          'demon',
          'formless',
        ]);
        expect(
          config.effectPlans?.map((plan) => ({
            id: plan.id,
            layers: plan.layerIds,
            consumeModeKey: plan.consumeModeKey,
          })),
        ).toEqual([
          {
            id: 'formless',
            layers: ['demon', 'formless'],
            consumeModeKey: 'sect.wuxiang.form',
          },
          {
            id: 'demon',
            layers: ['demon'],
            consumeModeKey: 'sect.wuxiang.form',
          },
        ]);
      }
    },
  );

  it.each(
    (['mirror-karma', 'demon-crossing'] as PathId[]).flatMap((pathId) =>
      WUXIANG_TECHNIQUE_IDS.map((abilityId) => ({ pathId, abilityId })),
    ),
  )(
    '$pathId/$abilityId 保持稳定 ID、目标、费用和冷却',
    ({ pathId, abilityId }) => {
      const expected = abilityTable[pathId][abilityId];
      const config = resolveSectAbility({
        sect: state(pathId),
        realm: '化神',
        abilityId,
      }).config;
      expect(config.slug).toBe(`sect.wuxiang.${abilityId}`);
      expect(config.name).toBe(expected.names[0]);
      expect(config.targetPolicy).toEqual({
        team: expected.target,
        scope: 'single',
      });
      expect(config.costs).toEqual([
        {
          resource: 'hp',
          mode: 'current_hp_ratio',
          ratio: expected.cost,
          minimum: 1,
          retain: 1,
        },
      ]);
      expect(config.cooldown).toBe(expected.cooldown);
      expect(config.effectPlans?.map((plan) => plan.name)).toEqual([
        expected.names[2],
        expected.names[1],
      ]);
    },
  );

  it.each(['mirror-karma', 'demon-crossing'] as const)(
    '%s 的转相只在两种受限效果计划间选择，费用按心念条件固定',
    (pathId) => {
      const config = resolveSectAbility({
        sect: state(pathId),
        realm: '化神',
        abilityId: 'turn-form',
      }).config;
      expect(config.targetPolicy).toEqual({ team: 'self', scope: 'single' });
      expect(config.cooldown).toBe(0);
      expect(
        config.costs?.map((cost) =>
          cost.mode === 'current_hp_ratio' ? cost.ratio : 0,
        ),
      ).toEqual([0.04, 0.08]);
      expect(
        config.effectPlans?.map((plan) => ({
          name: plan.name,
          layers: plan.layerIds,
        })),
      ).toEqual([
        { name: '一念无间', layers: ['demon', 'formless'] },
        { name: '魔相入身', layers: ['demon'] },
      ]);
    },
  );

  it('技能详情用玩家可理解的三相变化描述，不暴露效果计划或内部层术语', () => {
    const flower = resolveSectAbility({
      sect: state('mirror-karma'),
      realm: '化神',
      abilityId: 'flower-heart',
    });
    expect(flower.detailRows).toContain(
      '魔相变化《花落问罪》：先叩心伤敌并留下叩心戒；若目标带有业痕，花落问罪再发一击，并封住其一门伤害神通。',
    );
    expect(flower.detailRows).toContain(
      '无相变化《心花两忘》：一念之中兼得叩心与问罪之效，并再发一击；施展后，无论业痕是否触发，自身都会获得1层业痕。',
    );
    expect(flower.detailRows).toContain('佛相：造成相当于60%物攻的伤害');
    expect(flower.detailRows).toContain(
      '魔相显化时·命中后：每消耗1层业痕，额外造成相当于35%物攻的伤害',
    );
    expect(flower.detailRows).toContain(
      '无相显化时：额外造成相当于30%物攻的伤害',
    );
    expect(
      flower.detailRows.some((row) =>
        /效果计划|佛相主体|佛相完成|魔相追加|无相追加|A\+B|demon|formless/.test(
          row,
        ),
      ),
    ).toBe(false);

    const mirrorSkandhas = resolveSectAbility({
      sect: state('mirror-karma'),
      realm: '化神',
      abilityId: 'five-skandhas',
    });
    expect(mirrorSkandhas.detailRows).toContain(
      '佛相·命中后：驱散目标1个正面状态',
    );
    const demonSkandhas = resolveSectAbility({
      sect: state('demon-crossing'),
      realm: '化神',
      abilityId: 'five-skandhas',
    });
    expect(demonSkandhas.detailRows).toContain(
      '佛相·施展后：净化自身1个负面状态',
    );
  });

  it('佛魔同炉只逐门修改六项明确的无相 C 字段', () => {
    const formlessEffects = (abilityId: string, nodes: string[] = []) =>
      resolveSectAbility({
        sect: state('demon-crossing', nodes),
        realm: '化神',
        abilityId,
      }).config.effectLayers?.find((layer) => layer.id === 'formless')
        ?.effects ?? [];
    const base = Object.fromEntries(
      WUXIANG_TECHNIQUE_IDS.map((abilityId) => [
        abilityId,
        formlessEffects(abilityId),
      ]),
    );
    const furnace = Object.fromEntries(
      WUXIANG_TECHNIQUE_IDS.map((abilityId) => [
        abilityId,
        formlessEffects(abilityId, ['demon-one-furnace']),
      ]),
    );

    expect(base['flower-heart'][0]).toMatchObject({
      type: 'damage',
      params: { dynamicScalars: [{ coefficientCap: 0.4 }] },
    });
    expect(furnace['flower-heart'][0]).toMatchObject({
      type: 'damage',
      params: { dynamicScalars: [{ coefficientCap: 0.6 }] },
    });
    expect(base['blood-tide'][0]).toMatchObject({
      type: 'heal',
      params: { value: { targetMaxHpRatio: 0.05 } },
    });
    expect(furnace['blood-tide'][0]).toMatchObject({
      type: 'heal',
      params: { value: { targetMaxHpRatio: 0.08 } },
    });
    expect(base['three-knocks'][0]).toMatchObject({
      type: 'damage',
      params: { value: { coefficient: 0.65 } },
    });
    expect(furnace['three-knocks'][0]).toMatchObject({
      type: 'damage',
      params: { value: { coefficient: 0.85 } },
    });
    expect(base['observe-calamity'][0]).toMatchObject({
      type: 'shield',
      params: { value: { targetMaxHpRatio: 0.08 } },
    });
    expect(furnace['observe-calamity'][0]).toMatchObject({
      type: 'shield',
      params: { value: { targetMaxHpRatio: 0.12 } },
    });
    expect(base['five-skandhas'].some((effect) => effect.type === 'heal')).toBe(
      false,
    );
    expect(furnace['five-skandhas']).toContainEqual(
      expect.objectContaining({
        type: 'heal',
        params: expect.objectContaining({
          value: expect.objectContaining({ targetMaxHpRatio: 0.05 }),
        }),
      }),
    );
    expect(base['reed-crossing'][0]).toMatchObject({
      type: 'heal',
      params: { value: { targetMaxHpRatio: 0.05 } },
    });
    expect(furnace['reed-crossing'][0]).toMatchObject({
      type: 'heal',
      params: { value: { targetMaxHpRatio: 0.08 } },
    });
  });

  it('36个节点都产生明确配置差异，且不重新引入已删除的特殊机制', () => {
    const forbidden = [
      'variants',
      'status_transfer',
      'damage_cap',
      'scaleNumericEffectsByLayer',
      'ability_variant_is',
      'ability_mode_ability_differs',
    ];
    const signatures = new Set<string>();
    for (const path of WUXIANG_MODULE.definition.paths) {
      const pathId = path.id as PathId;
      const abilityIds = [
        ...WUXIANG_TECHNIQUE_IDS,
        'turn-form',
        pathId === 'mirror-karma' ? 'mirror-core' : 'demon-core',
      ];
      const compileAll = (nodes: string[]) =>
        abilityIds.map(
          (abilityId) =>
            resolveSectAbility({
              sect: state(pathId, nodes),
              realm: '化神',
              abilityId,
            }).config,
        );
      const baseline = JSON.stringify(compileAll([]));
      for (const node of path.nodes) {
        const serialized = JSON.stringify(compileAll([node.id]));
        expect(
          serialized,
          `${path.name}/${node.name}必须改变战斗投影`,
        ).not.toBe(baseline);
        const signature = `${path.id}:${serialized}`;
        expect(
          signatures.has(signature),
          `${path.name}/${node.name}必须有唯一配置签名`,
        ).toBe(false);
        signatures.add(signature);
        for (const token of forbidden) {
          expect(
            serialized,
            `${path.name}/${node.name}不应包含 ${token}`,
          ).not.toContain(token);
        }
      }

      const representative = path.layers.map(
        (layer) => path.nodes.find((node) => node.layerId === layer.id)!.id,
      );
      expect(() => compileAll(representative)).not.toThrow();

      const sameLayer = path.nodes
        .filter((node) => node.layerId === path.layers[0].id)
        .slice(0, 2)
        .map((node) => node.id);
      expect(() => compileAll(sameLayer)).toThrow(/只能选择一个节点/);
    }
    expect(signatures).toHaveLength(36);
  });
});
