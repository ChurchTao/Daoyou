/**
 * 战场查询。standing = 可出手/可被单体选中；板凳宠不算存活，挡不住灭队。
 */
import { oppositeSide } from "./enums.ts"
import type { BattleState, Side, Unit, UnitId } from "./types.ts"
import { isStanding } from "./units.ts"

export function unitById(state: BattleState, id: UnitId): Unit {
  const unit = state.units.find((u) => u.id === id)
  if (!unit) throw new Error(`unknown unit: ${id}`)
  return unit
}

export function tryUnit(state: BattleState, id: UnitId): Unit | undefined {
  return state.units.find((u) => u.id === id)
}

export function standingUnits(state: BattleState, side?: Side): Unit[] {
  return state.units.filter((u) => isStanding(u) && (side === undefined || u.side === side))
}

export function enemiesOf(state: BattleState, unit: Unit): Unit[] {
  return standingUnits(state, oppositeSide(unit.side)).sort((a, b) => a.slot - b.slot)
}

export function alliesOf(state: BattleState, unit: Unit): Unit[] {
  return standingUnits(state, unit.side).sort((a, b) => a.slot - b.slot)
}

export function firstEnemy(state: BattleState, unit: Unit): Unit | undefined {
  return enemiesOf(state, unit)[0]
}

/** 场上没有可站立单位即为灭队（倒地、死亡、逃跑、未召唤的板凳宠都不算）。 */
export function teamWiped(state: BattleState, side: Side): boolean {
  return standingUnits(state, side).length === 0
}

export function teamFled(state: BattleState, side: Side): boolean {
  const members = state.units.filter((u) => u.side === side)
  return members.length > 0 && members.every((u) => u.flags.escaped || u.flags.dead || u.flags.downed) &&
    members.some((u) => u.flags.escaped)
}
