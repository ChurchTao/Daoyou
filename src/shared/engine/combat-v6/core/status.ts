/**
 * 状态机。kind 相同则后覆盖先（端游同类法术规则）；持续回合在 roundEnd 扣，
 * 施加当回合默认不扣，避免「休息 1 回合」当场被清掉。
 */
import { DEFAULT_DAMAGE_TAKEN, MIN_MAX_HP } from "./constants.ts"
import type { BattleContext } from "./context.ts"
import {
  CommandPolicy,
  DamageKind,
  EventType,
  FailReason,
  failDetail,
  StatusFlag,
  StatusRemoveReason,
  StatusTick,
  TickKind,
} from "./enums.ts"
import { evalExpr, skillLevelOf } from "./expr.ts"
import { standingUnits } from "./query.ts"
import type { Attrs, CommandPolicy as CommandPolicyType, ExprEnv, StatusDef, StatusId, Unit, UnitId } from "./types.ts"
import { effectiveAttrs } from "./units.ts"

export function statusDef(ctx: BattleContext, id: StatusId): StatusDef | undefined {
  return ctx.statusDefs.get(id)
}

export function hasStatusKind(unit: Unit, kind: string): boolean {
  return unit.statuses.some((s) => s.kind === kind)
}

export function hasBlock(
  ctx: BattleContext,
  unit: Unit,
  key: typeof StatusFlag.BlocksAction | typeof StatusFlag.BlocksSpell | typeof StatusFlag.BlocksPhysical,
): boolean {
  return unit.statuses.some((s) => statusDef(ctx, s.id)?.[key])
}

export function hasStatusFlag(
  ctx: BattleContext,
  unit: Unit,
  key:
    | typeof StatusFlag.BlocksRevive
    | typeof StatusFlag.ActFirst
    | typeof StatusFlag.Untargetable
    | typeof StatusFlag.RevealStealth
    | typeof StatusFlag.PersistWhenDowned,
): boolean {
  return unit.statuses.some((s) => statusDef(ctx, s.id)?.[key])
}

export function commandPolicyOf(ctx: BattleContext, unit: Unit): {
  policy: CommandPolicyType
  storedTargetId?: UnitId
} {
  for (const inst of unit.statuses) {
    const def = statusDef(ctx, inst.id)
    if (def?.commandPolicy && def.commandPolicy !== CommandPolicy.None) {
      return { policy: def.commandPolicy, storedTargetId: inst.storedTargetId }
    }
  }
  return { policy: CommandPolicy.None }
}

export function applyStatus(
  ctx: BattleContext,
  unit: Unit,
  statusId: StatusId,
  duration: number,
  sourceId: UnitId,
  options: { storedTargetId?: UnitId; env?: ExprEnv } = {},
): void {
  const def = statusDef(ctx, statusId)
  if (!def) {
    ctx.emit({ type: EventType.ActionFailed, unitId: sourceId, reason: failDetail(FailReason.UnknownStatus, statusId) })
    return
  }

  const baseEnv: ExprEnv = options.env ?? {
    skillLevel: 0,
    targets: 1,
    source: ctx.state.units.find((u) => u.id === sourceId) ?? unit,
    target: unit,
  }
  // 状态面板表达式按施放时有效属性快照；刷新同 kind 时排除旧层，避免自身滚雪球。
  const withoutSameKind = { ...unit, statuses: unit.statuses.filter((status) => status.kind !== def.kind) }
  const snapshotTarget = { ...unit, attrs: effectiveAttrs(withoutSameKind) }
  const env: ExprEnv = {
    ...baseEnv,
    target: baseEnv.target?.id === unit.id ? snapshotTarget : baseEnv.target,
    source: baseEnv.source.id === unit.id ? snapshotTarget : baseEnv.source,
  }

  const attrMods: Partial<Attrs> = {}
  for (const [key, expr] of Object.entries(def.attrMods ?? {}) as Array<[keyof Attrs, string | number]>) {
    attrMods[key] = evalExpr(expr, env)
  }

  const maxStacks = def.maxStacks && def.maxStacks > 1 ? def.maxStacks : 1
  const existing = maxStacks > 1 ? unit.statuses.find((s) => s.kind === def.kind) : undefined
  if (existing) {
    const stacks = Math.min(maxStacks, existing.stacks + 1)
    existing.stacks = stacks
    existing.remainingRounds = duration
    existing.sourceId = sourceId
    const healTaken = def.healTaken ?? DEFAULT_DAMAGE_TAKEN
    const healDealt = def.healDealt ?? DEFAULT_DAMAGE_TAKEN
    existing.healTaken = healTaken ** stacks
    existing.healDealt = healDealt ** stacks
    existing.damageTakenPhysical = (def.damageTakenPhysical ?? DEFAULT_DAMAGE_TAKEN) ** stacks
    existing.damageTakenSpell = (def.damageTakenSpell ?? DEFAULT_DAMAGE_TAKEN) ** stacks
    ctx.emit({ type: EventType.StatusApplied, unitId: unit.id, statusId: def.id, duration })
    return
  }

  // 同类法术：以后一次的持续和效果为准（不可叠层时）。
  for (const inst of unit.statuses.filter((s) => s.kind === def.kind)) {
    removeStatus(ctx, unit, inst.id, StatusRemoveReason.Replaced)
  }
  unit.statuses.push({
    id: def.id,
    kind: def.kind,
    remainingRounds: duration,
    sourceId,
    appliedRound: ctx.state.round,
    speedMod: evalExpr(def.speedMod ?? 0, env),
    attrMods,
    storedTargetId: options.storedTargetId,
    damageTakenPhysical: def.damageTakenPhysical ?? DEFAULT_DAMAGE_TAKEN,
    damageTakenSpell: def.damageTakenSpell ?? DEFAULT_DAMAGE_TAKEN,
    healTaken: def.healTaken ?? DEFAULT_DAMAGE_TAKEN,
    healDealt: def.healDealt ?? DEFAULT_DAMAGE_TAKEN,
    stacks: 1,
  })
  // 达摩护体等改的是真实上限，expire 时要在 removeStatus 里扣回来。
  if (attrMods.maxHp) unit.attrs.maxHp += attrMods.maxHp
  ctx.emit({ type: EventType.StatusApplied, unitId: unit.id, statusId: def.id, duration })
}

