import {
  DamageOrigin,
  EffectType,
  HookAim,
  HookName,
  SkillTag,
  StatusCategory,
  TargetSide,
  type EffectWhen,
  type SkillDef,
  type SkillHook,
} from '../core';
import type { ManualMechanism } from './pack';

export function manualMechanismValue(
  mechanism: ManualMechanism,
  level: number,
): number {
  return Number(
    (
      mechanism.valueAt1 +
      ((mechanism.valueAt9 - mechanism.valueAt1) * (level - 1)) / 8
    ).toFixed(8),
  );
}

function conditionWhen(condition: ManualMechanism['condition']): EffectWhen {
  switch (condition) {
    case 'always':
      return {};
    case 'selfHpBelow50':
      return { sourceHpRatioBelow: 0.5 };
    case 'selfHpBelow35':
      return { sourceHpRatioBelow: 0.35 };
    case 'selfHpAbove70':
      return { sourceHpRatioAbove: 0.7 };
    case 'targetHpBelow50':
      return { targetHpRatioBelow: 0.5 };
    case 'targetHpBelow35':
      return { targetHpRatioBelow: 0.35 };
    case 'targetHpAbove70':
      return { targetHpRatioAbove: 0.7 };
    case 'selfMpBelow50':
      return { sourceMpRatioBelow: 0.5 };
    case 'selfMpAbove50':
      return { sourceMpRatioAbove: 0.5 };
    case 'selfMpAbove70':
      return { sourceMpRatioAbove: 0.7 };
    case 'defending':
      return { sourceDefending: true };
    case 'selfBarrier':
      return { sourceHasBarrier: true };
    case 'targetBarrier':
      return { targetHasBarrier: true };
    case 'targetDot':
      return { targetStatusCategories: [StatusCategory.Dot] };
    case 'selfControl':
      return { sourceRemovableControl: true };
    case 'selfDebuff':
      return { sourceStatusCategories: [StatusCategory.Debuff] };
  }
}

export function compileManualSkill(
  manual: { id: string; name: string; mechanism: ManualMechanism },
  level: number,
): SkillDef {
  const mechanism = manual.mechanism;
  const value = manualMechanismValue(mechanism, level);
  const when: EffectWhen = {
    ...conditionWhen(mechanism.condition),
    sourceStanding: true,
  };
  const direct: EffectWhen = {
    ...when,
    damageOrigins: [DamageOrigin.ActionDirect],
  };
  const active: EffectWhen = {
    ...direct,
    excludeSkillTags: [SkillTag.Art, SkillTag.Passive],
    targetSlot: 'primary',
    excludePercentageDamage: true,
  };
  let hooks: SkillHook[] = [];
  switch (mechanism.type) {
    case 'damage':
    case 'mitigation':
      hooks = mechanism.kinds.map((kind) => ({
        on: HookName.OnHitCalc,
        ...(mechanism.type === 'damage'
          ? { sourceIsSelf: true }
          : { targetIsSelf: true }),
        requireKind: kind,
        when: mechanism.type === 'damage' ? active : direct,
        effects: [
          {
            type: EffectType.ModifyStrike,
            factor: mechanism.type === 'damage' ? 1 + value : 1 - value,
          },
        ],
      }));
      break;
    case 'heal':
    case 'barrier':
      hooks = [
        {
          on:
            mechanism.type === 'heal'
              ? HookName.OnHealCalc
              : HookName.OnBarrierCalc,
          sourceIsSelf: true,
          when: active,
          effects: [
            {
              type:
                mechanism.type === 'heal'
                  ? EffectType.ModifyHeal
                  : EffectType.ModifyBarrier,
              factor: 1 + value,
            },
          ],
        },
      ];
      break;
    case 'evasion':
      hooks = [
        {
          on: HookName.OnHitRoll,
          targetIsSelf: true,
          requireKind: 'physical',
          when: direct,
          effects: [{ type: EffectType.ModifyChance, add: -value }],
        },
      ];
      break;
    case 'restoreHp':
    case 'restoreMp':
      hooks = [
        {
          on: HookName.OnRoundEnd,
          aim: HookAim.Self,
          when,
          effects: [
            {
              type:
                mechanism.type === 'restoreHp'
                  ? EffectType.RestoreHp
                  : EffectType.RestoreMp,
              power: `floor(source.${mechanism.type === 'restoreHp' ? 'maxHp' : 'maxMp'} * ${value})`,
            },
          ],
        },
      ];
      break;
    case 'sealResist':
      break; // Compiled as ruleset-scaled panel points, before seal caps.
  }
  return {
    id: `${manual.id}.passive`,
    name: manual.name,
    tags: [SkillTag.Passive],
    targeting: { side: TargetSide.Self },
    effects: [],
    hooks,
  };
}
