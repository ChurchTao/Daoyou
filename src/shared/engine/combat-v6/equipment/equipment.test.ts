import { describe, expect, it } from "vitest"
import {
  DAO_EQUIPMENT_GENERATOR_VERSION,
  DAO_EQUIPMENT_TEMPLATE_ID,
  DAO_EQUIPMENT_TEMPLATES_V1,
  DAO_FORMATION_INSCRIPTION_ID,
  DAO_FORMATION_INSCRIPTIONS_V1,
  compileDaoEquipmentLoadoutV1,
  daoEquipmentGenerationRulesV1,
  generateDaoEquipmentV1,
  validateDaoEquipmentInstanceV1,
  type DaoEquipmentInstanceV1,
} from "./index.ts"

const CREATED_AT = "2026-09-03T00:00:00.000Z"

function generate(
  templateId: string,
  equipmentLevel = 180,
  seed = 123,
): DaoEquipmentInstanceV1 {
  const result = generateDaoEquipmentV1({
    id: `${templateId}-${equipmentLevel}-${seed}`,
    createdAt: CREATED_AT,
    seed,
    templateId,
    equipmentLevel,
    generatorVersion: DAO_EQUIPMENT_GENERATOR_VERSION,
  })
  if (!result.ok) throw new Error("测试道装生成失败")
  return result.instance
}

describe("道装确定性生成", () => {
  it("锁定六模板在10级和180级的器胚黄金值", () => {
    const expected = [
      [[8, 2, 5], [142, 51, 98]],
      [[1, 21], [30, 392]],
      [[3, 2], [59, 48]],
      [[3, 2], [59, 51]],
      [[90, 1], [1615, 19]],
      [[5, 2, 0], [83, 49, 14]],
    ]
    DAO_EQUIPMENT_TEMPLATES_V1.forEach((template, index) => {
      expect(generate(template.id, 10).baseStats.map((roll) => roll.value)).toEqual(expected[index][0])
      expect(generate(template.id, 180).baseStats.map((roll) => roll.value)).toEqual(expected[index][1])
    })
  })

  it("相同完整输入完全相同，且生成不修改输入", () => {
    const input = {
      id: "weapon-1",
      createdAt: CREATED_AT,
      seed: 1,
      templateId: DAO_EQUIPMENT_TEMPLATE_ID.Weapon,
      equipmentLevel: 180,
      generatorVersion: DAO_EQUIPMENT_GENERATOR_VERSION,
    } as const
    const before = structuredClone(input)
    expect(generateDaoEquipmentV1(input)).toEqual(generateDaoEquipmentV1(input))
    expect(input).toEqual(before)
  })

  it("seed、模板和器阶参与生成结果", () => {
    const base = generate(DAO_EQUIPMENT_TEMPLATE_ID.Weapon, 180, 1)
    expect(generate(DAO_EQUIPMENT_TEMPLATE_ID.Weapon, 180, 2).baseStats).not.toEqual(base.baseStats)
    expect(generate(DAO_EQUIPMENT_TEMPLATE_ID.Armor, 180, 1).baseStats).not.toEqual(base.baseStats)
    expect(generate(DAO_EQUIPMENT_TEMPLATE_ID.Weapon, 170, 1).baseStats).not.toEqual(base.baseStats)
  })

  it("锁定附灵条数阈值、范围和加权不放回结果", () => {
    expect([
      daoEquipmentGenerationRulesV1.bonusCount(0.499999),
      daoEquipmentGenerationRulesV1.bonusCount(0.5),
      daoEquipmentGenerationRulesV1.bonusCount(0.899999),
      daoEquipmentGenerationRulesV1.bonusCount(0.9),
    ]).toEqual([0, 1, 1, 2])
    expect(daoEquipmentGenerationRulesV1.attributeRange(180)).toEqual({ min: 14, max: 25 })
    expect(generate(DAO_EQUIPMENT_TEMPLATE_ID.Weapon, 180, 1).attributeBonuses).toEqual([
      { attr: "willpower", value: 17 },
      { attr: "spirit", value: 22 },
    ])
  })

  it("拒绝未知模板、非法器阶、seed和生成版本", () => {
    const invalid = generateDaoEquipmentV1({
      id: "",
      createdAt: "",
      seed: -1,
      templateId: "missing",
      equipmentLevel: 15,
      generatorVersion: "missing" as typeof DAO_EQUIPMENT_GENERATOR_VERSION,
    })
    expect(invalid.ok).toBe(false)
    expect(invalid.diagnostics.map((item) => item.code)).toEqual(expect.arrayContaining([
      "UNKNOWN_EQUIPMENT_TEMPLATE",
      "INVALID_EQUIPMENT_LEVEL",
      "INVALID_EQUIPMENT_IDENTITY",
    ]))
  })
})

