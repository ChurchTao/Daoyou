import {
  DamageOrigin,
  EffectType,
  HookAim,
  HookName,
  SkillTag,
  StatusCategory,
  StatusHit,
  StatusTick,
  TargetMode,
  TargetSide,
  TickKind,
  type SkillDef,
  type SkillHook,
  type StatusDef,
} from "../core/index.ts"
import type { CombatV6PanelContribution } from "../projection/types.ts"
import type { MeridianNodeDefV6, SectDefinitionV6, SectSkillDefV6 } from "./types.ts"

export const YOUDU_V6_ID = "youdu" as const
export const YOUDU_PATH_ID = {
  SoulJudge: "youdu.path.soul_judge",
  SixPaths: "youdu.path.six_paths",
} as const
export const YOUDU_METHOD_ID = {
  Canon: "youdu.method.canon",
  Judge: "youdu.method.judge",
  Wither: "youdu.method.wither",
  Shadow: "youdu.method.shadow",
  Asura: "youdu.method.asura",
  Insight: "youdu.method.insight",
} as const
export const YOUDU_SKILL_ID = {
  Edict: "youdu.skill.edict",
  Wither: "youdu.skill.wither",
  Pursuit: "youdu.skill.pursuit",
  SoulSeal: "youdu.skill.soul_seal",
  Insight: "youdu.skill.insight",
  Sever: "youdu.skill.sever",
  LifeJudge: "youdu.skill.life_judge",
  FinalJudgment: "youdu.skill.final_judgment",
  GhostRift: "youdu.skill.ghost_rift",
  SixPathsRuin: "youdu.skill.six_paths_ruin",
} as const
export const YOUDU_STATUS_ID = {
  Poison: "youdu.status.poison",
  StrongPoison: "youdu.status.strong_poison",
  Slow: "youdu.status.slow",
  SoulSeal: "youdu.status.soul_seal",
  Insight: "youdu.status.insight",
  Rest: "youdu.status.rest",
  NextPhysical: "youdu.status.next_physical",
} as const
const YOUDU_FIXED_SKILL_IDS = [
  YOUDU_SKILL_ID.Edict,
  YOUDU_SKILL_ID.Wither,
  YOUDU_SKILL_ID.Pursuit,
  YOUDU_SKILL_ID.LifeJudge,
  YOUDU_SKILL_ID.FinalJudgment,
] as const

const panel = (attr: CombatV6PanelContribution["attr"], mode: CombatV6PanelContribution["mode"], value: number): CombatV6PanelContribution => ({ attr, mode, value })
const active = (sourceMethodId: string, definition: SkillDef, unlockMethodLevel = 1): SectSkillDefV6 => ({ sourceMethodId, unlockMethodLevel, kind: "active", definition })
const passive = (id: string, name: string, hooks: SkillHook[], sourceMethodId: string = YOUDU_METHOD_ID.Canon): SectSkillDefV6 => ({
  sourceMethodId,
  unlockMethodLevel: 0,
  kind: "passive",
  definition: { id, name, tags: [SkillTag.Passive], targeting: { side: TargetSide.Self }, effects: [], hooks },
})
const damagePassive = (id: string, name: string, kind: "physical" | "fixed", factor: number, when: SkillHook["when"] = {}): SectSkillDefV6 => passive(id, name, [{
  on: HookName.OnHitCalc,
  sourceIsSelf: true,
  when: { ...when, requireKind: kind, damageOrigins: [DamageOrigin.ActionDirect] },
  effects: [{ type: EffectType.ModifyStrike, factor }],
}])
const defenseIgnorePassive = (id: string, name: string, add: number, when: SkillHook["when"] = {}): SectSkillDefV6 => passive(id, name, [{
  on: HookName.OnDefenseIgnoreCalc,
  sourceIsSelf: true,
  when: { ...when, requireKind: "physical", damageOrigins: [DamageOrigin.ActionDirect] },
  effects: [{ type: EffectType.ModifyDefenseIgnore, add }],
}], YOUDU_METHOD_ID.Asura)

