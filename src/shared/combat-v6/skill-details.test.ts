import { EffectType, TargetSide } from '@shared/engine/combat-v6/core/enums';
import { DAO_EQUIPMENT_ARTS_V1 } from '@shared/engine/combat-v6/equipment/special-content';
import { describe, expect, it } from 'vitest';
import { combatV6SkillDetails } from './skill-details';

describe('combat skill previews', () => {
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
