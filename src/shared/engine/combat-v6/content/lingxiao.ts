import {
  BUILTIN_SKILL_ID,
  CommandPolicy,
  EffectType,
  HookAim,
  HookName,
  SkillTag,
  StatusCategory,
  TargetMode,
  TargetSide,
  type SkillDef,
  type SkillHook,
  type StatusDef,
} from "../core/index.ts"
import type { CombatV6PanelContribution } from "../projection/types.ts"
import type {
  MeridianNodeDefV6,
  SectDefinitionV6,
  SectSkillDefV6,
} from "./types.ts"

export const LINGXIAO_V6_ID = "lingxiao" as const
export const LINGXIAO_PATH_ID = {
  Zhanchen: "lingxiao.path.zhanchen",
  Guiyi: "lingxiao.path.guiyi",
} as const
export const LINGXIAO_RESOURCE_ID = "lingxiao.resource.sword_intent"

export const LINGXIAO_METHOD_ID = {
  Canon: "lingxiao.method.canon",
  SwordAura: "lingxiao.method.sword_aura",
  Waiting: "lingxiao.method.waiting",
  Shadow: "lingxiao.method.shadow",
  Formation: "lingxiao.method.formation",
  Clarity: "lingxiao.method.clarity",
} as const

export const LINGXIAO_SKILL_ID = {
  Triple: "lingxiao.skill.triple",
  Waiting: "lingxiao.skill.waiting",
  Formation: "lingxiao.skill.formation",
  SwordAura: "lingxiao.skill.sword_aura",
  Clarity: "lingxiao.skill.clarity",
  Confuse: "lingxiao.skill.confuse",
  BloodStrike: "lingxiao.skill.blood_strike",
  ZhanchenUltimate: "lingxiao.skill.zhanchen_ultimate",
  ShadowStrike: "lingxiao.skill.shadow_strike",
  GuiyiUltimate: "lingxiao.skill.guiyi_ultimate",
} as const

const STATUS = {
  Rest: "lingxiao.status.rest",
  Waiting: "lingxiao.status.waiting",
  SwordAura: "lingxiao.status.sword_aura",
  Clarity: "lingxiao.status.clarity",
  Confuse: "lingxiao.status.confuse",
  Shadow: "lingxiao.status.shadow",
  NextDamage: "lingxiao.status.next_damage",
  DefendDamage: "lingxiao.status.defend_damage",
  RestResist: "lingxiao.status.rest_resist",
  ChainBreak: "lingxiao.status.chain_break",
} as const

const passive = (
  id: string,
  name: string,
  sourceMethodId: string,
  hooks: SkillHook[],
): SectSkillDefV6 => ({
  sourceMethodId,
  unlockMethodLevel: 0,
  kind: "passive",
  definition: {
    id,
    name,
    tags: [SkillTag.Passive],
    targeting: { side: TargetSide.Self },
    effects: [],
    hooks,
  },
})

const active = (
  sourceMethodId: string,
  unlockMethodLevel: number,
  definition: SkillDef,
): SectSkillDefV6 => ({ sourceMethodId, unlockMethodLevel, kind: "active", definition })

const addDamagePassive = (
  id: string,
  name: string,
  factor: number,
  when: SkillHook["when"] = {},
  sourceMethodId = LINGXIAO_METHOD_ID.Canon,
): SectSkillDefV6 =>
  passive(id, name, sourceMethodId, [
    {
      on: HookName.OnHitCalc,
      sourceIsSelf: true,
      when: { ...when, requireKind: "physical" },
      effects: [{ type: EffectType.ModifyStrike, factor }],
    },
  ])

const addTakenPassive = (
  id: string,
  name: string,
  factor: number,
  when: SkillHook["when"] = {},
): SectSkillDefV6 =>
  passive(id, name, LINGXIAO_METHOD_ID.Waiting, [
    {
      on: HookName.OnHitCalc,
      targetIsSelf: true,
      when,
      effects: [{ type: EffectType.ModifyStrike, factor }],
    },
  ])

const panel = (
  attr: CombatV6PanelContribution["attr"],
  mode: CombatV6PanelContribution["mode"],
  value: number,
): CombatV6PanelContribution => ({ attr, mode, value })