const statuses: StatusDef[] = [
  { id: YOUDU_STATUS_ID.Poison, name: "幽毒", kind: "youdu.poison", category: StatusCategory.Dot, ticks: StatusTick.RoundEnd, onTick: { type: TickKind.Dot, ratioOfMaxHp: 0.04 } },
  { id: YOUDU_STATUS_ID.StrongPoison, name: "蚀命幽毒", kind: "youdu.poison", category: StatusCategory.Dot, ticks: StatusTick.RoundEnd, onTick: { type: TickKind.Dot, ratioOfMaxHp: 0.06 } },
  { id: YOUDU_STATUS_ID.Slow, name: "无常迟滞", kind: "youdu.slow", category: StatusCategory.Debuff, speedMod: "-floor(skillLevel * 0.2)" },
  { id: YOUDU_STATUS_ID.SoulSeal, name: "锢魂", kind: "youdu.soul_seal", category: StatusCategory.Control, blocksRevive: true, persistWhenDowned: true },
  { id: YOUDU_STATUS_ID.Insight, name: "幽冥鉴照", kind: "youdu.insight", category: StatusCategory.Buff, attrMods: { hit: "floor(skillLevel * 0.4)", sealResist: "floor(skillLevel * 0.2)" } },
  { id: YOUDU_STATUS_ID.Rest, name: "六道反噬", kind: "youdu.rest", category: StatusCategory.Control, blocksAction: true },
  { id: YOUDU_STATUS_ID.NextPhysical, name: "乘幽追命", kind: "youdu.next_physical", category: StatusCategory.Buff },
]

const baseSkills: SectSkillDefV6[] = [
  active(YOUDU_METHOD_ID.Judge, {
    id: YOUDU_SKILL_ID.Edict, name: "十殿敕命", school: YOUDU_V6_ID,
    costMp: "20 + floor(skillLevel * 0.3)", tags: [SkillTag.Spell], formula: "fixed",
    targeting: { side: TargetSide.Enemy, mode: TargetMode.Fill, count: "min(5, floor(skillLevel / 45) + 1)" },
    effects: [{ type: EffectType.FixedHit, power: "40 + floor(skillLevel * 1.35)" }],
  }),
  active(YOUDU_METHOD_ID.Wither, {
    id: YOUDU_SKILL_ID.Wither, name: "黄泉蚀生", school: YOUDU_V6_ID,
    tags: [SkillTag.Spell], formula: "fixed",
    targeting: { side: TargetSide.Enemy, count: 1 },
    effects: [
      { type: EffectType.FixedHit, power: "25 + floor(skillLevel * 0.75)" },
      { type: EffectType.ApplyStatus, statusId: YOUDU_STATUS_ID.Poison, duration: 3 },
      { type: EffectType.Heal, power: "target.maxHp * 0.03", targeting: { side: TargetSide.Ally, mode: TargetMode.All } },
    ],
  }),
  active(YOUDU_METHOD_ID.Shadow, {
    id: YOUDU_SKILL_ID.Pursuit, name: "无常追魄", school: YOUDU_V6_ID,
    tags: [SkillTag.Spell], formula: "fixed",
    targeting: { side: TargetSide.Enemy, count: 1 },
    effects: [
      { type: EffectType.FixedHit, power: "35 + floor(skillLevel * 1.05)" },
      { type: EffectType.Wound, power: "floor(skillLevel * 1.5)" },
      { type: EffectType.ApplyStatus, statusId: YOUDU_STATUS_ID.Slow, duration: 3 },
    ],
  }),
  active(YOUDU_METHOD_ID.Canon, {
    id: YOUDU_SKILL_ID.SoulSeal, name: "镇魂冥印", school: YOUDU_V6_ID,
    tags: [SkillTag.Spell, SkillTag.Seal], sealBase: 50,
    targeting: { side: TargetSide.Enemy, count: 1, includeDowned: true },
    effects: [{ type: EffectType.ApplyStatus, statusId: YOUDU_STATUS_ID.SoulSeal, duration: 2, hit: StatusHit.Seal }],
  }),
  active(YOUDU_METHOD_ID.Insight, {
    id: YOUDU_SKILL_ID.Insight, name: "幽冥鉴照", school: YOUDU_V6_ID,
    tags: [SkillTag.Spell, SkillTag.Support],
    targeting: { side: TargetSide.Ally, mode: TargetMode.Fill, count: "min(5, floor(skillLevel / 45) + 1)" },
    effects: [{ type: EffectType.ApplyStatus, statusId: YOUDU_STATUS_ID.Insight, duration: 5 }],
  }),
  active(YOUDU_METHOD_ID.Asura, {
    id: YOUDU_SKILL_ID.Sever, name: "六道断狱", school: YOUDU_V6_ID,
    tags: [SkillTag.Spell, SkillTag.Physical],
    targeting: { side: TargetSide.Enemy, count: 1 },
    effects: [{ type: EffectType.PhysicalHit, coeff: 1, power: "floor(skillLevel * 0.35)" }],
  }),
]

