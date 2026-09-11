import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import raw from './data/skill-learning.json';
import schema from './data/skill-learning.schema.json';
import { SectSkillLearningShape, loadSectSkillLearning, sectSkillLearning } from './skill-learning';
import { COMBAT_V6_SECT_DEFINITIONS } from './index';
import { compileSectDefinitionV6 } from './compiler';
import { createEmptySectCombatProgressV6, createFreshCombatV6MethodLevels } from '../build-state';

describe('宗门技能学习配置', () => {
  it('所有技能、状态、流派节点和心法完整定义与迁移前一致', () => {
    expect(createHash('sha256').update(JSON.stringify(COMBAT_V6_SECT_DEFINITIONS)).digest('hex')).toBe('e76aa73d14ab25af362a3a41140607242f80f6d0601c0382755cb16e01287a5c');
  });
  it('Schema 与编辑器一致', () => {
    expect(z.toJSONSchema(SectSkillLearningShape)).toEqual(schema);
  });
  it('配置提高解锁等级后编译器实际隐藏技能', () => {
    const data = structuredClone(raw);
    data.skills['lingxiao.skill.triple'].unlockMethodLevel = 10;
    const pack = loadSectSkillLearning(data);
    const original = COMBAT_V6_SECT_DEFINITIONS.lingxiao;
    const definition = { ...original, skills: original.skills.map(skill => ({ ...skill, ...sectSkillLearning(skill.definition.id, pack) })) };
    const progress = createEmptySectCombatProgressV6('lingxiao', definition.paths[0].id, createFreshCombatV6MethodLevels('lingxiao'));
    const before = compileSectDefinitionV6({ definition: original, progress, characterLevel: 10 });
    const after = compileSectDefinitionV6({ definition, progress, characterLevel: 10 });
    expect(before.ok && before.projection.activeSkillIds.includes('lingxiao.skill.triple')).toBe(true);
    expect(after.ok && after.projection.activeSkillIds.includes('lingxiao.skill.triple')).toBe(false);
  });
  it('每个运行时技能恰有对应学习关系且配置无孤立项', () => {
    const skills = Object.values(COMBAT_V6_SECT_DEFINITIONS).flatMap(d => [
      ...d.skills, ...d.paths.flatMap(p => [
        ...(p.foundationPassives ?? []), ...(p.grantSkills ?? []),
        ...p.nodes.flatMap(n => [...(n.passives ?? []), ...(n.grantSkills ?? [])]),
      ]),
    ]);
    expect([...new Set(skills.map(s => s.definition.id))].sort()).toEqual(Object.keys(raw.skills).sort());
    for (const skill of skills) expect(sectSkillLearning(skill.definition.id)).toEqual({
      sourceMethodId: skill.sourceMethodId, unlockMethodLevel: skill.unlockMethodLevel,
    });
  });
  it('拒绝不存在的心法、跨宗门引用及缺失学习关系', () => {
    for (const sourceMethodId of ['missing', 'youdu.method.canon']) {
      const data = structuredClone(raw);
      data.skills['lingxiao.skill.triple'].sourceMethodId = sourceMethodId;
      expect(() => loadSectSkillLearning(data)).toThrow('skills.lingxiao.skill.triple.sourceMethodId');
    }
    expect(() => sectSkillLearning('lingxiao.skill.missing')).toThrow('缺少技能归属与解锁配置');
  });
});
