import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  SECTS_JIUJIE_PATHS_DATA as raw,
  SECTS_JIUJIE_PATHS_SCHEMA as schema,
  JiujiePathsShape,
  loadJiujiePaths,
} from '@daoyou/game-content/authoring/sects';
import { JIUJIE_V6_DEFINITION as definition } from '@daoyou/game-content/sects/jiujie';
import { compileSectDefinitionV6 } from './compiler.js';
import { createEmptySectCombatProgressV6 } from './build-state.js';

describe('九劫双流派经脉', () => {
  it('编辑器 schema 同步，两条道途都要求连线', () => {
    expect(z.toJSONSchema(JiujiePathsShape, { reused: 'ref' })).toEqual(schema);
    for (const path of definition.paths) {
      expect(path.requiresConnectedNodes).toBe(true);
    }
  });
  it('可选节点都能经由合法连线编译', () => {
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
