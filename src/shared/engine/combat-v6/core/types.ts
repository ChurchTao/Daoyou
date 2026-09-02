/**
 * 战斗领域类型。字符串枚举的取值见 enums.ts，这里只描述结构。
 */
import type { AttrName } from "./constants.ts"
import {
  CommandType,
  CostHpFrom,
  EffectType,
  EventType,
  MatchWinner,
  StatusHit,
  StatusTick,
  TickKind,
} from "./enums.ts"
import type {
  BattlePhase,
  CommandPolicy,
  DamageKind,
  FormulaFamily,
  HookAim,
  HookName,
  HpZeroOutcome,
  ResultReason,
  Side,
  SkillTag,
  StatusCategory,
  TargetMode,
  TargetSide,
  UnitKind,
} from "./enums.ts"

export type {
  BattlePhase,
  CommandPolicy,
  CommandType,
  CostHpFrom,
  DamageKind,
  EffectType,
  EventType,
  FormulaFamily,
  HookAim,
  HookName,
  HpZeroOutcome,
  ResultReason,
  Side,
  SkillTag,
  StatusCategory,
  StatusHit,
  StatusTick,
  TargetMode,
  TargetSide,
  TickKind,
  UnitKind,
} from "./enums.ts"
export type { AttrName } from "./constants.ts"

export type UnitId = string
export type SkillId = string
export type StatusId = string

/** 数值或表达式。可用 skillLevel / targets / 单位属性 / floor min max。 */
export type Expr = number | string

export type Attrs = { [K in AttrName]: number }

export type Command =
  | { type: typeof CommandType.Attack; target: UnitId }
  | { type: typeof CommandType.Skill; skillId: SkillId; targets: UnitId[] }
  | { type: typeof CommandType.Defend }
  | { type: typeof CommandType.Protect; target: UnitId }
  | { type: typeof CommandType.Item; itemId: string; target: UnitId }
  | { type: typeof CommandType.Summon; petId: string }
  | { type: typeof CommandType.Catch; target: UnitId }
  | { type: typeof CommandType.Flee }
  | { type: typeof CommandType.Auto }

export type BattleResult = {
  winner: Side | typeof MatchWinner.Draw
  reason: ResultReason
}

/** 战斗、快照与回放共同携带的首版版本契约。 */
export type CombatV6VersionStamp = {
  engineVersion: "combat-v6"
  rulesetVersion: "daoyou_rules_v1"
  contentVersion: "empty_content_v1"
  projectionVersion: "character_panel_v1" | "character_training_v1"
}

/** 场上一条状态。kind 是覆盖键（失心和定身 kind 不同，可并存）。 */
export type StatusInstance = {
  id: StatusId
  kind: string
  remainingRounds: number
  sourceId: UnitId
  appliedRound: number
  speedMod: number
  attrMods: Partial<Attrs>
  storedTargetId?: UnitId
  damageTakenPhysical: number
  damageTakenSpell: number
  healTaken: number
  healDealt: number
  stacks: number
}

export type UnitFlags = {
  defending: boolean
  protecting?: UnitId
  auto: boolean
  /** 横扫打完后置位，下一回合跳过出手 */
  skipNextAction: boolean
  /** 人物 hp<=0：倒地，可被复活 */
  downed: boolean
  /** 召唤兽/NPC hp<=0：本场死亡 */
  dead: boolean
  escaped: boolean
  /** 未出战的替补宠，不算场上存活 */
  benched: boolean
}

export type Unit = {
  id: UnitId
  name: string
  side: Side
  kind: UnitKind
  slot: number
  level: number
  /** 召唤兽归属的人物 id */
  ownerId?: UnitId
  attrs: Attrs
  skills: SkillId[]
  passives: SkillId[]
  skillLevels: Record<SkillId, number>
  /** 本单位对底表的覆盖（经脉改横扫段数等）。查找走 skillOf，不要直接读整场表。 */
  skillOverrides: Record<SkillId, SkillDef>
  /** 单位标签（鬼魂系等），给 when.foeTags 用，不是门派 id。 */
  tags: string[]
  /** 本场/本回合「只触发一次」的键。 */
  marks: string[]
  statuses: StatusInstance[]
  flags: UnitFlags
  command?: Command
  lastCommand?: Command
  lastTargetId?: UnitId
}

