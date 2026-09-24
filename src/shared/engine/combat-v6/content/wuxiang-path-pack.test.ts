import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createEmptySectCombatProgressV6 } from '../build-state';
import { compileSectDefinitionV6 } from './compiler';
import raw from './data/wuxiang-paths.json';
import schema from './data/wuxiang-paths.schema.json';
import { WUXIANG_V6_DEFINITION as definition } from './wuxiang';
import {
  WuxiangPathsPackShape,
  loadWuxiangPathsPack,
} from './wuxiang-path-pack';

describe('无相两条完整经脉', () => {
  it('Schema 同步', () =>
    expect(z.toJSONSchema(WuxiangPathsPackShape, { reused: 'ref' })).toEqual(
      schema,
    ));
  it('38 可选节点均通过相邻连线编译，4 项自动奖励保留', () => {
    for (const path of definition.paths) {
      expect(path.nodes.filter((n) => n.automatic)).toHaveLength(2);
      for (const node of path.nodes.filter((n) => !n.automatic)) {
        const progress = createEmptySectCombatProgressV6(
          'wuxiang',
          path.id,
          Object.fromEntries(definition.methods.map((m) => [m.id, 180])),
        );
        progress.meridianDepth = 7;
        progress.meridianLoadouts.find((p) => p.pathId === path.id)!.nodeIds =
          Array.from(
            { length: node.layer },
            (_, i) =>
              path.nodes.find(
                (n) =>
                  n.layer === i + 1 &&
                  n.slot === (i + 1 === node.layer ? node.slot : 2),
              )!.id,
          );
        const result = compileSectDefinitionV6({
          definition,
          progress,
          characterLevel: 180,
        });
        expect(result.ok).toBe(true);
        if (result.ok)
          expect(
            result.projection.diagnostics.filter(
              (d) => d.code !== 'MERIDIAN_SELECTION_INCOMPLETE',
            ),
          ).toEqual([]);
      }
    }
  });
  it('拒绝重复槽位、悬空被动与非法公式', () => {
    const duplicate = structuredClone(raw);
    duplicate.paths[0].nodes[1].slot = 1;
    expect(() => loadWuxiangPathsPack(duplicate)).toThrow('层级槽位重复');
    const missing = structuredClone(raw);
    missing.paths[0].nodes[0].passives = ['wuxiang.passive.missing'];
    expect(() => loadWuxiangPathsPack(missing)).toThrow('引用不存在');
    const formula = structuredClone(raw);
    formula.passives.find(
      (p) => p.modifiers?.length,
    )!.modifiers![0].damageBonus = 'missingVariable';
    expect(() => loadWuxiangPathsPack(formula)).toThrow('未知表达式标识');
  });
});
