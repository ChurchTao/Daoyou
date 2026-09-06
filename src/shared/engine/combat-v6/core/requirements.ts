import type { BattleContext } from "./context.ts"
import { FailReason, SkillTag, StatusFlag, failDetail } from "./enums.ts"
import { evalExpr } from "./expr.ts"
import { atLeast } from "./math.ts"
import { skillOf } from "./skills.ts"
import { hasBlock } from "./status.ts"
import type { SkillDef, Unit } from "./types.ts"
import { resourceOf } from "./units.ts"

export type SkillRequirementCheck = {
  mpCost: number
  hpCost: number
  resourceCosts: Array<{ resourceId: string; amount: number }>
  reasons: string[]
}

/** 只读技能预检；查询与实际执行共用，不消费 RNG，也不写事件。 */
export function checkSkillRequirements(
  ctx: BattleContext,
  unit: Unit,
  skill: SkillDef,
  targets: Unit[],
): SkillRequirementCheck {
  const env = { skillLevel: unit.skillLevels[skill.id] ?? unit.level, targets: targets.length, source: unit, target: targets[0] }
  const mpCost = atLeast(0, Math.floor(evalExpr(skill.costMp ?? 0, env) * mpCostFactor(ctx, unit)))
  const hpCost = atLeast(0, Math.floor(evalExpr(skill.costHp ?? 0, env)))
  const resourceCosts = resolveResourceCosts(skill, env)
  const reasons: string[] = []

  if (hasBlock(ctx, unit, StatusFlag.BlocksAction)) reasons.push("blocks-action")
  if (skill.tags.includes(SkillTag.Spell) && hasBlock(ctx, unit, StatusFlag.BlocksSpell)) reasons.push(FailReason.Sealed)
  if (skill.tags.includes(SkillTag.Physical) && hasBlock(ctx, unit, StatusFlag.BlocksPhysical)) reasons.push(FailReason.Rooted)
  if (targets.length === 0) reasons.push(FailReason.NoTarget)
  if (skill.requireHpRatio !== undefined && unit.attrs.hp / unit.attrs.maxHp < skill.requireHpRatio) reasons.push(FailReason.HpRequirement)

  const missingRequirement = skill.resourceRequirements?.find(
    (requirement) => (resourceOf(unit, requirement.resourceId)?.current ?? 0) < requirement.min,
  )
  if (missingRequirement) reasons.push(failDetail(FailReason.ResourceRequirement, missingRequirement.resourceId))
  const missingCost = resourceCosts.find(
    (cost) => (resourceOf(unit, cost.resourceId)?.current ?? 0) < cost.amount,
  )
  if (missingCost) reasons.push(failDetail(FailReason.ResourceRequirement, missingCost.resourceId))
  if (unit.attrs.mp < mpCost) reasons.push(FailReason.InsufficientMp)

  return { mpCost, hpCost, resourceCosts, reasons: [...new Set(reasons)] }
}

function resolveResourceCosts(
  skill: SkillDef,
  env: Parameters<typeof evalExpr>[1],
): Array<{ resourceId: string; amount: number }> {
  const totals = new Map<string, number>()
  for (const cost of skill.resourceCosts ?? []) {
    const amount = atLeast(0, Math.floor(evalExpr(cost.amount, env)))
    totals.set(cost.resourceId, (totals.get(cost.resourceId) ?? 0) + amount)
  }
  return [...totals].map(([resourceId, amount]) => ({ resourceId, amount }))
}

function mpCostFactor(ctx: BattleContext, unit: Unit): number {
  let factor = 1
  for (const id of unit.passives) {
    const innate = skillOf(ctx.skills, unit, id)?.innate?.mpCostFactor
    if (innate !== undefined) factor *= innate
  }
  return factor
}
