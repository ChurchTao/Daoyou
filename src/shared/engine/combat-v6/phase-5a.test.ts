import { describe, expect, it } from "vitest"
import type { Attributes } from "@shared/types/cultivator"
import {
  CHARACTER_MANUAL_ID,
  CHARACTER_MANUALS_V1,
  COMBAT_V6_PHASE_5A_VERSIONS,
  CommandType,
  DamageKind,
  DamageOrigin,
  EffectType,
  EventType,
  HookAim,
  HookName,
  LINGXIAO_PATH_ID,
  LINGXIAO_V6_DEFINITION,
  SkillTag,
  StatusCategory,
  StatusTick,
  TargetSide,
  TickKind,
  createBattle,
  daoyouDeterministicRuleset,
  projectCultivatorToCombatV6,
  type CultivatorManualStateV1,
  type SectCombatProgressV6,
  type SkillDef,
  type StatusDef,
} from "./index.ts"

function manualState(...manualIds: string[]): CultivatorManualStateV1 {
  return {
    version: 1,
    revision: 0,
    build: { slots: manualIds.map((manualId, index) => ({ slot: (index + 1) as 1 | 2 | 3 | 4 | 5 | 6, manualId })) },
  }
}

function manualSkill(manualId: string): SkillDef {
  const skill = CHARACTER_MANUALS_V1.find((manual) => manual.id === manualId)?.skill
  if (!skill) throw new Error(`功法 ${manualId} 没有被动`)
  return skill
}

function hookBattle(manualId: string, seed = 1, statusDefs: StatusDef[] = []) {
  const skill = manualSkill(manualId)
  return createBattle({
    seed,
    versions: COMBAT_V6_PHASE_5A_VERSIONS,
    ruleset: daoyouDeterministicRuleset,
    skills: [skill],
    statusDefs,
    units: [
      {
        id: "source", name: "source", side: 0, kind: "player", passives: [skill.id], skillLevels: { [skill.id]: 0 },
        attrs: { hp: 1000, maxHp: 1000, mp: 1000, maxMp: 1000, speed: 20, physicalAtk: 100, physicalDef: 100, magicAtk: 100, magicDef: 100 },
      },
      { id: "target", name: "target", side: 1, kind: "player", attrs: { hp: 5000, maxHp: 5000, speed: 10, physicalAtk: 100, physicalDef: 100, magicDef: 100 } },
    ],
  })
}

