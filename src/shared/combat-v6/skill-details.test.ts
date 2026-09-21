import { BEAST_SKILLS } from '@shared/engine/combat-v6/beasts';
import { EffectType, TargetSide } from '@shared/engine/combat-v6/core/enums';
import { DAO_EQUIPMENT_ARTS_V1 } from '@shared/engine/combat-v6/equipment/special-content';
import { describe, expect, it } from 'vitest';
import { combatV6SkillDetails } from './skill-details';
import { LINGXIAO_COMBAT } from '@shared/engine/combat-v6/content/lingxiao-pack';

describe('combat skill previews', () => {
  it('shows combo chances from the authoritative hooks', () => {
    const details = combatV6SkillDetails(BEAST_SKILLS, []);
    expect(details['beast.combo'].description).toContain('25%');
    expect(details['beast.advanced-combo'].description).toContain('55%');
    const combo = BEAST_SKILLS.find((skill) => skill.id === 'beast.combo')!;
    const adjusted = {
      ...combo,
      hooks: combo.hooks!.map((hook) => ({ ...hook, chance: 0.3 })),
    };
    expect(
      combatV6SkillDetails([adjusted], [])[combo.id].description,
    ).toContain('30%');
  });
  it('classifies all registered equipment arts without relying on skill names', () => {
    const skills = DAO_EQUIPMENT_ARTS_V1.map((art) => art.skill);
    const details = combatV6SkillDetails(skills, []);
    for (const skill of skills) {
      expect(details[skill.id].category).toBe('art');
      expect(details[skill.id].description.length).toBeGreaterThan(0);
    }
  });

  it('keeps conditional and success effects qualified and hides formulas', () => {
    const details = combatV6SkillDetails(
      [
        {
          id: 'preview',
          name: '预览',
          tags: [],
          targeting: { side: TargetSide.Enemy },
          effects: [
            {
              type: EffectType.PhysicalHit,
              power: 'source.physicalAtk * 2',
              when: { targetHpRatioBelow: 0.5 },
            },
          ],
          successEffects: [{ type: EffectType.RestoreMp, power: 0 }],
        },
      ],
      [],
    );
    expect(details.preview).toEqual({
      category: 'spell',
      description: '满足条件时：造成物理伤害；施放成功后：恢复法力',
    });
  });
});


it('剑宗说明跟随当前血线与增益持续，不保留旧命名', () => {
  const skills = LINGXIAO_COMBAT.baseSkills.map(s => structuredClone(s.definition));
  const triple = skills.find(s => s.id === 'lingxiao.skill.triple')!;
  triple.requireHpAboveRatio = 0.35;
  const details = combatV6SkillDetails(skills, LINGXIAO_COMBAT.statuses);
  expect(details[triple.id].description).toContain('高于35%');
  expect(details[triple.id].description).not.toContain('50%');
  expect(details['lingxiao.skill.formation'].description).toContain('低于50%');
  expect(details['lingxiao.skill.sword_aura'].description).toContain('持续 3 回合');
});