const statuses: StatusDef[] = [
  { id: STATUS.Rest, name: "剑息", kind: "lingxiao.rest", category: StatusCategory.Control, blocksAction: true },
  {
    id: STATUS.Waiting,
    name: "伏锋",
    kind: "lingxiao.waiting",
    category: StatusCategory.Buff,
    actFirst: true,
    commandPolicy: CommandPolicy.StoredAttack,
    attrMods: {
      physicalAtk: "skillLevel",
      physicalDef: "skillLevel",
      hit: "skillLevel",
    },
  },
  { id: STATUS.SwordAura, name: "剑煞凝罡", kind: "lingxiao.sword_aura", category: StatusCategory.Buff, attrMods: { hit: "skillLevel" } },
  {
    id: STATUS.Clarity,
    name: "澄神守一",
    kind: "lingxiao.clarity",
    category: StatusCategory.Buff,
    attrMods: { magicDef: "skillLevel", sealResist: "floor(skillLevel / 2)" },
  },
  { id: STATUS.Confuse, name: "摄心", kind: "lingxiao.confuse", category: StatusCategory.Control, commandPolicy: CommandPolicy.Random },
  { id: STATUS.Shadow, name: "惊鸿", kind: "lingxiao.shadow", category: StatusCategory.Buff, speedMod: "floor(skillLevel * 0.5)" },
  { id: STATUS.NextDamage, name: "乘胜", kind: "lingxiao.next_damage", category: StatusCategory.Buff },
  { id: STATUS.DefendDamage, name: "蓄势", kind: "lingxiao.defend_damage", category: StatusCategory.Buff },
  { id: STATUS.RestResist, name: "不惊", kind: "lingxiao.rest_resist", category: StatusCategory.Buff, attrMods: { sealResist: 20 } },
  { id: STATUS.ChainBreak, name: "连破", kind: "lingxiao.chain_break", category: StatusCategory.Buff },
]

const baseSkills: SectSkillDefV6[] = [
  active(LINGXIAO_METHOD_ID.Canon, 1, {
    id: LINGXIAO_SKILL_ID.Triple,
    name: "断尘三叠",
    school: LINGXIAO_V6_ID,
    costHp: "maxHp * 0.1",
    requireHpRatio: 0.5,
    tags: [SkillTag.Physical],
    targeting: { side: TargetSide.Enemy, count: 1 },
    effects: [
      { type: EffectType.PhysicalHit, hits: 3, coeff: [0.75, 0.85, 0.95], power: "floor(skillLevel * 0.5)" },
      { type: EffectType.SkipNextAction },
      { type: EffectType.ApplyStatus, statusId: STATUS.Rest, duration: 1, self: true },
    ],
  }),
  active(LINGXIAO_METHOD_ID.Waiting, 1, {
    id: LINGXIAO_SKILL_ID.Waiting,
    name: "伏锋待机",
    school: LINGXIAO_V6_ID,
    costHp: "hp * 0.05",
    tags: [SkillTag.Physical],
    targeting: { side: TargetSide.Enemy, count: 1 },
    effects: [{ type: EffectType.ApplyStatus, statusId: STATUS.Waiting, duration: 1, self: true, storeTarget: true }],
  }),
  active(LINGXIAO_METHOD_ID.Formation, 1, {
    id: LINGXIAO_SKILL_ID.Formation,
    name: "裂阵沉舟",
    school: LINGXIAO_V6_ID,
    costHp: "maxHp * 0.1",
    tags: [SkillTag.Physical],
    targeting: { side: TargetSide.Enemy, mode: TargetMode.Fill, count: "min(3, floor(skillLevel / 60) + 1)" },
    effects: [{ type: EffectType.PhysicalHit, coeff: 0.85, power: "floor(skillLevel * 0.4)" }],
  }),
  active(LINGXIAO_METHOD_ID.SwordAura, 1, {
    id: LINGXIAO_SKILL_ID.SwordAura,
    name: "剑煞凝罡",
    school: LINGXIAO_V6_ID,
    costMp: "20 + floor(skillLevel / 5)",
    tags: [SkillTag.Support],
    targeting: { side: TargetSide.Ally, count: 1 },
    effects: [{ type: EffectType.ApplyStatus, statusId: STATUS.SwordAura, duration: 5 }],
  }),
  active(LINGXIAO_METHOD_ID.Clarity, 1, {
    id: LINGXIAO_SKILL_ID.Clarity,
    name: "澄神守一",
    school: LINGXIAO_V6_ID,
    costMp: "20 + floor(skillLevel / 5)",
    tags: [SkillTag.Support],
    targeting: { side: TargetSide.Self },
    effects: [{ type: EffectType.ApplyStatus, statusId: STATUS.Clarity, duration: 5, self: true }],
  }),
  active(LINGXIAO_METHOD_ID.Clarity, 30, {
    id: LINGXIAO_SKILL_ID.Confuse,
    name: "摄心剑印",
    school: LINGXIAO_V6_ID,
    costMp: "30 + floor(skillLevel / 2)",
    tags: [SkillTag.Spell, SkillTag.Seal],
    sealBase: 50,
    targeting: { side: TargetSide.Enemy, count: 1 },
    effects: [{ type: EffectType.ApplyStatus, statusId: STATUS.Confuse, duration: 2, hit: "seal" }],
  }),
]

