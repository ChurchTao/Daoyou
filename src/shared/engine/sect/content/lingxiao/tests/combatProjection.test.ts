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
  it('炼气初期心法上限可解锁除绝式外全部基础神通，10级开放万剑归一', () => {
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
  });

  it('未激活流派使用基础剑势和基础法术', () => {
    const projection = projectSectCombat({ sect: state(), realm: '筑基' })!;
    expect(projection.resources[0]).toMatchObject({ id: 'sect.lingxiao.sword-momentum', name: '剑势', max: 6 });
    expect(projection.defaultAttack?.name).toBe('问锋');
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
    expect(detail.name).toBe('分光七叠');
    expect(detail.summary).toContain('7段 × 0.27');
    expect(detail.detailRows).toContain('伤害：7段 × 0.27物攻');
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
    ).toBe('一剑沉山');
    expect(
      resolveSectAbility({ sect, realm: '化神', abilityId: 'sect-ultimate' })
        .name,
    ).toBe('开天一线');
  });

  it('快剑与重剑的三十六个节点都产生可观察的独立编译结果', () => {
    for (const path of LINGXIAO_MODULE.definition.paths) {
      const pathId = path.id as 'swift-sword' | 'heavy-sword';
      const baseline = JSON.stringify(
        productionSectRuntime.compiler.compile(LINGXIAO_MODULE, {
          sect: state(pathId),
          realm: '化神',
        }),
      );
      for (const node of path.nodes) {
        const compiled = productionSectRuntime.compiler.compile(
          LINGXIAO_MODULE,
          { sect: state(pathId, [node.id]), realm: '化神' },
        );
        expect(JSON.stringify(compiled), node.id).not.toBe(baseline);
      }
    }
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

  it.each([
    [
      'swift-sword',
      {
        'plain-sword': '流光问锋',
        'guiding-sword': '追风引',
        'linked-edge': '流光五叠',
        'turning-body': '回燕',
        'breaking-edge': '一线破妄',
        'sword-aegis': '流风护心',
        'shadow-step': '无痕步',
        'sect-ultimate': '刹那无痕',
        'nurturing-sword': '剑走轻灵',
      },
    ],
    [
      'heavy-sword',
      {
        'plain-sword': '负岳问锋',
        'guiding-sword': '擎岳引',
        'linked-edge': '一剑沉山',
        'turning-body': '不动藏锋',
        'breaking-edge': '撼山破障',
        'sword-aegis': '山河守心',
        'shadow-step': '镇岳步',
        'sect-ultimate': '开天一线',
        'nurturing-sword': '重意无锋',
      },
    ],
  ] as const)('%s 独立编译九个稳定基础法术变体', (pathId, expectedNames) => {
    const sect = state(pathId);
    for (const [abilityId, name] of Object.entries(expectedNames)) {
      expect(resolveSectAbility({ sect, realm: '化神', abilityId }).name).toBe(
        name,
      );
    }
  });
});
