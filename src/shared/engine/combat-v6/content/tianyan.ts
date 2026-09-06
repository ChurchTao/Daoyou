import {
  DamageOrigin,
  EffectType,
  HookName,
  SkillTag,
  StatusCategory,
  StatusHit,
  TargetMode,
  TargetSide,
  type SkillDef,
  type SkillEffect,
  type SkillHook,
  type StatusDef,
} from "../core/index.ts"
import type { CombatV6PanelContribution, CombatV6ProjectionDiagnostic } from "../projection/types.ts"
import type { MeridianNodeDefV6, SectDefinitionV6, SectSkillDefV6, SkillPatchV6 } from "./types.ts"

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

export type TianyanElementV1 = "wood" | "fire" | "earth" | "metal" | "water"
export type TianyanReactionKindV1 = "generate" | "overcome"
export interface TianyanReactionDefV1 {
  id: string
  name: string
  kind: TianyanReactionKindV1
  oldElement: TianyanElementV1
  newElement: TianyanElementV1
  mainFactor?: number
  defenseIgnore?: number
  followPower?: string
  statusId?: string
  healingPower?: string
}

const elementOrder: TianyanElementV1[] = ["wood", "fire", "earth", "metal", "water"]
const markByElement: Record<TianyanElementV1, string> = {
  wood: TIANYAN_STATUS_ID.WoodMark,
  fire: TIANYAN_STATUS_ID.FireMark,
  earth: TIANYAN_STATUS_ID.EarthMark,
  metal: TIANYAN_STATUS_ID.MetalMark,
  water: TIANYAN_STATUS_ID.WaterMark,
}
const skillByElement: Record<TianyanElementV1, string> = {
  wood: TIANYAN_SKILL_ID.Wood,
  fire: TIANYAN_SKILL_ID.Fire,
  earth: TIANYAN_SKILL_ID.Earth,
  metal: TIANYAN_SKILL_ID.Metal,
  water: TIANYAN_SKILL_ID.Water,
}

export const TIANYAN_REACTIONS_V1: readonly TianyanReactionDefV1[] = Object.freeze([
  { id: "tianyan.reaction.wildfire", name: "燎原", kind: "generate", oldElement: "wood", newElement: "fire", mainFactor: 1.25, followPower: "floor(source.magicAtk * 0.25)" },
  { id: "tianyan.reaction.magma", name: "熔岩", kind: "generate", oldElement: "fire", newElement: "earth", mainFactor: 1.15, statusId: TIANYAN_STATUS_ID.Magma },
  { id: "tianyan.reaction.forging", name: "锻锋", kind: "generate", oldElement: "earth", newElement: "metal", mainFactor: 1.15, defenseIgnore: 0.2 },
  { id: "tianyan.reaction.cold_spring", name: "寒泉", kind: "generate", oldElement: "metal", newElement: "water", mainFactor: 1.15, statusId: TIANYAN_STATUS_ID.ColdSpring },
  { id: "tianyan.reaction.flourish", name: "滋荣", kind: "generate", oldElement: "water", newElement: "wood", mainFactor: 1.15, healingPower: "floor(target.maxHp * 0.04) + floor(skillLevel * 0.5)" },
  { id: "tianyan.reaction.evaporate", name: "蒸发", kind: "overcome", oldElement: "fire", newElement: "water", followPower: "floor(impactDamage * 0.5)" },
  { id: "tianyan.reaction.mire", name: "泥沼", kind: "overcome", oldElement: "water", newElement: "earth", followPower: "floor(impactDamage * 0.35)", statusId: TIANYAN_STATUS_ID.Mire },
  { id: "tianyan.reaction.collapse_root", name: "崩根", kind: "overcome", oldElement: "earth", newElement: "wood", followPower: "floor(impactDamage * 0.4)", statusId: TIANYAN_STATUS_ID.CollapseRoot },
  { id: "tianyan.reaction.sever_meridian", name: "断脉", kind: "overcome", oldElement: "wood", newElement: "metal", followPower: "floor(impactDamage * 0.35)", statusId: TIANYAN_STATUS_ID.SeverMeridian },
  { id: "tianyan.reaction.melt_metal", name: "熔金", kind: "overcome", oldElement: "metal", newElement: "fire", followPower: "floor(impactDamage * 0.4)", statusId: TIANYAN_STATUS_ID.MeltMetal },
])

