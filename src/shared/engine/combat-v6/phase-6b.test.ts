import { describe, expect, it } from "vitest"
import type { Attributes } from "@shared/types/cultivator"
import {
  COMBAT_V6_PHASE_6B_VERSIONS,
  COMBAT_V6_SECT_DEFINITIONS_V1,
  COMBAT_V6_SECT_DEFINITIONS_V2,
  CommandType,
  DamageKind,
  EffectType,
  EventType,
  FormulaFamily,
  SkillTag,
  StatusCategory,
  StatusFlag,
  TargetSide,
  WUXIANG_PATH_ID,
  WUXIANG_RESOURCE_ID,
  WUXIANG_SKILL_ID,
  WUXIANG_STATUS_ID,
  WUXIANG_V6_DEFINITION,
  compileSectCombatV6,
  compileSectCombatV6V2,
  createBattle,
  createUnit,
  daoyouDeterministicRulesetV3,
  daoyouFormulas,
  daoyouFormulasV3,
  projectCultivatorMultiSectToCombatV6,
  projectCultivatorMultiSectV3ToCombatV6,
  validateCombatV6SectRegistryV2,
  type CultivatorManualStateV1,
  type LineupUnit,
  type SectCombatProgressV6,
  type SkillDef,
  type StatusDef,
} from "./index.ts"

const ATTRIBUTES: Attributes = { vitality: 10, strength: 10, spirit: 10, endurance: 10, speed: 10, willpower: 10 }
const manuals: CultivatorManualStateV1 = { version: 1, revision: 0, build: { slots: [] } }

function wuxiangProgress(pathId = WUXIANG_PATH_ID.Compassion): SectCombatProgressV6 {
  return {
    version: 1,
    sectId: "wuxiang",
    methods: Object.fromEntries(WUXIANG_V6_DEFINITION.methods.map((method) => [method.id, 180])),
    meridianDepth: 0,
    activePathId: pathId,
    meridianLoadouts: WUXIANG_V6_DEFINITION.paths.map((path) => ({ pathId: path.id, nodeIds: [], revision: 1 })) as SectCombatProgressV6["meridianLoadouts"],
  }
}

function projectionInput(pathId = WUXIANG_PATH_ID.Compassion) {
  return {
    cultivator: { id: "wuxiang-1", name: "无相", realm: "渡劫" as const, realm_stage: "圆满" as const, attributes: { ...ATTRIBUTES } },
    side: 0 as const,
    slot: 0,
    resourcePolicy: "full" as const,
    sect: wuxiangProgress(pathId),
    equipment: {},
    manuals,
  }
}

function unit(id: string, side: 0 | 1, attrs: LineupUnit["attrs"], extra: Partial<LineupUnit> = {}): LineupUnit {
  return { id, name: id, side, kind: "player", attrs, ...extra }
}

