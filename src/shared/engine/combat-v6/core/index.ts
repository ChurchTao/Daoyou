/**
 * 梦幻回合制战斗内核。Host 用 createBattle / submit / lockAndResolve；
 * 内容在 @mhxy/data，公式在 @mhxy/rules-xyq。
 */
export { createBattle, BattleSession } from "./session.ts"
export { SeededRng } from "./rng.ts"
export { HookBus, type HookContext, type HookFn } from "./hooks.ts"
export { evalExpr, skillLevelOf } from "./expr.ts"
export { DEFAULT_ATTRS, createUnit, effectiveSpeed, effectiveAttrs, isStanding, isActionable } from "./units.ts"
export { skillOf } from "./skills.ts"
export { standingUnits, enemiesOf, alliesOf, unitById } from "./query.ts"
export { BattleError, ErrorCode } from "./errors.ts"
export { validateLineup } from "./validate.ts"
export {
  BattlePhase,
  CommandPolicy,
  CommandType,
  DamageKind,
  EffectType,
  EventType,
  ExprFn,
  ExprVar,
  FailReason,
  failDetail,
  FormulaFamily,
  HookAim,
  HookName,
  HpZeroOutcome,
  MatchWinner,
  oppositeSide,
  ResultReason,
  SkipReason,
  SkillTag,
  StatusCategory,
  StatusFlag,
  StatusHit,
  StatusRemoveReason,
  StatusTick,
  TargetMode,
  TargetSide,
  Team,
  TickKind,
  UnitKind,
} from "./enums.ts"
export { ATTR_NAMES, BUILTIN_SKILL_ID, MIN_DAMAGE, MIN_HP } from "./constants.ts"

export type {
  Attrs,
  BattleEvent,
  BattleResult,
  BattleState,
  Command,
  CreateBattleInput,
  DecideCommandInput,
  EffectWhen,
  Expr,
  ExprEnv,
  FormulaSet,
  SchoolTerm,
  SplashSpec,
  StrikeFormulaInput,
  LineupUnit,
  Ruleset,
  Side,
  SkillDef,
  SkillEffect,
  SkillId,
  SkillTargeting,
  StatusDef,
  StatusId,
  StatusInstance,
  Unit,
  UnitFlags,
  UnitId,
} from "./types.ts"
