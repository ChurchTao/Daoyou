import { describe, expect, it } from "vitest"
import type { Attributes } from "@shared/types/cultivator"
import {
  BattlePhase,
  CommandType,
  EffectType,
  FailReason,
  SkillTag,
  TargetSide,
  Team,
  UnitKind,
  createBattle,
  type SkillDef,
} from "./core/index.ts"
import {
  COMBAT_V6_SECT_DEFINITIONS_V4,
  WUXIANG_SKILL_ID,
  type CombatV6SectId,
  type SectCombatProgressV6,
} from "./content/index.ts"
import {
  COMBAT_V6_TRAINING_CONTENT_V1,
  COMBAT_V6_TRAINING_ENCOUNTERS_V1,
  TRAINING_ENCOUNTER_ID,
  TrainingHostError,
  TrainingHostErrorCode,
  compileCombatV6TrainingEncounterV1,
  createCombatV6TrainingHostV1,
  restoreCombatV6TrainingHostV1,
  trainingEncounterOutcome,
  validateCombatV6TrainingContentV1,
  type CombatV6TrainingTierV1,
} from "./encounter/index.ts"
import { daoyouRulesetV5 } from "./rules-daoyou/index.ts"
import { COMBAT_V6_PHASE_6D_VERSIONS, COMBAT_V6_PHASE_7A_VERSIONS } from "./version.ts"
import { CombatV6RedisRuntimeV1Schema } from "@shared/contracts/combatV6Runtime"

const ATTRIBUTES: Attributes = { vitality: 10, strength: 10, spirit: 10, endurance: 10, speed: 10, willpower: 10 }
const MANUALS = { version: 1 as const, revision: 0, build: { slots: [] } }

function progress(sectId: CombatV6SectId): SectCombatProgressV6 {
  const definition = COMBAT_V6_SECT_DEFINITIONS_V4[sectId]
  return {
    version: 1,
    sectId,
    methods: Object.fromEntries(definition.methods.map((method) => [method.id, 180])),
    meridianDepth: 0,
    activePathId: definition.paths[0].id,
    meridianLoadouts: definition.paths.map((path) => ({ pathId: path.id, nodeIds: [], revision: 1 })) as SectCombatProgressV6["meridianLoadouts"],
  }
}

function input(encounterId = TRAINING_ENCOUNTER_ID.SingleDummy, tier: CombatV6TrainingTierV1 = 60, sectId: CombatV6SectId = "lingxiao", seed = 17) {
  return {
    encounterId,
    tier,
    seed,
    player: {
      cultivator: { id: "player", name: "试炼者", realm: "渡劫" as const, realm_stage: "圆满" as const, attributes: { ...ATTRIBUTES } },
      sect: progress(sectId),
      equipment: {},
      manuals: MANUALS,
    },
  }
}

describe("combat-v6 Phase 7A 内容与编译", () => {
  it("训练内容、三档显式NPC和六类遭遇完整", () => {
    expect(validateCombatV6TrainingContentV1()).toEqual([])
    expect(COMBAT_V6_TRAINING_ENCOUNTERS_V1).toHaveLength(6)
    for (const tier of [60, 120, 180] as const) {
      for (const encounter of COMBAT_V6_TRAINING_ENCOUNTERS_V1) {
        const result = compileCombatV6TrainingEncounterV1(input(encounter.id, tier))
        expect(result.ok, `${encounter.id}@${tier}`).toBe(true)
        if (!result.ok) continue
        expect(result.versions).toEqual(COMBAT_V6_PHASE_7A_VERSIONS)
        expect(result.compiled.sourceProjectionVersions).toEqual(COMBAT_V6_PHASE_6D_VERSIONS)
        expect(result.compiled.battleInput.units.some((unit) => unit.side === Team.B)).toBe(true)
        const player = result.compiled.battleInput.units.find((unit) => unit.id === "player")!
        expect(player.attrs.hp).toBe(player.attrs.maxHp)
        expect(player.attrs.mp).toBe(player.attrs.maxMp)
      }
    }
  })

  it("五宗门均可进入同一训练入口且不修改输入", () => {
    for (const sectId of Object.keys(COMBAT_V6_SECT_DEFINITIONS_V4) as CombatV6SectId[]) {
      const payload = input(TRAINING_ENCOUNTER_ID.TripleDummy, 120, sectId)
      const before = structuredClone(payload)
      const result = compileCombatV6TrainingEncounterV1(payload)
      expect(result.ok, sectId).toBe(true)
      expect(payload).toEqual(before)
      if (result.ok) expect(result.compiled.battleInput.units).toHaveLength(4)
    }
  })

  it("未知内容、无效面板和冲突ID稳定阻止编译", () => {
    expect(compileCombatV6TrainingEncounterV1(input("missing")).ok).toBe(false)
    const content = structuredClone(COMBAT_V6_TRAINING_CONTENT_V1)
    content.skills.push({ ...content.skills[0], name: "冲突定义" })
    content.combatants[0].attrs.maxHp = Number.NaN
    const codes = validateCombatV6TrainingContentV1(content).map((item) => item.code)
    expect(codes).toContain("ENCOUNTER_CONTENT_ID_CONFLICT")
    expect(codes).toContain("INVALID_PVE_ATTRIBUTE")
  })
})

