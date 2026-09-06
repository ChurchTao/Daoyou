import {
  DamageOrigin,
  EffectType,
  HookAim,
  HookName,
  SkillTag,
  StatusCategory,
  StatusFlag,
  TargetMode,
  TargetSide,
  type SkillDef,
  type SkillEffect,
  type SkillHook,
  type StatusDef,
} from "../core/index.ts"
import type { CombatV6PanelContribution } from "../projection/types.ts"
import type { MeridianNodeDefV6, SectDefinitionV6, SectSkillDefV6 } from "./types.ts"

export const WUXIANG_V6_ID = "wuxiang" as const
export const WUXIANG_PATH_ID = {
  Compassion: "wuxiang.path.compassion",
  Wrath: "wuxiang.path.wrath",
} as const
export const WUXIANG_RESOURCE_ID = "wuxiang.resource.mind"
export const WUXIANG_METHOD_ID = {
  Canon: "wuxiang.method.canon",
  Compassion: "wuxiang.method.compassion",
  Guardian: "wuxiang.method.guardian",
  Wrath: "wuxiang.method.wrath",
  Purity: "wuxiang.method.purity",
  Crossing: "wuxiang.method.crossing",
} as const
export const WUXIANG_SKILL_ID = {
  SingleHeal: "wuxiang.skill.single_heal",
  GroupHeal: "wuxiang.skill.group_heal",
  Barrier: "wuxiang.skill.barrier",
  Spell: "wuxiang.skill.spell",
  Purify: "wuxiang.skill.purify",
  Revive: "wuxiang.skill.revive",
  Formless: "wuxiang.skill.formless",
  GreatBarrier: "wuxiang.skill.great_barrier",
  WrathStrike: "wuxiang.skill.wrath_strike",
  FinalSilence: "wuxiang.skill.final_silence",
} as const
export const WUXIANG_STATUS_ID = {
  Formless: "wuxiang.status.formless",
  GreatBarrierGuard: "wuxiang.status.great_barrier_guard",
  MagicGuard: "wuxiang.status.magic_guard",
  ReviveGuard: "wuxiang.status.revive_guard",
  FormlessGuard: "wuxiang.status.formless_guard",
  Rest: "wuxiang.status.rest",
} as const
export const WUXIANG_BARRIER_ID = {
  Guardian: "wuxiang.barrier.guardian",
  Great: "wuxiang.barrier.great",
  Formless: "wuxiang.barrier.formless",
} as const

const WUXIANG_DAMAGE_SKILL_IDS: string[] = [
  WUXIANG_SKILL_ID.Spell,
  WUXIANG_SKILL_ID.WrathStrike,
  WUXIANG_SKILL_ID.FinalSilence,
]
const WUXIANG_HEAL_SKILL_IDS: string[] = [
  WUXIANG_SKILL_ID.SingleHeal,
  WUXIANG_SKILL_ID.GroupHeal,
  WUXIANG_SKILL_ID.Formless,
]

const panel = (
  attr: CombatV6PanelContribution["attr"],
  mode: CombatV6PanelContribution["mode"],
  value: number,
): CombatV6PanelContribution => ({ attr, mode, value })

const active = (sourceMethodId: string, definition: SkillDef, unlockMethodLevel = 1): SectSkillDefV6 => ({
  sourceMethodId,
  unlockMethodLevel,
  kind: "active",
  definition,
})

const passive = (
  id: string,
  name: string,
  hooks: SkillHook[],
  sourceMethodId: string = WUXIANG_METHOD_ID.Canon,
): SectSkillDefV6 => ({
  sourceMethodId,
  unlockMethodLevel: 0,
  kind: "passive",
  definition: { id, name, tags: [SkillTag.Passive], targeting: { side: TargetSide.Self }, effects: [], hooks },
})

const modifierPassive = (
  id: string,
  name: string,
  on: SkillHook["on"],
  effect: SkillHook["effects"][number],
  options: { skillIds?: string[]; requireStatus?: boolean; targetBelow?: number; targetAbove?: number; sourceBelow?: number } = {},
): SectSkillDefV6 => passive(id, name, [{
  on,
  sourceIsSelf: true,
  when: {
    skillIds: options.skillIds,
    requireStatusIds: options.requireStatus ? [WUXIANG_STATUS_ID.Formless] : undefined,
    targetHpRatioBelow: options.targetBelow,
    targetHpRatioAbove: options.targetAbove,
    sourceHpRatioBelow: options.sourceBelow,
    damageOrigins: on === HookName.OnHitCalc || on === HookName.OnDefenseIgnoreCalc || on === HookName.OnCritRoll
      ? [DamageOrigin.ActionDirect]
      : undefined,
  },
  effects: [effect],
}])

