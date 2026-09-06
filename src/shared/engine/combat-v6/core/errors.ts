/** 引擎可捕获错误。Host 应用 `code` 分支，不要解析 message。 */

export class BattleError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = "BattleError"
    this.code = code
  }
}

export const ErrorCode = {
  LineupEmpty: "lineup-empty",
  BothSidesRequired: "both-sides-required",
  DuplicateUnit: "duplicate-unit",
  UnknownOwner: "unknown-owner",
  CommandsLocked: "commands-locked",
  UnitCannotAct: "unit-cannot-act",
  NotCommandPhase: "not-command-phase",
} as const
