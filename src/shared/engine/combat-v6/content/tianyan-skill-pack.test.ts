import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import raw from './data/tianyan-skills.json';
import schema from './data/tianyan-skills.schema.json';
import {
  loadTianyanSkills,
  TIANYAN_SKILLS,
  TianyanSkillsShape,
} from './tianyan-skill-pack';

describe('天衍基础技能配置', () => {
  it('Schema 同步', () =>
    expect(z.toJSONSchema(TianyanSkillsShape, { reused: 'ref' })).toEqual(
      schema,
    ));
  it('仅七个基础技能；法印在成功施放末尾更新且作用于自身', () => {
    expect(TIANYAN_SKILLS.baseSkills).toHaveLength(7);
    const fire = TIANYAN_SKILLS.skill('tianyan.skill.fire').definition;
    expect(fire.effects.filter((e) => e.type === 'emitMechanic')).toHaveLength(
      2,
    );
    expect(fire.successEffects).toEqual([
      {
        type: 'applyStatus',
        statusId: 'tianyan.status.mark.fire',
        duration: 1,
        targeting: { side: 'self' },
      },
    ]);
    expect(JSON.stringify(TIANYAN_SKILLS)).not.toContain('derivation');
  });
  it('拒绝重复五行、未定义技能和未知状态', () => {
    const duplicate = structuredClone(raw);
    duplicate.elemental[1].element = 'wood';
    expect(() => loadTianyanSkills(duplicate)).toThrow('五行必须');
    const missing = structuredClone(raw);
    missing.baseSkillIds[0] = 'tianyan.skill.missing';
    expect(() => loadTianyanSkills(missing)).toThrow('基础技能引用');
    const status = structuredClone(raw);
    status.skills[0].effects[0].statusId = 'tianyan.status.missing';
    expect(() => loadTianyanSkills(status)).toThrow('状态引用不存在');
  });
});