const damagePassive = (id: string, name: string, factor: number, options: Parameters<typeof modifierPassive>[4] = {}) =>
  modifierPassive(id, name, HookName.OnHitCalc, { type: EffectType.ModifyStrike, factor }, {
    ...options,
    skillIds: options.skillIds ?? WUXIANG_DAMAGE_SKILL_IDS,
  })

const defenseIgnorePassive = (id: string, name: string, add: number, options: Parameters<typeof modifierPassive>[4] = {}) =>
  modifierPassive(id, name, HookName.OnDefenseIgnoreCalc, { type: EffectType.ModifyDefenseIgnore, add }, {
    ...options,
    skillIds: options.skillIds ?? WUXIANG_DAMAGE_SKILL_IDS,
  })

const statuses: StatusDef[] = [
  { id: WUXIANG_STATUS_ID.Formless, name: "无相", kind: "wuxiang.formless", category: StatusCategory.Buff, dispellable: false },
  { id: WUXIANG_STATUS_ID.GreatBarrierGuard, name: "摩诃护持", kind: "wuxiang.great_guard", category: StatusCategory.Buff, damageTakenPhysical: 0.9, damageTakenSpell: 0.9 },
  { id: WUXIANG_STATUS_ID.MagicGuard, name: "金身护法", kind: "wuxiang.magic_guard", category: StatusCategory.Buff, attrMods: { magicDef: "floor(target.magicDef * 0.1)" } },
  { id: WUXIANG_STATUS_ID.ReviveGuard, name: "还阳护体", kind: "wuxiang.revive_guard", category: StatusCategory.Buff, damageTakenPhysical: 0.8, damageTakenSpell: 0.8 },
  { id: WUXIANG_STATUS_ID.FormlessGuard, name: "无量法界", kind: "wuxiang.formless_guard", category: StatusCategory.Buff, damageTakenPhysical: 0.9, damageTakenSpell: 0.9 },
  { id: WUXIANG_STATUS_ID.Rest, name: "寂灭反噬", kind: "wuxiang.rest", category: StatusCategory.Control, blocksAction: true },
]

const mindGain = (amount: number): SkillEffect => ({
  type: EffectType.ModifyResource,
  resourceId: WUXIANG_RESOURCE_ID,
  amount,
  when: { requireAbsentStatusIds: [WUXIANG_STATUS_ID.Formless] },
})

