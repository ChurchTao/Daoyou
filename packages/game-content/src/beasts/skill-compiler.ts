import { BUILTIN_SKILL_ID } from '@daoyou/combat-core/constants';
import { DamageKind, DamageOrigin, EffectType, FormulaFamily, HookAim, HookName, SkillTag, StatusCategory, StatusFlag, TargetMode, TargetSide } from '@daoyou/combat-core/enums';
import { type SkillDef } from '@daoyou/combat-core/types';
import type { BeastSkillContent } from '@daoyou/game-domain/beasts/authoring';

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
    case 'allSeeing':
      return {
        ...identity,
        cooldownRounds: e.cooldownRounds,
        tags: [SkillTag.Spell],
        targeting: { side: TargetSide.Enemy, count: 1 },
        effects: [{ type: EffectType.InvokeAttackSkills }],
      };
    case 'mountainBreaker':
      return {
        ...identity,
        costMp: `level + ${e.costMpBase}`,
        tags: [SkillTag.Physical],
        formula: FormulaFamily.AttackDifference,
        modifiers: [{ hitAdd: 'level * 2 + 10', when: { skillIds: [entry.id] } }],
        targeting: { side: TargetSide.Enemy, count: 1 },
        effects: [
          { type: EffectType.PhysicalHit, coeff: 1, power: 'level * 8' },
        ],
      };
    case 'karmicRetribution':
      return {
        ...identity,
        costMp: `level + ${e.costMpBase}`,
        tags: [SkillTag.Physical],
        formula: FormulaFamily.Physical,
        targeting: { side: TargetSide.Enemy, count: 1 },
        effects: [
          {
            type: EffectType.RandomBranch,
            branchId: `${entry.id}.karma`,
            chance: e.evilChance,
            successEffects: [
              {
                type: EffectType.PhysicalHit,
                resultFactors: [e.evilFactor],
                critMultiplier: 1.5,
                cannotMiss: true,
              },
            ],
            failureEffects: [
              {
                type: EffectType.PhysicalHit,
                resultFactors: [e.goodFactor],
                critMultiplier: 2,
                healInstead: true,
                cannotMiss: true,
              },
            ],
          },
        ],
      };
    case 'radiantBarrier':
      return {
        ...passive,
        hooks: [
          {
            on: HookName.AfterDamage,
            targetIsSelf: true,
            chance: e.chance,
            when: { sourceHpRatioAbove: 0 },
            aim: HookAim.Self,
            effects: [
              {
                type: EffectType.ApplyBarrier,
                id: `${entry.id}.barrier`,
                kind: entry.id,
                name: entry.name,
                power: `hpDamage * ${e.ratio}`,
                duration: 1,
                untilBattleEnd: true,
                stack: true,
                maxPower: `maxHp * ${e.maxHpRatio}`,
                decayPerRound: e.decayRatio,
              },
            ],
          },
        ],
      };
    case 'constitutionGrowthHp':
    case 'magicAttributeBoost':
    case 'strengthGrowthTradeoff':
      // Permanent attribute bonuses are applied by beastPanel for display and battle.
      return passive;
    case 'spellDefense':
      return {
        ...identity,
        costMp: `floor(level / ${e.costMpLevelDivisor}) + ${e.costMpBase}`,
        tags: [SkillTag.Spell],
        targeting: { side: TargetSide.Self, count: 1 },
        effects: [{ type: EffectType.ApplyStatus, statusId: `${entry.id}.status`, duration: e.duration }],
      };
    case 'swiftStrike':
      return {
        ...identity,
        costMp: `floor(level / ${e.costMpLevelDivisor}) + ${e.costMpBase}`,
        tags: [SkillTag.Spell],
        formula: FormulaFamily.Fixed,
        targeting: { side: TargetSide.Enemy, count: 1 },
        effects: [{
          type: EffectType.FixedHit,
          power: `(fact.strength * ${e.strengthMultiplier} + effective.speed / ${e.speedDivisor}) * if(targetIsPlayer + targetFact.isCharacter, ${e.playerFactor}, 1)`,
        }],
      };
    case 'barrierBreaker':
      return {
        ...identity,
        costMp: `level + ${e.costMpBase}`,
        tags: [SkillTag.Physical],
        formula: FormulaFamily.GuardBreak,
        targeting: { side: TargetSide.Enemy, count: 1 },
        effects: [{
          type: EffectType.PhysicalHit,
          coeff: e.defendFactor,
          power: `level * ${e.powerPerLevel}`,
          defenseSubtract: 'targetFact.defenseTraining',
          defendFactor: 1,
          cannotMiss: true,
        }],
      };
    case 'mindShatter':
      return {
        ...identity,
        costMp: `floor(level / ${e.costMpLevelDivisor}) + ${e.costMpBase}`,
        tags: [SkillTag.Physical],
        formula: FormulaFamily.Physical,
        targeting: { side: TargetSide.Enemy, count: 1 },
        effects: [{ type: EffectType.PhysicalHit, resultFactors: [e.physicalFactor], cannotMiss: true }],
        hooks: [{
          on: HookName.AfterStrike,
          sourceIsSelf: true,
          requireKind: DamageKind.Physical,
          when: { skillIds: [entry.id], targetHpRatioAbove: 0 },
          aim: HookAim.HookTarget,
          effects: [
            { type: EffectType.DamageMp, power: `(hpDamage / ${e.mpDamageDivisor} + level / ${e.mpLevelDivisor}) * ${e.mpDamageFactor}` },
            { type: EffectType.ApplyStatus, statusId: `${entry.id}.status`, duration: 1 },
          ],
        }],
      };
    case 'unanticipated':
      return {
        ...passive,
        hooks: [DamageKind.Physical, DamageKind.Spell, DamageKind.Fixed].map((kind) => ({
          on: HookName.OnHitCalc,
          sourceIsSelf: true,
          requireKind: kind,
          when: { expression: 'allyPetSkillUnused', damageOrigins: [DamageOrigin.ActionDirect] },
          effects: [{ type: EffectType.ModifyStrike, factor: e.factor }],
        })),
      };
    case 'bloodthirstyPursuit':
      return {
        ...passive,
        hooks: [
          {
            on: HookName.AfterAction,
            sourceIsSelf: true,
            when: {
              skillIds: [BUILTIN_SKILL_ID.Attack],
              actionReducedTargetToZero: true,
              oncePerRound: true,
            },
            aim: HookAim.Others,
            effects: [
              {
                type: EffectType.PhysicalHit,
                resultFactors: [e.factor],
              },
            ],
          },
        ],
      };
    case 'surpriseSpell':
      return {
        ...passive,
        hooks: [
          {
            on: HookName.OnHitCalc,
            sourceIsSelf: true,
            requireKind: DamageKind.Spell,
            when: {
              expression: 'if(entryRound >= 2, spellActionsSinceEntry == 0, 0)',
            },
            effects: [{ type: EffectType.ModifyStrike, factor: e.factor }],
          },
        ],
      };
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
        innate: e.immune ? { immuneStatusKinds: ['beast.poison', 'youdu.poison'] } : undefined,
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
