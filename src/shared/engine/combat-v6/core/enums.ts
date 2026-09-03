/**
 * 领域字符串的唯一来源。取值必须保持稳定：战报、黄金测试都依赖这些字面量。
 */

export const Team = {
  A: 0,
  B: 1,
} as const
export type Side = (typeof Team)[keyof typeof Team]

export const UnitKind = {
  Player: "player",
  Pet: "pet",
  Npc: "npc",
} as const
export type UnitKind = (typeof UnitKind)[keyof typeof UnitKind]

export const BattlePhase = {
  Command: "command",
  Resolve: "resolve",
  Ended: "ended",
} as const
export type BattlePhase = (typeof BattlePhase)[keyof typeof BattlePhase]

export const DamageKind = {
  Physical: "physical",
  Spell: "spell",
} as const
export type DamageKind = (typeof DamageKind)[keyof typeof DamageKind]

export const CommandType = {
  Attack: "attack",
  Skill: "skill",
  Defend: "defend",
  Protect: "protect",
  Item: "item",
  Summon: "summon",
  Catch: "catch",
  Flee: "flee",
  Auto: "auto",
} as const
export type CommandType = (typeof CommandType)[keyof typeof CommandType]

export const SkillTag = {
  Physical: "physical",
  Spell: "spell",
  Seal: "seal",
  Support: "support",
  Passive: "passive",
} as const
export type SkillTag = (typeof SkillTag)[keyof typeof SkillTag]

export const TargetSide = {
  Enemy: "enemy",
  Ally: "ally",
  Self: "self",
  Any: "any",
} as const
export type TargetSide = (typeof TargetSide)[keyof typeof TargetSide]

export const TargetMode = {
  Explicit: "explicit",
  Fill: "fill",
  All: "all",
  Random: "random",
  LowestHp: "lowestHp",
  LowestDef: "lowestDef",
} as const
export type TargetMode = (typeof TargetMode)[keyof typeof TargetMode]

export const CommandPolicy = {
  None: "none",
  Random: "random",
  StoredAttack: "storedAttack",
} as const
export type CommandPolicy = (typeof CommandPolicy)[keyof typeof CommandPolicy]

export const StatusCategory = {
  Buff: "buff",
  Debuff: "debuff",
  Control: "control",
  Dot: "dot",
} as const
export type StatusCategory = (typeof StatusCategory)[keyof typeof StatusCategory]

export const HookName = {
  BeforeAction: "beforeAction",
  OnHitCalc: "onHitCalc",
  /** 物理伤害公式前计算忽防比例。 */
  OnDefenseIgnoreCalc: "onDefenseIgnoreCalc",
  OnBeHit: "onBeHit",
  AfterHit: "afterHit",
  OnFatal: "onFatal",
  OnDeath: "onDeath",
  OnRoundStart: "onRoundStart",
  OnRoundEnd: "onRoundEnd",
  OnTargetLost: "onTargetLost",
  /** 一次出手（普攻或技能）全部效果结束后。skillId 在 HookContext 上。 */
  AfterAction: "afterAction",
  /** 必杀判定之后、乘倍之前。钩子可把 crit 置真。 */
  OnCritRoll: "onCritRoll",
  OnHitRoll: "onHitRoll",
  /** 治疗数字算出之后、入账之前。钩子可改 heal。 */
  OnHealCalc: "onHealCalc",
} as const
export type HookName = (typeof HookName)[keyof typeof HookName]

export const HookAim = {
  Self: "self",
  HookTarget: "hookTarget",
  HookSource: "hookSource",
  /** 除本次目标外的其他敌人（风刃溅射） */
  Others: "others",
} as const
export type HookAim = (typeof HookAim)[keyof typeof HookAim]

export const ResultReason = {
  Wipe: "wipe",
  Flee: "flee",
  RoundLimit: "round-limit",
} as const
export type ResultReason = (typeof ResultReason)[keyof typeof ResultReason]

export const HpZeroOutcome = {
  Downed: "downed",
  Dead: "dead",
} as const
export type HpZeroOutcome = (typeof HpZeroOutcome)[keyof typeof HpZeroOutcome]

export const SkipReason = {
  Rest: "rest",
  Status: "status",
  Hook: "hook",
  NoCommand: "no-command",
} as const
export type SkipReason = (typeof SkipReason)[keyof typeof SkipReason]

/** 固定失败码。带参数的写成 `${FailReason.UnknownSkill}:${id}` */
export const FailReason = {
  NoTarget: "no-target",
  Sealed: "sealed",
  Rooted: "rooted",
  InsufficientMp: "insufficient-mp",
  HpRequirement: "hp-requirement",
  ResourceRequirement: "resource-requirement",
  SkillNotKnown: "skill-not-known",
  PassiveNotCastable: "passive-not-castable",
  FleeFailed: "flee-failed",
  ReviveBlocked: "revive-blocked",
  SummonInvalid: "summon-invalid",
  SummonDead: "summon-dead",
  SummonAlreadyOut: "summon-already-out",
  UnknownSkill: "unknown-skill",
  UnknownStatus: "unknown-status",
  Unsupported: "unsupported",
} as const
export type FailReason = (typeof FailReason)[keyof typeof FailReason]

