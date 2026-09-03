/**
 * 单次出手结算。按指令类型派发，避免 resolveAction 堆叠成长方法。
 * 这里不出现门派/技能 id 分支。
 */
import { fillMissingCommand, isUnsupported, rememberCommand } from "./commands.ts"
import { BUILTIN_SKILL_ID, MIN_HP, NORMAL_ATTACK_COEFF } from "./constants.ts"
import type { BattleContext } from "./context.ts"
import { resolveAliveTarget, resolveStrike } from "./damage.ts"
import { applyEffect, makeEnv } from "./effects.ts"
import {
  CommandPolicy,
  CommandType,
  DamageKind,
  EffectType,
  EventType,
  FailReason,
  HookName,
  failDetail,
  oppositeSide,
  ResultReason,
  SkipReason,
  SkillTag,
  StatusFlag,
  UnitKind,
} from "./enums.ts"
import { evalExpr } from "./expr.ts"
import { atLeast } from "./math.ts"
import { standingUnits } from "./query.ts"
import { commandPolicyOf, hasBlock, hasStatusFlag } from "./status.ts"
import { resolveSkillTargets } from "./targeting.ts"
import { skillOf } from "./skills.ts"
import type { Command, SkillDef, Unit } from "./types.ts"
import { effectiveSpeed, isActionable, isStanding, resourceOf } from "./units.ts"
import { consumeWhen, matchesWhen } from "./when.ts"

/** 防御/保护在锁指令时立刻生效，不必等该单位出手（保护者比被保护者慢时仍能拦刀）。 */
export function applyRoundFlags(unit: Unit, command: Command): void {
  unit.flags.defending = command.type === CommandType.Defend
  unit.flags.protecting = command.type === CommandType.Protect ? command.target : undefined
}

export function clearRoundFlags(unit: Unit): void {
  unit.flags.defending = false
  unit.flags.protecting = undefined
  unit.command = undefined
}

/** 当回合速度（含状态加减）排序；后发制人一类 actFirst 插到队列最前。合击未实现。 */
export function turnOrder(ctx: BattleContext): Unit[] {
  return standingUnits(ctx.state)
    .slice()
    .sort((a, b) => {
      const first = Number(hasStatusFlag(ctx, a, StatusFlag.ActFirst)) - Number(hasStatusFlag(ctx, b, StatusFlag.ActFirst))
      if (first !== 0) return -first
      const ds = effectiveSpeed(b) - effectiveSpeed(a)
      if (ds !== 0) return ds
      if (a.side !== b.side) return a.side - b.side
      return a.slot - b.slot
    })
}

/** 未提交的单位在此补指令（超时普攻 / 自动复用 / NPC AI），并点亮防御、保护旗。 */
export function lockCommands(ctx: BattleContext): void {
  for (const unit of standingUnits(ctx.state)) {
    let command = unit.command
    if (!command) {
      command = fillMissingCommand(ctx, unit)
      rememberCommand(unit, command)
      ctx.emit({ type: EventType.CommandDefaulted, unitId: unit.id, command })
    }
    applyRoundFlags(unit, command)
  }
}

export function resolveAction(ctx: BattleContext, unit: Unit): void {
  if (!isActionable(unit)) return

  // 横扫等「休息一回合」：跳过的是下一回合，不是当回合剩余出手。
  if (unit.flags.skipNextAction) {
    unit.flags.skipNextAction = false
    ctx.emit({ type: EventType.ActionSkip, unitId: unit.id, reason: SkipReason.Rest })
    return
  }

  if (hasBlock(ctx, unit, StatusFlag.BlocksAction)) {
    ctx.emit({ type: EventType.ActionSkip, unitId: unit.id, reason: SkipReason.Status })
    return
  }

  applyCommandPolicy(ctx, unit)

  const skip = ctx.hooks.emit(HookName.BeforeAction, { source: unit })
  if (skip.cancelled) {
    ctx.emit({ type: EventType.ActionSkip, unitId: unit.id, reason: SkipReason.Hook })
    return
  }

  const command = unit.command
  if (!command) {
    ctx.emit({ type: EventType.ActionSkip, unitId: unit.id, reason: SkipReason.NoCommand })
    return
  }

  if (command.type === CommandType.Defend || command.type === CommandType.Protect) {
    ctx.emit({ type: EventType.ActionStart, unitId: unit.id, command })
    return
  }

  if (isUnsupported(command)) {
    ctx.emit({ type: EventType.ActionFailed, unitId: unit.id, reason: failDetail(FailReason.Unsupported, command.type) })
    return
  }

  const handler = commandHandlers[command.type]
  handler?.(ctx, unit, command)
}

