import type {
  DaoEquipmentTemplateV1,
  DaoFormationInscriptionDefV1,
} from "./types.ts"

export const DAO_EQUIPMENT_TEMPLATE_ID = {
  Weapon: "dao_equipment.standard.weapon.v1",
  Head: "dao_equipment.standard.head.v1",
  Armor: "dao_equipment.standard.armor.v1",
  Necklace: "dao_equipment.standard.necklace.v1",
  Belt: "dao_equipment.standard.belt.v1",
  Footwear: "dao_equipment.standard.footwear.v1",
} as const

export const DAO_EQUIPMENT_TEMPLATES_V1 = [
  {
    id: DAO_EQUIPMENT_TEMPLATE_ID.Weapon,
    name: "法兵",
    slot: "weapon",
    baseStats: [
      { attr: "physicalAtk", minCoefficient: 0.55, maxCoefficient: 0.85 },
      { attr: "magicAtk", minCoefficient: 0.25, maxCoefficient: 0.45 },
      { attr: "hit", minCoefficient: 0.4, maxCoefficient: 0.7 },
    ],
    favoredAttributes: ["strength", "spirit", "willpower"],
  },
  {
    id: DAO_EQUIPMENT_TEMPLATE_ID.Head,
    name: "法冠",
    slot: "head",
    baseStats: [
      { attr: "physicalDef", minCoefficient: 0.12, maxCoefficient: 0.18 },
      { attr: "maxMp", minCoefficient: 2, maxCoefficient: 3 },
    ],
    favoredAttributes: ["vitality", "willpower", "spirit"],
  },
  {
    id: DAO_EQUIPMENT_TEMPLATE_ID.Armor,
    name: "法衣",
    slot: "armor",
    baseStats: [
      { attr: "physicalDef", minCoefficient: 0.25, maxCoefficient: 0.35 },
      { attr: "magicDef", minCoefficient: 0.25, maxCoefficient: 0.35 },
    ],
    favoredAttributes: ["vitality", "endurance", "strength"],
  },
  {
    id: DAO_EQUIPMENT_TEMPLATE_ID.Necklace,
    name: "灵佩",
    slot: "necklace",
    baseStats: [
      { attr: "magicDef", minCoefficient: 0.25, maxCoefficient: 0.35 },
      { attr: "magicAtk", minCoefficient: 0.25, maxCoefficient: 0.45 },
    ],
    favoredAttributes: ["spirit", "willpower", "vitality"],
  },
  {
    id: DAO_EQUIPMENT_TEMPLATE_ID.Belt,
    name: "腰封",
    slot: "belt",
    baseStats: [
      { attr: "maxHp", minCoefficient: 7, maxCoefficient: 9.5 },
      { attr: "physicalDef", minCoefficient: 0.1, maxCoefficient: 0.16 },
    ],
    favoredAttributes: ["vitality", "endurance", "speed"],
  },
  {
    id: DAO_EQUIPMENT_TEMPLATE_ID.Footwear,
    name: "云履",
    slot: "footwear",
    baseStats: [
      { attr: "speed", minCoefficient: 0.3, maxCoefficient: 0.5 },
      { attr: "dodge", minCoefficient: 0.25, maxCoefficient: 0.4 },
      { attr: "physicalDef", minCoefficient: 0.06, maxCoefficient: 0.1 },
    ],
    favoredAttributes: ["speed", "willpower", "endurance"],
  },
] as const satisfies readonly DaoEquipmentTemplateV1[]

export const DAO_FORMATION_INSCRIPTION_ID = {
  Xuanfeng: "dao_inscription.xuanfeng",
  Lingyao: "dao_inscription.lingyao",
  Jingang: "dao_inscription.jingang",
  Xuanjia: "dao_inscription.xuanjia",
  Changsheng: "dao_inscription.changsheng",
  Canghai: "dao_inscription.canghai",
  Jifeng: "dao_inscription.jifeng",
  Dongming: "dao_inscription.dongming",
  Liuyun: "dao_inscription.liuyun",
} as const

export const DAO_FORMATION_INSCRIPTIONS_V1 = [
  { id: DAO_FORMATION_INSCRIPTION_ID.Xuanfeng, name: "玄锋阵纹", attr: "physicalAtk", valuePerLevel: 6, allowedSlots: ["weapon", "head"] },
  { id: DAO_FORMATION_INSCRIPTION_ID.Lingyao, name: "灵曜阵纹", attr: "magicAtk", valuePerLevel: 6, allowedSlots: ["weapon", "necklace"] },
  { id: DAO_FORMATION_INSCRIPTION_ID.Jingang, name: "金刚阵纹", attr: "physicalDef", valuePerLevel: 4, allowedSlots: ["head", "armor", "belt", "footwear"] },
  { id: DAO_FORMATION_INSCRIPTION_ID.Xuanjia, name: "玄甲阵纹", attr: "magicDef", valuePerLevel: 4, allowedSlots: ["armor", "necklace"] },
  { id: DAO_FORMATION_INSCRIPTION_ID.Changsheng, name: "长生阵纹", attr: "maxHp", valuePerLevel: 80, allowedSlots: ["belt"] },
  { id: DAO_FORMATION_INSCRIPTION_ID.Canghai, name: "沧海阵纹", attr: "maxMp", valuePerLevel: 40, allowedSlots: ["head"] },
  { id: DAO_FORMATION_INSCRIPTION_ID.Jifeng, name: "疾风阵纹", attr: "speed", valuePerLevel: 4, allowedSlots: ["footwear"] },
  { id: DAO_FORMATION_INSCRIPTION_ID.Dongming, name: "洞明阵纹", attr: "hit", valuePerLevel: 6, allowedSlots: ["weapon"] },
  { id: DAO_FORMATION_INSCRIPTION_ID.Liuyun, name: "流云阵纹", attr: "dodge", valuePerLevel: 6, allowedSlots: ["footwear"] },
] as const satisfies readonly DaoFormationInscriptionDefV1[]

export function daoEquipmentTemplateOf(id: string): DaoEquipmentTemplateV1 | undefined {
  return DAO_EQUIPMENT_TEMPLATES_V1.find((template) => template.id === id)
}

export function daoFormationInscriptionOf(
  id: string,
): DaoFormationInscriptionDefV1 | undefined {
  return DAO_FORMATION_INSCRIPTIONS_V1.find((pattern) => pattern.id === id)
}
