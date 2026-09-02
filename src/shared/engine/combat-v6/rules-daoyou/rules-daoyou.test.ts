import { describe, expect, it } from "vitest"
import {
  COMBAT_V6_PHASE_1_VERSIONS,
  CommandType,
  EffectType,
  FormulaFamily,
  SkillTag,
  TargetMode,
  TargetSide,
  UnitKind,
  createBattle,
  createUnit,
  type LineupUnit,
  type SkillDef,
} from "../index.ts"
import {
  applyCultivate,
  baseDamage,
  createDaoyouRuleset,
  daoyouDeterministicRuleset,
  daoyouFormulas,
  physicalBase,
  splashFactor,
} from "./index.ts"

function lineup(overrides: Partial<LineupUnit> & Pick<LineupUnit, "id" | "side">): LineupUnit {
  return {
    name: overrides.id,
    kind: UnitKind.Npc,
    level: 0,
    attrs: { hp: 100, speed: 10, physicalAtk: 20, physicalDef: 5 },
    ...overrides,
  }
}

function unit(
  attrs: LineupUnit["attrs"],
  level = 0,
  kind: LineupUnit["kind"] = UnitKind.Npc,
) {
  return createUnit(lineup({ id: "unit", side: 0, kind, level, attrs }), 0)
}

describe("Daoyou formulas", () => {
  it("uses the physical broken and unbroken defense formulas", () => {
    expect(physicalBase(20, 5)).toBeCloseTo(19.5)
    expect(physicalBase(20, 18)).toBeCloseTo(2.6)
    expect(physicalBase(5, 20)).toBe(1)
  })

  it("clamps damage cultivation differences to plus or minus 20", () => {
    expect(Math.floor(applyCultivate(500, 30))).toBe(800)
    expect(Math.floor(applyCultivate(500, 20))).toBe(800)
    expect(Math.floor(applyCultivate(500, -30))).toBe(200)
    expect(Math.floor(applyCultivate(500, -20))).toBe(200)
  })

  it("applies physical fury before defense and cultivation", () => {
    const source = unit({
      hp: 100,
      speed: 10,
      physicalAtk: 100,
      physicalDef: 0,
      attackCultivate: 5,
    })
    const target = unit({
      hp: 100,
      speed: 10,
      physicalAtk: 1,
      physicalDef: 20,
      defenseCultivate: 0,
    })

    expect(
      baseDamage({
        family: FormulaFamily.Physical,
        kind: "physical",
        source,
        target,
        coeff: 1,
        power: 0,
        fury: true,
      }),
    ).toBe(210)
  })

  it("applies spell school terms and splash before cultivation", () => {
    const source = unit({
      hp: 100,
      speed: 10,
      physicalAtk: 1,
      physicalDef: 0,
      magicAtk: 100,
      spellCultivate: 5,
    })
    const target = unit({
      hp: 100,
      speed: 10,
      physicalAtk: 1,
      physicalDef: 0,
      magicDef: 20,
      resistSpellCultivate: 0,
    })

    expect(splashFactor({ perTarget: 0.1, floor: 0.5 }, 5)).toBe(0.5)
    expect(
      baseDamage({
        family: FormulaFamily.Spell,
        kind: "spell",
        source,
        target,
        coeff: 1,
        power: 20,
        fury: false,
        skillLevel: 10,
        schoolTerm: { linear: 2 },
        splash: { perTarget: 0.1, floor: 0.5 },
        targetCount: 5,
      }),
    ).toBe(91)
  })

  it("keeps fixed and judge damage independent from panels and cultivation", () => {
    const source = unit({
      hp: 100,
      speed: 10,
      physicalAtk: 999,
      physicalDef: 0,
      magicAtk: 999,
      spellCultivate: 60,
    })
    const target = unit({
      hp: 100,
      speed: 10,
      physicalAtk: 1,
      physicalDef: 999,
      magicDef: 999,
      resistSpellCultivate: 0,
    })
    for (const family of [FormulaFamily.Fixed, FormulaFamily.Judge]) {
      expect(
        baseDamage({
          family,
          kind: "spell",
          source,
          target,
          coeff: 1,
          power: 225,
          fury: false,
        }),
      ).toBe(225)
    }
  })

  it("uses point-based hit, guaranteed spell hit, and capped seal cultivation", () => {
    const source = unit({
      hp: 100,
      speed: 10,
      physicalAtk: 1,
      physicalDef: 0,
      hit: 90,
      sealHit: 0,
      spellCultivate: 60,
    }, 50)
    const target = unit({
      hp: 100,
      speed: 10,
      physicalAtk: 1,
      physicalDef: 0,
      dodge: 10,
      sealResist: 0,
      resistSpellCultivate: 0,
    }, 50)

    expect(daoyouFormulas.physicalHitChance(source, target)).toBe(0.9)
    expect(daoyouFormulas.spellHitChance(source, target)).toBe(1)
    expect(daoyouFormulas.sealHitChance(source, target, 50)).toBe(0.75)
    source.attrs.hit = -1000
    expect(daoyouFormulas.physicalHitChance(source, target)).toBe(0.2)
    source.attrs.hit = 1000
    expect(daoyouFormulas.physicalHitChance(source, target)).toBe(1)
    source.attrs.spellCultivate = 0
    target.attrs.resistSpellCultivate = 60
    expect(daoyouFormulas.sealHitChance(source, target, 50)).toBeCloseTo(0.35)
    source.attrs.sealHit = 1000
    expect(daoyouFormulas.sealHitChance(source, target, 50)).toBe(0.9)
  })
})

