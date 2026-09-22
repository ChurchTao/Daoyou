import { describe, expect, it } from "vitest"
import { EffectType } from "../core/index.ts"
import { compileSectDefinitionV6 } from "./compiler.ts"
import {
  LINGXIAO_METHOD_ID,
  LINGXIAO_PATH_ID,
  LINGXIAO_SKILL_ID,
  LINGXIAO_V6_DEFINITION,
} from "./lingxiao.ts"
import type { SectCombatProgressV6, SectDefinitionV6 } from "./types.ts"

function progress(
  activePathId = LINGXIAO_PATH_ID.Zhanchen,
  nodeIds: string[] = [],
  level = 180,
): SectCombatProgressV6 {
  return {
    version: 1,
    sectId: "lingxiao",
    methods: Object.fromEntries(
      LINGXIAO_V6_DEFINITION.methods.map((method) => [method.id, level]),
    ),
    meridianDepth: 7,
    activePathId,
    meridianLoadouts: [
      {
        pathId: LINGXIAO_PATH_ID.Zhanchen,
        nodeIds: activePathId === LINGXIAO_PATH_ID.Zhanchen ? nodeIds : [],
        revision: 1,
      },
      {
        pathId: LINGXIAO_PATH_ID.Guiyi,
        nodeIds: activePathId === LINGXIAO_PATH_ID.Guiyi ? nodeIds : [],
        revision: 1,
      },
    ],
  }
}

function compile(
  combatProgress: SectCombatProgressV6,
  definition = LINGXIAO_V6_DEFINITION,
  characterLevel = 180,
) {
  definition = structuredClone(definition)
  for (const path of definition.paths) path.requiresConnectedNodes = false // 单独验证编译和节点效果。
  return compileSectDefinitionV6({ definition, progress: combatProgress, characterLevel })
}

function cloneDefinition(): SectDefinitionV6 {
  return structuredClone(LINGXIAO_V6_DEFINITION)
}

function projectionSignature(result: ReturnType<typeof compile>): string {
  if (!result.ok) return JSON.stringify(result)
  const projection = result.projection
  return JSON.stringify({
    panel: projection.panel,
    skills: projection.skills,
    activeSkillIds: projection.activeSkillIds,
    passiveSkillIds: projection.passiveSkillIds,
    skillOverrides: projection.skillOverrides,
    resources: projection.resources,
  })
}

