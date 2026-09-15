import { TIANYAN_PATHS } from "./tianyan-path-pack";
import { TIANYAN_SKILLS } from "./tianyan-skill-pack";
import { TIANYAN_FOUNDATION, TIANYAN_REACTIONS_V1, TIANYAN_STATUSES, type TianyanElementV1 } from "./tianyan-foundation";
export { TIANYAN_REACTIONS_V1 } from "./tianyan-foundation";
export type { TianyanElementV1, TianyanReactionKindV1, TianyanReactionDefV1 } from "./tianyan-foundation";
import { sectSkillLearning } from "./skill-learning";
import { SECT_METHODS } from "./method-pack";
import {
  DamageOrigin,
  EffectType,
  HookName,
  SkillTag,
  StatusCategory,
  TargetSide,
  type SkillEffect,
  type SkillHook,
} from "../core/index.ts"
import type { CombatV6ProjectionDiagnostic } from "../projection/types.ts"
import type { SectDefinitionV6, SectSkillDefV6 } from "./types.ts"

export const TIANYAN_V6_ID = "tianyan" as const
export const TIANYAN_PATH_ID = {
  Hetu: "tianyan.path.hetu",
  Luoshu: "tianyan.path.luoshu",
} as const
export const TIANYAN_RESOURCE_ID = "tianyan.resource.derivation"
export const TIANYAN_METHOD_ID = {
  Canon: "tianyan.method.canon",
  Wood: "tianyan.method.wood",
  Fire: "tianyan.method.fire",
  Earth: "tianyan.method.earth",
  Metal: "tianyan.method.metal",
  Water: "tianyan.method.water",
} as const
export const TIANYAN_SKILL_ID = {
  Wood: "tianyan.skill.wood",
  Fire: "tianyan.skill.fire",
  Earth: "tianyan.skill.earth",
  Metal: "tianyan.skill.metal",
  Water: "tianyan.skill.water",
  Formation: "tianyan.skill.formation",
  Transfer: "tianyan.skill.transfer",
  Ward: "tianyan.skill.ward",
  HetuUltimate: "tianyan.skill.hetu_ultimate",
  LuoshuUltimate: "tianyan.skill.luoshu_ultimate",
  LifeArray: "tianyan.skill.life_array",
  ReverseDivination: "tianyan.skill.reverse_divination",
  ReverseDivinationStrong: "tianyan.skill.reverse_divination_strong",
} as const
export const TIANYAN_MARK_KIND = "tianyan.status.mark"
export const TIANYAN_STATUS_ID = {
  WoodMark: "tianyan.status.mark.wood",
  FireMark: "tianyan.status.mark.fire",
  EarthMark: "tianyan.status.mark.earth",
  MetalMark: "tianyan.status.mark.metal",
  WaterMark: "tianyan.status.mark.water",
  Scorch: "tianyan.status.scorch",
  ScorchStrong: "tianyan.status.scorch_strong",
  Magma: "tianyan.status.magma",
  WaterSlow: "tianyan.status.water_slow",
  ColdSpring: "tianyan.status.cold_spring",
  Mire: "tianyan.status.mire",
  CollapseRoot: "tianyan.status.collapse_root",
  SeverMeridian: "tianyan.status.sever_meridian",
  MeltMetal: "tianyan.status.melt_metal",
  Formation: "tianyan.status.formation",
} as const
export const TIANYAN_BARRIER_ID = {
  Earth: "tianyan.barrier.earth",
  Ward: "tianyan.barrier.ward",
  Reaction: "tianyan.barrier.reaction",
  LifeArray: "tianyan.barrier.life_array",
  Ultimate: "tianyan.barrier.ultimate",
} as const

const elementOrder = TIANYAN_FOUNDATION.elements.map(entry => entry.element)
const markByElement = Object.fromEntries(TIANYAN_FOUNDATION.elements.map(entry => [entry.element, entry.markId])) as Record<TianyanElementV1, string>
const skillByElement = Object.fromEntries(TIANYAN_FOUNDATION.elements.map(entry => [entry.element, entry.skillId])) as Record<TianyanElementV1, string>

const passive = (id: string, name: string, hooks: SkillHook[]): SectSkillDefV6 => ({
  ...sectSkillLearning(id),
  kind: "passive",
  definition: { id, name, tags: [SkillTag.Passive], targeting: { side: TargetSide.Self }, effects: [], hooks },
})

const allElementSkillIds = [
  TIANYAN_SKILL_ID.Wood,
  TIANYAN_SKILL_ID.Fire,
  TIANYAN_SKILL_ID.Earth,
  TIANYAN_SKILL_ID.Metal,
  TIANYAN_SKILL_ID.Water,
]
const allDamageSkillIds = [...allElementSkillIds, TIANYAN_SKILL_ID.LuoshuUltimate, TIANYAN_SKILL_ID.ReverseDivination, TIANYAN_SKILL_ID.ReverseDivinationStrong]

