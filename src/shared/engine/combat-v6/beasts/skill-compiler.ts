import {
  DamageKind,
  EffectType,
  FormulaFamily,
  HookAim,
  HookName,
  SkillTag,
  TargetSide,
  type SkillDef,
} from '../core';
import type { BeastSkillContent } from './pack';

export function compileBeastSkill(entry: BeastSkillContent): SkillDef {
  const { effect: e } = entry;
  const identity = { id: entry.id, name: entry.name };
  switch (e.type) {
    case 'spellHit':
      return {
        ...identity,
        costMp: e.costMp,
        tags: [SkillTag.Spell],
        formula: FormulaFamily.Spell,
        targeting: { side: TargetSide.Enemy, count: 1 },
        effects: [
          {
            type: EffectType.SpellHit,
            coeff: e.coefficient,
            power:
              e.powerPerLevel === 1
                ? `${e.powerBase} + skillLevel`
                : `${e.powerBase} + skillLevel * ${e.powerPerLevel}`,
          },
        ],
      };
    case 'barrier':
      return {
        ...identity,
        costMp: e.costMp,
        tags: [SkillTag.Spell],
        targeting: { side: TargetSide.Self, count: 1 },
        effects: [
          {
            type: EffectType.ApplyBarrier,
            id: e.barrierId,
            kind: e.kind,
            name: e.name,
            power: `${e.powerBase} + skillLevel * ${e.powerPerLevel}`,
            duration: e.duration,
          },
        ],
      };
    case 'physicalHit':
      return {
        ...identity,
        costMp: e.costMp,
        tags: [SkillTag.Physical],
        formula: FormulaFamily.Physical,
        targeting: { side: TargetSide.Enemy, count: 1 },
        effects: [{ type: EffectType.PhysicalHit, coeff: e.coefficient }],
      };
    case 'combo':
      return {
        ...identity,
        tags: [SkillTag.Passive],
        targeting: { side: TargetSide.Enemy },
        effects: [],
        hooks: [
          {
            on: HookName.AfterHit,
            sourceIsSelf: true,
            requireKind: DamageKind.Physical,
            chance: e.chance,
            aim: HookAim.HookTarget,
            effects: [{ type: EffectType.PhysicalHit, coeff: e.coefficient }],
          },
        ],
      };
  }
}
