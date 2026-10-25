import { DamageOrigin, EffectType, HookAim, HookName, SkillTag, StatusCategory, StatusFlag, StatusRemoveReason, TargetMode, TargetSide } from '@daoyou/combat-core/enums';
import type { EffectWhen, SkillDef, SkillEffect, SkillHook, StatusDef } from '@daoyou/combat-core/types';
import { COMBAT_V6_SECT_DEFINITIONS } from '@daoyou/game-content/sects';
import type { ManualMechanism } from '@daoyou/game-domain/manuals/authoring';

// Explicit content support: rule markers, forms, seals and non-dispellable costs
// must not become ordinary numeric buffs merely because they share a category.
const numericDebuffs = new Set([
  'lingxiao.status.wound', 'youdu.status.slow', 'youdu.status.slow_strong',
  'youdu.status.siphon', 'youdu.status.siphon_strong', 'tianyan.status.bind', 'tianyan.status.weaken',
  'tianyan.status.weaken_deep', 'tianyan.status.truce', 'tianyan.status.truce_deep',
  'tianyan.status.spell_dull', 'tianyan.status.spell_dull_deep',
  'tianyan.status.foundation_break', 'tianyan.status.melt',
  'jiujie.status.magic_break', 'jiujie.status.physical_break',
]);
const numericBuffs = new Set([
  'lingxiao.status.sword_aura', 'lingxiao.status.sword_aura_ganjiang',
  'lingxiao.status.clarity', 'lingxiao.status.clarity_anshen',
  'lingxiao.status.shadow', 'lingxiao.status.pride',
  'youdu.status.revival', 'youdu.status.enter_soul', 'youdu.status.evil_flame',
  'wuxiang.status.insight', 'wuxiang.status.insight_self', 'wuxiang.status.initiative',
  'tianyan.status.ward', 'tianyan.status.ward_deep', 'tianyan.status.adapt',
  'jiujie.status.guardian', 'jiujie.status.insight',
]);
export const MANUAL_HP_DOT_IDS = Object.values(COMBAT_V6_SECT_DEFINITIONS)
  .flatMap((sect) => sect.statuses)
  .filter((status) => status.category === StatusCategory.Dot && status.onTick?.ratioOfMaxHp !== undefined)
  .map((status) => status.id);
const activeSkills = [...new Set(Object.values(COMBAT_V6_SECT_DEFINITIONS).flatMap((sect) => [
  ...sect.skills,
  ...sect.paths.flatMap((path) => [
    ...(path.grantSkills ?? []),
    ...path.nodes.flatMap((node) => node.grantSkills ?? []),
  ]),
]).filter((skill) => skill.kind === 'active').map((skill) => skill.definition.id))];
const healingSkills = ['wuxiang.skill.nectar', 'wuxiang.skill.renew'];

export function classifyManualStatuses(statuses: StatusDef[]): StatusDef[] {
  return statuses.map((status) => {
    if (status.dispellable === false) return status;
    const dispelClass = numericDebuffs.has(status.id) ? 'numeric-debuff'
      : numericBuffs.has(status.id) ? 'numeric-buff'
      : MANUAL_HP_DOT_IDS.includes(status.id) ? 'hp-dot' : undefined;
    return dispelClass ? { ...status, dispelClass } : status;
  });
}

