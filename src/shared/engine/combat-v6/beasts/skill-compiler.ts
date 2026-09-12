import {
  BUILTIN_SKILL_ID,
  DamageKind,
  EffectType,
  FormulaFamily,
  HookAim,
  HookName,
  SkillTag,
  StatusCategory,
  StatusFlag,
  TargetMode,
  TargetSide,
  type SkillDef,
} from '../core';
import type { BeastSkillContent } from './pack';

export function compileBeastSkill(entry: BeastSkillContent): SkillDef {
  const { effect: e } = entry;
  const identity = { id: entry.id, name: entry.name };
  const passive: SkillDef = {
    ...identity,
    ...(['ghost', 'divineRevival', 'miracle', 'concentration'].includes(e.type)
      ? {
          conflicts: [
            'beast.denial',
            'beast.advanced-denial',
            ...(e.type === 'divineRevival'
              ? ['beast.ghost', 'beast.advanced-ghost']
              : []),
          ],
        }
      : {}),
    tags: [SkillTag.Passive],
    targeting: { side: TargetSide.Self },
    effects: [],
  };
  switch (e.type) {
    case 'ghost':
      return {
        ...passive,
        innate: {
          delayedRevivalRounds: e.delay,
          rejectHpRecovery: true,
          immuneStatusCategories: [
            StatusCategory.Control,
            StatusCategory.Debuff,
            StatusCategory.Dot,
          ],
        },
      };
    case 'exorcism':
      return {
        ...passive,
        innate: {
          preventDelayedRevival: true,
          damageToDelayedRevival: e.factor,
        },
      };
    case 'denial':
      return {
        ...passive,
        innate: {
          rejectBuffs: true,
          damageFromDelayedRevival: e.ghostDamageFactor,
          immuneStatusCategories: [
            StatusCategory.Control,
            StatusCategory.Debuff,
            StatusCategory.Dot,
          ],
        },
        hooks: [
          {
            on: HookName.OnHitCalc,
            targetIsSelf: true,
            requireKind: DamageKind.Spell,
            effects: [{ type: EffectType.ModifyStrike, factor: e.spellFactor }],
          },
        ],
      };
    case 'poison':
      return {
        ...passive,
        innate: e.immune ? { immuneStatusKinds: ['beast.poison'] } : undefined,
        hooks: [
          {
            on: HookName.AfterHit,
            sourceIsSelf: true,
            requireKind: DamageKind.Physical,
            when: {
              skillIds: [BUILTIN_SKILL_ID.Attack],
              targetHpRatioAbove: 0,
            },
            chance: e.chance,
            aim: HookAim.HookTarget,
            effects: [
              {
                type: EffectType.ApplyStatus,
                statusId: `${entry.id}.status`,
                duration: e.duration,
              },
            ],
          },
        ],
      };
    case 'miracle':
      return e.immune
        ? {
            ...passive,
            innate: {
              immuneStatusCategories: [
                StatusCategory.Control,
                StatusCategory.Debuff,
                StatusCategory.Dot,
              ],
            },
          }
        : {
            ...passive,
            hooks: [
              {
                on: HookName.OnRoundEnd,
                aim: HookAim.Self,
                effects: [
                  {
                    type: EffectType.Dispel,
                    categories: [
                      StatusCategory.Control,
                      StatusCategory.Debuff,
                      StatusCategory.Dot,
                    ],
                    excludeStatusFlags: [StatusFlag.BlocksRevive],
                  },
                ],
              },
            ],
          };
    case 'concentration':
      return {
        ...passive,
        innate: { immuneStatusCategories: [StatusCategory.Control] },
        hooks: [
          {
            on: HookName.OnHitCalc,
            sourceIsSelf: true,
            requireKind: DamageKind.Physical,
            effects: [
              { type: EffectType.ModifyStrike, factor: e.physicalFactor },
            ],
          },
        ],
      };
    case 'eternity':
      return {
        ...passive,
        innate: { buffDuration: { factor: e.factor, maxExtra: e.maxExtra } },
      };
    case 'stealth':
      return {
        ...passive,
        innate: {
          entryStatus: {
            statusId: `${entry.id}.status`,
            minDuration: e.minDuration,
            maxDuration: e.maxDuration,
          },
        },
        hooks: [
          {
            on: HookName.OnHitCalc,
            sourceIsSelf: true,
            requireKind: DamageKind.Physical,
            when: { requireStatusIds: [`${entry.id}.status`] },
            effects: [
              { type: EffectType.ModifyStrike, factor: e.physicalFactor },
            ],
          },
        ],
      };
    case 'perception':
      return { ...passive, innate: { revealStealth: true } };
    case 'spellRepeat':
      return {
        ...passive,
        innate: { spellRepeat: { chance: e.chance, factor: e.factor } },
      };
    case 'spellFluctuation':
      return {
        ...passive,
        innate: {
          spellFluctuation: { min: e.min, max: e.max },
          suppressSpellRetaliation: e.suppressReflection,
        },
      };
    case 'parry':
      return {
        ...passive,
        hooks: [
          {
            on: HookName.OnHitCalc,
            targetIsSelf: true,
            requireKind: DamageKind.Physical,
            parry: true,
            when: { oncePerRound: true },
            effects: [{ type: EffectType.ModifyStrike, factor: e.factor }],
          },
        ],
      };
    case 'defenseTraining':
      return {
        ...passive,
        hooks: [
          {
            on: HookName.OnHitCalc,
            sourceIsSelf: true,
            requireKind: DamageKind.Spell,
            effects: [{ type: EffectType.ModifyStrike, factor: e.spellFactor }],
          },
        ],
      };
    case 'strengthTraining':
      return {
        ...passive,
        innate: { ignoreParry: true },
        hooks: [
          {
            on: HookName.OnHitCalc,
            sourceIsSelf: true,
            requireKind: DamageKind.Physical,
            when: {
              targetSkillIds: ['beast.defense', 'beast.advanced-defense'],
            },
            effects: [
              { type: EffectType.ModifyStrike, factor: e.versusDefenseFactor },
            ],
          },
        ],
      };
    case 'wisdom':
      return { ...passive, innate: { spellMpCostFactor: e.factor } };
    case 'sneakAttack':
      return {
        ...passive,
        innate: { suppressPhysicalRetaliation: true },
        hooks: [
          {
            on: HookName.OnHitCalc,
            sourceIsSelf: true,
            requireKind: DamageKind.Physical,
            effects: [{ type: EffectType.ModifyStrike, factor: e.factor }],
          },
        ],
      };
    case 'spellResistance':
      return {
        ...passive,
        hooks: [
          {
            on: HookName.OnHitCalc,
            targetIsSelf: true,
            requireKind: DamageKind.Spell,
            effects: [{ type: EffectType.ModifyStrike, factor: e.takenFactor }],
          },
          {
            on: HookName.OnHitCalc,
            sourceIsSelf: true,
            requireKind: DamageKind.Physical,
            effects: [
              { type: EffectType.ModifyStrike, factor: e.physicalFactor },
            ],
          },
        ],
      };
    case 'lifesteal':
      return {
        ...passive,
        hooks: [
          {
            on: HookName.AfterHit,
            sourceIsSelf: true,
            requireKind: DamageKind.Physical,
            when: { targetWithoutDelayedRevival: true },
            aim: HookAim.Self,
            effects: [
              {
                type: EffectType.RestoreHp,
                power: `floor(hpDamage * ${e.ratio})`,
              },
            ],
          },
        ],
      };
    case 'reflection':
      return {
        ...passive,
        hooks: [
          {
            on: HookName.OnBeHit,
            retaliation: true,
            targetIsSelf: true,
            requireKind: e.kind,
            chance: e.chance,
            aim: HookAim.HookSource,
            effects: [
              {
                type: EffectType.FixedHit,
                power: `floor(hpDamage * ${e.ratio})`,
              },
            ],
          },
        ],
      };
    case 'divineRevival':
      return {
        ...passive,
        hooks: [
          {
            on: HookName.OnFatal,
            targetIsSelf: true,
            chance: e.chance,
            aim: HookAim.Self,
            effects: [{ type: EffectType.Revive, hpRatio: e.hpRatio }],
          },
        ],
      };
    case 'speed':
      // Permanent speed is applied by beastPanel, shared by display and battle.
      return passive;
    case 'critical':
      return {
        ...passive,
        hooks: [
          {
            on: HookName.OnCritRoll,
            sourceIsSelf: true,
            requireKind: e.kind,
            aim: HookAim.Self,
            effects: [{ type: EffectType.ModifyChance, add: e.chance }],
          },
        ],
      };
    case 'spellBoost':
      return {
        ...passive,
        hooks: [
          {
            on: HookName.OnHitCalc,
            sourceIsSelf: true,
            requireKind: DamageKind.Spell,
            aim: HookAim.Self,
            effects: [{ type: EffectType.ModifyStrike, factor: e.factor }],
          },
        ],
      };
    case 'regeneration':
      return {
        ...passive,
        hooks: [
          {
            on: HookName.OnRoundEnd,
            aim: HookAim.Self,
            effects: [
              {
                type:
                  e.resource === 'hp'
                    ? EffectType.RestoreHp
                    : EffectType.RestoreMp,
                power: `floor(source.level / ${e.levelDivisor})`,
              },
            ],
          },
        ],
      };
    case 'counter':
      return {
        ...passive,
        hooks: [
          {
            on: HookName.OnBeHit,
            retaliation: true,
            targetIsSelf: true,
            requireKind: DamageKind.Physical,
            chance: e.chance,
            aim: HookAim.HookSource,
            effects: [{ type: EffectType.PhysicalHit, coeff: e.coefficient }],
          },
        ],
      };
    case 'groupSpell':
    case 'spellHit':
      return {
        ...identity,
        costMp: e.costMp,
        tags: [SkillTag.Spell],
        formula: FormulaFamily.Spell,
        targeting:
          e.type === 'groupSpell'
            ? {
                side: TargetSide.Enemy,
                mode: TargetMode.Fill,
                count: `min(${e.maxTargets}, floor(skillLevel / ${e.levelsPerTarget}) + 1)`,
              }
            : { side: TargetSide.Enemy, count: 1 },
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
            on: HookName.OnHitCalc,
            sourceIsSelf: true,
            requireKind: DamageKind.Physical,
            effects: [
              { type: EffectType.ModifyStrike, factor: e.physicalFactor },
            ],
          },
          {
            on: HookName.AfterHit,
            sourceIsSelf: true,
            when: {
              skillIds: [BUILTIN_SKILL_ID.Attack],
              targetAbsentSkillIds: [
                'beast.reflection',
                'beast.advanced-reflection',
              ],
            },
            requireKind: DamageKind.Physical,
            chance: e.chance,
            aim: HookAim.HookTarget,
            effects: [{ type: EffectType.PhysicalHit, coeff: e.coefficient }],
          },
        ],
      };
  }
}