describe("combat-v6 Phase 5A 功法战斗内容", () => {
  it("断岳和凝光只提高主动直接打击的暴击概率", () => {
    for (const [manualId, kind, expected] of [
      [CHARACTER_MANUAL_ID.DuanyueBase, DamageKind.Physical, 0.05],
      [CHARACTER_MANUAL_ID.NingguangTrue, DamageKind.Spell, 0.1],
    ] as const) {
      const battle = hookBattle(manualId)
      const common = { source: battle.unit("source"), target: battle.unit("target"), kind, skillId: "test", chance: 0 }
      expect(battle.hooks.emit(HookName.OnCritRoll, { ...common, origin: DamageOrigin.ActionDirect }).chance).toBe(expected)
      expect(battle.hooks.emit(HookName.OnCritRoll, { ...common, origin: DamageOrigin.HookDerived }).chance).toBe(0)
    }
  })

  it("破军、焚灵与护元遵守直接伤害和50%气血边界", () => {
    const physical = hookBattle(CHARACTER_MANUAL_ID.PojunTrue)
    const pctx = { source: physical.unit("source"), target: physical.unit("target"), kind: DamageKind.Physical, damage: 100 }
    expect(physical.hooks.emit(HookName.OnHitCalc, { ...pctx, origin: DamageOrigin.ActionDirect }).damage).toBeCloseTo(110)
    expect(physical.hooks.emit(HookName.OnHitCalc, { ...pctx, origin: DamageOrigin.HookDerived }).damage).toBe(100)

    const spell = hookBattle(CHARACTER_MANUAL_ID.FenlingBase)
    const sctx = { source: spell.unit("source"), target: spell.unit("target"), kind: DamageKind.Spell, damage: 100 }
    expect(spell.hooks.emit(HookName.OnHitCalc, { ...sctx, origin: DamageOrigin.ActionDirect }).damage).toBe(105)

    const guard = hookBattle(CHARACTER_MANUAL_ID.HuyuanTrue)
    guard.unit("source").attrs.hp = 499
    expect(guard.hooks.emit(HookName.OnHitCalc, {
      source: guard.unit("target"), target: guard.unit("source"), kind: DamageKind.Physical,
      damage: 100, origin: DamageOrigin.ActionDirect,
    }).damage).toBe(85)
    guard.unit("source").attrs.hp = 500
    expect(guard.hooks.emit(HookName.OnHitCalc, {
      source: guard.unit("target"), target: guard.unit("source"), kind: DamageKind.Physical,
      damage: 100, origin: DamageOrigin.ActionDirect,
    }).damage).toBe(100)
  })

  it("饮血按实际伤害恢复，并对多段行动执行累计上限", () => {
    const manual = manualSkill(CHARACTER_MANUAL_ID.YinxueBase)
    const triple: SkillDef = {
      id: "test.triple", name: "三段", tags: [SkillTag.Physical], targeting: { side: TargetSide.Enemy, count: 1 },
      effects: [{ type: EffectType.PhysicalHit, hits: 3, coeff: 1 }],
    }
    const battle = createBattle({
      seed: 1, versions: COMBAT_V6_PHASE_5A_VERSIONS, ruleset: daoyouDeterministicRuleset,
      skills: [manual, triple],
      units: [
        { id: "source", name: "source", side: 0, kind: "player", skills: [triple.id], passives: [manual.id], skillLevels: { [manual.id]: 0, [triple.id]: 0 }, attrs: { hp: 100, maxHp: 1000, speed: 20, physicalAtk: 1000, physicalDef: 100 } },
        { id: "target", name: "target", side: 1, kind: "npc", attrs: { hp: 5000, maxHp: 5000, speed: 10, physicalAtk: 1, physicalDef: 0 } },
      ],
    })
    battle.submit("source", { type: CommandType.Skill, skillId: triple.id, targets: ["target"] })
    battle.submit("target", { type: CommandType.Defend })
    battle.lockAndResolve()
    expect(battle.unit("source").attrs.hp).toBe(250)
    expect(battle.log().filter((event) => event.type === EventType.Heal).reduce((sum, event) => sum + event.amount, 0)).toBe(150)

    const overkill = hookBattle(CHARACTER_MANUAL_ID.YinxueBase)
    overkill.unit("source").attrs.hp = 100
    overkill.hooks.emit(HookName.AfterHit, {
      source: overkill.unit("source"), target: overkill.unit("target"), kind: DamageKind.Physical,
      damage: 999, hpDamage: 50, origin: DamageOrigin.ActionDirect,
    })
    expect(overkill.unit("source").attrs.hp).toBe(105)
    overkill.hooks.emit(HookName.AfterHit, {
      source: overkill.unit("source"), target: overkill.unit("target"), kind: DamageKind.Physical,
      damage: 999, hpDamage: 500, origin: DamageOrigin.HookDerived,
    })
    expect(overkill.unit("source").attrs.hp).toBe(105)
  })

  it("回生只判定一次，成功时清普通状态并保留倒地持续状态", () => {
    const ordinary: StatusDef = { id: "test.ordinary", name: "普通", kind: "ordinary", category: StatusCategory.Debuff }
    const persistent: StatusDef = { id: "test.persistent", name: "持续", kind: "persistent", category: StatusCategory.Control, persistWhenDowned: true }
    let success: ReturnType<typeof hookBattle> | undefined
    for (let seed = 1; seed < 100 && !success; seed += 1) {
      const candidate = hookBattle(CHARACTER_MANUAL_ID.HuishengTrue, seed, [ordinary, persistent])
      candidate.applyStatus("source", ordinary.id, 3)
      candidate.applyStatus("source", persistent.id, 3)
      candidate.unit("source").attrs.hp = 0
      candidate.hooks.emit(HookName.OnFatal, { target: candidate.unit("source") })
      if (candidate.unit("source").attrs.hp > 0) success = candidate
    }
    expect(success).toBeDefined()
    if (!success) return
    expect(success.unit("source").attrs.hp).toBe(300)
    expect(success.unit("source").statuses.map((status) => status.id)).toEqual([persistent.id])
    expect(() => success!.submit("source", { type: CommandType.Defend })).not.toThrow()

    let failure: ReturnType<typeof hookBattle> | undefined
    for (let seed = 1; seed < 100 && !failure; seed += 1) {
      const candidate = hookBattle(CHARACTER_MANUAL_ID.HuishengBase, seed)
      candidate.unit("source").attrs.hp = 0
      candidate.hooks.emit(HookName.OnFatal, { target: candidate.unit("source") })
      if (candidate.unit("source").attrs.hp === 0) failure = candidate
    }
    expect(failure).toBeDefined()
    if (!failure) return
    failure.hooks.emit(HookName.OnFatal, { target: failure.unit("source") })
    expect(failure.unit("source").attrs.hp).toBe(0)
  })

  it("冥思和生息只为站立人物在回合末执行独立恢复", () => {
    const mingsi = manualSkill(CHARACTER_MANUAL_ID.MingsiBase)
    const shengxi = manualSkill(CHARACTER_MANUAL_ID.ShengxiTrue)
    const reducedHealing: StatusDef = { id: "test.reduced-healing", name: "减疗", kind: "reduced-healing", healTaken: 0.1 }
    const battle = createBattle({
      seed: 1, versions: COMBAT_V6_PHASE_5A_VERSIONS, ruleset: daoyouDeterministicRuleset,
      skills: [mingsi, shengxi],
      statusDefs: [reducedHealing],
      units: [
        { id: "source", name: "source", side: 0, kind: "player", passives: [mingsi.id, shengxi.id], skillLevels: { [mingsi.id]: 0, [shengxi.id]: 0 }, attrs: { hp: 500, maxHp: 1000, mp: 500, maxMp: 1000, speed: 20, physicalAtk: 1, physicalDef: 100 } },
        { id: "target", name: "target", side: 1, kind: "player", attrs: { hp: 1000, maxHp: 1000, speed: 10, physicalAtk: 1, physicalDef: 100 } },
      ],
    })
    battle.applyStatus("source", reducedHealing.id, 3)
    battle.submit("source", { type: CommandType.Defend })
    battle.submit("target", { type: CommandType.Defend })
    battle.lockAndResolve()
    expect(battle.unit("source").attrs).toMatchObject({ hp: 520, mp: 520 })
  })

  it("状态tick先于回合恢复，tick后倒地不会被生息拉起", () => {
    const shengxi = manualSkill(CHARACTER_MANUAL_ID.ShengxiTrue)
    const dot: StatusDef = {
      id: "test.dot", name: "劫火", kind: "dot", category: StatusCategory.Dot,
      ticks: StatusTick.RoundEnd, onTick: { type: TickKind.Dot, ratioOfMaxHp: 0.6 },
    }
    const battle = createBattle({
      seed: 1, versions: COMBAT_V6_PHASE_5A_VERSIONS, ruleset: daoyouDeterministicRuleset,
      skills: [shengxi], statusDefs: [dot],
      units: [
        { id: "source", name: "source", side: 0, kind: "player", passives: [shengxi.id], skillLevels: { [shengxi.id]: 0 }, attrs: { hp: 500, maxHp: 1000, speed: 20, physicalAtk: 1, physicalDef: 100 } },
        { id: "target", name: "target", side: 1, kind: "player", attrs: { hp: 1000, maxHp: 1000, speed: 10, physicalAtk: 1, physicalDef: 100 } },
      ],
    })
    battle.applyStatus("source", dot.id, 2, "target")
    battle.submit("source", { type: CommandType.Defend })
    battle.submit("target", { type: CommandType.Defend })
    battle.lockAndResolve()
    expect(battle.unit("source")).toMatchObject({ attrs: { hp: 0 }, flags: { downed: true } })
  })
})