describe("combat-v6 Phase 6B 多宗门内容", () => {
  it("保留V1双宗门注册表，并由V2完整注册无相禅宗", () => {
    expect(Object.keys(COMBAT_V6_SECT_DEFINITIONS_V1)).toEqual(["lingxiao", "youdu"])
    expect(Object.keys(COMBAT_V6_SECT_DEFINITIONS_V2)).toEqual(["lingxiao", "youdu", "wuxiang"])
    expect(validateCombatV6SectRegistryV2()).toEqual([])
    expect(WUXIANG_V6_DEFINITION.methods).toHaveLength(6)
    expect(WUXIANG_V6_DEFINITION.methods.filter((method) => method.isPrimary)).toHaveLength(1)
    expect(WUXIANG_V6_DEFINITION.skills.filter((skill) => skill.kind === "active")).toHaveLength(7)
    expect(WUXIANG_V6_DEFINITION.paths.map((path) => path.name)).toEqual(["慈航渡厄", "明王镇狱"])
    expect(WUXIANG_V6_DEFINITION.paths.flatMap((path) => path.nodes)).toHaveLength(42)
    for (const node of WUXIANG_V6_DEFINITION.paths.flatMap((path) => path.nodes)) {
      expect([
        ...(node.panel ?? []),
        ...(node.passives ?? []),
        ...(node.grantSkills ?? []),
        ...(node.patches ?? []),
      ].length, node.id).toBeGreaterThan(0)
    }
  })

  it("两条流派完整七层方案均可编译，旧编译器和旧完整入口拒绝无相", () => {
    for (const path of WUXIANG_V6_DEFINITION.paths) {
      const progress = wuxiangProgress(path.id)
      progress.meridianDepth = 7
      progress.meridianLoadouts = progress.meridianLoadouts.map((loadout) => ({
        ...loadout,
        nodeIds: loadout.pathId === path.id
          ? path.nodes.filter((node) => node.slot === 1).map((node) => node.id)
          : [],
      })) as SectCombatProgressV6["meridianLoadouts"]
      expect(compileSectCombatV6V2({ progress, characterLevel: 180 }).ok, path.name).toBe(true)
    }
    expect(compileSectCombatV6({ progress: wuxiangProgress(), characterLevel: 180 })).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([expect.objectContaining({ code: "UNKNOWN_SECT_CONTENT" })]),
    })
    expect(projectCultivatorMultiSectToCombatV6(projectionInput())).toMatchObject({ ok: false })
  })

  it("共享基础技能按锁定目标数编译，技能等级严格来自所属心法", () => {
    const progress = wuxiangProgress()
    progress.methods = Object.fromEntries(Object.keys(progress.methods).map((id) => [id, 1]))
    const result = compileSectCombatV6V2({ progress, characterLevel: 5 })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const byId = new Map(result.projection.skills.map((skill) => [skill.id, skill]))
    expect(byId.get(WUXIANG_SKILL_ID.GroupHeal)?.targeting.count).toBe(5)
    expect(byId.get(WUXIANG_SKILL_ID.Barrier)?.targeting.count).toBe(4)
    expect(byId.get(WUXIANG_SKILL_ID.Spell)?.targeting.count).toBe(5)
    expect(result.projection.skillLevels[WUXIANG_SKILL_ID.GroupHeal]).toBe(1)
    expect(result.projection.skillLevels[WUXIANG_SKILL_ID.Formless]).toBe(1)
  })

  it("character_build_v3 投影无相技能、念与战意且使用独立版本戳", () => {
    const result = projectCultivatorMultiSectV3ToCombatV6(projectionInput())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.versions).toEqual(COMBAT_V6_PHASE_6B_VERSIONS)
    expect(result.unit.skills).toEqual(expect.arrayContaining([
      WUXIANG_SKILL_ID.SingleHeal,
      WUXIANG_SKILL_ID.Revive,
      WUXIANG_SKILL_ID.Formless,
    ]))
    expect(result.unit.resources?.map((resource) => [resource.id, resource.current, resource.max])).toEqual([
      [WUXIANG_RESOURCE_ID, 0, 6],
      ["combat.resource.rage", 0, 150],
    ])
  })

  it("念只在成功施法后获得，无相消耗六念并在强化期间暂停积累", () => {
    const projected = projectCultivatorMultiSectV3ToCombatV6(projectionInput())
    expect(projected.ok).toBe(true)
    if (!projected.ok) return
    const battle = createBattle({
      seed: 1,
      versions: COMBAT_V6_PHASE_6B_VERSIONS,
      ruleset: daoyouDeterministicRulesetV3,
      skills: projected.skills,
      statusDefs: projected.statusDefs,
      units: [
        { ...projected.unit, attrs: { ...projected.unit.attrs, mp: 9999, maxMp: 9999, speed: 100 } },
        unit("enemy", 1, { hp: 99999, maxHp: 99999, speed: 1, physicalAtk: 1, physicalDef: 99999 }),
      ],
    })
    const resolve = (skillId: string) => {
      battle.submit(projected.unit.id!, { type: CommandType.Skill, skillId, targets: [projected.unit.id!] })
      battle.submit("enemy", { type: CommandType.Defend })
      battle.lockAndResolve()
    }
    resolve(WUXIANG_SKILL_ID.SingleHeal)
    expect(battle.unit(projected.unit.id!).resources.find((resource) => resource.id === WUXIANG_RESOURCE_ID)?.current).toBe(1)
    battle.unit(projected.unit.id!).resources.find((resource) => resource.id === WUXIANG_RESOURCE_ID)!.current = 6
    resolve(WUXIANG_SKILL_ID.Formless)
    expect(battle.unit(projected.unit.id!).resources.find((resource) => resource.id === WUXIANG_RESOURCE_ID)?.current).toBe(0)
    expect(battle.unit(projected.unit.id!).statuses.map((status) => status.id)).toContain(WUXIANG_STATUS_ID.Formless)
    resolve(WUXIANG_SKILL_ID.SingleHeal)
    expect(battle.unit(projected.unit.id!).resources.find((resource) => resource.id === WUXIANG_RESOURCE_ID)?.current).toBe(0)
  })
})

