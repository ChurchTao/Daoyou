import { ErrorCode, BattleError } from "./errors.ts"
import { Team } from "./enums.ts"
import type { LineupUnit } from "./types.ts"

/**
 * 开打前的入场校验。技能表允许同 id 后写覆盖（测试覆盖兽决概率），单位 id 不允许重复。
 */
export function validateLineup(units: LineupUnit[]): void {
  if (units.length === 0) {
    throw new BattleError(ErrorCode.LineupEmpty, "阵容不能为空")
  }

  const sides = new Set(units.map((u) => u.side))
  if (!sides.has(Team.A) || !sides.has(Team.B)) {
    throw new BattleError(ErrorCode.BothSidesRequired, "必须同时存在双方单位")
  }

  const ids = new Set<string>()
  for (const unit of units) {
    if (!unit.id) continue
    if (ids.has(unit.id)) {
      throw new BattleError(ErrorCode.DuplicateUnit, `重复单位 id: ${unit.id}`)
    }
    ids.add(unit.id)
  }

  for (const unit of units) {
    if (!unit.ownerId) continue
    const owner = units.find((u) => u.id === unit.ownerId)
    if (!owner) {
      throw new BattleError(ErrorCode.UnknownOwner, `召唤兽 ${unit.id ?? unit.name} 的主人 ${unit.ownerId} 不存在`)
    }
  }
}