describe("combat-v6 Phase 7A 指令查询", () => {
  it("查询资源、目标和基础指令且不修改状态、事件或RNG", () => {
    const skill: SkillDef = {
      id: "test.query.costly",
      name: "耗蓝术",
      costMp: 20,
      tags: [SkillTag.Spell],
      targeting: { side: TargetSide.Enemy, count: 1 },
      effects: [{ type: EffectType.SpellHit, power: 10 }],
    }
    const battle = createBattle({
      seed: 1,
      versions: COMBAT_V6_PHASE_7A_VERSIONS,
      ruleset: daoyouRulesetV5,
      skills: [skill],
      units: [
        { id: "source", name: "source", side: 0, kind: UnitKind.Player, attrs: { hp: 100, maxHp: 100, mp: 0, maxMp: 100, speed: 10, physicalAtk: 10, physicalDef: 10 }, skills: [skill.id] },
        { id: "target", name: "target", side: 1, kind: UnitKind.Npc, attrs: { hp: 100, maxHp: 100, speed: 1, physicalAtk: 1, physicalDef: 1 } },
      ],
    })
    const before = { snapshot: battle.snapshot(), log: [...battle.log()] }
    const options = battle.queryCommands("source")
    expect(options).toMatchObject({ canSubmit: true, attackTargetIds: ["target"], canDefend: true, canFlee: true })
    expect(options.skills[0]).toMatchObject({ skillId: skill.id, ready: false, reasons: [FailReason.InsufficientMp], selectableTargetIds: ["target"], targetCount: 1 })
    expect(battle.snapshot()).toEqual(before.snapshot)
    expect(battle.log()).toEqual(before.log)
    battle.submit("source", { type: CommandType.Skill, skillId: skill.id, targets: ["target"] })
    battle.lockAndResolve()
    expect(battle.log()).toContainEqual(expect.objectContaining({ type: "actionFailed", unitId: "source", reason: FailReason.InsufficientMp }))
  })
})

