import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import combat from './data/xiaoyue-combat.json' with { type: 'json' };
import combatSchema from './data/xiaoyue-combat.schema.json' with { type: 'json' };
import methodsSchema from './data/methods.schema.json' with { type: 'json' };
import paths from './data/xiaoyue-paths.json' with { type: 'json' };
import pathsSchema from './data/xiaoyue-paths.schema.json' with { type: 'json' };
import { SECT_METHODS, SectMethodsPackShape } from './method-pack.js';
import { SECT_SKILL_LEARNING } from './skill-learning.js';
import { XiaoyueCombatPackShape, loadXiaoyueCombatPack } from './xiaoyue-pack.js';
import { XiaoyuePathsPackShape, loadXiaoyuePathsPack } from './xiaoyue-path-pack.js';
import { XIAOYUE_V6_DEFINITION } from './xiaoyue.js';

describe('啸岳岭内容契约', () => {
  it('JSON Schema 与严格运行时解析同步', () => {
    expect(z.toJSONSchema(XiaoyueCombatPackShape, { reused: 'ref' })).toEqual(combatSchema);
    expect(z.toJSONSchema(XiaoyuePathsPackShape, { reused: 'ref' })).toEqual(pathsSchema);
    expect(z.toJSONSchema(SectMethodsPackShape, { reused: 'ref' })).toEqual(methodsSchema);
    expect(loadXiaoyueCombatPack(combat)).toBeTruthy();
    expect(loadXiaoyuePathsPack(paths)).toBeTruthy();
    expect(() => loadXiaoyueCombatPack({ ...combat, unrecognized: true })).toThrow('Unrecognized key');
    expect(() => loadXiaoyuePathsPack({ ...paths, paths: [paths.paths[0], paths.paths[0]] })).toThrow('重复 ID');
    const missingStatus = structuredClone(combat);
    missingStatus.skills[0].effects[1] = { type: 'applyStatus', statusId: 'xiaoyue.status.missing', duration: 1, self: true } as typeof missingStatus.skills[0]['effects'][number];
    expect(() => loadXiaoyueCombatPack(missingStatus)).toThrow('引用不存在');
  });

  it('六心法、全部技能和两条 21 位置道途均有合法学习来源', () => {
    const definition = XIAOYUE_V6_DEFINITION;
    expect(definition.methods).toEqual(SECT_METHODS.xiaoyue);
    expect(definition.methods.map(method => method.slot)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(definition.paths.map(path => path.nodes.length)).toEqual([21, 21]);
    const skills = [
      ...definition.skills,
      ...definition.paths.flatMap(path => [
        ...(path.foundationPassives ?? []), ...(path.grantSkills ?? []),
        ...path.nodes.flatMap(node => [...(node.passives ?? []), ...(node.grantSkills ?? [])]),
      ]),
    ];
    for (const skill of skills) {
      const learning = SECT_SKILL_LEARNING.skills[skill.definition.id];
      expect(learning, skill.definition.id).toBeDefined();
      expect(definition.methods.some(method => method.id === learning.sourceMethodId), skill.definition.id).toBe(true);
    }
    for (const path of definition.paths) {
      expect(path.nodes.map(node => `${node.layer}.${node.slot}`)).toEqual(
        Array.from({ length: 21 }, (_, index) => `${Math.floor(index / 3) + 1}.${index % 3 + 1}`),
      );
      expect(path.nodes.filter(node => node.automatic).map(node => node.slot)).toEqual([1, 3]);
      for (const node of path.nodes)
        expect(Boolean(node.panel?.length || node.passives?.length || node.grantSkills?.length), node.id).toBe(true);
    }
    expect(definition.paths[1].nodes.find(node => node.id === 'xiaoyue.node.bond.7.2')?.grantSkills?.[0].definition.id)
      .toBe('xiaoyue.skill.best_partners');
  });

  it('基础费用、变身门槛与鹏击、连环击人数公式保留首版参数', () => {
    const skill = (id: string) => combat.skills.find(entry => entry.id === id)!;
    expect(skill('xiaoyue.skill.transform')).toMatchObject({ costMp: 20, requirement: '(1-hasStatus.xiaoyue.status.transform)+hasStatus.xiaoyue.status.quick_penalty' });
    expect(skill('xiaoyue.skill.lion_strike')).toMatchObject({ costMp: 30, requirement: 'hasStatus.xiaoyue.status.transform' });
    expect(skill('xiaoyue.skill.eagle_strike')).toMatchObject({ costMp: '30+10*(targets-1)', cooldownRounds: 2 });
    expect(skill('xiaoyue.skill.chain_strike').costMp).toContain('30*if(skillLevel>=175,7');
    expect(skill('xiaoyue.skill.best_partners')).toMatchObject({ costMp: 500, cooldownRounds: 8, initialCooldownRounds: 4 });
    expect(combat.skills.filter(entry => !entry.tags.includes('passive'))).toHaveLength(11);
    expect(paths.paths.map(path => path.id)).toEqual(['xiaoyue.path.blood', 'xiaoyue.path.bond']);
  });
});