const baseSkills: SectSkillDefV6[] = [
  active(WUXIANG_METHOD_ID.Canon, {
    id: WUXIANG_SKILL_ID.SingleHeal,
    name: "拈花济世",
    school: WUXIANG_V6_ID,
    costMp: "25 + floor(skillLevel * 0.35)",
    tags: [SkillTag.Spell, SkillTag.Support],
    targeting: { side: TargetSide.Ally, count: 1 },
    effects: [{ type: EffectType.Heal, power: "60 + floor(skillLevel * 1.4)" }],
    successEffects: [mindGain(1)],
  }),
  active(WUXIANG_METHOD_ID.Compassion, {
    id: WUXIANG_SKILL_ID.GroupHeal,
    name: "慈航普度",
    school: WUXIANG_V6_ID,
    costMp: "35 + floor(skillLevel * 0.5)",
    tags: [SkillTag.Spell, SkillTag.Support],
    targeting: { side: TargetSide.Ally, mode: TargetMode.Fill, count: 5 },
    effects: [{ type: EffectType.Heal, power: "30 + floor(skillLevel * 0.9)" }],
    successEffects: [mindGain(2)],
  }),
  active(WUXIANG_METHOD_ID.Guardian, {
    id: WUXIANG_SKILL_ID.Barrier,
    name: "金刚结界",
    school: WUXIANG_V6_ID,
    costMp: "30 + floor(skillLevel * 0.4)",
    tags: [SkillTag.Spell, SkillTag.Support],
    targeting: { side: TargetSide.Ally, mode: TargetMode.Fill, count: 4 },
    effects: [{ type: EffectType.ApplyBarrier, id: WUXIANG_BARRIER_ID.Guardian, kind: "wuxiang.guardian", name: "金刚结界", power: "40 + floor(skillLevel * 1.1) + floor(target.maxHp * 0.04)", duration: 3 }],
    successEffects: [mindGain(1)],
  }),
  active(WUXIANG_METHOD_ID.Wrath, {
    id: WUXIANG_SKILL_ID.Spell,
    name: "明王法印",
    school: WUXIANG_V6_ID,
    costMp: "25 + floor(skillLevel * 0.45)",
    tags: [SkillTag.Spell],
    formula: "spell",
    splash: { perTarget: 0.08, floor: 0.6 },
    targeting: { side: TargetSide.Enemy, mode: TargetMode.Fill, count: 5 },
    effects: [{ type: EffectType.SpellHit, coeff: 1, power: "30 + floor(skillLevel * 1.25)" }],
    successEffects: [mindGain(2)],
  }),
  active(WUXIANG_METHOD_ID.Purity, {
    id: WUXIANG_SKILL_ID.Purify,
    name: "六根清净",
    school: WUXIANG_V6_ID,
    costMp: "30 + floor(skillLevel * 0.4)",
    tags: [SkillTag.Spell, SkillTag.Support],
    targeting: { side: TargetSide.Ally, count: 1 },
    effects: [
      { type: EffectType.RemoveWound, power: "floor(skillLevel * 1.5) + floor(target.maxHp * 0.05)" },
      { type: EffectType.Dispel, categories: [StatusCategory.Control, StatusCategory.Debuff, StatusCategory.Dot], maxCount: 1, excludeStatusFlags: [StatusFlag.BlocksRevive] },
    ],
    successEffects: [mindGain(1)],
  }),
  active(WUXIANG_METHOD_ID.Crossing, {
    id: WUXIANG_SKILL_ID.Revive,
    name: "涅槃还生",
    school: WUXIANG_V6_ID,
    costMp: "80 + floor(skillLevel * 0.8)",
    tags: [SkillTag.Spell, SkillTag.Support],
    targeting: { side: TargetSide.Ally, count: 1, includeDowned: true },
    effects: [
      { type: EffectType.Revive, hpRatio: 0.2, when: { requireAbsentStatusIds: [WUXIANG_STATUS_ID.Formless] } },
      { type: EffectType.Revive, hpRatio: 0.2, when: { requireStatusIds: [WUXIANG_STATUS_ID.Formless] } },
    ],
    successEffects: [mindGain(2)],
  }),
  active(WUXIANG_METHOD_ID.Canon, {
    id: WUXIANG_SKILL_ID.Formless,
    name: "无相诀",
    school: WUXIANG_V6_ID,
    costMp: "40 + floor(skillLevel * 0.3)",
    resourceRequirements: [{ resourceId: WUXIANG_RESOURCE_ID, min: 6 }],
    resourceCosts: [{ resourceId: WUXIANG_RESOURCE_ID, amount: 6 }],
    tags: [SkillTag.Spell, SkillTag.Support],
    targeting: { side: TargetSide.Self },
    effects: [{ type: EffectType.ApplyStatus, statusId: WUXIANG_STATUS_ID.Formless, duration: 2, self: true }],
  }),
]

const greatBarrier = active(WUXIANG_METHOD_ID.Guardian, {
  id: WUXIANG_SKILL_ID.GreatBarrier,
  name: "摩诃护持",
  school: WUXIANG_V6_ID,
  costMp: "50 + floor(skillLevel * 0.5)",
  tags: [SkillTag.Spell, SkillTag.Support],
  targeting: { side: TargetSide.Ally, count: 1 },
  effects: [
    { type: EffectType.ApplyBarrier, id: WUXIANG_BARRIER_ID.Great, kind: "wuxiang.great", name: "摩诃护持", power: "floor(target.maxHp * 0.12) + skillLevel", duration: 2 },
    { type: EffectType.ApplyStatus, statusId: WUXIANG_STATUS_ID.GreatBarrierGuard, duration: 2 },
  ],
  successEffects: [mindGain(1)],
}, 60)