describe("combat-v6 Phase 7A Host", () => {
  it("要求玩家指令、允许锁定前覆盖并执行确定性NPC策略", () => {
    const result = createCombatV6TrainingHostV1(input(TRAINING_ENCOUNTER_ID.SingleSparring))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(() => result.host.resolveRound()).toThrowError(expect.objectContaining({ code: TrainingHostErrorCode.PlayerCommandMissing }))
    const target = result.host.queryCommands().attackTargetIds[0]
    result.host.submit(result.host.playerId, { type: CommandType.Defend })
    result.host.submit(result.host.playerId, { type: CommandType.Attack, target })
    const events = result.host.resolveRound()
    expect(events.some((event) => event.type === "actionStart" && event.unitId === result.host.playerId && event.command.type === CommandType.Attack)).toBe(true)
    expect(result.host.trace().rounds[0].commands.find((entry) => entry.unitId === result.host.playerId)?.command.type).toBe(CommandType.Attack)
    expect(result.host.state.phase).toBe(BattlePhase.Command)
  })

  it("只接受玩家的结构合法指令", () => {
    const result = createCombatV6TrainingHostV1(input())
    if (!result.ok) throw new Error("训练Host创建失败")
    const npc = result.host.state.units.find((unit) => unit.id !== result.host.playerId)!
    expect(() => result.host.submit(npc.id, { type: CommandType.Defend })).toThrowError(expect.objectContaining({ code: TrainingHostErrorCode.UnitNotControlled }))
    expect(() => result.host.submit(result.host.playerId, { type: CommandType.Skill, skillId: "missing", targets: [npc.id] })).toThrowError(expect.objectContaining({ code: TrainingHostErrorCode.UnknownSkill }))
    expect(() => result.host.submit(result.host.playerId, { type: CommandType.Item, itemId: "x", target: npc.id })).toThrowError(TrainingHostError)
  })

  it("净化和复活条件由正常技能与伤害形成", () => {
    const cleanse = createCombatV6TrainingHostV1(input(TRAINING_ENCOUNTER_ID.SupportCleanse, 60, "wuxiang"))
    const revive = createCombatV6TrainingHostV1(input(TRAINING_ENCOUNTER_ID.SupportRevive, 60, "wuxiang"))
    if (!cleanse.ok || !revive.ok) throw new Error("专项训练创建失败")
    cleanse.host.submit(cleanse.host.playerId, { type: CommandType.Defend })
    cleanse.host.resolveRound()
    const afflicted = cleanse.host.state.units.find((unit) => unit.name === "受术同伴")!
    expect(afflicted.statuses.some((status) => status.id === "combat.training.status.control")).toBe(true)
    cleanse.host.submit(cleanse.host.playerId, { type: CommandType.Skill, skillId: WUXIANG_SKILL_ID.Purify, targets: [afflicted.id] })
    cleanse.host.resolveRound()
    expect(cleanse.host.state.units.find((unit) => unit.id === afflicted.id)!.statuses.some((status) => status.id === "combat.training.status.control")).toBe(false)

    revive.host.submit(revive.host.playerId, { type: CommandType.Defend })
    revive.host.resolveRound()
    const fallen = revive.host.state.units.find((unit) => unit.name === "待援同伴")!
    expect(fallen.flags.downed).toBe(true)
    expect(revive.host.trace().events.some((event) => event.type === "unitDowned" && event.unitId === fallen.id)).toBe(true)
    revive.host.submit(revive.host.playerId, { type: CommandType.Skill, skillId: WUXIANG_SKILL_ID.Revive, targets: [fallen.id] })
    revive.host.resolveRound()
    expect(revive.host.state.units.find((unit) => unit.id === fallen.id)!.flags.downed).toBe(false)
  })

  it("相同输入和指令得到相同不可变调试转录", () => {
    const run = () => {
      const result = createCombatV6TrainingHostV1(input(TRAINING_ENCOUNTER_ID.TripleDummy, 60, "tianyan", 99))
      if (!result.ok) throw new Error("训练Host创建失败")
      result.host.submit(result.host.playerId, { type: CommandType.Defend })
      result.host.resolveRound()
      return result.host
    }
    const left = run()
    const right = run()
    expect(left.trace()).toEqual(right.trace())
    const trace = left.trace()
    trace.initialUnits[0].name = "被修改"
    trace.rounds.length = 0
    expect(left.trace().initialUnits[0].name).not.toBe("被修改")
    expect(left.trace().rounds).toHaveLength(1)
  })

  it("从Redis运行快照恢复后保持指令、RNG、事件和终态确定性", () => {
    const created = createCombatV6TrainingHostV1(input(TRAINING_ENCOUNTER_ID.SingleSparring, 60, "jiujie", 771))
    if (!created.ok) throw new Error("训练Host创建失败")
    const target = created.host.queryCommands().attackTargetIds[0]
    created.host.submit(created.host.playerId, { type: CommandType.Attack, target })
    const restored = restoreCombatV6TrainingHostV1(created.host.runtimeSnapshot())
    if (!restored.ok) throw new Error("训练Host恢复失败")
    expect(restored.host.state).toEqual(created.host.state)
    expect(restored.host.trace().events).toEqual(created.host.trace().events)
    created.host.resolveRound()
    restored.host.resolveRound()
    expect(restored.host.trace()).toEqual(created.host.trace())
    expect(CombatV6RedisRuntimeV1Schema.safeParse({
      runtimeVersion: "combat_v6_redis_runtime_v1",
      battleId: "c431d125-c61d-423a-9b2d-dde9dd94daac",
      userId: "9942e266-6f21-4b96-8563-d476e581f612",
      cultivatorId: "34fd2d39-1322-44c6-a566-e552b28d6781",
      membershipId: "f14f1d52-c21d-45d6-8ea3-2a510a855c1f",
      buildRevision: 1,
      metadata: { schemaVersion: 1, sourceType: "training-room", battleType: "training", idempotencyKey: "c457d5b7-d6be-471b-9dc2-d17bd267e339", payload: { encounterId: TRAINING_ENCOUNTER_ID.SingleSparring, tier: 60 } },
      revision: 1,
      createdAt: "2026-09-04T00:00:00.000Z",
      expiresAt: "2026-09-04T02:00:00.000Z",
      latestEventSeq: created.host.trace().events.length - 1,
      host: created.host.runtimeSnapshot(),
    }).success).toBe(true)
  })

  it("将内核终局稳定解释为训练结果", () => {
    const result = createCombatV6TrainingHostV1(input())
    if (!result.ok) throw new Error("训练Host创建失败")
    const base = result.host.snapshot()
    expect(trainingEncounterOutcome(base, result.host.playerId)).toBeUndefined()
    expect(trainingEncounterOutcome({ ...base, result: { winner: Team.A, reason: "wipe" } }, result.host.playerId)).toBe("victory")
    expect(trainingEncounterOutcome({ ...base, result: { winner: Team.B, reason: "wipe" } }, result.host.playerId)).toBe("defeat")
    expect(trainingEncounterOutcome({ ...base, result: { winner: "draw", reason: "round-limit" } }, result.host.playerId)).toBe("draw")
    expect(trainingEncounterOutcome({ ...base, result: { winner: Team.B, reason: "flee" } }, result.host.playerId)).toBe("aborted")
  })
})
