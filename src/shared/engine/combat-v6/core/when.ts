/**
 * 钩子/效果条件匹配。只认标签、状态、技能 id 列表和数值门槛，不认门派。
 */
import type { BattleContext } from "./context.ts"
import type { DamageKind, DamageOrigin } from "./enums.ts"
import type { EffectWhen, SkillDef, SkillId, Unit } from "./types.ts"
import { isStanding, resourceOf } from "./units.ts"

export type WhenScope = {
  source: Unit
  target?: Unit
  skill?: SkillDef
  skillId?: SkillId
  kind?: DamageKind
  origin?: DamageOrigin
  isPrimary?: boolean
  /** 写入 marks 的前缀，通常是被动技能 id + 钩子下标 */
  markKey?: string
}

function hpRatio(unit: Unit): number {
  return unit.attrs.hp / Math.max(1, unit.attrs.maxHp)
}

function hasId(unit: Unit, ids: string[]): boolean {
  return ids.some((id) => unit.statuses.some((s) => s.id === id))
}

function hasKind(unit: Unit, kinds: string[]): boolean {
  return kinds.some((kind) => unit.statuses.some((s) => s.kind === kind))
}

function hasCategory(ctx: BattleContext, unit: Unit, categories: import("./enums.ts").StatusCategory[]): boolean {
  return unit.statuses.some((status) => {
    const category = ctx.statusDefs.get(status.id)?.category
    return category !== undefined && categories.includes(category)
  })
}

export function targetStatusStacks(
  _ctx: BattleContext,
  when: EffectWhen | undefined,
  target: Unit | undefined,
): number {
  const spec = when?.targetStatusStack
  if (!spec || !target) return 0
  return target.statuses
    .filter((status) =>
      (spec.statusId === undefined || status.id === spec.statusId) &&
      (spec.kind === undefined || status.kind === spec.kind),
    )
    .reduce((sum, status) => sum + status.stacks, 0)
}

function markName(scope: WhenScope, round: number, when: EffectWhen): string | undefined {
  if (!scope.markKey) return undefined
  if (when.oncePerBattle) return `battle:${scope.markKey}`
  if (when.oncePerRound) return `round:${round}:${scope.markKey}`
  return undefined
}

export function matchesWhen(ctx: BattleContext, when: EffectWhen | undefined, scope: WhenScope): boolean {
  if (!when) return true
  const skillId = scope.skillId ?? scope.skill?.id ?? ctx.currentAction?.skillId
  const skill = scope.skill
  const isPrimary =
    scope.isPrimary ??
    (scope.target !== undefined && scope.target.id === ctx.currentAction?.primaryTargetId)

  if (when.skillIds && (!skillId || !when.skillIds.includes(skillId))) return false
  if (when.skillTags?.length) {
    if (!skill) return false
    if (!when.skillTags.some((tag) => skill.tags.includes(tag))) return false
  }
  if (when.requireKind && when.requireKind !== scope.kind) return false
  if (when.requireStatusIds && !hasId(scope.source, when.requireStatusIds)) return false
  if (when.requireStatusKinds && !hasKind(scope.source, when.requireStatusKinds)) return false
  if (when.requireAbsentStatusIds && hasId(scope.source, when.requireAbsentStatusIds)) return false
  if (when.requireAbsentStatusKinds && hasKind(scope.source, when.requireAbsentStatusKinds)) return false
  if (when.sourceHpRatioBelow !== undefined && hpRatio(scope.source) >= when.sourceHpRatioBelow) return false
  if (when.sourceHpRatioAbove !== undefined && hpRatio(scope.source) <= when.sourceHpRatioAbove) return false
  if (when.sourceTags?.length && !when.sourceTags.every((tag) => scope.source.tags.includes(tag))) return false
  if (when.sourceDefending !== undefined && scope.source.flags.defending !== when.sourceDefending) return false
  if (when.sourceStanding !== undefined && isStanding(scope.source) !== when.sourceStanding) return false
  if (when.damageOrigins?.length && (!scope.origin || !when.damageOrigins.includes(scope.origin))) return false
  if (when.sourceResource) {
    const resource = resourceOf(scope.source, when.sourceResource.id)
    if (!resource) return false
    if (when.sourceResource.min !== undefined && resource.current < when.sourceResource.min) return false
    if (when.sourceResource.max !== undefined && resource.current > when.sourceResource.max) return false
  }

  const foe = scope.target
  if (when.targetSlot === "primary" && !isPrimary) return false
  if (when.foeKind && foe?.kind !== when.foeKind) return false
  if (when.targetStatusIds && (!foe || !hasId(foe, when.targetStatusIds))) return false
  if (when.targetStatusKinds && (!foe || !hasKind(foe, when.targetStatusKinds))) return false
  if (when.targetAbsentStatusIds && foe && hasId(foe, when.targetAbsentStatusIds)) return false
  if (when.targetAbsentStatusKinds && foe && hasKind(foe, when.targetAbsentStatusKinds)) return false
  if (when.targetStatusCategories && (!foe || !hasCategory(ctx, foe, when.targetStatusCategories))) return false
  if (when.targetAbsentStatusCategories && foe && hasCategory(ctx, foe, when.targetAbsentStatusCategories)) return false
  if (when.targetStatusStack) {
    const stacks = targetStatusStacks(ctx, when, foe)
    if (when.targetStatusStack.min !== undefined && stacks < when.targetStatusStack.min) return false
    if (when.targetStatusStack.max !== undefined && stacks > when.targetStatusStack.max) return false
  }
  const primaryId = ctx.currentAction?.primaryTargetId
  if (when.primaryTargetStatusIds?.length) {
    const ids = primaryId ? ctx.currentAction?.initialStatusIdsByTarget[primaryId] ?? [] : []
    if (!when.primaryTargetStatusIds.some((id) => ids.includes(id))) return false
  }
  if (when.primaryTargetStatusKinds?.length) {
    const kinds = primaryId ? ctx.currentAction?.initialStatusKindsByTarget[primaryId] ?? [] : []
    if (!when.primaryTargetStatusKinds.some((kind) => kinds.includes(kind))) return false
  }
  if (when.foeTags?.length) {
    if (!foe || !when.foeTags.every((tag) => foe.tags.includes(tag))) return false
  }
  if (when.targetHpRatioBelow !== undefined) {
    if (!foe || hpRatio(foe) >= when.targetHpRatioBelow) return false
  }
  if (when.targetHpRatioAbove !== undefined) {
    if (!foe || hpRatio(foe) <= when.targetHpRatioAbove) return false
  }

  const key = markName(scope, ctx.state.round, when)
  if (key && scope.source.marks.includes(key)) return false
  return true
}

/** 条件通过并真正结算后调用，消耗 oncePerBattle / oncePerRound。 */
export function consumeWhen(ctx: BattleContext, when: EffectWhen | undefined, scope: WhenScope): void {
  if (!when) return
  const key = markName(scope, ctx.state.round, when)
  if (key && !scope.source.marks.includes(key)) scope.source.marks.push(key)
}