describe("红尘剑宗 v6 内容与编译", () => {
  it("锁定六心法、双流派和每条流派七层三节点", () => {
    expect(LINGXIAO_V6_DEFINITION.methods).toHaveLength(6)
    expect(LINGXIAO_V6_DEFINITION.methods.filter((method) => method.isPrimary)).toHaveLength(1)
    expect(LINGXIAO_V6_DEFINITION.paths).toHaveLength(2)
    for (const path of LINGXIAO_V6_DEFINITION.paths) {
      expect(path.nodes).toHaveLength(21)
      for (let layer = 1; layer <= 7; layer++) {
        expect(path.nodes.filter((node) => node.layer === layer).map((node) => node.slot).sort()).toEqual([1, 2, 3])
      }
    }
  })

  it("由所属心法生成技能等级并编译六心法面板", () => {
    const result = compile(progress())
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.projection.panel.slice(0, 6)).toEqual([
      { attr: "physicalAtk", mode: "add", value: 90 },
      { attr: "hit", mode: "add", value: 90 },
      { attr: "physicalDef", mode: "add", value: 72 },
      { attr: "speed", mode: "add", value: 27 },
      { attr: "maxHp", mode: "add", value: 360 },
      { attr: "sealResist", mode: "add", value: 45 },
    ])
    expect(result.projection.skillLevels[LINGXIAO_SKILL_ID.Triple]).toBe(180)
    expect(result.projection.skillLevels[LINGXIAO_SKILL_ID.Formation]).toBe(180)
    expect(result.projection.skillLevels[LINGXIAO_SKILL_ID.Confuse]).toBe(180)
  })

  it("锁定六个基础主动技能的门槛、成本、段数、目标数和状态机制", () => {
    const result = compile(progress())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const byId = new Map(result.projection.skills.map((skill) => [skill.id, skill]))

    expect(byId.get(LINGXIAO_SKILL_ID.Triple)).toMatchObject({
      costHp: "maxHp * 0.1",
      requireHpAboveRatio: 0.5,
      targeting: { count: 1 },
      effects: [
        { type: EffectType.PhysicalHit, hits: 3, coeff: [0.75, 0.85, 0.95], power: 0 },
        { type: EffectType.SkipNextAction },
        { type: EffectType.ApplyStatus, duration: 1, self: true },
      ],
    })
    expect(byId.get(LINGXIAO_SKILL_ID.Waiting)).toMatchObject({
      costHp: "hp * 0.05",
      effects: [{ type: EffectType.ApplyStatus, duration: 1, self: true, storeTarget: true }],
    })
    expect(byId.get(LINGXIAO_SKILL_ID.Formation)).toMatchObject({
      costHp: "maxHp * 0.1",
      requireHpBelowRatio: 0.5,
      forbidRevivedRound: true,
      targeting: { count: 3 },
      effects: [{ type: EffectType.PhysicalHit, coeff: 0.85, power: "floor(skillLevel * 0.4)" },
        { type: EffectType.SkipNextAction }, { type: EffectType.ApplyStatus, statusId: "lingxiao.status.recovery", duration: 1, self: true }],
    })
    expect(byId.get(LINGXIAO_SKILL_ID.SwordAura)?.effects[0]).toMatchObject({ duration: 5 })
    expect(byId.get(LINGXIAO_SKILL_ID.Clarity)?.effects[0]).toMatchObject({ duration: 5, self: true })
    expect(byId.get(LINGXIAO_SKILL_ID.Confuse)).toMatchObject({
      sealBase: 50,
      effects: [{ type: EffectType.ApplyStatus, duration: 2, hit: "seal" }],
    })
  })

  it("临渊在心法120级解锁，降低血线和扩展人数的节点保留效果", () => {
    for (const level of [119, 120]) {
      const result = compile(progress(LINGXIAO_PATH_ID.Zhanchen, [], level))
      expect(result.ok && result.projection.activeSkillIds.includes(LINGXIAO_SKILL_ID.Formation)).toBe(level === 120)
    }
    const result = compile(progress(LINGXIAO_PATH_ID.Zhanchen, ["lingxiao.node.zhanchen.6.2", "lingxiao.node.zhanchen.5.1"]))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.projection.skills.flatMap(s => s.modifiers ?? [])).toEqual(expect.arrayContaining([
        expect.objectContaining({ hpRequirement: { min: 0.1 }, when: { skillIds: [LINGXIAO_SKILL_ID.Formation], pvp: true } }),
        expect.objectContaining({ targetCountAdd: 'if(uses.lingxiao.skill.formation == 0, 3, 0)' }),
      ]))
    }
  })

  it("拒绝心法缺失、越界和分支高于主心法", () => {
    const missing = progress()
    delete missing.methods[LINGXIAO_METHOD_ID.Clarity]
    expect(compile(missing).ok).toBe(false)

    const overCap = progress(LINGXIAO_PATH_ID.Zhanchen, [], 20)
    overCap.methods[LINGXIAO_METHOD_ID.Clarity] = 21
    expect(compile(overCap, LINGXIAO_V6_DEFINITION, 10)).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([
        expect.objectContaining({ code: "METHOD_LEVEL_CAP_EXCEEDED" }),
      ]),
    })

    const branch = progress(LINGXIAO_PATH_ID.Zhanchen, [], 100)
    branch.methods[LINGXIAO_METHOD_ID.Canon] = 99
    expect(compile(branch)).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([
        expect.objectContaining({ code: "BRANCH_METHOD_EXCEEDS_PRIMARY" }),
      ]),
    })
  })

  it("校验双方案、节点归属、解锁深度和同层互斥", () => {
    const wrongLoadouts = progress()
    wrongLoadouts.meridianLoadouts[1].pathId = LINGXIAO_PATH_ID.Zhanchen
    expect(compile(wrongLoadouts)).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([expect.objectContaining({ code: "INVALID_MERIDIAN_LOADOUT" })]),
    })

    const wrongPath = progress(LINGXIAO_PATH_ID.Zhanchen, ["lingxiao.node.guiyi.1.1"])
    expect(compile(wrongPath)).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([expect.objectContaining({ code: "MERIDIAN_NODE_WRONG_PATH" })]),
    })

    const locked = progress(LINGXIAO_PATH_ID.Zhanchen, ["lingxiao.node.zhanchen.2.1"])
    locked.meridianDepth = 1
    expect(compile(locked)).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([expect.objectContaining({ code: "MERIDIAN_NODE_LOCKED" })]),
    })

    const sameLayer = progress(LINGXIAO_PATH_ID.Zhanchen, [
      "lingxiao.node.zhanchen.1.1",
      "lingxiao.node.zhanchen.1.2",
    ])
    expect(compile(sameLayer)).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([expect.objectContaining({ code: "MERIDIAN_LAYER_CONFLICT" })]),
    })
  })

  it("允许已解锁层留空但输出稳定 warning", () => {
    const combatProgress = progress()
    combatProgress.meridianDepth = 2
    const result = compile(combatProgress)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.projection.diagnostics.filter((item) => item.code === "MERIDIAN_SELECTION_INCOMPLETE")).toHaveLength(2)
  })

  it("拒绝缺失 patch 目标、覆盖冲突和内容 ID 重复", () => {
    const missingTarget = cloneDefinition()
    missingTarget.paths[0].patches = [{ skillId: "missing", operation: "setRequireHpRatio", value: 0.4 }]
    expect(compile(progress(), missingTarget)).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([expect.objectContaining({ code: "PATCH_TARGET_MISSING" })]),
    })

    const conflict = cloneDefinition()
    conflict.paths[0].patches = [{ skillId: LINGXIAO_SKILL_ID.Waiting, operation: "setCostHp", value: 2 }]
    expect(compile(progress(LINGXIAO_PATH_ID.Zhanchen, ["lingxiao.node.zhanchen.2.2"]), conflict)).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([expect.objectContaining({ code: "PATCH_CONFLICT" })]),
    })

    const duplicate = cloneDefinition()
    duplicate.statuses[0]!.id = duplicate.skills[0]!.definition.id
    expect(compile(progress(), duplicate)).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([expect.objectContaining({ code: "CONTENT_ID_CONFLICT" })]),
    })

    const missingRevoke = cloneDefinition()
    missingRevoke.paths[0].revokeSkillIds = ["missing"]
    expect(compile(progress(), missingRevoke)).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([expect.objectContaining({ code: "PATCH_TARGET_MISSING" })]),
    })
  })

  it("按 grant 后 revoke 的顺序移除技能", () => {
    const definition = cloneDefinition()
    definition.paths[0].revokeSkillIds = [LINGXIAO_SKILL_ID.Confuse]
    const result = compile(progress(), definition)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.projection.activeSkillIds).not.toContain(LINGXIAO_SKILL_ID.Confuse)
    expect(result.projection.skills.some((skill) => skill.id === LINGXIAO_SKILL_ID.Confuse)).toBe(false)
  })

  it("惊鸿及长驱的心法门槛在经脉选择后仍生效", () => {
    const combatProgress = progress(LINGXIAO_PATH_ID.Zhanchen, ["lingxiao.node.zhanchen.2.3"], 44)
    const result = compile(combatProgress)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.projection.activeSkillIds).not.toContain("lingxiao.skill.zhanchen_long_drive")
  })

  it("42个节点逐项都改变最终可观察内容", () => {
    for (const path of LINGXIAO_V6_DEFINITION.paths) {
      const empty = projectionSignature(compile(progress(path.id)))
      for (const node of path.nodes) {
        const result = compile(progress(path.id, [node.id]))
        expect(result.ok, `${node.id} 应可独立编译`).toBe(true)
        expect(projectionSignature(result), `${node.id} 不得为空节点`).not.toBe(empty)
      }
    }
  })

  it("隔离连通限制后每层任取一个节点均无 patch 冲突", () => {
    for (const path of LINGXIAO_V6_DEFINITION.paths) {
      const byLayer = Array.from({ length: 7 }, (_, index) =>
        path.nodes.filter((node) => node.layer === index + 1 && !node.automatic),
      )
      let combinations: string[][] = [[]]
      for (const layer of byLayer) {
        combinations = combinations.flatMap((chosen) => layer.map((node) => [...chosen, node.id]))
      }
      for (const nodeIds of combinations) {
        const result = compile(progress(path.id, nodeIds))
        expect(result.ok, `${path.id}: ${nodeIds.join(",")}`).toBe(true)
      }
    }
  })

  it("无双基础剑意与破军门槛分别编译，剑意无上限", () => {
    const result = compile(progress(LINGXIAO_PATH_ID.Guiyi, ["lingxiao.node.guiyi.7.2"]))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.projection.resources[0]).toMatchObject({ current: 0, max: null })
    expect(result.projection.skills.flatMap(s => s.modifiers ?? [])).toEqual(expect.arrayContaining([
      expect.objectContaining({ damageBonus: .05, when: { sourceResource: { id: 'lingxiao.resource.sword_intent', min: 5 } } }),
      expect.objectContaining({ ignoreProtection: true, splash: { factor: .45, count: 'if(resource.lingxiao.resource.sword_intent >= 17, 4, 3)' } }),
    ]))
  })
})
