import { describe, expect, it } from "vitest"
import type { Attributes } from "@shared/types/cultivator"
import type { CultivatorCondition } from "@shared/types/condition"
import {
  COMBAT_V6_PHASE_3_VERSIONS,
  CommandType,
  EventType,
  LINGXIAO_PATH_ID,
  LINGXIAO_RESOURCE_ID,
  LINGXIAO_SKILL_ID,
  LINGXIAO_V6_DEFINITION,
  SkipReason,
  createBattle,
  daoyouDeterministicRuleset,
  projectCultivatorWithTrainingAndSectToCombatV6,
  type CombatV6ProjectionResult,
  type SectCombatProgressV6,
  type SkillDef,
  type StatusDef,
} from "./index.ts"

const attributes: Attributes = {
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

function sect(pathId: string, nodeIds: string[] = []): SectCombatProgressV6 {
  return {
    version: 1,
    sectId: "lingxiao",
    methods: Object.fromEntries(LINGXIAO_V6_DEFINITION.methods.map((method) => [method.id, 180])),
    meridianDepth: 7,
    activePathId: pathId,
    meridianLoadouts: [
      { pathId: LINGXIAO_PATH_ID.Zhanchen, nodeIds: pathId === LINGXIAO_PATH_ID.Zhanchen ? nodeIds : [], revision: 1 },
      { pathId: LINGXIAO_PATH_ID.Guiyi, nodeIds: pathId === LINGXIAO_PATH_ID.Guiyi ? nodeIds : [], revision: 1 },
    ],
  }
}

function project(
  id: string,
  side: 0 | 1,
  pathId: string,
  nodeIds: string[] = [],
  resourcePolicy: "full" | "persistent" = "full",
): CombatV6ProjectionResult {
  return projectCultivatorWithTrainingAndSectToCombatV6({
    cultivator: {
      id,
      name: id,
      realm: "渡劫",
      realm_stage: "圆满",
      attributes: { ...attributes },
      condition: condition(),
    },
    side,
    slot: 0,
    resourcePolicy,
    sect: sect(pathId, nodeIds),
  })
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  return [...new Map(items.map((item) => [item.id, item])).values()]
}

function battleFrom(left: CombatV6ProjectionResult, right: CombatV6ProjectionResult, seed = 20260903) {
  if (!left.ok || !right.ok) throw new Error("红尘剑宗角色投影失败")
  const durableRight = {
    ...right.unit,
    attrs: { ...right.unit.attrs, hp: 100_000, maxHp: 100_000 },
  }
  return createBattle({
    seed,
    versions: COMBAT_V6_PHASE_3_VERSIONS,
    ruleset: daoyouDeterministicRuleset,
    units: [left.unit, durableRight],
    skills: uniqueById<SkillDef>([...left.skills, ...right.skills]),
    statusDefs: uniqueById<StatusDef>([...left.statusDefs, ...right.statusDefs]),
  })
}

function battleWithEnemies(
  left: CombatV6ProjectionResult,
  right: CombatV6ProjectionResult,
  count: number,
  seed = 20260903,
) {
  if (!left.ok || !right.ok) throw new Error("红尘剑宗角色投影失败")
  const enemies = Array.from({ length: count }, (_, index) => ({
    ...right.unit,
    id: `right-${index}`,
    name: `right-${index}`,
    slot: index,
    attrs: { ...right.unit.attrs, hp: 100_000, maxHp: 100_000 },
  }))
  return createBattle({
    seed,
    versions: COMBAT_V6_PHASE_3_VERSIONS,
    ruleset: daoyouDeterministicRuleset,
    units: [left.unit, ...enemies],
    skills: uniqueById<SkillDef>([...left.skills, ...right.skills]),
    statusDefs: uniqueById<StatusDef>([...left.statusDefs, ...right.statusDefs]),
  })
}

function resolveRound(
  battle: ReturnType<typeof battleFrom>,
  leftCommand: Parameters<typeof battle.submit>[1],
): void {
  battle.submit("left", leftCommand)
  battle.submit("right", { type: CommandType.Defend })
  battle.lockAndResolve()
}

describe("combat-v6 Phase 3 红尘剑宗纵切", () => {
  it("组合基础属性、修炼与六心法，并锁定 Phase 3 版本", () => {
    const result = project("left", 0, LINGXIAO_PATH_ID.Zhanchen)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.versions).toEqual(COMBAT_V6_PHASE_3_VERSIONS)
    expect(result.unit.attrs).toMatchObject({
      physicalAtk: 165,
      hit: 180,
      physicalDef: 99,
      speed: 37,
      maxHp: 1021,
      hp: 1021,
      sealResist: 50,
      attackCultivate: 10,
      defenseCultivate: 10,
    })
    expect(result.unit.skills).toEqual(expect.arrayContaining([
      LINGXIAO_SKILL_ID.Triple,
      LINGXIAO_SKILL_ID.Waiting,
      LINGXIAO_SKILL_ID.Formation,
      LINGXIAO_SKILL_ID.SwordAura,
      LINGXIAO_SKILL_ID.Clarity,
      LINGXIAO_SKILL_ID.Confuse,
    ]))
    expect(result.unit.resources).toEqual([])
  })

  it("persistent 模式增加宗门上限但不自动补血", () => {
    const result = project("left", 0, LINGXIAO_PATH_ID.Zhanchen, [], "persistent")
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.unit.attrs).toMatchObject({ hp: 500, maxHp: 1021, mp: 340 })
  })

  it("断尘三叠结算三段、扣除10%最大气血并令下一回合休息", () => {
    const battle = battleFrom(
      project("left", 0, LINGXIAO_PATH_ID.Zhanchen),
      project("right", 1, LINGXIAO_PATH_ID.Zhanchen),
    )
    resolveRound(battle, { type: CommandType.Skill, skillId: LINGXIAO_SKILL_ID.Triple, targets: ["right"] })

    expect(battle.unit("left").attrs.hp).toBe(919)
    expect(battle.log().filter((event) => event.type === EventType.Hit && event.sourceId === "left")).toHaveLength(3)
    expect(battle.unit("left").flags.skipNextAction).toBe(true)

    resolveRound(battle, { type: CommandType.Attack, target: "right" })
    expect(battle.log()).toContainEqual({
      type: EventType.ActionSkip,
      unitId: "left",
      reason: SkipReason.Rest,
    })
  })

  it("伏锋待机在下一回合锁定原目标并抢先普攻", () => {
    const battle = battleFrom(
      project("left", 0, LINGXIAO_PATH_ID.Zhanchen),
      project("right", 1, LINGXIAO_PATH_ID.Zhanchen),
    )
    resolveRound(battle, { type: CommandType.Skill, skillId: LINGXIAO_SKILL_ID.Waiting, targets: ["right"] })
    const before = battle.log().length
    battle.submit("left", { type: CommandType.Defend })
    battle.submit("right", { type: CommandType.Attack, target: "left" })
    battle.lockAndResolve()

    const starts = battle.log().slice(before).filter((event) => event.type === EventType.ActionStart)
    expect(starts[0]).toMatchObject({
      unitId: "left",
      command: { type: CommandType.Attack, target: "right" },
    })
  })

  it("连破在三叠击倒后于整次出手结束时取消休息", () => {
    const battle = battleWithEnemies(
      project("left", 0, LINGXIAO_PATH_ID.Zhanchen, ["lingxiao.node.zhanchen.6.1"]),
      project("right", 1, LINGXIAO_PATH_ID.Zhanchen),
      2,
    )
    battle.unit("right-0").attrs.hp = 1
    battle.submit("left", { type: CommandType.Skill, skillId: LINGXIAO_SKILL_ID.Triple, targets: ["right-0"] })
    battle.lockAndResolve()

    expect(battle.unit("right-0").flags.downed).toBe(true)
    expect(battle.unit("left").flags.skipNextAction).toBe(false)
    expect(battle.unit("left").statuses.some((status) => status.kind === "lingxiao.rest")).toBe(false)
  })

  it("开阵只在剑意达到2点后将裂阵沉舟扩至四目标", () => {
    const makeBattle = (intent: number) => {
      const battle = battleWithEnemies(
        project("left", 0, LINGXIAO_PATH_ID.Guiyi, ["lingxiao.node.guiyi.3.3"]),
        project("right", 1, LINGXIAO_PATH_ID.Zhanchen),
        4,
      )
      battle.unit("left").resources[0]!.current = intent
      battle.submit("left", { type: CommandType.Skill, skillId: LINGXIAO_SKILL_ID.Formation, targets: ["right-0"] })
      battle.lockAndResolve()
      return battle.log().filter((event) => event.type === EventType.Hit && event.sourceId === "left")
    }

    expect(makeBattle(1)).toHaveLength(3)
    expect(makeBattle(2)).toHaveLength(4)
  })

  it("破甲与无前分别在2点和5点剑意门槛后追加物理忽防", () => {
    const damage = (nodeId: string, intent: number, skillId: string) => {
      const battle = battleFrom(
        project("left", 0, LINGXIAO_PATH_ID.Guiyi, [nodeId]),
        project("right", 1, LINGXIAO_PATH_ID.Zhanchen),
      )
      battle.unit("left").resources[0]!.current = intent
      battle.unit("right").attrs.physicalDef = 150
      const command = skillId === LINGXIAO_SKILL_ID.Triple
        ? { type: CommandType.Skill as const, skillId, targets: ["right"] }
        : { type: CommandType.Attack as const, target: "right" }
      resolveRound(battle, command)
      const event = battle.log().find((item) => item.type === EventType.Damage && item.sourceId === "left")
      return event?.type === EventType.Damage ? event.amount : 0
    }

    expect(damage("lingxiao.node.guiyi.3.2", 2, LINGXIAO_SKILL_ID.Triple)).toBeGreaterThan(
      damage("lingxiao.node.guiyi.3.2", 1, LINGXIAO_SKILL_ID.Triple),
    )
    expect(damage("lingxiao.node.guiyi.6.2", 5, "attack")).toBeGreaterThan(
      damage("lingxiao.node.guiyi.6.2", 4, "attack"),
    )
  })

  it("剑意只属于万剑归一，按技能获得、夹取、进入快照并被终式清空", () => {
    const guiyiNodes = ["lingxiao.node.guiyi.7.2"]
    const battle = battleFrom(
      project("left", 0, LINGXIAO_PATH_ID.Guiyi, guiyiNodes),
      project("right", 1, LINGXIAO_PATH_ID.Zhanchen),
    )
    expect(battle.unit("left").resources).toEqual([
      { id: LINGXIAO_RESOURCE_ID, name: "剑意", current: 0, max: 11 },
    ])

    resolveRound(battle, { type: CommandType.Skill, skillId: LINGXIAO_SKILL_ID.ShadowStrike, targets: ["right"] })
    expect(battle.unit("left").resources[0]?.current).toBe(2)

    battle.unit("left").resources[0]!.current = 10
    resolveRound(battle, { type: CommandType.Skill, skillId: LINGXIAO_SKILL_ID.Triple, targets: ["right"] })
    expect(battle.unit("left").resources[0]?.current).toBe(11)
    expect(battle.snapshot().units[0]?.resources[0]?.current).toBe(11)

    resolveRound(battle, { type: CommandType.Defend })
    resolveRound(battle, { type: CommandType.Skill, skillId: LINGXIAO_SKILL_ID.GuiyiUltimate, targets: ["right"] })
    expect(battle.unit("left").resources[0]?.current).toBe(0)
    expect(battle.log().some((event) => event.type === EventType.ResourceChanged && event.after === 11)).toBe(true)
  })

  it("相同输入与 seed 产生相同投影、快照和事件流", () => {
    const run = () => {
      const left = project("left", 0, LINGXIAO_PATH_ID.Guiyi, ["lingxiao.node.guiyi.1.2"])
      const right = project("right", 1, LINGXIAO_PATH_ID.Zhanchen, ["lingxiao.node.zhanchen.1.1"])
      const battle = battleFrom(left, right, 77)
      resolveRound(battle, { type: CommandType.Skill, skillId: LINGXIAO_SKILL_ID.ShadowStrike, targets: ["right"] })
      return { left, snapshot: battle.snapshot(), events: battle.log() }
    }
    const first = run()
    const second = run()
    expect(first.left).toEqual(second.left)
    expect(first.snapshot).toEqual(second.snapshot)
    expect(first.events).toEqual(second.events)
    expect(first.snapshot.versions).toEqual(COMBAT_V6_PHASE_3_VERSIONS)
    expect(first.events[0]).toMatchObject({ type: EventType.BattleStart, versions: COMBAT_V6_PHASE_3_VERSIONS })
  })

  it("相同裸角色选择不同流派时产生稳定且隔离的构筑差异", () => {
    const zhanchen = project("left", 0, LINGXIAO_PATH_ID.Zhanchen, ["lingxiao.node.zhanchen.1.1"])
    const guiyi = project("left", 0, LINGXIAO_PATH_ID.Guiyi, ["lingxiao.node.guiyi.1.2"])
    expect(zhanchen.ok && guiyi.ok).toBe(true)
    if (!zhanchen.ok || !guiyi.ok) return

    expect(zhanchen.unit.resources).toEqual([])
    expect(guiyi.unit.resources?.[0]?.id).toBe(LINGXIAO_RESOURCE_ID)
    expect(guiyi.unit.skills).toContain(LINGXIAO_SKILL_ID.ShadowStrike)
    expect(zhanchen.unit.skills).not.toContain(LINGXIAO_SKILL_ID.ShadowStrike)
    expect(zhanchen.unit.skillOverrides).not.toEqual(guiyi.unit.skillOverrides)
  })
})