const commandHandlers: Partial<
  Record<Command["type"], (ctx: BattleContext, unit: Unit, command: Command) => void>
> = {
  flee: (ctx, unit) => {
    ctx.emit({ type: EventType.ActionStart, unitId: unit.id, command: { type: CommandType.Flee } })
    resolveFlee(ctx, unit)
  },
  summon: (ctx, unit, command) => {
    if (command.type !== CommandType.Summon) return
    ctx.emit({ type: EventType.ActionStart, unitId: unit.id, command })
    resolveSummon(ctx, unit, command.petId)
  },
  skill: (ctx, unit, command) => {
    if (command.type !== CommandType.Skill) return
    resolveSkillCommand(ctx, unit, command.skillId, command.targets)
  },
  attack: (ctx, unit, command) => {
    if (command.type !== CommandType.Attack) return
    if (hasBlock(ctx, unit, StatusFlag.BlocksPhysical)) {
      ctx.emit({ type: EventType.ActionFailed, unitId: unit.id, reason: FailReason.Rooted })
      return
    }
    resolvePhysicalAttack(ctx, unit, command.target)
  },
}

/** 后发：强制普攻锁定目标并抢先；混乱：随机打场上存活单位（含队友）。 */
function applyCommandPolicy(ctx: BattleContext, unit: Unit): void {
  const { policy, storedTargetId } = commandPolicyOf(ctx, unit)
  if (policy === CommandPolicy.StoredAttack) {
    const target = resolveAliveTarget(ctx, unit, storedTargetId ?? unit.lastTargetId)
    if (target) {
      unit.command = { type: CommandType.Attack, target: target.id }
      unit.lastTargetId = target.id
    }
    return
  }
  if (policy === CommandPolicy.Random) {
    const pool = ctx.state.units.filter((u) => u.id !== unit.id && isStanding(u))
    if (pool.length === 0) return
    const pick = pool[Math.floor(ctx.rng.next() * pool.length)]
    unit.command = { type: CommandType.Attack, target: pick.id }
  }
}

function resolvePhysicalAttack(ctx: BattleContext, unit: Unit, targetId: string): void {
  const target = resolveAliveTarget(ctx, unit, targetId)
  if (!target) {
    ctx.emit({ type: EventType.ActionFailed, unitId: unit.id, reason: FailReason.NoTarget })
    return
  }
  ctx.currentAction = {
    skillId: BUILTIN_SKILL_ID.Attack,
    sourceId: unit.id,
    primaryTargetId: target.id,
    targetIds: [target.id],
  }
  ctx.emit({ type: EventType.ActionStart, unitId: unit.id, command: { type: CommandType.Attack, target: target.id } })
  resolveStrike(ctx, {
    source: unit,
    target,
    kind: DamageKind.Physical,
    coeff: NORMAL_ATTACK_COEFF,
    power: 0,
    skillId: BUILTIN_SKILL_ID.Attack,
    isPrimary: true,
  })
  ctx.hooks.emit(HookName.AfterAction, {
    source: unit,
    target,
    skillId: BUILTIN_SKILL_ID.Attack,
    kind: DamageKind.Physical,
    isPrimary: true,
  })
  ctx.currentAction = undefined
}

