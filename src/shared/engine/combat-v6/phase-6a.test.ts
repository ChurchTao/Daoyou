import { describe, expect, it } from "vitest"
import type { Attributes } from "@shared/types/cultivator"
import {
  COMBAT_V6_PHASE_6A_VERSIONS,
  COMBAT_V6_SECT_DEFINITIONS_V1,
  CommandType,
  DamageKind,
  DAO_RAGE_RESOURCE_ID,
  EffectType,
  EventType,
  LINGXIAO_PATH_ID,
  LINGXIAO_V6_DEFINITION,
  SkillTag,
  TargetMode,
  TargetSide,
  YOUDU_PATH_ID,
  YOUDU_SKILL_ID,
  YOUDU_STATUS_ID,
  YOUDU_V6_DEFINITION,
  compileSectCombatV6,
  createBattle,
  createDaoRageGainPassive,
  daoyouDeterministicRulesetV2,
  projectCultivatorMultiSectToCombatV6,
  projectCultivatorToCombatV6,
  recoverableHp,
  validateCombatV6SectRegistryV1,
  type CultivatorManualStateV1,
  type SectCombatProgressV6,
  type SkillDef,
} from "./index.ts"

const ATTRIBUTES: Attributes = { vitality: 10, strength: 10, spirit: 10, endurance: 10, speed: 10, willpower: 10 }
const manuals: CultivatorManualStateV1 = { version: 1, revision: 0, build: { slots: [] } }

function progress(sectId: "lingxiao" | "youdu", pathId?: string): SectCombatProgressV6 {
  const definition = COMBAT_V6_SECT_DEFINITIONS_V1[sectId]
  const activePathId = pathId ?? definition.paths[0].id
  return {
    version: 1,
    sectId,
    methods: Object.fromEntries(definition.methods.map((method) => [method.id, 180])),
    meridianDepth: 0,
    activePathId,
    meridianLoadouts: definition.paths.map((path) => ({ pathId: path.id, nodeIds: [], revision: 1 })) as SectCombatProgressV6["meridianLoadouts"],
  }
}

function projectionInput(sectId: "lingxiao" | "youdu", side: 0 | 1) {
  return {
    cultivator: { id: `${sectId}-${side}`, name: sectId, realm: "渡劫" as const, realm_stage: "圆满" as const, attributes: { ...ATTRIBUTES } },
    side,
    slot: 0,
    resourcePolicy: "full" as const,
    sect: progress(sectId, sectId === "youdu" ? YOUDU_PATH_ID.SoulJudge : LINGXIAO_PATH_ID.Zhanchen),
    equipment: {},
    manuals,
  }
}

describe("combat-v6 Phase 6A 多宗门内容", () => {
  it("注册表分发两个宗门且幽都保持六心法、双流派和42节点", () => {
    expect(validateCombatV6SectRegistryV1()).toEqual([])
    expect(Object.keys(COMBAT_V6_SECT_DEFINITIONS_V1)).toEqual(["lingxiao", "youdu"])
    expect(YOUDU_V6_DEFINITION.methods).toHaveLength(6)
    expect(YOUDU_V6_DEFINITION.methods.filter((method) => method.isPrimary)).toHaveLength(1)
    expect(YOUDU_V6_DEFINITION.paths.map((path) => path.name)).toEqual(["勾魂阎罗", "六道魍魉"])
    expect(YOUDU_V6_DEFINITION.paths.flatMap((path) => path.nodes)).toHaveLength(42)
    for (const node of YOUDU_V6_DEFINITION.paths.flatMap((path) => path.nodes)) {
      expect([
        ...(node.panel ?? []),
        ...(node.passives ?? []),
        ...(node.grantSkills ?? []),
        ...(node.patches ?? []),
      ].length, node.id).toBeGreaterThan(0)
    }
    expect(compileSectCombatV6({ progress: progress("lingxiao"), characterLevel: 180 }).ok).toBe(true)
    expect(compileSectCombatV6({ progress: progress("youdu"), characterLevel: 180 }).ok).toBe(true)
  })

  it("两条幽都流派的完整七层方案均可确定编译", () => {
    for (const path of YOUDU_V6_DEFINITION.paths) {
      const value = progress("youdu", path.id)
      value.meridianDepth = 7
      value.meridianLoadouts = value.meridianLoadouts.map((loadout) => ({
        ...loadout,
        nodeIds: loadout.pathId === path.id
          ? path.nodes.filter((node) => node.slot === 1).map((node) => node.id)
          : [],
      })) as SectCombatProgressV6["meridianLoadouts"]
      expect(compileSectCombatV6({ progress: value, characterLevel: 180 }).ok, path.name).toBe(true)
    }
  })

  it("完整入口支持红尘和幽都，旧定义仍保持独立", () => {
    const lingxiao = projectCultivatorMultiSectToCombatV6(projectionInput("lingxiao", 0))
    const youdu = projectCultivatorMultiSectToCombatV6(projectionInput("youdu", 1))
    expect(lingxiao.ok && youdu.ok).toBe(true)
    if (!lingxiao.ok || !youdu.ok) return
    expect(lingxiao.versions).toEqual(COMBAT_V6_PHASE_6A_VERSIONS)
    expect(youdu.unit.skills).toContain(YOUDU_SKILL_ID.Edict)
    expect(youdu.unit.skills).toContain(YOUDU_SKILL_ID.Sever)
    expect(youdu.unit.resources?.map((resource) => resource.id)).toEqual(["combat.resource.rage"])
    expect(LINGXIAO_V6_DEFINITION.id).toBe("lingxiao")
    expect(projectCultivatorToCombatV6(projectionInput("youdu", 1))).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([expect.objectContaining({ code: "INVALID_SECT_ID" })]),
    })
  })
})

