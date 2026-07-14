import { describe, expect, it } from 'vitest';
import { productionSectRuntime } from './catalog';
import { LINGXIAO_MODULE } from './lingxiaoModule';
import { projectSectCombat, resolveSectAbility } from './runtime';
import type { CultivatorSectState } from './types';

function state(pathId?: 'swift-sword' | 'heavy-sword', nodes: string[] = []): CultivatorSectState {
  return {
    membershipId: 'm1', sectId: 'lingxiao', status: 'active', contribution: 0, configVersion: 2,
    activePathId: pathId,
    methods: { 'lingxiao-canon': 100, 'sword-guidance': 100, 'void-step': 100, 'edge-cleansing': 100, 'origin-returning': 100, 'sword-nurturing': 100 },
    paths: pathId ? [{ pathId, level: 100, tacticId: pathId === 'swift-sword' ? 'aggressive' : 'heavy-break', activeMeridianSlot: 1, meridianLoadouts: [{ slot: 1, nodeIds: nodes, version: 1 }, { slot: 2, nodeIds: [], version: 1 }, { slot: 3, nodeIds: [], version: 1 }] }] : [],
    abilityLoadout: ['guiding-sword', 'linked-edge', 'breaking-edge', 'sect-ultimate'],
  };
}

describe('宗门注册投影', () => {
  it('未激活流派使用基础剑势和基础法术', () => {
    const projection = projectSectCombat({ sect: state(), realm: '筑基' })!;
    expect(projection.resources[0]).toMatchObject({ name: '剑势', max: 3 });
    expect(projection.defaultAttack?.name).toBe('平剑式');
  });

  it('快剑道通过统一解析器生成变体与节点效果', () => {
    const sect = state('swift-sword', ['swift-opening', 'swift-split-light']);
    const projection = projectSectCombat({ sect, realm: '化神' })!;
    expect(projection.resources[0]).toMatchObject({ name: '剑势', initial: 2, max: 6 });
    expect(projection.selectionStrategy).toBeDefined();
    const detail = resolveSectAbility({ sect, realm: '化神', abilityId: 'linked-edge' });
    expect(detail.name).toBe('分光五叠');
    expect(detail.detailRows).toContain('伤害：5段 × 0.27物攻');
  });

  it('重剑道拥有独立资源、技能变体和策略', () => {
    const sect = state('heavy-sword', ['heavy-opening', 'heavy-triple-ridge']);
    const projection = projectSectCombat({ sect, realm: '化神' })!;
    expect(projection.resources[0]).toMatchObject({ name: '剑架', initial: 2, max: 6 });
    expect(projection.selectionStrategy).toBeDefined();
    expect(resolveSectAbility({ sect, realm: '化神', abilityId: 'linked-edge' }).name).toBe('叠山式');
    expect(resolveSectAbility({ sect, realm: '化神', abilityId: 'sect-ultimate' }).name).toBe('开天断岳');
  });

  it('快剑与重剑的三十六个节点都产生可观察的独立编译结果', () => {
    for (const path of LINGXIAO_MODULE.definition.paths) {
      const pathId = path.id as 'swift-sword' | 'heavy-sword';
      const baseline = JSON.stringify(productionSectRuntime.compiler.compile(
        LINGXIAO_MODULE,
        { sect: state(pathId), realm: '化神' },
      ));
      for (const node of path.nodes) {
        const compiled = productionSectRuntime.compiler.compile(
          LINGXIAO_MODULE,
          { sect: state(pathId, [node.id]), realm: '化神' },
        );
        expect(JSON.stringify(compiled), node.id).not.toBe(baseline);
      }
    }
  });

  it.each([
    ['swift-sword', {
      'plain-sword': '平剑式', 'guiding-sword': '追风式', 'linked-edge': '流光三叠',
      'turning-body': '回燕式', 'breaking-edge': '一线天', 'sword-aegis': '剑罡护体',
      'shadow-step': '踏影', 'sect-ultimate': '刹那无痕', 'nurturing-sword': '剑息养锋',
    }],
    ['heavy-sword', {
      'plain-sword': '沉锋式', 'guiding-sword': '提岳式', 'linked-edge': '叠山式',
      'turning-body': '横岳式', 'breaking-edge': '破岳式', 'sword-aegis': '镇山剑罡',
      'shadow-step': '踏岳式', 'sect-ultimate': '开天断岳', 'nurturing-sword': '抱剑养锋',
    }],
  ] as const)('%s 独立编译九个稳定基础法术变体', (pathId, expectedNames) => {
    const sect = state(pathId);
    for (const [abilityId, name] of Object.entries(expectedNames)) {
      expect(resolveSectAbility({ sect, realm: '化神', abilityId }).name).toBe(name);
    }
  });
});
