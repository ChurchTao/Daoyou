import { describe, expect, it } from 'vitest';
import { LINGXIAO_MODULE } from '..';
import {
  productionSectRuntime,
  projectSectCombat,
  resolveSectAbility,
} from '../..';
import type { CultivatorSectState } from '../../../core';
import { listUnlockedAbilityIds } from '../../../core';

function state(
  pathId?: 'swift-sword' | 'heavy-sword',
  nodes: string[] = [],
): CultivatorSectState {
  return {
    membershipId: 'm1',
    sectId: 'lingxiao',
    status: 'active',
    contribution: 0,
    configVersion: 4,
    activePathId: pathId,
    methods: {
      'lingxiao-canon': 100,
      'sword-guidance': 100,
      'void-step': 100,
      'edge-cleansing': 100,
      'origin-returning': 100,
      'sword-nurturing': 100,
    },
    paths: pathId
      ? [
          {
            pathId,
            unlockedLayerIds: ['1', '2', '3', '4', '5', 'ultimate'],
            tacticId: pathId === 'swift-sword' ? 'aggressive' : 'heavy-break',
            activeMeridianSlot: 1,
            meridianLoadouts: [
              { slot: 1, nodeIds: nodes, version: 1 },
              { slot: 2, nodeIds: [], version: 1 },
              { slot: 3, nodeIds: [], version: 1 },
            ],
          },
        ]
      : [],
    abilityLoadout: [
      'guiding-sword',
      'linked-edge',
      'breaking-edge',
      'sect-ultimate',
    ],
  };
}