describe("combat-v6 Phase 6B 护盾、疗伤与成功效果", () => {
  it("护盾稳定吸收伤害，全额吸收不产生Damage，部分吸收只扣余量", () => {
    const shield: SkillDef = {
      id: "test.shield", name: "盾", tags: [SkillTag.Support], targeting: { side: TargetSide.Self },
      effects: [
        { type: EffectType.ApplyBarrier, id: "barrier.b", kind: "b", name: "乙盾", power: 30, duration: 3 },
        { type: EffectType.ApplyBarrier, id: "barrier.a", kind: "a", name: "甲盾", power: 80, duration: 3 },
      ],
    }
    const hit = (power: number): SkillDef => ({
      id: `test.hit.${power}`, name: "固定打击", tags: [SkillTag.Spell], formula: FormulaFamily.Fixed,
      targeting: { side: TargetSide.Enemy }, effects: [{ type: EffectType.FixedHit, power }],
    })
    for (const [power, hp, damageEvents] of [[100, 1000, 0], [150, 960, 1]] as const) {
      const strike = hit(power)
      const battle = createBattle({
        seed: 1, versions: COMBAT_V6_PHASE_6B_VERSIONS, ruleset: daoyouDeterministicRulesetV3,
        skills: [shield, strike],
        units: [
          unit("guarded", 0, { hp: 1000, maxHp: 1000, speed: 20, physicalAtk: 1, physicalDef: 1 }, { skills: [shield.id] }),
          unit("attacker", 1, { hp: 1000, speed: 10, physicalAtk: 1, physicalDef: 1 }, { skills: [strike.id] }),
        ],
      })
      battle.submit("guarded", { type: CommandType.Skill, skillId: shield.id, targets: ["guarded"] })
      battle.submit("attacker", { type: CommandType.Skill, skillId: strike.id, targets: ["guarded"] })
      battle.lockAndResolve()
      expect(battle.unit("guarded").attrs.hp).toBe(hp)
      expect(battle.log().filter((event) => event.type === EventType.Damage)).toHaveLength(damageEvents)
      expect(battle.log().filter((event) => event.type === EventType.BarrierChanged && event.reason === "absorbed").map((event) => event.barrierId)).toEqual(["barrier.a", "barrier.b"])
    }
  })

  it("状态DOT绕过护盾，倒地时清除剩余护盾", () => {
    const poison: StatusDef = {
      id: "status.lethal-dot", name: "致命毒", kind: "lethal-dot", category: StatusCategory.Dot,
      ticks: "roundEnd", onTick: { type: "dot", ratioOfMaxHp: 1 },
    }
    const shield: SkillDef = {
      id: "test.dot-shield", name: "盾", tags: [SkillTag.Support], targeting: { side: TargetSide.Self },
      effects: [{ type: EffectType.ApplyBarrier, id: "barrier.dot", kind: "dot-shield", name: "盾", power: 500, duration: 3 }],
    }
    const applyPoison: SkillDef = {
      id: "test.poison", name: "施毒", tags: [SkillTag.Spell], targeting: { side: TargetSide.Enemy },
      effects: [{ type: EffectType.ApplyStatus, statusId: poison.id, duration: 1 }],
    }
    const battle = createBattle({
      seed: 1, versions: COMBAT_V6_PHASE_6B_VERSIONS, ruleset: daoyouDeterministicRulesetV3,
      skills: [shield, applyPoison], statusDefs: [poison],
      units: [
        unit("guarded", 0, { hp: 1000, maxHp: 1000, speed: 30, physicalAtk: 1, physicalDef: 1 }, { skills: [shield.id] }),
        unit("ally", 0, { hp: 1000, speed: 10, physicalAtk: 1, physicalDef: 1 }),
        unit("poisoner", 1, { hp: 1000, speed: 20, physicalAtk: 1, physicalDef: 1 }, { skills: [applyPoison.id] }),
      ],
    })
    battle.submit("guarded", { type: CommandType.Skill, skillId: shield.id, targets: ["guarded"] })
    battle.submit("ally", { type: CommandType.Defend })
    battle.submit("poisoner", { type: CommandType.Skill, skillId: applyPoison.id, targets: ["guarded"] })
    battle.lockAndResolve()
    expect(battle.unit("guarded").flags.downed).toBe(true)
    expect(battle.unit("guarded").barriers).toEqual([])
    expect(battle.log()).toContainEqual(expect.objectContaining({ type: EventType.BarrierChanged, barrierId: "barrier.dot", before: 500, after: 0, reason: "downed" }))
  })

  it("疗伤先提高可恢复上限但不自动回血", () => {
    const mend: SkillDef = {
      id: "test.mend", name: "疗伤", tags: [SkillTag.Support], targeting: { side: TargetSide.Ally },
      effects: [{ type: EffectType.RemoveWound, power: 100 }],
    }
    const battle = createBattle({
      seed: 1, versions: COMBAT_V6_PHASE_6B_VERSIONS, ruleset: daoyouDeterministicRulesetV3, skills: [mend],
      units: [
        unit("healer", 0, { hp: 1000, speed: 20, physicalAtk: 1, physicalDef: 1 }, { skills: [mend.id] }),
        unit("ally", 0, { hp: 500, maxHp: 1000, speed: 10, physicalAtk: 1, physicalDef: 1 }),
        unit("enemy", 1, { hp: 1000, speed: 1, physicalAtk: 1, physicalDef: 1000 }),
      ],
    })
    battle.unit("ally").wound = 300
    battle.submit("healer", { type: CommandType.Skill, skillId: mend.id, targets: ["ally"] })
    battle.submit("ally", { type: CommandType.Defend })
    battle.submit("enemy", { type: CommandType.Defend })
    battle.lockAndResolve()
    expect(battle.unit("ally")).toMatchObject({ wound: 200, attrs: { hp: 500 } })
    expect(battle.log()).toContainEqual(expect.objectContaining({ type: EventType.WoundChanged, before: 300, after: 200 }))
    expect(battle.log().some((event) => event.type === EventType.Heal)).toBe(false)
  })

  it("净化按Control、Debuff、Dot优先且遵守数量和不可驱散标志", () => {
    const statusDefs: StatusDef[] = [
      { id: "status.control", name: "控制", kind: "control", category: StatusCategory.Control },
      { id: "status.debuff", name: "减益", kind: "debuff", category: StatusCategory.Debuff },
      { id: "status.dot", name: "毒", kind: "dot", category: StatusCategory.Dot },
      { id: "status.fixed", name: "不可驱散", kind: "fixed", category: StatusCategory.Control, dispellable: false },
    ]
    const curse: SkillDef = {
      id: "test.curse", name: "加状态", tags: [SkillTag.Spell], targeting: { side: TargetSide.Enemy },
      effects: statusDefs.map((status) => ({ type: EffectType.ApplyStatus, statusId: status.id, duration: 3 })),
    }
    const cleanse: SkillDef = {
      id: "test.cleanse", name: "净化", tags: [SkillTag.Support], targeting: { side: TargetSide.Ally },
      effects: [{ type: EffectType.Dispel, categories: [StatusCategory.Control, StatusCategory.Debuff, StatusCategory.Dot], maxCount: 2 }],
    }
    const battle = createBattle({
      seed: 1, versions: COMBAT_V6_PHASE_6B_VERSIONS, ruleset: daoyouDeterministicRulesetV3,
      skills: [curse, cleanse], statusDefs,
      units: [
        unit("curse", 1, { hp: 1000, speed: 30, physicalAtk: 1, physicalDef: 1 }, { skills: [curse.id] }),
        unit("cleanser", 0, { hp: 1000, speed: 20, physicalAtk: 1, physicalDef: 1 }, { skills: [cleanse.id] }),
        unit("ally", 0, { hp: 1000, speed: 10, physicalAtk: 1, physicalDef: 1 }),
      ],
    })
    battle.submit("curse", { type: CommandType.Skill, skillId: curse.id, targets: ["ally"] })
    battle.submit("cleanser", { type: CommandType.Skill, skillId: cleanse.id, targets: ["ally"] })
    battle.submit("ally", { type: CommandType.Defend })
    battle.lockAndResolve()
    expect(battle.unit("ally").statuses.map((status) => status.id).sort()).toEqual(["status.dot", "status.fixed"])
  })

  it("净化可以用通用状态能力标志限定候选", () => {
    const statusDefs: StatusDef[] = [
      { id: "status.lock", name: "锢魂", kind: "lock", category: StatusCategory.Control, blocksRevive: true },
      { id: "status.control", name: "普通控制", kind: "control", category: StatusCategory.Control },
    ]
    const apply: SkillDef = {
      id: "test.apply-flags", name: "加状态", tags: [SkillTag.Spell], targeting: { side: TargetSide.Enemy },
      effects: statusDefs.map((status) => ({ type: EffectType.ApplyStatus, statusId: status.id, duration: 3 })),
    }
    const cleanse: SkillDef = {
      id: "test.cleanse-flags", name: "指定净化", tags: [SkillTag.Support], targeting: { side: TargetSide.Ally },
      effects: [{ type: EffectType.Dispel, categories: [StatusCategory.Control], includeStatusFlags: [StatusFlag.BlocksRevive], maxCount: 1 }],
    }
    const battle = createBattle({
      seed: 1, versions: COMBAT_V6_PHASE_6B_VERSIONS, ruleset: daoyouDeterministicRulesetV3,
      skills: [apply, cleanse], statusDefs,
      units: [
        unit("source", 1, { hp: 1000, speed: 30, physicalAtk: 1, physicalDef: 1 }, { skills: [apply.id] }),
        unit("cleanser", 0, { hp: 1000, speed: 20, physicalAtk: 1, physicalDef: 1 }, { skills: [cleanse.id] }),
        unit("ally", 0, { hp: 1000, speed: 10, physicalAtk: 1, physicalDef: 1 }),
      ],
    })
    battle.submit("source", { type: CommandType.Skill, skillId: apply.id, targets: ["ally"] })
    battle.submit("cleanser", { type: CommandType.Skill, skillId: cleanse.id, targets: ["ally"] })
    battle.submit("ally", { type: CommandType.Defend })
    battle.lockAndResolve()
    expect(battle.unit("ally").statuses.map((status) => status.id)).toEqual(["status.control"])
  })

  it("成功no-op仍执行successEffects，明确失败则不执行", () => {
    const success: SkillDef = {
      id: "test.success", name: "成功", tags: [SkillTag.Support], targeting: { side: TargetSide.Self },
      effects: [{ type: EffectType.Heal, power: 100 }],
      successEffects: [{ type: EffectType.ModifyResource, resourceId: "test.resource", amount: 1 }],
    }
    const battle = createBattle({
      seed: 1, versions: COMBAT_V6_PHASE_6B_VERSIONS, ruleset: daoyouDeterministicRulesetV3, skills: [success],
      units: [
        unit("source", 0, { hp: 1000, maxHp: 1000, speed: 20, physicalAtk: 1, physicalDef: 1 }, { skills: [success.id], resources: [{ id: "test.resource", name: "资源", current: 0, max: 6 }] }),
        unit("enemy", 1, { hp: 1000, speed: 1, physicalAtk: 1, physicalDef: 1000 }),
      ],
    })
    battle.submit("source", { type: CommandType.Skill, skillId: success.id, targets: ["source"] })
    battle.submit("enemy", { type: CommandType.Defend })
    battle.lockAndResolve()
    expect(battle.unit("source").resources[0].current).toBe(1)

    const blocked: StatusDef = { id: "test.soul-lock", name: "锢魂", kind: "soul-lock", category: StatusCategory.Control, blocksRevive: true, persistWhenDowned: true }
    const kill: SkillDef = {
      id: "test.kill", name: "击倒", tags: [SkillTag.Spell], targeting: { side: TargetSide.Enemy },
      effects: [
        { type: EffectType.ApplyStatus, statusId: blocked.id, duration: 3 },
        { type: EffectType.FixedHit, power: 9999 },
      ],
    }
    const revive: SkillDef = {
      id: "test.revive", name: "复活", tags: [SkillTag.Support], targeting: { side: TargetSide.Ally, includeDowned: true },
      effects: [{ type: EffectType.Revive, hpRatio: 0.2 }],
      successEffects: [{ type: EffectType.ModifyResource, resourceId: "test.resource", amount: 1 }],
    }
    const failed = createBattle({
      seed: 1, versions: COMBAT_V6_PHASE_6B_VERSIONS, ruleset: daoyouDeterministicRulesetV3,
      skills: [kill, revive], statusDefs: [blocked],
      units: [
        unit("killer", 1, { hp: 1000, speed: 30, physicalAtk: 1, physicalDef: 1 }, { skills: [kill.id] }),
        unit("reviver", 0, { hp: 1000, speed: 20, physicalAtk: 1, physicalDef: 1 }, { skills: [revive.id], resources: [{ id: "test.resource", name: "资源", current: 0, max: 6 }] }),
        unit("ally", 0, { hp: 100, maxHp: 1000, speed: 10, physicalAtk: 1, physicalDef: 1 }),
      ],
    })
    failed.submit("killer", { type: CommandType.Skill, skillId: kill.id, targets: ["ally"] })
    failed.submit("reviver", { type: CommandType.Skill, skillId: revive.id, targets: ["ally"] })
    failed.submit("ally", { type: CommandType.Defend })
    failed.lockAndResolve()
    expect(failed.unit("reviver").resources[0].current).toBe(0)
    expect(failed.log()).toContainEqual(expect.objectContaining({ type: EventType.ActionFailed, unitId: "reviver", reason: "revive-blocked" }))
  })

  it("效果条件按每个目标判断，首目标追击不会误伤其他目标", () => {
    const skill: SkillDef = {
      id: "test.primary", name: "首目标追击", tags: [SkillTag.Spell], formula: FormulaFamily.Fixed,
      targeting: { side: TargetSide.Enemy, count: 2 },
      effects: [
        { type: EffectType.FixedHit, power: 10 },
        { type: EffectType.FixedHit, power: 20, when: { targetSlot: "primary" } },
      ],
    }
    const battle = createBattle({
      seed: 1, versions: COMBAT_V6_PHASE_6B_VERSIONS, ruleset: daoyouDeterministicRulesetV3, skills: [skill],
      units: [
        unit("source", 0, { hp: 1000, speed: 20, physicalAtk: 1, physicalDef: 1 }, { skills: [skill.id] }),
        unit("primary", 1, { hp: 1000, speed: 2, physicalAtk: 1, physicalDef: 1 }),
        unit("secondary", 1, { hp: 1000, speed: 1, physicalAtk: 1, physicalDef: 1 }),
      ],
    })
    battle.submit("source", { type: CommandType.Skill, skillId: skill.id, targets: ["primary", "secondary"] })
    battle.submit("primary", { type: CommandType.Defend })
    battle.submit("secondary", { type: CommandType.Defend })
    battle.lockAndResolve()
    expect(battle.unit("primary").attrs.hp).toBe(970)
    expect(battle.unit("secondary").attrs.hp).toBe(990)
  })
})

