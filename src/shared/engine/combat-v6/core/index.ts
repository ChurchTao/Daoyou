/**
 * 梦幻回合制战斗内核。Host 用 createBattle / submit / lockAndResolve；
 * 内容、Daoyou 公式和角色投影均由 core 上层注入。
 */
export { createBattle, restoreBattle, BattleSession } from "./session.ts"
export { SeededRng } from "./rng.ts"
export { HookBus, type HookContext, type HookFn } from "./hooks.ts"
export { evalExpr, skillLevelOf } from "./expr.ts"
export { DEFAULT_ATTRS, createUnit, effectiveSpeed, effectiveAttrs, isStanding, isActionable, resourceOf, recoverableHp } from "./units.ts"
export { absorbBarriers, applyBarrier, clearBarriers, tickBarriers } from "./barriers.ts"
export { skillOf } from "./skills.ts"
export { applyWound, changeWound } from "./damage.ts"
export { standingUnits, enemiesOf, alliesOf, unitById } from "./query.ts"
export { BattleError, ErrorCode } from "./errors.ts"
export { validateLineup } from "./validate.ts"
export {
  BattlePhase,
  CommandPolicy,
  CommandType,
  DamageKind,
  DamageOrigin,
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
  BarrierState,
  BattleEvent,
  BattleResult,
  BattleState,
  Command,
  CombatV6VersionStamp,
  CombatV6CommandOptions,
  CombatV6SkillCommandOption,
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
  RandomBranchEffect,
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