const lifeJudge = active(YOUDU_METHOD_ID.Judge, {
  id: YOUDU_SKILL_ID.LifeJudge, name: "生死裁", school: YOUDU_V6_ID,
  tags: [SkillTag.Spell], formula: "fixed",
  targeting: { side: TargetSide.Enemy, count: 1 },
  effects: [{ type: EffectType.FixedHit, power: "70 + floor(skillLevel * 1.5)" }, { type: EffectType.Wound, power: "skillLevel * 2" }],
})
const finalJudgment = active(YOUDU_METHOD_ID.Canon, {
  id: YOUDU_SKILL_ID.FinalJudgment, name: "十殿终审", school: YOUDU_V6_ID,
  tags: [SkillTag.Spell], formula: "fixed",
  targeting: { side: TargetSide.Enemy, mode: TargetMode.All },
  effects: [{ type: EffectType.FixedHit, power: "100 + floor(skillLevel * 1.6)" }, { type: EffectType.Wound, power: "skillLevel" }],
}, 100)
const ghostRift = active(YOUDU_METHOD_ID.Asura, {
  id: YOUDU_SKILL_ID.GhostRift, name: "万鬼裂界", school: YOUDU_V6_ID,
  tags: [SkillTag.Spell, SkillTag.Physical],
  targeting: { side: TargetSide.Enemy, mode: TargetMode.Fill, count: 4 },
  effects: [
    { type: EffectType.PhysicalHit, coeff: 0.65, power: "floor(skillLevel * 0.2)", cannotMiss: true },
    { type: EffectType.ApplyStatus, statusId: YOUDU_STATUS_ID.Poison, duration: 3 },
  ],
})
const sixPathsRuin = active(YOUDU_METHOD_ID.Asura, {
  id: YOUDU_SKILL_ID.SixPathsRuin, name: "六道俱灭", school: YOUDU_V6_ID,
  costHp: "maxHp * 0.1", tags: [SkillTag.Spell, SkillTag.Physical],
  targeting: { side: TargetSide.Enemy, count: 1 },
  effects: [
    { type: EffectType.PhysicalHit, coeff: 1.8, defenseIgnore: 0.15 },
    { type: EffectType.SkipNextAction },
    { type: EffectType.ApplyStatus, statusId: YOUDU_STATUS_ID.Rest, duration: 1, self: true },
  ],
}, 100)

