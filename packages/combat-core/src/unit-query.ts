import { oppositeSide } from './enums.js';
import type { BattleState, SkillDef, StatusDef, Unit, UnitId } from './types.js';
import type { Side } from './enums.js';
import { healTakenFactor, isStanding, recoverableHp } from './units.js';
import { passiveSkills, skillOf } from './skills.js';

type VisibilityContext = {
  skills: ReadonlyMap<string, SkillDef>;
  statusDefs: ReadonlyMap<string, StatusDef>;
};

export function sourceRevealsStealth(ctx: VisibilityContext, source: Unit): boolean {
  return source.statuses.some(status => ctx.statusDefs.get(status.id)?.revealStealth) ||
    source.passives.some(id => skillOf(ctx.skills, source, id)?.innate?.revealStealth);
}

export function isUntargetableBy(ctx: VisibilityContext, source: Unit, target: Unit): boolean {
  return !sourceRevealsStealth(ctx, source) && target.statuses.some(status => ctx.statusDefs.get(status.id)?.untargetable);
}

/** Ordinary standing ally pool, before skill-specific restrictions. */
export function selectableAllyTargets(
  source: Unit,
  units: readonly Unit[],
  skills: ReadonlyMap<string, SkillDef> = new Map(),
  statusDefs: ReadonlyMap<string, StatusDef> = new Map(),
): Unit[] {
  return units.filter(target => target.side === source.side && isStanding(target) && !target.flags.capturedBy &&
    !isUntargetableBy({ skills, statusDefs }, source, target))
    .sort((a, b) => a.slot - b.slot);
}

/** Ordinary ally-target legality plus a positive, recoverable HP deficit. */
export function injuredAllyTargets(
  source: Unit,
  units: readonly Unit[],
  skills: ReadonlyMap<string, SkillDef> = new Map(),
  statusDefs: ReadonlyMap<string, StatusDef> = new Map(),
): Unit[] {
  return selectableAllyTargets(source, units, skills, statusDefs).filter(target =>
    target.attrs.hp < recoverableHp(target) && healTakenFactor(target) > 0 &&
    !passiveSkills(skills, target).some(passive => passive.innate?.rejectHpRecovery));
}

export function unitById(state: BattleState, id: UnitId): Unit {
  const unit = state.units.find((u) => u.id === id);
  if (!unit) throw new Error(`unknown unit: ${id}`);
  return unit;
}

export function tryUnit(state: BattleState, id: UnitId): Unit | undefined {
  return state.units.find((u) => u.id === id);
}

export function standingUnits(state: BattleState, side?: Side): Unit[] {
  return state.units.filter(
    (u) => isStanding(u) && (side === undefined || u.side === side),
  );
}

export function enemiesOf(state: BattleState, unit: Unit): Unit[] {
  return standingUnits(state, oppositeSide(unit.side)).sort(
    (a, b) => a.slot - b.slot,
  );
}

export function alliesOf(state: BattleState, unit: Unit): Unit[] {
  return standingUnits(state, unit.side).sort((a, b) => a.slot - b.slot);
}

export function firstEnemy(state: BattleState, unit: Unit): Unit | undefined {
  return enemiesOf(state, unit)[0];
}

/** 场上没有可站立单位即为灭队（倒地、死亡、逃跑、未召唤的板凳宠都不算）。 */
export function teamWiped(state: BattleState, side: Side): boolean {
  return standingUnits(state, side).length === 0;
}

export function teamFled(state: BattleState, side: Side): boolean {
  const members = state.units.filter((u) => u.side === side);
  return (
    members.length > 0 &&
    members.every((u) => u.flags.escaped || u.flags.dead || u.flags.downed) &&
    members.some((u) => u.flags.escaped)
  );
}