type Manual = { id: string; name: string; mechanism: ManualMechanism };
// Status definitions are shared by every actor in a battle, unlike skill
// overrides. Distinct strengths therefore need distinct IDs and a stable kind.
function strengthStatusId(manual: Manual, kind: string, value: number): string {
  return `${manual.id}.${kind}.${Math.round(value * 100_000_000)}`;
}
const direct: EffectWhen = { damageOrigins: [DamageOrigin.ActionDirect], sourceStanding: true };
const active: EffectWhen = {
  ...direct, skillIds: activeSkills, rootActionOnly: true,
  excludeSpellRepeat: true, excludePercentageDamage: true,
};
const livingAlly = {
  side: TargetSide.Ally, mode: TargetMode.Explicit, count: 1, requireKind: 'player' as const,
};
function shield(manual: Manual, power: string, maxPower?: string): SkillEffect {
  return { type: EffectType.ApplyBarrier, id: `${manual.id}.barrier`, kind: `${manual.id}.barrier`,
    name: manual.name, power, maxPower, duration: 1, stack: false };
}
function fact(key: string, value: string | number): SkillEffect {
  return { type: EffectType.ModifyFact, key, value };
}
function defense(factor: string | number, when: EffectWhen = {}): SkillHook[] {
  return (['physical', 'spell'] as const).map((kind) => ({
    on: HookName.OnHitCalc, targetIsSelf: true, sourceIsEnemy: true, requireKind: kind,
    when: { ...direct, ...when }, effects: [{ type: EffectType.ModifyStrike, factor }],
  }));
}
export function compileManualStatusDefs(manual: Manual, value: number): StatusDef[] {
  switch (manual.mechanism.type) {
    case 'sealRecovery':
      return [{ id: strengthStatusId(manual, 'respite', value), kind: `${manual.id}.respite`, name: '神念澄明',
        category: StatusCategory.Buff, dispelClass: 'numeric-buff', sealHitTakenFactor: 1 - value }];
    case 'defendWeaken':
      return [
        { id: `${manual.id}.ready`, kind: `${manual.id}.ready`, name: '金刚待发', category: StatusCategory.Buff },
        { id: strengthStatusId(manual, 'weaken', value), kind: `${manual.id}.weaken`, name: '折锋', category: StatusCategory.Debuff,
          dispelClass: 'numeric-debuff', damageDealtPhysical: 1 - value, damageDealtSpell: 1 - value,
          consumeAfterDamagingAction: true, priority: value },
      ];
    default: return [];
  }
}

