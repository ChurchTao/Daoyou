import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import raw from './data/tianyan-paths.json';
import schema from './data/tianyan-paths.schema.json';
import { TianyanPathsShape, loadTianyanPaths } from './tianyan-path-pack';
import { TIANYAN_V6_DEFINITION as definition } from './tianyan';
import { compileSectDefinitionV6 } from './compiler';
import { createEmptySectCombatProgressV6 } from '../build-state';

describe('天衍经脉连线', () => {
  it('Schema 同步', () => expect(z.toJSONSchema(TianyanPathsShape, { reused: 'ref' })).toEqual(schema));
  it('42 节点均通过合法路径获得；根基无终结技与额外资源', () => {
    for (const path of definition.paths) for (const node of path.nodes) {
      const progress = createEmptySectCombatProgressV6('tianyan', path.id, Object.fromEntries(definition.methods.map(m => [m.id, 180])));
      progress.meridianDepth = 7;
      progress.meridianLoadouts.find(l => l.pathId === path.id)!.nodeIds = path.nodes.filter(n => n.layer <= node.layer && n.slot === node.slot).map(n => n.id);
      const result = compileSectDefinitionV6({ definition, progress, characterLevel: 180 });
      expect(result.ok, JSON.stringify(result)).toBe(true);
      if (result.ok) {
        expect(result.projection.passiveSkillIds).toContain(node.passives![0].definition.id);
        expect(result.projection.resources).toEqual([]);
        for (const s of node.grantSkills ?? []) expect(result.projection.activeSkillIds).toContain(s.definition.id);
      }
    }
  });
  it('跳层和跨两列不能获得节点效果', () => {
    const path = definition.paths[0];
    for (const nodes of [[path.nodes[3].id], [path.nodes[0].id, path.nodes[5].id]]) {
      const progress = createEmptySectCombatProgressV6('tianyan', path.id, Object.fromEntries(definition.methods.map(m => [m.id, 180])));
      progress.meridianDepth = 7;
      progress.meridianLoadouts.find(l => l.pathId === path.id)!.nodeIds = nodes;
      const result = compileSectDefinitionV6({ definition, progress, characterLevel: 180 });
      expect((result.ok ? result.projection.diagnostics : result.diagnostics).some(d => d.code === 'MERIDIAN_CONNECTION_INCOMPLETE')).toBe(true);
      if (result.ok) expect(result.projection.passiveSkillIds).not.toContain(path.nodes.find(n => n.id === nodes.at(-1))!.passives![0].definition.id);
    }
  });
  it('拒绝重复槽位和不存在的被动', () => {
    const duplicate = structuredClone(raw);
    duplicate.paths[0].nodes[1].slot = 1;
    expect(() => loadTianyanPaths(duplicate)).toThrow('层级槽位重复');
    const missing = structuredClone(raw);
    missing.paths[0].nodes[0].passives[0] = 'tianyan.passive.missing';
    expect(() => loadTianyanPaths(missing)).toThrow('被动引用不存在');
  });
});
