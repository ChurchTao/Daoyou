import {
  EffectType,
  HookAim,
  HookName,
  SkillTag,
  StatusCategory,
  TargetMode,
  TargetSide,
  type SkillDef,
  type StatusDef,
} from "../core/index.ts"
import type {
  DaoEquipmentArtDefV1,
  DaoEquipmentEssenceDefV1,
} from "./types.ts"

export const DAO_RAGE_RESOURCE_ID = "combat.resource.rage" as const

export const DAO_EQUIPMENT_ESSENCE_ID = {
  Cangfeng: "dao_equipment.essence.cangfeng",
  Ningshen: "dao_equipment.essence.ningshen",
  Pojin: "dao_equipment.essence.pojin",
  Dinghun: "dao_equipment.essence.dinghun",
  Qingling: "dao_equipment.essence.qingling",
  Jiangang: "dao_equipment.essence.jiangang",
  Guiyuan: "dao_equipment.essence.guiyuan",
} as const

export const DAO_EQUIPMENT_ART_ID = {
  Huiyuan: "dao_equipment.art.huiyuan",
  Qingxin: "dao_equipment.art.qingxin",
  Juling: "dao_equipment.art.juling",
  Huanhun: "dao_equipment.art.huanhun",
  Jingang: "dao_equipment.art.jingang",
  Xuanling: "dao_equipment.art.xuanling",
  Pofa: "dao_equipment.art.pofa",
  Zhuxian: "dao_equipment.art.zhuxian",
  Tianlei: "dao_equipment.art.tianlei",
} as const

export const DAO_EQUIPMENT_ART_SKILL_ID = {
  Huiyuan: "dao_equipment.skill.huiyuan",
  Qingxin: "dao_equipment.skill.qingxin",
  Juling: "dao_equipment.skill.juling",
  Huanhun: "dao_equipment.skill.huanhun",
  Jingang: "dao_equipment.skill.jingang",
  Xuanling: "dao_equipment.skill.xuanling",
  Pofa: "dao_equipment.skill.pofa",
  Zhuxian: "dao_equipment.skill.zhuxian",
  Tianlei: "dao_equipment.skill.tianlei",
} as const

export const DAO_EQUIPMENT_SPECIAL_STATUS_ID = {
  Jingang: "dao_equipment.status.jingang_guard",
  Xuanling: "dao_equipment.status.xuanling_guard",
} as const

const jingangStatus: StatusDef = {
  id: DAO_EQUIPMENT_SPECIAL_STATUS_ID.Jingang,
  name: "金刚护法",
  kind: "dao_equipment.guard.physical",
  category: StatusCategory.Buff,
  attrMods: { physicalDef: "floor(target.physicalDef * 0.1)" },
}

const xuanlingStatus: StatusDef = {
  id: DAO_EQUIPMENT_SPECIAL_STATUS_ID.Xuanling,
  name: "玄灵护法",
  kind: "dao_equipment.guard.spell",
  category: StatusCategory.Buff,
  attrMods: { magicDef: "floor(target.magicDef * 0.1)" },
}

function artSkill(
  id: string,
  name: string,
  rageCost: number,
  skill: Omit<SkillDef, "id" | "name" | "resourceCosts">,
): SkillDef {
  return {
    id,
    name,
    resourceCosts: [{ resourceId: DAO_RAGE_RESOURCE_ID, amount: rageCost }],
    ...skill,
  }
}

export const DAO_EQUIPMENT_ESSENCES_V1: readonly DaoEquipmentEssenceDefV1[] = [
  { id: DAO_EQUIPMENT_ESSENCE_ID.Cangfeng, name: "藏锋", stackPolicy: "stack", panel: [{ attr: "critRate", mode: "add", value: 0.03 }] },
  { id: DAO_EQUIPMENT_ESSENCE_ID.Ningshen, name: "凝神", stackPolicy: "stack", panel: [{ attr: "spellCritRate", mode: "add", value: 0.03 }] },
  { id: DAO_EQUIPMENT_ESSENCE_ID.Pojin, name: "破禁", stackPolicy: "stack", panel: [{ attr: "sealHit", mode: "add", value: 20 }] },
  { id: DAO_EQUIPMENT_ESSENCE_ID.Dinghun, name: "定魂", stackPolicy: "stack", panel: [{ attr: "sealResist", mode: "add", value: 20 }] },
  { id: DAO_EQUIPMENT_ESSENCE_ID.Qingling, name: "轻灵", stackPolicy: "unique", requiredLevelOffset: -10 },
  { id: DAO_EQUIPMENT_ESSENCE_ID.Jiangang, name: "激昂", stackPolicy: "highest", resourceGainFactors: { [DAO_RAGE_RESOURCE_ID]: 1.2 } },
  { id: DAO_EQUIPMENT_ESSENCE_ID.Guiyuan, name: "归元", stackPolicy: "highest", resourceCostFactors: { [DAO_RAGE_RESOURCE_ID]: 0.8 } },
]