function soulJudgeNodes(): MeridianNodeDefV6[] {
  const pathId = YOUDU_PATH_ID.SoulJudge
  return [
    { id: "youdu.node.soul.1.1", name: "敕威", pathId, layer: 1, slot: 1, description: "十殿敕命伤害提高8%。", patches: [{ skillId: YOUDU_SKILL_ID.Edict, operation: "multiplyFixedPower", value: 1.08 }] },
    { id: "youdu.node.soul.1.2", name: "蚀生", pathId, layer: 1, slot: 2, description: "黄泉蚀生直接伤害提高10%。", patches: [{ skillId: YOUDU_SKILL_ID.Wither, operation: "multiplyFixedPower", value: 1.1 }] },
    { id: "youdu.node.soul.1.3", name: "鬼行", pathId, layer: 1, slot: 3, description: "速度提高30。", panel: [panel("speed", "add", 30)] },
    { id: "youdu.node.soul.2.1", name: "裂魂", pathId, layer: 2, slot: 1, description: "无常追魄伤势提高50%。", patches: [{ skillId: YOUDU_SKILL_ID.Pursuit, operation: "multiplyWoundPower", value: 1.5 }] },
    { id: "youdu.node.soul.2.2", name: "追命", pathId, layer: 2, slot: 2, description: "无常追魄伤害提高10%。", patches: [{ skillId: YOUDU_SKILL_ID.Pursuit, operation: "multiplyFixedPower", value: 1.1 }] },
    { id: "youdu.node.soul.2.3", name: "济幽", pathId, layer: 2, slot: 3, description: "黄泉群疗提高至4%。", patches: [{ skillId: YOUDU_SKILL_ID.Wither, operation: "multiplyHealPower", value: 4 / 3 }] },
    { id: "youdu.node.soul.3.1", name: "生死簿", pathId, layer: 3, slot: 1, description: "授予生死裁。", grantSkills: [lifeJudge] },
    { id: "youdu.node.soul.3.2", name: "镇魄", pathId, layer: 3, slot: 2, description: "镇魂冥印底率提高10点。", patches: [{ skillId: YOUDU_SKILL_ID.SoulSeal, operation: "addSealBase", value: 10 }] },
    { id: "youdu.node.soul.3.3", name: "洞幽", pathId, layer: 3, slot: 3, description: "幽冥鉴照延长2回合。", patches: [{ skillId: YOUDU_SKILL_ID.Insight, operation: "setStatusDuration", statusId: YOUDU_STATUS_ID.Insight, value: 7 }] },
    { id: "youdu.node.soul.4.1", name: "群判", pathId, layer: 4, slot: 1, description: "十殿敕命额外作用1个目标。", patches: [{ skillId: YOUDU_SKILL_ID.Edict, operation: "setTargetCount", value: "min(6, floor(skillLevel / 45) + 2)" }] },
    { id: "youdu.node.soul.4.2", name: "毒绵", pathId, layer: 4, slot: 2, description: "幽毒延长1回合。", patches: [{ skillId: YOUDU_SKILL_ID.Wither, operation: "setStatusDuration", statusId: YOUDU_STATUS_ID.Poison, value: 4 }] },
    { id: "youdu.node.soul.4.3", name: "锁魂", pathId, layer: 4, slot: 3, description: "镇魂冥印延长1回合。", patches: [{ skillId: YOUDU_SKILL_ID.SoulSeal, operation: "setStatusDuration", statusId: YOUDU_STATUS_ID.SoulSeal, value: 3 }] },
    { id: "youdu.node.soul.5.1", name: "毒判", pathId, layer: 5, slot: 1, description: "对中毒目标固伤提高10%。", passives: [damagePassive("youdu.passive.soul.poisoned", "毒判", "fixed", 1.1, { skillIds: [...YOUDU_FIXED_SKILL_IDS], targetStatusKinds: ["youdu.poison"] })] },
    { id: "youdu.node.soul.5.2", name: "命薄", pathId, layer: 5, slot: 2, description: "对半血以下目标固伤提高12%。", passives: [damagePassive("youdu.passive.soul.low_hp", "命薄", "fixed", 1.12, { skillIds: [...YOUDU_FIXED_SKILL_IDS], targetHpRatioBelow: 0.5 })] },
    { id: "youdu.node.soul.5.3", name: "冥威", pathId, layer: 5, slot: 3, description: "镇魂冥印底率再提高5点。", patches: [{ skillId: YOUDU_SKILL_ID.SoulSeal, operation: "addSealBase", value: 5 }] },
    { id: "youdu.node.soul.6.1", name: "判官", pathId, layer: 6, slot: 1, description: "主动固定伤害提高10%。", passives: [damagePassive("youdu.passive.soul.fixed", "判官", "fixed", 1.1, { skillIds: [...YOUDU_FIXED_SKILL_IDS] })] },
    { id: "youdu.node.soul.6.2", name: "摧魂", pathId, layer: 6, slot: 2, description: "幽都伤势提高30%。", patches: [
      { skillId: YOUDU_SKILL_ID.Pursuit, operation: "multiplyWoundPower", value: 1.3 },
      { skillId: YOUDU_SKILL_ID.LifeJudge, operation: "multiplyWoundPower", value: 1.3 },
      { skillId: YOUDU_SKILL_ID.FinalJudgment, operation: "multiplyWoundPower", value: 1.3 },
    ] },
    { id: "youdu.node.soul.6.3", name: "济世", pathId, layer: 6, slot: 3, description: "黄泉群疗提高25%。", passives: [passive("youdu.passive.soul.heal", "济世", [{ on: HookName.OnHealCalc, sourceIsSelf: true, when: { skillIds: [YOUDU_SKILL_ID.Wither] }, effects: [{ type: EffectType.ModifyHeal, factor: 1.25 }] }], YOUDU_METHOD_ID.Wither)] },
    { id: "youdu.node.soul.7.1", name: "终审", pathId, layer: 7, slot: 1, description: "授予十殿终审。", grantSkills: [finalJudgment] },
    { id: "youdu.node.soul.7.2", name: "拘魂", pathId, layer: 7, slot: 2, description: "首次固伤击倒人物后施加锢魂。", passives: [passive("youdu.passive.soul.first_kill", "拘魂", [{ on: HookName.OnDeath, sourceIsSelf: true, when: { skillIds: [...YOUDU_FIXED_SKILL_IDS], requireKind: "fixed", damageOrigins: [DamageOrigin.ActionDirect], foeKind: "player", oncePerBattle: true }, aim: HookAim.HookTarget, effects: [{ type: EffectType.ApplyStatus, statusId: YOUDU_STATUS_ID.SoulSeal, duration: 3, targeting: { side: TargetSide.Enemy, includeDowned: true } }] }])] },
    { id: "youdu.node.soul.7.3", name: "蚀骨", pathId, layer: 7, slot: 3, description: "黄泉蚀生改为6%幽毒并延长1回合。", patches: [{ skillId: YOUDU_SKILL_ID.Wither, operation: "replaceStatusId", from: YOUDU_STATUS_ID.Poison, to: YOUDU_STATUS_ID.StrongPoison }, { skillId: YOUDU_SKILL_ID.Wither, operation: "setStatusDuration", statusId: YOUDU_STATUS_ID.StrongPoison, value: 4 }] },
  ]
}

