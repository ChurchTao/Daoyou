import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import raw from './data/lingxiao-paths.json';
import schema from './data/lingxiao-paths.schema.json';
import { LingxiaoPathsPackShape, loadLingxiaoPathsPack, compileLingxiaoPaths } from './lingxiao-path-pack';
import { LINGXIAO_V6_DEFINITION } from './lingxiao';
import { compileSectDefinitionV6 } from './compiler';
import type { SectCombatProgressV6, SectDefinitionV6 } from './types';

function compile(definition: SectDefinitionV6, pathIndex: number, nodeId: string) {
  const progress: SectCombatProgressV6 = {
    version: 1, sectId: 'lingxiao', activePathId: definition.paths[pathIndex].id, meridianDepth: 7,
    methods: Object.fromEntries(definition.methods.map(m => [m.id, 180])),
    meridianLoadouts: definition.paths.map((p, i) => ({ pathId: p.id, nodeIds: i === pathIndex ? [nodeId] : [], revision: 0 })) as SectCombatProgressV6['meridianLoadouts'],
  };
  return compileSectDefinitionV6({ definition, progress, characterLevel: 180 });
}
describe('红尘剑宗完整流派配置', () => {
  it('Schema 同步', () => expect(z.toJSONSchema(LingxiaoPathsPackShape)).toEqual(schema));
  it('全部 42 节点可编译', () => {
    for (const [i, path] of LINGXIAO_V6_DEFINITION.paths.entries())
      for (const node of path.nodes) expect(compile(LINGXIAO_V6_DEFINITION, i, node.id).ok).toBe(true);
  });
  it('追加第四段保留原意，配置修改进入技能补丁', () => {
    const data = JSON.parse(JSON.stringify(raw));
    const node = data.paths[0].nodes.find((n: { patches?: { operation: string; hitIndex?: number }[] }) => n.patches?.some(p => p.operation === 'addPhysicalCoefficient' && p.hitIndex === 3));
    node.patches[0].value = 1.2;
    const definition = { ...LINGXIAO_V6_DEFINITION, paths: compileLingxiaoPaths(loadLingxiaoPathsPack(data)) };
    const result = compile(definition, 0, node.id);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const skill = result.projection.skillOverrides.find(s => s.id === 'lingxiao.skill.triple');
      expect(skill?.effects[0]).toMatchObject({ hits: 4, coeff: [0.75, 0.85, 0.95, 1.2] });
    }
  });
  it('拒绝重复槽位、缺失资源与非法伤害段间隙', () => {
    const duplicate = structuredClone(raw);
    duplicate.paths[0].nodes[1].slot = 1;
    expect(() => loadLingxiaoPathsPack(duplicate)).toThrow('层级槽位重复');
    const missing = JSON.parse(JSON.stringify(raw));
    missing.paths[1].resources = ['lingxiao.resource.missing'];
    expect(() => loadLingxiaoPathsPack(missing)).toThrow('引用不存在');
    const gap = JSON.parse(JSON.stringify(raw));
    const node = gap.paths[0].nodes.find((n: { patches?: { operation: string }[] }) => n.patches?.some(p => p.operation === 'addPhysicalCoefficient'));
    node.patches[0].hitIndex = 99;
    expect(() => loadLingxiaoPathsPack(gap)).toThrow('紧接着追加');
  });
});
