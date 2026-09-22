import { describe, expect, it } from 'vitest';
import { LINGXIAO_V6_DEFINITION as definition } from './lingxiao';
import { COMBAT_V6_SECT_DEFINITIONS } from './index';
import { canSelectMeridianNode, connectedMeridianSelection, meridianNodesConnect, toggleMeridianNode } from './meridian-selection';
import { createEmptySectCombatProgressV6 } from '../build-state';
import { compileSectDefinitionV6 } from './compiler';
import { sectV6Change } from '../sect-progression';

const ref = { membershipId: '00000000-0000-4000-8000-000000000001', expectedRevision: 0 };
describe('红尘经脉连通选择', () => {
  for (const path of definition.paths) {
    const node = (layer: number, slot: number) => path.nodes.find(n => n.layer === layer && n.slot === slot)!;
    const ids = (...positions: [number, number][]) => positions.map(([l, s]) => node(l, s).id);
    function progress() {
      const p = createEmptySectCombatProgressV6('lingxiao', path.id, Object.fromEntries(definition.methods.map(m => [m.id, 180])));
      p.meridianDepth = 7; return p;
    }
    it(`${path.name}只连接相邻层同列或相邻列，自动奖励不参与`, () => {
      expect(meridianNodesConnect(node(1, 1), node(2, 1))).toBe(true);
      expect(meridianNodesConnect(node(1, 1), node(2, 2))).toBe(true);
      expect(meridianNodesConnect(node(1, 1), node(2, 3))).toBe(false);
      expect(meridianNodesConnect(node(1, 1), node(3, 1))).toBe(false);
      expect(meridianNodesConnect(node(6, 1), node(7, 1))).toBe(false);
      expect(canSelectMeridianNode(path, [], node(2, 2))).toBe(false);
    });
    it(`${path.name}前层改选仅清除断开后缀，取消前层会连带清除`, () => {
      const selected = ids([1, 1], [2, 1], [3, 2], [4, 3]);
      expect(toggleMeridianNode(path, selected, node(1, 2))).toEqual(ids([1, 2], [2, 1], [3, 2], [4, 3]));
      expect(toggleMeridianNode(path, selected, node(1, 3))).toEqual(ids([1, 3]));
      expect(toggleMeridianNode(path, selected, node(2, 1))).toEqual(ids([1, 1]));
      expect(toggleMeridianNode(path, ids([1, 1]), node(2, 3))).toEqual(ids([1, 1]));
    });
    it(`${path.name}保存拒绝跨列及跳层，兼容无序合法选择`, () => {
      const save = (nodeIds: string[]) => sectV6Change(progress(), 180, { ...ref, action: 'save', pathId: path.id, nodeIds });
      expect(() => save(ids([1, 1], [2, 3]))).toThrow('连通');
      expect(() => save(ids([1, 1], [3, 2]))).toThrow('连通');
      const selected = ids([1, 1], [2, 2], [3, 3]);
      expect(save([...selected].reverse()).progress.meridianLoadouts.find(l => l.pathId === path.id)!.nodeIds).toEqual(selected);
    });
    it(`${path.name}旧方案仅保留合法前缀，末端奖励保持自动发放`, () => {
      const p = progress();
      p.meridianLoadouts.find(l => l.pathId === path.id)!.nodeIds = ids([1, 1], [2, 3], [3, 3]);
      const result = compileSectDefinitionV6({ definition, progress: p, characterLevel: 180 });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.projection.diagnostics.some(d => d.code === 'MERIDIAN_CONNECTION_INCOMPLETE')).toBe(true);
      expect(result.projection.passiveSkillIds).not.toContain(node(3, 3).passives![0].definition.id);
      const chain = ids([1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [7, 1]);
      expect(connectedMeridianSelection(path, chain).at(-1)).toBe(node(7, 2).id);
      expect(result.projection.panel.filter(p => p.value === (path.id.endsWith('guiyi') ? 280 : 40))).toHaveLength(2);
    });
  }
  it('幽都也要求沿相邻列逐层连通', () => {
    const path = COMBAT_V6_SECT_DEFINITIONS.youdu.paths[0];
    const node = path.nodes.find(n => n.layer === 3)!;
    expect(canSelectMeridianNode(path, [], node)).toBe(false);
    expect(connectedMeridianSelection(path, [node.id])).toEqual([]);
  });
});