/** 替换出战宠：场上同主人宠收回板凳；死亡宠不能再召。 */
function resolveSummon(ctx: BattleContext, unit: Unit, petId: string): void {
  const pet = ctx.state.units.find((u) => u.id === petId)
  if (!pet || pet.kind !== UnitKind.Pet || pet.ownerId !== unit.id) {
    ctx.emit({ type: EventType.ActionFailed, unitId: unit.id, reason: FailReason.SummonInvalid })
    return
  }
  if (pet.flags.dead) {
    ctx.emit({ type: EventType.ActionFailed, unitId: unit.id, reason: FailReason.SummonDead })
    return
  }
  if (isStanding(pet)) {
    ctx.emit({ type: EventType.ActionFailed, unitId: unit.id, reason: FailReason.SummonAlreadyOut })
    return
  }
  for (const other of ctx.state.units) {
    if (other.kind === UnitKind.Pet && other.ownerId === unit.id && isStanding(other)) {
      other.flags.benched = true
      ctx.emit({ type: EventType.PetRecalled, unitId: unit.id, petId: other.id })
    }
  }
  pet.flags.benched = false
  ctx.emit({ type: EventType.PetSummoned, unitId: unit.id, petId: pet.id })
}

function resolveFlee(ctx: BattleContext, unit: Unit): void {
  const chance = ctx.rules.formulas.fleeChance(unit, standingUnits(ctx.state, oppositeSide(unit.side)))
  if (!ctx.rng.chance(chance)) {
    ctx.emit({ type: EventType.ActionFailed, unitId: unit.id, reason: FailReason.FleeFailed })
    return
  }
  unit.flags.escaped = true
  unit.command = undefined
  ctx.emit({ type: EventType.UnitEscaped, unitId: unit.id })
  ctx.checkEnd(ResultReason.Flee)
}

function resolveSkillCommand(ctx: BattleContext, unit: Unit, skillId: string, targets: string[]): void {
  const skill = skillOf(ctx.skills, unit, skillId)
  if (!skill) {
    ctx.emit({ type: EventType.ActionFailed, unitId: unit.id, reason: failDetail(FailReason.UnknownSkill, skillId) })
    return
  }
  if (skill.tags.includes(SkillTag.Passive)) {
    ctx.emit({ type: EventType.ActionFailed, unitId: unit.id, reason: FailReason.PassiveNotCastable })
    return
  }
  // 失心等封法：法术失败，未同时封物则转普通攻击。
  if (skill.tags.includes(SkillTag.Spell) && hasBlock(ctx, unit, StatusFlag.BlocksSpell)) {
    ctx.emit({ type: EventType.ActionFailed, unitId: unit.id, reason: FailReason.Sealed })
    if (!hasBlock(ctx, unit, StatusFlag.BlocksPhysical)) {
      const fallback = resolveAliveTarget(ctx, unit, unit.lastTargetId)
      if (fallback) resolvePhysicalAttack(ctx, unit, fallback.id)
    }
    return
  }
  if (skill.tags.includes(SkillTag.Physical) && hasBlock(ctx, unit, StatusFlag.BlocksPhysical)) {
    ctx.emit({ type: EventType.ActionFailed, unitId: unit.id, reason: FailReason.Rooted })
    return
  }
  resolveSkill(ctx, unit, skill, targets)
}