describe('宗门注册投影', () => {
  it('炼气初期心法上限可解锁除绝式外全部基础神通，10级开放剑破万法', () => {
    const early = state();
    early.methods = Object.fromEntries(
      Object.keys(early.methods).map((methodId) => [methodId, 5]),
    );
    expect(listUnlockedAbilityIds(LINGXIAO_MODULE.definition, early)).toHaveLength(8);
    expect(listUnlockedAbilityIds(LINGXIAO_MODULE.definition, early)).not.toContain('sect-ultimate');
    early.methods['lingxiao-canon'] = 10;
    expect(listUnlockedAbilityIds(LINGXIAO_MODULE.definition, early)).toContain('sect-ultimate');
  });

  it('凌霄两条流派各自保持六层且每层三个节点', () => {
    for (const path of LINGXIAO_MODULE.definition.paths) {
      expect(path.layers).toHaveLength(6);
      for (const layer of path.layers) {
        expect(
          path.nodes.filter((node) => node.layerId === layer.id),
        ).toHaveLength(3);
      }
    }
    const swift = LINGXIAO_MODULE.definition.paths.find(
      (path) => path.id === 'swift-sword',
    )!;
    const heavy = LINGXIAO_MODULE.definition.paths.find(
      (path) => path.id === 'heavy-sword',
    )!;
    expect(swift.nodes.find((node) => node.id === 'swift-returning-swallow')?.name).toBe('燕返');
    expect(swift.tactics.find((tactic) => tactic.id === 'counter')?.name).toBe('回燕');
    expect(heavy.nodes.find((node) => node.id === 'heavy-heaven-cleaving')?.name).toBe('开天');
    expect(heavy.tactics.find((tactic) => tactic.id === 'heavy-full')?.name).toBe('极势');
  });

  it('未激活流派使用基础剑势和基础法术', () => {
    const projection = projectSectCombat({ sect: state(), realm: '筑基' })!;
    expect(projection.resources[0]).toMatchObject({
      id: 'sect.lingxiao.sword-momentum',
      name: '剑势',
      icon: '🗡️',
      max: 6,
    });
    expect(projection.defaultAttack?.name).toBe('基础剑式');
  });

  it('快剑道通过统一解析器生成变体与节点效果', () => {
    const sect = state('swift-sword', ['swift-opening', 'swift-split-light']);
    const projection = projectSectCombat({ sect, realm: '化神' })!;
    expect(projection.resources[0]).toMatchObject({
      name: '剑势',
      initial: 2,
      max: 6,
    });
    expect(projection.selectionStrategy).toBeDefined();
    const detail = resolveSectAbility({
      sect,
      realm: '化神',
      abilityId: 'linked-edge',
    });
    expect(detail.name).toBe('剑荡山河');
    expect(detail.summary).toBe('剑锋纵横，如长河奔涌；所过之处，山河亦为之震荡。');
    expect(detail.detailRows).toContain('伤害：7段 × 27%物攻');
    expect(
      projection.abilities.find(
        (ability) => ability.slug === detail.config.slug,
      ),
    ).toEqual(detail.config);
  });

  it('重剑道沿用宗门剑势并生成独立技能变体和策略', () => {
    const sect = state('heavy-sword', ['heavy-opening', 'heavy-triple-ridge']);
    const projection = projectSectCombat({ sect, realm: '化神' })!;
    expect(projection.resources[0]).toMatchObject({
      id: 'sect.lingxiao.sword-momentum',
      name: '剑势',
      initial: 2,
      max: 6,
    });
    expect(projection.selectionStrategy).toBeDefined();
    expect(
      resolveSectAbility({ sect, realm: '化神', abilityId: 'linked-edge' })
        .name,
    ).toBe('剑荡山河');
    expect(
      resolveSectAbility({ sect, realm: '化神', abilityId: 'sect-ultimate' })
        .name,
    ).toBe('剑破万法');
  });

  it('流派基础变体不再随已解锁层数改变倍率', () => {
    for (const pathId of ['swift-sword', 'heavy-sword'] as const) {
      const firstLayer = state(pathId);
      firstLayer.paths[0].unlockedLayerIds = ['1'];
      const allLayers = state(pathId);
      expect(
        productionSectRuntime.compiler.compile(LINGXIAO_MODULE, {
          sect: firstLayer,
          realm: '化神',
        }),
      ).toEqual(
        productionSectRuntime.compiler.compile(LINGXIAO_MODULE, {
          sect: allLayers,
          realm: '化神',
        }),
      );
    }
  });

  it.each(['swift-sword', 'heavy-sword'] as const)(
    '%s 的729套六层经脉组合全部通过最终编译与能力契约校验',
    (pathId) => {
      const path = LINGXIAO_MODULE.definition.paths.find(
        (entry) => entry.id === pathId,
      )!;
      const layers = [...path.layers].sort((a, b) => a.order - b.order);
      const choices = layers.map((layer) =>
        path.nodes.filter((node) => node.layerId === layer.id),
      );
      let compiledCount = 0;
      const compile = (layerIndex: number, nodeIds: string[]): void => {
        if (layerIndex === choices.length) {
          const compiled = productionSectRuntime.compiler.compile(LINGXIAO_MODULE, {
            sect: state(pathId, nodeIds),
            realm: '渡劫',
          });
          for (const ability of Object.values(compiled.abilities)) {
            expect(ability.detailRows.join('；')).not.toMatch(
              /sect\.|Status\.|Ability\.|GameplayTag/,
            );
          }
          compiledCount += 1;
          return;
        }
        for (const node of choices[layerIndex]) {
          compile(layerIndex + 1, [...nodeIds, node.id]);
        }
      };
      compile(0, []);
      expect(compiledCount).toBe(729);
    },
    30_000,
  );

  it('最终神通事实正确合并节点倍率、门槛与跨神通被动', () => {
    const shadow = resolveSectAbility({
      sect: state('swift-sword', ['swift-shadow-line']),
      realm: '化神',
      abilityId: 'sect-ultimate',
    });
    expect(shadow.cooldown).toBe(5);
    expect(shadow.detailRows).toContain('释放：至少6点剑势');
    expect(shadow.detailRows).toContain('暴击：整次施法全部伤害段必定暴击');

    const returningPeak = resolveSectAbility({
      sect: state('heavy-sword', ['heavy-steady-mountain']),
      realm: '化神',
      abilityId: 'sect-ultimate',
    });
    expect(returningPeak.detailRows).toEqual(expect.arrayContaining([
      '伤害：基础相当于102%物攻，每点剑势增加34%物攻',
      '剑势：返还2点',
      '护盾：相当于60%物攻',
    ]));

    const returningHeaven = resolveSectAbility({
      sect: state('heavy-sword', [
        'heavy-steady-mountain',
        'heavy-heaven-cleaving',
      ]),
      realm: '化神',
      abilityId: 'sect-ultimate',
    });
    expect(returningHeaven.detailRows).toContain('6点剑势时总倍率：340%物攻');
    expect(returningHeaven.detailRows).not.toContain('6点剑势时总倍率：400%物攻');

    const mountainBreaking = resolveSectAbility({
      sect: state('swift-sword', ['swift-mountain-breaking']),
      realm: '化神',
      abilityId: 'sect-ultimate',
    });
    expect(mountainBreaking.detailRows).toEqual(expect.arrayContaining([
      '状态：消耗全部剑痕',
      '每层追加：相当于18%物攻',
    ]));

    const passiveFacts = resolveSectAbility({
      sect: state('swift-sword', [
        'swift-life-chasing',
        'swift-still-tide',
        'swift-endless-flow',
      ]),
      realm: '化神',
      abilityId: 'sect-ultimate',
    }).detailRows.join('；');
    expect(passiveFacts).toContain('经脉·追命');
    expect(passiveFacts).toContain('经脉·静潮');
    expect(passiveFacts).toContain('经脉·无间');
  });

  it.each([undefined, 'swift-sword', 'heavy-sword'] as const)(
    '%s 始终使用九个统一神通名称与固定摘要',
    (pathId) => {
      const sect = state(pathId);
      for (const definition of LINGXIAO_MODULE.definition.abilities) {
        const detail = resolveSectAbility({
          sect,
          realm: '化神',
          abilityId: definition.id,
        });
        expect(detail.name).toBe(definition.baseName);
        expect(detail.summary).toBe(definition.description);
      }
    },
  );

  it.each(['swift-sword', 'heavy-sword'] as const)(
    '%s 使用统一的神通姿态与增益名称',
    (pathId) => {
      const sect = state(pathId);
      const expectedBuffNames = {
        'turning-body': '藏锋听雷',
        'shadow-step': '踏雪无痕',
        'sword-aegis': '剑心通明',
        'nurturing-sword': '人剑合一',
      } as const;
      for (const [abilityId, buffName] of Object.entries(expectedBuffNames)) {
        const config = resolveSectAbility({
          sect,
          realm: '化神',
          abilityId,
        }).config;
        const buff = [...(config.effects ?? []), ...(config.castEffects ?? [])]
          .find((effect) => effect.type === 'apply_buff');
        expect(buff?.type === 'apply_buff' ? buff.params.buffConfig.name : undefined)
          .toBe(buffName);
      }
    },
  );

  it.each([undefined, 'heavy-sword'] as const)(
    '%s 的藏锋听雷后发攻击统一名为听雷',
    (pathId) => {
      const config = resolveSectAbility({
        sect: state(pathId),
        realm: '化神',
        abilityId: 'turning-body',
      }).config;
      const queued = config.castEffects?.find(
        (effect) => effect.type === 'queue_action',
      );
      expect(queued?.type === 'queue_action' ? queued.params.name : undefined)
        .toBe('听雷');
    },
  );
});
