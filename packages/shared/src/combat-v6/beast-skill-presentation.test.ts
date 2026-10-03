import { expect, it } from 'vitest';
import {
  BEAST_ADVANCED_SKILL_IDS,
  BEAST_SKILL_CONTENT,
  BEAST_SUPERIOR_BOOK_SKILL_IDS,
} from '../engine/combat-v6/beasts/content.js';
import skills from '../engine/combat-v6/beasts/data/skills.json' with { type: 'json' };
import { BeastSkillsPackShape } from '../engine/combat-v6/beasts/pack.js';
import { beastSkillPresentation } from './beast-skill-presentation.js';
it('技能格与传承灵印都读取技能配置的高级标记', () => {
  for (const skill of BEAST_SKILL_CONTENT) {
    const view = beastSkillPresentation(skill.id);
    expect(view.icon).toBe(skill.icon);
    expect(view.style).toBe(skill.advanced ? 'advanced' : 'normal');
    expect(BEAST_ADVANCED_SKILL_IDS.has(skill.id)).toBe(skill.advanced);
    expect(BEAST_SUPERIOR_BOOK_SKILL_IDS.has(skill.id)).toBe(
      skill.book && skill.advanced,
    );
    expect(view.description).not.toMatch(/demo/);
    expect(view.summary).toBe(skill.flavorText);
    expect(view.details).not.toBe(skill.flavorText);
  }
  for (const id of [
    'beast.thunderstorm',
    'beast.mountain-crush',
    'beast.flood',
    'beast.wildfire',
  ]) {
    expect(BEAST_SUPERIOR_BOOK_SKILL_IDS.has(id)).toBe(true);
    expect(beastSkillPresentation(id).style).toBe('advanced');
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
      description: expect.stringContaining('持有灵魂体或绝灵时不生效'),
    },
  );
});

it('技能简述与具体数值分别提供给预览', () => {
  const combo = beastSkillPresentation('beast.advanced-combo');
  expect(combo.summary).toBe('普通攻击命中后有机会追加一击，但自身造成的物理伤害会降低。');
  expect(combo.details).toContain('55%');
  expect(combo.details).toContain('20%');
  expect(combo.description).toBe(`${combo.summary}\n${combo.details}`);
  expect(beastSkillPresentation('beast.perception').details).toBe('');
  expect(beastSkillPresentation('beast.advanced-denial').details).toContain(
    '灵魂体、涅槃重生、定神（均含高级版）',
  );
});
