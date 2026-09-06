import { describe, expect, it } from "vitest"
import type { Attributes } from "@shared/types/cultivator"
import {
  COMBAT_V6_PHASE_6C_VERSIONS,
  COMBAT_V6_PHASE_6D_VERSIONS,
  COMBAT_V6_SECT_DEFINITIONS_V3,
  COMBAT_V6_SECT_DEFINITIONS_V4,
  CommandPolicy,
  CommandType,
  DamageKind,
  EffectType,
  EventType,
  JIUJIE_METHOD_ID,
  JIUJIE_PATH_ID,
  JIUJIE_SKILL_ID,
  JIUJIE_STATUS_ID,
  JIUJIE_V6_DEFINITION,
  SkillTag,
  StatusCategory,
  TargetSide,
  compileSectCombatV6V4,
  createBattle,
  daoyouDeterministicRulesetV5,
  projectCultivatorMultiSectV4ToCombatV6,
  projectCultivatorMultiSectV5ToCombatV6,
  validateCombatV6SectRegistryV4,
  type CultivatorManualStateV1,
  type SectCombatProgressV6,
  type SkillDef,
  type StatusDef,
} from "./index.ts"

const ATTRIBUTES: Attributes = { vitality: 10, strength: 10, spirit: 10, endurance: 10, speed: 10, willpower: 10 }
const manuals: CultivatorManualStateV1 = { version: 1, revision: 0, build: { slots: [] } }

function progress(pathId = JIUJIE_PATH_ID.Law, level = 180): SectCombatProgressV6 {
  return {
    version: 1,
    sectId: "jiujie",
    methods: Object.fromEntries(JIUJIE_V6_DEFINITION.methods.map((method) => [method.id, level])),
    meridianDepth: 0,
    activePathId: pathId,
    meridianLoadouts: JIUJIE_V6_DEFINITION.paths.map((path) => ({ pathId: path.id, nodeIds: [], revision: 1 })) as SectCombatProgressV6["meridianLoadouts"],
  }
}

function input(pathId = JIUJIE_PATH_ID.Law) {
  return {
    cultivator: { id: "jiujie-1", name: "九劫", realm: "渡劫" as const, realm_stage: "圆满" as const, attributes: { ...ATTRIBUTES } },
    side: 0 as const,
    slot: 0,
    resourcePolicy: "full" as const,
    sect: progress(pathId),
    equipment: {},
    manuals,
  }
}

function combatUnit(id: string, side: 0 | 1, speed: number, extra: Record<string, unknown> = {}) {
  return {
    id,
    name: id,
    side,
    kind: "player" as const,
    slot: 0,
    attrs: { hp: 1000, maxHp: 1000, mp: 1000, maxMp: 1000, speed, physicalAtk: 100, physicalDef: 10, magicAtk: 100, magicDef: 10 },
    ...extra,
  }
}

