import { describe, expect, it } from "vitest"
import type { Attributes } from "@shared/types/cultivator"
import type { CultivatorCondition } from "@shared/types/condition"
import {
  COMBAT_V6_PHASE_4B_VERSIONS,
  CommandType,
  DAO_EQUIPMENT_ART_ID,
  DAO_EQUIPMENT_ART_SKILL_ID,
  DAO_EQUIPMENT_ARTS_V1,
  DAO_EQUIPMENT_ESSENCE_ID,
  DAO_EQUIPMENT_GENERATOR_VERSION,
  DAO_EQUIPMENT_GENERATOR_VERSION_V2,
  DAO_EQUIPMENT_TEMPLATE_ID,
  DAO_RAGE_RESOURCE_ID,
  EffectType,
  EventType,
  LINGXIAO_PATH_ID,
  LINGXIAO_SKILL_ID,
  LINGXIAO_V6_DEFINITION,
  compareDaoEquipmentSpecialLoadoutsV1,
  compileDaoEquipmentSpecialLoadoutV1,
  createBattle,
  daoEquipmentGenerationRulesV2,
  daoyouDeterministicRuleset,
  generateDaoEquipmentV1,
  generateDaoEquipmentV2,
  projectCultivatorWithEquipmentSpecialToCombatV6,
  type DaoEquipmentEssenceDefV1,
  type DaoEquipmentInstanceV1,
  type DaoEquipmentLoadoutV1,
  type SectCombatProgressV6,
  StatusCategory,
  StatusTick,
  TickKind,
} from "./index.ts"

const ATTRIBUTES: Attributes = {
  vitality: 10,
  strength: 10,
  spirit: 10,
  endurance: 10,
  speed: 10,
  willpower: 10,
}

function condition(): CultivatorCondition {
  return {
    version: 1,
    resources: { hp: { current: 500 }, mp: { current: 340 } },
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
    counters: { longTermPillUsesByRealm: {}, cultivationPillUsesByRealm: {}, longevityPillUsesByRealm: {} },
    statuses: [],
    timestamps: {},
  }
}

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

function generatedV2(
  templateId = DAO_EQUIPMENT_TEMPLATE_ID.Weapon,
  seed = 123,
): DaoEquipmentInstanceV1 {
  const result = generateDaoEquipmentV2({
    id: `${templateId}-${seed}`,
    createdAt: "2026-09-03T00:00:00.000Z",
    seed,
    templateId,
    equipmentLevel: 180,
    generatorVersion: DAO_EQUIPMENT_GENERATOR_VERSION_V2,
  })
  if (!result.ok) throw new Error("v2 道装生成失败")
  return result.instance
}

function input(equipment: DaoEquipmentLoadoutV1) {
  return {
    cultivator: {
      id: "left",
      name: "left",
      realm: "渡劫" as const,
      realm_stage: "圆满" as const,
      attributes: { ...ATTRIBUTES },
      condition: condition(),
    },
    side: 0 as const,
    slot: 0,
    resourcePolicy: "full" as const,
    sect: sect(),
    equipment,
  }
}

function artBattle(artId: string) {
  const art = DAO_EQUIPMENT_ARTS_V1.find((candidate) => candidate.id === artId)
  if (!art) throw new Error(`未知测试器诀 ${artId}`)
  return createBattle({
    seed: 1,
    versions: COMBAT_V6_PHASE_4B_VERSIONS,
    ruleset: daoyouDeterministicRuleset,
    skills: [art.skill],
    statusDefs: art.statusDefs,
    units: [
      {
        id: "source", name: "source", side: 0, kind: "player", level: 180,
        skills: [art.skill.id], skillLevels: { [art.skill.id]: 0 },
        resources: [{ id: DAO_RAGE_RESOURCE_ID, name: "战意", current: 150, max: 150 }],
        attrs: { hp: 1000, maxHp: 1000, mp: 400, maxMp: 400, healPower: 20, speed: 100, physicalAtk: 200, physicalDef: 100, magicAtk: 200, magicDef: 100 },
      },
      { id: "ally", name: "ally", side: 0, kind: "player", attrs: { hp: 100, maxHp: 1000, mp: 0, maxMp: 400, speed: 10, physicalAtk: 1, physicalDef: 100, magicDef: 100 } },
      { id: "e1", name: "e1", side: 1, kind: "npc", attrs: { hp: 1000, maxHp: 1000, speed: 3, physicalAtk: 1, physicalDef: 100, magicDef: 100 } },
      { id: "e2", name: "e2", side: 1, kind: "npc", attrs: { hp: 1000, maxHp: 1000, speed: 2, physicalAtk: 1, physicalDef: 100, magicDef: 100 } },
      { id: "e3", name: "e3", side: 1, kind: "npc", attrs: { hp: 1000, maxHp: 1000, speed: 1, physicalAtk: 1, physicalDef: 100, magicDef: 100 } },
    ],
  })
}

