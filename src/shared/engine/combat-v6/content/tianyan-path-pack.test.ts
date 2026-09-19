import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import raw from './data/tianyan-paths.json';
import schema from './data/tianyan-paths.schema.json';
import { TianyanPathsShape, loadTianyanPaths, compileTianyanPaths } from './tianyan-path-pack';
import { TIANYAN_V6_DEFINITION } from './tianyan';
import { TIANYAN_FOUNDATION } from './tianyan-foundation';
import { compileSectDefinitionV6 } from './compiler';
import type { SectCombatProgressV6, SectDefinitionV6 } from './types';
import { EffectType } from '../core';

function compile(definition: SectDefinitionV6, pathIndex: number, nodeId: string) {
  const progress: SectCombatProgressV6 = {
    version: 1, sectId: 'tianyan', activePathId: definition.paths[pathIndex].id, meridianDepth: 7,
    methods: Object.fromEntries(definition.methods.map(m => [m.id, 180])),
    meridianLoadouts: definition.paths.map((p, i) => ({ pathId: p.id, nodeIds: i === pathIndex ? [nodeId] : [], revision: 0 })) as SectCombatProgressV6['meridianLoadouts'],
  };
  return compileSectDefinitionV6({ definition, progress, characterLevel: 180 });
}
describe('天衍流派配置', () => {
  it('Schema 同步', () => expect(z.toJSONSchema(TianyanPathsShape, { reused: 'ref' })).toEqual(schema));
  it('42 节点均可编译', () => {
    for (const [i, path] of TIANYAN_V6_DEFINITION.paths.entries())
      for (const node of path.nodes) expect(compile(TIANYAN_V6_DEFINITION, i, node.id).ok).toBe(true);
  });
  it('反应配方按反应表展开，修改威力进入实际编译技能', () => {
    const data = JSON.parse(JSON.stringify(raw));
    data.paths[0].nodes.find((n: { id: string }) => n.id === 'tianyan.node.hetu.2.1').patches[0].effect.power = 1234;
    const paths = compileTianyanPaths(loadTianyanPaths(data));
    const patches = paths[0].nodes.find(n => n.id === 'tianyan.node.hetu.2.1')!.patches!;
    expect(patches).toHaveLength(5);
    const reactions = TIANYAN_FOUNDATION.reactions.filter(r => r.kind === 'generate');
    reactions.forEach((r, i) => expect(patches[i]).toMatchObject({
      skillId: TIANYAN_FOUNDATION.elements.find(e => e.element === r.newElement)!.skillId,
      effect: { power: 1234, when: { primaryTargetStatusIds: [TIANYAN_FOUNDATION.elements.find(e => e.element === r.oldElement)!.markId] } },
    }));
    const result = compile({ ...TIANYAN_V6_DEFINITION, paths }, 0, 'tianyan.node.hetu.2.1');
    expect(result.ok).toBe(true);
    if (result.ok) for (const mapping of TIANYAN_FOUNDATION.elements) {
      const skill = result.projection.skillOverrides.find(s => s.id === mapping.skillId)!;
      expect(skill.effects[skill.effects.length - 1]).toMatchObject({ type: EffectType.Heal, power: 1234 });
    }
  });
  it('统一护盾时长只展开已配置的目标清单', () => {
    const data = JSON.parse(JSON.stringify(raw));
    data.paths[0].nodes.find((n: { id: string }) => n.id === 'tianyan.node.hetu.6.2').patches[0].value = 4;
    const paths = compileTianyanPaths(loadTianyanPaths(data));
    const patches = paths[0].nodes.find(n => n.id === 'tianyan.node.hetu.6.2')!.patches!;
    expect(patches).toEqual(raw.barrierDurationTargets.map(t => ({ skillId: t.skillId, operation: 'setBarrierDuration', barrierId: t.barrierId, value: 4 })));
  });
  it('拒绝槽位重复、缺失引用和非法反应表达式', () => {
    const duplicate = structuredClone(raw);
    duplicate.paths[0].nodes[1].slot = 1;
    expect(() => loadTianyanPaths(duplicate)).toThrow('层级槽位重复');
    const missing = structuredClone(raw);
    missing.barrierDurationTargets[0].barrierId = 'tianyan.barrier.missing';
    expect(() => loadTianyanPaths(missing)).toThrow('引用不存在');
    const formula = JSON.parse(JSON.stringify(raw));
    formula.paths[0].nodes.find((n: { id: string }) => n.id === 'tianyan.node.hetu.2.1').patches[0].effect.power = 'floor(';
    expect(() => loadTianyanPaths(formula)).toThrow('power');
  });
});