const bloodStrike = active(LINGXIAO_METHOD_ID.SwordAura, 1, {
  id: LINGXIAO_SKILL_ID.BloodStrike,
  name: "血锋连斩",
  school: LINGXIAO_V6_ID,
  costHp: "maxHp * 0.08",
  tags: [SkillTag.Physical],
  targeting: { side: TargetSide.Enemy, count: 1 },
  effects: [{ type: EffectType.PhysicalHit, hits: 2, coeff: [0.7, 0.8], power: "floor(skillLevel * 0.4)" }],
})

const zhanchenUltimate = active(LINGXIAO_METHOD_ID.Canon, 100, {
  id: LINGXIAO_SKILL_ID.ZhanchenUltimate,
  name: "一剑开天门",
  school: LINGXIAO_V6_ID,
  costHp: "maxHp * 0.15",
  tags: [SkillTag.Physical],
  targeting: { side: TargetSide.Enemy, count: 1 },
  effects: [
    { type: EffectType.PhysicalHit, coeff: 1.65, power: "floor(skillLevel * 0.6)" },
    { type: EffectType.SkipNextAction },
    { type: EffectType.ApplyStatus, statusId: STATUS.Rest, duration: 1, self: true },
  ],
})

const shadowStrike = active(LINGXIAO_METHOD_ID.Shadow, 1, {
  id: LINGXIAO_SKILL_ID.ShadowStrike,
  name: "惊鸿掠影",
  school: LINGXIAO_V6_ID,
  costMp: "20 + floor(skillLevel / 5)",
  tags: [SkillTag.Physical],
  targeting: { side: TargetSide.Enemy, count: 1 },
  effects: [
    { type: EffectType.PhysicalHit, coeff: 0.8, power: "floor(skillLevel * 0.4)" },
    { type: EffectType.ApplyStatus, statusId: STATUS.Shadow, duration: 3, self: true },
    { type: EffectType.ModifyResource, resourceId: LINGXIAO_RESOURCE_ID, amount: 2 },
  ],
})

const guiyiUltimate = active(LINGXIAO_METHOD_ID.Canon, 100, {
  id: LINGXIAO_SKILL_ID.GuiyiUltimate,
  name: "万锋归一",
  school: LINGXIAO_V6_ID,
  resourceRequirements: [{ resourceId: LINGXIAO_RESOURCE_ID, min: 11 }],
  tags: [SkillTag.Physical],
  targeting: { side: TargetSide.Enemy, count: 1 },
  effects: [
    { type: EffectType.PhysicalHit, coeff: 1.8, power: "floor(skillLevel * 0.6)" },
    { type: EffectType.ModifyResource, resourceId: LINGXIAO_RESOURCE_ID, amount: 0, mode: "set" },
    { type: EffectType.SkipNextAction },
    { type: EffectType.ApplyStatus, statusId: STATUS.Rest, duration: 1, self: true },
  ],
})

const nextDamageHooks = (statusId: string, factor: number): SkillHook[] => [
  {
    on: HookName.OnHitCalc,
    sourceIsSelf: true,
    when: { requireKind: "physical", requireStatusIds: [statusId] },
    aim: HookAim.Self,
    effects: [
      { type: EffectType.ModifyStrike, factor },
      { type: EffectType.Dispel, statusIds: [statusId] },
    ],
  },
]

