/**
 * 技能表按单位解析。底表是整场一份；经脉等补丁挂在单位的 skillOverrides 上。
 * 查找不要直接 ctx.skills.get，否则两个单位会抢同一条技能定义。
 */
import type { SkillDef, SkillId, Unit } from "./types.ts"

export function skillOf(
  skills: Map<SkillId, SkillDef>,
  unit: Unit,
  id: SkillId,
): SkillDef | undefined {
  return unit.skillOverrides[id] ?? skills.get(id)
}

export function overridesFrom(defs: SkillDef[] | undefined): Record<SkillId, SkillDef> {
  if (!defs?.length) return {}
  const out: Record<SkillId, SkillDef> = {}
  for (const def of defs) out[def.id] = def
  return out
}