/** 可序列化战局。rngState 必须一起存，否则录像对不上。 */
export type BattleState = {
  round: number
  phase: BattlePhase
  units: Unit[]
  result?: BattleResult
  rngState: number
  versions: CombatV6VersionStamp
}

export type LineupUnit = {
  id?: UnitId
  name: string
  side: Side
  kind: UnitKind
  slot?: number
  level?: number
  ownerId?: UnitId
  benched?: boolean
  attrs: Partial<Attrs> & {
    hp: number
    speed: number
    physicalAtk: number
    physicalDef: number
  }
  skills?: SkillId[]
  passives?: SkillId[]
  skillLevels?: Record<SkillId, number>
  /** 入场时的技能补丁，按 id 覆盖底表。 */
  skillOverrides?: SkillDef[]
  tags?: string[]
}

export type SkillTargeting = {
  side: TargetSide
  /** explicit=只用指令目标；fill=指令目标优先再补满；all/random/lowestHp/lowestDef 由引擎选 */
  mode?: TargetMode
  count?: Expr
  /** 选满 count 之后，按概率再补 extraCount（雷动秒五） */
  extraChance?: Expr
  extraCount?: Expr
  /** 倒地人物只能被复活类选中 */
  includeDowned?: boolean
  includeDead?: boolean
}

/** 钩子/效果的通用过滤。引擎只做匹配，不要在这里写门派名。 */
export type EffectWhen = {
  skillIds?: SkillId[]
  skillTags?: SkillTag[]
  requireStatusIds?: StatusId[]
  requireStatusKinds?: string[]
  requireAbsentStatusIds?: StatusId[]
  requireAbsentStatusKinds?: string[]
  sourceHpRatioBelow?: number
  sourceHpRatioAbove?: number
  targetHpRatioBelow?: number
  targetHpRatioAbove?: number
  /** primary=只对这次出手的首目标 */
  targetSlot?: "primary" | "all"
  foeKind?: UnitKind
  foeTags?: string[]
  sourceTags?: string[]
  oncePerBattle?: boolean
  oncePerRound?: boolean
  requireKind?: DamageKind
}

type EffectCore =
  | {
      type: typeof EffectType.PhysicalHit
      hits?: Expr
      coeff?: number | number[]
      power?: Expr
      trueDamage?: boolean
      formula?: FormulaFamily
    }
  | {
      type: typeof EffectType.SpellHit
      hits?: Expr
      coeff?: number | number[]
      power?: Expr
      trueDamage?: boolean
      formula?: FormulaFamily
    }
  | { type: typeof EffectType.Heal; power: Expr; healMaxHp?: boolean }
  | { type: typeof EffectType.RestoreMp; power: Expr }
  | { type: typeof EffectType.Revive; hp?: Expr; hpRatio?: Expr }
  | {
      type: typeof EffectType.ApplyStatus
      statusId: StatusId
      duration: Expr
      self?: boolean
      storeTarget?: boolean
      /** 封印类走 sealHitChance，否则必中 */
      hit?: StatusHit
    }
  | {
      type: typeof EffectType.Dispel
      kinds?: string[]
      statusIds?: StatusId[]
      categories?: StatusCategory[]
    }
  | { type: typeof EffectType.SkipNextAction }
  | { type: typeof EffectType.DamageMp; power?: Expr }
  | { type: typeof EffectType.Wound; power?: Expr }
  | { type: typeof EffectType.ModifyStrike; factor?: Expr; add?: Expr }
  | { type: typeof EffectType.ModifyHeal; factor?: Expr; add?: Expr }
  | { type: typeof EffectType.SetCrit }

export type SkillEffect = EffectCore & { when?: EffectWhen }

export type SkillHook = {
  on: HookName
  chance?: Expr
  when?: EffectWhen
  targetIsSelf?: boolean
  sourceIsSelf?: boolean
  requireKind?: DamageKind
  /** hookSource=反击/反震打回来；hookTarget=连击再打原目标；others=其他敌人 */
  aim?: HookAim
  aimCount?: Expr
  aimMode?: TargetMode
  effects: SkillEffect[]
}