function sixPathsNodes(): MeridianNodeDefV6[] {
  const pathId = YOUDU_PATH_ID.SixPaths
  return [
    { id: "youdu.node.six.1.1", name: "断狱", pathId, layer: 1, slot: 1, description: "六道断狱系数提高0.10。", patches: [{ skillId: YOUDU_SKILL_ID.Sever, operation: "addPhysicalCoefficient", hitIndex: 0, value: 0.1 }] },
    { id: "youdu.node.six.1.2", name: "洞敌", pathId, layer: 1, slot: 2, description: "命中提高30。", panel: [panel("hit", "add", 30)] },
    { id: "youdu.node.six.1.3", name: "修罗躯", pathId, layer: 1, slot: 3, description: "最大气血提高3%。", panel: [panel("maxHp", "multiply", 1.03)] },
    { id: "youdu.node.six.2.1", name: "蚀血", pathId, layer: 2, slot: 1, description: "对中毒目标物伤提高8%。", passives: [damagePassive("youdu.passive.six.poisoned", "蚀血", "physical", 1.08, { targetStatusKinds: ["youdu.poison"] })] },
    { id: "youdu.node.six.2.2", name: "夜战", pathId, layer: 2, slot: 2, description: "主动物伤提高5%。", passives: [damagePassive("youdu.passive.six.direct", "夜战", "physical", 1.05)] },
    { id: "youdu.node.six.2.3", name: "破甲", pathId, layer: 2, slot: 3, description: "主动物理忽防5%。", passives: [defenseIgnorePassive("youdu.passive.six.ignore5", "破甲", 0.05)] },
    { id: "youdu.node.six.3.1", name: "万鬼", pathId, layer: 3, slot: 1, description: "授予万鬼裂界。", grantSkills: [ghostRift] },
    { id: "youdu.node.six.3.2", name: "重狱", pathId, layer: 3, slot: 2, description: "六道断狱系数提高0.15。", patches: [{ skillId: YOUDU_SKILL_ID.Sever, operation: "addPhysicalCoefficient", hitIndex: 0, value: 0.15 }] },
    { id: "youdu.node.six.3.3", name: "斩衰", pathId, layer: 3, slot: 3, description: "对半血以下目标物伤提高10%。", passives: [damagePassive("youdu.passive.six.low_hp", "斩衰", "physical", 1.1, { targetHpRatioBelow: 0.5 })] },
    { id: "youdu.node.six.4.1", name: "裂界", pathId, layer: 4, slot: 1, description: "万鬼裂界系数提高0.08。", patches: [{ skillId: YOUDU_SKILL_ID.GhostRift, operation: "addPhysicalCoefficient", hitIndex: 0, value: 0.08 }] },
    { id: "youdu.node.six.4.2", name: "透骨", pathId, layer: 4, slot: 2, description: "万鬼裂界忽防8%。", patches: [{ skillId: YOUDU_SKILL_ID.GhostRift, operation: "setPhysicalDefenseIgnore", value: 0.08 }] },
    { id: "youdu.node.six.4.3", name: "凶星", pathId, layer: 4, slot: 3, description: "万鬼裂界暴击率提高5点。", passives: [passive("youdu.passive.six.ghost_crit", "凶星", [{ on: HookName.OnCritRoll, sourceIsSelf: true, when: { skillIds: [YOUDU_SKILL_ID.GhostRift], requireKind: "physical" }, effects: [{ type: EffectType.ModifyChance, add: 0.05 }] }], YOUDU_METHOD_ID.Asura)] },
    { id: "youdu.node.six.5.1", name: "百毒", pathId, layer: 5, slot: 1, description: "万鬼攻击已有幽毒目标增伤15%。", passives: [damagePassive("youdu.passive.six.ghost_poisoned", "百毒", "physical", 1.15, { skillIds: [YOUDU_SKILL_ID.GhostRift], targetStatusKinds: ["youdu.poison"] })] },
    { id: "youdu.node.six.5.2", name: "鬼雄", pathId, layer: 5, slot: 2, description: "物理暴击率提高5点。", panel: [panel("critRate", "add", 0.05)] },
    { id: "youdu.node.six.5.3", name: "乘灭", pathId, layer: 5, slot: 3, description: "物理击倒后下次物伤提高12%。", passives: [
      passive("youdu.passive.six.kill_mark", "乘灭·蓄", [{ on: HookName.OnDeath, sourceIsSelf: true, when: { requireKind: "physical", damageOrigins: [DamageOrigin.ActionDirect] }, aim: HookAim.Self, effects: [{ type: EffectType.ApplyStatus, statusId: YOUDU_STATUS_ID.NextPhysical, duration: 99, self: true }] }], YOUDU_METHOD_ID.Asura),
      passive("youdu.passive.six.kill_damage", "乘灭·斩", [{ on: HookName.OnHitCalc, sourceIsSelf: true, when: { requireKind: "physical", requireStatusIds: [YOUDU_STATUS_ID.NextPhysical], damageOrigins: [DamageOrigin.ActionDirect] }, effects: [{ type: EffectType.ModifyStrike, factor: 1.12 }, { type: EffectType.Dispel, statusIds: [YOUDU_STATUS_ID.NextPhysical] }] }], YOUDU_METHOD_ID.Asura),
    ] },
    { id: "youdu.node.six.6.1", name: "无甲", pathId, layer: 6, slot: 1, description: "主动物理额外忽防10%。", passives: [defenseIgnorePassive("youdu.passive.six.ignore10", "无甲", 0.1)] },
    { id: "youdu.node.six.6.2", name: "鬼潮", pathId, layer: 6, slot: 2, description: "万鬼裂界系数再提高0.10。", patches: [{ skillId: YOUDU_SKILL_ID.GhostRift, operation: "addPhysicalCoefficient", hitIndex: 0, value: 0.1 }] },
    { id: "youdu.node.six.6.3", name: "必断", pathId, layer: 6, slot: 3, description: "六道断狱系数提高0.25且必中。", patches: [{ skillId: YOUDU_SKILL_ID.Sever, operation: "addPhysicalCoefficient", hitIndex: 0, value: 0.25 }, { skillId: YOUDU_SKILL_ID.Sever, operation: "setPhysicalCannotMiss", value: true }] },
    { id: "youdu.node.six.7.1", name: "俱灭", pathId, layer: 7, slot: 1, description: "授予六道俱灭。", grantSkills: [sixPathsRuin] },
    { id: "youdu.node.six.7.2", name: "鬼啸", pathId, layer: 7, slot: 2, description: "万鬼对首目标追加一次攻击。", patches: [{ skillId: YOUDU_SKILL_ID.GhostRift, operation: "appendEffect", effect: { type: EffectType.PhysicalHit, coeff: 0.8, power: "floor(skillLevel * 0.2)", cannotMiss: true, when: { targetSlot: "primary" } } }] },
    { id: "youdu.node.six.7.3", name: "绝境", pathId, layer: 7, slot: 3, description: "半血以下增伤15%并承伤增加5%。", passives: [
      damagePassive("youdu.passive.six.desperate_damage", "绝境·攻", "physical", 1.15, { sourceHpRatioBelow: 0.5 }),
      passive("youdu.passive.six.desperate_taken", "绝境·险", [{ on: HookName.OnHitCalc, targetIsSelf: true, when: { sourceHpRatioBelow: 0.5 }, effects: [{ type: EffectType.ModifyStrike, factor: 1.05 }] }], YOUDU_METHOD_ID.Asura),
    ] },
  ]
}

