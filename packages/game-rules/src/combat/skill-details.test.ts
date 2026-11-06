import { EffectType, TargetSide } from '@daoyou/combat-core/enums';
import type { SkillDef, StatusDef } from '@daoyou/combat-core/types';
import { LINGXIAO_COMBAT } from '@daoyou/game-content/authoring/sects';
import { BEAST_SKILLS } from '@daoyou/game-content/beasts';
import { DAO_EQUIPMENT_ARTS_V1 } from '@daoyou/game-content/equipment/special';
import { describe, expect, it } from 'vitest';
import { combatV6SkillDetails } from './skill-details.js';

describe('combat skill previews', () => {
  it('keeps authored descriptions free of generated status mechanics', () => {
    const statuses: StatusDef[] = [
      { id: 'snapshot', kind: 'snapshot', name: '资源快照', category: 'buff', untilBattleEnd: true },
      { id: 'focus', kind: 'focus', name: '凝神', category: 'buff' },
    ];
    const skill: SkillDef = {
      id: 'preview', name: '预览', description: '依当前资源获得法攻，施法时凝神。',
      tags: ['support'], targeting: { side: 'self' },
      effects: [
        { type: 'applyStatus', statusId: 'snapshot', duration: 99, self: true },
        { type: 'applyStatus', statusId: 'focus', duration: 3, self: true },
      ],
    };
    const description = combatV6SkillDetails([skill], statuses)[skill.id].description;
    expect(description).toBe(skill.description);
    expect(description).not.toContain('99');
    expect(description).not.toContain('资源快照');
  });
  it('describes generic sleep, hostile-action interception and damaging-spell restrictions', () => {
    const statuses: StatusDef[] = [
      {
        id: 'sleep',
        kind: 'control',
        name: '梦',
        blocksAction: true,
        breakOnDamage: true,
        breakOnDamageAbove: 30,
      },
      {
        id: 'guard',
        kind: 'guard',
        name: '护持',
        category: 'buff',
        interceptHostileAction: true,
      },
      {
        id: 'spell-only',
        kind: 'control',
        name: '禁攻法',
        blocksDamagingSpells: true,
      },
      {
        id: 'focus',
        kind: 'focus',
        name: '凝神',
        category: 'buff',
        modifiers: [{ sealChanceCeilAdd: 0.1 }],
      },
    ];
    const skills: SkillDef[] = statuses.map((status) => ({
      id: status.id,
      name: status.name,
      description: '当前能力。',
      tags: ['support'],
      targeting: { side: 'enemy' },
      effects: [{ type: 'applyStatus', statusId: status.id, duration: 3 }],
    }));
    skills[2].sealChanceCeil = 0.9;
    const details = combatV6SkillDetails(skills, statuses);
    expect(details.sleep.description).toBe('当前能力。');
    expect(details.guard.description).toBe('当前能力。');
    expect(details['spell-only'].description).toBe('当前能力。');
    expect(details['spell-only'].description).not.toContain('命中上限');
    expect(details.focus.description).toBe('当前能力。');
    const generated = combatV6SkillDetails(
      [
        {
          id: 'bare-seal',
          name: '封',
          tags: ['seal'],
          targeting: { side: 'enemy' },
          effects: [
            { type: 'applyStatus', statusId: 'spell-only', duration: 3 },
            { type: 'applyStatus', statusId: 'focus', duration: 3 },
          ],
        },
      ],
      statuses,
    );
    expect(generated['bare-seal'].description).toContain(
      '无法使用造成伤害的法术',
    );
    expect(generated['bare-seal'].description).not.toContain('不受此项限制');
    expect(generated['bare-seal'].description).toContain('封印命中率上限 +10%');
  });
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
  const skills = LINGXIAO_COMBAT.baseSkills.map((s) =>
    structuredClone(s.definition),
  );
  const triple = skills.find((s) => s.id === 'lingxiao.skill.triple')!;
  triple.requireHpAboveRatio = 0.35;
  const details = combatV6SkillDetails(skills, LINGXIAO_COMBAT.statuses);
  expect(details[triple.id].description).toContain('高于35%');
  expect(details[triple.id].description).not.toContain('50%');
  expect(details['lingxiao.skill.formation'].description).toContain('高于10%');
  expect(details['lingxiao.skill.sword_aura'].description).toContain(
    '持续5回合',
  );
});