describe("Daoyou ruleset integration", () => {
  it("applies fury, critical hit, deterministic fluctuation, and defend in order", () => {
    const battle = createBattle({
      seed: 1,
      versions: COMBAT_V6_PHASE_1_VERSIONS,
      ruleset: daoyouDeterministicRuleset,
      units: [
        lineup({
          id: "attacker",
          side: 0,
          attrs: {
            hp: 500,
            speed: 20,
            physicalAtk: 100,
            physicalDef: 0,
            hit: 1000,
            critRate: 1,
            physicalFuryRate: 1,
          },
        }),
        lineup({
          id: "defender",
          side: 1,
          attrs: { hp: 500, speed: 1, physicalAtk: 1, physicalDef: 20, dodge: 0 },
        }),
      ],
    })
    battle.submit("attacker", { type: CommandType.Attack, target: "defender" })
    battle.submit("defender", { type: CommandType.Defend })
    battle.lockAndResolve()

    expect(battle.unit("defender").attrs.hp).toBe(331)
    expect(battle.log()).toContainEqual({
      type: "hit",
      sourceId: "attacker",
      targetId: "defender",
      kind: "physical",
      crit: true,
      fury: true,
    })
    expect(daoyouDeterministicRuleset.formulas).toMatchObject({
      fluctuationMin: 1,
      fluctuationMax: 1,
      physicalFluctuationMin: 1,
      physicalFluctuationMax: 1,
    })
  })

  it("treats players as downed and pets or npcs as dead", () => {
    for (const kind of [UnitKind.Pet, UnitKind.Npc]) {
      const battle = createBattle({
        seed: 1,
        versions: COMBAT_V6_PHASE_1_VERSIONS,
        ruleset: daoyouDeterministicRuleset,
        units: [
          lineup({
            id: "attacker",
            side: 0,
            attrs: { hp: 100, speed: 20, physicalAtk: 100, physicalDef: 0 },
          }),
          lineup({
            id: "target",
            side: 1,
            kind,
            attrs: { hp: 10, speed: 1, physicalAtk: 1, physicalDef: 0 },
          }),
        ],
      })
      battle.lockAndResolve()
      expect(battle.unit("target").flags.dead).toBe(true)
    }

    const playerBattle = createBattle({
      seed: 1,
      versions: COMBAT_V6_PHASE_1_VERSIONS,
      ruleset: daoyouDeterministicRuleset,
      units: [
        lineup({
          id: "attacker",
          side: 0,
          attrs: { hp: 100, speed: 20, physicalAtk: 100, physicalDef: 0 },
        }),
        lineup({
          id: "target",
          side: 1,
          kind: UnitKind.Player,
          attrs: { hp: 10, speed: 1, physicalAtk: 1, physicalDef: 0 },
        }),
      ],
    })
    playerBattle.lockAndResolve()
    expect(playerBattle.unit("target").flags.downed).toBe(true)
    expect(playerBattle.unit("target").flags.dead).toBe(false)
  })

  it("adds healPower as a flat amount", () => {
    const heal: SkillDef = {
      id: "test-heal",
      name: "测试治疗",
      tags: [SkillTag.Support],
      targeting: { side: TargetSide.Ally, mode: TargetMode.Explicit, count: 1 },
      effects: [{ type: EffectType.Heal, power: 20 }],
    }
    const battle = createBattle({
      seed: 1,
      versions: COMBAT_V6_PHASE_1_VERSIONS,
      ruleset: daoyouDeterministicRuleset,
      skills: [heal],
      units: [
        lineup({
          id: "healer",
          side: 0,
          kind: UnitKind.Player,
          skills: [heal.id],
          attrs: {
            hp: 30,
            maxHp: 100,
            mp: 100,
            maxMp: 100,
            speed: 20,
            physicalAtk: 1,
            physicalDef: 0,
            healPower: 10,
          },
        }),
        lineup({ id: "enemy", side: 1 }),
      ],
    })
    battle.submit("healer", { type: CommandType.Skill, skillId: heal.id, targets: ["healer"] })
    battle.submit("enemy", { type: CommandType.Defend })
    battle.lockAndResolve()
    expect(battle.unit("healer").attrs.hp).toBe(60)
  })

  it("supports flee and round-limit outcomes", () => {
    const fleeRules = createDaoyouRuleset({ formulas: { fleeChance: () => 1 } })
    const fleeBattle = createBattle({
      seed: 1,
      versions: COMBAT_V6_PHASE_1_VERSIONS,
      ruleset: fleeRules,
      units: [lineup({ id: "a", side: 0 }), lineup({ id: "b", side: 1 })],
    })
    fleeBattle.submit("a", { type: CommandType.Flee })
    fleeBattle.lockAndResolve()
    expect(fleeBattle.state.result).toEqual({ winner: 1, reason: "flee" })

    const roundBattle = createBattle({
      seed: 1,
      versions: COMBAT_V6_PHASE_1_VERSIONS,
      ruleset: createDaoyouRuleset({
        maxRounds: 1,
        formulas: { fluctuationMin: 1, fluctuationMax: 1 },
      }),
      units: [
        lineup({ id: "a", side: 0, attrs: { hp: 1000, speed: 10, physicalAtk: 1, physicalDef: 100 } }),
        lineup({ id: "b", side: 1, attrs: { hp: 1000, speed: 10, physicalAtk: 1, physicalDef: 100 } }),
      ],
    })
    roundBattle.lockAndResolve()
    expect(roundBattle.state.result).toEqual({ winner: "draw", reason: "round-limit" })
  })
})
