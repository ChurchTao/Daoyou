import { describe, expect, it } from 'vitest';
import { LINGXIAO_V6_DEFINITION as definition } from './lingxiao';
import { COMBAT_V6_SECT_DEFINITIONS } from './index';
import { canSelectMeridianNode, connectedMeridianSelection, meridianNodesConnect, toggleMeridianNode } from './meridian-selection';
import { createEmptySectCombatProgressV6 } from '../build-state';
import { compileSectDefinitionV6 } from './compiler';
import { sectV6Change } from '../sect-progression';

const ref = { membershipId: '00000000-0000-4000-8000-000000000001', expectedRevision: 0 };
describe('全宗门统一末层结构', () => {
  for (const sect of Object.values(COMBAT_V6_SECT_DEFINITIONS)) {
    for (const path of sect.paths) {
      it(`${sect.name}·${path.name}仅末层中间可选，两侧解锁后自动获得`, () => {
        const rewards = path.nodes.filter(n => n.automatic);
        expect(rewards.map(n => [n.layer, n.slot]).sort()).toEqual([[7, 1], [7, 3]]);
        expect(path.nodes.filter(n => !n.automatic)).toHaveLength(19);
        const center = path.nodes.find(n => n.layer === 7 && n.slot === 2)!;
        for (const parent of path.nodes.filter(n => n.layer === 6)) {
          expect(meridianNodesConnect(parent, center)).toBe(true);
          expect(canSelectMeridianNode(path, [parent.id], center)).toBe(true);
          for (const reward of rewards) {
            expect(meridianNodesConnect(parent, reward)).toBe(false);
            expect(canSelectMeridianNode(path, [parent.id], reward)).toBe(false);
          }
        }
        const progress = createEmptySectCombatProgressV6(sect.id, path.id, Object.fromEntries(sect.methods.map(m => [m.id, 180])));
        progress.meridianDepth = 6;
        const before = compileSectDefinitionV6({ definition: sect, progress, characterLevel: 180 });
        progress.meridianDepth = 7;
        const after = compileSectDefinitionV6({ definition: sect, progress, characterLevel: 180 });
        expect(before.ok).toBe(true);
        expect(after.ok).toBe(true);
        if (!before.ok || !after.ok) return;
        expect(after.projection.panel).toEqual([
          ...before.projection.panel, ...rewards.flatMap(n => n.panel ?? []),
        ]);
        expect(after.projection.passiveSkillIds).toEqual([
          ...before.projection.passiveSkillIds,
          ...rewards.flatMap(n => (n.passives ?? []).map(s => s.definition.id)),
        ]);
        for (const passive of center.passives ?? [])
          expect(after.projection.passiveSkillIds).not.toContain(passive.definition.id);
        for (const skill of center.grantSkills ?? [])
          expect(after.projection.activeSkillIds).not.toContain(skill.definition.id);
      });
    }
  }
  it.each([[1, 1], [7, 1], [7, 2], [7, 3]])('共用编译器拒绝第 %i 层第 %i 列违反自动奖励规则', (layer, slot) => {
    const invalid = structuredClone(COMBAT_V6_SECT_DEFINITIONS.tianyan);
    const path = invalid.paths[0];
    const node = path.nodes.find(n => n.layer === layer && n.slot === slot)!;
    node.automatic = !node.automatic;
    const progress = createEmptySectCombatProgressV6(invalid.id, path.id, Object.fromEntries(invalid.methods.map(m => [m.id, 180])));
    const result = compileSectDefinitionV6({ definition: invalid, progress, characterLevel: 180 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'INVALID_MERIDIAN_LOADOUT', message: expect.stringContaining('所有流派统一') }),
    ]));
  });
});

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