function zhanchenNodes(): MeridianNodeDefV6[] {
  const pathId = LINGXIAO_PATH_ID.Zhanchen
  return [
    {
      id: "lingxiao.node.zhanchen.1.1", name: "砺锋", pathId, layer: 1, slot: 1,
      description: "断尘三叠总伤害提高5%。",
      patches: [{ skillId: LINGXIAO_SKILL_ID.Triple, operation: "multiplyPhysicalCoefficients", value: 1.05 }],
    },
    {
      id: "lingxiao.node.zhanchen.1.2", name: "风刃", pathId, layer: 1, slot: 2,
      description: "对NPC普通攻击时溅射另外两个目标。",
      passives: [passive("lingxiao.passive.zhanchen.wind_blade", "风刃", LINGXIAO_METHOD_ID.Canon, [{
        on: HookName.AfterHit, sourceIsSelf: true, aim: HookAim.Others, aimCount: 2, aimMode: TargetMode.Random,
        when: { skillIds: [BUILTIN_SKILL_ID.Attack], foeKind: "npc" },
        effects: [{ type: EffectType.PhysicalHit, coeff: 0.2 }],
      }])],
    },
    {
      id: "lingxiao.node.zhanchen.1.3", name: "固元", pathId, layer: 1, slot: 3,
      description: "最大气血提高3%。", panel: [panel("maxHp", "multiply", 1.03)],
    },
    {
      id: "lingxiao.node.zhanchen.2.1", name: "勇武", pathId, layer: 2, slot: 1,
      description: "对低于50%气血的目标造成伤害提高8%。",
      passives: [addDamagePassive("lingxiao.passive.zhanchen.bravery", "勇武", 1.08, { targetHpRatioBelow: 0.5 })],
    },
    {
      id: "lingxiao.node.zhanchen.2.2", name: "静岳", pathId, layer: 2, slot: 2,
      description: "断尘三叠休息期间物法承伤降低10%。",
      passives: [addTakenPassive("lingxiao.passive.zhanchen.guarded_rest", "静岳", 0.9, { requireStatusIds: [STATUS.Rest] })],
    },
    {
      id: "lingxiao.node.zhanchen.2.3", name: "明锋", pathId, layer: 2, slot: 3,
      description: "命中提高30。", panel: [panel("hit", "add", 30)],
    },
    {
      id: "lingxiao.node.zhanchen.3.1", name: "破血", pathId, layer: 3, slot: 1,
      description: "授予血锋连斩。", grantSkills: [bloodStrike],
    },
    {
      id: "lingxiao.node.zhanchen.3.2", name: "杀意", pathId, layer: 3, slot: 2,
      description: "击倒目标后下一次物理伤害提高10%。",
      passives: [passive("lingxiao.passive.zhanchen.kill_intent", "杀意", LINGXIAO_METHOD_ID.SwordAura, [
        { on: HookName.OnDeath, sourceIsSelf: true, aim: HookAim.Self, effects: [{ type: EffectType.ApplyStatus, statusId: STATUS.NextDamage, duration: 2, self: true }] },
        ...nextDamageHooks(STATUS.NextDamage, 1.1),
      ])],
    },
    {
      id: "lingxiao.node.zhanchen.3.3", name: "蓄锐", pathId, layer: 3, slot: 3,
      description: "防御受击后下一次物理伤害提高12%。",
      passives: [passive("lingxiao.passive.zhanchen.stored_edge", "蓄锐", LINGXIAO_METHOD_ID.Waiting, [
        { on: HookName.OnBeHit, targetIsSelf: true, when: { sourceDefending: true, oncePerRound: true }, aim: HookAim.Self, effects: [{ type: EffectType.ApplyStatus, statusId: STATUS.DefendDamage, duration: 2, self: true }] },
        ...nextDamageHooks(STATUS.DefendDamage, 1.12),
      ])],
    },
    {
      id: "lingxiao.node.zhanchen.4.1", name: "神凝", pathId, layer: 4, slot: 1,
      description: "断尘三叠气血门槛降至40%。",
      patches: [{ skillId: LINGXIAO_SKILL_ID.Triple, operation: "capRequireHpRatio", value: 0.4 }],
    },
    {
      id: "lingxiao.node.zhanchen.4.2", name: "破空", pathId, layer: 4, slot: 2,
      description: "断尘三叠第三段系数增加0.15。",
      patches: [{ skillId: LINGXIAO_SKILL_ID.Triple, operation: "addPhysicalCoefficient", hitIndex: 2, value: 0.15 }],
    },
    {
      id: "lingxiao.node.zhanchen.4.3", name: "拓阵", pathId, layer: 4, slot: 3,
      description: "裂阵沉舟额外作用一个目标。",
      patches: [{ skillId: LINGXIAO_SKILL_ID.Formation, operation: "setTargetCount", value: "min(4, floor(skillLevel / 60) + 2)" }],
    },
    {
      id: "lingxiao.node.zhanchen.5.1", name: "锐心", pathId, layer: 5, slot: 1,
      description: "断尘三叠暴击率提高5%。",
      passives: [passive("lingxiao.passive.zhanchen.keen_heart", "锐心", LINGXIAO_METHOD_ID.Canon, [{
        on: HookName.OnCritRoll, sourceIsSelf: true, when: { skillIds: [LINGXIAO_SKILL_ID.Triple] }, effects: [{ type: EffectType.ModifyChance, add: 0.05 }],
      }])],
    },
    {
      id: "lingxiao.node.zhanchen.5.2", name: "狂狷", pathId, layer: 5, slot: 2,
      description: "低于50%气血时增伤10%，承伤增加5%。",
      passives: [
        addDamagePassive("lingxiao.passive.zhanchen.reckless_damage", "狂狷·攻", 1.1, { sourceHpRatioBelow: 0.5 }),
        addTakenPassive("lingxiao.passive.zhanchen.reckless_taken", "狂狷·险", 1.05, { sourceHpRatioBelow: 0.5 }),
      ],
    },
    {
      id: "lingxiao.node.zhanchen.5.3", name: "不惊", pathId, layer: 5, slot: 3,
      description: "断尘三叠休息期间封禁抵抗提高20。",
      patches: [{ skillId: LINGXIAO_SKILL_ID.Triple, operation: "appendEffect", effect: { type: EffectType.ApplyStatus, statusId: STATUS.RestResist, duration: 1, self: true } }],
    },
    {
      id: "lingxiao.node.zhanchen.6.1", name: "连破", pathId, layer: 6, slot: 1,
      description: "断尘三叠击倒目标时取消休息。",
      passives: [passive("lingxiao.passive.zhanchen.chain_break", "连破", LINGXIAO_METHOD_ID.Canon, [
        {
          on: HookName.OnDeath, sourceIsSelf: true, when: { skillIds: [LINGXIAO_SKILL_ID.Triple] }, aim: HookAim.Self,
          effects: [{ type: EffectType.ApplyStatus, statusId: STATUS.ChainBreak, duration: 1, self: true }],
        },
        {
          on: HookName.AfterAction, sourceIsSelf: true,
          when: { skillIds: [LINGXIAO_SKILL_ID.Triple], requireStatusIds: [STATUS.ChainBreak] }, aim: HookAim.Self,
          effects: [
            { type: EffectType.ClearSkipNextAction },
            { type: EffectType.Dispel, statusIds: [STATUS.Rest, STATUS.RestResist, STATUS.ChainBreak] },
          ],
        },
      ])],
    },
    {
      id: "lingxiao.node.zhanchen.6.2", name: "血勇", pathId, layer: 6, slot: 2,
      description: "断尘三叠气血消耗降至5%，门槛降至35%。",
      patches: [
        { skillId: LINGXIAO_SKILL_ID.Triple, operation: "setCostHp", value: "maxHp * 0.05" },
        { skillId: LINGXIAO_SKILL_ID.Triple, operation: "capRequireHpRatio", value: 0.35 },
      ],
    },
    {
      id: "lingxiao.node.zhanchen.6.3", name: "裂军", pathId, layer: 6, slot: 3,
      description: "裂阵沉舟伤害提高10%。",
      patches: [{ skillId: LINGXIAO_SKILL_ID.Formation, operation: "multiplyPhysicalCoefficients", value: 1.1 }],
    },
    {
      id: "lingxiao.node.zhanchen.7.1", name: "四绝", pathId, layer: 7, slot: 1,
      description: "断尘三叠增加第四段攻击。",
      patches: [{ skillId: LINGXIAO_SKILL_ID.Triple, operation: "addPhysicalCoefficient", hitIndex: 3, value: 0.95 }],
    },
    {
      id: "lingxiao.node.zhanchen.7.2", name: "乘胜追锋", pathId, layer: 7, slot: 2,
      description: "每场首次击倒后追击最低气血敌人。",
      passives: [passive("lingxiao.passive.zhanchen.victory_chase", "乘胜追锋", LINGXIAO_METHOD_ID.Canon, [{
        on: HookName.OnDeath, sourceIsSelf: true, aim: HookAim.Others, aimCount: 1, aimMode: TargetMode.LowestHp,
        when: { oncePerBattle: true }, effects: [{ type: EffectType.PhysicalHit, coeff: 0.8 }],
      }])],
    },
    {
      id: "lingxiao.node.zhanchen.7.3", name: "开天", pathId, layer: 7, slot: 3,
      description: "授予终式一剑开天门。", grantSkills: [zhanchenUltimate],
    },
  ]
}

