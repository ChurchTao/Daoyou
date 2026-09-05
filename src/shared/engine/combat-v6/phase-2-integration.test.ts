import { describe, expect, it } from "vitest"
import type { Attributes } from "@shared/types/cultivator"
import type { CultivatorCondition } from "@shared/types/condition"
import {
  COMBAT_V6_PHASE_2_VERSIONS,
  createBattle,
  daoyouRuleset,
  projectCultivatorWithTrainingToCombatV6,
} from "./index.ts"

const attributes: Attributes = {
  vitality: 10,
  strength: 10,
  spirit: 10,
  endurance: 10,
  speed: 10,
  willpower: 10,
}

function condition(level: number): CultivatorCondition {
  return {
    version: 1,
    resources: { hp: { current: 500 }, mp: { current: 200 } },
    gauges: { pillToxicity: 0 },
    tracks: {
      bodyCultivation: {
        version: 1,
        realm: "bronze_skin",
        tracks: {
          skin: { level, progress: 0 },
          sinew_bone: { level, progress: 0 },
          organs: { level, progress: 0 },
          qi_blood: { level, progress: 0 },
          primordial_spirit: { level, progress: 0 },
        },
        milestones: { legacy: true },
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

function project(id: string, side: 0 | 1, level: number) {
  return projectCultivatorWithTrainingToCombatV6({
    cultivator: {
      id,
      name: id,
      realm: "炼气",
      realm_stage: "初期",
      attributes: { ...attributes },
      condition: condition(level),
    },
    side,
    slot: 0,
    resourcePolicy: "full",
  })
}

function duel(seed: number) {
  const left = project("left", 0, 10)
  const right = project("right", 1, 5)
  if (!left.ok || !right.ok) throw new Error("修炼角色投影失败")
  const battle = createBattle({
    seed,
    versions: COMBAT_V6_PHASE_2_VERSIONS,
    ruleset: daoyouRuleset,
    units: [left.unit, right.unit],
  })
  battle.runUntilEnd()
  return { left, right, battle }
}

describe("combat-v6 Phase 2 training vertical slice", () => {
  it("produces stable trained projections, snapshots, and events", () => {
    const first = duel(20260902)
    const second = duel(20260902)

    expect(first.left.unit).toEqual(second.left.unit)
    expect(first.battle.snapshot()).toEqual(second.battle.snapshot())
    expect(first.battle.log()).toEqual(second.battle.log())
    expect(first.left.unit.attrs).toMatchObject({
      attackCultivate: 10,
      defenseCultivate: 10,
      spellCultivate: 10,
      resistSpellCultivate: 10,
      maxHp: 661,
      healPower: 17,
    })
  })

  it("carries character_training_v1 through battle state and BattleStart", () => {
    const { battle } = duel(42)

    expect(battle.snapshot().versions).toEqual(COMBAT_V6_PHASE_2_VERSIONS)
    expect(battle.log()[0]).toMatchObject({
      type: "battleStart",
      versions: COMBAT_V6_PHASE_2_VERSIONS,
    })
  })
})
