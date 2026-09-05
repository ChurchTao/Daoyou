import { describe, expect, it } from "vitest"
import type { Attributes } from "@shared/types/cultivator"
import type { CultivatorCondition } from "@shared/types/condition"
import {
  COMBAT_V6_PHASE_4A_VERSIONS,
  CommandType,
  DAO_EQUIPMENT_GENERATOR_VERSION,
  DAO_EQUIPMENT_TEMPLATE_ID,
  DAO_FORMATION_INSCRIPTION_ID,
  EventType,
  LINGXIAO_PATH_ID,
  LINGXIAO_V6_DEFINITION,
  compareDaoEquipmentLoadoutsV1,
  createBattle,
  daoyouDeterministicRuleset,
  generateDaoEquipmentV1,
  projectCultivatorWithEquipmentToCombatV6,
  type CombatV6ProjectionResult,
  type DaoEquipmentInstanceV1,
  type DaoEquipmentLoadoutV1,
  type SectCombatProgressV6,
  type SkillDef,
  type StatusDef,
} from "./index.ts"

const ATTRIBUTES: Attributes = {
  vitality: 10,
  strength: 10,
  spirit: 10,
  endurance: 10,
  speed: 10,
  willpower: 10,
}

function condition(hp = 500, mp = 340): CultivatorCondition {
  return {
    version: 1,
    resources: { hp: { current: hp }, mp: { current: mp } },
    gauges: { pillToxicity: 0 },
    tracks: {
      bodyCultivation: {
        version: 1,
        realm: "bronze_skin",
        tracks: {
          skin: { level: 10, progress: 0 },
          sinew_bone: { level: 10, progress: 0 },
          organs: { level: 10, progress: 0 },
          qi_blood: { level: 10, progress: 0 },
          primordial_spirit: { level: 10, progress: 0 },
        },
        milestones: {},
      },
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

function sect(nodeIds: string[] = []): SectCombatProgressV6 {
  return {
    version: 1,
    sectId: "lingxiao",
    methods: Object.fromEntries(LINGXIAO_V6_DEFINITION.methods.map((method) => [method.id, 180])),
    meridianDepth: nodeIds.length > 0 ? 1 : 0,
    activePathId: LINGXIAO_PATH_ID.Zhanchen,
    meridianLoadouts: [
      { pathId: LINGXIAO_PATH_ID.Zhanchen, nodeIds, revision: 1 },
      { pathId: LINGXIAO_PATH_ID.Guiyi, nodeIds: [], revision: 1 },
    ],
  }
}

function generated(templateId: string, seed = 123): DaoEquipmentInstanceV1 {
  const result = generateDaoEquipmentV1({
    id: `${templateId}-${seed}`,
    createdAt: "2026-09-03T00:00:00.000Z",
    seed,
    templateId,
    equipmentLevel: 180,
    generatorVersion: DAO_EQUIPMENT_GENERATOR_VERSION,
  })
  if (!result.ok) throw new Error("测试道装生成失败")
  return result.instance
}

function belt(): DaoEquipmentInstanceV1 {
  return {
    ...generated(DAO_EQUIPMENT_TEMPLATE_ID.Belt),
    attributeBonuses: [{ attr: "vitality", value: 20 }],
    formationInscription: {
      patternId: DAO_FORMATION_INSCRIPTION_ID.Changsheng,
      level: 1,
    },
  }
}

function input(
  equipment: DaoEquipmentLoadoutV1,
  resourcePolicy: "full" | "persistent" = "full",
  hp = 500,
) {
  return {
    cultivator: {
      id: "left",
      name: "left",
      realm: "渡劫" as const,
      realm_stage: "圆满" as const,
      attributes: { ...ATTRIBUTES },
      condition: condition(hp),
    },
    side: 0 as const,
    slot: 0,
    resourcePolicy,
    sect: sect(["lingxiao.node.zhanchen.1.3"]),
    equipment,
  }
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  return [...new Map(items.map((item) => [item.id, item])).values()]
}

describe("combat-v6 Phase 4A 道装纵切", () => {
  it("按附灵、裸身、生命根基、固定道装、宗门比例的顺序投影", () => {
    const payload = input({ belt: belt() })
    const before = structuredClone(payload)
    const result = projectCultivatorWithEquipmentToCombatV6(payload)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.versions).toEqual(COMBAT_V6_PHASE_4A_VERSIONS)
    expect(result.unit.attrs).toMatchObject({
      maxHp: 3230,
      hp: 3230,
      physicalDef: 118,
      physicalAtk: 165,
      attackCultivate: 10,
    })
    expect(payload).toEqual(before)
  })

  it("空装配合法且不改变Phase 3同序内容的黄金面板", () => {
    const result = projectCultivatorWithEquipmentToCombatV6(input({}))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.unit.attrs).toMatchObject({ maxHp: 1051, hp: 1051, physicalAtk: 165 })
  })

  it("persistent 不因装备增加上限自动回血，降低上限时最终夹取", () => {
    const equipped = projectCultivatorWithEquipmentToCombatV6(input({ belt: belt() }, "persistent", 3000))
    const removed = projectCultivatorWithEquipmentToCombatV6(input({}, "persistent", 3000))
    expect(equipped.ok && equipped.unit.attrs.hp).toBe(3000)
    expect(removed.ok && removed.unit.attrs.hp).toBe(1051)
    expect(removed.diagnostics.map((item) => item.code)).toContain("RESOURCE_CLAMPED")
  })

  it("比较接口只返回有效六维和最终面板逐项差值", () => {
    const { equipment: _equipment, ...common } = input({})
    const result = compareDaoEquipmentLoadoutsV1({ ...common, before: {}, after: { belt: belt() } })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.effectiveAttributeDiffs).toEqual({
      vitality: 20,
      strength: 0,
      spirit: 0,
      endurance: 0,
      speed: 0,
      willpower: 0,
    })
    expect(result.panelDiffs).toMatchObject({ maxHp: 2179, hp: 2179, physicalDef: 19 })
    expect(result).not.toHaveProperty("score")
    expect(result).not.toHaveProperty("recommendation")
  })

  it("相同输入与seed生成相同快照事件，不同装备产生稳定战斗差异", () => {
    const weapon: DaoEquipmentInstanceV1 = {
      ...generated(DAO_EQUIPMENT_TEMPLATE_ID.Weapon, 1),
      attributeBonuses: [{ attr: "strength", value: 20 }],
    }
    const run = (equipment: DaoEquipmentLoadoutV1) => {
      const left = projectCultivatorWithEquipmentToCombatV6(input(equipment))
      const rightBase = input({})
      const rightInput = {
        ...rightBase,
        cultivator: { ...rightBase.cultivator, id: "right", name: "right" },
        side: 1 as const,
      }
      const right = projectCultivatorWithEquipmentToCombatV6(rightInput)
      if (!left.ok || !right.ok) throw new Error("道装战斗投影失败")
      const battle = createBattle({
        seed: 42,
        versions: COMBAT_V6_PHASE_4A_VERSIONS,
        ruleset: daoyouDeterministicRuleset,
        units: [left.unit, { ...right.unit, attrs: { ...right.unit.attrs, hp: 100_000, maxHp: 100_000 } }],
        skills: uniqueById<SkillDef>([...left.skills, ...right.skills]),
        statusDefs: uniqueById<StatusDef>([...left.statusDefs, ...right.statusDefs]),
      })
      battle.submit("left", { type: CommandType.Attack, target: "right" })
      battle.submit("right", { type: CommandType.Defend })
      battle.lockAndResolve()
      return { snapshot: battle.snapshot(), events: battle.log() }
    }

    const first = run({ weapon })
    const second = run({ weapon: structuredClone(weapon) })
    const unequipped = run({})
    expect(first).toEqual(second)
    expect(first.snapshot.versions).toEqual(COMBAT_V6_PHASE_4A_VERSIONS)
    expect(first.events.find((event) => event.type === EventType.BattleStart)).toMatchObject({ versions: COMBAT_V6_PHASE_4A_VERSIONS })
    expect(first.events).not.toEqual(unequipped.events)
  })

  it("非法装配不生成伪造单位，比较接口保留两边诊断", () => {
    const unsupported = { ...belt(), essenceIds: ["future.essence"] }
    const projection = projectCultivatorWithEquipmentToCombatV6(input({ belt: unsupported }))
    expect(projection.ok).toBe(false)
    expect(projection).not.toHaveProperty("unit")

    const { equipment: _equipment, ...common } = input({})
    const comparison = compareDaoEquipmentLoadoutsV1({
      ...common,
      before: {},
      after: { belt: unsupported },
    })
    expect(comparison.ok).toBe(false)
    expect(comparison.afterDiagnostics.map((item) => item.code)).toContain("UNSUPPORTED_EQUIPMENT_CONTENT")
  })
})