function guiyiNodes(): MeridianNodeDefV6[] {
  const pathId = LINGXIAO_PATH_ID.Guiyi
  return [
    {
      id: "lingxiao.node.guiyi.1.1", name: "蓄意", pathId, layer: 1, slot: 1,
      description: "断尘三叠额外增加1点剑意。",
      passives: [passive("lingxiao.passive.guiyi.extra_triple_intent", "蓄意", LINGXIAO_METHOD_ID.Canon, [{
        on: HookName.AfterAction, sourceIsSelf: true, when: { skillIds: [LINGXIAO_SKILL_ID.Triple] }, aim: HookAim.Self,
        effects: [{ type: EffectType.ModifyResource, resourceId: LINGXIAO_RESOURCE_ID, amount: 1 }],
      }])],
    },
    {
      id: "lingxiao.node.guiyi.1.2", name: "飞鸿", pathId, layer: 1, slot: 2,
      description: "惊鸿掠影系数增加0.15。",
      patches: [{ skillId: LINGXIAO_SKILL_ID.ShadowStrike, operation: "addPhysicalCoefficient", hitIndex: 0, value: 0.15 }],
    },
    {
      id: "lingxiao.node.guiyi.1.3", name: "固元", pathId, layer: 1, slot: 3,
      description: "最大气血提高3%。", panel: [panel("maxHp", "multiply", 1.03)],
    },
    {
      id: "lingxiao.node.guiyi.2.1", name: "凌厉", pathId, layer: 2, slot: 1,
      description: "剑意达到2点时额外增伤3%。",
      passives: [addDamagePassive("lingxiao.passive.guiyi.sharp", "凌厉", 1.03, { sourceResource: { id: LINGXIAO_RESOURCE_ID, min: 2 } })],
    },
    {
      id: "lingxiao.node.guiyi.2.2", name: "守意", pathId, layer: 2, slot: 2,
      description: "防御受击后增加1点剑意。",
      passives: [passive("lingxiao.passive.guiyi.guard_intent", "守意", LINGXIAO_METHOD_ID.Waiting, [{
        on: HookName.OnBeHit, targetIsSelf: true, when: { sourceDefending: true, oncePerRound: true }, aim: HookAim.Self,
        effects: [{ type: EffectType.ModifyResource, resourceId: LINGXIAO_RESOURCE_ID, amount: 1 }],
      }])],
    },
    {
      id: "lingxiao.node.guiyi.2.3", name: "候锋", pathId, layer: 2, slot: 3,
      description: "伏锋待机完成后额外增加1点剑意。",
      passives: [passive("lingxiao.passive.guiyi.waiting_intent", "候锋", LINGXIAO_METHOD_ID.Waiting, [{
        on: HookName.AfterAction, sourceIsSelf: true,
        when: { skillIds: [BUILTIN_SKILL_ID.Attack], requireStatusIds: [STATUS.Waiting] }, aim: HookAim.Self,
        effects: [{ type: EffectType.ModifyResource, resourceId: LINGXIAO_RESOURCE_ID, amount: 1 }],
      }])],
    },
    {
      id: "lingxiao.node.guiyi.3.1", name: "长虹", pathId, layer: 3, slot: 1,
      description: "惊鸿状态延长2回合。",
      patches: [{ skillId: LINGXIAO_SKILL_ID.ShadowStrike, operation: "appendEffect", effect: { type: EffectType.ApplyStatus, statusId: STATUS.Shadow, duration: 5, self: true } }],
    },
    {
      id: "lingxiao.node.guiyi.3.2", name: "破甲", pathId, layer: 3, slot: 2,
      description: "2点剑意以上断尘三叠额外忽略5%物防。",
      passives: [passive("lingxiao.passive.guiyi.armor_break", "破甲", LINGXIAO_METHOD_ID.Canon, [{
        on: HookName.OnDefenseIgnoreCalc, sourceIsSelf: true,
        when: { skillIds: [LINGXIAO_SKILL_ID.Triple], requireKind: "physical", sourceResource: { id: LINGXIAO_RESOURCE_ID, min: 2 } },
        effects: [{ type: EffectType.ModifyDefenseIgnore, add: 0.05 }],
      }])],
    },
    {
      id: "lingxiao.node.guiyi.3.3", name: "开阵", pathId, layer: 3, slot: 3,
      description: "2点剑意以上强化裂阵沉舟目标数。",
      patches: [{ skillId: LINGXIAO_SKILL_ID.Formation, operation: "addResourceTargetCount", resourceId: LINGXIAO_RESOURCE_ID, min: 2, value: "min(4, floor(skillLevel / 60) + 2)" }],
    },
    {
      id: "lingxiao.node.guiyi.4.1", name: "剑心", pathId, layer: 4, slot: 1,
      description: "5点剑意以上物理暴击率提高5%。",
      passives: [passive("lingxiao.passive.guiyi.crit", "剑心", LINGXIAO_METHOD_ID.Canon, [{
        on: HookName.OnCritRoll, sourceIsSelf: true, when: { requireKind: "physical", sourceResource: { id: LINGXIAO_RESOURCE_ID, min: 5 } }, effects: [{ type: EffectType.ModifyChance, add: 0.05 }],
      }])],
    },
    {
      id: "lingxiao.node.guiyi.4.2", name: "剑息", pathId, layer: 4, slot: 2,
      description: "断尘三叠休息期间承伤降低10%。",
      passives: [addTakenPassive("lingxiao.passive.guiyi.guarded_rest", "剑息", 0.9, { requireStatusIds: [STATUS.Rest] })],
    },
    {
      id: "lingxiao.node.guiyi.4.3", name: "影守", pathId, layer: 4, slot: 3,
      description: "惊鸿状态同时提供5%物理减伤。",
      passives: [addTakenPassive("lingxiao.passive.guiyi.shadow_guard", "影守", 0.95, { requireKind: "physical", requireStatusIds: [STATUS.Shadow] })],
    },
    {
      id: "lingxiao.node.guiyi.5.1", name: "锋盛", pathId, layer: 5, slot: 1,
      description: "5点剑意以上再增伤5%。",
      passives: [addDamagePassive("lingxiao.passive.guiyi.flourish", "锋盛", 1.05, { sourceResource: { id: LINGXIAO_RESOURCE_ID, min: 5 } })],
    },
    {
      id: "lingxiao.node.guiyi.5.2", name: "势固", pathId, layer: 5, slot: 2,
      description: "5点剑意以上承伤降低5%。",
      passives: [addTakenPassive("lingxiao.passive.guiyi.steadfast", "势固", 0.95, { sourceResource: { id: LINGXIAO_RESOURCE_ID, min: 5 } })],
    },
    {
      id: "lingxiao.node.guiyi.5.3", name: "受锋", pathId, layer: 5, slot: 3,
      description: "每回合首次受到直接伤害增加1点剑意。",
      passives: [passive("lingxiao.passive.guiyi.receive_intent", "受锋", LINGXIAO_METHOD_ID.Waiting, [{
        on: HookName.OnBeHit, targetIsSelf: true, when: { oncePerRound: true }, aim: HookAim.Self,
        effects: [{ type: EffectType.ModifyResource, resourceId: LINGXIAO_RESOURCE_ID, amount: 1 }],
      }])],
    },
    {
      id: "lingxiao.node.guiyi.6.1", name: "连破", pathId, layer: 6, slot: 1,
      description: "8点剑意以上消耗3点并取消断尘三叠休息。",
      patches: [
        { skillId: LINGXIAO_SKILL_ID.Triple, operation: "removeEffectType", effectType: EffectType.SkipNextAction },
        { skillId: LINGXIAO_SKILL_ID.Triple, operation: "removeEffectType", effectType: EffectType.ApplyStatus },
        { skillId: LINGXIAO_SKILL_ID.Triple, operation: "appendEffect", effect: { type: EffectType.SkipNextAction, when: { sourceResource: { id: LINGXIAO_RESOURCE_ID, max: 7 } } } },
        { skillId: LINGXIAO_SKILL_ID.Triple, operation: "appendEffect", effect: { type: EffectType.ApplyStatus, statusId: STATUS.Rest, duration: 1, self: true, when: { sourceResource: { id: LINGXIAO_RESOURCE_ID, max: 7 } } } },
        { skillId: LINGXIAO_SKILL_ID.Triple, operation: "appendEffect", effect: { type: EffectType.ModifyResource, resourceId: LINGXIAO_RESOURCE_ID, amount: -3, when: { sourceResource: { id: LINGXIAO_RESOURCE_ID, min: 8 } } } },
      ],
    },
    {
      id: "lingxiao.node.guiyi.6.2", name: "无前", pathId, layer: 6, slot: 2,
      description: "5点剑意以上物理攻击忽略10%物防。",
      passives: [passive("lingxiao.passive.guiyi.unstoppable", "无前", LINGXIAO_METHOD_ID.Canon, [{
        on: HookName.OnDefenseIgnoreCalc, sourceIsSelf: true,
        when: { requireKind: "physical", sourceResource: { id: LINGXIAO_RESOURCE_ID, min: 5 } },
        effects: [{ type: EffectType.ModifyDefenseIgnore, add: 0.1 }],
      }])],
    },
    {
      id: "lingxiao.node.guiyi.6.3", name: "鸿意", pathId, layer: 6, slot: 3,
      description: "惊鸿掠影额外增加1点剑意。",
      patches: [{ skillId: LINGXIAO_SKILL_ID.ShadowStrike, operation: "appendEffect", effect: { type: EffectType.ModifyResource, resourceId: LINGXIAO_RESOURCE_ID, amount: 1 } }],
    },
    {
      id: "lingxiao.node.guiyi.7.1", name: "四象归锋", pathId, layer: 7, slot: 1,
      description: "11点剑意时断尘三叠增加第四段。",
      patches: [{ skillId: LINGXIAO_SKILL_ID.Triple, operation: "appendEffect", effect: { type: EffectType.PhysicalHit, coeff: 0.95, power: "floor(skillLevel * 0.5)", when: { sourceResource: { id: LINGXIAO_RESOURCE_ID, min: 11 } } } }],
    },
    {
      id: "lingxiao.node.guiyi.7.2", name: "一剑无双", pathId, layer: 7, slot: 2,
      description: "授予消耗全部剑意的终式万锋归一。", grantSkills: [guiyiUltimate],
    },
    {
      id: "lingxiao.node.guiyi.7.3", name: "剑意不绝", pathId, layer: 7, slot: 3,
      description: "11点剑意时再增伤10%，行动后失去1点剑意。",
      passives: [
        addDamagePassive("lingxiao.passive.guiyi.unending_damage", "剑意不绝·攻", 1.1, { sourceResource: { id: LINGXIAO_RESOURCE_ID, min: 11 } }),
        passive("lingxiao.passive.guiyi.unending_cost", "剑意不绝·耗", LINGXIAO_METHOD_ID.Canon, [{
          on: HookName.AfterAction, sourceIsSelf: true, when: { sourceResource: { id: LINGXIAO_RESOURCE_ID, min: 11 } }, aim: HookAim.Self,
          effects: [{ type: EffectType.ModifyResource, resourceId: LINGXIAO_RESOURCE_ID, amount: -1 }],
        }]),
      ],
    },
  ]
}