describe("combat-v6 Phase 6B rules v3", () => {
  it("法术系数和法防忽略只进入v3公式，固定伤害保持不变", () => {
    const source = createUnit(unit("source", 0, { hp: 1000, speed: 10, physicalAtk: 1, physicalDef: 1, magicAtk: 200 }), 0)
    const target = createUnit(unit("target", 1, { hp: 1000, speed: 1, physicalAtk: 1, physicalDef: 1, magicDef: 100 }), 1)
    const common = { family: FormulaFamily.Spell, kind: DamageKind.Spell, source, target, coeff: 0.5, power: 100, fury: false }
    expect(daoyouFormulas.baseDamage(common)).toBe(200)
    expect(daoyouFormulasV3.baseDamage(common)).toBe(100)
    const ignoredTarget = createUnit(unit("ignored", 1, { hp: 1000, speed: 1, physicalAtk: 1, physicalDef: 1, magicDef: 50 }), 1)
    expect(daoyouFormulasV3.baseDamage({ ...common, target: ignoredTarget })).toBe(125)
    const fixed = { ...common, family: FormulaFamily.Fixed, kind: DamageKind.Fixed, power: 123 }
    expect(daoyouFormulas.baseDamage(fixed)).toBe(123)
    expect(daoyouFormulasV3.baseDamage(fixed)).toBe(123)
  })
})