describe("道装实例、装配和灵纹校验", () => {
  it("拒绝缺失、额外、越界、非有限和错部位器胚", () => {
    const source = generate(DAO_EQUIPMENT_TEMPLATE_ID.Weapon)
    const cases = [
      { ...source, baseStats: source.baseStats.slice(0, 2) },
      { ...source, baseStats: [...source.baseStats, { attr: "speed", value: 1 }] },
      { ...source, baseStats: source.baseStats.map((roll, index) => index === 0 ? { ...roll, value: Infinity } : roll) },
      { ...source, baseStats: source.baseStats.map((roll, index) => index === 0 ? { ...roll, value: 9999 } : roll) },
      { ...source, slot: "armor" },
    ] as DaoEquipmentInstanceV1[]
    expect(cases.slice(0, 4).every((item) => validateDaoEquipmentInstanceV1(item).some((d) => d.code === "INVALID_EQUIPMENT_BASE_STAT"))).toBe(true)
    expect(validateDaoEquipmentInstanceV1(cases[4]).map((item) => item.code)).toContain("EQUIPMENT_SLOT_MISMATCH")
  })

  it("拒绝附灵数量、重复、非法属性和越界数值", () => {
    const source = generate(DAO_EQUIPMENT_TEMPLATE_ID.Weapon)
    const invalidBonuses = [
      [{ attr: "strength", value: 20 }, { attr: "strength", value: 20 }],
      [{ attr: "luck", value: 20 }],
      [{ attr: "strength", value: 999 }],
      [{ attr: "strength", value: 20 }, { attr: "spirit", value: 20 }, { attr: "speed", value: 20 }],
    ]
    for (const attributeBonuses of invalidBonuses) {
      const instance = { ...source, attributeBonuses } as DaoEquipmentInstanceV1
      expect(validateDaoEquipmentInstanceV1(instance).map((item) => item.code)).toContain("INVALID_EQUIPMENT_ATTRIBUTE_BONUS")
    }
  })

  it("拒绝品质评分、运行时对象、淬炼和未实现的器蕴器诀", () => {
    const source = generate(DAO_EQUIPMENT_TEMPLATE_ID.Weapon) as DaoEquipmentInstanceV1 & Record<string, unknown>
    for (const field of ["quality", "powerScore", "battleProjection", "SkillDef", "tempering"]) {
      const invalid = { ...source, [field]: {} }
      expect(validateDaoEquipmentInstanceV1(invalid).map((item) => item.code)).toContain("FORBIDDEN_EQUIPMENT_FIELD")
    }
    expect(validateDaoEquipmentInstanceV1({ ...source, essenceIds: ["essence"] }).map((item) => item.code)).toContain("UNSUPPORTED_EQUIPMENT_CONTENT")
    expect(validateDaoEquipmentInstanceV1({ ...source, artId: "art" }).map((item) => item.code)).toContain("UNSUPPORTED_EQUIPMENT_CONTENT")
  })

  it("拒绝重复实例、错槽、等级不足与未知模板", () => {
    const weapon = generate(DAO_EQUIPMENT_TEMPLATE_ID.Weapon)
    const armor = { ...weapon, slot: "armor" } as DaoEquipmentInstanceV1
    const result = compileDaoEquipmentLoadoutV1({ weapon, armor }, 10)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.diagnostics.map((item) => item.code)).toEqual(expect.arrayContaining([
      "DUPLICATE_EQUIPMENT_INSTANCE",
      "EQUIPMENT_SLOT_MISMATCH",
      "EQUIPMENT_LEVEL_REQUIREMENT",
    ]))
    const unknown = validateDaoEquipmentInstanceV1({ ...weapon, templateId: "missing" })
    expect(unknown.map((item) => item.code)).toContain("UNKNOWN_EQUIPMENT_TEMPLATE")
  })

  it("九种灵纹逐项产生正确贡献", () => {
    for (const definition of DAO_FORMATION_INSCRIPTIONS_V1) {
      const template = DAO_EQUIPMENT_TEMPLATES_V1.find((item) => item.slot === definition.allowedSlots[0])!
      const base = generate(template.id)
      const plain = compileDaoEquipmentLoadoutV1({ [base.slot]: base }, 180)
      const inscribed = compileDaoEquipmentLoadoutV1({
        [base.slot]: { ...base, formationInscription: { patternId: definition.id, level: 2 } },
      }, 180)
      expect(plain.ok && inscribed.ok).toBe(true)
      if (!plain.ok || !inscribed.ok) continue
      const plainValue = plain.projection.panel.find((roll) => roll.attr === definition.attr)?.value ?? 0
      const value = inscribed.projection.panel.find((roll) => roll.attr === definition.attr)?.value ?? 0
      expect(value - plainValue).toBe(definition.valuePerLevel * 2)
    }
  })

  it("拒绝未知、错部位和越级灵纹", () => {
    const weapon = generate(DAO_EQUIPMENT_TEMPLATE_ID.Weapon, 10)
    const unknown = { ...weapon, formationInscription: { patternId: "missing", level: 1 } }
    const wrongSlot = { ...weapon, formationInscription: { patternId: DAO_FORMATION_INSCRIPTION_ID.Liuyun, level: 1 } }
    const overLevel = { ...weapon, formationInscription: { patternId: DAO_FORMATION_INSCRIPTION_ID.Xuanfeng, level: 2 } }
    expect(validateDaoEquipmentInstanceV1(unknown).map((item) => item.code)).toContain("UNKNOWN_FORMATION_INSCRIPTION")
    expect(validateDaoEquipmentInstanceV1(wrongSlot).map((item) => item.code)).toContain("FORMATION_INSCRIPTION_SLOT_MISMATCH")
    expect(validateDaoEquipmentInstanceV1(overLevel).map((item) => item.code)).toContain("FORMATION_INSCRIPTION_LEVEL_INVALID")
  })
})
