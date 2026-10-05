/**
 * 梦幻回合制战斗内核。Host 用 createBattle / submit / lockAndResolve；
 * 内容、Daoyou 公式和角色投影均由 core 上层注入。
 */
export { createBattle, restoreBattle, BattleSession } from "./session.js"
export { SeededRng } from "./rng.js"
export { HookBus, type HookContext, type HookFn } from "./hooks.js"
export { evalExpr, skillLevelOf } from "./expr.js"
export { DEFAULT_ATTRS, createUnit, effectiveSpeed, effectiveAttrs, isStanding, isActionable, resourceOf, recoverableHp } from "./units.js"
export { absorbBarriers, applyBarrier, clearBarriers, tickBarriers } from "./barriers.js"
export { isActiveAttackSkill, skillOf } from "./skills.js"
export { applyWound, changeWound } from "./damage.js"
export { standingUnits, enemiesOf, alliesOf, unitById } from "./query.js"
export { BattleError, ErrorCode } from "./errors.js"
export { validateLineup } from "./validate.js"
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
} from "./enums.js"
export { ATTR_NAMES, BUILTIN_SKILL_ID, MIN_DAMAGE, MIN_HP } from "./constants.js"

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
} from "./types.js"
