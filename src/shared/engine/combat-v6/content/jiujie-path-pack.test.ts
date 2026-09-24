import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import raw from './data/jiujie-paths.json';
import schema from './data/jiujie-paths.schema.json';
import { JiujiePathsShape, loadJiujiePaths } from './jiujie-path-pack';
import { JIUJIE_V6_DEFINITION as definition } from './jiujie';
import { compileSectDefinitionV6 } from './compiler';
import { createEmptySectCombatProgressV6 } from '../build-state';

describe('九劫双流派经脉', () => {
  it('schema 同步，38个可选节点、4个自动奖励', () => {
    expect(z.toJSONSchema(JiujiePathsShape, { reused: 'ref' })).toEqual(schema);
    expect(definition.paths.map(p => p.name)).toEqual(['霹雳真君', '踏雷天尊']);
    for (const path of definition.paths) {
      expect(path.requiresConnectedNodes).toBe(true);
      expect(path.nodes.filter(n => !n.automatic)).toHaveLength(19);
      expect(path.nodes.filter(n => n.automatic)).toHaveLength(2);
    }
  });
  it('全部节点通过合法连线编译，末端面板奖励自动获得', () => {
    for (const path of definition.paths) for (const node of path.nodes.filter(n => !n.automatic)) {
      const progress = createEmptySectCombatProgressV6('jiujie', path.id, Object.fromEntries(definition.methods.map(m => [m.id, 180])));
      progress.meridianDepth = 7;
      progress.meridianLoadouts.find(l => l.pathId === path.id)!.nodeIds = Array.from({length: node.layer}, (_, i) => path.nodes.find(n => n.layer === i+1 && n.slot === (i+1 === node.layer ? node.slot : 2))!.id);
      const result = compileSectDefinitionV6({definition, progress, characterLevel: 180});
      expect(result.ok, node.name).toBe(true);
      if (result.ok) expect(result.projection.diagnostics.some(d => d.code === 'MERIDIAN_CONNECTION_INCOMPLETE')).toBe(false);
    }
  });
  it('拒绝断层/重复槽位和失效引用', () => {
    const duplicate = structuredClone(raw);
    duplicate.paths[0].nodes[0].slot = 2;
    expect(() => loadJiujiePaths(duplicate)).toThrow('层级槽位重复');
    const missing = structuredClone(raw);
    missing.paths[0].foundationPassives.push('jiujie.passive.missing');
    expect(() => loadJiujiePaths(missing)).toThrow('引用不存在');
  });
});
