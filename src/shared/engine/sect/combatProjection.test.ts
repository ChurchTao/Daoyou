import { describe, expect, it } from 'vitest';
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
});