export const StatusRemoveReason = {
  Expired: "expired",
  Damage: "damage",
  Dispel: "dispel",
  Replaced: "replaced",
  Downed: "downed",
} as const
export type StatusRemoveReason = (typeof StatusRemoveReason)[keyof typeof StatusRemoveReason]

export const StatusHit = {
  Always: "always",
  Seal: "seal",
} as const
export type StatusHit = (typeof StatusHit)[keyof typeof StatusHit]

/** 伤害公式族。具体算法在 rules-daoyou，引擎只把名字传过去。 */
export const FormulaFamily = {
  Physical: "physical",
  Spell: "spell",
  Dragon: "dragon",
  Judge: "judge",
  Fixed: "fixed",
} as const
export type FormulaFamily = (typeof FormulaFamily)[keyof typeof FormulaFamily]

export const EffectType = {
  PhysicalHit: "physicalHit",
  SpellHit: "spellHit",
  Heal: "heal",
  RestoreMp: "restoreMp",
  Revive: "revive",
  ApplyStatus: "applyStatus",
  Dispel: "dispel",
  SkipNextAction: "skipNextAction",
  DamageMp: "damageMp",
  Wound: "wound",
  ModifyStrike: "modifyStrike",
  ModifyDefenseIgnore: "modifyDefenseIgnore",
  ModifyHeal: "modifyHeal",
  SetCrit: "setCrit",
  ModifyResource: "modifyResource",
  ModifyChance: "modifyChance",
  ClearSkipNextAction: "clearSkipNextAction",
} as const
export type EffectType = (typeof EffectType)[keyof typeof EffectType]

export const EventType = {
  BattleStart: "battleStart",
  RoundStart: "roundStart",
  CommandAccepted: "commandAccepted",
  CommandDefaulted: "commandDefaulted",
  TurnOrder: "turnOrder",
  ActionSkip: "actionSkip",
  ActionStart: "actionStart",
  Retarget: "retarget",
  Miss: "miss",
  Hit: "hit",
  ProtectTrigger: "protectTrigger",
  Damage: "damage",
  Heal: "heal",
  MpCost: "mpCost",
  HpCost: "hpCost",
  MpDamage: "mpDamage",
  Wound: "wound",
  StatusApplied: "statusApplied",
  StatusRemoved: "statusRemoved",
  UnitDowned: "unitDowned",
  UnitDead: "unitDead",
  UnitRevived: "unitRevived",
  UnitEscaped: "unitEscaped",
  PetSummoned: "petSummoned",
  PetRecalled: "petRecalled",
  MpRestore: "mpRestore",
  ResourceChanged: "resourceChanged",
  ActionFailed: "actionFailed",
  RoundEnd: "roundEnd",
  BattleEnd: "battleEnd",
} as const
export type EventType = (typeof EventType)[keyof typeof EventType]

export const StatusTick = {
  RoundEnd: "roundEnd",
} as const
export type StatusTick = (typeof StatusTick)[keyof typeof StatusTick]

export const TickKind = {
  Dot: "dot",
} as const
export type TickKind = (typeof TickKind)[keyof typeof TickKind]

export const StatusFlag = {
  BlocksAction: "blocksAction",
  BlocksSpell: "blocksSpell",
  BlocksPhysical: "blocksPhysical",
  BlocksRevive: "blocksRevive",
  ActFirst: "actFirst",
  Untargetable: "untargetable",
  RevealStealth: "revealStealth",
  PersistWhenDowned: "persistWhenDowned",
} as const
export type StatusFlag = (typeof StatusFlag)[keyof typeof StatusFlag]

export const CostHpFrom = {
  Max: "max",
  Current: "current",
} as const
export type CostHpFrom = (typeof CostHpFrom)[keyof typeof CostHpFrom]

export const MatchWinner = {
  Draw: "draw",
} as const

/** 表达式环境变量名，与 evalExpr 绑定表一致。 */
export const ExprVar = {
  SkillLevel: "skillLevel",
  Targets: "targets",
  Damage: "damage",
  Level: "level",
  Source: "source",
  Target: "target",
} as const

export const ExprFn = {
  Floor: "floor",
  Min: "min",
  Max: "max",
  If: "if",
} as const

export function oppositeSide(side: Side): Side {
  return side === Team.A ? Team.B : Team.A
}

export function failDetail(code: FailReason, detail: string): string {
  return `${code}:${detail}`
}