describe("combat-v6 Phase 6D Core 原语", () => {
  it("概率分支在成本后只判定一次，失败分支仍是成功施法", () => {
    const skill: SkillDef = {
      id: "test.random_branch",
      name: "概率裁定",
      costMp: 20,
      tags: [SkillTag.Spell],
      targeting: { side: TargetSide.Enemy, count: 1 },
      effects: [{
        type: EffectType.RandomBranch,
        branchId: "test.branch",
        chance: 0.5,
        successEffects: [{ type: EffectType.FixedHit, power: 100, cannotKill: true }],
        failureEffects: [{ type: EffectType.FixedHit, power: 20, cannotKill: true }],
      }],
    }
    const run = (seed: number) => {
      const battle = createBattle({ seed, versions: COMBAT_V6_PHASE_6D_VERSIONS, ruleset: daoyouDeterministicRulesetV5, skills: [skill], units: [combatUnit("source", 0, 10, { skills: [skill.id] }), combatUnit("target", 1, 1)] })
      battle.submit("source", { type: CommandType.Skill, skillId: skill.id, targets: ["target"] })
      battle.submit("target", { type: CommandType.Defend })
      battle.lockAndResolve()
      return battle
    }
    const failed = run(1)
    expect(failed.unit("source").attrs.mp).toBe(980)
    expect(failed.unit("target").attrs.hp).toBe(980)
    expect(failed.log()).toContainEqual(expect.objectContaining({ type: EventType.ChanceResolved, branchId: "test.branch", chance: 0.5, success: false }))
    expect(failed.log().some((event) => event.type === EventType.ActionFailed)).toBe(false)
    const succeeded = run(7)
    expect(succeeded.unit("target").attrs.hp).toBe(900)
    expect(succeeded.log()).toContainEqual(expect.objectContaining({ type: EventType.ChanceResolved, success: true }))
  })

  it("非致命打击先消耗护盾，再只扣至1HP", () => {
    const skill: SkillDef = { id: "test.nonlethal", name: "非致命", tags: [SkillTag.Spell], targeting: { side: TargetSide.Enemy }, effects: [{ type: EffectType.FixedHit, power: 500, cannotKill: true }] }
    const battle = createBattle({ seed: 1, versions: COMBAT_V6_PHASE_6D_VERSIONS, ruleset: daoyouDeterministicRulesetV5, skills: [skill], units: [combatUnit("source", 0, 10, { skills: [skill.id] }), combatUnit("target", 1, 1, { attrs: { ...combatUnit("x", 1, 1).attrs, hp: 100 } })] })
    battle.unit("target").barriers.push({ id: "barrier", kind: "barrier", name: "盾", current: 50, remainingRounds: 2, sourceId: "target", appliedRound: 0 })
    battle.submit("source", { type: CommandType.Skill, skillId: skill.id, targets: ["target"] })
    battle.submit("target", { type: CommandType.Defend })
    battle.lockAndResolve()
    expect(battle.unit("target").attrs.hp).toBe(1)
    expect(battle.unit("target").flags.downed).toBe(false)
    expect(battle.log()).toContainEqual(expect.objectContaining({ type: EventType.BarrierChanged, reason: "absorbed", before: 50, after: 0 }))
    expect(battle.log()).toContainEqual(expect.objectContaining({ type: EventType.Damage, amount: 450, hpAfter: 1 }))
  })

  it("错乱只改写物理攻击首目标，并按seed确定地允许攻击队友", () => {
    const status: StatusDef = { id: "test.confuse", name: "错乱", kind: "test.confuse", category: StatusCategory.Control, blocksSpell: true, commandPolicy: CommandPolicy.RandomAttackTarget }
    const physical: SkillDef = { id: "test.physical", name: "群体物理", tags: [SkillTag.Physical], targeting: { side: TargetSide.Enemy, mode: "fill", count: 2 }, effects: [{ type: EffectType.PhysicalHit, coeff: 1, cannotMiss: true }] }
    const battle = createBattle({ seed: 7, versions: COMBAT_V6_PHASE_6D_VERSIONS, ruleset: daoyouDeterministicRulesetV5, skills: [physical], statusDefs: [status], units: [combatUnit("source", 0, 20, { skills: [physical.id] }), combatUnit("ally", 0, 5), combatUnit("enemy", 1, 1)] })
    battle.unit("source").statuses.push({ id: status.id, kind: status.kind, remainingRounds: 2, sourceId: "enemy", appliedRound: 0, speedMod: 0, attrMods: {}, damageTakenPhysical: 1, damageTakenSpell: 1, healTaken: 1, healDealt: 1, stacks: 1 })
    battle.submit("source", { type: CommandType.Skill, skillId: physical.id, targets: ["enemy"] })
    battle.submit("ally", { type: CommandType.Defend })
    battle.submit("enemy", { type: CommandType.Defend })
    battle.lockAndResolve()
    const action = battle.log().find((event) => event.type === EventType.ActionStart && event.unitId === "source")
    expect(action).toMatchObject({ command: { type: CommandType.Skill, targets: ["ally", "enemy"] } })
    expect(battle.unit("ally").attrs.hp).toBeLessThan(1000)
  })

  it("错乱封法后的普攻兜底也重新随机目标", () => {
    const status: StatusDef = { id: "test.confuse_fallback", name: "错乱", kind: "test.confuse_fallback", category: StatusCategory.Control, blocksSpell: true, commandPolicy: CommandPolicy.RandomAttackTarget }
    const spell: SkillDef = { id: "test.spell", name: "法术", tags: [SkillTag.Spell], targeting: { side: TargetSide.Enemy }, effects: [{ type: EffectType.SpellHit, power: 100 }] }
    const battle = createBattle({ seed: 7, versions: COMBAT_V6_PHASE_6D_VERSIONS, ruleset: daoyouDeterministicRulesetV5, skills: [spell], statusDefs: [status], units: [combatUnit("source", 0, 20, { skills: [spell.id] }), combatUnit("ally", 0, 5), combatUnit("enemy", 1, 1)] })
    battle.unit("source").statuses.push({ id: status.id, kind: status.kind, remainingRounds: 2, sourceId: "enemy", appliedRound: 0, speedMod: 0, attrMods: {}, damageTakenPhysical: 1, damageTakenSpell: 1, healTaken: 1, healDealt: 1, stacks: 1 })
    battle.submit("source", { type: CommandType.Skill, skillId: spell.id, targets: ["enemy"] })
    battle.submit("ally", { type: CommandType.Defend })
    battle.submit("enemy", { type: CommandType.Defend })
    battle.lockAndResolve()
    expect(battle.log()).toContainEqual(expect.objectContaining({ type: EventType.ActionFailed, unitId: "source", reason: "sealed" }))
    expect(battle.log()).toContainEqual(expect.objectContaining({ type: EventType.ActionStart, unitId: "source", command: { type: CommandType.Attack, target: "ally" } }))
  })
})