const guiyiFoundation: SectSkillDefV6[] = [
  passive("lingxiao.passive.guiyi.gain", "养意", LINGXIAO_METHOD_ID.Canon, [{
    on: HookName.AfterAction,
    sourceIsSelf: true,
    when: { skillIds: [LINGXIAO_SKILL_ID.Triple, LINGXIAO_SKILL_ID.Formation] },
    aim: HookAim.Self,
    effects: [{ type: EffectType.ModifyResource, resourceId: LINGXIAO_RESOURCE_ID, amount: 1 }],
  }]),
  passive("lingxiao.passive.guiyi.hit", "剑意初成", LINGXIAO_METHOD_ID.Shadow, [{
    on: HookName.OnHitRoll,
    sourceIsSelf: true,
    when: { requireKind: "physical", sourceResource: { id: LINGXIAO_RESOURCE_ID, min: 2 } },
    effects: [{ type: EffectType.ModifyChance, add: 0.1 }],
  }]),
  addDamagePassive("lingxiao.passive.guiyi.damage", "剑势大成", 1.05, {
    sourceResource: { id: LINGXIAO_RESOURCE_ID, min: 5 },
  }),
]

export const LINGXIAO_V6_DEFINITION: SectDefinitionV6 = {
  id: LINGXIAO_V6_ID,
  name: "红尘剑宗",
  methods: [
    { id: LINGXIAO_METHOD_ID.Canon, slot: 1, name: "《问剑证道总纲》", isPrimary: true, panel: panel("physicalAtk", "add", 0.5) },
    { id: LINGXIAO_METHOD_ID.SwordAura, slot: 2, name: "《剑煞破军录》", isPrimary: false, panel: panel("hit", "add", 0.5) },
    { id: LINGXIAO_METHOD_ID.Waiting, slot: 3, name: "《伏锋候时篇》", isPrimary: false, panel: panel("physicalDef", "add", 0.4) },
    { id: LINGXIAO_METHOD_ID.Shadow, slot: 4, name: "《惊鸿逐影诀》", isPrimary: false, panel: panel("speed", "add", 0.15) },
    { id: LINGXIAO_METHOD_ID.Formation, slot: 5, name: "《裂阵沉锋章》", isPrimary: false, panel: panel("maxHp", "add", 2) },
    { id: LINGXIAO_METHOD_ID.Clarity, slot: 6, name: "《澄神洗剑经》", isPrimary: false, panel: panel("sealResist", "add", 0.25) },
  ],
  skills: baseSkills,
  statuses,
  paths: [
    {
      id: LINGXIAO_PATH_ID.Zhanchen,
      name: "斩尘证道",
      nodes: zhanchenNodes(),
    },
    {
      id: LINGXIAO_PATH_ID.Guiyi,
      name: "万剑归一",
      foundationPassives: guiyiFoundation,
      grantSkills: [shadowStrike],
      resources: [{ id: LINGXIAO_RESOURCE_ID, name: "剑意", current: 0, max: 11 }],
      nodes: guiyiNodes(),
    },
  ],
}