/** 师门技能项 N²·quad + N·linear + intercept。系数在内容表，算法在 rules。 */
export type SchoolTerm = {
  quad?: number
  linear?: number
  intercept?: number
}

/** 群法分灵：1 - 人数×perTarget，不低于 floor。 */
export type SplashSpec = {
  perTarget: number
  floor: number
}

/** 技能声明。主动效果在 effects，被动在 hooks；引擎不认技能 id。 */
export type SkillDef = {
  id: SkillId
  name: string
  school?: string
  costMp?: Expr
  costHp?: Expr
  costHpFrom?: CostHpFrom
  requireHpRatio?: number
  tags: SkillTag[]
  /** 技能族公式名，由 rules 插件解释，引擎不当分支 */
  formula?: FormulaFamily
  /** 二次师门项；没有则法术族只吃 power + 法伤法防差 */
  schoolTerm?: SchoolTerm
  /** 群法分灵；没有则系数 1 */
  splash?: SplashSpec
  /** 封印底（百分点，如 55）；缺省由 rules 的 sealChanceBase 决定 */
  sealBase?: number
  targeting: SkillTargeting
  effects: SkillEffect[]
  hooks?: SkillHook[]
  /** 同单位带了列出的技能则本被动不生效（高级连击 vs 连击） */
  conflicts?: SkillId[]
  /** 开战即生效的能力，不占状态栏（感知看破隐身、简易耗蓝） */
  innate?: { revealStealth?: boolean; mpCostFactor?: number }
}

/** 状态模板。字段是能力开关，不要为某个门派加专用字段。 */
export type StatusDef = {
  id: StatusId
  name: string
  kind: string
  category?: StatusCategory
  blocksAction?: boolean
  blocksSpell?: boolean
  blocksPhysical?: boolean
  blocksRevive?: boolean
  /** 倒地不清（锢魂：死亡期间仍禁止复活） */
  persistWhenDowned?: boolean
  untargetable?: boolean
  revealStealth?: boolean
  actFirst?: boolean
  breakOnDamage?: boolean
  commandPolicy?: CommandPolicy
  speedMod?: Expr
  attrMods?: Partial<Record<AttrName, Expr>>
  damageTakenPhysical?: number
  damageTakenSpell?: number
  ticks?: StatusTick
  onTick?: { type: TickKind; ratioOfMaxHp: number }
  /** 施加当回合结束也扣持续（复活当回合护体） */
  expireSameRound?: boolean
  /** 承伤分流：目标留下 keep，其余 toCaster 打到状态来源 */
  redirectTaken?: { keep: number; toCaster: number }
  /** 受到治疗系数，1=不修正。销武/降疗走这里。 */
  healTaken?: number
  /** 打出治疗系数，1=不修正。圣手整体削弱走这里。 */
  healDealt?: number
  /** >1 时同 kind 可叠层（降疗），满层再替换最早的一层。 */
  maxStacks?: number
}

export type ActionScope = {
  skillId: SkillId
  sourceId: UnitId
  primaryTargetId?: UnitId
  targetIds: UnitId[]
}

export type StrikeFormulaInput = {
  family: FormulaFamily | (string & {})
  kind: DamageKind
  source: Unit
  target: Unit
  coeff: number
  power: number
  fury: boolean
  furyMultiplier?: number
  skillLevel?: number
  /** 实际作用人数，给群法分灵用 */
  targetCount?: number
  schoolTerm?: SchoolTerm
  splash?: SplashSpec
}

export type FormulaSet = {
  fluctuationMin: number
  fluctuationMax: number
  /** 物理波动；缺省可与 fluctuationMin 相同（测试关闭波动时一并钉死） */
  physicalFluctuationMin: number
  physicalFluctuationMax: number
  critMultiplier: number
  furyAtkMultiplier: number
  defendPhysicalFactor: number
  physicalBase(atk: number, def: number): number
  spellBase(magicAtk: number, magicDef: number, power: number): number
  /** 按 family 分发；未知 family 回退到 physical/spell */
  baseDamage(input: StrikeFormulaInput): number
  physicalHitChance(source: Unit, target: Unit): number
  spellHitChance(source: Unit, target: Unit): number
  sealHitChance(source: Unit, target: Unit, skillLevel?: number, sealBase?: number): number
  fleeChance(unit: Unit, enemies: Unit[]): number
}