export const DAO_EQUIPMENT_ARTS_V1: readonly DaoEquipmentArtDefV1[] = [
  {
    id: DAO_EQUIPMENT_ART_ID.Huiyuan,
    name: "回元诀",
    rageCost: 40,
    skill: artSkill(DAO_EQUIPMENT_ART_SKILL_ID.Huiyuan, "回元诀", 40, {
      tags: [SkillTag.Support],
      targeting: { side: TargetSide.Ally, count: 1 },
      effects: [{ type: EffectType.Heal, power: "target.maxHp * 0.25" }],
    }),
  },
  {
    id: DAO_EQUIPMENT_ART_ID.Qingxin,
    name: "清心诀",
    rageCost: 60,
    skill: artSkill(DAO_EQUIPMENT_ART_SKILL_ID.Qingxin, "清心诀", 60, {
      tags: [SkillTag.Support],
      targeting: { side: TargetSide.Ally, count: 1 },
      effects: [{ type: EffectType.Dispel, categories: [StatusCategory.Control] }],
    }),
  },
  {
    id: DAO_EQUIPMENT_ART_ID.Juling,
    name: "聚灵诀",
    rageCost: 50,
    skill: artSkill(DAO_EQUIPMENT_ART_SKILL_ID.Juling, "聚灵诀", 50, {
      tags: [SkillTag.Support],
      targeting: { side: TargetSide.Ally, count: 1 },
      effects: [{ type: EffectType.RestoreMp, power: "target.maxMp * 0.25" }],
    }),
  },
  {
    id: DAO_EQUIPMENT_ART_ID.Huanhun,
    name: "还魂诀",
    rageCost: 100,
    skill: artSkill(DAO_EQUIPMENT_ART_SKILL_ID.Huanhun, "还魂诀", 100, {
      tags: [SkillTag.Support],
      targeting: { side: TargetSide.Ally, count: 1, includeDowned: true },
      effects: [{ type: EffectType.Revive, hpRatio: 0.2 }],
    }),
  },
  {
    id: DAO_EQUIPMENT_ART_ID.Jingang,
    name: "金刚护法",
    rageCost: 80,
    skill: artSkill(DAO_EQUIPMENT_ART_SKILL_ID.Jingang, "金刚护法", 80, {
      tags: [SkillTag.Support],
      targeting: { side: TargetSide.Ally, mode: TargetMode.All },
      effects: [{ type: EffectType.ApplyStatus, statusId: jingangStatus.id, duration: 3 }],
    }),
    statusDefs: [jingangStatus],
  },
  {
    id: DAO_EQUIPMENT_ART_ID.Xuanling,
    name: "玄灵护法",
    rageCost: 80,
    skill: artSkill(DAO_EQUIPMENT_ART_SKILL_ID.Xuanling, "玄灵护法", 80, {
      tags: [SkillTag.Support],
      targeting: { side: TargetSide.Ally, mode: TargetMode.All },
      effects: [{ type: EffectType.ApplyStatus, statusId: xuanlingStatus.id, duration: 3 }],
    }),
    statusDefs: [xuanlingStatus],
  },
  {
    id: DAO_EQUIPMENT_ART_ID.Pofa,
    name: "破法诀",
    rageCost: 70,
    skill: artSkill(DAO_EQUIPMENT_ART_SKILL_ID.Pofa, "破法诀", 70, {
      tags: [SkillTag.Support],
      targeting: { side: TargetSide.Enemy, count: 1 },
      effects: [{ type: EffectType.Dispel, categories: [StatusCategory.Buff] }],
    }),
  },
  {
    id: DAO_EQUIPMENT_ART_ID.Zhuxian,
    name: "诛仙式",
    rageCost: 120,
    skill: artSkill(DAO_EQUIPMENT_ART_SKILL_ID.Zhuxian, "诛仙式", 120, {
      tags: [SkillTag.Physical],
      targeting: { side: TargetSide.Enemy, count: 1 },
      effects: [{ type: EffectType.PhysicalHit, coeff: 1.5, defenseIgnore: 0.1 }],
    }),
  },
  {
    id: DAO_EQUIPMENT_ART_ID.Tianlei,
    name: "天雷引",
    rageCost: 120,
    skill: artSkill(DAO_EQUIPMENT_ART_SKILL_ID.Tianlei, "天雷引", 120, {
      tags: [SkillTag.Spell],
      targeting: { side: TargetSide.Enemy, mode: TargetMode.Fill, count: 3 },
      effects: [{ type: EffectType.SpellHit, coeff: 0.85 }],
    }),
  },
]

export const DAO_RAGE_PASSIVE_ID = {
  Base: "dao_equipment.passive.rage_gain",
  Excited: "dao_equipment.passive.rage_gain_excited",
} as const

export function createDaoRageGainPassive(factor: number): SkillDef {
  const excited = factor > 1
  return {
    id: excited ? DAO_RAGE_PASSIVE_ID.Excited : DAO_RAGE_PASSIVE_ID.Base,
    name: excited ? "激昂战意" : "战意积蓄",
    tags: [SkillTag.Passive],
    targeting: { side: TargetSide.Self },
    effects: [],
    hooks: [
      {
        on: HookName.OnBeHit,
        sourceIsSelf: true,
        aim: HookAim.Self,
        effects: [
          {
            type: EffectType.ModifyResource,
            resourceId: DAO_RAGE_RESOURCE_ID,
            amount: `min(20, max(1, floor(floor(hpDamage / target.maxHp * 100) * ${factor})))`,
            maxGainPerAction: 30,
          },
        ],
      },
    ],
  }
}

export function daoEquipmentEssenceOf(id: string): DaoEquipmentEssenceDefV1 | undefined {
  return DAO_EQUIPMENT_ESSENCES_V1.find((definition) => definition.id === id)
}

export function daoEquipmentArtOf(id: string): DaoEquipmentArtDefV1 | undefined {
  return DAO_EQUIPMENT_ARTS_V1.find((definition) => definition.id === id)
}
