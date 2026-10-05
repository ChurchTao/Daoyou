import { BEAST_SKILLS } from '@daoyou/game-content/beasts';
import { EffectType, TargetSide } from '@daoyou/combat-core/enums';
import { DAO_EQUIPMENT_ARTS_V1 } from '@daoyou/game-content/equipment/special';
import { describe, expect, it } from 'vitest';
import { combatV6SkillDetails } from './skill-details.js';
import { LINGXIAO_COMBAT } from '@daoyou/game-content/authoring/sects';

describe('combat skill previews', () => {
  it('shows combo chances from the authoritative hooks', () => {
    const details = combatV6SkillDetails(BEAST_SKILLS, []);
    expect(details['beast.combo'].description).toContain('45% 概率');
    expect(details['beast.advanced-combo'].description).toContain('55% 概率');
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

  it('explains the second-round beast specials with their numeric and targeting boundaries', () => {
    const details = combatV6SkillDetails(BEAST_SKILLS, [], { includeBeastFlavor: false });
    expect(details['beast.innate-wisdom'].description).toContain('完整魔力属性 × 0.4');
    expect(details['beast.overwhelming-might'].description).toContain('物理防御降低完整力量属性 × 0.2');
    expect(details['beast.spirit-guard'].description).toContain('持续 6 回合');
    expect(details['beast.spirit-guard'].description).toContain('法术伤害降低 65%');
    expect(details['beast.spirit-guard'].description).toContain('不减免物理或固定伤害');
    expect(details['beast.wind-strike'].description).toContain('当前有效速度 ÷ 3');
    expect(details['beast.wind-strike'].description).toContain('人物单位受到的伤害为 50%');
    expect(details['beast.barrier-breaker'].description).toContain('仍计算目标基础防御');
    expect(details['beast.mind-shatter'].description).toContain('普通物理伤害的 90%');
    expect(details['beast.mind-shatter'].description).toContain('持续损耗不叠加，保留较高值');
    expect(details['beast.unanticipated'].description).toContain('本回合己方灵兽尚未施展过的技能');
    expect(details['beast.unanticipated'].description).toContain('同一次群体攻击与灵法连击均获得加成');
    expect(details['beast.unanticipated'].description).toContain('不限物种');
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
  expect(details['lingxiao.skill.sword_aura'].description).toContain('持续 5 回合');
});