export type DecideCommandInput = {
  unit: Unit
  state: BattleState
  enemies: Unit[]
  allies: Unit[]
}

/** 规则插件。公式、死亡分型、默认指令都在这里，引擎保持规则无关。 */
export type Ruleset = {
  name: string
  maxRounds: number
  formulas: FormulaSet
  hpZeroOutcome(unit: Unit): HpZeroOutcome
  decideCommand(input: DecideCommandInput): Command
}

export type BattleEvent =
  | {
      type: typeof EventType.BattleStart
      seed: number
      unitIds: UnitId[]
      versions: CombatV6VersionStamp
    }
  | { type: typeof EventType.RoundStart; round: number }
  | { type: typeof EventType.CommandAccepted; unitId: UnitId; command: Command }
  | { type: typeof EventType.CommandDefaulted; unitId: UnitId; command: Command }
  | { type: typeof EventType.TurnOrder; unitIds: UnitId[] }
  | { type: typeof EventType.ActionSkip; unitId: UnitId; reason: string }
  | { type: typeof EventType.ActionStart; unitId: UnitId; command: Command }
  | { type: typeof EventType.Retarget; unitId: UnitId; from: UnitId; to: UnitId }
  | { type: typeof EventType.Miss; sourceId: UnitId; targetId: UnitId; kind: DamageKind | typeof StatusHit.Seal }
  | {
      type: typeof EventType.Hit
      sourceId: UnitId
      targetId: UnitId
      kind: DamageKind
      crit: boolean
      fury: boolean
    }
  | { type: typeof EventType.ProtectTrigger; protectorId: UnitId; originalTargetId: UnitId }
  | {
      type: typeof EventType.Damage
      sourceId: UnitId
      targetId: UnitId
      amount: number
      hpAfter: number
      kind: DamageKind
    }
  | {
      type: typeof EventType.Heal
      sourceId: UnitId
      targetId: UnitId
      amount: number
      hpAfter: number
    }
  | { type: typeof EventType.MpCost; unitId: UnitId; amount: number; mpAfter: number }
  | { type: typeof EventType.HpCost; unitId: UnitId; amount: number; hpAfter: number }
  | { type: typeof EventType.MpDamage; sourceId: UnitId; targetId: UnitId; amount: number; mpAfter: number }
  | { type: typeof EventType.Wound; sourceId: UnitId; targetId: UnitId; amount: number; maxHpAfter: number }
  | { type: typeof EventType.StatusApplied; unitId: UnitId; statusId: StatusId; duration: number }
  | { type: typeof EventType.StatusRemoved; unitId: UnitId; statusId: StatusId; reason: string }
  | { type: typeof EventType.UnitDowned; unitId: UnitId }
  | { type: typeof EventType.UnitDead; unitId: UnitId }
  | { type: typeof EventType.UnitRevived; unitId: UnitId; hp: number }
  | { type: typeof EventType.UnitEscaped; unitId: UnitId }
  | { type: typeof EventType.PetSummoned; unitId: UnitId; petId: UnitId }
  | { type: typeof EventType.PetRecalled; unitId: UnitId; petId: UnitId }
  | { type: typeof EventType.MpRestore; unitId: UnitId; amount: number; mpAfter: number }
  | { type: typeof EventType.ActionFailed; unitId: UnitId; reason: string }
  | { type: typeof EventType.RoundEnd; round: number }
  | {
      type: typeof EventType.BattleEnd
      winner: BattleResult["winner"]
      reason: BattleResult["reason"]
    }

export type CreateBattleInput = {
  seed: number
  versions: CombatV6VersionStamp
  units: LineupUnit[]
  ruleset: Ruleset
  skills?: SkillDef[]
  statusDefs?: StatusDef[]
}

export type ExprEnv = {
  skillLevel: number
  targets: number
  source: Unit
  target?: Unit
  damage?: number
}