export const YOUDU_V6_DEFINITION: SectDefinitionV6 = {
  id: YOUDU_V6_ID,
  name: "幽都",
  methods: [
    { id: YOUDU_METHOD_ID.Canon, slot: 1, name: "《幽都轮回总典》", isPrimary: true, panel: panel("maxHp", "add", 2) },
    { id: YOUDU_METHOD_ID.Judge, slot: 2, name: "《十殿判魂录》", isPrimary: false, panel: panel("sealHit", "add", 0.4) },
    { id: YOUDU_METHOD_ID.Wither, slot: 3, name: "《黄泉蚀命篇》", isPrimary: false, panel: panel("magicDef", "add", 0.4) },
    { id: YOUDU_METHOD_ID.Shadow, slot: 4, name: "《无常逐影诀》", isPrimary: false, panel: panel("speed", "add", 0.15) },
    { id: YOUDU_METHOD_ID.Asura, slot: 5, name: "《六道修罗经》", isPrimary: false, panel: panel("physicalAtk", "add", 0.5) },
    { id: YOUDU_METHOD_ID.Insight, slot: 6, name: "《幽冥洞照章》", isPrimary: false, panel: panel("hit", "add", 0.5) },
  ],
  skills: baseSkills,
  statuses,
  paths: [
    { id: YOUDU_PATH_ID.SoulJudge, name: "勾魂阎罗", foundationPassives: [damagePassive("youdu.passive.soul.foundation", "勾魂阎罗", "fixed", 1.05, { skillIds: [...YOUDU_FIXED_SKILL_IDS] })], nodes: soulJudgeNodes() },
    { id: YOUDU_PATH_ID.SixPaths, name: "六道魍魉", foundationPassives: [damagePassive("youdu.passive.six.foundation", "六道魍魉", "physical", 1.05)], nodes: sixPathsNodes() },
  ],
}
