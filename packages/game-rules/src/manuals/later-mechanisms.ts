import { DamageOrigin, EffectType, HookAim, HookName, SkillTag, StatusCategory, StatusFlag, StatusRemoveReason, TargetMode, TargetSide, TickKind } from '@daoyou/combat-core/enums';
import type { EffectWhen, SkillDef, SkillEffect, SkillHook, StatusDef } from '@daoyou/combat-core/types';
import type { ManualMechanism } from '@daoyou/game-domain/manuals/authoring';

// Classify the effect rather than its sect or ID. Mixed rule/command states
// remain excluded even when they also carry a numeric bonus.
const numericFields = new Set([
  'speedMod', 'attrMods', 'damageTakenPhysical', 'damageTakenSpell', 'damageDealtPhysical',
  'damageDealtSpell', 'healTaken', 'healDealt', 'physicalDefenseIgnore', 'damageTakenFromSource', 'sealHitTakenFactor',
]);
const numericMetadata = new Set([
  'id', 'name', 'kind', 'category', 'school', 'sourceBound', 'snapshotModifiers',
  'expireSameRound', 'maxStacks', 'extendable', 'priority', 'untilBattleEnd', 'consumeAfterDamagingAction',
]);
const numericModifierFields = new Set([
  'damageBonus', 'damageTakenBonus', 'allDamageTakenBonus', 'damageTakenAdd',
  'defenseIgnoreAdd', 'critChanceAdd', 'physicalFuryChanceAdd', 'sealResistanceAdd', 'healTaken', 'healDealt',
]);

export function classifyManualStatuses(statuses: StatusDef[]): StatusDef[] {
  return statuses.map((status) => {
    if (status.dispellable === false || status.dispelClass) return status;
    let dispelClass: string | undefined;
    if (status.category === StatusCategory.Dot && status.onTick?.type === TickKind.Dot && (status.onTick.ratioOfMaxHp ?? 0) > 0)
      dispelClass = 'hp-dot';
    else if (status.category === StatusCategory.Control && !status.blocksRevive)
      dispelClass = 'seal';
    else if (status.category === StatusCategory.Buff || status.category === StatusCategory.Debuff) {
      const numeric = Object.keys(status).some(key => numericFields.has(key)) || (status.modifiers?.length ?? 0) > 0;
      const pure = Object.keys(status).every(key => numericFields.has(key) || numericMetadata.has(key) || key === 'dispellable' || key === 'modifiers');
      const modifiers = status.modifiers?.every(modifier => Object.keys(modifier).every(key => key === 'when'
        ? Object.keys(modifier.when ?? {}).every(condition => condition === 'requireKind' || condition === 'damageOrigins')
        : numericModifierFields.has(key)));
      if (numeric && pure && modifiers !== false)
        dispelClass = status.category === StatusCategory.Buff ? 'numeric-buff' : 'numeric-debuff';
    }
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
  ...direct, rootActionOnly: true,
  excludeSkillTags: [SkillTag.Passive], excludePercentageDamage: true,
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
        when: { rootActionOnly: true, sourceStanding: true, actionSucceeded: true, actionHealedTarget: true, excludeSkillTags: [SkillTag.Passive],
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
        when: { sourceStanding: true, ...(manual.mechanism.type === 'dotDamage' ? { targetEnemy: true } : {}) },
        effects: [{ type: EffectType.ModifyStrike, factor: manual.mechanism.type === 'dotDamage' ? 1 + value : 1 - value }] }];
      break;
    case 'secondaryMitigation':
      hooks = defense(1 - value, { targetSlot: 'secondary' });
      break;
    case 'barrierDamage':
      modifiers = (['physical', 'spell'] as const).map(kind => ({ when: { ...active, requireKind: kind }, barrierDrainBonus: value }));
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
        when: { ...active, targetSlot: 'primary' },
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
        when: { ...active, targetStatusDispelClasses: ['numeric-debuff', 'hp-dot', 'seal', 'art'],
          targetStatusCategories: [StatusCategory.Debuff, StatusCategory.Dot, StatusCategory.Control], targetStatusEnemyApplied: true },
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
      hooks = defense(1 - value, { rootActionOnly: true, repeatedIncomingSkill: true });
      break;
    case 'unhurtRecovery':
      hooks = [{ on: HookName.OnRoundEnd, aim: HookAim.Self,
        when: { sourceStanding: true, expression: `min(roundHpLoss == 0, min(source.hp < source.maxHp, fact.${id}.uses < 3)) > 0` },
        effects: [{ type: EffectType.RestoreHp, power: `floor(source.maxHp * ${value})`, gainCounter: `${id}.uses` }] }];
      break;
    case 'attackDispel':
      hooks = [{ on: HookName.AfterHit, sourceIsSelf: true,
        when: { ...active, targetSlot: 'primary', targetStatusDispelClasses: ['numeric-buff', 'art'],
          targetStatusCategories: [StatusCategory.Buff], expression: `round >= fact.${next}` },
        effects: [fact(next, 'round + 2'), { type: EffectType.Dispel, requireCategories: [StatusCategory.Buff], dispelClasses: ['numeric-buff', 'art'], maxCount: 1, chance: value }] }];
      break;
    case 'selfCleanse':
      hooks = [{ on: HookName.OnRoundStart, aim: HookAim.Self,
        when: { sourceStanding: true, sourceStatusDispelClasses: ['numeric-debuff', 'hp-dot', 'art'],
          sourceStatusCategories: [StatusCategory.Debuff, StatusCategory.Dot], sourceStatusEnemyApplied: true },
        effects: [{ type: EffectType.Dispel, requireCategories: [StatusCategory.Debuff, StatusCategory.Dot], dispelClasses: ['numeric-debuff', 'hp-dot', 'art'], enemyAppliedOnly: true, maxCount: 1, chance: value }] }];
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
