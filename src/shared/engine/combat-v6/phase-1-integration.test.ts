import { describe, expect, it } from "vitest"
import type { Attributes } from "@shared/types/cultivator"
import {
  COMBAT_V6_PHASE_1_VERSIONS,
  createBattle,
  daoyouRuleset,
  projectCultivatorBaseToCombatV6,
} from "./index.ts"

const attributes: Attributes = {
  vitality: 10,
  strength: 10,
  spirit: 10,
  endurance: 10,
  speed: 10,
  willpower: 10,
}

function project(id: string, side: 0 | 1) {
  return projectCultivatorBaseToCombatV6({
    cultivator: {
      id,
      name: id,
      realm: "炼气",
      realm_stage: "初期",
      attributes: { ...attributes },
    },
    side,
    slot: 0,
    resourcePolicy: "full",
  })
}

function duel(seed: number) {
  const left = project("left", 0)
  const right = project("right", 1)
  if (!left.ok || !right.ok) throw new Error("黄金角色投影失败")
  const battle = createBattle({
    seed,
    versions: COMBAT_V6_PHASE_1_VERSIONS,
    ruleset: daoyouRuleset,
    units: [left.unit, right.unit],
  })
  battle.runUntilEnd()
  return { left, right, battle }
}

describe("combat-v6 Phase 1 vertical slice", () => {
  it("produces byte-stable projections, snapshots, and events for the same input", () => {
    const first = duel(20260902)
    const second = duel(20260902)

    expect(JSON.stringify(first.left.unit)).toBe(JSON.stringify(second.left.unit))
    expect(JSON.stringify(first.battle.snapshot())).toBe(JSON.stringify(second.battle.snapshot()))
    expect(JSON.stringify(first.battle.log())).toBe(JSON.stringify(second.battle.log()))
  })

  it("keeps projection stable while the battle seed changes", () => {
    const first = duel(1)
    const second = duel(2)

    expect(first.left.unit).toEqual(second.left.unit)
    expect(first.battle.log()[0]).not.toEqual(second.battle.log()[0])
  })

  it("carries the complete version stamp in the snapshot and battle-start event", () => {
    const { battle } = duel(42)
    expect(battle.snapshot().versions).toEqual(COMBAT_V6_PHASE_1_VERSIONS)
    expect(battle.log()[0]).toEqual({
      type: "battleStart",
      seed: 42,
      unitIds: ["left", "right"],
      versions: COMBAT_V6_PHASE_1_VERSIONS,
    })
  })
})
