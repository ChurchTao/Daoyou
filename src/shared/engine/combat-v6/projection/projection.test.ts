import { describe, expect, it } from "vitest"
import type { Attributes } from "@shared/types/cultivator"
import type { CultivatorCondition } from "@shared/types/condition"
import {
  compileCharacterPanelV1,
  projectCultivatorBaseToCombatV6,
  type CultivatorBaseCombatInput,
} from "./index.ts"

const BASE_ATTRIBUTES: Attributes = {
  vitality: 10,
  strength: 10,
  spirit: 10,
  endurance: 10,
  speed: 10,
  willpower: 10,
}

function createCondition(hp: number, mp: number): CultivatorCondition {
  return {
    version: 1,
    resources: { hp: { current: hp }, mp: { current: mp } },
    gauges: { pillToxicity: 0 },
    tracks: {
      tempering: {
        vitality: { level: 0, progress: 0 },
        spirit: { level: 0, progress: 0 },
        wisdom: { level: 0, progress: 0 },
        speed: { level: 0, progress: 0 },
        willpower: { level: 0, progress: 0 },
      },
      marrowWash: { level: 0, progress: 0 },
    },
    counters: {
      longTermPillUsesByRealm: {},
      cultivationPillUsesByRealm: {},
      longevityPillUsesByRealm: {},
    },
    statuses: [],
    timestamps: {},
  }
}

function cultivator(
  overrides: Partial<CultivatorBaseCombatInput> = {},
): CultivatorBaseCombatInput {
  return {
    id: "cultivator-a",
    name: "甲",
    realm: "炼气",
    realm_stage: "初期",
    attributes: { ...BASE_ATTRIBUTES },
    ...overrides,
  }
}

describe("character_panel_v1", () => {
  it("matches the all-ten golden panel", () => {
    expect(compileCharacterPanelV1(BASE_ATTRIBUTES)).toEqual({
      physicalAtk: 75,
      magicAtk: 75,
      physicalDef: 27,
      magicDef: 27,
      maxHp: 630,
      maxMp: 340,
      speed: 10,
      hit: 90,
      dodge: 10,
      healPower: 12,
      sealHit: 5,
      sealResist: 5,
      critRate: 0.05,
      spellCritRate: 0.05,
      physicalFuryRate: 0,
    })
  })

  it("floors mixed attributes without mutating the input", () => {
    const attributes: Attributes = {
      vitality: 13.5,
      strength: 12.5,
      spirit: 11.5,
      endurance: 14.5,
      speed: 16.75,
      willpower: 15.5,
    }
    const before = { ...attributes }
    const panel = compileCharacterPanelV1(attributes)

    expect(panel).toMatchObject({
      physicalAtk: 83,
      magicAtk: 80,
      physicalDef: 35,
      magicDef: 37,
      maxHp: 713,
      maxMp: 401,
      speed: 16,
      hit: 96,
      dodge: 16,
      healPower: 18,
      sealHit: 5,
      sealResist: 7,
    })
    expect(attributes).toEqual(before)
  })
})

describe("base cultivator projection", () => {
  it("projects full resources without condition and keeps build fields empty", () => {
    const result = projectCultivatorBaseToCombatV6({
      cultivator: cultivator(),
      side: 0,
      slot: 0,
      resourcePolicy: "full",
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.unit).toMatchObject({
      id: "cultivator-a",
      kind: "player",
      level: 5,
      attrs: {
        hp: 630,
        maxHp: 630,
        mp: 340,
        maxMp: 340,
        attackCultivate: 0,
        defenseCultivate: 0,
        spellCultivate: 0,
        resistSpellCultivate: 0,
      },
      skills: [],
      passives: [],
      skillLevels: {},
      skillOverrides: [],
      tags: [],
    })
    expect(result.versions).toEqual({
      engineVersion: "combat-v6",
      rulesetVersion: "daoyou_rules_v1",
      contentVersion: "empty_content_v1",
      projectionVersion: "character_panel_v1",
    })
  })

  it("maps realm endpoints to combat levels 5 and 180", () => {
    const first = projectCultivatorBaseToCombatV6({
      cultivator: cultivator(),
      side: 0,
      slot: 0,
      resourcePolicy: "full",
    })
    const last = projectCultivatorBaseToCombatV6({
      cultivator: cultivator({ realm: "渡劫", realm_stage: "圆满" }),
      side: 1,
      slot: 0,
      resourcePolicy: "full",
    })

    expect(first.ok && first.unit.level).toBe(5)
    expect(last.ok && last.unit.level).toBe(180)
  })

  it("uses persistent current resources, ignores old maxima, clamps, and warns about statuses", () => {
    const condition = createCondition(9999, -10)
    condition.resources.hp.max = 9999
    condition.resources.mp.max = 9999
    condition.statuses.push({
      key: "weakness",
      stacks: 1,
      source: "battle",
      duration: { kind: "until_removed" },
      createdAt: "2026-09-02T00:00:00.000Z",
      updatedAt: "2026-09-02T00:00:00.000Z",
    })

    const result = projectCultivatorBaseToCombatV6({
      cultivator: cultivator({ condition }),
      side: 0,
      slot: 0,
      resourcePolicy: "persistent",
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.unit.attrs).toMatchObject({ hp: 630, maxHp: 630, mp: 0, maxMp: 340 })
    expect(result.diagnostics.map((item) => item.code)).toEqual([
      "PERSISTENT_STATUSES_NOT_PROJECTED",
      "RESOURCE_CLAMPED",
      "RESOURCE_CLAMPED",
    ])
  })

  it("rejects missing, non-finite, and depleted persistent resources", () => {
    const missing = projectCultivatorBaseToCombatV6({
      cultivator: cultivator(),
      side: 0,
      slot: 0,
      resourcePolicy: "persistent",
    })
    const invalid = projectCultivatorBaseToCombatV6({
      cultivator: cultivator({ condition: createCondition(Number.NaN, 10) }),
      side: 0,
      slot: 0,
      resourcePolicy: "persistent",
    })
    const depleted = projectCultivatorBaseToCombatV6({
      cultivator: cultivator({ condition: createCondition(0, 10) }),
      side: 0,
      slot: 0,
      resourcePolicy: "persistent",
    })

    expect(missing.ok).toBe(false)
    expect(missing.diagnostics.map((item) => item.code)).toContain("MISSING_PERSISTENT_RESOURCES")
    expect(invalid.ok).toBe(false)
    expect(invalid.diagnostics.map((item) => item.code)).toContain("INVALID_PERSISTENT_RESOURCE")
    expect(depleted.ok).toBe(false)
    expect(depleted.diagnostics.map((item) => item.code)).toContain("PERSISTENT_HP_DEPLETED")
  })

  it("rejects non-finite or negative base attributes", () => {
    const result = projectCultivatorBaseToCombatV6({
      cultivator: cultivator({
        attributes: { ...BASE_ATTRIBUTES, strength: Number.NaN, speed: -1 },
      }),
      side: 0,
      slot: 0,
      resourcePolicy: "full",
    })

    expect(result.ok).toBe(false)
    expect(result.diagnostics.filter((item) => item.code === "INVALID_BASE_ATTRIBUTE")).toHaveLength(2)
  })
})
