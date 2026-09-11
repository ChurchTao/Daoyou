import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import raw from './data/youdu-paths.json';
import schema from './data/youdu-paths.schema.json';
import { YouduPathsPackShape, loadYouduPathsPack, compileYouduPaths } from './youdu-path-pack';
import { YOUDU_V6_DEFINITION } from './youdu';
import { compileSectDefinitionV6 } from './compiler';
import type { SectCombatProgressV6 } from './types';

describe('幽都完整流派配置', () => {
  it('Schema 与编辑器同步', () => expect(z.toJSONSchema(YouduPathsPackShape)).toEqual(schema));
  it('拒绝重复槽位、缺失引用、非法表达式', () => {
    const duplicate = structuredClone(raw);
    duplicate.paths[0].nodes[1].slot = 1;
    expect(() => loadYouduPathsPack(duplicate)).toThrow('层级槽位重复');
    const missing = structuredClone(raw);
    missing.paths[0].foundationPassives = ['youdu.passive.missing'];
    expect(() => loadYouduPathsPack(missing)).toThrow('引用不存在');
    const expression = JSON.parse(JSON.stringify(raw));
    expression.paths[0].nodes[9].patches[0].value = 'floor(';
    expect(() => loadYouduPathsPack(expression)).toThrow('value');
  });
  it('全部 42 节点在满级进度下可编译', () => {
    const paths = compileYouduPaths(loadYouduPathsPack(raw));
    const definition = { ...YOUDU_V6_DEFINITION, paths };
    for (const path of paths) for (const node of path.nodes) {
      const progress: SectCombatProgressV6 = {
        version: 1, sectId: 'youdu', activePathId: path.id, meridianDepth: 7,
        methods: Object.fromEntries(definition.methods.map(m => [m.id, 180])),
        meridianLoadouts: paths.map(p => ({ pathId: p.id, nodeIds: p.id === path.id ? [node.id] : [], revision: 0 })) as SectCombatProgressV6['meridianLoadouts'],
      };
      expect(compileSectDefinitionV6({ definition, progress, characterLevel: 180 }).ok).toBe(true);
    }
  });
  it('伤害段索引允许紧接追加一段并拒绝空缺段', () => {
    const data = structuredClone(raw);
    const patch = data.paths[1].nodes[0].patches![0];
    patch.hitIndex = 1;
    const paths = compileYouduPaths(loadYouduPathsPack(data));
    const definition = { ...YOUDU_V6_DEFINITION, paths };
    const progress: SectCombatProgressV6 = {
      version: 1, sectId: 'youdu', activePathId: paths[1].id, meridianDepth: 7,
      methods: Object.fromEntries(definition.methods.map(m => [m.id, 180])),
      meridianLoadouts: [{ pathId: paths[0].id, nodeIds: [], revision: 0 }, { pathId: paths[1].id, nodeIds: [paths[1].nodes[0].id], revision: 0 }],
    };
    const result = compileSectDefinitionV6({ definition, progress, characterLevel: 180 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const effect = result.projection.skills.find(s => s.id === patch.skillId)?.effects.find(e => e.type === 'physicalHit');
      expect(effect).toMatchObject({ hits: 2, coeff: [1, 0.1] });
    }
    patch.hitIndex = 2;
    expect(() => loadYouduPathsPack(data)).toThrow('紧接着追加一段');
  });
  it('节点及被动参数修改进入编译后的构筑', () => {
    const data = JSON.parse(JSON.stringify(raw));
    data.paths[0].nodes[2].panel[0].value = 123;
    data.passives[0].hooks[0].effects[0].factor = 1.23;
    const paths = compileYouduPaths(loadYouduPathsPack(data));
    const definition = { ...YOUDU_V6_DEFINITION, paths };
    const progress: SectCombatProgressV6 = {
      version: 1, sectId: 'youdu', activePathId: paths[0].id, meridianDepth: 7,
      methods: Object.fromEntries(definition.methods.map(m => [m.id, 180])),
      meridianLoadouts: [{ pathId: paths[0].id, nodeIds: [paths[0].nodes[2].id], revision: 0 }, { pathId: paths[1].id, nodeIds: [], revision: 0 }],
    };
    const result = compileSectDefinitionV6({ definition, progress, characterLevel: 180 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.projection.panel).toContainEqual({ attr: 'speed', mode: 'add', value: 123 });
      expect(result.projection.skills.find(s => s.id === data.passives[0].id)?.hooks?.[0].effects[0]).toEqual({ type: 'modifyStrike', factor: 1.23 });
    }
  });
});