const wrathStrike = active(WUXIANG_METHOD_ID.Wrath, {
  id: WUXIANG_SKILL_ID.WrathStrike,
  name: "忿怒明王",
  school: WUXIANG_V6_ID,
  costMp: "40 + floor(skillLevel * 0.5)",
  costHp: "maxHp * 0.05",
  requireHpRatio: 0.15,
  tags: [SkillTag.Spell],
  formula: "spell",
  targeting: { side: TargetSide.Enemy, count: 1 },
  effects: [{ type: EffectType.SpellHit, coeff: 1.35, power: "50 + floor(skillLevel * 1.3)" }],
  successEffects: [mindGain(2)],
}, 60)

const finalSilence = active(WUXIANG_METHOD_ID.Wrath, {
  id: WUXIANG_SKILL_ID.FinalSilence,
  name: "无量寂灭",
  school: WUXIANG_V6_ID,
  costMp: "80 + floor(skillLevel * 0.8)",
  costHp: "maxHp * 0.1",
  requireHpRatio: 0.2,
  tags: [SkillTag.Spell],
  formula: "spell",
  targeting: { side: TargetSide.Enemy, count: 1 },
  effects: [
    { type: EffectType.SpellHit, coeff: 1.8, power: "80 + floor(skillLevel * 1.6)", defenseIgnore: 0.15 },
    { type: EffectType.SkipNextAction },
    { type: EffectType.ApplyStatus, statusId: WUXIANG_STATUS_ID.Rest, duration: 1, self: true },
  ],
  successEffects: [mindGain(3)],
}, 100)