/** Bounded high-realm passives compile to generic core hooks, never book-ID branches in core. */
export function compileLaterManualSkill(manual: Manual, value: number): SkillDef | undefined {
  const id = manual.id;
  const next = `${id}.next`;
  let hooks: SkillHook[] = [];
  let modifiers: SkillDef['modifiers'];
  switch (manual.mechanism.type) {
    case 'sealRecovery': {
      const when: EffectWhen = {
        sourceStanding: true, removedStatusCategory: StatusCategory.Control,
        removedStatusDispellable: true,
        excludedRemovedStatusFlags: [StatusFlag.BlocksRevive], expression: `round >= fact.${next}`,
      };
      hooks = [
        { statusRemoveReason: StatusRemoveReason.Expired },
        { statusRemoveReason: StatusRemoveReason.Dispel, statusRemovedByAlly: true },
      ].map((reason) => ({ on: HookName.OnStatusRemoved, targetIsSelf: true, sourceIsEnemy: true,
        when: { ...when, ...reason }, aim: HookAim.Self,
        effects: [fact(next, 'round + 1'), { type: EffectType.ApplyStatus, statusId: strengthStatusId(manual, 'respite', value), duration: 1 }],
      }));
      break;
    }
    case 'primaryDamage':
    case 'secondaryDamage':
      hooks = (['physical', 'spell', 'fixed'] as const).map((kind) => ({
        on: HookName.OnHitCalc, sourceIsSelf: true, requireKind: kind,
        when: { ...active, targetSlot: manual.mechanism.type === 'primaryDamage' ? 'primary' : 'secondary' },
        effects: [{ type: EffectType.ModifyStrike, factor: 1 + value }],
      }));
      break;
    case 'healingBarrier':
      hooks = [{ on: HookName.AfterAction, sourceIsSelf: true, targeting: livingAlly,
        when: { rootActionOnly: true, actionSucceeded: true, skillIds: healingSkills,
          targetDead: false, targetDowned: false, targetEnemy: false, foeKind: 'player',
          expression: `round >= fact.${next}` },
        effects: [fact(next, 'round + 1'), shield(manual, `floor(target.maxHp * ${value})`, `floor(source.maxHp * ${value})`)],
      }];
      break;
    case 'followupMitigation':
      hooks = [
        ...(['physical', 'spell'] as const).map((kind): SkillHook => ({
          on: HookName.AfterDamage, targetIsSelf: true, sourceIsEnemy: true, requireKind: kind,
          when: { ...direct, expression: 'hpDamage > 0' }, aim: HookAim.Self,
          effects: [fact(`${id}.hurtRound`, 'round')],
        })),
        ...defense(1 - value, { expression: `round == fact.${id}.hurtRound` }),
      ];
      break;
    case 'focusedPhysical':
      hooks = [{ on: HookName.OnDefenseIgnoreCalc, sourceIsSelf: true, requireKind: 'physical',
        when: { ...active, targetSlot: 'primary', sameAttackTarget: true, previousAttackKind: 'physical' },
        effects: [{ type: EffectType.ModifyDefenseIgnore, add: value }] }];
      break;
    case 'defendBarrier':
      hooks = [{ on: HookName.AfterDefend, sourceIsSelf: true, aim: HookAim.Self,
        when: { sourceStanding: true }, effects: [shield(manual, `floor(source.maxHp * ${value})`)] }];
      break;
    case 'dotMitigation':
    case 'dotDamage':
      hooks = [{ on: HookName.OnDotCalc, requireKind: 'fixed',
        ...(manual.mechanism.type === 'dotDamage' ? { sourceIsSelf: true } : { targetIsSelf: true, sourceIsEnemy: true }),
        when: { sourceStanding: true, dotStatusIds: MANUAL_HP_DOT_IDS },
        effects: [{ type: EffectType.ModifyStrike, factor: manual.mechanism.type === 'dotDamage' ? 1 + value : 1 - value }] }];
      break;
    case 'secondaryMitigation':
      hooks = defense(1 - value, { targetSlot: 'secondary' });
      break;
    case 'barrierDamage':
      modifiers = [{ when: { ...active, requireKind: 'spell' }, barrierDrainBonus: value }];
      break;
    case 'adaptiveMitigation': {
      const recorded = `${id}.recorded`;
      const kindFact = `${id}.kind`;
      const adapted = `${id}.adapted`;
      hooks = [
        { on: HookName.OnRoundStart, aim: HookAim.Self, effects: [fact(adapted,
          `(fact.${recorded} == round - 1) * fact.${kindFact}`)] },
        ...(['physical', 'spell'] as const).flatMap((kind, index): SkillHook[] => [
          { on: HookName.AfterDamage, targetIsSelf: true, sourceIsEnemy: true, requireKind: kind,
            when: { ...direct, expression: 'hpDamage > 0' }, aim: HookAim.Self,
            effects: [fact(recorded, 'round'), fact(kindFact, index + 1)] },
          ...defense(1 - value, { expression: `fact.${adapted} == ${index + 1}` }).filter((hook) => hook.requireKind === kind),
        ]),
      ];
      break;
    }
    case 'openingBarrier':
      hooks = [{ on: HookName.OnRoundStart, aim: HookAim.Self,
        when: { sourceStanding: true, oncePerBattle: true, expression: 'round == 1' },
        effects: [shield(manual, `floor(source.maxMp * ${value})`, `floor(source.maxHp * ${value / 2})`)] }];
      break;
    case 'damageBarrier':
      hooks = [{ on: HookName.AfterAction, sourceIsSelf: true, aim: HookAim.Self,
        when: { ...active, actionSucceeded: true, expression: `min(hpDamage, round >= fact.${next}) > 0` },
        effects: [fact(next, 'round + 1'), shield(manual, `floor(hpDamage * ${value})`, `floor(source.maxHp * ${value / 2})`)] }];
      break;
    case 'damageRecovery':
      hooks = [{ on: HookName.AfterHit, sourceIsSelf: true, aim: HookAim.Self,
        when: { ...active, excludeSpellRepeat: false, targetSlot: 'primary' },
        effects: [{ type: EffectType.RestoreHp, power: `floor(hpDamage * ${value})`, maxGainPerAction: `floor(source.maxHp * ${value / 2})` }] }];
      break;
    case 'heavyMitigation':
      hooks = defense(`1 - ${value} * max(0, damage - source.maxHp * 0.15) / max(1, damage)`);
      break;
    case 'physicalFury':
      modifiers = [{ when: { ...active, requireKind: 'physical' }, physicalFuryChanceAdd: value }];
      break;
    case 'debuffDefenseIgnore':
      hooks = [{ on: HookName.OnDefenseIgnoreCalc, sourceIsSelf: true, requireKind: 'spell',
        when: { ...active, targetStatusDispelClasses: ['numeric-debuff'] },
        effects: [{ type: EffectType.ModifyDefenseIgnore, add: value }] }];
      break;
    case 'defendWeaken':
      hooks = [
        { on: HookName.AfterDefend, sourceIsSelf: true, aim: HookAim.Self, when: { sourceStanding: true },
          effects: [fact(`${id}.prepared`, 'round + 1'), { type: EffectType.ApplyStatus, statusId: `${id}.ready`, duration: 1 }] },
        { on: HookName.AfterHit, sourceIsSelf: true, requireKind: 'physical',
          when: { ...active, targetSlot: 'primary', requireStatusIds: [`${id}.ready`], expression: `round == fact.${id}.prepared` },
          effects: [fact(`${id}.prepared`, 0),
            { type: EffectType.RemoveStatus, statusIds: [`${id}.ready`], targeting: { side: TargetSide.Self } },
            { type: EffectType.ApplyStatus, statusId: strengthStatusId(manual, 'weaken', value), duration: 1 }],
        },
        { on: HookName.AfterHit, sourceIsSelf: true, requireKind: 'spell',
          when: { ...active, targetSlot: 'primary', requireStatusIds: [`${id}.ready`], expression: `round == fact.${id}.prepared` },
          effects: [fact(`${id}.prepared`, 0),
            { type: EffectType.RemoveStatus, statusIds: [`${id}.ready`], targeting: { side: TargetSide.Self } },
            { type: EffectType.ApplyStatus, statusId: strengthStatusId(manual, 'weaken', value), duration: 1 }],
        },
      ];
      break;
    case 'repeatedMitigation':
      hooks = defense(1 - value, { rootActionOnly: true, skillIds: activeSkills, repeatedIncomingSkill: true });
      break;
    case 'unhurtRecovery':
      hooks = [{ on: HookName.OnRoundEnd, aim: HookAim.Self,
        when: { sourceStanding: true, expression: `min(roundHpLoss == 0, min(source.hp < source.maxHp, fact.${id}.uses < 3)) > 0` },
        effects: [{ type: EffectType.RestoreHp, power: `floor(source.maxHp * ${value})`, gainCounter: `${id}.uses` }] }];
      break;
    case 'attackDispel':
      hooks = [{ on: HookName.AfterHit, sourceIsSelf: true,
        when: { ...active, targetSlot: 'primary', targetStatusDispelClasses: ['numeric-buff'], expression: `round >= fact.${next}` },
        effects: [fact(next, 'round + 2'), { type: EffectType.Dispel, dispelClasses: ['numeric-buff'], maxCount: 1, chance: value }] }];
      break;
    case 'selfCleanse':
      hooks = [{ on: HookName.OnRoundStart, aim: HookAim.Self,
        when: { sourceStanding: true, sourceStatusDispelClasses: ['numeric-debuff', 'hp-dot'], sourceStatusEnemyApplied: true },
        effects: [{ type: EffectType.Dispel, dispelClasses: ['numeric-debuff', 'hp-dot'], enemyAppliedOnly: true, maxCount: 1, chance: value }] }];
      break;
    case 'preActionMitigation':
      hooks = [
        ...defense(1 - value, { expression: `round > fact.${id}.closed` }),
        { on: HookName.AfterActionWindow, sourceIsSelf: true, aim: HookAim.Self,
          effects: [fact(`${id}.closed`, 'round')] },
      ];
      break;
    default: return undefined;
  }
  return { id: `${id}.passive`, name: manual.name, tags: [SkillTag.Passive],
    targeting: { side: TargetSide.Self }, effects: [], hooks, ...(modifiers ? { modifiers } : {}) };
}