function resolveArt(battle: ReturnType<typeof artBattle>, skillId: string, target: string): void {
  battle.submit("source", { type: CommandType.Skill, skillId, targets: [target] })
  for (const unit of battle.state.units) {
    if (unit.id !== "source" && !unit.flags.downed) battle.submit(unit.id, { type: CommandType.Defend })
  }
  battle.lockAndResolve()
}

describe("combat-v6 Phase 4B 生成与编译", () => {
  it("保持 v1 黄金随机流，并在 v2 后置追加特殊内容", () => {
    const common = {
      id: "weapon",
      createdAt: "2026-09-03T00:00:00.000Z",
      seed: 1,
      templateId: DAO_EQUIPMENT_TEMPLATE_ID.Weapon,
      equipmentLevel: 180,
    }
    const v1 = generateDaoEquipmentV1({ ...common, generatorVersion: DAO_EQUIPMENT_GENERATOR_VERSION })
    const v2 = generateDaoEquipmentV2({ ...common, generatorVersion: DAO_EQUIPMENT_GENERATOR_VERSION_V2 })
    expect(v1.ok && v2.ok).toBe(true)
    if (!v1.ok || !v2.ok) return
    expect(v2.instance.baseStats).toEqual(v1.instance.baseStats)
    expect(v2.instance.attributeBonuses).toEqual(v1.instance.attributeBonuses)
    expect(generateDaoEquipmentV2({ ...common, generatorVersion: DAO_EQUIPMENT_GENERATOR_VERSION_V2 })).toEqual(v2)
  })

  it("锁定82/16/2与8%阈值，并允许器蕴器诀共存", () => {
    expect([
      daoEquipmentGenerationRulesV2.essenceCount(0.819999),
      daoEquipmentGenerationRulesV2.essenceCount(0.82),
      daoEquipmentGenerationRulesV2.essenceCount(0.979999),
      daoEquipmentGenerationRulesV2.essenceCount(0.98),
    ]).toEqual([0, 1, 1, 2])
    expect(daoEquipmentGenerationRulesV2.artChance).toBe(0.08)
    const coexist = generatedV2(DAO_EQUIPMENT_TEMPLATE_ID.Weapon, 39)
    expect(coexist.essenceIds.length).toBeGreaterThan(0)
    expect(coexist.artId).toBeDefined()
    expect(new Set(coexist.essenceIds).size).toBe(coexist.essenceIds.length)
  })

  it("叠加数值器蕴，唯一/最高重复仅警告，并在等级校验前应用轻灵", () => {
    const weapon = { ...generatedV2(), essenceIds: [DAO_EQUIPMENT_ESSENCE_ID.Cangfeng, DAO_EQUIPMENT_ESSENCE_ID.Qingling] }
    const head = { ...generatedV2(DAO_EQUIPMENT_TEMPLATE_ID.Head), essenceIds: [DAO_EQUIPMENT_ESSENCE_ID.Cangfeng, DAO_EQUIPMENT_ESSENCE_ID.Qingling] }
    const result = compileDaoEquipmentSpecialLoadoutV1({ weapon, head }, 170)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.projection.panel.find((roll) => roll.attr === "critRate")?.value).toBe(0.06)
    expect(result.projection.effectiveRequiredLevels).toMatchObject({ weapon: 170, head: 170 })
    expect(result.projection.diagnostics.map((item) => item.code)).toContain("EQUIPMENT_ESSENCE_DUPLICATE_IGNORED")
  })

  it("归元生成单位专属消耗覆盖，同名器诀只授予一次", () => {
    const weapon = { ...generatedV2(), essenceIds: [DAO_EQUIPMENT_ESSENCE_ID.Guiyuan], artId: DAO_EQUIPMENT_ART_ID.Huiyuan }
    const head = { ...generatedV2(DAO_EQUIPMENT_TEMPLATE_ID.Head), essenceIds: [], artId: DAO_EQUIPMENT_ART_ID.Huiyuan }
    const result = compileDaoEquipmentSpecialLoadoutV1({ weapon, head }, 180)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.projection.grantedArtIds).toEqual([DAO_EQUIPMENT_ART_ID.Huiyuan])
    expect(result.projection.skillOverrides[0]?.resourceCosts?.[0]?.amount).toBe(32)
    expect(result.projection.diagnostics.map((item) => item.code)).toContain("EQUIPMENT_ART_DUPLICATE_IGNORED")
  })

  it("拒绝 v1 特殊引用、未知内容与冲突组", () => {
    const v1 = generateDaoEquipmentV1({
      id: "v1",
      createdAt: "2026-09-03T00:00:00.000Z",
      seed: 1,
      templateId: DAO_EQUIPMENT_TEMPLATE_ID.Weapon,
      equipmentLevel: 180,
      generatorVersion: DAO_EQUIPMENT_GENERATOR_VERSION,
    })
    if (!v1.ok) throw new Error("v1 道装生成失败")
    const mismatch = compileDaoEquipmentSpecialLoadoutV1({ weapon: { ...v1.instance, essenceIds: [DAO_EQUIPMENT_ESSENCE_ID.Cangfeng] } }, 180)
    expect(!mismatch.ok && mismatch.diagnostics.map((item) => item.code)).toContain("EQUIPMENT_SPECIAL_GENERATOR_MISMATCH")
    const unknown = compileDaoEquipmentSpecialLoadoutV1({ weapon: { ...generatedV2(), essenceIds: ["missing"] } }, 180)
    expect(!unknown.ok && unknown.diagnostics.map((item) => item.code)).toContain("UNKNOWN_EQUIPMENT_ESSENCE")

    const conflictDefs: DaoEquipmentEssenceDefV1[] = [
      { id: "a", name: "甲", stackPolicy: "unique", conflictGroup: "same" },
      { id: "b", name: "乙", stackPolicy: "unique", conflictGroup: "same" },
    ]
    const conflict = compileDaoEquipmentSpecialLoadoutV1(
      { weapon: { ...generatedV2(), essenceIds: ["a", "b"] } },
      180,
      { essenceDefs: conflictDefs },
    )
    expect(!conflict.ok && conflict.diagnostics.map((item) => item.code)).toContain("EQUIPMENT_ESSENCE_CONFLICT")
  })
})