function compassionNodes(): MeridianNodeDefV6[] {
  const pathId = WUXIANG_PATH_ID.Compassion
  return [
    { id: "wuxiang.node.compassion.1.1", name: "拈花妙谛", pathId, layer: 1, slot: 1, description: "拈花济世治疗提高10%。", passives: [modifierPassive("wuxiang.passive.compassion.1.1", "拈花妙谛", HookName.OnHealCalc, { type: EffectType.ModifyHeal, factor: 1.1 }, { skillIds: [WUXIANG_SKILL_ID.SingleHeal] })] },
    { id: "wuxiang.node.compassion.1.2", name: "普济群生", pathId, layer: 1, slot: 2, description: "慈航普度治疗提高10%。", passives: [modifierPassive("wuxiang.passive.compassion.1.2", "普济群生", HookName.OnHealCalc, { type: EffectType.ModifyHeal, factor: 1.1 }, { skillIds: [WUXIANG_SKILL_ID.GroupHeal] })] },
    { id: "wuxiang.node.compassion.1.3", name: "灵台澄澈", pathId, layer: 1, slot: 3, description: "治疗能力增加30。", panel: [panel("healPower", "add", 30)] },
    { id: "wuxiang.node.compassion.2.1", name: "金刚法界", pathId, layer: 2, slot: 1, description: "金刚结界盾量提高15%。", patches: [{ skillId: WUXIANG_SKILL_ID.Barrier, operation: "multiplyBarrierPower", value: 1.15 }] },
    { id: "wuxiang.node.compassion.2.2", name: "洗髓涤伤", pathId, layer: 2, slot: 2, description: "六根清净疗伤提高25%。", patches: [{ skillId: WUXIANG_SKILL_ID.Purify, operation: "multiplyRemoveWoundPower", value: 1.25 }] },
    { id: "wuxiang.node.compassion.2.3", name: "戒定生慧", pathId, layer: 2, slot: 3, description: "抗封增加30。", panel: [panel("sealResist", "add", 30)] },
    { id: "wuxiang.node.compassion.3.1", name: "摩诃护持", pathId, layer: 3, slot: 1, description: "授予单体强盾神通。", grantSkills: [greatBarrier] },
    { id: "wuxiang.node.compassion.3.2", name: "涅槃妙谛", pathId, layer: 3, slot: 2, description: "常态涅槃还生恢复提高至25%。", patches: [{ skillId: WUXIANG_SKILL_ID.Revive, operation: "setReviveRatio", value: 0.25, whenStatusId: WUXIANG_STATUS_ID.Formless, statusPresent: false }] },
    { id: "wuxiang.node.compassion.3.3", name: "破妄拔魂", pathId, layer: 3, slot: 3, description: "六根清净可以净化锢魂。", patches: [{ skillId: WUXIANG_SKILL_ID.Purify, operation: "setDispelExcludeStatusFlags", value: [] }] },
    { id: "wuxiang.node.compassion.4.1", name: "慈航无量", pathId, layer: 4, slot: 1, description: "慈航普度额外作用一人。", patches: [{ skillId: WUXIANG_SKILL_ID.GroupHeal, operation: "setTargetCount", value: 6 }] },
    { id: "wuxiang.node.compassion.4.2", name: "莲界广被", pathId, layer: 4, slot: 2, description: "金刚结界额外作用一人。", patches: [{ skillId: WUXIANG_SKILL_ID.Barrier, operation: "setTargetCount", value: 5 }] },
    { id: "wuxiang.node.compassion.4.3", name: "六尘俱净", pathId, layer: 4, slot: 3, description: "六根清净最多净化两个普通负面。", patches: [{ skillId: WUXIANG_SKILL_ID.Purify, operation: "setDispelMaxCount", value: 2 }] },
    { id: "wuxiang.node.compassion.5.1", name: "雪中生莲", pathId, layer: 5, slot: 1, description: "对低于半血目标治疗提高15%。", passives: [modifierPassive("wuxiang.passive.compassion.5.1", "雪中生莲", HookName.OnHealCalc, { type: EffectType.ModifyHeal, factor: 1.15 }, { skillIds: WUXIANG_HEAL_SKILL_IDS, targetBelow: 0.5 })] },
    { id: "wuxiang.node.compassion.5.2", name: "金身护法", pathId, layer: 5, slot: 2, description: "金刚结界同时提高目标法防。", patches: [{ skillId: WUXIANG_SKILL_ID.Barrier, operation: "appendEffect", effect: { type: EffectType.ApplyStatus, statusId: WUXIANG_STATUS_ID.MagicGuard, duration: 3 } }] },
    { id: "wuxiang.node.compassion.5.3", name: "还阳护体", pathId, layer: 5, slot: 3, description: "复活目标获得一回合物法减伤。", patches: [{ skillId: WUXIANG_SKILL_ID.Revive, operation: "appendSuccessEffect", effect: { type: EffectType.ApplyStatus, statusId: WUXIANG_STATUS_ID.ReviveGuard, duration: 1 } }] },
    { id: "wuxiang.node.compassion.6.1", name: "大医精诚", pathId, layer: 6, slot: 1, description: "宗门直接治疗提高10%。", passives: [modifierPassive("wuxiang.passive.compassion.6.1", "大医精诚", HookName.OnHealCalc, { type: EffectType.ModifyHeal, factor: 1.1 }, { skillIds: WUXIANG_HEAL_SKILL_IDS })] },
    { id: "wuxiang.node.compassion.6.2", name: "宝相庄严", pathId, layer: 6, slot: 2, description: "宗门护盾提高10%并延长一回合。", passives: [modifierPassive("wuxiang.passive.compassion.6.2", "宝相庄严", HookName.OnBarrierCalc, { type: EffectType.ModifyBarrier, factor: 1.1 }, { skillIds: [WUXIANG_SKILL_ID.Barrier, WUXIANG_SKILL_ID.GreatBarrier, WUXIANG_SKILL_ID.Formless] })], patches: [{ skillId: WUXIANG_SKILL_ID.Barrier, operation: "setBarrierDuration", barrierId: WUXIANG_BARRIER_ID.Guardian, value: 4 }, { skillId: WUXIANG_SKILL_ID.GreatBarrier, operation: "setBarrierDuration", barrierId: WUXIANG_BARRIER_ID.Great, value: 3 }] },
    { id: "wuxiang.node.compassion.6.3", name: "生死一如", pathId, layer: 6, slot: 3, description: "宗门疗伤提高40%。", passives: [modifierPassive("wuxiang.passive.compassion.6.3", "生死一如", HookName.OnWoundCalc, { type: EffectType.ModifyWound, factor: 1.4 }, { skillIds: [WUXIANG_SKILL_ID.Purify] })] },
    { id: "wuxiang.node.compassion.7.1", name: "万佛朝宗", pathId, layer: 7, slot: 1, description: "入无相时群体恢复。", patches: [{ skillId: WUXIANG_SKILL_ID.Formless, operation: "appendEffect", effect: { type: EffectType.Heal, power: "floor(target.maxHp * 0.08)", targeting: { side: TargetSide.Ally, mode: TargetMode.All } } }] },
    { id: "wuxiang.node.compassion.7.2", name: "无量法界", pathId, layer: 7, slot: 2, description: "入无相时群体获得护盾与减伤。", patches: [{ skillId: WUXIANG_SKILL_ID.Formless, operation: "appendEffect", effect: { type: EffectType.ApplyBarrier, id: WUXIANG_BARRIER_ID.Formless, kind: "wuxiang.formless", name: "无量法界", power: "floor(target.maxHp * 0.08)", duration: 2, targeting: { side: TargetSide.Ally, mode: TargetMode.All } } }, { skillId: WUXIANG_SKILL_ID.Formless, operation: "appendEffect", effect: { type: EffectType.ApplyStatus, statusId: WUXIANG_STATUS_ID.FormlessGuard, duration: 2, targeting: { side: TargetSide.Ally, mode: TargetMode.All } } }] },
    { id: "wuxiang.node.compassion.7.3", name: "彼岸同登", pathId, layer: 7, slot: 3, description: "入无相时复活全部未被锢魂的倒地人物。", patches: [{ skillId: WUXIANG_SKILL_ID.Formless, operation: "appendEffect", effect: { type: EffectType.Revive, hpRatio: 0.15, targeting: { side: TargetSide.Ally, mode: TargetMode.All, includeDowned: true } } }] },
  ]
}