function modifierPassive(
  id: string,
  name: string,
  on: SkillHook["on"],
  effect: SkillEffect,
  options: { skillIds?: string[]; targetStatusIds?: string[]; targetBelow?: number; targetAbove?: number } = {},
): SectSkillDefV6 {
  return passive(id, name, [{
    on,
    sourceIsSelf: true,
    when: {
      skillIds: options.skillIds,
      targetStatusIds: options.targetStatusIds,
      targetHpRatioBelow: options.targetBelow,
      targetHpRatioAbove: options.targetAbove,
      damageOrigins: on === HookName.OnHitCalc || on === HookName.OnDefenseIgnoreCalc || on === HookName.OnCritRoll
        ? [DamageOrigin.ActionDirect]
        : undefined,
    },
    effects: [effect],
  }])
}

const damagePassive = (id: string, name: string, factor: number, options: Parameters<typeof modifierPassive>[4] = {}) =>
  modifierPassive(id, name, HookName.OnHitCalc, { type: EffectType.ModifyStrike, factor }, { ...options, skillIds: options.skillIds ?? allDamageSkillIds })
const ignorePassive = (id: string, name: string, add: number, options: Parameters<typeof modifierPassive>[4] = {}) =>
  modifierPassive(id, name, HookName.OnDefenseIgnoreCalc, { type: EffectType.ModifyDefenseIgnore, add }, { ...options, skillIds: options.skillIds ?? allDamageSkillIds })
const statuses = TIANYAN_STATUSES


const baseSkills = TIANYAN_SKILLS.baseSkills

const reactionPassives = TIANYAN_REACTIONS_V1.flatMap((reaction) => {
  const result: SectSkillDefV6[] = []
  const options = { skillIds: [skillByElement[reaction.newElement]], targetStatusIds: [markByElement[reaction.oldElement]] }
  if (reaction.mainFactor) result.push(damagePassive(`tianyan.passive.reaction.${reaction.id}.damage`, `${reaction.name}·增幅`, reaction.mainFactor, options))
  if (reaction.defenseIgnore) result.push(ignorePassive(`tianyan.passive.reaction.${reaction.id}.ignore`, `${reaction.name}·破法`, reaction.defenseIgnore, options))
  return result
})


export const TIANYAN_V6_DEFINITION: SectDefinitionV6 = {
  id: TIANYAN_V6_ID,
  name: "天衍圣地",
  methods: SECT_METHODS.tianyan,
  skills: [...baseSkills, ...reactionPassives],
  statuses,
  paths: TIANYAN_PATHS,
}

export function validateTianyanReactionMatrixV1(): CombatV6ProjectionDiagnostic[] {
  const diagnostics: CombatV6ProjectionDiagnostic[] = []
  const keys = TIANYAN_REACTIONS_V1.map((reaction) => `${reaction.oldElement}:${reaction.newElement}`)
  if (new Set(keys).size !== keys.length) diagnostics.push({ severity: "error", code: "REACTION_MATRIX_DUPLICATE", message: "天衍反应关系存在重复有序组合" })
  if (TIANYAN_REACTIONS_V1.filter((reaction) => reaction.kind === "generate").length !== 5 || TIANYAN_REACTIONS_V1.filter((reaction) => reaction.kind === "overcome").length !== 5) {
    diagnostics.push({ severity: "error", code: "REACTION_MATRIX_INCOMPLETE", message: "天衍反应必须恰好包含五种化生与五种冲克" })
  }
  const statusIds = new Set(statuses.map((status) => status.id))
  const reactionIds = new Set<string>()
  for (const reaction of TIANYAN_REACTIONS_V1) {
    if (!reaction.id || !reaction.name || reaction.oldElement === reaction.newElement || !elementOrder.includes(reaction.oldElement) || !elementOrder.includes(reaction.newElement)) {
      diagnostics.push({ severity: "error", code: "INVALID_REACTION_DEFINITION", message: `天衍反应定义非法：${reaction.id || "<empty>"}` })
    }
    if (reactionIds.has(reaction.id)) diagnostics.push({ severity: "error", code: "REACTION_MATRIX_DUPLICATE", message: `天衍反应ID重复：${reaction.id}` })
    reactionIds.add(reaction.id)
    if (reaction.statusId && !statusIds.has(reaction.statusId)) diagnostics.push({ severity: "error", code: "UNKNOWN_REACTION_REFERENCE", message: `天衍反应引用未知状态：${reaction.statusId}` })
  }
  const classified = elementOrder.flatMap((oldElement) => elementOrder.map((newElement) => {
    if (oldElement === newElement) return "same"
    return TIANYAN_REACTIONS_V1.some((reaction) => reaction.oldElement === oldElement && reaction.newElement === newElement) ? "reaction" : "replace"
  }))
  if (classified.length !== 25 || classified.filter((kind) => kind === "same").length !== 5 || classified.filter((kind) => kind === "reaction").length !== 10 || classified.filter((kind) => kind === "replace").length !== 10) {
    diagnostics.push({ severity: "error", code: "REACTION_MATRIX_INCOMPLETE", message: "天衍25种有序组合分类不完整" })
  }
  const marks = statuses.filter((status) => status.kind === TIANYAN_MARK_KIND)
  if (marks.length !== 5 || new Set(marks.map((status) => status.id)).size !== 5 || marks.some((status) => status.category !== StatusCategory.Debuff)) {
    diagnostics.push({ severity: "error", code: "INVALID_ELEMENT_MARK_CONTENT", message: "天衍必须定义五个同kind且ID唯一的普通减益法印" })
  }
  return diagnostics
}