describe("combat-v6 Phase 6D 九劫内容与投影", () => {
  it("V4注册五宗门，六心法、共享六技能、双流派和42节点完整", () => {
    expect(Object.keys(COMBAT_V6_SECT_DEFINITIONS_V3)).toEqual(["lingxiao", "youdu", "wuxiang", "tianyan"])
    expect(Object.keys(COMBAT_V6_SECT_DEFINITIONS_V4)).toEqual(["lingxiao", "youdu", "wuxiang", "tianyan", "jiujie"])
    expect(validateCombatV6SectRegistryV4()).toEqual([])
    expect(JIUJIE_V6_DEFINITION.methods).toHaveLength(6)
    expect(JIUJIE_V6_DEFINITION.paths.map((path) => path.name)).toEqual(["天律镇妖", "九霄驭雷"])
    expect(JIUJIE_V6_DEFINITION.skills).toHaveLength(6)
    expect(JIUJIE_V6_DEFINITION.paths.flatMap((path) => path.nodes)).toHaveLength(42)
  })

  it("42节点逐项改变编译结果，两条完整路径均可稳定编译", () => {
    for (const path of JIUJIE_V6_DEFINITION.paths) {
      for (const node of path.nodes) {
        const priorIds = path.nodes.filter((candidate) => candidate.layer < node.layer && candidate.slot === 1).map((candidate) => candidate.id)
        const make = (ids: string[]) => {
          const value = progress(path.id)
          value.meridianDepth = node.layer
          value.meridianLoadouts = value.meridianLoadouts.map((loadout) => ({ ...loadout, nodeIds: loadout.pathId === path.id ? ids : [] })) as SectCombatProgressV6["meridianLoadouts"]
          return compileSectCombatV6V4({ progress: value, characterLevel: 180 })
        }
        const before = make(priorIds)
        const after = make([...priorIds, node.id])
        expect(before.ok && after.ok, node.id).toBe(true)
        if (!before.ok || !after.ok) continue
        const view = (projection: typeof before.projection) => JSON.stringify({ skills: projection.activeSkillIds, passives: projection.passiveSkillIds, panel: projection.panel, overrides: projection.skillOverrides })
        expect(view(after.projection), node.id).not.toBe(view(before.projection))
      }
    }
  })

  it("character_build_v5接受九劫且旧V4入口显式拒绝", () => {
    const result = projectCultivatorMultiSectV5ToCombatV6(input())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.versions).toEqual(COMBAT_V6_PHASE_6D_VERSIONS)
    expect(result.unit.skills).toEqual(expect.arrayContaining(Object.values(JIUJIE_SKILL_ID).slice(0, 6)))
    expect(result.unit.resources?.map((resource) => resource.id)).toEqual(["combat.resource.rage"])
    expect(projectCultivatorMultiSectV4ToCombatV6(input())).toMatchObject({ ok: false, diagnostics: expect.arrayContaining([expect.objectContaining({ code: "INVALID_SECT_ID" })]), versions: COMBAT_V6_PHASE_6C_VERSIONS })
  })

  it("五雷两分支按当前HP/MP结算且非致命", () => {
    const compiled = compileSectCombatV6V4({ progress: progress(), characterLevel: 180 })
    expect(compiled.ok).toBe(true)
    if (!compiled.ok) return
    const run = (seed: number) => {
      const battle = createBattle({ seed, versions: COMBAT_V6_PHASE_6D_VERSIONS, ruleset: daoyouDeterministicRulesetV5, skills: compiled.projection.skills, statusDefs: compiled.projection.statusDefs, units: [combatUnit("source", 0, 10, { skills: [JIUJIE_SKILL_ID.FiveThunder], skillLevels: { [JIUJIE_SKILL_ID.FiveThunder]: 180 } }), combatUnit("target", 1, 1)] })
      battle.submit("source", { type: CommandType.Skill, skillId: JIUJIE_SKILL_ID.FiveThunder, targets: ["target"] })
      battle.submit("target", { type: CommandType.Defend })
      battle.lockAndResolve()
      return battle
    }
    expect(run(1).unit("target")).toMatchObject({ attrs: { hp: 950, mp: 950 } })
    expect(run(7).unit("target")).toMatchObject({ attrs: { hp: 750, mp: 750 } })
  })

  it("电芒可跨施法者叠加，引爆归当前施法者并整印消费", () => {
    const projected = projectCultivatorMultiSectV5ToCombatV6(input(JIUJIE_PATH_ID.Thunder))
    expect(projected.ok).toBe(true)
    if (!projected.ok) return
    const thunderProgress = progress(JIUJIE_PATH_ID.Thunder)
    thunderProgress.meridianDepth = 3
    thunderProgress.meridianLoadouts = thunderProgress.meridianLoadouts.map((loadout) => ({
      ...loadout,
      nodeIds: loadout.pathId === JIUJIE_PATH_ID.Thunder
        ? ["jiujie.node.thunder.1.1", "jiujie.node.thunder.2.1", "jiujie.node.thunder.3.1"]
        : [],
    })) as SectCombatProgressV6["meridianLoadouts"]
    const compiled = compileSectCombatV6V4({ progress: thunderProgress, characterLevel: 180 })
    expect(compiled.ok).toBe(true)
    if (!compiled.ok) return
    const battle = createBattle({ seed: 1, versions: COMBAT_V6_PHASE_6D_VERSIONS, ruleset: daoyouDeterministicRulesetV5, skills: [...projected.skills, ...compiled.projection.skills], statusDefs: projected.statusDefs, units: [
      { ...projected.unit, id: "first", slot: 0, attrs: { ...projected.unit.attrs, mp: 9999, maxMp: 9999, speed: 100 } },
      { ...projected.unit, id: "second", slot: 1, attrs: { ...projected.unit.attrs, mp: 9999, maxMp: 9999, speed: 90 }, skills: [...(projected.unit.skills ?? []), JIUJIE_SKILL_ID.StartlingThunder], skillLevels: { ...(projected.unit.skillLevels ?? {}), [JIUJIE_SKILL_ID.StartlingThunder]: 180 } },
      combatUnit("target", 1, 1, { attrs: { ...combatUnit("x", 1, 1).attrs, hp: 100000, maxHp: 100000 } }),
    ] })
    battle.submit("first", { type: CommandType.Skill, skillId: JIUJIE_SKILL_ID.Thunderstorm, targets: ["target"] })
    battle.submit("second", { type: CommandType.Defend })
    battle.submit("target", { type: CommandType.Defend })
    battle.lockAndResolve()
    expect(battle.unit("target").statuses.find((status) => status.id === JIUJIE_STATUS_ID.Electric)).toMatchObject({ stacks: 1, sourceId: "first" })
    battle.submit("first", { type: CommandType.Defend })
    battle.submit("second", { type: CommandType.Skill, skillId: JIUJIE_SKILL_ID.StartlingThunder, targets: ["target"] })
    battle.submit("target", { type: CommandType.Defend })
    battle.lockAndResolve()
    expect(battle.unit("target").statuses.some((status) => status.id === JIUJIE_STATUS_ID.Electric)).toBe(false)
    expect(battle.log()).toContainEqual(expect.objectContaining({ type: EventType.MechanicTriggered, sourceId: "second", targetId: "target" }))
    expect(battle.log()).toContainEqual(expect.objectContaining({ type: EventType.StatusRemoved, statusId: JIUJIE_STATUS_ID.Electric, reason: "consumed" }))
    expect(battle.log()).toContainEqual(expect.objectContaining({ type: EventType.Damage, sourceId: "second", targetId: "target", kind: DamageKind.Fixed }))
  })

  it("心法归属和共享技能等级严格来自对应心法", () => {
    const value = progress(JIUJIE_PATH_ID.Law, 100)
    value.methods[JIUJIE_METHOD_ID.Thunder] = 60
    const compiled = compileSectCombatV6V4({ progress: value, characterLevel: 100 })
    expect(compiled.ok).toBe(true)
    if (!compiled.ok) return
    expect(compiled.projection.skillLevels[JIUJIE_SKILL_ID.Thunderstorm]).toBe(60)
    expect(compiled.projection.skillLevels[JIUJIE_SKILL_ID.FiveThunder]).toBe(100)
  })

  it("五宗门可进入同一BattleSession且同seed事件流一致", () => {
    const projections = Object.values(COMBAT_V6_SECT_DEFINITIONS_V4).map((definition, index) => {
      const sect: SectCombatProgressV6 = {
        version: 1,
        sectId: definition.id,
        methods: Object.fromEntries(definition.methods.map((method) => [method.id, 100])),
        meridianDepth: 0,
        activePathId: definition.paths[0].id,
        meridianLoadouts: definition.paths.map((path) => ({ pathId: path.id, nodeIds: [], revision: 1 })) as SectCombatProgressV6["meridianLoadouts"],
      }
      return projectCultivatorMultiSectV5ToCombatV6({
        cultivator: { id: `sect-${index}`, name: definition.name, realm: "渡劫", realm_stage: "圆满", attributes: { ...ATTRIBUTES } },
        side: index < 3 ? 0 : 1,
        slot: index % 3,
        resourcePolicy: "full",
        sect,
        equipment: {},
        manuals,
      })
    })
    expect(projections.every((projection) => projection.ok)).toBe(true)
    if (!projections.every((projection) => projection.ok)) return
    const successful = projections.filter((projection): projection is Extract<typeof projection, { ok: true }> => projection.ok)
    const skills = [...new Map(successful.flatMap((projection) => projection.skills).map((skill) => [skill.id, skill])).values()]
    const statusDefs = [...new Map(successful.flatMap((projection) => projection.statusDefs).map((status) => [status.id, status])).values()]
    const run = () => {
      const battle = createBattle({ seed: 42, versions: COMBAT_V6_PHASE_6D_VERSIONS, ruleset: daoyouDeterministicRulesetV5, skills, statusDefs, units: successful.map((projection) => projection.unit) })
      for (const projection of successful) battle.submit(projection.unit.id!, { type: CommandType.Defend })
      battle.lockAndResolve()
      return { state: battle.snapshot(), events: battle.log() }
    }
    expect(run()).toEqual(run())
  })
})