describe("combat-v6 Phase 6A 固伤、伤势与效果级目标", () => {
  it("固定伤害必中、不暴击、不波动且不读取攻防", () => {
    const fixed: SkillDef = {
      id: "test.fixed", name: "固定", tags: [SkillTag.Spell], formula: "fixed",
      targeting: { side: TargetSide.Enemy, count: 1 },
      effects: [{ type: EffectType.FixedHit, power: 123 }],
    }
    const rage = createDaoRageGainPassive(1)
    const battle = createBattle({
      seed: 7, versions: COMBAT_V6_PHASE_6A_VERSIONS, ruleset: daoyouDeterministicRulesetV2, skills: [fixed, rage],
      units: [
        { id: "source", name: "source", side: 0, kind: "player", skills: [fixed.id], passives: [rage.id], resources: [{ id: DAO_RAGE_RESOURCE_ID, name: "战意", current: 0, max: 150 }], attrs: { hp: 1000, speed: 10, physicalAtk: 1, physicalDef: 1, magicAtk: 1, hit: 0, critRate: 1, spellCritRate: 1 } },
        { id: "target", name: "target", side: 1, kind: "player", attrs: { hp: 1000, speed: 1, physicalAtk: 1, physicalDef: 99999, magicDef: 99999, dodge: 99999 } },
      ],
    })
    battle.submit("source", { type: CommandType.Skill, skillId: fixed.id, targets: ["target"] })
    battle.submit("target", { type: CommandType.Defend })
    battle.lockAndResolve()
    expect(battle.unit("target").attrs.hp).toBe(877)
    expect(battle.log()).toContainEqual(expect.objectContaining({ type: EventType.Hit, kind: DamageKind.Fixed, crit: false }))
    expect(battle.log().some((event) => event.type === EventType.Miss)).toBe(false)
    expect(battle.unit("source").resources[0].current).toBe(12)
  })

  it("伤势不修改maxHp、夹取不是伤害，恢复受可恢复上限约束", () => {
    const wound: SkillDef = {
      id: "test.wound", name: "伤势", tags: [SkillTag.Spell], targeting: { side: TargetSide.Enemy, count: 1 },
      effects: [{ type: EffectType.Wound, power: 300 }],
    }
    const battle = createBattle({
      seed: 1, versions: COMBAT_V6_PHASE_6A_VERSIONS, ruleset: daoyouDeterministicRulesetV2, skills: [wound],
      units: [
        { id: "source", name: "source", side: 0, kind: "player", skills: [wound.id], attrs: { hp: 1000, speed: 10, physicalAtk: 1, physicalDef: 1 } },
        { id: "target", name: "target", side: 1, kind: "player", attrs: { hp: 1000, maxHp: 1000, speed: 1, physicalAtk: 1, physicalDef: 1 } },
      ],
    })
    battle.submit("source", { type: CommandType.Skill, skillId: wound.id, targets: ["target"] })
    battle.submit("target", { type: CommandType.Defend })
    battle.lockAndResolve()
    expect(battle.unit("target")).toMatchObject({ wound: 300, attrs: { hp: 700, maxHp: 1000 } })
    expect(recoverableHp(battle.unit("target"))).toBe(700)
    expect(battle.log().filter((event) => event.type === EventType.Damage)).toHaveLength(0)
    expect(battle.log()).toContainEqual(expect.objectContaining({ type: EventType.WoundChanged, before: 0, after: 300 }))
  })

  it("黄泉蚀生用效果级目标为全体友方各恢复一次并给敌方施毒", () => {
    const compiled = compileSectCombatV6({ progress: progress("youdu"), characterLevel: 180 })
    expect(compiled.ok).toBe(true)
    if (!compiled.ok) return
    const skill = compiled.projection.skills.find((entry) => entry.id === YOUDU_SKILL_ID.Wither)!
    const battle = createBattle({
      seed: 1, versions: COMBAT_V6_PHASE_6A_VERSIONS, ruleset: daoyouDeterministicRulesetV2,
      skills: compiled.projection.skills, statusDefs: compiled.projection.statusDefs,
      units: [
        { id: "source", name: "source", side: 0, kind: "player", skills: [skill.id], skillLevels: { [skill.id]: 180 }, attrs: { hp: 500, maxHp: 1000, mp: 1000, speed: 20, physicalAtk: 1, physicalDef: 1, healPower: 10 } },
        { id: "ally", name: "ally", side: 0, kind: "player", attrs: { hp: 500, maxHp: 1000, speed: 10, physicalAtk: 1, physicalDef: 1 } },
        { id: "target", name: "target", side: 1, kind: "player", attrs: { hp: 2000, maxHp: 2000, speed: 1, physicalAtk: 1, physicalDef: 1 } },
      ],
    })
    battle.submit("source", { type: CommandType.Skill, skillId: skill.id, targets: ["target"] })
    battle.submit("ally", { type: CommandType.Defend })
    battle.submit("target", { type: CommandType.Defend })
    battle.lockAndResolve()
    expect(battle.unit("source").attrs.hp).toBe(540)
    expect(battle.unit("ally").attrs.hp).toBe(540)
    expect(battle.unit("target").statuses.map((status) => status.id)).toContain(YOUDU_STATUS_ID.Poison)
  })
})