function wrathNodes(): MeridianNodeDefV6[] {
  const pathId = WUXIANG_PATH_ID.Wrath
  return [
    { id: "wuxiang.node.wrath.1.1", name: "烈印初明", pathId, layer: 1, slot: 1, description: "明王法印伤害提高8%。", passives: [damagePassive("wuxiang.passive.wrath.1.1", "烈印初明", 1.08, { skillIds: [WUXIANG_SKILL_ID.Spell] })] },
    { id: "wuxiang.node.wrath.1.2", name: "法相增辉", pathId, layer: 1, slot: 2, description: "明王法印额外作用一人。", patches: [{ skillId: WUXIANG_SKILL_ID.Spell, operation: "setTargetCount", value: 6 }] },
    { id: "wuxiang.node.wrath.1.3", name: "明王灌顶", pathId, layer: 1, slot: 3, description: "法攻增加30。", panel: [panel("magicAtk", "add", 30)] },
    { id: "wuxiang.node.wrath.2.1", name: "盛极当诛", pathId, layer: 2, slot: 1, description: "攻击高于七成气血目标时法伤提高8%。", passives: [damagePassive("wuxiang.passive.wrath.2.1", "盛极当诛", 1.08, { targetAbove: 0.7 })] },
    { id: "wuxiang.node.wrath.2.2", name: "怒目生威", pathId, layer: 2, slot: 2, description: "法术暴击率增加五个百分点。", passives: [modifierPassive("wuxiang.passive.wrath.2.2", "怒目生威", HookName.OnCritRoll, { type: EffectType.ModifyChance, add: 0.05 }, { skillIds: WUXIANG_DAMAGE_SKILL_IDS })] },
    { id: "wuxiang.node.wrath.2.3", name: "破妄见真", pathId, layer: 2, slot: 3, description: "宗门主动法术忽略5%法防。", passives: [defenseIgnorePassive("wuxiang.passive.wrath.2.3", "破妄见真", 0.05)] },
    { id: "wuxiang.node.wrath.3.1", name: "忿怒明王", pathId, layer: 3, slot: 1, description: "授予单体耗血法术。", grantSkills: [wrathStrike] },
    { id: "wuxiang.node.wrath.3.2", name: "法印深刻", pathId, layer: 3, slot: 2, description: "明王法印法术项增加。", patches: [{ skillId: WUXIANG_SKILL_ID.Spell, operation: "addSpellPower", value: "floor(skillLevel * 0.2)" }] },
    { id: "wuxiang.node.wrath.3.3", name: "念火相生", pathId, layer: 3, slot: 3, description: "明王法印额外获得一点念。", patches: [{ skillId: WUXIANG_SKILL_ID.Spell, operation: "appendSuccessEffect", effect: mindGain(1) }] },
    { id: "wuxiang.node.wrath.4.1", name: "火海无涯", pathId, layer: 4, slot: 1, description: "明王法印分灵衰减降低。", patches: [{ skillId: WUXIANG_SKILL_ID.Spell, operation: "setSplash", perTarget: 0.06, floor: 0.7 }] },
    { id: "wuxiang.node.wrath.4.2", name: "明王加身", pathId, layer: 4, slot: 2, description: "忿怒明王系数提高至1.5。", patches: [{ skillId: WUXIANG_SKILL_ID.WrathStrike, operation: "multiplySpellCoefficients", value: 1.5 / 1.35 }] },
    { id: "wuxiang.node.wrath.4.3", name: "法眼圆睁", pathId, layer: 4, slot: 3, description: "明王法印法暴增加五个百分点。", passives: [modifierPassive("wuxiang.passive.wrath.4.3", "法眼圆睁", HookName.OnCritRoll, { type: EffectType.ModifyChance, add: 0.05 }, { skillIds: [WUXIANG_SKILL_ID.Spell] })] },
    { id: "wuxiang.node.wrath.5.1", name: "饮焰归身", pathId, layer: 5, slot: 1, description: "主动直接法术伤害吸血10%。", passives: [passive("wuxiang.passive.wrath.5.1", "饮焰归身", [{ on: HookName.AfterHit, sourceIsSelf: true, requireKind: "spell", aim: HookAim.Self, when: { skillIds: WUXIANG_DAMAGE_SKILL_IDS, damageOrigins: [DamageOrigin.ActionDirect], sourceStanding: true }, effects: [{ type: EffectType.RestoreHp, power: "floor(hpDamage * 0.1)", maxGainPerAction: "floor(maxHp * 0.15)" }] }], WUXIANG_METHOD_ID.Wrath)] },
    { id: "wuxiang.node.wrath.5.2", name: "血海证道", pathId, layer: 5, slot: 2, description: "低于半血时增伤并增加承伤。", passives: [damagePassive("wuxiang.passive.wrath.5.2.damage", "血海证道·攻", 1.12, { sourceBelow: 0.5 }), passive("wuxiang.passive.wrath.5.2.taken", "血海证道·险", [{ on: HookName.OnHitCalc, targetIsSelf: true, when: { sourceHpRatioBelow: 0.5 }, effects: [{ type: EffectType.ModifyStrike, factor: 1.05 }] }], WUXIANG_METHOD_ID.Wrath)] },
    { id: "wuxiang.node.wrath.5.3", name: "无相久住", pathId, layer: 5, slot: 3, description: "无相持续提高至三回合。", patches: [{ skillId: WUXIANG_SKILL_ID.Formless, operation: "setStatusDuration", statusId: WUXIANG_STATUS_ID.Formless, value: 3 }] },
    { id: "wuxiang.node.wrath.6.1", name: "法界无壁", pathId, layer: 6, slot: 1, description: "宗门法术额外忽略10%法防。", passives: [defenseIgnorePassive("wuxiang.passive.wrath.6.1", "法界无壁", 0.1)] },
    { id: "wuxiang.node.wrath.6.2", name: "万印齐鸣", pathId, layer: 6, slot: 2, description: "明王法印伤害提高12%。", passives: [damagePassive("wuxiang.passive.wrath.6.2", "万印齐鸣", 1.12, { skillIds: [WUXIANG_SKILL_ID.Spell] })] },
    { id: "wuxiang.node.wrath.6.3", name: "血作灯油", pathId, layer: 6, slot: 3, description: "明王法印耗血换取18%伤害。", patches: [{ skillId: WUXIANG_SKILL_ID.Spell, operation: "setCostHp", value: "maxHp * 0.05" }, { skillId: WUXIANG_SKILL_ID.Spell, operation: "setRequireHpRatio", value: 0.15 }], passives: [damagePassive("wuxiang.passive.wrath.6.3", "血作灯油", 1.18, { skillIds: [WUXIANG_SKILL_ID.Spell] })] },
    { id: "wuxiang.node.wrath.7.1", name: "无量寂灭", pathId, layer: 7, slot: 1, description: "授予单体终式。", grantSkills: [finalSilence] },
    { id: "wuxiang.node.wrath.7.2", name: "千印归一", pathId, layer: 7, slot: 2, description: "法印群攻后追击首目标。", patches: [{ skillId: WUXIANG_SKILL_ID.Spell, operation: "appendEffect", effect: { type: EffectType.SpellHit, coeff: 0.75, power: "30 + floor(skillLevel * 1.25)", when: { targetSlot: "primary" } } }] },
    { id: "wuxiang.node.wrath.7.3", name: "一念无间", pathId, layer: 7, slot: 3, description: "无相期间额外提高法伤与法暴。", passives: [damagePassive("wuxiang.passive.wrath.7.3.damage", "一念无间·威", 1.1, { requireStatus: true }), modifierPassive("wuxiang.passive.wrath.7.3.crit", "一念无间·怒", HookName.OnCritRoll, { type: EffectType.ModifyChance, add: 0.1 }, { skillIds: WUXIANG_DAMAGE_SKILL_IDS, requireStatus: true })] },
  ]
}