const panel = (attr: CombatV6PanelContribution["attr"], mode: CombatV6PanelContribution["mode"], value: number): CombatV6PanelContribution => ({ attr, mode, value })
const active = (sourceMethodId: string, definition: SkillDef, unlockMethodLevel = 1): SectSkillDefV6 => ({ sourceMethodId, unlockMethodLevel, kind: "active", definition })
const passive = (id: string, name: string, hooks: SkillHook[], sourceMethodId = TIANYAN_METHOD_ID.Canon): SectSkillDefV6 => ({
  sourceMethodId,
  unlockMethodLevel: 0,
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
const allHealingSkillIds = [...allElementSkillIds, TIANYAN_SKILL_ID.HetuUltimate, TIANYAN_SKILL_ID.LifeArray]
const allBarrierSkillIds = [...allElementSkillIds, TIANYAN_SKILL_ID.Ward, TIANYAN_SKILL_ID.HetuUltimate, TIANYAN_SKILL_ID.LifeArray]

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
const healPassive = (id: string, name: string, factor: number, options: Parameters<typeof modifierPassive>[4] = {}) =>
  modifierPassive(id, name, HookName.OnHealCalc, { type: EffectType.ModifyHeal, factor }, { ...options, skillIds: options.skillIds ?? allHealingSkillIds })
const barrierPassive = (id: string, name: string, factor: number, options: Parameters<typeof modifierPassive>[4] = {}) =>
  modifierPassive(id, name, HookName.OnBarrierCalc, { type: EffectType.ModifyBarrier, factor }, { ...options, skillIds: options.skillIds ?? allBarrierSkillIds })

const statuses: StatusDef[] = [
  ...elementOrder.map((element) => ({ id: markByElement[element], name: `${({ wood: "木", fire: "火", earth: "土", metal: "金", water: "水" } as const)[element]}印`, kind: TIANYAN_MARK_KIND, category: StatusCategory.Debuff })),
  { id: TIANYAN_STATUS_ID.Scorch, name: "灼痕", kind: "tianyan.scorch", category: StatusCategory.Dot, ticks: "roundEnd", onTick: { type: "dot", ratioOfMaxHp: 0.02 } },
  { id: TIANYAN_STATUS_ID.ScorchStrong, name: "炽烈灼痕", kind: "tianyan.scorch", category: StatusCategory.Dot, ticks: "roundEnd", onTick: { type: "dot", ratioOfMaxHp: 0.03 } },
  { id: TIANYAN_STATUS_ID.Magma, name: "熔岩", kind: "tianyan.magma", category: StatusCategory.Dot, ticks: "roundEnd", onTick: { type: "dot", ratioOfMaxHp: 0.03 } },
  { id: TIANYAN_STATUS_ID.WaterSlow, name: "凝流", kind: "tianyan.water_slow", category: StatusCategory.Debuff, speedMod: "-floor(skillLevel * 0.2)" },
  { id: TIANYAN_STATUS_ID.ColdSpring, name: "寒泉", kind: "tianyan.water_slow", category: StatusCategory.Debuff, speedMod: "-floor(skillLevel * 0.4)" },
  { id: TIANYAN_STATUS_ID.Mire, name: "泥沼", kind: "tianyan.mire", category: StatusCategory.Control, blocksAction: true },
  { id: TIANYAN_STATUS_ID.CollapseRoot, name: "崩根", kind: "tianyan.collapse_root", category: StatusCategory.Debuff, attrMods: { magicDef: "-floor(target.magicDef * 0.2)" } },
  { id: TIANYAN_STATUS_ID.SeverMeridian, name: "断脉", kind: "tianyan.sever_meridian", category: StatusCategory.Control, blocksSpell: true },
  { id: TIANYAN_STATUS_ID.MeltMetal, name: "熔金", kind: "tianyan.melt_metal", category: StatusCategory.Debuff, attrMods: { physicalAtk: "-floor(target.physicalAtk * 0.2)", magicAtk: "-floor(target.magicAtk * 0.2)" } },
  { id: TIANYAN_STATUS_ID.Formation, name: "九宫布阵", kind: "tianyan.formation", category: StatusCategory.Buff, attrMods: { magicDef: "floor(skillLevel * 0.4)", sealResist: "floor(skillLevel * 0.2)" } },
]

function relationEffects(element: TianyanElementV1): SkillEffect[] {
  return TIANYAN_REACTIONS_V1.filter((reaction) => reaction.newElement === element).flatMap((reaction) => {
    const when = { primaryTargetStatusIds: [markByElement[reaction.oldElement]] }
    const effects: SkillEffect[] = [{ type: EffectType.EmitMechanic, mechanicId: reaction.id, name: reaction.name, when }]
    if (reaction.followPower) effects.push({ type: EffectType.FixedHit, power: reaction.followPower, formula: "fixed", origin: DamageOrigin.HookDerived, when })
    if (reaction.statusId) effects.push({
      type: EffectType.ApplyStatus,
      statusId: reaction.statusId,
      duration: reaction.statusId === TIANYAN_STATUS_ID.Mire || reaction.statusId === TIANYAN_STATUS_ID.SeverMeridian ? 1 : 2,
      hit: reaction.statusId === TIANYAN_STATUS_ID.Mire || reaction.statusId === TIANYAN_STATUS_ID.SeverMeridian ? StatusHit.Seal : undefined,
      when,
    })
    if (reaction.healingPower) effects.push({ type: EffectType.Heal, power: reaction.healingPower, targeting: { side: TargetSide.Ally, mode: TargetMode.LowestHp, count: 1 }, when })
    effects.push(
      { type: EffectType.RemoveStatus, statusIds: [markByElement[reaction.oldElement]], maxCount: 1, when },
      { type: EffectType.ModifyResource, resourceId: TIANYAN_RESOURCE_ID, amount: 1, maxGainPerAction: 1, when },
    )
    return effects
  })
}

function elementalSkill(
  element: TianyanElementV1,
  sourceMethodId: string,
  name: string,
  coeff: number,
  power: string,
  sideEffects: SkillEffect[],
): SectSkillDefV6 {
  return active(sourceMethodId, {
    id: skillByElement[element],
    name,
    school: TIANYAN_V6_ID,
    costMp: "20 + floor(skillLevel * 0.35)",
    tags: [SkillTag.Spell],
    formula: "spell",
    targeting: { side: TargetSide.Enemy, count: 1 },
    effects: [
      { type: EffectType.SpellHit, coeff, power },
      ...sideEffects,
      ...relationEffects(element),
      { type: EffectType.ApplyStatus, statusId: markByElement[element], duration: 2 },
    ],
  })
}

const baseSkills: SectSkillDefV6[] = [
  elementalSkill("wood", TIANYAN_METHOD_ID.Wood, "三碧生机", 0.75, "25 + floor(skillLevel)", [
    { type: EffectType.Heal, power: "floor(target.maxHp * 0.02) + floor(skillLevel * 0.4)", targeting: { side: TargetSide.Ally, mode: TargetMode.LowestHp, count: 1 } },
  ]),
  elementalSkill("fire", TIANYAN_METHOD_ID.Fire, "九紫流照", 0.9, "35 + floor(skillLevel * 1.2)", [
    { type: EffectType.ApplyStatus, statusId: TIANYAN_STATUS_ID.Scorch, duration: 2 },
  ]),
  elementalSkill("earth", TIANYAN_METHOD_ID.Earth, "五中镇岳", 0.7, "20 + floor(skillLevel * 0.9)", [
    { type: EffectType.ApplyBarrier, id: TIANYAN_BARRIER_ID.Earth, kind: "tianyan.earth", name: "五中镇岳", power: "floor(target.maxHp * 0.03) + floor(skillLevel * 0.5)", duration: 2, targeting: { side: TargetSide.Ally, mode: TargetMode.LowestHp, count: 1 } },
  ]),
  elementalSkill("metal", TIANYAN_METHOD_ID.Metal, "七赤裁云", 0.82, "30 + floor(skillLevel * 1.1)", [
    { type: EffectType.Dispel, categories: [StatusCategory.Buff], maxCount: 1 },
  ]),
  elementalSkill("water", TIANYAN_METHOD_ID.Water, "一白回澜", 0.78, "28 + floor(skillLevel)", [
    { type: EffectType.ApplyStatus, statusId: TIANYAN_STATUS_ID.WaterSlow, duration: 2 },
  ]),
  active(TIANYAN_METHOD_ID.Canon, {
    id: TIANYAN_SKILL_ID.Formation,
    name: "九宫布阵",
    school: TIANYAN_V6_ID,
    costMp: "30 + floor(skillLevel * 0.4)",
    tags: [SkillTag.Spell, SkillTag.Support],
    targeting: { side: TargetSide.Ally, mode: TargetMode.Fill, count: 5 },
    effects: [{ type: EffectType.ApplyStatus, statusId: TIANYAN_STATUS_ID.Formation, duration: 3 }],
  }, 20),
  active(TIANYAN_METHOD_ID.Canon, {
    id: TIANYAN_SKILL_ID.Transfer,
    name: "河洛传印",
    school: TIANYAN_V6_ID,
    costMp: "35 + floor(skillLevel * 0.4)",
    tags: [SkillTag.Spell, SkillTag.Support],
    targeting: { side: TargetSide.Enemy, count: 1, requireStatusKinds: [TIANYAN_MARK_KIND] },
    effects: [{ type: EffectType.CopyStatus, kinds: [TIANYAN_MARK_KIND], maxCount: 1, targeting: { side: TargetSide.Enemy, mode: TargetMode.Fill, count: 3 } }],
  }, 40),
  active(TIANYAN_METHOD_ID.Canon, {
    id: TIANYAN_SKILL_ID.Ward,
    name: "三才护阵",
    school: TIANYAN_V6_ID,
    costMp: "40 + floor(skillLevel * 0.5)",
    resourceRequirements: [{ resourceId: TIANYAN_RESOURCE_ID, min: 1 }],
    resourceCosts: [{ resourceId: TIANYAN_RESOURCE_ID, amount: 1 }],
    tags: [SkillTag.Spell, SkillTag.Support],
    targeting: { side: TargetSide.Ally, mode: TargetMode.Fill, count: 4 },
    effects: [{ type: EffectType.ApplyBarrier, id: TIANYAN_BARRIER_ID.Ward, kind: "tianyan.ward", name: "三才护阵", power: "floor(target.maxHp * 0.05) + floor(skillLevel * 0.8)", duration: 2 }],
  }, 60),
]

const reactionPassives = TIANYAN_REACTIONS_V1.flatMap((reaction) => {
  const result: SectSkillDefV6[] = []
  const options = { skillIds: [skillByElement[reaction.newElement]], targetStatusIds: [markByElement[reaction.oldElement]] }
  if (reaction.mainFactor) result.push(damagePassive(`tianyan.passive.reaction.${reaction.id}.damage`, `${reaction.name}·增幅`, reaction.mainFactor, options))
  if (reaction.defenseIgnore) result.push(ignorePassive(`tianyan.passive.reaction.${reaction.id}.ignore`, `${reaction.name}·破法`, reaction.defenseIgnore, options))
  return result
})

const hetuUltimate = active(TIANYAN_METHOD_ID.Canon, {
  id: TIANYAN_SKILL_ID.HetuUltimate,
  name: "河图万象",
  school: TIANYAN_V6_ID,
  costMp: "60 + floor(skillLevel * 0.6)",
  resourceRequirements: [{ resourceId: TIANYAN_RESOURCE_ID, min: 3 }],
  resourceCosts: [{ resourceId: TIANYAN_RESOURCE_ID, amount: 3 }],
  tags: [SkillTag.Spell, SkillTag.Support],
  targeting: { side: TargetSide.Ally, mode: TargetMode.All },
  effects: [
    { type: EffectType.Heal, power: "floor(target.maxHp * 0.05)" },
    { type: EffectType.ApplyBarrier, id: TIANYAN_BARRIER_ID.Ultimate, kind: "tianyan.ultimate", name: "河图万象", power: "floor(target.maxHp * 0.05) + floor(skillLevel * 0.8)", duration: 2 },
    { type: EffectType.RestoreMp, power: "floor(target.maxMp * 0.05)" },
  ],
}, 60)

const luoshuUltimate = active(TIANYAN_METHOD_ID.Canon, {
  id: TIANYAN_SKILL_ID.LuoshuUltimate,
  name: "洛书断局",
  school: TIANYAN_V6_ID,
  costMp: "60 + floor(skillLevel * 0.6)",
  resourceRequirements: [{ resourceId: TIANYAN_RESOURCE_ID, min: 3 }],
  resourceCosts: [{ resourceId: TIANYAN_RESOURCE_ID, amount: 3 }],
  tags: [SkillTag.Spell, SkillTag.Seal],
  sealBase: 55,
  targeting: { side: TargetSide.Enemy, count: 1 },
  effects: [
    { type: EffectType.SpellHit, coeff: 1.6, power: "70 + floor(skillLevel * 1.4)", defenseIgnore: 0.15 },
    { type: EffectType.Dispel, categories: [StatusCategory.Buff], maxCount: 1 },
    { type: EffectType.ApplyStatus, statusId: TIANYAN_STATUS_ID.SeverMeridian, duration: 1, hit: StatusHit.Seal },
  ],
}, 60)

const lifeArray = active(TIANYAN_METHOD_ID.Wood, {
  id: TIANYAN_SKILL_ID.LifeArray,
  name: "生生化阵",
  school: TIANYAN_V6_ID,
  costMp: "45 + floor(skillLevel * 0.5)",
  tags: [SkillTag.Spell, SkillTag.Support],
  targeting: { side: TargetSide.Ally, count: 1 },
  effects: [
    { type: EffectType.RemoveWound, power: "floor(skillLevel * 1.2)" },
    { type: EffectType.Heal, power: "floor(target.maxHp * 0.04) + floor(skillLevel * 0.8)" },
    { type: EffectType.ApplyBarrier, id: TIANYAN_BARRIER_ID.LifeArray, kind: "tianyan.life_array", name: "生生化阵", power: "floor(target.maxHp * 0.06) + floor(skillLevel * 0.6)", duration: 2 },
  ],
}, 60)

const reverseDivination = active(TIANYAN_METHOD_ID.Fire, {
  id: TIANYAN_SKILL_ID.ReverseDivination,
  name: "逆演天机",
  school: TIANYAN_V6_ID,
  costMp: "50 + floor(skillLevel * 0.5)",
  tags: [SkillTag.Spell],
  formula: "spell",
  targeting: { side: TargetSide.Enemy, count: 1, requireStatusKinds: [TIANYAN_MARK_KIND] },
  effects: [
    { type: EffectType.SpellHit, coeff: 1.25, power: "40 + floor(skillLevel * 1.2)" },
    { type: EffectType.RemoveStatus, kinds: [TIANYAN_MARK_KIND], maxCount: 1 },
    { type: EffectType.FixedHit, power: "floor(source.magicAtk * 0.35)", formula: "fixed", origin: DamageOrigin.HookDerived },
    { type: EffectType.ModifyResource, resourceId: TIANYAN_RESOURCE_ID, amount: 1, maxGainPerAction: 1 },
  ],
}, 60)

const reverseDivinationStrong = active(TIANYAN_METHOD_ID.Fire, {
  ...structuredClone(reverseDivination.definition),
  id: TIANYAN_SKILL_ID.ReverseDivinationStrong,
  effects: reverseDivination.definition.effects.map((effect) => effect.type === EffectType.FixedHit
    ? { ...effect, power: "floor(source.magicAtk * 0.45)" }
    : structuredClone(effect)),
}, 60)

function reactionPatches(effect: SkillEffect, kind: TianyanReactionKindV1 = "generate"): SkillPatchV6[] {
  return TIANYAN_REACTIONS_V1.filter((reaction) => reaction.kind === kind).map((reaction) => ({
    skillId: skillByElement[reaction.newElement],
    operation: "appendEffect" as const,
    effect: { ...structuredClone(effect), when: { ...(effect.when ?? {}), primaryTargetStatusIds: [markByElement[reaction.oldElement]] } },
  }))
}

function barrierDurationPatches(value: number): SkillPatchV6[] {
  return [
    [TIANYAN_SKILL_ID.Earth, TIANYAN_BARRIER_ID.Earth],
    [TIANYAN_SKILL_ID.Ward, TIANYAN_BARRIER_ID.Ward],
    [TIANYAN_SKILL_ID.LifeArray, TIANYAN_BARRIER_ID.LifeArray],
    [TIANYAN_SKILL_ID.HetuUltimate, TIANYAN_BARRIER_ID.Ultimate],
    ...allElementSkillIds.map((id) => [id, TIANYAN_BARRIER_ID.Reaction]),
  ].map(([skillId, barrierId]) => ({ skillId, operation: "setBarrierDuration", barrierId, value }) as SkillPatchV6)
}

function hetuNodes(): MeridianNodeDefV6[] {
  const pathId = TIANYAN_PATH_ID.Hetu
  const node = (layer: MeridianNodeDefV6["layer"], slot: MeridianNodeDefV6["slot"], name: string, extra: Omit<MeridianNodeDefV6, "id" | "pathId" | "layer" | "slot" | "name" | "description">, description = name): MeridianNodeDefV6 => ({ id: `tianyan.node.hetu.${layer}.${slot}`, name, pathId, layer, slot, description, ...extra })
  return [
    node(1, 1, "生机流转", { passives: [healPassive("tianyan.passive.hetu.1.1", "生机流转", 1.1, { skillIds: [TIANYAN_SKILL_ID.Wood] })] }),
    node(1, 2, "厚土载物", { passives: [barrierPassive("tianyan.passive.hetu.1.2", "厚土载物", 1.1, { skillIds: [TIANYAN_SKILL_ID.Earth] })] }),
    node(1, 3, "灵枢洞明", { panel: [panel("healPower", "add", 30)] }),
    node(2, 1, "河图生息", { patches: reactionPatches({ type: EffectType.Heal, power: "floor(target.maxHp * 0.02) + floor(skillLevel * 0.3)", targeting: { side: TargetSide.Ally, mode: TargetMode.LowestHp, count: 1 } }) }),
    node(2, 2, "九宫护元", { patches: reactionPatches({ type: EffectType.ApplyBarrier, id: TIANYAN_BARRIER_ID.Reaction, kind: "tianyan.reaction", name: "九宫护元", power: "floor(target.maxHp * 0.03) + floor(skillLevel * 0.3)", duration: 2, targeting: { side: TargetSide.Ally, mode: TargetMode.LowestHp, count: 1 } }) }),
    node(2, 3, "步罡踏斗", { panel: [panel("speed", "add", 30)] }),
    node(3, 1, "生生化阵", { grantSkills: [lifeArray] }),
    node(3, 2, "印布三才", { patches: [{ skillId: TIANYAN_SKILL_ID.Transfer, operation: "setEffectTargetCount", effectType: EffectType.CopyStatus, value: 4 }] }),
    node(3, 3, "九宫久驻", { patches: [{ skillId: TIANYAN_SKILL_ID.Formation, operation: "setStatusDuration", statusId: TIANYAN_STATUS_ID.Formation, value: 5 }] }),
    node(4, 1, "木德滋荣", { passives: [healPassive("tianyan.passive.hetu.4.1", "木德滋荣", 1.15, { skillIds: [TIANYAN_SKILL_ID.Wood] })] }),
    node(4, 2, "土德重垣", { passives: [barrierPassive("tianyan.passive.hetu.4.2", "土德重垣", 1.15, { skillIds: [TIANYAN_SKILL_ID.Earth] })] }),
    node(4, 3, "周天固阵", { passives: [barrierPassive("tianyan.passive.hetu.4.3", "周天固阵", 1.2, { skillIds: [TIANYAN_SKILL_ID.Ward] })] }),
    node(5, 1, "雪中回春", { passives: [healPassive("tianyan.passive.hetu.5.1", "雪中回春", 1.15, { targetBelow: 0.5 })] }),
    node(5, 2, "危垣加护", { passives: [barrierPassive("tianyan.passive.hetu.5.2", "危垣加护", 1.15, { targetBelow: 0.5 })] }),
    node(5, 3, "洗髓归元", { patches: reactionPatches({ type: EffectType.RemoveWound, power: "floor(skillLevel * 0.6)", targeting: { side: TargetSide.Ally, mode: TargetMode.LowestHp, count: 1 } }) }),
    node(6, 1, "大衍生生", { passives: [healPassive("tianyan.passive.hetu.6.1", "大衍生生", 1.1)] }),
    node(6, 2, "万象成垣", { passives: [barrierPassive("tianyan.passive.hetu.6.2", "万象成垣", 1.1)], patches: barrierDurationPatches(3) }),
    node(6, 3, "移宫久印", { patches: [{ skillId: TIANYAN_SKILL_ID.Transfer, operation: "setCopyStatusDurationAdd", value: 1 }] }),
    node(7, 1, "众生归元", { patches: [{ skillId: TIANYAN_SKILL_ID.HetuUltimate, operation: "prependEffect", effect: { type: EffectType.RemoveWound, power: "floor(target.maxHp * 0.05)" } }, { skillId: TIANYAN_SKILL_ID.HetuUltimate, operation: "multiplyHealPower", value: 1.6 }] }),
    node(7, 2, "河图天幕", { patches: [{ skillId: TIANYAN_SKILL_ID.HetuUltimate, operation: "multiplyBarrierPower", value: 1.6 }, { skillId: TIANYAN_SKILL_ID.HetuUltimate, operation: "setBarrierDuration", barrierId: TIANYAN_BARRIER_ID.Ultimate, value: 3 }] }),
    node(7, 3, "生数不绝", { patches: [{ skillId: TIANYAN_SKILL_ID.HetuUltimate, operation: "multiplyRestoreMpPower", value: 2 }, { skillId: TIANYAN_SKILL_ID.HetuUltimate, operation: "appendEffect", effect: { type: EffectType.ModifyResource, resourceId: TIANYAN_RESOURCE_ID, amount: 1 } }] }),
  ]
}

function immediateReactionPowerPatches(factor: number, kind?: TianyanReactionKindV1): SkillPatchV6[] {
  return TIANYAN_REACTIONS_V1.filter((reaction) => reaction.followPower && (!kind || reaction.kind === kind)).map((reaction) => ({
    skillId: skillByElement[reaction.newElement],
    operation: "multiplyEffectPower" as const,
    effectType: EffectType.FixedHit,
    primaryTargetStatusId: markByElement[reaction.oldElement],
    value: factor,
  }))
}

function luoshuNodes(): MeridianNodeDefV6[] {
  const pathId = TIANYAN_PATH_ID.Luoshu
  const node = (layer: MeridianNodeDefV6["layer"], slot: MeridianNodeDefV6["slot"], name: string, extra: Omit<MeridianNodeDefV6, "id" | "pathId" | "layer" | "slot" | "name" | "description">, description = name): MeridianNodeDefV6 => ({ id: `tianyan.node.luoshu.${layer}.${slot}`, name, pathId, layer, slot, description, ...extra })
  return [
    node(1, 1, "离明炽盛", { passives: [damagePassive("tianyan.passive.luoshu.1.1", "离明炽盛", 1.1, { skillIds: [TIANYAN_SKILL_ID.Fire] })] }),
    node(1, 2, "庚金肃杀", { passives: [damagePassive("tianyan.passive.luoshu.1.2", "庚金肃杀", 1.1, { skillIds: [TIANYAN_SKILL_ID.Metal] })] }),
    node(1, 3, "星枢灌顶", { panel: [panel("magicAtk", "add", 30)] }),
    node(2, 1, "观印知隙", { passives: [damagePassive("tianyan.passive.luoshu.2.1", "观印知隙", 1.08, { targetStatusIds: Object.values(markByElement) })] }),
    node(2, 2, "制化余威", { patches: immediateReactionPowerPatches(1.15) }),
    node(2, 3, "破妄见真", { passives: [ignorePassive("tianyan.passive.luoshu.2.3", "破妄见真", 0.05)] }),
    node(3, 1, "逆演天机", { grantSkills: [reverseDivination] }),
    node(3, 2, "坎水激流", { patches: [{ skillId: TIANYAN_SKILL_ID.Water, operation: "multiplySpellCoefficients", value: 0.9 / 0.78 }] }),
    node(3, 3, "逆数增煞", { grantSkills: [reverseDivinationStrong] }),
    node(4, 1, "九紫余烬", { patches: [{ skillId: TIANYAN_SKILL_ID.Fire, operation: "replaceStatusId", from: TIANYAN_STATUS_ID.Scorch, to: TIANYAN_STATUS_ID.ScorchStrong }] }),
    node(4, 2, "七赤破阵", { patches: [{ skillId: TIANYAN_SKILL_ID.Metal, operation: "setDispelMaxCount", value: 2 }] }),
    node(4, 3, "一白凝时", { patches: [{ skillId: TIANYAN_SKILL_ID.Water, operation: "setStatusDuration", statusId: TIANYAN_STATUS_ID.WaterSlow, value: 3 }, { skillId: TIANYAN_SKILL_ID.Water, operation: "setStatusDuration", statusId: TIANYAN_STATUS_ID.ColdSpring, value: 3 }] }),
    node(5, 1, "盛极当制", { passives: [damagePassive("tianyan.passive.luoshu.5.1", "盛极当制", 1.08, { targetAbove: 0.7 })] }),
    node(5, 2, "天机暴显", { passives: [modifierPassive("tianyan.passive.luoshu.5.2", "天机暴显", HookName.OnCritRoll, { type: EffectType.ModifyChance, add: 0.05 }, { skillIds: allDamageSkillIds })] }),
    node(5, 3, "冲克加刑", { patches: immediateReactionPowerPatches(1.2, "overcome") }),
    node(6, 1, "万法归算", { passives: [damagePassive("tianyan.passive.luoshu.6.1", "万法归算", 1.1)] }),
    node(6, 2, "法界无蔽", { passives: [ignorePassive("tianyan.passive.luoshu.6.2", "法界无蔽", 0.1)] }),
    node(6, 3, "逆演重构", { patches: [{ skillId: TIANYAN_SKILL_ID.ReverseDivination, operation: "multiplySpellCoefficients", value: 1.45 / 1.25 }, { skillId: TIANYAN_SKILL_ID.ReverseDivinationStrong, operation: "multiplySpellCoefficients", value: 1.45 / 1.25 }] }),
    node(7, 1, "天罚增威", { patches: [{ skillId: TIANYAN_SKILL_ID.LuoshuUltimate, operation: "multiplySpellCoefficients", value: 1.8 / 1.6 }] }),
    node(7, 2, "破阵尽除", { patches: [{ skillId: TIANYAN_SKILL_ID.LuoshuUltimate, operation: "setDispelMaxCount", value: 2 }] }),
    node(7, 3, "断局封天", { patches: [{ skillId: TIANYAN_SKILL_ID.LuoshuUltimate, operation: "setSealBase", value: 65 }, { skillId: TIANYAN_SKILL_ID.LuoshuUltimate, operation: "setStatusDuration", statusId: TIANYAN_STATUS_ID.SeverMeridian, value: 2 }] }),
  ]
}

const hetuFoundation = [
  healPassive("tianyan.passive.hetu.foundation.heal", "河图演生·生息", 1.05),
  barrierPassive("tianyan.passive.hetu.foundation.barrier", "河图演生·护元", 1.05),
]
const luoshuFoundation = [damagePassive("tianyan.passive.luoshu.foundation", "洛书制化", 1.05)]

export const TIANYAN_V6_DEFINITION: SectDefinitionV6 = {
  id: TIANYAN_V6_ID,
  name: "天衍圣地",
  methods: [
    { id: TIANYAN_METHOD_ID.Canon, slot: 1, name: "《河洛衍天总经》", isPrimary: true, panel: panel("maxMp", "add", 2) },
    { id: TIANYAN_METHOD_ID.Wood, slot: 2, name: "《三碧生化篇》", isPrimary: false, panel: panel("healPower", "add", 0.5) },
    { id: TIANYAN_METHOD_ID.Fire, slot: 3, name: "《九紫离明录》", isPrimary: false, panel: panel("magicAtk", "add", 0.5) },
    { id: TIANYAN_METHOD_ID.Earth, slot: 4, name: "《五中承天经》", isPrimary: false, panel: panel("magicDef", "add", 0.4) },
    { id: TIANYAN_METHOD_ID.Metal, slot: 5, name: "《七赤断法章》", isPrimary: false, panel: panel("sealHit", "add", 0.4) },
    { id: TIANYAN_METHOD_ID.Water, slot: 6, name: "《一白玄水诀》", isPrimary: false, panel: panel("speed", "add", 0.15) },
  ],
  skills: [...baseSkills, ...reactionPassives],
  statuses,
  paths: [
    { id: TIANYAN_PATH_ID.Hetu, name: "河图演生", foundationPassives: hetuFoundation, grantSkills: [hetuUltimate], resources: [{ id: TIANYAN_RESOURCE_ID, name: "衍数", current: 0, max: 3 }], nodes: hetuNodes() },
    { id: TIANYAN_PATH_ID.Luoshu, name: "洛书制化", foundationPassives: luoshuFoundation, grantSkills: [luoshuUltimate], resources: [{ id: TIANYAN_RESOURCE_ID, name: "衍数", current: 0, max: 3 }], nodes: luoshuNodes() },
  ],
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
