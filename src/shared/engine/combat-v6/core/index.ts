/**
 * 梦幻回合制战斗内核。Host 用 createBattle / submit / lockAndResolve；
 * 内容、Daoyou 公式和角色投影均由 core 上层注入。
 */
export { createBattle, BattleSession } from "./session.ts"
export { SeededRng } from "./rng.ts"
export { HookBus, type HookContext, type HookFn } from "./hooks.ts"
export { evalExpr, skillLevelOf } from "./expr.ts"
export { DEFAULT_ATTRS, createUnit, effectiveSpeed, effectiveAttrs, isStanding, isActionable, resourceOf } from "./units.ts"
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
  AttrName,
  BattleEvent,
  BattleResult,
  BattleState,
  Command,
  CombatV6VersionStamp,
  CombatResourceState,
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
  SkillHook,
  SkillTargeting,
  StatusDef,
  StatusId,
  StatusInstance,
  Unit,
  UnitFlags,
  UnitId,
} from "./types.ts"
