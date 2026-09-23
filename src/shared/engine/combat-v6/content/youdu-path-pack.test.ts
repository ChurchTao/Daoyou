import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import raw from './data/youdu-paths.json';
import schema from './data/youdu-paths.schema.json';
import { YouduPathsPackShape, loadYouduPathsPack, compileYouduPaths } from './youdu-path-pack';
import { YOUDU_V6_DEFINITION } from './youdu';
import { compileSectDefinitionV6 } from './compiler';
import { createEmptySectCombatProgressV6 } from '../build-state';
import { canSelectMeridianNode } from './meridian-selection';

describe('幽都原版经脉结构', () => {
  it('Schema 与编辑器同步', () => expect(z.toJSONSchema(YouduPathsPackShape, { reused: 'ref' })).toEqual(schema));
  it('拒绝重复槽位、缺失引用、非法表达式', () => {
    const duplicate = structuredClone(raw);
    duplicate.paths[0].nodes[1].slot = 1;
    expect(() => loadYouduPathsPack(duplicate)).toThrow('层级槽位重复');
    const missing = structuredClone(raw);
    missing.paths[0].foundationPassives = ['youdu.passive.missing'];
    expect(() => loadYouduPathsPack(missing)).toThrow('引用不存在');
    const expression = structuredClone(raw);
    expression.passives.find(p => p.name === '索魂')!.modifiers![0].sealChanceAdd = 'floor(';
    expect(() => loadYouduPathsPack(expression)).toThrow('sealChanceAdd');
  });
  it('两树各19个可选节点、2个自动奖励，所有节点通过合法连线进入编译结果', () => {
    const paths = compileYouduPaths(loadYouduPathsPack(raw));
    const definition = { ...YOUDU_V6_DEFINITION, paths };
    expect(paths.map(p => p.name)).toEqual(['拘魂锁命', '蚀魂摧形']);
    for (const path of paths) {
      expect(path.nodes.filter(n => !n.automatic)).toHaveLength(19);
      expect(path.nodes.filter(n => n.automatic)).toHaveLength(2);
      for (const node of path.nodes.filter(n => !n.automatic)) {
        const progress = createEmptySectCombatProgressV6('youdu', path.id, Object.fromEntries(definition.methods.map(m => [m.id, 180])));
        progress.meridianDepth = 7;
        const prefix = path.nodes.filter(n => n.layer < node.layer && n.slot === 2 && !n.automatic).map(n => n.id);
        expect(canSelectMeridianNode(path, prefix, node)).toBe(true);
        progress.meridianLoadouts.find(l => l.pathId === path.id)!.nodeIds = [...prefix, node.id];
        const result = compileSectDefinitionV6({ definition, progress, characterLevel: 180 });
        expect(result.ok).toBe(true);
        if (!result.ok) continue;
        expect(result.projection.diagnostics.some(d => d.code === 'MERIDIAN_CONNECTION_INCOMPLETE')).toBe(false);
        for (const p of node.passives ?? []) expect(result.projection.passiveSkillIds).toContain(p.definition.id);
        for (const s of node.grantSkills ?? []) expect(result.projection.activeSkillIds).toContain(s.definition.id);
        for (const id of node.revokeSkillIds ?? []) expect(result.projection.activeSkillIds).not.toContain(id);
      }
    }
  });
  it('摧形散法替换涤魂，节点不授予装备特技；旧六道树与旧技能全部移除', () => {
    const paths = compileYouduPaths(loadYouduPathsPack(raw));
    const node = paths[1].nodes.find(n => n.name === '摧形散法')!;
    expect(node.revokeSkillIds).toEqual(['youdu.skill.dispel']);
    expect(node.grantSkills?.map(s => s.definition.id)).toEqual(['youdu.skill.pardonless']);
    expect(paths[1].nodes.find(n => n.name === '引毒入魂')!.grantSkills).toBeUndefined();
    expect(JSON.stringify(YOUDU_V6_DEFINITION)).not.toMatch(/six_paths|life_judge|final_judgment|ghost_rift|六道魍魉/);
  });
});
