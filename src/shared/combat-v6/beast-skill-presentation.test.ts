import { expect, it } from 'vitest';
import {
  BEAST_SKILL_CONTENT,
  BEAST_SKILL_FAMILIES,
} from '../engine/combat-v6/beasts/content';
import skills from '../engine/combat-v6/beasts/data/skills.json';
import { BeastSkillsPackShape } from '../engine/combat-v6/beasts/pack';
import { beastSkillPresentation } from './beast-skill-presentation';
it('全部技能读取配置图标，等级由技能族决定，不依赖ID命名', () => {
  const advanced = new Set(BEAST_SKILL_FAMILIES.map((f) => f.advanced));
  for (const skill of BEAST_SKILL_CONTENT) {
    const view = beastSkillPresentation(skill.id);
    expect(view.icon).toBe(skill.icon);
    expect(view.style).toBe(advanced.has(skill.id) ? 'advanced' : 'normal');
    expect(view.description).not.toMatch(/demo/);
  }
  expect(new Set(BEAST_SKILL_CONTENT.map((s) => s.icon)).size).toBeGreaterThan(
    25,
  );
});
it('未知技能只作显示兜底，内容仍必须有图标', () => {
  expect(beastSkillPresentation('beast.unknown')).toMatchObject({
    name: '未知技能',
    style: 'unavailable',
  });
  const invalid = structuredClone(skills);
  invalid.skills[0].icon = '';
  expect(BeastSkillsPackShape.safeParse(invalid).success).toBe(false);
});

it('冲突说明保留在描述，冲突技能仍按自身等级展示', () => {
  expect(beastSkillPresentation('beast.ghost')).toMatchObject({
    style: 'normal',
    description: expect.stringContaining('涅槃重生失效'),
  });
  expect(beastSkillPresentation('beast.advanced-divine-revival')).toMatchObject(
    {
      style: 'advanced',
      description: expect.stringContaining('持有魂生或闭灵时不生效'),
    },
  );
});
