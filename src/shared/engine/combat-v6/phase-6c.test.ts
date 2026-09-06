import { describe, expect, it } from "vitest"
import type { Attributes } from "@shared/types/cultivator"
import {
  COMBAT_V6_PHASE_6C_VERSIONS,
  COMBAT_V6_SECT_DEFINITIONS_V2,
  COMBAT_V6_SECT_DEFINITIONS_V3,
  CommandType,
  DamageKind,
  EventType,
  TIANYAN_MARK_KIND,
  TIANYAN_PATH_ID,
  TIANYAN_REACTIONS_V1,
  TIANYAN_RESOURCE_ID,
  TIANYAN_SKILL_ID,
  TIANYAN_STATUS_ID,
  TIANYAN_V6_DEFINITION,
  compileSectCombatV6V3,
  createBattle,
  daoyouDeterministicRulesetV4,
  projectCultivatorMultiSectV3ToCombatV6,
  projectCultivatorMultiSectV4ToCombatV6,
  validateCombatV6SectRegistryV3,
  validateTianyanReactionMatrixV1,
  type CultivatorManualStateV1,
  type SectCombatProgressV6,
} from "./index.ts"

const ATTRIBUTES: Attributes = { vitality: 10, strength: 10, spirit: 10, endurance: 10, speed: 10, willpower: 10 }
const manuals: CultivatorManualStateV1 = { version: 1, revision: 0, build: { slots: [] } }

function progress(pathId = TIANYAN_PATH_ID.Hetu, level = 180): SectCombatProgressV6 {
  return {
    version: 1,
    sectId: "tianyan",
    methods: Object.fromEntries(TIANYAN_V6_DEFINITION.methods.map((method) => [method.id, level])),
    meridianDepth: 0,
    activePathId: pathId,
    meridianLoadouts: TIANYAN_V6_DEFINITION.paths.map((path) => ({ pathId: path.id, nodeIds: [], revision: 1 })) as SectCombatProgressV6["meridianLoadouts"],
  }
}

function input(pathId = TIANYAN_PATH_ID.Hetu) {
  return {
    cultivator: { id: "tianyan-1", name: "天衍", realm: "渡劫" as const, realm_stage: "圆满" as const, attributes: { ...ATTRIBUTES } },
    side: 0 as const,
    slot: 0,
    resourcePolicy: "full" as const,
    sect: progress(pathId),
    equipment: {},
    manuals,
  }
}