export function removeStatus(ctx: BattleContext, unit: Unit, statusId: StatusId, reason: string): void {
  const inst = unit.statuses.find((s) => s.id === statusId)
  if (!inst) return
  if (inst.attrMods.maxHp) {
    unit.attrs.maxHp = Math.max(MIN_MAX_HP, unit.attrs.maxHp - inst.attrMods.maxHp)
    if (unit.attrs.hp > unit.attrs.maxHp) unit.attrs.hp = unit.attrs.maxHp
  }
  unit.statuses = unit.statuses.filter((s) => s.id !== statusId)
  ctx.emit({ type: EventType.StatusRemoved, unitId: unit.id, statusId, reason })
}

export function breakStatusesOnDamage(ctx: BattleContext, unit: Unit): void {
  const broken = unit.statuses.filter((s) => statusDef(ctx, s.id)?.breakOnDamage)
  for (const s of broken) removeStatus(ctx, unit, s.id, StatusRemoveReason.Damage)
}

export function tickStatuses(ctx: BattleContext): void {
  // 倒地单位也要走持续（锢魂必须在倒地期间仍占回合）。
  for (const unit of [...standingUnits(ctx.state), ...ctx.state.units.filter((u) => u.flags.downed)]) {
    for (const inst of [...unit.statuses]) {
      const def = statusDef(ctx, inst.id)
      if (def?.ticks === StatusTick.RoundEnd && def.onTick?.type === TickKind.Dot && !unit.flags.downed) {
        const amount = Math.max(1, Math.floor(unit.attrs.maxHp * def.onTick.ratioOfMaxHp))
        const hp = Math.max(0, unit.attrs.hp - amount)
        unit.attrs.hp = hp
        ctx.emit({
          type: EventType.Damage,
          sourceId: inst.sourceId,
          targetId: unit.id,
          amount,
          hpAfter: hp,
          kind: DamageKind.Spell,
        })
        if (hp <= 0) {
          ctx.applyHpZero(
            unit,
            ctx.state.units.find((candidate) => candidate.id === inst.sourceId),
          )
        }
      }

      // Dot 当回合就跳并扣持续；普通状态当回合不扣；expireSameRound（我佛护体）当回合结束即卸。
      if (inst.appliedRound === ctx.state.round && !def?.ticks && !def?.expireSameRound) continue
      const next = inst.remainingRounds - 1
      if (next <= 0) removeStatus(ctx, unit, inst.id, StatusRemoveReason.Expired)
      else inst.remainingRounds = next
    }
  }
}

/** 倒地清异常；persistWhenDowned（锢魂）留下。 */
export function clearCombatStatuses(ctx: BattleContext, unit: Unit): void {
  for (const inst of [...unit.statuses]) {
    if (statusDef(ctx, inst.id)?.persistWhenDowned) continue
    removeStatus(ctx, unit, inst.id, StatusRemoveReason.Downed)
  }
}

export function envFor(unit: Unit, skillId: string, targets = 1, target?: Unit): ExprEnv {
  return {
    skillLevel: skillLevelOf(unit, skillId),
    targets,
    source: unit,
    target,
  }
}