const ATTRIBUTES: Attributes = { vitality: 10, strength: 10, spirit: 10, endurance: 10, speed: 10, willpower: 10 }

function sect(): SectCombatProgressV6 {
  return {
    version: 1,
    sectId: "lingxiao",
    methods: Object.fromEntries(LINGXIAO_V6_DEFINITION.methods.map((method) => [method.id, 180])),
    meridianDepth: 0,
    activePathId: LINGXIAO_PATH_ID.Guiyi,
    meridianLoadouts: [
      { pathId: LINGXIAO_PATH_ID.Zhanchen, nodeIds: [], revision: 1 },
      { pathId: LINGXIAO_PATH_ID.Guiyi, nodeIds: [], revision: 1 },
    ],
  }
}

function projectionInput(side: 0 | 1, manuals: CultivatorManualStateV1) {
  return {
    cultivator: {
      id: side === 0 ? "left" : "right",
      name: side === 0 ? "left" : "right",
      realm: "渡劫" as const,
      realm_stage: "圆满" as const,
      attributes: { ...ATTRIBUTES },
    },
    side,
    slot: 0,
    resourcePolicy: "full" as const,
    sect: sect(),
    equipment: {},
    manuals,
  }
}

describe("combat-v6 Phase 5A 完整人物投影", () => {
  it("要求显式功法状态，并叠加定魂且固定被动等级为0", () => {
    const emptyResult = projectCultivatorToCombatV6(projectionInput(0, manualState()))
    expect(emptyResult.ok).toBe(true)
    const result = projectCultivatorToCombatV6(projectionInput(0, manualState(CHARACTER_MANUAL_ID.DinghunTrue, CHARACTER_MANUAL_ID.PojunTrue)))
    expect(result.ok).toBe(true)
    if (!result.ok || !emptyResult.ok) return
    expect(result.unit.attrs.sealResist - emptyResult.unit.attrs.sealResist).toBe(20)
    expect(result.unit.skillLevels?.[manualSkill(CHARACTER_MANUAL_ID.PojunTrue).id]).toBe(0)
    expect(result.versions).toEqual(COMBAT_V6_PHASE_5A_VERSIONS)

    const missing = projectionInput(0, manualState()) as ReturnType<typeof projectionInput> & { manuals?: CultivatorManualStateV1 }
    delete missing.manuals
    expect(projectCultivatorToCombatV6(missing as ReturnType<typeof projectionInput>)).toMatchObject({ ok: false, diagnostics: expect.arrayContaining([expect.objectContaining({ code: "INVALID_MANUAL_STATE" })]) })
  })

  it("相同输入产生相同投影、快照和事件流", () => {
    const leftInput = projectionInput(0, manualState(CHARACTER_MANUAL_ID.PojunBase))
    const originalInput = structuredClone(leftInput)
    const rightInput = projectionInput(1, manualState(CHARACTER_MANUAL_ID.HuyuanBase))
    const leftA = projectCultivatorToCombatV6(leftInput)
    const leftB = projectCultivatorToCombatV6(leftInput)
    const right = projectCultivatorToCombatV6(rightInput)
    expect(leftA).toEqual(leftB)
    expect(leftInput).toEqual(originalInput)
    expect(leftA.ok && right.ok).toBe(true)
    if (!leftA.ok || !right.ok) return
    const skills = [...leftA.skills, ...right.skills].filter((skill, index, all) => all.findIndex((candidate) => candidate.id === skill.id) === index)
    const first = createBattle({ seed: 42, versions: leftA.versions, ruleset: daoyouDeterministicRuleset, units: [leftA.unit, right.unit], skills, statusDefs: [...leftA.statusDefs, ...right.statusDefs] })
    const second = createBattle({ seed: 42, versions: leftA.versions, ruleset: daoyouDeterministicRuleset, units: [leftB.unit, right.unit], skills, statusDefs: [...leftB.statusDefs, ...right.statusDefs] })
    for (const battle of [first, second]) {
      battle.submit("left", { type: CommandType.Attack, target: "right" })
      battle.submit("right", { type: CommandType.Defend })
      battle.lockAndResolve()
    }
    expect(first.snapshot()).toEqual(second.snapshot())
    expect(first.log()).toEqual(second.log())
  })
})
