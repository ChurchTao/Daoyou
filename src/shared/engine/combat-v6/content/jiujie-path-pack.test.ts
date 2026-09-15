import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import raw from './data/jiujie-paths.json';
import schema from './data/jiujie-paths.schema.json';
import { JiujiePathsShape, loadJiujiePaths, compileJiujiePaths } from './jiujie-path-pack';
import { JIUJIE_V6_DEFINITION } from './jiujie';
import { compileSectDefinitionV6 } from './compiler';
import type { SectCombatProgressV6, SectDefinitionV6 } from './types';
import { EffectType } from '../core';

function compile(definition: SectDefinitionV6, pathIndex: number, nodeId: string) {
  const progress: SectCombatProgressV6 = {
    version: 1, sectId: 'jiujie', activePathId: definition.paths[pathIndex].id, meridianDepth: 7,
    methods: Object.fromEntries(definition.methods.map(m => [m.id, 180])),
    meridianLoadouts: definition.paths.map((p, i) => ({ pathId: p.id, nodeIds: i === pathIndex ? [nodeId] : [], revision: 0 })) as SectCombatProgressV6['meridianLoadouts'],
  };
  return compileSectDefinitionV6({ definition, progress, characterLevel: 180 });
}
describe('九劫流派配置', () => {
  it('Schema 同步', () => expect(z.toJSONSchema(JiujiePathsShape, { reused: 'ref' })).toEqual(schema));
  it('42 节点均可编译', () => {
    for (const [i, path] of JIUJIE_V6_DEFINITION.paths.entries())
      for (const node of path.nodes) expect(compile(JIUJIE_V6_DEFINITION, i, node.id).ok).toBe(true);
  });
  it('节点概率只改对应五雷分支', () => {
    const data = JSON.parse(JSON.stringify(raw));
    data.paths[0].nodes.find((n: { id: string }) => n.id === 'jiujie.node.law.5.1').patches[0].value = 0.8;
    const definition = { ...JIUJIE_V6_DEFINITION, paths: compileJiujiePaths(loadJiujiePaths(data)) };
    const result = compile(definition, 0, 'jiujie.node.law.5.1');
    expect(result.ok).toBe(true);
    if (result.ok) {
      const skill = result.projection.skillOverrides.find(s => s.id === 'jiujie.skill.five_thunder')!;
      expect(skill.effects[0]).toMatchObject({ type: EffectType.RandomBranch, chance: 0.5 });
      expect(skill.effects[1]).toMatchObject({ type: EffectType.RandomBranch, chance: 0.8 });
    }
  });
  it('拒绝缺失分支、超上限电芒条件与被动表达式错误', () => {
    const missing = JSON.parse(JSON.stringify(raw));
    missing.paths[0].nodes.find((n: { id: string }) => n.id === 'jiujie.node.law.5.1').patches[0].branchId = 'jiujie.branch.missing';
    expect(() => loadJiujiePaths(missing)).toThrow('概率分支不存在');
    const stack = JSON.parse(JSON.stringify(raw));
    stack.passives.find((p: { id: string }) => p.id === 'jiujie.passive.thunder.l2s1').hooks[0].when.targetStatusStack.min = 4;
    expect(() => loadJiujiePaths(stack)).toThrow('状态层数条件无效');
    const formula = JSON.parse(JSON.stringify(raw));
    formula.passives.find((p: { id: string }) => p.id === 'jiujie.passive.thunder.l2s1').hooks[0].effects[0].factor = 'unknown * 0.1';
    expect(() => loadJiujiePaths(formula)).toThrow('factor');
  });
});