const compassionFoundation = [
  modifierPassive("wuxiang.passive.compassion.foundation.heal", "慈航渡厄·济世", HookName.OnHealCalc, { type: EffectType.ModifyHeal, factor: 1.05 }, { skillIds: WUXIANG_HEAL_SKILL_IDS }),
  modifierPassive("wuxiang.passive.compassion.foundation.barrier", "慈航渡厄·护生", HookName.OnBarrierCalc, { type: EffectType.ModifyBarrier, factor: 1.05 }, { skillIds: [WUXIANG_SKILL_ID.Barrier, WUXIANG_SKILL_ID.GreatBarrier, WUXIANG_SKILL_ID.Formless] }),
  modifierPassive("wuxiang.passive.compassion.formless.heal", "慈航无相·济世", HookName.OnHealCalc, { type: EffectType.ModifyHeal, factor: 1.2 }, { skillIds: WUXIANG_HEAL_SKILL_IDS, requireStatus: true }),
  modifierPassive("wuxiang.passive.compassion.formless.barrier", "慈航无相·护生", HookName.OnBarrierCalc, { type: EffectType.ModifyBarrier, factor: 1.2 }, { skillIds: [WUXIANG_SKILL_ID.Barrier, WUXIANG_SKILL_ID.GreatBarrier, WUXIANG_SKILL_ID.Formless], requireStatus: true }),
  modifierPassive("wuxiang.passive.compassion.formless.wound", "慈航无相·疗伤", HookName.OnWoundCalc, { type: EffectType.ModifyWound, factor: 1.2 }, { skillIds: [WUXIANG_SKILL_ID.Purify], requireStatus: true }),
]

