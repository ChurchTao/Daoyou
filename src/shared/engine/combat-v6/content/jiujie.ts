import {
  CommandPolicy,
  DamageKind,
  DamageOrigin,
  EffectType,
  HookName,
  SkillTag,
  StatusCategory,
  StatusFlag,
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

export const JIUJIE_V6_ID = "jiujie" as const
export const JIUJIE_PATH_ID = {
  Law: "jiujie.path.law",
  Thunder: "jiujie.path.thunder",
} as const
export const JIUJIE_METHOD_ID = {
  Canon: "jiujie.method.canon",
  Seal: "jiujie.method.seal",
  Thunder: "jiujie.method.thunder",
  Guardian: "jiujie.method.guardian",
  Pride: "jiujie.method.pride",
  Cloud: "jiujie.method.cloud",
} as const
export const JIUJIE_SKILL_ID = {
  Thunderstorm: "jiujie.skill.thunderstorm",
  FiveThunder: "jiujie.skill.five_thunder",
  ThunderSlash: "jiujie.skill.thunder_slash",
  Suppress: "jiujie.skill.suppress",
  Confuse: "jiujie.skill.confuse",
  MillionWeapons: "jiujie.skill.million_weapons",
  DivineGuardian: "jiujie.skill.divine_guardian",
  HeavenlyPrison: "jiujie.skill.heavenly_prison",
  StartlingThunder: "jiujie.skill.startling_thunder",
  NineHeavensThunder: "jiujie.skill.nine_heavens_thunder",
} as const
export const JIUJIE_STATUS_ID = {
  Electric: "jiujie.status.electric",
  Suppress: "jiujie.status.suppress",
  Confuse: "jiujie.status.confuse",
  ConfuseWeaken: "jiujie.status.confuse_weaken",
  MillionWeapons: "jiujie.status.million_weapons",
  MillionWeaponsWeaken: "jiujie.status.million_weapons_weaken",
  MagicDefBreak: "jiujie.status.magic_def_break",
  MagicDefBreakStrong: "jiujie.status.magic_def_break_strong",
  Guardian: "jiujie.status.guardian",
} as const
export const JIUJIE_MECHANIC_ID = {
  Detonate: "jiujie.mechanic.electric_detonate",
} as const

const panel = (attr: CombatV6PanelContribution["attr"], mode: CombatV6PanelContribution["mode"], value: number): CombatV6PanelContribution => ({ attr, mode, value })
const active = (sourceMethodId: string, definition: SkillDef, unlockMethodLevel = 1): SectSkillDefV6 => ({ sourceMethodId, unlockMethodLevel, kind: "active", definition })
const passive = (id: string, name: string, hooks: SkillHook[], sourceMethodId = JIUJIE_METHOD_ID.Canon): SectSkillDefV6 => ({
  sourceMethodId,
  unlockMethodLevel: 0,
  kind: "passive",
  definition: { id, name, tags: [SkillTag.Passive], targeting: { side: TargetSide.Self }, effects: [], hooks },
})

const spellDamageIds = [JIUJIE_SKILL_ID.Thunderstorm, JIUJIE_SKILL_ID.StartlingThunder, JIUJIE_SKILL_ID.NineHeavensThunder]
const thunderstormIds = [JIUJIE_SKILL_ID.Thunderstorm]

function damagePassive(id: string, name: string, factor: number | string, options: { skillIds?: string[]; below?: number; targetElectric?: boolean; stacks?: { min?: number; max?: number } } = {}): SectSkillDefV6 {
  return passive(id, name, [{
    on: HookName.OnHitCalc,
    sourceIsSelf: true,
    when: {
      skillIds: options.skillIds ?? spellDamageIds,
      damageOrigins: [DamageOrigin.ActionDirect],
      targetHpRatioBelow: options.below,
      targetStatusKinds: options.targetElectric ? [JIUJIE_STATUS_ID.Electric] : undefined,
      targetStatusStack: options.stacks ? { kind: JIUJIE_STATUS_ID.Electric, ...options.stacks } : undefined,
    },
    effects: [{ type: EffectType.ModifyStrike, factor }],
  }])
}

function critPassive(id: string, name: string, add: number, options: { skillIds?: string[]; stacks?: { min?: number } } = {}): SectSkillDefV6 {
  return passive(id, name, [{
    on: HookName.OnCritRoll,
    sourceIsSelf: true,
    when: {
      skillIds: options.skillIds ?? spellDamageIds,
      damageOrigins: [DamageOrigin.ActionDirect],
      targetStatusStack: options.stacks ? { kind: JIUJIE_STATUS_ID.Electric, ...options.stacks } : undefined,
    },
    effects: [{ type: EffectType.ModifyChance, add }],
  }])
}

function ignorePassive(id: string, name: string, add: number): SectSkillDefV6 {
  return passive(id, name, [{
    on: HookName.OnDefenseIgnoreCalc,
    sourceIsSelf: true,
    when: { skillIds: spellDamageIds, damageOrigins: [DamageOrigin.ActionDirect] },
    effects: [{ type: EffectType.ModifyDefenseIgnore, add }],
  }])
}

const statuses: StatusDef[] = [
  { id: JIUJIE_STATUS_ID.Electric, name: "电芒", kind: JIUJIE_STATUS_ID.Electric, category: StatusCategory.Debuff, maxStacks: 3 },
  { id: JIUJIE_STATUS_ID.Suppress, name: "镇妖", kind: "jiujie.control.suppress", category: StatusCategory.Control, blocksAction: true },
  { id: JIUJIE_STATUS_ID.Confuse, name: "错乱", kind: "jiujie.control.confuse", category: StatusCategory.Control, blocksSpell: true, commandPolicy: CommandPolicy.RandomAttackTarget },
  { id: JIUJIE_STATUS_ID.ConfuseWeaken, name: "乱神摄魄", kind: "jiujie.control.confuse", category: StatusCategory.Control, blocksSpell: true, commandPolicy: CommandPolicy.RandomAttackTarget, attrMods: { magicAtk: "-floor(target.magicAtk * 0.1)" } },
  { id: JIUJIE_STATUS_ID.MillionWeapons, name: "百万神兵", kind: "jiujie.control.million_weapons", category: StatusCategory.Control, blocksPhysical: true },
  { id: JIUJIE_STATUS_ID.MillionWeaponsWeaken, name: "神兵挫锐", kind: "jiujie.control.million_weapons", category: StatusCategory.Control, blocksPhysical: true, attrMods: { physicalAtk: "-floor(target.physicalAtk * 0.1)" } },
  { id: JIUJIE_STATUS_ID.MagicDefBreak, name: "天雷破灵", kind: "jiujie.magic_def_break", category: StatusCategory.Debuff, attrMods: { magicDef: "-floor(target.magicDef * 0.1)" } },
  { id: JIUJIE_STATUS_ID.MagicDefBreakStrong, name: "天雷破障", kind: "jiujie.magic_def_break", category: StatusCategory.Debuff, attrMods: { magicDef: "-floor(target.magicDef * 0.15)" } },
  { id: JIUJIE_STATUS_ID.Guardian, name: "天神护法", kind: "jiujie.guardian", category: StatusCategory.Buff, attrMods: { sealResist: "floor(skillLevel * 0.3)" } },
]

const fiveThunderBranch = (branchId: string, controlled: boolean): SkillEffect => ({
  type: EffectType.RandomBranch,
  branchId,
  chance: 0.5,
  when: controlled
    ? { targetStatusCategories: [StatusCategory.Control] }
    : { targetAbsentStatusCategories: [StatusCategory.Control] },
  successEffects: [
    { type: EffectType.FixedHit, formula: "judge", power: "min(floor(target.hp * 0.25), 50 * skillLevel)", cannotKill: true },
    { type: EffectType.DamageMp, power: "floor(target.mp * 0.25)" },
  ],
  failureEffects: [
    { type: EffectType.FixedHit, formula: "judge", power: "min(floor(target.hp * 0.05), 10 * skillLevel)", cannotKill: true },
    { type: EffectType.DamageMp, power: "floor(target.mp * 0.05)" },
  ],
})

function detonationEffects(targetCount: number): SkillEffect[] {
  const targeting = targetCount > 1 ? { side: TargetSide.Enemy, mode: TargetMode.Fill, count: targetCount } as const : undefined
  const when = { targetStatusStack: { kind: JIUJIE_STATUS_ID.Electric, min: 1 } }
  return [
    { type: EffectType.EmitMechanic, mechanicId: JIUJIE_MECHANIC_ID.Detonate, name: "电芒引爆", when, targeting },
    { type: EffectType.FixedHit, formula: "fixed", origin: DamageOrigin.HookDerived, power: "floor(source.magicAtk * 0.25 * targetStatusStacks)", when, targeting },
    { type: EffectType.RemoveStatus, statusIds: [JIUJIE_STATUS_ID.Electric], maxCount: 1, when, targeting },
  ]
}

const baseSkills: SectSkillDefV6[] = [
  active(JIUJIE_METHOD_ID.Thunder, {
    id: JIUJIE_SKILL_ID.Thunderstorm,
    name: "雷霆万钧",
    school: JIUJIE_V6_ID,
    costMp: "25 + floor(skillLevel * 0.45)",
    tags: [SkillTag.Spell],
    formula: "spell",
    splash: { perTarget: 0.08, floor: 0.6 },
    targeting: { side: TargetSide.Enemy, mode: TargetMode.Fill, count: "min(5, floor(skillLevel / 45) + 1)" },
    effects: [
      { type: EffectType.SpellHit, coeff: 0.85, power: "35 + floor(skillLevel * 1.2)" },
      { type: EffectType.ApplyStatus, statusId: JIUJIE_STATUS_ID.Electric, duration: 3 },
    ],
  }),
  active(JIUJIE_METHOD_ID.Canon, {
    id: JIUJIE_SKILL_ID.FiveThunder,
    name: "五雷轰顶",
    school: JIUJIE_V6_ID,
    costMp: "35 + floor(skillLevel * 0.5)",
    tags: [SkillTag.Spell],
    targeting: { side: TargetSide.Enemy, count: 1 },
    effects: [fiveThunderBranch("jiujie.branch.five_thunder.normal", false), fiveThunderBranch("jiujie.branch.five_thunder.controlled", true)],
  }),
  active(JIUJIE_METHOD_ID.Pride, {
    id: JIUJIE_SKILL_ID.ThunderSlash,
    name: "天雷斩",
    school: JIUJIE_V6_ID,
    costMp: "20 + floor(skillLevel * 0.3)",
    tags: [SkillTag.Spell, SkillTag.Physical],
    formula: "physical",
    targeting: { side: TargetSide.Enemy, count: 1 },
    effects: [
      { type: EffectType.PhysicalHit, coeff: 1, power: "floor(skillLevel * 0.35)" },
      { type: EffectType.ApplyStatus, statusId: JIUJIE_STATUS_ID.MagicDefBreak, duration: 2 },
    ],
  }),
  active(JIUJIE_METHOD_ID.Seal, { id: JIUJIE_SKILL_ID.Suppress, name: "镇妖", school: JIUJIE_V6_ID, costMp: "30 + floor(skillLevel * 0.4)", tags: [SkillTag.Spell, SkillTag.Seal], sealBase: 45, targeting: { side: TargetSide.Enemy, count: 1 }, effects: [{ type: EffectType.ApplyStatus, statusId: JIUJIE_STATUS_ID.Suppress, duration: 1, hit: StatusHit.Seal }] }),
  active(JIUJIE_METHOD_ID.Cloud, { id: JIUJIE_SKILL_ID.Confuse, name: "错乱", school: JIUJIE_V6_ID, costMp: "25 + floor(skillLevel * 0.35)", tags: [SkillTag.Spell, SkillTag.Seal], sealBase: 55, targeting: { side: TargetSide.Enemy, count: 1 }, effects: [{ type: EffectType.ApplyStatus, statusId: JIUJIE_STATUS_ID.Confuse, duration: 2, hit: StatusHit.Seal }] }),
  active(JIUJIE_METHOD_ID.Guardian, { id: JIUJIE_SKILL_ID.MillionWeapons, name: "百万神兵", school: JIUJIE_V6_ID, costMp: "25 + floor(skillLevel * 0.35)", tags: [SkillTag.Spell, SkillTag.Seal], sealBase: 55, targeting: { side: TargetSide.Enemy, count: 1 }, effects: [{ type: EffectType.ApplyStatus, statusId: JIUJIE_STATUS_ID.MillionWeapons, duration: 2, hit: StatusHit.Seal }] }),
]

const divineGuardian = active(JIUJIE_METHOD_ID.Guardian, {
  id: JIUJIE_SKILL_ID.DivineGuardian,
  name: "天神护法",
  school: JIUJIE_V6_ID,
  costMp: "45 + floor(skillLevel * 0.5)",
  tags: [SkillTag.Spell, SkillTag.Support],
  targeting: { side: TargetSide.Ally, count: 1 },
  effects: [
    { type: EffectType.Dispel, categories: [StatusCategory.Control], maxCount: 2, excludeStatusFlags: [StatusFlag.BlocksRevive] },
    { type: EffectType.ApplyStatus, statusId: JIUJIE_STATUS_ID.Guardian, duration: 2 },
  ],
}, 60)

const heavenlyPrison = active(JIUJIE_METHOD_ID.Canon, {
  id: JIUJIE_SKILL_ID.HeavenlyPrison,
  name: "九天镇狱",
  school: JIUJIE_V6_ID,
  costMp: "80 + floor(skillLevel * 0.8)",
  tags: [SkillTag.Spell, SkillTag.Seal],
  sealBase: 60,
  targeting: { side: TargetSide.Enemy, count: 1 },
  effects: [{ type: EffectType.ApplyStatus, statusId: JIUJIE_STATUS_ID.Suppress, duration: 2, hit: StatusHit.Seal }],
}, 100)

const startlingThunder = active(JIUJIE_METHOD_ID.Thunder, {
  id: JIUJIE_SKILL_ID.StartlingThunder,
  name: "惊曜天雷",
  school: JIUJIE_V6_ID,
  costMp: "45 + floor(skillLevel * 0.5)",
  tags: [SkillTag.Spell],
  formula: "spell",
  targeting: { side: TargetSide.Enemy, count: 1 },
  effects: [{ type: EffectType.SpellHit, coeff: 1.35, power: "50 + floor(skillLevel * 1.3)" }, ...detonationEffects(1)],
}, 60)

const nineHeavensThunder = active(JIUJIE_METHOD_ID.Thunder, {
  id: JIUJIE_SKILL_ID.NineHeavensThunder,
  name: "九霄神雷",
  school: JIUJIE_V6_ID,
  costMp: "80 + floor(skillLevel * 0.8)",
  tags: [SkillTag.Spell],
  formula: "spell",
  splash: { perTarget: 0.06, floor: 0.7 },
  targeting: { side: TargetSide.Enemy, mode: TargetMode.Fill, count: 5 },
  effects: [{ type: EffectType.SpellHit, coeff: 1, power: "70 + floor(skillLevel * 1.4)" }, ...detonationEffects(5)],
}, 100)

const lifesteal = passive("jiujie.passive.thunder.lifesteal", "雷泽回生", [{
  on: HookName.AfterHit,
  sourceIsSelf: true,
  when: { skillIds: spellDamageIds, requireKind: DamageKind.Spell, damageOrigins: [DamageOrigin.ActionDirect] },
  aim: "self",
  effects: [{ type: EffectType.RestoreHp, power: "floor(hpDamage * 0.1)", maxGainPerAction: "floor(source.maxHp * 0.15)" }],
}])

const lawNodes: MeridianNodeDefV6[] = [
  node("law", 1, 1, "镇妖威仪", [], [{ skillId: JIUJIE_SKILL_ID.Suppress, operation: "addSealBase", value: 8 }]),
  node("law", 1, 2, "乱神摄魄", [], [{ skillId: JIUJIE_SKILL_ID.Confuse, operation: "addSealBase", value: 8 }]),
  node("law", 1, 3, "踏罡先机", [panel("speed", "add", 30)]),
  node("law", 2, 1, "神兵禁武", [], [{ skillId: JIUJIE_SKILL_ID.MillionWeapons, operation: "addSealBase", value: 8 }]),
  node("law", 2, 2, "天律无耗", [], [JIUJIE_SKILL_ID.Suppress, JIUJIE_SKILL_ID.Confuse, JIUJIE_SKILL_ID.MillionWeapons].map((skillId) => ({ skillId, operation: "multiplyCostMp" as const, value: 0.85 }))),
  node("law", 2, 3, "玉阙清明", [panel("sealResist", "add", 30)]),
  node("law", 3, 1, "天神护法", [], [], [], [divineGuardian]),
  node("law", 3, 2, "禁域深严", [], [{ skillId: JIUJIE_SKILL_ID.Suppress, operation: "setStatusDuration", statusId: JIUJIE_STATUS_ID.Suppress, value: 2 }]),
  node("law", 3, 3, "雷判无差", [], ["normal", "controlled"].map((kind) => ({ skillId: JIUJIE_SKILL_ID.FiveThunder, operation: "setRandomBranchChance" as const, branchId: `jiujie.branch.five_thunder.${kind}`, value: 0.6 }))),
  node("law", 4, 1, "乱神削灵", [], [{ skillId: JIUJIE_SKILL_ID.Confuse, operation: "replaceStatusId", from: JIUJIE_STATUS_ID.Confuse, to: JIUJIE_STATUS_ID.ConfuseWeaken }]),
  node("law", 4, 2, "神兵挫锐", [], [{ skillId: JIUJIE_SKILL_ID.MillionWeapons, operation: "replaceStatusId", from: JIUJIE_STATUS_ID.MillionWeapons, to: JIUJIE_STATUS_ID.MillionWeaponsWeaken }]),
  node("law", 4, 3, "天雷破障", [], [{ skillId: JIUJIE_SKILL_ID.ThunderSlash, operation: "replaceStatusId", from: JIUJIE_STATUS_ID.MagicDefBreak, to: JIUJIE_STATUS_ID.MagicDefBreakStrong }]),
  node("law", 5, 1, "乘隙行刑", [], [{ skillId: JIUJIE_SKILL_ID.FiveThunder, operation: "setRandomBranchChance", branchId: "jiujie.branch.five_thunder.controlled", value: 0.65 }]),
  node("law", 5, 2, "天威不动", [panel("magicDef", "add", 40)]),
  node("law", 5, 3, "凌霄法眼", [], [JIUJIE_SKILL_ID.Suppress, JIUJIE_SKILL_ID.Confuse, JIUJIE_SKILL_ID.MillionWeapons].map((skillId) => ({ skillId, operation: "addSealBase" as const, value: 5 }))),
  node("law", 6, 1, "执律森严", [], [JIUJIE_SKILL_ID.Suppress, JIUJIE_SKILL_ID.Confuse, JIUJIE_SKILL_ID.MillionWeapons].map((skillId) => ({ skillId, operation: "addSealBase" as const, value: 10 }))),
  node("law", 6, 2, "禁法久缚", [], [JIUJIE_STATUS_ID.Confuse, JIUJIE_STATUS_ID.ConfuseWeaken].map((statusId) => ({ skillId: JIUJIE_SKILL_ID.Confuse, operation: "setStatusDuration" as const, statusId, value: 3 }))),
  node("law", 6, 3, "禁武久缚", [], [JIUJIE_STATUS_ID.MillionWeapons, JIUJIE_STATUS_ID.MillionWeaponsWeaken].map((statusId) => ({ skillId: JIUJIE_SKILL_ID.MillionWeapons, operation: "setStatusDuration" as const, statusId, value: 3 }))),
  node("law", 7, 1, "九天镇狱", [], [], [], [heavenlyPrison]),
  node("law", 7, 2, "诸法皆禁", [], [
    { skillId: JIUJIE_SKILL_ID.Suppress, operation: "setSealBase", value: 60 },
    { skillId: JIUJIE_SKILL_ID.Suppress, operation: "setStatusDuration", statusId: JIUJIE_STATUS_ID.Suppress, value: 2 },
  ]),
  node("law", 7, 3, "五雷正法", [], [
    { skillId: JIUJIE_SKILL_ID.FiveThunder, operation: "setRandomBranchChance", branchId: "jiujie.branch.five_thunder.controlled", value: 1 },
    { skillId: JIUJIE_SKILL_ID.FiveThunder, operation: "setRandomBranchFixedPower", branchId: "jiujie.branch.five_thunder.controlled", value: "min(floor(target.hp * 0.3), 60 * skillLevel)" },
  ]),
]

const thunderNodes: MeridianNodeDefV6[] = [
  node("thunder", 1, 1, "雷动九霄", [], [], [damagePassive("jiujie.passive.thunder.l1s1", "雷动九霄", 1.08, { skillIds: thunderstormIds })]),
  node("thunder", 1, 2, "万钧齐落", [], [{ skillId: JIUJIE_SKILL_ID.Thunderstorm, operation: "setTargetCount", value: "min(6, floor(skillLevel / 45) + 2)" }]),
  node("thunder", 1, 3, "雷府灌顶", [panel("magicAtk", "add", 30)]),
  node("thunder", 2, 1, "电芒引雷", [], [], [damagePassive("jiujie.passive.thunder.l2s1", "电芒引雷", "1 + targetStatusStacks * 0.05", { stacks: { min: 1 } })]),
  node("thunder", 2, 2, "雷心炽盛", [], [], [critPassive("jiujie.passive.thunder.l2s2", "雷心炽盛", 0.05)]),
  node("thunder", 2, 3, "破霄洞真", [], [], [ignorePassive("jiujie.passive.thunder.l2s3", "破霄洞真", 0.05)]),
  node("thunder", 3, 1, "惊曜天雷", [], [], [], [startlingThunder]),
  node("thunder", 3, 2, "聚芒一点", [], [{ skillId: JIUJIE_SKILL_ID.Thunderstorm, operation: "appendEffect", effect: { type: EffectType.ApplyStatus, statusId: JIUJIE_STATUS_ID.Electric, duration: 3, when: { targetSlot: "primary" } } }]),
  node("thunder", 3, 3, "雷网无垠", [], [{ skillId: JIUJIE_SKILL_ID.Thunderstorm, operation: "setSplash", perTarget: 0.06, floor: 0.7 }]),
  node("thunder", 4, 1, "万钧增威", [], [{ skillId: JIUJIE_SKILL_ID.Thunderstorm, operation: "multiplySpellCoefficients", value: 0.93 / 0.85 }]),
  node("thunder", 4, 2, "电光久驻", [], [{ skillId: JIUJIE_SKILL_ID.Thunderstorm, operation: "setStatusDuration", statusId: JIUJIE_STATUS_ID.Electric, value: 4 }]),
  node("thunder", 4, 3, "雷眼昭明", [], [], [critPassive("jiujie.passive.thunder.l4s3", "雷眼昭明", 0.05, { skillIds: thunderstormIds })]),
  node("thunder", 5, 1, "乘雷破阵", [], [], [damagePassive("jiujie.passive.thunder.l5s1", "乘雷破阵", 1.08, { targetElectric: true })]),
  node("thunder", 5, 2, "雷泽回生", [], [], [lifesteal]),
  node("thunder", 5, 3, "追亡逐电", [], [], [damagePassive("jiujie.passive.thunder.l5s3", "追亡逐电", 1.1, { skillIds: thunderstormIds, below: 0.5 })]),
  node("thunder", 6, 1, "九霄震怒", [], [], [damagePassive("jiujie.passive.thunder.l6s1", "九霄震怒", 1.1)]),
  node("thunder", 6, 2, "雷界无壁", [], [], [ignorePassive("jiujie.passive.thunder.l6s2", "雷界无壁", 0.1)]),
  node("thunder", 6, 3, "万雷同鸣", [], [], [damagePassive("jiujie.passive.thunder.l6s3", "万雷同鸣", 1.12, { skillIds: thunderstormIds })]),
  node("thunder", 7, 1, "九霄神雷", [], [], [], [nineHeavensThunder]),
  node("thunder", 7, 2, "雷霆复奏", [], [{ skillId: JIUJIE_SKILL_ID.Thunderstorm, operation: "appendEffect", effect: { type: EffectType.SpellHit, coeff: 0.75, power: "35 + floor(skillLevel * 1.2)", when: { targetSlot: "primary" } } }]),
  node("thunder", 7, 3, "三劫雷极", [], [], [
    critPassive("jiujie.passive.thunder.l7s3.crit", "三劫雷极·雷暴", 0.1, { stacks: { min: 3 } }),
    passive("jiujie.passive.thunder.l7s3.detonate", "三劫雷极·引爆", [{ on: HookName.OnHitCalc, sourceIsSelf: true, requireKind: DamageKind.Fixed, when: { skillIds: [JIUJIE_SKILL_ID.StartlingThunder, JIUJIE_SKILL_ID.NineHeavensThunder], damageOrigins: [DamageOrigin.HookDerived] }, effects: [{ type: EffectType.ModifyStrike, factor: 1.2 }] }]),
  ]),
]

function node(
  path: "law" | "thunder",
  layer: MeridianNodeDefV6["layer"],
  slot: MeridianNodeDefV6["slot"],
  name: string,
  nodePanel: CombatV6PanelContribution[] = [],
  patches: SkillPatchV6[] = [],
  passives: SectSkillDefV6[] = [],
  grantSkills: SectSkillDefV6[] = [],
): MeridianNodeDefV6 {
  return { id: `jiujie.node.${path}.${layer}.${slot}`, name, pathId: path === "law" ? JIUJIE_PATH_ID.Law : JIUJIE_PATH_ID.Thunder, layer, slot, description: name, panel: nodePanel, patches, passives, grantSkills }
}

export const JIUJIE_V6_DEFINITION: SectDefinitionV6 = {
  id: JIUJIE_V6_ID,
  name: "九劫天宫",
  methods: [
    { id: JIUJIE_METHOD_ID.Canon, slot: 1, name: "《九劫天书》", isPrimary: true, panel: panel("maxMp", "add", 2) },
    { id: JIUJIE_METHOD_ID.Seal, slot: 2, name: "《乾坤镇妖录》", isPrimary: false, panel: panel("sealHit", "add", 0.4) },
    { id: JIUJIE_METHOD_ID.Thunder, slot: 3, name: "《混天雷法》", isPrimary: false, panel: panel("magicAtk", "add", 0.5) },
    { id: JIUJIE_METHOD_ID.Guardian, slot: 4, name: "《天罡护体经》", isPrimary: false, panel: panel("magicDef", "add", 0.4) },
    { id: JIUJIE_METHOD_ID.Pride, slot: 5, name: "《傲世神诀》", isPrimary: false, panel: panel("sealResist", "add", 0.25) },
    { id: JIUJIE_METHOD_ID.Cloud, slot: 6, name: "《云霄步》", isPrimary: false, panel: panel("speed", "add", 0.15) },
  ],
  skills: baseSkills,
  statuses,
  paths: [
    { id: JIUJIE_PATH_ID.Law, name: "天律镇妖", panel: [panel("sealHit", "add", 20)], nodes: lawNodes, foundationPassives: [], patches: [], grantSkills: [], resources: [] },
    { id: JIUJIE_PATH_ID.Thunder, name: "九霄驭雷", nodes: thunderNodes, foundationPassives: [damagePassive("jiujie.passive.thunder.foundation", "九霄驭雷", 1.05)], patches: [], grantSkills: [], resources: [] },
  ],
}

export function validateJiujieContentV1(): CombatV6ProjectionDiagnostic[] {
  const diagnostics: CombatV6ProjectionDiagnostic[] = []
  const electric = JIUJIE_V6_DEFINITION.statuses.find((status) => status.id === JIUJIE_STATUS_ID.Electric)
  if (!electric || electric.kind !== JIUJIE_STATUS_ID.Electric || electric.maxStacks !== 3 || electric.category !== StatusCategory.Debuff) {
    diagnostics.push({ severity: "error", code: "INVALID_ELECTRIC_STATUS_CONTENT", message: "九劫电芒必须是三层协同减益状态" })
  }
  return diagnostics
}