describe("combat-v6 Phase 6C 天衍内容与投影", () => {
  it("V3注册四宗门且反应矩阵完整", () => {
    expect(Object.keys(COMBAT_V6_SECT_DEFINITIONS_V2)).toEqual(["lingxiao", "youdu", "wuxiang"])
    expect(Object.keys(COMBAT_V6_SECT_DEFINITIONS_V3)).toEqual(["lingxiao", "youdu", "wuxiang", "tianyan"])
    expect(validateCombatV6SectRegistryV3()).toEqual([])
    expect(validateTianyanReactionMatrixV1()).toEqual([])
    expect(TIANYAN_REACTIONS_V1.filter((reaction) => reaction.kind === "generate")).toHaveLength(5)
    expect(TIANYAN_REACTIONS_V1.filter((reaction) => reaction.kind === "overcome")).toHaveLength(5)
    expect(TIANYAN_V6_DEFINITION.methods).toHaveLength(6)
    expect(TIANYAN_V6_DEFINITION.paths.flatMap((path) => path.nodes)).toHaveLength(42)
  })

  it("42节点单独选择时都能改变编译结果", () => {
    for (const path of TIANYAN_V6_DEFINITION.paths) {
      for (const node of path.nodes) {
        const priorIds = path.nodes.filter((candidate) => candidate.layer < node.layer && candidate.slot === 1).map((candidate) => candidate.id)
        const before = progress(path.id)
        before.meridianDepth = node.layer
        before.meridianLoadouts = before.meridianLoadouts.map((loadout) => ({ ...loadout, nodeIds: loadout.pathId === path.id ? priorIds : [] })) as SectCombatProgressV6["meridianLoadouts"]
        const baseline = compileSectCombatV6V3({ progress: before, characterLevel: 180 })
        expect(baseline.ok).toBe(true)
        if (!baseline.ok) continue
        const selected = progress(path.id)
        selected.meridianDepth = node.layer
        selected.meridianLoadouts = selected.meridianLoadouts.map((loadout) => ({
          ...loadout,
          nodeIds: loadout.pathId === path.id ? [...priorIds, node.id] : [],
        })) as SectCombatProgressV6["meridianLoadouts"]
        const result = compileSectCombatV6V3({ progress: selected, characterLevel: 180 })
        expect(result.ok, node.id).toBe(true)
        if (!result.ok) continue
        const view = (value: typeof result.projection) => JSON.stringify({
          skills: value.activeSkillIds,
          passives: value.passiveSkillIds,
          panel: value.panel,
          overrides: value.skillOverrides,
        })
        expect(view(result.projection), node.id).not.toBe(view(baseline.projection))
      }
    }
  })

  it("character_build_v4投影天衍技能、衍数和战意，V3入口拒绝", () => {
    const result = projectCultivatorMultiSectV4ToCombatV6(input())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.versions).toEqual(COMBAT_V6_PHASE_6C_VERSIONS)
    expect(result.unit.skills).toEqual(expect.arrayContaining([TIANYAN_SKILL_ID.Wood, TIANYAN_SKILL_ID.Transfer, TIANYAN_SKILL_ID.HetuUltimate]))
    expect(result.unit.resources?.map((resource) => [resource.id, resource.current, resource.max])).toEqual([
      [TIANYAN_RESOURCE_ID, 0, 3],
      ["combat.resource.rage", 0, 150],
    ])
    expect(projectCultivatorMultiSectV3ToCombatV6(input())).toMatchObject({ ok: false })
  })

  it("共享辅助按20/40/60级解锁，终式随流派授予", () => {
    for (const [level, expected] of [
      [19, []],
      [20, [TIANYAN_SKILL_ID.Formation]],
      [40, [TIANYAN_SKILL_ID.Formation, TIANYAN_SKILL_ID.Transfer]],
      [60, [TIANYAN_SKILL_ID.Formation, TIANYAN_SKILL_ID.Transfer, TIANYAN_SKILL_ID.Ward, TIANYAN_SKILL_ID.HetuUltimate]],
    ] as const) {
      const result = compileSectCombatV6V3({ progress: progress(TIANYAN_PATH_ID.Hetu, level), characterLevel: Math.max(10, level) })
      expect(result.ok).toBe(true)
      if (!result.ok) continue
      const gated = result.projection.activeSkillIds.filter((id) => [TIANYAN_SKILL_ID.Formation, TIANYAN_SKILL_ID.Transfer, TIANYAN_SKILL_ID.Ward, TIANYAN_SKILL_ID.HetuUltimate].includes(id as never))
      expect(gated).toEqual(expected)
    }
  })

  it("队友可消费法印，反应归当前触发者并换成新印", () => {
    const projected = projectCultivatorMultiSectV4ToCombatV6(input())
    expect(projected.ok).toBe(true)
    if (!projected.ok) return
    const first = { ...projected.unit, id: "first", slot: 0, attrs: { ...projected.unit.attrs, speed: 100, mp: 9999, maxMp: 9999 } }
    const second = { ...projected.unit, id: "second", slot: 1, attrs: { ...projected.unit.attrs, speed: 90, mp: 9999, maxMp: 9999 }, resources: projected.unit.resources?.map((resource) => ({ ...resource })) }
    const battle = createBattle({
      seed: 1,
      versions: COMBAT_V6_PHASE_6C_VERSIONS,
      ruleset: daoyouDeterministicRulesetV4,
      skills: projected.skills,
      statusDefs: projected.statusDefs,
      units: [first, second, { id: "enemy", name: "enemy", side: 1, kind: "player", slot: 0, attrs: { hp: 20000, maxHp: 20000, mp: 100, maxMp: 100, speed: 1, physicalAtk: 1, physicalDef: 1, magicDef: 20 } }],
    })
    battle.submit("first", { type: CommandType.Skill, skillId: TIANYAN_SKILL_ID.Wood, targets: ["enemy"] })
    battle.submit("second", { type: CommandType.Defend })
    battle.submit("enemy", { type: CommandType.Defend })
    battle.lockAndResolve()
    expect(battle.unit("enemy").statuses.find((status) => status.kind === TIANYAN_MARK_KIND)).toMatchObject({ id: TIANYAN_STATUS_ID.WoodMark, sourceId: "first" })

    battle.submit("first", { type: CommandType.Defend })
    battle.submit("second", { type: CommandType.Skill, skillId: TIANYAN_SKILL_ID.Fire, targets: ["enemy"] })
    battle.submit("enemy", { type: CommandType.Defend })
    battle.lockAndResolve()
    expect(battle.log()).toContainEqual(expect.objectContaining({ type: EventType.MechanicTriggered, mechanicId: "tianyan.reaction.wildfire", sourceId: "second", targetId: "enemy" }))
    expect(battle.log()).toContainEqual(expect.objectContaining({ type: EventType.StatusRemoved, statusId: TIANYAN_STATUS_ID.WoodMark, reason: "consumed" }))
    expect(battle.unit("second").resources.find((resource) => resource.id === TIANYAN_RESOURCE_ID)?.current).toBe(1)
    expect(battle.unit("first").resources.find((resource) => resource.id === TIANYAN_RESOURCE_ID)?.current).toBe(0)
    expect(battle.unit("enemy").statuses.find((status) => status.kind === TIANYAN_MARK_KIND)).toMatchObject({ id: TIANYAN_STATUS_ID.FireMark, sourceId: "second" })
    expect(battle.log()).toContainEqual(expect.objectContaining({ type: EventType.Damage, sourceId: "second", targetId: "enemy", kind: DamageKind.Fixed }))
  })

  it("河洛传印主目标无印时在支付前失败并转为普攻", () => {
    const projected = projectCultivatorMultiSectV4ToCombatV6(input())
    expect(projected.ok).toBe(true)
    if (!projected.ok) return
    const battle = createBattle({
      seed: 1,
      versions: COMBAT_V6_PHASE_6C_VERSIONS,
      ruleset: daoyouDeterministicRulesetV4,
      skills: projected.skills,
      statusDefs: projected.statusDefs,
      units: [
        { ...projected.unit, id: "caster", attrs: { ...projected.unit.attrs, mp: 9999, maxMp: 9999, speed: 100 } },
        { id: "enemy", name: "enemy", side: 1, kind: "player", slot: 0, attrs: { hp: 10000, maxHp: 10000, speed: 1, physicalAtk: 1, physicalDef: 1, magicDef: 20 } },
      ],
    })
    battle.submit("caster", { type: CommandType.Skill, skillId: TIANYAN_SKILL_ID.Transfer, targets: ["enemy"] })
    battle.submit("enemy", { type: CommandType.Defend })
    battle.lockAndResolve()
    expect(battle.unit("caster").attrs.mp).toBe(9999)
    expect(battle.log()).toContainEqual(expect.objectContaining({ type: EventType.ActionFailed, unitId: "caster", reason: "no-target" }))
    expect(battle.log()).toContainEqual(expect.objectContaining({ type: EventType.Hit, sourceId: "caster", targetId: "enemy", kind: DamageKind.Physical }))
  })

  it("25种有序法印组合稳定分为续印、反应与普通覆盖", () => {
    const projected = projectCultivatorMultiSectV4ToCombatV6(input())
    expect(projected.ok).toBe(true)
    if (!projected.ok) return
    const entries = [
      ["wood", TIANYAN_STATUS_ID.WoodMark, TIANYAN_SKILL_ID.Wood],
      ["fire", TIANYAN_STATUS_ID.FireMark, TIANYAN_SKILL_ID.Fire],
      ["earth", TIANYAN_STATUS_ID.EarthMark, TIANYAN_SKILL_ID.Earth],
      ["metal", TIANYAN_STATUS_ID.MetalMark, TIANYAN_SKILL_ID.Metal],
      ["water", TIANYAN_STATUS_ID.WaterMark, TIANYAN_SKILL_ID.Water],
    ] as const
    for (const [oldElement, oldStatus] of entries) {
      for (const [newElement, newStatus, skillId] of entries) {
        const battle = createBattle({
          seed: 1,
          versions: COMBAT_V6_PHASE_6C_VERSIONS,
          ruleset: daoyouDeterministicRulesetV4,
          skills: projected.skills,
          statusDefs: projected.statusDefs,
          units: [
            { ...projected.unit, id: "caster", attrs: { ...projected.unit.attrs, mp: 9999, maxMp: 9999, speed: 100 }, resources: projected.unit.resources?.map((resource) => ({ ...resource })) },
            { id: "enemy", name: "enemy", side: 1, kind: "player", slot: 0, attrs: { hp: 100000, maxHp: 100000, speed: 1, physicalAtk: 100, physicalDef: 100, magicAtk: 100, magicDef: 100 } },
          ],
        })
        battle.unit("enemy").statuses.push({ id: oldStatus, kind: TIANYAN_MARK_KIND, remainingRounds: 2, sourceId: "ally", appliedRound: 0, speedMod: 0, attrMods: {}, damageTakenPhysical: 1, damageTakenSpell: 1, healTaken: 1, healDealt: 1, stacks: 1 })
        battle.submit("caster", { type: CommandType.Skill, skillId, targets: ["enemy"] })
        battle.submit("enemy", { type: CommandType.Defend })
        battle.lockAndResolve()
        const expected = TIANYAN_REACTIONS_V1.find((reaction) => reaction.oldElement === oldElement && reaction.newElement === newElement)
        const mechanics = battle.log().filter((event) => event.type === EventType.MechanicTriggered)
        expect(mechanics, `${oldElement}->${newElement}`).toHaveLength(expected ? 1 : 0)
        expect(battle.unit("caster").resources.find((resource) => resource.id === TIANYAN_RESOURCE_ID)?.current, `${oldElement}->${newElement}`).toBe(expected ? 1 : 0)
        expect(battle.unit("enemy").statuses.find((status) => status.kind === TIANYAN_MARK_KIND)?.id, `${oldElement}->${newElement}`).toBe(newStatus)
      }
    }
  })

  it("主伤全额被盾吸收仍触发反应，追伤继续消耗护盾", () => {
    const projected = projectCultivatorMultiSectV4ToCombatV6(input())
    expect(projected.ok).toBe(true)
    if (!projected.ok) return
    const battle = createBattle({
      seed: 1,
      versions: COMBAT_V6_PHASE_6C_VERSIONS,
      ruleset: daoyouDeterministicRulesetV4,
      skills: projected.skills,
      statusDefs: projected.statusDefs,
      units: [
        { ...projected.unit, id: "caster", attrs: { ...projected.unit.attrs, mp: 9999, maxMp: 9999, speed: 100 } },
        { id: "enemy", name: "enemy", side: 1, kind: "player", slot: 0, attrs: { hp: 10000, maxHp: 10000, speed: 1, physicalAtk: 1, physicalDef: 1, magicDef: 20 } },
      ],
    })
    battle.unit("enemy").statuses.push({ id: TIANYAN_STATUS_ID.FireMark, kind: TIANYAN_MARK_KIND, remainingRounds: 2, sourceId: "ally", appliedRound: 0, speedMod: 0, attrMods: {}, damageTakenPhysical: 1, damageTakenSpell: 1, healTaken: 1, healDealt: 1, stacks: 1 })
    battle.unit("enemy").barriers.push({ id: "test.barrier", kind: "test.barrier", name: "测试盾", current: 10000, remainingRounds: 2, sourceId: "enemy", appliedRound: 0 })
    battle.submit("caster", { type: CommandType.Skill, skillId: TIANYAN_SKILL_ID.Water, targets: ["enemy"] })
    battle.submit("enemy", { type: CommandType.Defend })
    battle.lockAndResolve()
    expect(battle.unit("enemy").attrs.hp).toBe(10000)
    expect(battle.log()).toContainEqual(expect.objectContaining({ type: EventType.MechanicTriggered, mechanicId: "tianyan.reaction.evaporate" }))
    expect(battle.log().filter((event) => event.type === EventType.BarrierChanged && event.reason === "absorbed")).toHaveLength(2)
    expect(battle.log().some((event) => event.type === EventType.Damage)).toBe(false)
  })

  it("河洛传印复制剩余时长，不刷新主目标且不触发反应", () => {
    const projected = projectCultivatorMultiSectV4ToCombatV6(input())
    expect(projected.ok).toBe(true)
    if (!projected.ok) return
    const battle = createBattle({
      seed: 1,
      versions: COMBAT_V6_PHASE_6C_VERSIONS,
      ruleset: daoyouDeterministicRulesetV4,
      skills: projected.skills,
      statusDefs: projected.statusDefs,
      units: [
        { ...projected.unit, id: "caster", attrs: { ...projected.unit.attrs, mp: 9999, maxMp: 9999, speed: 100 } },
        ...[1, 2, 3].map((slot) => ({ id: `enemy-${slot}`, name: `enemy-${slot}`, side: 1 as const, kind: "player" as const, slot, attrs: { hp: 10000, maxHp: 10000, speed: slot, physicalAtk: 1, physicalDef: 1, magicDef: 20 } })),
      ],
    })
    battle.submit("caster", { type: CommandType.Skill, skillId: TIANYAN_SKILL_ID.Wood, targets: ["enemy-1"] })
    for (const slot of [1, 2, 3]) battle.submit(`enemy-${slot}`, { type: CommandType.Defend })
    battle.lockAndResolve()
    const remaining = battle.unit("enemy-1").statuses.find((status) => status.id === TIANYAN_STATUS_ID.WoodMark)?.remainingRounds
    battle.submit("caster", { type: CommandType.Skill, skillId: TIANYAN_SKILL_ID.Transfer, targets: ["enemy-1"] })
    for (const slot of [1, 2, 3]) battle.submit(`enemy-${slot}`, { type: CommandType.Defend })
    battle.lockAndResolve()
    expect(battle.unit("enemy-1").statuses.find((status) => status.id === TIANYAN_STATUS_ID.WoodMark)?.remainingRounds).toBe((remaining ?? 0) - 1)
    expect(battle.unit("enemy-2").statuses.find((status) => status.id === TIANYAN_STATUS_ID.WoodMark)?.remainingRounds).toBe(remaining)
    expect(battle.unit("enemy-3").statuses.find((status) => status.id === TIANYAN_STATUS_ID.WoodMark)?.remainingRounds).toBe(remaining)
    expect(battle.log().filter((event) => event.type === EventType.MechanicTriggered)).toHaveLength(0)
  })
})
