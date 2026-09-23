import type { BattleContext } from './context';
import { evalExpr } from './expr';
import { passiveSkills, skillOf } from './skills';
import type { CombatModifier, SkillDef, Unit } from './types';
import { isStanding } from './units';
import { matchesWhen, type WhenScope } from './when';

export function combatModifiers(ctx: BattleContext, source: Unit, scope: Omit<WhenScope, 'source'> = {}): CombatModifier[] {
  const result: CombatModifier[] = [];
  const auraGroups = new Set<string>();
  for (const owner of ctx.state.units) {
    if (owner.side !== source.side) continue;
    for (const passive of [...passiveSkills(ctx.skills, owner), ...owner.skills.flatMap(id => { const skill = skillOf(ctx.skills, owner, id); return skill ? [skill] : []; })]) {
      for (const modifier of passive.modifiers ?? []) {
        if (owner.id !== source.id && !modifier.teamAura) continue;
        if (modifier.teamAura && (!isStanding(owner) || auraGroups.has(modifier.teamAura))) continue;
        if (!matchesWhen(ctx, modifier.when, { ...scope, source })) continue;
        if (modifier.teamAura) auraGroups.add(modifier.teamAura);
        result.push(modifier);
      }
    }
  }
  for (const status of source.statuses) {
    for (const modifier of status.snapshotModifiers ?? ctx.statusDefs.get(status.id)?.modifiers ?? [])
      if (matchesWhen(ctx, modifier.when, { ...scope, source })) result.push(modifier);
  }
  return result;
}

export function modifierValue(modifiers: CombatModifier[], key: keyof CombatModifier, source: Unit, target?: Unit, skill?: SkillDef, ctx?: BattleContext): number {
  return modifiers.reduce((sum, modifier) => {
    const value = modifier[key];
    return sum + (typeof value === 'number' || typeof value === 'string'
      ? evalExpr(value, { state: ctx?.state, source, target, skillLevel: skill ? source.skillLevels[skill.id] ?? source.level : source.level, targets: 1 }) : 0);
  }, 0);
}

export function isReviveBlocked(ctx: BattleContext, target: Unit): boolean {
  return !combatModifiers(ctx, target).some(m => m.ignoreReviveBlock) && target.statuses.some(s => ctx.statusDefs.get(s.id)?.blocksRevive);
}

export function sealHitTakenFactor(ctx: Pick<BattleContext, 'skills' | 'statusDefs'>, target: Unit, ignoredKinds: string[] = []): number {
  const factors = [
    ...passiveSkills(ctx.skills, target).map(s => s.innate?.sealHitTakenFactor ?? 1),
    ...target.statuses.filter(s => !ignoredKinds.includes(s.kind)).map(s => ctx.statusDefs.get(s.id)?.sealHitTakenFactor ?? 1),
  ];
  return factors.reduce((factor, value) => factor * value, 1);
}
