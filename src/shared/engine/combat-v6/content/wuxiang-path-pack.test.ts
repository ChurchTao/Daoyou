import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import raw from './data/wuxiang-paths.json';
import schema from './data/wuxiang-paths.schema.json';
import { WuxiangPathsPackShape, loadWuxiangPathsPack, compileWuxiangPaths } from './wuxiang-path-pack';
import { WUXIANG_V6_DEFINITION } from './wuxiang';
import { compileSectDefinitionV6 } from './compiler';
import type { SectCombatProgressV6, SectDefinitionV6 } from './types';

function compile(definition: SectDefinitionV6, pathIndex: number, nodeId: string) {
  const progress: SectCombatProgressV6 = {
    version: 1, sectId: 'wuxiang', activePathId: definition.paths[pathIndex].id, meridianDepth: 7,
    methods: Object.fromEntries(definition.methods.map(m => [m.id, 180])),
    meridianLoadouts: definition.paths.map((p, i) => ({ pathId: p.id, nodeIds: i === pathIndex ? [nodeId] : [], revision: 0 })) as SectCombatProgressV6['meridianLoadouts'],
  };
  return compileSectDefinitionV6({ definition, progress, characterLevel: 180 });
}
describe('无相完整流派配置', () => {
  it('Schema 同步，重复结构使用引用', () => expect(z.toJSONSchema(WuxiangPathsPackShape, { reused: 'ref' })).toEqual(schema));
  it('42 节点均可编译', () => {
    for (const [i, path] of WUXIANG_V6_DEFINITION.paths.entries())
      for (const node of path.nodes) expect(compile(WUXIANG_V6_DEFINITION, i, node.id).ok).toBe(true);
  });
  it('改变流派复活比例仅修改匹配状态的复活分支', () => {
    const data = JSON.parse(JSON.stringify(raw));
    data.paths[0].patches[0].value = 0.45;
    const definition = { ...WUXIANG_V6_DEFINITION, paths: compileWuxiangPaths(loadWuxiangPathsPack(data)) };
    const result = compile(definition, 0, definition.paths[0].nodes[0].id);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const skill = result.projection.skillOverrides.find(s => s.id === 'wuxiang.skill.revive');
      expect(skill?.effects[0]).toMatchObject({ type: 'revive', hpRatio: 0.2 });
      expect(skill?.effects[1]).toMatchObject({ type: 'revive', hpRatio: 0.45 });
    }
  });
  it('拒绝重复槽位、缺失护盾及无效表达式', () => {
    const duplicate = structuredClone(raw);
    duplicate.paths[0].nodes[1].slot = 1;
    expect(() => loadWuxiangPathsPack(duplicate)).toThrow('层级槽位重复');
    const barrier = JSON.parse(JSON.stringify(raw));
    const node = barrier.paths[0].nodes.find((n: { patches?: { operation: string }[] }) => n.patches?.some(p => p.operation === 'setBarrierDuration'));
    node.patches[0].barrierId = 'wuxiang.barrier.missing';
    expect(() => loadWuxiangPathsPack(barrier)).toThrow('引用不存在');
    const formula = JSON.parse(JSON.stringify(raw));
    const passive = formula.passives.find((p: { hooks: { effects: { type: string }[] }[] }) => p.hooks.some(h => h.effects.some(e => e.type === 'restoreHp')));
    passive.hooks[0].effects[0].maxGainPerAction = 'floor(';
    expect(() => loadWuxiangPathsPack(formula)).toThrow('maxGainPerAction');
  });
});
