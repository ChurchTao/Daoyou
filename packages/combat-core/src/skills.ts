/**
 * 技能表按单位解析。底表是整场一份；经脉等补丁挂在单位的 skillOverrides 上。
 * 查找不要直接 ctx.skills.get，否则两个单位会抢同一条技能定义。
 */
import { EffectType, SkillTag } from './enums.js';
import type { SkillDef, SkillEffect, SkillId, Unit } from "./types.js"

/** Active damage declarations, including conditional branches, without recursive invocation. */
export function isActiveAttackSkill(skill: SkillDef): boolean {
  if (skill.tags.includes(SkillTag.Passive)) return false
  const effects = [...skill.effects, ...(skill.successEffects ?? []), ...(skill.preparation?.effects ?? [])]
  return hasEffect(effects, effect =>
    (effect.type === EffectType.PhysicalHit && !effect.healInstead) ||
    effect.type === EffectType.SpellHit || effect.type === EffectType.FixedHit) &&
    !hasEffect(effects, effect => effect.type === EffectType.InvokeAttackSkills)
}

export function invokesAttackSkills(skill: SkillDef): boolean {
  return hasEffect([...skill.effects, ...(skill.successEffects ?? []), ...(skill.preparation?.effects ?? [])], effect => effect.type === EffectType.InvokeAttackSkills)
}

function hasEffect(effects: SkillEffect[], matches: (effect: SkillEffect) => boolean): boolean {
  return effects.some(effect => matches(effect) ||
    (effect.type === EffectType.Repeat && hasEffect(effect.effects, matches)) ||
    (effect.type === EffectType.RandomBranch &&
      (hasEffect(effect.successEffects, matches) || hasEffect(effect.failureEffects, matches))))
}

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

/** Resolve active passive definitions consistently, including declared conflicts. */
export function passiveSkills(skills: Map<SkillId, SkillDef>, unit: Unit): SkillDef[] {
  return unit.passives.flatMap(id => {
    const skill = skillOf(skills, unit, id)
    return skill && !skill.conflicts?.some(other => unit.passives.includes(other) || unit.skills.includes(other)) ? [skill] : []
  })
}