function resolveSkill(ctx: BattleContext, unit: Unit, skill: SkillDef, targetIds: string[]): void {
  if (!unit.skills.includes(skill.id) && !unit.passives.includes(skill.id)) {
    ctx.emit({ type: EventType.ActionFailed, unitId: unit.id, reason: FailReason.SkillNotKnown })
    return
  }

  const targets = resolveSkillTargets(ctx, unit, skill, targetIds)
  const env = makeEnv(unit, skill, targets)
  const mpCost = atLeast(0, Math.floor(evalExpr(skill.costMp ?? 0, env) * mpCostFactor(ctx, unit)))
  const hpCost = atLeast(0, Math.floor(evalExpr(skill.costHp ?? 0, env)))

  if (skill.requireHpRatio !== undefined && unit.attrs.hp / unit.attrs.maxHp < skill.requireHpRatio) {
    fallbackToAttack(ctx, unit, targetIds, FailReason.HpRequirement)
    return
  }
  const missingResource = skill.resourceRequirements?.find(
    (requirement) => (resourceOf(unit, requirement.resourceId)?.current ?? 0) < requirement.min,
  )
  if (missingResource) {
    fallbackToAttack(
      ctx,
      unit,
      targetIds,
      failDetail(FailReason.ResourceRequirement, missingResource.resourceId),
    )
    return
  }
  if (unit.attrs.mp < mpCost) {
    fallbackToAttack(ctx, unit, targetIds, FailReason.InsufficientMp)
    return
  }

  ctx.currentAction = {
    skillId: skill.id,
    sourceId: unit.id,
    primaryTargetId: targets[0]?.id,
    targetIds: targets.map((t) => t.id),
  }
  ctx.emit({
    type: EventType.ActionStart,
    unitId: unit.id,
    command: { type: CommandType.Skill, skillId: skill.id, targets: targets.map((t) => t.id) },
  })

  if (mpCost > 0) {
    unit.attrs.mp -= mpCost
    ctx.emit({ type: EventType.MpCost, unitId: unit.id, amount: mpCost, mpAfter: unit.attrs.mp })
  }
  if (hpCost > 0) {
    // 横扫耗血不会把自己打到 0。
    const spend = Math.min(atLeast(0, unit.attrs.hp - MIN_HP), hpCost)
    unit.attrs.hp -= spend
    ctx.emit({ type: EventType.HpCost, unitId: unit.id, amount: spend, hpAfter: unit.attrs.hp })
  }

  for (const effect of skill.effects) {
    // 战斗已结束后不再产生伤害/状态，但仍结清本次技能声明的资源变化。
    if (ctx.state.result && effect.type !== EffectType.ModifyResource) continue
    if (effect.when && !matchesWhen(ctx, effect.when, { source: unit, target: targets[0], skill, skillId: skill.id, markKey: `${skill.id}:effect` })) {
      continue
    }
    applyEffect(ctx, unit, skill, effect, targets, env)
    env.damage = ctx.lastStrikeDamage
    consumeWhen(ctx, effect.when, { source: unit, target: targets[0], skill, skillId: skill.id, markKey: `${skill.id}:effect` })
  }
  const kind = skill.tags.includes(SkillTag.Physical)
    ? DamageKind.Physical
    : skill.tags.includes(SkillTag.Spell)
      ? DamageKind.Spell
      : undefined
  ctx.hooks.emit(HookName.AfterAction, {
    source: unit,
    target: targets[0],
    skillId: skill.id,
    kind,
    isPrimary: true,
  })
  ctx.currentAction = undefined
}

function mpCostFactor(ctx: BattleContext, unit: Unit): number {
  let factor = 1
  for (const id of unit.passives) {
    const innate = skillOf(ctx.skills, unit, id)?.innate?.mpCostFactor
    if (innate !== undefined) factor *= innate
  }
  return factor
}

/** 蓝不足、横扫气血未过半等：技能失败后改打普攻（端游常见兜底）。 */
function fallbackToAttack(ctx: BattleContext, unit: Unit, targetIds: string[], reason: string): void {
  ctx.emit({ type: EventType.ActionFailed, unitId: unit.id, reason })
  const fallback = resolveAliveTarget(ctx, unit, targetIds[0] ?? unit.lastTargetId)
  if (fallback) resolvePhysicalAttack(ctx, unit, fallback.id)
}