const wrathFoundation = [
  damagePassive("wuxiang.passive.wrath.foundation", "明王镇狱", 1.05),
  damagePassive("wuxiang.passive.wrath.formless.damage", "明王无相·威", 1.2, { requireStatus: true }),
  defenseIgnorePassive("wuxiang.passive.wrath.formless.ignore", "明王无相·破法", 0.1, { requireStatus: true }),
]

export const WUXIANG_V6_DEFINITION: SectDefinitionV6 = {
  id: WUXIANG_V6_ID,
  name: "无相禅宗",
  methods: [
    { id: WUXIANG_METHOD_ID.Canon, slot: 1, name: "《无相菩提总经》", isPrimary: true, panel: panel("maxHp", "add", 2) },
    { id: WUXIANG_METHOD_ID.Compassion, slot: 2, name: "《慈航渡厄经》", isPrimary: false, panel: panel("healPower", "add", 0.5) },
    { id: WUXIANG_METHOD_ID.Guardian, slot: 3, name: "《金刚护生篇》", isPrimary: false, panel: panel("physicalDef", "add", 0.4) },
    { id: WUXIANG_METHOD_ID.Wrath, slot: 4, name: "《明王镇狱录》", isPrimary: false, panel: panel("magicAtk", "add", 0.5) },
    { id: WUXIANG_METHOD_ID.Purity, slot: 5, name: "《六根清净诀》", isPrimary: false, panel: panel("sealResist", "add", 0.25) },
    { id: WUXIANG_METHOD_ID.Crossing, slot: 6, name: "《一苇凌虚章》", isPrimary: false, panel: panel("speed", "add", 0.15) },
  ],
  skills: baseSkills,
  statuses,
  paths: [
    {
      id: WUXIANG_PATH_ID.Compassion,
      name: "慈航渡厄",
      foundationPassives: compassionFoundation,
      resources: [{ id: WUXIANG_RESOURCE_ID, name: "念", current: 0, max: 6 }],
      patches: [{ skillId: WUXIANG_SKILL_ID.Revive, operation: "setReviveRatio", value: 0.3, whenStatusId: WUXIANG_STATUS_ID.Formless, statusPresent: true }],
      nodes: compassionNodes(),
    },
    {
      id: WUXIANG_PATH_ID.Wrath,
      name: "明王镇狱",
      foundationPassives: wrathFoundation,
      resources: [{ id: WUXIANG_RESOURCE_ID, name: "念", current: 0, max: 6 }],
      nodes: wrathNodes(),
    },
  ],
}