describe("combat-v6 Phase 4B 投影与战斗", () => {
  it("投影剑意与0/150战意，器诀等级固定为0，比较返回稳定ID", () => {
    const weapon = {
      ...generatedV2(),
      essenceIds: [DAO_EQUIPMENT_ESSENCE_ID.Jiangang],
      artId: DAO_EQUIPMENT_ART_ID.Zhuxian,
    }
    const result = projectCultivatorWithEquipmentSpecialToCombatV6(input({ weapon }))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.versions).toEqual(COMBAT_V6_PHASE_4B_VERSIONS)
    expect(result.unit.resources).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "lingxiao.resource.sword_intent", current: 0, max: 11 }),
      { id: DAO_RAGE_RESOURCE_ID, name: "战意", current: 0, max: 150 },
    ]))
    expect(result.unit.skillLevels?.[DAO_EQUIPMENT_ART_SKILL_ID.Zhuxian]).toBe(0)

    const { equipment: _equipment, ...common } = input({})
    const comparison = compareDaoEquipmentSpecialLoadoutsV1({ ...common, before: {}, after: { weapon } })
    expect(comparison.ok).toBe(true)
    if (!comparison.ok) return
    expect(comparison.effectiveEssenceChanges.added).toEqual([DAO_EQUIPMENT_ESSENCE_ID.Jiangang])
    expect(comparison.grantedArtChanges.added).toEqual([DAO_EQUIPMENT_ART_ID.Zhuxian])
    expect(comparison).not.toHaveProperty("score")
  })

  it("按实际气血损失获得激昂战意，器诀预检后扣除资源", () => {
    const weapon = { ...generatedV2(), essenceIds: [DAO_EQUIPMENT_ESSENCE_ID.Jiangang], artId: DAO_EQUIPMENT_ART_ID.Zhuxian }
    const projected = projectCultivatorWithEquipmentSpecialToCombatV6(input({ weapon }))
    if (!projected.ok) throw new Error("特殊道装投影失败")
    const battle = createBattle({
      seed: 1,
      versions: COMBAT_V6_PHASE_4B_VERSIONS,
      ruleset: daoyouDeterministicRuleset,
      skills: projected.skills,
      statusDefs: projected.statusDefs,
      units: [
        projected.unit,
        { id: "right", name: "right", side: 1, kind: "npc", attrs: { hp: 10_000, maxHp: 10_000, speed: 1, physicalAtk: 1, physicalDef: 0 } },
      ],
    })
    battle.submit("left", { type: CommandType.Attack, target: "right" })
    battle.submit("right", { type: CommandType.Defend })
    battle.lockAndResolve()
    expect(battle.unit("left").resources.find((item) => item.id === DAO_RAGE_RESOURCE_ID)?.current).toBeGreaterThan(0)

    const rage = battle.unit("left").resources.find((item) => item.id === DAO_RAGE_RESOURCE_ID)!
    rage.current = 150
    battle.submit("left", { type: CommandType.Skill, skillId: DAO_EQUIPMENT_ART_SKILL_ID.Zhuxian, targets: ["right"] })
    battle.submit("right", { type: CommandType.Defend })
    battle.lockAndResolve()
    // 先扣120至30，再由诛仙式造成的直接伤害获得战意。
    expect(rage.current).toBeGreaterThan(30)
    expect(battle.log()).toContainEqual(expect.objectContaining({
      type: EventType.ResourceChanged,
      unitId: "left",
      resourceId: DAO_RAGE_RESOURCE_ID,
      before: 150,
      after: 30,
    }))
  })

  it("过量伤害只按实际损失计战意，多段受行动30上限，DOT不计", () => {
    const projected = projectCultivatorWithEquipmentSpecialToCombatV6(input({}))
    if (!projected.ok) throw new Error("特殊道装投影失败")
    const overkill = createBattle({
      seed: 1,
      versions: COMBAT_V6_PHASE_4B_VERSIONS,
      ruleset: daoyouDeterministicRuleset,
      skills: projected.skills,
      statusDefs: projected.statusDefs,
      units: [
        { ...projected.unit, attrs: { ...projected.unit.attrs, physicalAtk: 1_000_000 } },
        { id: "target", name: "target", side: 1, kind: "npc", attrs: { hp: 1, maxHp: 10_000, speed: 1, physicalAtk: 1, physicalDef: 0 } },
      ],
    })
    overkill.submit("left", { type: CommandType.Attack, target: "target" })
    overkill.lockAndResolve()
    expect(overkill.unit("left").resources.find((item) => item.id === DAO_RAGE_RESOURCE_ID)?.current).toBe(1)

    const multihit = createBattle({
      seed: 1,
      versions: COMBAT_V6_PHASE_4B_VERSIONS,
      ruleset: daoyouDeterministicRuleset,
      skills: projected.skills,
      statusDefs: projected.statusDefs,
      units: [
        { ...projected.unit, attrs: { ...projected.unit.attrs, hp: 1_000_000, maxHp: 1_000_000, physicalAtk: 100_000 } },
        { id: "target", name: "target", side: 1, kind: "npc", attrs: { hp: 300_000, maxHp: 300_000, speed: 1, physicalAtk: 1, physicalDef: 0 } },
      ],
    })
    multihit.submit("left", { type: CommandType.Skill, skillId: LINGXIAO_SKILL_ID.Triple, targets: ["target"] })
    multihit.submit("target", { type: CommandType.Defend })
    multihit.lockAndResolve()
    expect(multihit.unit("left").resources.find((item) => item.id === DAO_RAGE_RESOURCE_ID)?.current).toBe(30)

    const dotStatus = {
      id: "test.dot",
      name: "测试持续伤害",
      kind: "test.dot",
      category: StatusCategory.Dot,
      ticks: StatusTick.RoundEnd,
      onTick: { type: TickKind.Dot, ratioOfMaxHp: 0.1 },
    } as const
    const dot = createBattle({
      seed: 1,
      versions: COMBAT_V6_PHASE_4B_VERSIONS,
      ruleset: daoyouDeterministicRuleset,
      skills: projected.skills,
      statusDefs: [...projected.statusDefs, dotStatus],
      units: [
        projected.unit,
        { id: "target", name: "target", side: 1, kind: "npc", attrs: { hp: 10_000, maxHp: 10_000, speed: 1, physicalAtk: 1, physicalDef: 0 } },
      ],
    })
    dot.applyStatus("target", dotStatus.id, 2, "left")
    dot.submit("left", { type: CommandType.Defend })
    dot.submit("target", { type: CommandType.Defend })
    dot.lockAndResolve()
    expect(dot.unit("left").resources.find((item) => item.id === DAO_RAGE_RESOURCE_ID)?.current).toBe(0)
  })

  it("相同投影、版本和seed产生相同快照与事件流", () => {
    const weapon = { ...generatedV2(), essenceIds: [DAO_EQUIPMENT_ESSENCE_ID.Cangfeng] }
    const run = () => {
      const projected = projectCultivatorWithEquipmentSpecialToCombatV6(input({ weapon: structuredClone(weapon) }))
      if (!projected.ok) throw new Error("特殊道装投影失败")
      const battle = createBattle({
        seed: 42,
        versions: COMBAT_V6_PHASE_4B_VERSIONS,
        ruleset: daoyouDeterministicRuleset,
        skills: projected.skills,
        statusDefs: projected.statusDefs,
        units: [
          projected.unit,
          { id: "right", name: "right", side: 1, kind: "npc", attrs: { hp: 10_000, maxHp: 10_000, speed: 1, physicalAtk: 1, physicalDef: 10 } },
        ],
      })
      battle.submit("left", { type: CommandType.Attack, target: "right" })
      battle.submit("right", { type: CommandType.Defend })
      battle.lockAndResolve()
      return { projection: projected, snapshot: battle.snapshot(), events: battle.log() }
    }
    expect(run()).toEqual(run())
  })

  it("九种器诀锁定消耗、标签、目标和效果族", () => {
    expect(DAO_EQUIPMENT_ARTS_V1.map((art) => art.rageCost)).toEqual([40, 60, 50, 100, 80, 80, 70, 120, 120])
    expect(DAO_EQUIPMENT_ARTS_V1.map((art) => art.skill.resourceCosts?.[0]?.resourceId))
      .toEqual(Array(9).fill(DAO_RAGE_RESOURCE_ID))
    expect(DAO_EQUIPMENT_ARTS_V1.find((art) => art.id === DAO_EQUIPMENT_ART_ID.Tianlei)?.skill.targeting.count).toBe(3)
    expect(DAO_EQUIPMENT_ARTS_V1.find((art) => art.id === DAO_EQUIPMENT_ART_ID.Huanhun)?.skill.targeting.includeDowned).toBe(true)
  })

  it("回元、聚灵、清心、破法与还魂按目标执行", () => {
    const heal = artBattle(DAO_EQUIPMENT_ART_ID.Huiyuan)
    resolveArt(heal, DAO_EQUIPMENT_ART_SKILL_ID.Huiyuan, "ally")
    expect(heal.unit("ally").attrs.hp).toBe(370)

    const mp = artBattle(DAO_EQUIPMENT_ART_ID.Juling)
    resolveArt(mp, DAO_EQUIPMENT_ART_SKILL_ID.Juling, "ally")
    expect(mp.unit("ally").attrs.mp).toBe(100)

    const removable = {
      id: "test.control",
      name: "控制",
      kind: "test.control",
      category: StatusCategory.Control,
      blocksAction: true,
    } as const
    // 公共 applyStatus 只接受已注册状态，因此用器诀自身外的新战局验证类别驱散。
    const qingxin = DAO_EQUIPMENT_ARTS_V1.find((art) => art.id === DAO_EQUIPMENT_ART_ID.Qingxin)!
    const cleanseBattle = createBattle({
      seed: 1,
      versions: COMBAT_V6_PHASE_4B_VERSIONS,
      ruleset: daoyouDeterministicRuleset,
      skills: [qingxin.skill],
      statusDefs: [removable],
      units: [
        { id: "source", name: "source", side: 0, kind: "player", skills: [qingxin.skill.id], resources: [{ id: DAO_RAGE_RESOURCE_ID, name: "战意", current: 150, max: 150 }], attrs: { hp: 1000, speed: 100, physicalAtk: 10, physicalDef: 10 } },
        { id: "ally", name: "ally", side: 0, kind: "player", attrs: { hp: 1000, speed: 1, physicalAtk: 10, physicalDef: 10 } },
        { id: "enemy", name: "enemy", side: 1, kind: "npc", attrs: { hp: 1000, speed: 0, physicalAtk: 10, physicalDef: 10 } },
      ],
    })
    cleanseBattle.applyStatus("ally", removable.id, 3)
    cleanseBattle.submit("source", { type: CommandType.Skill, skillId: qingxin.skill.id, targets: ["ally"] })
    cleanseBattle.submit("enemy", { type: CommandType.Defend })
    cleanseBattle.lockAndResolve()
    expect(cleanseBattle.unit("ally").statuses).toHaveLength(0)

    const revive = artBattle(DAO_EQUIPMENT_ART_ID.Huanhun)
    revive.unit("ally").attrs.hp = 0
    revive.unit("ally").flags.downed = true
    resolveArt(revive, DAO_EQUIPMENT_ART_SKILL_ID.Huanhun, "ally")
    expect(revive.unit("ally").attrs.hp).toBe(200)
    expect(revive.unit("ally").flags.downed).toBe(false)

    const dispel = DAO_EQUIPMENT_ARTS_V1.find((art) => art.id === DAO_EQUIPMENT_ART_ID.Pofa)!
    expect(dispel.skill.effects).toContainEqual(expect.objectContaining({ type: EffectType.Dispel, categories: [StatusCategory.Buff] }))
  })

  it("双护法快照防御且覆盖刷新，诛仙与天雷产生预期直接伤害", () => {
    const guard = artBattle(DAO_EQUIPMENT_ART_ID.Jingang)
    resolveArt(guard, DAO_EQUIPMENT_ART_SKILL_ID.Jingang, "ally")
    expect(guard.unit("ally").statuses[0]?.attrMods.physicalDef).toBe(10)
    const guardStatus = guard.unit("ally").statuses[0]
    expect(guardStatus?.remainingRounds).toBe(3)
    guard.unit("source").resources[0]!.current = 150
    resolveArt(guard, DAO_EQUIPMENT_ART_SKILL_ID.Jingang, "ally")
    expect(guard.unit("ally").statuses).toHaveLength(1)
    expect(guard.unit("ally").statuses[0]?.attrMods.physicalDef).toBe(10)

    const spellGuard = artBattle(DAO_EQUIPMENT_ART_ID.Xuanling)
    resolveArt(spellGuard, DAO_EQUIPMENT_ART_SKILL_ID.Xuanling, "ally")
    expect(spellGuard.unit("ally").statuses[0]?.attrMods.magicDef).toBe(10)

    const physical = artBattle(DAO_EQUIPMENT_ART_ID.Zhuxian)
    resolveArt(physical, DAO_EQUIPMENT_ART_SKILL_ID.Zhuxian, "e1")
    expect(physical.unit("e1").attrs.hp).toBeLessThan(1000)

    const spell = artBattle(DAO_EQUIPMENT_ART_ID.Tianlei)
    resolveArt(spell, DAO_EQUIPMENT_ART_SKILL_ID.Tianlei, "e1")
    expect(["e1", "e2", "e3"].every((id) => spell.unit(id).attrs.hp < 1000)).toBe(true)
  })

  it("辅助器诀绕过封法封物，攻击器诀受对应封禁，blocksAction限制全部器诀", () => {
    const makeBlocked = (
      artId: string,
      status: { id: string; name: string; kind: string; blocksSpell?: boolean; blocksPhysical?: boolean; blocksAction?: boolean },
    ) => {
      const art = DAO_EQUIPMENT_ARTS_V1.find((candidate) => candidate.id === artId)!
      const battle = createBattle({
        seed: 1,
        versions: COMBAT_V6_PHASE_4B_VERSIONS,
        ruleset: daoyouDeterministicRuleset,
        skills: [art.skill],
        statusDefs: [status, ...(art.statusDefs ?? [])],
        units: [
          { id: "source", name: "source", side: 0, kind: "player", skills: [art.skill.id], resources: [{ id: DAO_RAGE_RESOURCE_ID, name: "战意", current: 150, max: 150 }], attrs: { hp: 1000, maxHp: 1000, speed: 100, physicalAtk: 200, physicalDef: 100, magicAtk: 200 } },
          { id: "ally", name: "ally", side: 0, kind: "player", attrs: { hp: 100, maxHp: 1000, speed: 1, physicalAtk: 1, physicalDef: 10 } },
          { id: "enemy", name: "enemy", side: 1, kind: "npc", attrs: { hp: 1000, maxHp: 1000, speed: 0, physicalAtk: 1, physicalDef: 10 } },
        ],
      })
      battle.applyStatus("source", status.id, 3)
      return { art, battle }
    }

    const bothSeal = { id: "test.both_seal", name: "双封", kind: "test.both_seal", blocksSpell: true, blocksPhysical: true }
    const support = makeBlocked(DAO_EQUIPMENT_ART_ID.Huiyuan, bothSeal)
    resolveArt(support.battle, support.art.skill.id, "ally")
    expect(support.battle.unit("ally").attrs.hp).toBe(350)
    expect(support.battle.unit("source").resources[0]?.current).toBe(110)

    const spellSeal = makeBlocked(DAO_EQUIPMENT_ART_ID.Tianlei, { id: "test.spell_seal", name: "封法", kind: "test.spell_seal", blocksSpell: true })
    resolveArt(spellSeal.battle, spellSeal.art.skill.id, "enemy")
    expect(spellSeal.battle.log()).toContainEqual({ type: EventType.ActionFailed, unitId: "source", reason: "sealed" })
    expect(spellSeal.battle.unit("source").resources[0]?.current).toBe(150)

    const physicalSeal = makeBlocked(DAO_EQUIPMENT_ART_ID.Zhuxian, { id: "test.physical_seal", name: "封物", kind: "test.physical_seal", blocksPhysical: true })
    resolveArt(physicalSeal.battle, physicalSeal.art.skill.id, "enemy")
    expect(physicalSeal.battle.log()).toContainEqual({ type: EventType.ActionFailed, unitId: "source", reason: "rooted" })
    expect(physicalSeal.battle.unit("source").resources[0]?.current).toBe(150)

    const stopped = makeBlocked(DAO_EQUIPMENT_ART_ID.Huiyuan, { id: "test.stop", name: "止行", kind: "test.stop", blocksAction: true })
    resolveArt(stopped.battle, stopped.art.skill.id, "ally")
    expect(stopped.battle.unit("ally").attrs.hp).toBe(100)
    expect(stopped.battle.unit("source").resources[0]?.current).toBe(150)
  })
})
